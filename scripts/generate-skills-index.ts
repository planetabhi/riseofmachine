// Layer B — offline generator (part of `prepare-data`). Pure, no network.
// Reads committed src/data/skills.json → writes public/skills-index.json: a
// compact, card-sized record per skill. The Skills grid is rendered client-side
// from this file (48 at a time) so the listing HTML stays tiny. Per-category
// shards let category pages fetch only their slice. This is the ONLY public
// payload generator — SkillsEnhancer runs client search over it (no separate
// search index). No-ops (exit 0) when the source is absent (build-safe).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { SkillsData, Skill } from '../src/types/skills.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_PATH = path.join(__dirname, '../src/data/skills.json');
const OUT_PATH = path.join(__dirname, '../public/skills-index.json');
const SHARD_DIR = path.join(__dirname, '../public/skills-cat');

// Compact record — short keys keep the payload small. Consumed by SkillsEnhancer
// (grid) and SkillsDetailPanel (RHS panel).
interface LiteRecord {
    s: string; // slug
    src: string; // source (owner/repo)
    b: string; // full description (cards clamp visually via CSS; the panel shows all)
    cs: string[]; // every topic the skill belongs to; cs[0] is primary
    ic: string; // install command (primary CTA)
    u: string; // canonical url
}

function toLite(s: Skill): LiteRecord {
    return {
        s: s.slug,
        src: s.source,
        b: (s.description || '').trim(),
        cs: s.categories,
        ic: s.installCommand,
        u: s.url,
    };
}

console.log('🗂️  Generating Skills client index...');

if (!fs.existsSync(SRC_PATH)) {
    console.log('ℹ️  src/data/skills.json not found — skipping (run `bun run crawl-skills` first).');
    process.exit(0);
}

try {
    const data: SkillsData = JSON.parse(fs.readFileSync(SRC_PATH, 'utf-8'));
    // A–Z by slug for a deterministic default order → minimal diffs.
    const skills = data.skills.toSorted((a, b) => a.slug.localeCompare(b.slug));
    const records = skills.map(toLite);
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(records) + '\n');
    console.log(`✅ Wrote ${records.length} records → public/skills-index.json`);

    // Per-category shards so category pages fetch only their slice. A skill in
    // multiple topics appears in each of its categories' shards.
    fs.rmSync(SHARD_DIR, { recursive: true, force: true }); // drop stale shards
    fs.mkdirSync(SHARD_DIR, { recursive: true });
    const byCategory = new Map<string, LiteRecord[]>();
    for (let i = 0; i < records.length; i++) {
        for (const cat of skills[i]!.categories) {
            const arr = byCategory.get(cat) ?? [];
            arr.push(records[i]!);
            byCategory.set(cat, arr);
        }
    }
    for (const [category, recs] of byCategory) {
        fs.writeFileSync(path.join(SHARD_DIR, `${category}.json`), JSON.stringify(recs) + '\n');
    }
    console.log(`✅ Wrote ${byCategory.size} category shards → public/skills-cat/`);
} catch (error: any) {
    console.error('❌ Error generating Skills client index:', error.message);
    process.exit(1);
}
