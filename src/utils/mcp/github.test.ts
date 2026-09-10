import { describe, it, expect } from 'vitest';
import { parseGitHubRepo, repoKey } from './github';

describe('parseGitHubRepo', () => {
    it('parses owner/repo from a canonical URL', () => {
        expect(parseGitHubRepo('https://github.com/modelcontextprotocol/servers')).toEqual({
            owner: 'modelcontextprotocol',
            repo: 'servers',
        });
    });

    it('strips a trailing .git and ignores deep paths', () => {
        expect(parseGitHubRepo('https://github.com/acme/tool.git/tree/main')).toEqual({ owner: 'acme', repo: 'tool' });
    });

    it('rejects non-GitHub hosts', () => {
        expect(parseGitHubRepo('https://gitlab.com/acme/tool')).toBeNull();
    });

    it('rejects malformed or partial URLs', () => {
        expect(parseGitHubRepo('https://github.com/onlyowner')).toBeNull();
        expect(parseGitHubRepo('not a url')).toBeNull();
        expect(parseGitHubRepo(undefined)).toBeNull();
    });

    it('does not match look-alike hosts', () => {
        expect(parseGitHubRepo('https://github.com.evil.com/a/b')).toBeNull();
    });
});

describe('repoKey', () => {
    it('is case-insensitive', () => {
        expect(repoKey({ owner: 'ModelContextProtocol', repo: 'Servers' })).toBe('modelcontextprotocol/servers');
    });
});
