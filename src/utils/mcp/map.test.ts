import { describe, it, expect } from 'vitest';
import { slugify, decodeAndSanitize, mapServer, dedupeByName, assignSlugs, sortStable, type RawEntry } from './map';

describe('slugify', () => {
    it('converts reverse-DNS names to hyphenated slugs', () => {
        expect(slugify('ac.inference.sh/mcp')).toBe('ac-inference-sh-mcp');
    });
    it('strips unsafe chars and collapses hyphens', () => {
        expect(slugify('Foo Bar!! Baz')).toBe('foo-bar-baz');
    });
});

describe('decodeAndSanitize', () => {
    it('decodes entities and strips tags', () => {
        expect(decodeAndSanitize('Tom &amp; Jerry &lt;b&gt;bold&lt;/b&gt;')).toBe('Tom & Jerry bold');
    });
    it('returns empty for undefined', () => {
        expect(decodeAndSanitize(undefined)).toBe('');
    });
});

const entry = (over: Partial<RawEntry['server']> = {}, meta: Record<string, unknown> = {}): RawEntry => ({
    server: { name: 'io.example/thing', description: 'desc', version: '1.0.0', ...over },
    _meta: { 'io.modelcontextprotocol.registry/official': { status: 'active', isLatest: true, publishedAt: '2026-01-01T00:00:00Z', ...meta } },
});

describe('mapServer', () => {
    it('falls back title→name when title absent', () => {
        const s = mapServer(entry())!;
        expect(s.title).toBe('io.example/thing');
    });

    it('uses title when present', () => {
        const s = mapServer(entry({ title: 'Thing' }))!;
        expect(s.title).toBe('Thing');
    });

    it('url precedence websiteUrl → repository → remote → detail page', () => {
        expect(mapServer(entry({ websiteUrl: 'https://site' }))!.url).toBe('https://site');
        expect(mapServer(entry({ repository: { url: 'https://repo' } }))!.url).toBe('https://repo');
        expect(mapServer(entry({ remotes: [{ type: 'sse', url: 'https://r/mcp' }] }))!.url).toBe('https://r/mcp');
        expect(mapServer(entry())!.url).toBe('/mcp/servers/io-example-thing');
    });

    it('decodes description entities', () => {
        expect(mapServer(entry({ description: 'A &amp; B' }))!.description).toBe('A & B');
    });

    it('never emits env-var values — names only', () => {
        const s = mapServer(
            entry({ packages: [{ registryType: 'npm', identifier: 'x', environmentVariables: [{ name: 'TOKEN', isRequired: true }] }] }),
        )!;
        const env = s.packages[0]!.environmentVariables!;
        expect(env[0]).toEqual({ name: 'TOKEN', required: true });
        expect(Object.keys(env[0]!)).not.toContain('value');
    });

    it('resolves first HTTPS icon as iconUrl', () => {
        const s = mapServer(entry({ icons: ['http://insecure/a.png', 'https://safe/b.png'] }))!;
        expect(s.iconUrl).toBe('https://safe/b.png');
    });

    it('flags deprecated status', () => {
        expect(mapServer(entry({}, { status: 'deprecated' }))!.status).toBe('deprecated');
    });

    it('returns null when name missing', () => {
        expect(mapServer({ server: { description: 'x' } })).toBeNull();
    });
});

describe('dedupeByName / assignSlugs / sortStable', () => {
    it('dedupes by name keeping first', () => {
        const out = dedupeByName([{ name: 'a' }, { name: 'a' }, { name: 'b' }]);
        expect(out).toHaveLength(2);
    });

    it('assigns collision-safe slugs', () => {
        const base = mapServer(entry())!;
        const out = assignSlugs([base, { ...base, name: 'io.example.thing' }]);
        expect(out[0]!.slug).toBe('io-example-thing');
        expect(out[1]!.slug).toBe('io-example-thing-2');
    });

    it('sorts A–Z by name', () => {
        const s = (name: string) => ({ ...mapServer(entry())!, name });
        const out = sortStable([s('zebra'), s('alpha'), s('mango')]);
        expect(out.map((x) => x.name)).toEqual(['alpha', 'mango', 'zebra']);
    });
});
