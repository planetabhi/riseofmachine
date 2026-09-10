// Layer B — offline generator (part of `prepare-data`). Pure, no network.
// Reads committed src/data/mcp-servers.json → writes src/data/mcp-category-index.json
// in the exact shape the sidebar already consumes: Record<slug,{title,count}>.
// No-ops (exit 0) when the source is absent so the build never fails pre-crawl.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { McpData, McpCategoryIndex } from '../src/types/mcp.ts';
import { TAXONOMY } from '../src/utils/mcp/taxonomy.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_PATH = path.join(__dirname, '../src/data/mcp-servers.json');
const OUT_PATH = path.join(__dirname, '../src/data/mcp-category-index.json');

console.log('🗂️  Generating MCP category index...');

if (!fs.existsSync(SRC_PATH)) {
    console.log('ℹ️  src/data/mcp-servers.json not found — skipping (run `bun run crawl-mcp` first).');
    process.exit(0);
}

try {
    const data: McpData = JSON.parse(fs.readFileSync(SRC_PATH, 'utf-8'));

    const counts = new Map<string, number>();
    for (const server of data.servers) {
        counts.set(server.category, (counts.get(server.category) ?? 0) + 1);
    }

    // Ordered by taxonomy priority; zero-count categories omitted.
    const index: McpCategoryIndex = {};
    for (const rule of TAXONOMY) {
        const count = counts.get(rule.slug);
        if (count) index[rule.slug] = { title: rule.title, count };
    }

    fs.writeFileSync(OUT_PATH, JSON.stringify(index, null, 2) + '\n');
    console.log(`✅ Wrote ${Object.keys(index).length} categories (${data.servers.length} servers) → src/data/mcp-category-index.json`);
} catch (error: any) {
    console.error('❌ Error generating MCP category index:', error.message);
    process.exit(1);
}
