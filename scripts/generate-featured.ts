import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ToolsConfig, Category, Tool } from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('⭐ Generating Featured picks...\n');

const toolsPath = path.join(__dirname, '../src/data/tools.json');
const metadataPath = path.join(__dirname, '../src/data/metadata.json');
const slugMapPath = path.join(__dirname, '../src/data/slug-map.json');
const outputPath = path.join(__dirname, '../src/data/featured.json');

const SLOTS = 4;
const DAY_MS = 86_400_000;

type Meta = { description?: string; featured?: boolean };

try {
    const data: ToolsConfig = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));
    const metadata: Record<string, Meta> = fs.existsSync(metadataPath)
        ? JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
        : {};
    const slugMap: Record<string, string[]> = fs.existsSync(slugMapPath)
        ? JSON.parse(fs.readFileSync(slugMapPath, 'utf-8'))
        : {};

    // Flatten unique tools; primary category comes from slug-map (canonical).
    const bySlug = new Map<string, Tool & { category: string }>();
    data.tools.forEach((category: Category) => {
        category.content.forEach((tool: Tool) => {
            if (!tool.slug || bySlug.has(tool.slug)) return;
            bySlug.set(tool.slug, {
                ...tool,
                category: slugMap[tool.slug]?.[0] ?? category.category,
            });
        });
    });
    const all = [...bySlug.values()];

    // Editorial picks always win (human override, no eligibility filter).
    const editorial = all.filter((t) => metadata[t.slug!]?.featured);

    // Fallback pool: tools fit to feature.
    const seenDomain = new Set<string>();
    const eligible = all
        .filter((t) => {
            const tag = t.tag ?? '';
            if (!tag || tag === 'Not available') return false;
            if (!(t.body ?? '').trim()) return false;
            if (!metadata[t.slug!]?.description) return false;
            let domain = '';
            try {
                domain = new URL(t.url).hostname.replace(/^www\./, '');
            } catch {
                return false;
            }
            if (seenDomain.has(domain)) return false;
            seenDomain.add(domain);
            return true;
        })
        .sort((a, b) => a.slug!.localeCompare(b.slug!));

    // Rotate both lists by day so picks change on a schedule (needs a rebuild).
    const offset = Math.floor(Date.now() / DAY_MS);
    const rotate = <T>(arr: T[]): T[] =>
        arr.length ? arr.map((_, i) => arr[(i + offset) % arr.length]!) : arr;

    // Even, deterministic spread: a step coprime to length visits every index
    // once, so fallback picks aren't an alphabetical cluster.
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
    const spread = <T>(arr: T[]): T[] => {
        const n = arr.length;
        if (n <= 2) return rotate(arr);
        let step = Math.max(1, Math.round(n * 0.618));
        while (step > 1 && gcd(step, n) !== 1) step -= 1;
        return arr.map((_, k) => arr[(offset + k * step) % n]!);
    };

    const picks: string[] = [];
    const usedCats = new Set<string>();
    const usedSlugs = new Set<string>();

    // Editorial first (ignore diversity), then fill from the pool by distinct category.
    for (const t of rotate(editorial)) {
        if (picks.length >= SLOTS || usedSlugs.has(t.slug!)) continue;
        picks.push(t.slug!);
        usedSlugs.add(t.slug!);
        usedCats.add(t.category);
    }
    for (const t of spread(eligible)) {
        if (picks.length >= SLOTS) break;
        if (usedSlugs.has(t.slug!) || usedCats.has(t.category)) continue;
        picks.push(t.slug!);
        usedSlugs.add(t.slug!);
        usedCats.add(t.category);
    }

    fs.writeFileSync(outputPath, JSON.stringify({ slugs: picks }, null, 2));
    console.log(
        `✅ Featured: ${picks.length} slugs (${editorial.length} editorial) -> src/data/featured.json`,
    );
    console.log(`   ${picks.join(', ')}`);
} catch (error: any) {
    console.error('❌ Error generating featured picks:', error.message);
    process.exit(1);
}
