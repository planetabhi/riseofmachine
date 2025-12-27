import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🗺️  Generating slug-to-category mapping...\n');

// Read the tools.json file
const toolsPath = path.join(__dirname, '../src/data/tools.json');
const data = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));

const slugMap = {};
let totalSlugs = 0;
const duplicates = [];

// Build slug-to-category mapping
data.tools.forEach(category => {
    category.content.forEach(tool => {
        if (tool.slug) {
            // Check for duplicates
            if (slugMap[tool.slug]) {
                duplicates.push({
                    slug: tool.slug,
                    categories: [slugMap[tool.slug], category.category]
                });
            }

            slugMap[tool.slug] = category.category;
            totalSlugs++;
        }
    });
});

// Write slug map
const outputPath = path.join(__dirname, '../src/data/slug-map.json');
fs.writeFileSync(outputPath, JSON.stringify(slugMap, null, 2));

console.log(`✅ Generated slug map with ${totalSlugs} entries`);

if (duplicates.length > 0) {
    console.log(`\n⚠️  Warning: Found ${duplicates.length} duplicate slugs:`);
    duplicates.forEach(dup => {
        console.log(`   - ${dup.slug}: ${dup.categories.join(', ')}`);
    });
} else {
    console.log('✅ No duplicate slugs found');
}

console.log(`\n✅ Slug map saved to: ${outputPath}`);
