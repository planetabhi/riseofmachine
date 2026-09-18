// Layer A — the skills crawl (network + CLI, out-of-band). NEVER part of `build`.
// Two phases, then a fail-soft all-or-nothing write of src/data/skills.json:
//
//   Phase 1 (scrape): parse skills.sh /topic for topic slugs, then each
//   /topic/{slug} for skill anchors /{owner}/{repo}/{slug}. Identity + topic
//   membership come from the URL path only (anchor text is ignored).
//
//   Phase 2 (CLI): for each unique {owner}/{repo}, run once
//   `DISABLE_TELEMETRY=1 npx skills add {source} --list` and parse the decorated
//   stdout for authoritative name + description. Join on slug (phase-1 slugs are
//   the filter — `--list` returns the whole repo, a superset of the topic subset).
//
//   bun run scripts/crawl-skills.ts
//
// Fail-soft: a topic/repo that fails is skipped; an empty result keeps the
// last-good skills.json instead of wiping it.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { parse } from 'node-html-parser';
import type { SkillsData, Skill } from '../src/types/skills.ts';
import { classifySkill } from '../src/utils/skills/classify.ts';
import { DEFAULT_SKILL_CATEGORY } from '../src/utils/skills/taxonomy.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_PATH = path.join(__dirname, '../src/data/skills.json');
const SEEDS_PATH = path.join(__dirname, 'skills-seeds.json');

const BASE = 'https://www.skills.sh';
const TOPIC_INDEX = `${BASE}/topic`;
const TIMEOUT_MS = 15000;
const RETRIES = 4;
const DELAY_MS = 400; // polite gap between requests
const UA = 'riseofmachine-skills-crawler/1.0 (+https://riseofmachine.com)';
const CLI_TIMEOUT_MS = 60000;

// Path segments that are never an {owner} — keeps the anchor parser honest.
const RESERVED = new Set(['topic', 'search', 'api', 'internal', 'debug-security', 'about', 'login', 'docs', '_next', 'assets']);

// A safe owner/repo/slug/topic segment — rejects junk hrefs before they reach
// the CLI (execFile args aren't shell-interpreted, but this keeps data clean).
const SEG = /^[A-Za-z0-9._-]+$/;
const ALLOWED_HOSTS = new Set(['www.skills.sh', 'skills.sh']);

// Extra GitHub repos to include beyond skills.sh discovery. These have no topic,
// so their skills are categorized by the offline classifier (with the seed's
// `categories` as a fallback). Shape: { repo, categories?, include?, exclude? }.
interface Seed {
    repo: string;
    categories?: string[];
    include?: string[]; // only these slugs
    exclude?: string[]; // never these slugs
}

const REPO_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

// A missing seeds file means "no extra repos" and is fine; any other problem
// (unreadable, malformed, wrong shape, or an invalid entry) throws so main()
// aborts before writing and the last-good skills.json is preserved.
function readSeeds(): Seed[] {
    let text: string;
    try {
        text = fs.readFileSync(SEEDS_PATH, 'utf-8');
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw new Error(`cannot read ${SEEDS_PATH}: ${e instanceof Error ? e.message : e}`);
    }
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (e) {
        throw new Error(`${SEEDS_PATH} is not valid JSON: ${e instanceof Error ? e.message : e}`);
    }
    if (!Array.isArray(raw)) throw new Error(`${SEEDS_PATH} must be a JSON array of seeds`);
    const strings = (v: unknown, field: string, i: number): string[] | undefined => {
        if (v === undefined) return undefined;
        if (!Array.isArray(v) || v.some((x) => typeof x !== 'string'))
            throw new Error(`${SEEDS_PATH}[${i}].${field} must be an array of strings`);
        return v as string[];
    };
    return raw.map((s, i) => {
        if (!s || typeof s !== 'object') throw new Error(`${SEEDS_PATH}[${i}] must be an object`);
        const seed = s as Record<string, unknown>;
        if (typeof seed.repo !== 'string' || !REPO_RE.test(seed.repo))
            throw new Error(`${SEEDS_PATH}[${i}].repo must match owner/repo`);
        const categories = strings(seed.categories, 'categories', i);
        const include = strings(seed.include, 'include', i);
        const exclude = strings(seed.exclude, 'exclude', i);
        return {
            repo: seed.repo,
            ...(categories && { categories }),
            ...(include && { include }),
            ...(exclude && { exclude }),
        };
    });
}

