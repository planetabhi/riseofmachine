import { describe, it, expect } from 'vitest';
import { GET } from '../pages/rss.xml';

const MAX_ITEMS = 50;
const SITE = 'https://riseofmachine.test';

async function renderFeed(): Promise<string> {
    // APIContext is large; only `site` is read by the GET implementation.
    const res = await GET({ site: new URL(SITE) } as any);
    return await res.text();
}

describe('rss.xml endpoint', () => {
    it('returns an XML response', async () => {
        const res = await GET({ site: new URL(SITE) } as any);
        expect(res).toBeInstanceOf(Response);
        const ct = res.headers.get('content-type') || '';
        expect(ct.toLowerCase()).toMatch(/xml/);
    });

    it('emits a well-formed RSS document with channel metadata', async () => {
        const xml = await renderFeed();
        expect(xml).toMatch(/<\?xml/);
        expect(xml).toMatch(/<rss[\s>]/);
        expect(xml).toMatch(/<channel>/);
        expect(xml).toMatch(/<title>[^<]*Rise of Machine/);
        expect(xml).toMatch(/<language>en-us<\/language>/);
    });

    it('emits no more than MAX_ITEMS items', async () => {
        const xml = await renderFeed();
        const items = xml.match(/<item>/g) || [];
        expect(items.length).toBeLessThanOrEqual(MAX_ITEMS);
        expect(items.length).toBeGreaterThan(0);
    });

    it('never emits "Invalid Date" pubDates', async () => {
        const xml = await renderFeed();
        expect(xml).not.toMatch(/Invalid Date/);
        const pubDates = Array.from(xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/g))
            .map((m) => m[1])
            .filter((v): v is string => typeof v === 'string');
        expect(pubDates.length).toBeGreaterThan(0);
        for (const d of pubDates) {
            expect(Number.isFinite(new Date(d).getTime())).toBe(true);
        }
    });

    it('sorts items newest first', async () => {
        const xml = await renderFeed();
        const pubDates = Array.from(xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/g))
            .map((m) => m[1])
            .filter((v): v is string => typeof v === 'string')
            .map((s) => new Date(s).getTime());
        for (let i = 1; i < pubDates.length; i++) {
            const curr = pubDates[i];
            const prev = pubDates[i - 1];
            if (curr === undefined || prev === undefined) continue;
            expect(curr).toBeLessThanOrEqual(prev);
        }
    });

    it('uses /tools/{slug} links for items that have slugs', async () => {
        const xml = await renderFeed();
        const links = Array.from(xml.matchAll(/<link>([^<]+)<\/link>/g))
            .map((m) => m[1])
            .filter((v): v is string => typeof v === 'string');
        // Drop the channel-level <link> (site root); the rest are item links.
        const itemLinks = links.slice(1);
        const slugged = itemLinks.filter((l) => /\/tools\/[a-z0-9-]+/i.test(l));
        expect(slugged.length).toBeGreaterThan(0);
    });
});
