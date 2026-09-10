// Deterministic, offline quality gate for MCP servers (§13). Pure functions of
// (servers, config). No network, no tokens — every signal is intrinsic to the
// committed registry data. The listing is restricted to active, stdio-only
// servers plus the usual anti-spam filters.
import type { McpServer } from '../../types/mcp';
import { parseGitHubRepo, repoKey } from './github';

export interface VetWeights {
    install: number;
    polish: number;
    verified: number;
}

export interface VetConfig {
    minDescLen: number; // Tier-0: drop thin descriptions
    perPublisherCap: number; // keep each namespace owner's top-N by score
    maxTotal: number; // hard cap on total survivors (0 = unlimited)
    requireDistinctTitle: boolean; // drop servers whose title is just the reverse-DNS name
    weights: VetWeights; // ranking weights (§13.5)
    allowlist: string[]; // publisher prefixes always included, exempt from the cap
    denylist: string[]; // publisher prefixes always excluded
}

export const DEFAULT_VET_CONFIG: VetConfig = {
    minDescLen: 40,
    perPublisherCap: 3,
    maxTotal: 0,
    requireDistinctTitle: true,
    weights: { install: 0.3, polish: 0.2, verified: 0.2 },
    allowlist: ['io.github.modelcontextprotocol', 'com.anthropic', 'io.github.anthropics', 'io.github.github'],
    denylist: ['io.github.sadri-dridi', 'io.github.pipeworx-io', 'io.github.mcp-dir'],
};

export interface GateStats {
    input: number;
    tier0: number;
    final: number;
}

export interface GateResult {
    servers: McpServer[]; // vetted, capped, A–Z for stable diffs
    stats: GateStats;
}

export function publisherOf(server: McpServer): string {
    return server.name.split('/')[0] || server.name;
}

function prefixMatch(publisher: string, list: string[]): boolean {
    const p = publisher.toLowerCase();
    return list.some((entry) => p === entry.toLowerCase() || p.startsWith(entry.toLowerCase() + '.'));
}

// Reverse-DNS namespaces that aren't `io.github.*` are domain-verified (stronger).
function isDomainVerified(server: McpServer): boolean {
    return !server.name.toLowerCase().startsWith('io.github.');
}

function normDesc(desc: string): string {
    return desc.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Union of every declared transport across remotes + packages.
export function transportsOf(server: McpServer): string[] {
    return [...new Set([...server.remotes.map((r) => r.type), ...server.packages.map((p) => p.transport)])];
}

// stdio-only = at least one transport and every transport is stdio (no remote
// streamable-http/sse endpoints).
export function isStdioOnly(server: McpServer): boolean {
    const t = transportsOf(server);
    return t.length > 0 && t.every((x) => x === 'stdio');
}

// Tier-0 intrinsic filter (§13.2). Cheap, offline; also enforces the listing
// policy: active + stdio-only, with anti-spam guards.
export function tier0Filter(servers: McpServer[], cfg: VetConfig): McpServer[] {
    const seenDesc = new Set<string>();
    const seenRepo = new Set<string>();
    const out: McpServer[] = [];
    for (const s of servers) {
        if (prefixMatch(publisherOf(s), cfg.denylist)) continue;
        if (s.status !== 'active') continue;
        if (!isStdioOnly(s)) continue; // list stdio-transport servers only
        if (s.installKind === 'none') continue;
        const gh = parseGitHubRepo(s.repository?.url);
        if (!gh) continue;
        if (cfg.requireDistinctTitle && s.title.trim().toLowerCase() === s.name.trim().toLowerCase()) continue;
        if ((s.description || '').length < cfg.minDescLen) continue;
        const repo = repoKey(gh);
        if (seenRepo.has(repo)) continue; // one listing per source repository
        const key = normDesc(s.description);
        if (key) {
            if (seenDesc.has(key)) continue; // spam publishers reuse identical blurbs
            seenDesc.add(key);
        }
        seenRepo.add(repo);
        out.push(s);
    }
    return out;
}

export function scoreServer(server: McpServer, cfg: VetConfig): number {
    const install = server.packages.length > 0 && server.remotes.length > 0 ? 1 : 0.5;
    const polish = server.iconUrl ? 1 : 0;
    const verified = isDomainVerified(server) ? 1 : 0.5;
    const w = cfg.weights;
    return w.install * install + w.polish * polish + w.verified * verified;
}

interface Scored {
    server: McpServer;
    score: number;
}

// Offline quality gate: Tier-0 intrinsic filter (active + stdio-only + anti-spam)
// + per-publisher cap + optional hard total cap, ranked by intrinsic score.
// No network, no tokens.
export function gate(servers: McpServer[], cfg: VetConfig): GateResult {
    const tier0 = tier0Filter(servers, cfg);
    const scored: Scored[] = tier0.map((server) => ({ server, score: scoreServer(server, cfg) }));

    // Per-publisher cap: keep each owner's top-N by score (allowlisted are exempt).
    const byPublisher = new Map<string, Scored[]>();
    const exempt: Scored[] = [];
    for (const item of scored) {
        const pub = publisherOf(item.server);
        if (prefixMatch(pub, cfg.allowlist)) {
            exempt.push(item);
            continue;
        }
        const arr = byPublisher.get(pub) ?? [];
        arr.push(item);
        byPublisher.set(pub, arr);
    }
    const capped: Scored[] = [...exempt];
    for (const arr of byPublisher.values()) {
        arr.sort((a, b) => b.score - a.score || a.server.name.localeCompare(b.server.name));
        capped.push(...arr.slice(0, cfg.perPublisherCap));
    }

    // Optional hard total cap by score.
    let survivors = capped;
    if (cfg.maxTotal > 0 && survivors.length > cfg.maxTotal) {
        survivors = [...survivors]
            .sort((a, b) => b.score - a.score || a.server.name.localeCompare(b.server.name))
            .slice(0, cfg.maxTotal);
    }

    // Emit A–Z for minimal diffs (ranking already applied above).
    const out = survivors.map(({ server }) => server).sort((a, b) => a.name.localeCompare(b.name));

    return {
        servers: out,
        stats: { input: servers.length, tier0: tier0.length, final: out.length },
    };
}
