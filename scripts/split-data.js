import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('📦 Splitting tools.json by category...\n');

// Read the tools.json file
const toolsPath = path.join(__dirname, '../src/data/tools.json');
const data = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));

// Create output directory
const outputDir = path.join(__dirname, '../src/data/tools');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

let totalTools = 0;
const categorySummary = [];

// Split by category
data.tools.forEach(category => {
    const filename = `${category.category}.json`;
    const filepath = path.join(outputDir, filename);

    // Write just the content array (not wrapped in category object)
    fs.writeFileSync(filepath, JSON.stringify(category.content, null, 2));

    totalTools += category.content.length;
    categorySummary.push({
        category: category.category,
        count: category.content.length,
        file: filename
    });

    console.log(`✅ Created ${filename} with ${category.content.length} tools`);
});

console.log(`\n✅ Split complete!`);
console.log(`   Categories: ${data.tools.length}`);
console.log(`   Total tools: ${totalTools}`);
console.log(`   Output directory: ${outputDir}`);
