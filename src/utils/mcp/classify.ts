// Deterministic, offline MCP classifier (§6.3). Pure function of input + taxonomy.
import type { McpServer, McpRepository } from '../../types/mcp';
import { TAXONOMY, type CategoryRule } from './taxonomy';

const SRC_WEIGHT = { owner: 6, package: 4, name: 3, title: 2, description: 1 } as const;
const MIN_SCORE = 3; // below → "other"
const TAG_SCORE = 2; // secondary category threshold

type FieldKey = keyof typeof SRC_WEIGHT;

// Normalize text into lowercase word tokens: split camelCase, strip punctuation.
export function tokenize(input: string | undefined): string[] {
    if (!input) return [];
    return input
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase → camel Case
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
}

// Owner/namespace tokens: reverse-DNS name segments + repository owner.
export function ownerTokens(name: string, repository?: McpRepository): string[] {
    const tokens: string[] = [];
    // Reverse-DNS id, e.g. "ac.inference.sh/mcp" → ["ac","inference","sh","mcp"].
    for (const part of name.split(/[/.]/)) tokens.push(...tokenize(part));
    if (repository?.url) {
        try {
            const u = new URL(repository.url);
            const segs = u.pathname.split('/').filter(Boolean);
            if (segs[0]) tokens.push(...tokenize(segs[0])); // owner/org
        } catch {
            /* ignore malformed repo urls */
        }
    }
    return tokens;
}

// Count word-boundary matches of a rule's signal list against a token set.
// Multi-word keywords (e.g. "pull request") match as an ordered subsequence.
function matchCount(signals: string[] | undefined, tokens: string[], tokenSet: Set<string>): number {
    if (!signals || signals.length === 0) return 0;
    let hits = 0;
    for (const raw of signals) {
        const parts = raw.toLowerCase().split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
            if (tokenSet.has(parts[0]!)) hits += 1;
        } else if (containsSequence(tokens, parts)) {
            hits += 1;
        }
    }
    return hits;
}

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

function ruleWeight(rule: CategoryRule, field: FieldKey, tokens: string[], tokenSet: Set<string>): number {
    // Owner & package fields also test the rule's owner/package signal lists;
    // free-text fields (name/title/description) test keywords.
    if (field === 'owner') return matchCount(rule.owners, tokens, tokenSet);
    if (field === 'package') return matchCount(rule.packages, tokens, tokenSet);
    return matchCount(rule.keywords, tokens, tokenSet);
}

const priorityOf = (slug: string): number => TAXONOMY.find((r) => r.slug === slug)?.priority ?? 998;

export function classify<T extends McpServer>(s: T): T {
    const fields: Record<FieldKey, string[]> = {
        owner: ownerTokens(s.name, s.repository),
        package: s.packages.flatMap((p) => tokenize(p.identifier)),
        name: tokenize(s.name),
        title: tokenize(s.title),
        description: tokenize(s.description),
    };
    const tokenSets: Record<FieldKey, Set<string>> = {
        owner: new Set(fields.owner),
        package: new Set(fields.package),
        name: new Set(fields.name),
        title: new Set(fields.title),
        description: new Set(fields.description),
    };

    const score = new Map<string, number>();
    for (const rule of TAXONOMY) {
        if (rule.slug === 'other') continue;
        let pts = 0;
        for (const src of Object.keys(SRC_WEIGHT) as FieldKey[]) {
            pts += ruleWeight(rule, src, fields[src], tokenSets[src]) * SRC_WEIGHT[src];
        }
        if (pts > 0) score.set(rule.slug, pts);
    }

    const ranked = [...score.entries()].sort(
        (a, b) => b[1] - a[1] || priorityOf(a[0]) - priorityOf(b[0]) || a[0].localeCompare(b[0]),
    );

    const primary = ranked[0] && ranked[0][1] >= MIN_SCORE ? ranked[0][0] : 'other';
    const categories = ranked.filter(([, p]) => p >= TAG_SCORE).map(([c]) => c);
    return { ...s, category: primary, categories: categories.length ? categories : ['other'] };
}

// Ratio of servers assigned to `other` (coverage guard input).
export function otherRatio(servers: McpServer[]): number {
    if (servers.length === 0) return 0;
    const n = servers.filter((s) => s.category === 'other').length;
    return n / servers.length;
}
