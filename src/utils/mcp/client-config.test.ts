import { describe, expect, it } from 'vitest';
import { buildInstallCommand } from './install';
import { buildClientConfig } from './client-config';
import type { McpPackage } from '../../types/mcp';

describe('MCP client config', () => {
    it('preserves OCI arguments and placeholders from registry data in JSON', () => {
        const pkg: McpPackage = {
            registryType: 'oci', identifier: 'example/image', version: '2', transport: 'stdio',
            environmentVariables: [{ name: 'API_KEY' }],
            runtimeArguments: ['two words', "a'b", '$(id)'],
            packageArguments: ['', 'a\nb', '"quoted"'],
        };
        const { installCommand, installKind } = buildInstallCommand({ packages: [pkg], remotes: [] });
        expect(JSON.parse(buildClientConfig({ installCommand, installKind, slug: 'example' }))).toEqual({
            mcpServers: { example: {
                command: 'docker',
                args: ['run', '-i', '--rm', 'example/image:2', 'two words', "a'b", '$(id)', '', 'a\nb', '"quoted"'],
                env: { API_KEY: '<value>' },
            } },
        });
    });

    it('retains the existing npm and remote config formats', () => {
        expect(JSON.parse(buildClientConfig({ installCommand: 'API_KEY=<value> npx -y demo@1 --flag', installKind: 'package', slug: 'demo' })))
            .toEqual({ mcpServers: { demo: { command: 'npx', args: ['-y', 'demo@1', '--flag'], env: { API_KEY: '<value>' } } } });
        expect(JSON.parse(buildClientConfig({ installCommand: 'https://example.test/mcp', installKind: 'remote', transports: 'sse', slug: 'remote' })))
            .toEqual({ mcpServers: { remote: { type: 'sse', url: 'https://example.test/mcp' } } });
    });

    it('does not produce a client config for installers or missing commands', () => {
        expect(buildClientConfig({ installCommand: 'mcpb install bundle', installKind: 'package' })).toBe('');
        expect(buildClientConfig({ installCommand: '', installKind: 'package' })).toBe('');
    });
});
