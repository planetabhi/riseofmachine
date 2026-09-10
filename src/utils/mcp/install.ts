// Precompute the primary install CTA for a server (§5.8). Pure & deterministic.
// Config values are NEVER emitted — env-var/header names become placeholders only.
import type { McpServer, McpPackage, McpRemote, McpInstallKind, McpRegistryType } from '../../types/mcp';

// Registry-type ordering when choosing the primary package.
const REGISTRY_ORDER: McpRegistryType[] = ['npm', 'pypi', 'oci', 'nuget', 'mcpb'];

// Pick the primary package: prefer stdio transport, then by registry order.
export function selectPrimaryPackage(packages: McpPackage[]): McpPackage | undefined {
    if (packages.length === 0) return undefined;
    const ranked = packages.toSorted((a, b) => {
        const aStdio = a.transport === 'stdio' ? 0 : 1;
        const bStdio = b.transport === 'stdio' ? 0 : 1;
        if (aStdio !== bStdio) return aStdio - bStdio;
        const ai = REGISTRY_ORDER.indexOf(a.registryType);
        const bi = REGISTRY_ORDER.indexOf(b.registryType);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return ranked[0];
}

// Env-var names rendered as `KEY=<value>` placeholders — never real secrets.
function envPrefix(pkg: McpPackage): string {
    const required = (pkg.environmentVariables ?? []).filter((e) => e.required !== false);
    if (required.length === 0) return '';
    return required.map((e) => `${e.name}=<value>`).join(' ') + ' ';
}

function versionSuffix(pkg: McpPackage): string {
    return pkg.version ? `@${pkg.version}` : '';
}

function args(pkg: McpPackage): string {
    const all = [...(pkg.runtimeArguments ?? []), ...(pkg.packageArguments ?? [])].filter(Boolean);
    return all.length ? ' ' + all.join(' ') : '';
}

// Build the copyable command for a single package method (used on the detail page).
export function commandForPackage(pkg: McpPackage): string {    const env = envPrefix(pkg);
    const id = pkg.identifier;
    const v = versionSuffix(pkg);
    const extra = args(pkg);
    switch (pkg.registryType) {
        case 'npm': {
            const runner = pkg.runtimeHint || 'npx -y';
            return `${env}${runner} ${id}${v}${extra}`.trim();
        }
        case 'pypi': {
            const runner = pkg.runtimeHint || 'uvx';
            return `${env}${runner} ${id}${v}${extra}`.trim();
        }
        case 'oci': {
            const ver = pkg.version ? `:${pkg.version}` : '';
            return `${env}docker run -i --rm ${id}${ver}${extra}`.trim();
        }
        case 'nuget': {
            const runner = pkg.runtimeHint || 'dnx';
            return `${env}${runner} ${id}${v}${extra}`.trim();
        }
        case 'mcpb':
            return `${env}mcpb install ${id}`.trim();
        default:
            return `${env}${id}${v}${extra}`.trim();
    }
}

export interface InstallResult {
    installCommand: string;
    installKind: McpInstallKind;
}

// Method precedence: packages first (stdio/registry order), else first remote, else none.
export function buildInstallCommand(
    server: Pick<McpServer, 'packages' | 'remotes'>,
): InstallResult {
    const pkg = selectPrimaryPackage(server.packages);
    if (pkg) {
        return { installCommand: commandForPackage(pkg), installKind: 'package' };
    }
    const remote: McpRemote | undefined = server.remotes[0];
    if (remote) {
        return { installCommand: remote.url, installKind: 'remote' };
    }
    return { installCommand: '', installKind: 'none' };
}
