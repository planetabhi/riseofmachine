// Layer A — the crawl skill (network, out-of-band). NEVER part of `build`.
// Fetches the official MCP registry, normalizes, classifies (§6), applies the
// offline quality gate (§13: active + stdio-only + anti-spam), and writes the
// committed source src/data/mcp-servers.json. Fail-soft + all-or-nothing write.
//
//   bun run scripts/crawl-mcp.ts               # crawl + classify + gate + write
//   bun run scripts/crawl-mcp.ts --no-vet      # skip the quality gate (write all)
//   bun run scripts/crawl-mcp.ts --reclassify  # re-classify + re-gate committed data (no crawl)
//
// The gate is pure and offline — no network, no tokens.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { McpData, McpServer } from '../src/types/mcp.ts';
import { mapServer, dedupeByName, assignSlugs, sortStable, officialMeta, type RawEntry } from '../src/utils/mcp/map.ts';
import { classify, otherRatio } from '../src/utils/mcp/classify.ts';
import { gate, DEFAULT_VET_CONFIG } from '../src/utils/mcp/vet.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_PATH = path.join(__dirname, '../src/data/mcp-servers.json');

const REGISTRY_URL = 'https://registry.modelcontextprotocol.io/v0/servers';
const OTHER_THRESHOLD = 0.25;
const PAGE_LIMIT = 100;
const MAX_PAGES = 2000;
const TIMEOUT_MS = 15000;
const RETRIES = 6;

function readPrev(): McpData | null {
    try {
        return JSON.parse(fs.readFileSync(OUT_PATH, 'utf-8')) as McpData;
    } catch {
        return null;
    }
}

function warn(msg: unknown): void {
    console.warn(`⚠️  ${msg instanceof Error ? msg.message : msg}`);
}

async function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(cursor: string | undefined): Promise<{ servers: RawEntry[]; nextCursor?: string }> {
    const url = new URL(REGISTRY_URL);
    url.searchParams.set('limit', String(PAGE_LIMIT));
    url.searchParams.set('version', 'latest'); // server-side latest-only filter
    if (cursor) url.searchParams.set('cursor', cursor);

    let lastErr: unknown;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
            const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
            clearTimeout(t);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = (await res.json()) as { servers?: RawEntry[]; metadata?: { nextCursor?: string } };
            const nextCursor = json.metadata?.nextCursor;
            return nextCursor ? { servers: json.servers ?? [], nextCursor } : { servers: json.servers ?? [] };
        } catch (e) {
            lastErr = e;
            if (attempt < RETRIES) await sleep(2 ** attempt * 250); // backoff on transient blips
        }
    }
    throw lastErr;
}

async function fetchAllPages(): Promise<{ entries: RawEntry[]; complete: boolean }> {
    const entries: RawEntry[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
        const { servers, nextCursor } = await fetchPage(cursor);
        entries.push(...servers);
        if ((page + 1) % 10 === 0) console.log(`   …page ${page + 1}, ${entries.length} entries`);
        if (!nextCursor) return { entries, complete: true };
        cursor = nextCursor;
    }
    // Hit the page cap without exhausting the cursor → treat as incomplete.
    return { entries, complete: false };
}

function normalize(entries: RawEntry[]): McpServer[] {
    const latest = entries.filter((e) => {
        const meta = officialMeta(e);
        return meta.isLatest === true && meta.status !== 'deleted';
    });
    const mapped = latest.map(mapServer).filter((s): s is McpServer => s !== null);
    return sortStable(assignSlugs(dedupeByName(mapped)).map(classify));
}

function write(servers: McpServer[], complete: boolean, fromCache: boolean): void {
    const ratio = otherRatio(servers);
    const data: McpData = {
        generatedAt: new Date().toISOString(),
        servers,
        meta: { fromCache, count: servers.length, complete, otherRatio: Number(ratio.toFixed(4)) },
    };
    fs.writeFileSync(OUT_PATH, JSON.stringify(data, null, 2) + '\n');
}

const NO_VET = process.argv.includes('--no-vet');

// Offline quality gate (§13): active + stdio-only + anti-spam filters and a
// per-publisher cap. Pure, no network, no tokens. Throws on an empty result so
// the caller fails soft and keeps the last-good file instead of wiping it.
async function vetServers(servers: McpServer[]): Promise<McpServer[]> {
    const cfg = DEFAULT_VET_CONFIG;
    const gated = gate(servers, cfg);
    const s = gated.stats;
    console.log(`🔎 Gate: ${s.input} servers → tier0=${s.tier0} → final=${s.final} (active + stdio-only)`);
    if (gated.servers.length === 0) throw new Error('quality gate produced 0 servers');
    return gated.servers;
}

async function reclassify(): Promise<void> {
    const prev = readPrev();
    if (!prev) {
        warn('no committed mcp-servers.json to reclassify');
        process.exit(0);
    }
    let servers = sortStable(prev.servers.map(classify));
    if (!NO_VET) {
        try {
            servers = await vetServers(servers);
        } catch (e) {
            warn(e);
            console.log('↩️  Keeping the already-committed set unvetted (fail-soft).');
        }
    }
    const ratio = otherRatio(servers);
    if (ratio > OTHER_THRESHOLD) warn(`categorization weak: other=${ratio.toFixed(3)}`);
    write(servers, prev.meta.complete, prev.meta.fromCache);
    console.log(`✅ Reclassified ${servers.length} servers (other=${(ratio * 100).toFixed(1)}%) → src/data/mcp-servers.json`);
}

async function crawl(): Promise<void> {
    const prev = readPrev();
    try {
        console.log('🌐 Crawling MCP registry...');
        const { entries, complete } = await fetchAllPages();
        if (!complete) throw new Error('incomplete crawl — cursor not exhausted'); // never truncate
        let servers = normalize(entries);
        if (servers.length === 0) throw new Error('crawl produced 0 servers');
        if (!NO_VET) servers = await vetServers(servers);
        const ratio = otherRatio(servers);
        if (ratio > OTHER_THRESHOLD) warn(`categorization weak: other=${ratio.toFixed(3)} (extend taxonomy)`);
        write(servers, true, false); // all-or-nothing write, only on a complete crawl
        console.log(`✅ Wrote ${servers.length} servers (other=${(ratio * 100).toFixed(1)}%) → src/data/mcp-servers.json`);
    } catch (e) {
        warn(e);
        if (prev) {
            console.log('↩️  Keeping last-good mcp-servers.json (fail-soft, nothing overwritten).');
        } else {
            console.log('ℹ️  No previous data; nothing written. The build will no-op until a successful crawl.');
        }
    }
}

const isReclassify = process.argv.includes('--reclassify');
await (isReclassify ? reclassify() : crawl());
