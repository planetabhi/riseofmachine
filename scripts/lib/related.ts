import type { ToolsConfig, Category, Tool } from '../../src/types/index.ts';

// Generic terms that would otherwise make every AI tool look similar.
const STOP = new Set([
    'the', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'with', 'your', 'you',
    'ai', 'app', 'tool', 'tools', 'online', 'free', 'best', 'create', 'generate',
    'make', 'using', 'use', 'from', 'on', 'in', 'by', 'into', 'it', 'is', 'are',
    'that', 'this', 'all', 'platform', 'powered', 'based', 'simple', 'easy',
    'get', 'more', 'new', 'generator',
]);

function tokenize(s: string): Set<string> {
    const set = new Set<string>();
    // Unicode-aware split drops emoji/punctuation, keeping only word chars.
    for (const w of (s || '').toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
        if (w.length >= 3 && !STOP.has(w)) set.add(w);
    }
    return set;
}

function domainOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

function jaccard(a: Set<string>, b: Set<string>): number {
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const v of a) if (b.has(v)) inter += 1;
    return inter / (a.size + b.size - inter);
}

function textCosine(a: Set<string>, b: Set<string>): number {
    if (!a.size || !b.size) return 0; // guard zero-norm
    let inter = 0;
    for (const w of a) if (b.has(w)) inter += 1;
    return inter / Math.sqrt(a.size * b.size);
}

interface Item {
    slug: string;
    primary: string;
    cats: Set<string>;
    tag: string;
    domain: string;
    date: string;
    tokens: Set<string>;
}

const RELATED_LIMIT = 8;

/**
 * Derive related-tool slugs from existing signals (no "alternative-of" data):
 * category (dominant), slug-map co-listing, title/body overlap, pricing tag.
 * Candidate set is scoped to tools sharing a category, so this stays near-linear.
 */
export function computeRelated(
    data: ToolsConfig,
    slugMap: Record<string, string[]>,
): Record<string, string[]> {
    const items = new Map<string, Item>();
    const byCategory = new Map<string, string[]>();

    data.tools.forEach((category: Category) => {
        category.content.forEach((tool: Tool) => {
            const slug = tool.slug;
            if (!slug || items.has(slug)) return;
            const cats = new Set(slugMap[slug] ?? [category.category]);
            items.set(slug, {
                slug,
                primary: slugMap[slug]?.[0] ?? category.category,
                cats,
                tag: tool.tag ?? '',
                domain: domainOf(tool.url ?? ''),
                date: tool['date-added'] ?? '',
                tokens: tokenize(`${tool.title} ${tool.body}`),
            });
        });
    });

    for (const item of items.values()) {
        for (const cat of item.cats) {
            const list = byCategory.get(cat) ?? [];
            list.push(item.slug);
            byCategory.set(cat, list);
        }
    }

    const result: Record<string, string[]> = {};

    for (const x of items.values()) {
        const candidates = new Set<string>();
        for (const cat of x.cats) {
            for (const slug of byCategory.get(cat) ?? []) candidates.add(slug);
        }

        const scored: { slug: string; score: number; date: string }[] = [];
        for (const slug of candidates) {
            if (slug === x.slug) continue;
            const y = items.get(slug)!;
            if (y.domain && y.domain === x.domain) continue; // drop spam clusters

            const sCat = x.primary === y.primary ? 1 : 0;
            const sCol = jaccard(x.cats, y.cats);
            const sText = textCosine(x.tokens, y.tokens);
            const sTag =
                x.tag && x.tag === y.tag && x.tag !== 'Not available' ? 1 : 0;
            const score = 0.45 * sCat + 0.25 * sCol + 0.2 * sText + 0.1 * sTag;
            if (score > 0) scored.push({ slug, score, date: y.date });
        }

        scored.sort(
            (a, b) =>
                b.score - a.score ||
                new Date(b.date).getTime() - new Date(a.date).getTime() ||
                a.slug.localeCompare(b.slug),
        );
        result[x.slug] = scored.slice(0, RELATED_LIMIT).map((s) => s.slug);
    }

    return result;
}
