import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ToolsConfig, Category, Tool } from '../src/types/index.ts';
import { computeRelated } from './lib/related.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔎 Generating client search index...\n');

// Short keys keep the lazily-fetched index small; the client mirrors them.
// (u/d let /saved resolve bookmarks from this one file.)
interface SearchRecord {
    s: string; // slug
    t: string; // title
    g: string; // tag
    c: string; // category
    b: string; // body
    u: string; // url
    d: string; // date-added
}

// Panel-open payload, keyed by slug: fuller description (d) + related slugs (r).
interface PanelEntry {
    d?: string;
    r?: string[];
}

const toolsPath = path.join(__dirname, '../src/data/tools.json');
const metadataPath = path.join(__dirname, '../src/data/metadata.json');
const slugMapPath = path.join(__dirname, '../src/data/slug-map.json');
const outputPath = path.join(__dirname, '../public/search-index.json');
// Fuller descriptions + related slugs live in a separate file, fetched only when
// a tool panel opens — keeps the search index (loaded on search) lean.
const descOutputPath = path.join(__dirname, '../public/tool-descriptions.json');

try {
    const data: ToolsConfig = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));
    const metadata: Record<string, { description?: string }> = fs.existsSync(metadataPath)
        ? JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
        : {};
    const slugMap: Record<string, string[]> = fs.existsSync(slugMapPath)
        ? JSON.parse(fs.readFileSync(slugMapPath, 'utf-8'))
        : {};
    const relatedMap = computeRelated(data, slugMap);

    const records: SearchRecord[] = [];
    const panel: Record<string, PanelEntry> = {};
    data.tools.forEach((category: Category) => {
        category.content.forEach((tool: Tool) => {
            if (!tool.slug) return;
            const body = tool.body ?? '';
            records.push({
                s: tool.slug,
                t: tool.title,
                g: tool.tag ?? '',
                c: category.category,
                b: body,
                u: tool.url ?? '',
                d: tool['date-added'] ?? '',
            });
            const desc = metadata[tool.slug]?.description;
            const related = relatedMap[tool.slug];
            const entry: PanelEntry = {};
            if (desc && desc !== body) entry.d = desc;
            if (related && related.length) entry.r = related;
            if (entry.d || entry.r) panel[tool.slug] = entry;
        });
    });

    fs.writeFileSync(descOutputPath, JSON.stringify(panel));

    // Records only — the client builds the Fuse index lazily on first search.
    // Indexing ~1.1k records is <50ms; shipping a pre-built index only bloats
    // this lazily-fetched payload (~+16KB gz) for no meaningful benefit.
    fs.writeFileSync(outputPath, JSON.stringify(records));

    const bytes = fs.statSync(outputPath).size;
    const descBytes = fs.statSync(descOutputPath).size;
    console.log(
        `✅ Wrote ${records.length} records -> public/search-index.json (${(bytes / 1024).toFixed(1)} KB)`,
    );
    console.log(
        `✅ Wrote ${Object.keys(panel).length} panel entries -> public/tool-descriptions.json (${(descBytes / 1024).toFixed(1)} KB)`,
    );
} catch (error: any) {
    console.error('❌ Error generating search index:', error.message);
    process.exit(1);
}
