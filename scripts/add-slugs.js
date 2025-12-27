import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to convert title to kebab-case slug
function titleToSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[&]/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Read the tools.json file
const toolsPath = path.join(__dirname, '../src/data/tools.json');
const data = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));

// Track slugs to handle duplicates
const slugMap = new Map();

// Process all tools and add slugs
let totalTools = 0;
let duplicatesHandled = 0;

data.tools.forEach(category => {
  category.content.forEach(tool => {
    totalTools++;

    let baseSlug = titleToSlug(tool.title);
    let slug = baseSlug;

    // Handle duplicates by adding suffix
    if (slugMap.has(slug)) {
      let counter = 2;
      while (slugMap.has(`${baseSlug}-${counter}`)) {
        counter++;
      }
      slug = `${baseSlug}-${counter}`;
      duplicatesHandled++;
    }

    slugMap.set(slug, {
      title: tool.title,
      category: category.category
    });

    tool.slug = slug;
  });
});

// Write back to tools.json
fs.writeFileSync(toolsPath, JSON.stringify(data, null, 2));

console.log(`✅ Slug generation complete!`);
console.log(`   Total tools processed: ${totalTools}`);
console.log(`   Unique slugs created: ${slugMap.size}`);
console.log(`   Duplicate base slugs handled: ${duplicatesHandled}`);

// Log duplicate examples
const duplicateBaseSlugz = new Map();
slugMap.forEach((value, slug) => {
  const baseSlug = slug.replace(/-\d+$/, '');
  if (!duplicateBaseSlugz.has(baseSlug)) {
    duplicateBaseSlugz.set(baseSlug, []);
  }
  duplicateBaseSlugz.get(baseSlug).push({ slug, title: value.title });
});

const duplicates = Array.from(duplicateBaseSlugz.entries()).filter(([_, slugs]) => slugs.length > 1);
if (duplicates.length > 0) {
  console.log(`\n   Duplicate base slugs with variants:`);
  duplicates.forEach(([baseSlug, slugs]) => {
    console.log(`   - ${baseSlug}:`);
    slugs.forEach(({ slug, title }) => {
      console.log(`     • ${slug} (${title})`);
    });
  });
}

// Also process split category files if they exist
const toolsDir = path.join(__dirname, '../src/data/tools');
if (fs.existsSync(toolsDir)) {
  console.log(`\n📦 Processing split category files...`);

  const files = fs.readdirSync(toolsDir).filter(f => f.endsWith('.json'));
  let splitFilesProcessed = 0;

  files.forEach(file => {
    const filepath = path.join(toolsDir, file);
    const categoryData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    let modified = false;

    categoryData.forEach(tool => {
      if (!tool.slug) {
        const baseSlug = titleToSlug(tool.title);
        let slug = baseSlug;
        let counter = 2;

        while (slugMap.has(slug)) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        tool.slug = slug;
        slugMap.set(slug, { title: tool.title, category: file.replace('.json', '') });
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filepath, JSON.stringify(categoryData, null, 2));
      splitFilesProcessed++;
    }
  });

  console.log(`✅ Processed ${files.length} category files (${splitFilesProcessed} modified)`);
}