function readPrev(): SkillsData | null {
    try {
        return JSON.parse(fs.readFileSync(OUT_PATH, 'utf-8')) as SkillsData;
    } catch {
        return null;
    }
}

function warn(msg: unknown): void {
    console.warn(`⚠️  ${msg instanceof Error ? msg.message : msg}`);
}

async function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string): Promise<string> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
            const res = await fetch(url, {
                signal: ctrl.signal,
                headers: { accept: 'text/html', 'user-agent': UA },
            });
            clearTimeout(t);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.text();
        } catch (e) {
            lastErr = e;
            if (attempt < RETRIES) await sleep(2 ** attempt * 250);
        }
    }
    throw lastErr;
}

// Collect same-origin hrefs (relative or absolute) whose path has exactly
// `segments` parts, each a valid slug segment.
function pathsWith(html: string, segments: number): string[][] {
    const root = parse(html);
    const out: string[][] = [];
    const seen = new Set<string>();
    for (const a of root.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href') ?? '';
        if (!href || href.startsWith('#')) continue;
        let pathname: string;
        try {
            const u = new URL(href, BASE); // resolves both relative and absolute
            if (!ALLOWED_HOSTS.has(u.hostname)) continue; // ignore off-site
            pathname = u.pathname;
        } catch {
            continue;
        }
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length !== segments) continue;
        if (!parts.every((p) => SEG.test(p))) continue;
        const key = parts.join('/');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(parts);
    }
    return out;
}

// Phase 1: {source, slug, topic} tuples from the topic pages.
async function scrapeTopics(): Promise<{ source: string; slug: string; topic: string }[]> {
    const index = await fetchHtml(TOPIC_INDEX);
    const topics = pathsWith(index, 2)
        .filter(([head]) => head === 'topic')
        .map(([, slug]) => slug!);
    console.log(`🔎 Phase 1: ${topics.length} topics`);

    const tuples: { source: string; slug: string; topic: string }[] = [];
    for (const topic of topics) {
        await sleep(DELAY_MS);
        try {
            const html = await fetchHtml(`${TOPIC_INDEX}/${topic}`);
            // Skill anchors are /{owner}/{repo}/{slug} — 3 path segments.
            for (const [owner, repo, slug] of pathsWith(html, 3)) {
                if (RESERVED.has(owner!)) continue;
                tuples.push({ source: `${owner}/${repo}`, slug: slug!, topic });
            }
        } catch (e) {
            warn(`topic ${topic}: ${e instanceof Error ? e.message : e}`);
        }
    }
    console.log(`   ${tuples.length} listings before dedupe`);
    return tuples;
}

// Strip the CLI's decorated gutter (│ ├ └ ◇ ● and leading pipes/spaces).
function stripGutter(line: string): string {
    return line.replace(/^[│├└◇●\s|]+/u, '').replace(/\s+$/u, '');
}

// Phase 2: parse `skills add {source} --list` stdout into slug → description.
// Each entry is a name line followed by an indented description block; the
// `Use --skill <name> to install` footer ends the list.
function parseList(stdout: string): Map<string, string> {
    const out = new Map<string, string>();
    let current = '';
    let desc: string[] = [];
    const flush = () => {
        if (current) out.set(current, desc.join(' ').trim());
        current = '';
        desc = [];
    };
    for (const raw of stdout.split('\n')) {
        const line = stripGutter(raw);
        if (!line) continue;
        if (/^Use\s+--skill\b/i.test(line)) break;
        // A bare token (skill name/slug) starts a new entry; prose continues it.
        if (/^[a-z0-9][a-z0-9-]*$/i.test(line)) {
            flush();
            current = line;
        } else if (current) {
            desc.push(line);
        }
    }
    flush();
    return out;
}

