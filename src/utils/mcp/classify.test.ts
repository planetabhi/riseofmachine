import { describe, it, expect } from 'vitest';
import { classify, tokenize, ownerTokens, otherRatio } from './classify';
import { mapServer, type RawEntry } from './map';

// Build a classified server from a partial raw manifest.
function server(over: Partial<NonNullable<RawEntry['server']>>) {
    const entry: RawEntry = {
        server: { name: over.name ?? 'io.example/thing', description: over.description ?? '', version: '1.0.0', ...over },
        _meta: { 'io.modelcontextprotocol.registry/official': { status: 'active', isLatest: true, publishedAt: '2026-01-01T00:00:00Z' } },
    };
    return classify(mapServer(entry)!);
}

describe('tokenize', () => {
    it('splits camelCase and punctuation', () => {
        expect(tokenize('getUserData-v2')).toEqual(['get', 'user', 'data', 'v2']);
    });
});

describe('ownerTokens', () => {
    it('extracts reverse-DNS + repo owner tokens', () => {
        expect(ownerTokens('com.stripe/payments', { url: 'https://github.com/stripe/mcp' })).toContain('stripe');
    });
});

describe('classify golden cases', () => {
    it('structured owner signal beats conflicting free text (Stripe → Payments)', () => {
        const s = server({ name: 'com.stripe/mcp', title: 'Stripe', description: 'store data in a database and query it' });
        expect(s.category).toBe('payments-finance');
    });

    it('database server → databases', () => {
        expect(server({ name: 'io.supabase/mcp', title: 'Supabase', description: 'Postgres database access' }).category).toBe('databases');
    });

    it('github → dev-tools', () => {
        expect(server({ name: 'com.github/mcp', title: 'GitHub', description: 'Manage repositories and pull requests' }).category).toBe('dev-tools');
    });

    it('cloudflare deploy → cloud-devops', () => {
        expect(server({ name: 'com.cloudflare/mcp', title: 'Cloudflare', description: 'Deploy serverless workers' }).category).toBe('cloud-devops');
    });

    it('llm agent → ai-llm', () => {
        expect(server({ name: 'com.anthropic/mcp', title: 'Claude', description: 'LLM agent with prompt and embedding tools' }).category).toBe('ai-llm');
    });

    it('web scraping → web-scraping', () => {
        expect(server({ name: 'com.firecrawl/mcp', title: 'Firecrawl', description: 'Headless browser scraping and crawler' }).category).toBe('web-scraping');
    });

    it('unmatched free text falls to other', () => {
        expect(server({ name: 'io.zzz/random', title: 'Zzz', description: 'nondescript widget gadget' }).category).toBe('other');
    });

    it('always yields at least one category', () => {
        expect(server({ name: 'io.zzz/random', description: '' }).categories).toEqual(['other']);
    });

    it('is deterministic for the same input', () => {
        const a = server({ name: 'io.supabase/mcp', description: 'database' });
        const b = server({ name: 'io.supabase/mcp', description: 'database' });
        expect(a.category).toBe(b.category);
        expect(a.categories).toEqual(b.categories);
    });
});

describe('otherRatio', () => {
    it('computes the fraction assigned to other', () => {
        const a = server({ name: 'io.supabase/mcp', description: 'database' });
        const b = server({ name: 'io.zzz/x', description: '' });
        expect(otherRatio([a, b])).toBe(0.5);
        expect(otherRatio([])).toBe(0);
    });
});
