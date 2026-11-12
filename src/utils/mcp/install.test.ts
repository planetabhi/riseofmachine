import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mapServer } from './map';
import { buildInstallCommand, commandForPackage, selectPrimaryPackage, splitCommandWords } from './install';
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


describe('OCI shell boundary', () => {
    const shellArgs = (command: string) => execFileSync('/bin/sh', ['-c',
        `docker() { printf '%s\\0' "$@"; }\n${command}`,
    ], { encoding: 'utf8' }).split('\0').slice(0, -1);

    it('preserves registry arguments as literal argv through the copyable command', () => {
        const runtime = ['$(printf INJECTED)', '`printf INJECTED`', 'two words', "a'b", ''];
        const args = ['; printf INJECTED', '$HOME', '*', 'a\nb', '"quoted"', 'x > /dev/null'];
        const server = mapServer({ server: {
            name: 'io.example/test', packages: [{
                registryType: 'oci', identifier: 'example/image', version: '2',
                runtimeArguments: runtime.slice(0, -1).map((value) => ({ value })),
                packageArguments: args.map((value) => ({ value })),
            }],
        } })!;
        expect(shellArgs(server.installCommand)).toEqual(['run', '-i', '--rm', 'example/image:2', ...runtime.slice(0, -1), ...args]);
        const command = commandForPackage(pkg({ registryType: 'oci', packageArguments: runtime }));
        expect(shellArgs(command)).toEqual(['run', '-i', '--rm', 'demo', ...runtime]);
        expect(splitCommandWords(command)).toEqual(['docker', ...shellArgs(command)]);
    });

    it('quotes image/version and env placeholders and ignores runtime hints', () => {
        const image = 'image$(printf INJECTED)';
        const version = "v'1; printf INJECTED";
        const command = commandForPackage(pkg({ registryType: 'oci', identifier: image, version,
            runtimeHint: 'printf INJECTED', environmentVariables: [{ name: 'API_KEY' }, { name: 'OPTIONAL', required: false }],
        }));
        expect(shellArgs(command)).toEqual(['run', '-i', '--rm', `${image}:${version}`]);
        expect(splitCommandWords(command)).toEqual(['API_KEY=<value>', 'docker', 'run', '-i', '--rm', `${image}:${version}`]);
    });

    it('withholds commands for invalid env names, option-like images and NUL bytes', () => {
        for (const over of [
            { environmentVariables: [{ name: 'X=$(printf INJECTED)' }] },
            { identifier: '--privileged' }, { identifier: '' },
            { packageArguments: ['a\0b'] },
        ]) expect(commandForPackage(pkg({ registryType: 'oci', ...over }))).toBe('');
    });
});