function runList(source: string): Promise<Map<string, string>> {
    const url = `https://github.com/${source}`;
    return new Promise((resolve) => {
        execFile(
            'npx',
            ['--yes', 'skills', 'add', url, '--list'],
            { timeout: CLI_TIMEOUT_MS, env: { ...process.env, DISABLE_TELEMETRY: '1' }, maxBuffer: 8 * 1024 * 1024 },
            (err, stdout) => {
                if (err && !stdout) {
                    warn(`list ${source}: ${err.message}`);
                    resolve(new Map());
                    return;
                }
                resolve(parseList(stdout));
            },
        );
    });
}

function makeSkill(source: string, slug: string, description: string, categories: string[], url: string): Skill {
    return {
        slug,
        source,
        description,
        url,
        installCommand: `npx skills add https://github.com/${source} --skill ${slug}`,
        categories,
    };
}

// Categories for a seed-repo skill: classifier match, else the seed's declared
// categories, else the global default.
function seedCategories(slug: string, description: string, seed: Seed): string[] {
    const matched = classifySkill(slug, description);
    if (matched.length) return matched;
    if (seed.categories && seed.categories.length) return seed.categories;
    return [DEFAULT_SKILL_CATEGORY];
}

function build(
    tuples: { source: string; slug: string; topic: string }[],
    metaBySource: Map<string, Map<string, string>>,
    seeds: Seed[],
): Skill[] {
    // Dedupe on source+slug, first-seen order, unioning categories.
    const bySlug = new Map<string, Skill>();

    // 1. skills.sh-discovered skills — categories come from the topic pages.
    for (const { source, slug, topic } of tuples) {
        const key = `${source}/${slug}`;
        const existing = bySlug.get(key);
        if (existing) {
            if (!existing.categories.includes(topic)) existing.categories.push(topic);
            continue;
        }
        // Keep only slugs the CLI confirmed for this repo.
        const desc = metaBySource.get(source)?.get(slug);
        if (desc === undefined) continue;
        bySlug.set(key, makeSkill(source, slug, desc, [topic], `${BASE}/${source}/${slug}`));
    }

    // 2. Seed repos — every CLI-listed slug, categorized by the classifier.
    for (const seed of seeds) {
        const listed = metaBySource.get(seed.repo);
        if (!listed) continue;
        for (const [slug, desc] of listed) {
            if (seed.include && !seed.include.includes(slug)) continue;
            if (seed.exclude && seed.exclude.includes(slug)) continue;
            const cats = seedCategories(slug, desc, seed);
            const key = `${seed.repo}/${slug}`;
            const existing = bySlug.get(key);
            if (existing) {
                for (const c of cats) if (!existing.categories.includes(c)) existing.categories.push(c);
                continue;
            }
            bySlug.set(key, makeSkill(seed.repo, slug, desc, cats, `https://github.com/${seed.repo}`));
        }
    }

    return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

async function main(): Promise<void> {
    const prev = readPrev();
    const seeds = readSeeds();
    let tuples: { source: string; slug: string; topic: string }[] = [];
    try {
        tuples = await scrapeTopics();
    } catch (e) {
        warn(e);
    }
    if (tuples.length === 0 && seeds.length === 0) {
        warn('phase 1 yielded no listings and no seeds — keeping the last-good skills.json (fail-soft).');
        process.exit(0);
    }

    const sources = [...new Set([...tuples.map((t) => t.source), ...seeds.map((s) => s.repo)])];
    console.log(`🔎 Phase 2: ${sources.length} unique repos via \`skills add … --list\` (${seeds.length} seeded)`);
    const metaBySource = new Map<string, Map<string, string>>();
    for (const source of sources) {
        metaBySource.set(source, await runList(source));
    }

    const skills = build(tuples, metaBySource, seeds);
    if (skills.length === 0) {
        warn('no skills resolved after CLI join — keeping the last-good skills.json (fail-soft).');
        process.exit(0);
    }

    const data: SkillsData = { generatedAt: new Date().toISOString(), skills };
    fs.writeFileSync(OUT_PATH, JSON.stringify(data, null, 2) + '\n');
    console.log(`✅ Wrote ${skills.length} skills (was ${prev?.skills.length ?? 0}) → src/data/skills.json`);
}

main().catch((e) => {
    warn(e);
    process.exit(1);
});
