import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ToolsConfig, Category, Tool } from '../src/types/index.ts';

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

const toolsPath = path.join(__dirname, '../src/data/tools.json');
const metadataPath = path.join(__dirname, '../src/data/metadata.json');
const outputPath = path.join(__dirname, '../public/search-index.json');
// Fuller descriptions live in a separate file, fetched only when a tool panel
// opens — keeps the search index (loaded on every homepage visit) lean.
const descOutputPath = path.join(__dirname, '../public/tool-descriptions.json');

try {
    const data: ToolsConfig = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));
    const metadata: Record<string, { description?: string }> = fs.existsSync(metadataPath)
        ? JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
        : {};

    const records: SearchRecord[] = [];
    const descriptions: Record<string, string> = {};
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
            if (desc && desc !== body) descriptions[tool.slug] = desc;
        });
    });

    fs.writeFileSync(descOutputPath, JSON.stringify(descriptions));

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
        `✅ Wrote ${Object.keys(descriptions).length} descriptions -> public/tool-descriptions.json (${(descBytes / 1024).toFixed(1)} KB)`,
    );
} catch (error: any) {
    console.error('❌ Error generating search index:', error.message);
    process.exit(1);
}
