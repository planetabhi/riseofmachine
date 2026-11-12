import { describe, it, expect } from 'vitest';
import { buildInstallCommand, catalogInstallCommand, selectPrimaryPackage } from './install';
import type { McpPackage, McpRemote } from '../../types/mcp';

const pkg = (over: Partial<McpPackage>): McpPackage => ({
    registryType: 'npm',
    identifier: 'demo',
    transport: 'stdio',
    ...over,
});

describe('selectPrimaryPackage', () => {
    it('prefers stdio transport, then registry order npm→pypi→oci→nuget→mcpb', () => {
        const chosen = selectPrimaryPackage([
            pkg({ registryType: 'pypi', identifier: 'a', transport: 'stdio' }),
            pkg({ registryType: 'npm', identifier: 'b', transport: 'stdio' }),
        ]);
        expect(chosen?.identifier).toBe('b');
    });

    it('prefers a stdio package over a non-stdio one of higher registry order', () => {
        const chosen = selectPrimaryPackage([
            pkg({ registryType: 'npm', identifier: 'a', transport: 'streamable-http' }),
            pkg({ registryType: 'pypi', identifier: 'b', transport: 'stdio' }),
        ]);
        expect(chosen?.identifier).toBe('b');
    });
});

describe('buildInstallCommand', () => {
    it('npm → npx -y with version', () => {
        const r = buildInstallCommand({ packages: [pkg({ identifier: 'foo', version: '1.2.3' })], remotes: [] });
        expect(r.installKind).toBe('package');
        expect(r.installCommand).toBe('npx -y foo@1.2.3');
    });

    it('omits @version when absent', () => {
        const r = buildInstallCommand({ packages: [pkg({ identifier: 'foo' })], remotes: [] });
        expect(r.installCommand).toBe('npx -y foo');
    });

    it('pypi → uvx', () => {
        const r = buildInstallCommand({ packages: [pkg({ registryType: 'pypi', identifier: 'bar' })], remotes: [] });
        expect(r.installCommand).toBe('uvx bar');
    });

    it('oci → docker run with :version', () => {
        const r = buildInstallCommand({ packages: [pkg({ registryType: 'oci', identifier: 'img', version: '2' })], remotes: [] });
        expect(r.installCommand).toBe('docker run -i --rm img:2');
    });

    it('forwards required OCI environment variables to the container by name', () => {
        const p = pkg({
            registryType: 'oci', identifier: 'img', version: '2',
            environmentVariables: [
                { name: 'API_KEY', required: true },
                { name: 'CONFIG', required: true },
                { name: 'OPTIONAL', required: false },
            ],
            packageArguments: ['serve'],
        });
        const result = buildInstallCommand({ packages: [p], remotes: [] });
        expect(result.installCommand).toBe('API_KEY=<value> CONFIG=<value> docker run -i --rm -e API_KEY -e CONFIG img:2 serve');
        expect(catalogInstallCommand({ ...result, installCommand: 'old', packages: [p] })).toBe(result.installCommand);
    });

    it('does not turn invalid OCI environment names into Docker arguments', () => {
        const p = pkg({ registryType: 'oci', environmentVariables: [{ name: 'TOKEN --privileged' }] });
        expect(buildInstallCommand({ packages: [p], remotes: [] }).installCommand).toBe('');
    });

    it('does not refresh other cached package or remote commands', () => {
        expect(catalogInstallCommand({ installKind: 'package', installCommand: 'custom', packages: [pkg({})] })).toBe('custom');
        expect(catalogInstallCommand({ installKind: 'remote', installCommand: 'https://example.test', packages: [pkg({ registryType: 'oci' })] })).toBe('https://example.test');
    });

    it('nuget → dnx, mcpb → mcpb install', () => {
        expect(buildInstallCommand({ packages: [pkg({ registryType: 'nuget', identifier: 'n' })], remotes: [] }).installCommand).toBe('dnx n');
        expect(buildInstallCommand({ packages: [pkg({ registryType: 'mcpb', identifier: 'm' })], remotes: [] }).installCommand).toBe('mcpb install m');
    });

    it('env vars appear as KEY=<value> placeholders, never values', () => {
        const r = buildInstallCommand({
            packages: [pkg({ identifier: 'foo', environmentVariables: [{ name: 'API_KEY', required: true }] })],
            remotes: [],
        });
        expect(r.installCommand).toBe('API_KEY=<value> npx -y foo');
        expect(r.installCommand).not.toContain('secret');
    });

    it('appends runtime + package arguments', () => {
        const r = buildInstallCommand({
            packages: [pkg({ identifier: 'foo', runtimeArguments: ['--flag'], packageArguments: ['--port', '3000'] })],
            remotes: [],
        });
        expect(r.installCommand).toBe('npx -y foo --flag --port 3000');
    });

    it('falls back to remote endpoint when no packages', () => {
        const remotes: McpRemote[] = [{ type: 'streamable-http', url: 'https://x/mcp' }];
        const r = buildInstallCommand({ packages: [], remotes });
        expect(r.installKind).toBe('remote');
        expect(r.installCommand).toBe('https://x/mcp');
    });

    it('none when neither packages nor remotes', () => {
        const r = buildInstallCommand({ packages: [], remotes: [] });
        expect(r.installKind).toBe('none');
        expect(r.installCommand).toBe('');
    });
});
