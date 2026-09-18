// Layer B — offline generator (part of `prepare-data`). Pure, no network.
// Reads committed src/data/skills.json → writes src/data/skills-category-index.json
// in the exact shape the sidebar already consumes: Record<slug,{title,count}>.
// No-ops (exit 0) when the source is absent so the build never fails pre-crawl.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { SkillsData, SkillsCategoryIndex } from '../src/types/skills.ts';
import { SKILLS_CATEGORY_TITLES } from '../src/utils/skills/taxonomy.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_PATH = path.join(__dirname, '../src/data/skills.json');
const OUT_PATH = path.join(__dirname, '../src/data/skills-category-index.json');

// "agent-workflows" → "Agent workflows". Used for skills.sh topics not covered
// by the taxonomy; taxonomy titles win when present (e.g. "Next.js").
function humanize(slug: string): string {
    const words = slug.replace(/[-_]+/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

console.log('🗂️  Generating Skills category index...');

if (!fs.existsSync(SRC_PATH)) {
    console.log('ℹ️  src/data/skills.json not found — skipping (run `bun run crawl-skills` first).');
    process.exit(0);
}

try {
    const data: SkillsData = JSON.parse(fs.readFileSync(SRC_PATH, 'utf-8'));

    const counts = new Map<string, number>();
    for (const skill of data.skills) {
        for (const cat of skill.categories) {
            counts.set(cat, (counts.get(cat) ?? 0) + 1);
        }
    }

    // Highest count first, then alpha — a stable, meaningful sidebar order.
    const index: SkillsCategoryIndex = {};
    for (const [slug, count] of [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
        index[slug] = { title: SKILLS_CATEGORY_TITLES[slug] ?? humanize(slug), count };
    }

    fs.writeFileSync(OUT_PATH, JSON.stringify(index, null, 2) + '\n');
    console.log(`✅ Wrote ${Object.keys(index).length} categories (${data.skills.length} skills) → src/data/skills-category-index.json`);
} catch (error: any) {
    console.error('❌ Error generating Skills category index:', error.message);
    process.exit(1);
}
