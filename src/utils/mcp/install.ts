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

// POSIX shell words: keep simple tokens readable; quote all shell syntax as data.
function shellWord(value: string): string {
    return /^[a-zA-Z0-9_@%+=:,./-]+$/.test(value)
        ? value
        : "'" + value.replace(/'/g, "'\\''") + "'";
}

// Decode the literal POSIX words emitted above for clients that use argv, not a shell.
export function splitCommandWords(command: string): string[] {
    const words: string[] = [];
    let word = '';
    let quoted = false;
    let started = false;
    for (let i = 0; i < command.length; i++) {
        const ch = command[i]!;
        if (ch === "'") {
            quoted = !quoted;
            started = true;
        } else if (!quoted && ch === '\\') {
            if (++i >= command.length) return [];
            word += command[i];
            started = true;
        } else if (!quoted && /\s/.test(ch)) {
            if (started) words.push(word);
            word = '';
            started = false;
        } else {
            word += ch;
            started = true;
        }
    }
    if (quoted) return [];
    if (started) words.push(word);
    return words;
}

function commandForOciPackage(pkg: McpPackage): string {
    const image = pkg.identifier + (pkg.version ? `:${pkg.version}` : '');
    const extra = [...(pkg.runtimeArguments ?? []), ...(pkg.packageArguments ?? [])];
    const required = (pkg.environmentVariables ?? []).filter((e) => e.required !== false);
    // Reject structures that cannot be represented safely as shell words/assignments.
    if (!image || image.startsWith('-') || [image, ...extra].some((v) => v.includes('\0')) ||
        required.some((e) => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(e.name))) return '';
    const env = required.map((e) => `${e.name}=${shellWord('<value>')}`);
    return [...env, 'docker', 'run', '-i', '--rm', shellWord(image), ...extra.map(shellWord)].join(' ');
}

// Build the copyable command for a single package method (used on the detail page).
export function commandForPackage(pkg: McpPackage): string {
    const env = envPrefix(pkg);
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
            return commandForOciPackage(pkg);
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
