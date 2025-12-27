import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ToolsConfig, Category, Tool } from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w-]+/g, '')     // Remove all non-word chars
        .replace(/--+/g, '-')       // Replace multiple - with single -
        .replace(/^-+/, '')         // Trim - from start of text
        .replace(/-+$/, '');        // Trim - from end of text
}

const toolsPath = path.join(__dirname, '../src/data/tools.json');

try {
    // Process monolithic tools.json
    const data: ToolsConfig = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));
    let modified = false;

    data.tools.forEach((category: Category) => {
        category.content.forEach((tool: Tool) => {
            if (!tool.slug) {
                tool.slug = slugify(tool.title);
                console.log(`Generated slug for ${tool.title}: ${tool.slug}`);
                modified = true;
            }
        });
    });

    if (modified) {
        fs.writeFileSync(toolsPath, JSON.stringify(data, null, 2));
        console.log('✅ Updated tools.json with new slugs');
    } else {
        console.log('✅ All tools in tools.json already have slugs');
    }

    // Also process split files in src/data/tools/
    const splitDataDir = path.join(__dirname, '../src/data/tools');
    if (fs.existsSync(splitDataDir)) {
        const files = fs.readdirSync(splitDataDir).filter(f => f.endsWith('.json'));
        let splitModified = 0;

        files.forEach(file => {
            const filePath = path.join(splitDataDir, file);
            const tools: Tool[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            let fileModified = false;

            tools.forEach(tool => {
                if (!tool.slug) {
                    tool.slug = slugify(tool.title);
                    fileModified = true;
                }
            });

            if (fileModified) {
                fs.writeFileSync(filePath, JSON.stringify(tools, null, 2));
                splitModified++;
            }
        });

        if (splitModified > 0) {
            console.log(`✅ Updated ${splitModified} split category files with new slugs`);
        }
    }

} catch (error: any) {
    console.error('❌ Error processing slugs:', error.message);
}
