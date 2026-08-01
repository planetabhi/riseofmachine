import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ToolsConfig, Category } from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🗂️  Generating category index (title + count)...\n');

// Build-time only: the sidebar imports this to render counts in SSR HTML,
// so no tool data ships to the client just for the nav.
interface CategoryIndexEntry {
    title: string;
    count: number;
}

const toolsPath = path.join(__dirname, '../src/data/tools.json');
const outputPath = path.join(__dirname, '../src/data/category-index.json');

try {
    const data: ToolsConfig = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));

    const categoryIndex: Record<string, CategoryIndexEntry> = {};
    let total = 0;

    data.tools.forEach((category: Category) => {
        categoryIndex[category.category] = {
            title: category.title,
            count: category.content.length,
        };
        total += category.content.length;
    });

    fs.writeFileSync(outputPath, JSON.stringify(categoryIndex, null, 2));
    console.log(
        `✅ Wrote ${Object.keys(categoryIndex).length} categories (${total} tools) -> src/data/category-index.json`,
    );
} catch (error: any) {
    console.error('❌ Error generating category index:', error.message);
    process.exit(1);
}
