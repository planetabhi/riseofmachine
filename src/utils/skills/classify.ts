// Deterministic, offline skills classifier. Pure function of (slug, description)
// against the taxonomy — used by the crawl to categorize seed-repo skills that
// have no skills.sh topic. Returns matched category slugs, best score first,
// capped at MAX_CATEGORIES; empty when nothing matches.
import { SKILLS_TAXONOMY } from './taxonomy';

const MAX_CATEGORIES = 3;

// Lowercase word tokens: split camelCase and hyphenated slugs, strip punctuation.
export function tokenize(input: string | undefined): string[] {
    if (!input) return [];
    return input
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
}

// True when `parts` appear as an ordered, contiguous run inside `tokens`.
function containsSequence(tokens: string[], parts: string[]): boolean {
    for (let i = 0; i + parts.length <= tokens.length; i++) {
        let ok = true;
        for (let j = 0; j < parts.length; j++) {
            if (tokens[i + j] !== parts[j]) {
                ok = false;
                break;
            }
        }
        if (ok) return true;
    }
    return false;
}

export function classifySkill(slug: string, description: string): string[] {
    const tokens = [...tokenize(slug), ...tokenize(description)];
    if (tokens.length === 0) return [];
    const tokenSet = new Set(tokens);

    const scored: { slug: string; score: number }[] = [];
    for (const rule of SKILLS_TAXONOMY) {
        let score = 0;
        for (const keyword of rule.keywords) {
            const parts = keyword.toLowerCase().split(/\s+/).filter(Boolean);
            if (parts.length === 1) {
                if (tokenSet.has(parts[0]!)) score += 1;
            } else if (containsSequence(tokens, parts)) {
                score += 1;
            }
        }
        if (score > 0) scored.push({ slug: rule.slug, score });
    }

    scored.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
    return scored.slice(0, MAX_CATEGORIES).map((s) => s.slug);
}
