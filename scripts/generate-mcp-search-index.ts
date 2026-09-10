// Layer B — offline generator (part of `prepare-data`). Pure, no network.
// Reads committed src/data/mcp-servers.json → writes public/mcp-index.json: a
// compact, card-sized record per server (McpServerLite, §13.6). The MCP grid is
// rendered client-side from this file so the listing HTML stays tiny and never
// ships ~15k DOM nodes. No-ops (exit 0) when the source is absent (build-safe).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { McpData, McpServer } from '../src/types/mcp.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_PATH = path.join(__dirname, '../src/data/mcp-servers.json');
const OUT_PATH = path.join(__dirname, '../public/mcp-index.json');
const SHARD_DIR = path.join(__dirname, '../public/mcp-cat');

// Compact record — short keys keep the payload small. Consumed by McpEnhancer
// (grid) and McpDetailPanel (RHS panel), so it carries everything both need.
interface LiteRecord {
    s: string; // slug
    t: string; // title
    b: string; // description
    c: string; // category slug
    k: McpServer['installKind']; // install kind
    ic: string; // install command (primary CTA)
    tr: string[]; // transports (deduped)
    rg: string[]; // registry types (deduped)
    st: McpServer['status']; // status
    v: string; // version
    w: string; // websiteUrl (or '')
    rp: string; // repository url (or '')
    ev: string[]; // env-var names (required ones suffixed '*'); names only, never values
    u: string; // canonical url
    up: string; // updatedAt
    pb: string; // publishedAt
}

function transportsOf(s: McpServer): string[] {
    return [...new Set([...s.remotes.map((r) => r.type), ...s.packages.map((p) => p.transport)])].filter(Boolean);
}

function registriesOf(s: McpServer): string[] {
    return [...new Set(s.packages.map((p) => p.registryType))].filter(Boolean);
}

// Env-var names across all packages (names only — never values). Required names
// get a trailing '*' so the panel can flag them.
function envVarsOf(s: McpServer): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of s.packages) {
        for (const e of p.environmentVariables ?? []) {
            if (!e.name || seen.has(e.name)) continue;
            seen.add(e.name);
            out.push(e.required ? `${e.name}*` : e.name);
        }
    }
    return out;
}

// Clamp descriptions for the listing payload (§13.6). The full text lives on the
// per-server detail page; the card/panel only need a short summary.
function clamp(text: string, max = 160): string {
    const t = (text || '').trim();
    return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
}

function toLite(s: McpServer): LiteRecord {
    return {
        s: s.slug,
        t: s.title,
        b: clamp(s.description),
        c: s.category,
        k: s.installKind,
        ic: s.installCommand,
        tr: transportsOf(s),
        rg: registriesOf(s),
        st: s.status,
        v: s.version || '',
        w: s.websiteUrl || '',
        rp: s.repository?.url || '',
        ev: envVarsOf(s),
        u: s.url,
        up: s.updatedAt || '',
        pb: s.publishedAt || '',
    };
}

console.log('🗂️  Generating MCP client index...');

if (!fs.existsSync(SRC_PATH)) {
    console.log('ℹ️  src/data/mcp-servers.json not found — skipping (run `bun run crawl-mcp` first).');
    process.exit(0);
}

try {
    const data: McpData = JSON.parse(fs.readFileSync(SRC_PATH, 'utf-8'));
    // A–Z by name for a deterministic default order → minimal diffs.
    const records = data.servers.toSorted((a, b) => a.name.localeCompare(b.name)).map(toLite);
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(records) + '\n');
    console.log(`✅ Wrote ${records.length} records → public/mcp-index.json`);

    // Per-category shards so category pages fetch only their slice, not the whole
    // index. The landing still loads the full index (it searches across all).
    fs.rmSync(SHARD_DIR, { recursive: true, force: true }); // drop stale shards
    fs.mkdirSync(SHARD_DIR, { recursive: true });
    const byCategory = new Map<string, LiteRecord[]>();
    for (const r of records) {
        const arr = byCategory.get(r.c) ?? [];
        arr.push(r);
        byCategory.set(r.c, arr);
    }
    for (const [category, recs] of byCategory) {
        fs.writeFileSync(path.join(SHARD_DIR, `${category}.json`), JSON.stringify(recs) + '\n');
    }
    console.log(`✅ Wrote ${byCategory.size} category shards → public/mcp-cat/`);
} catch (error: any) {
    console.error('❌ Error generating MCP client index:', error.message);
    process.exit(1);
}
