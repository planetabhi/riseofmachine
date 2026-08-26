import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ToolsConfig, Category, Tool } from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toolsPath = path.join(__dirname, '../src/data/tools.json');

const CONCURRENCY = 20;
const TIMEOUT_MS = 10_000;
const USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Report-only: this script never mutates tools.json or metadata.json.
// A failed fetch is a weak signal (many live sites block bots / time out), so
// only 404/410/DNS/refused/TLS on repeated attempts count as "dead".

type Kind = 'ok' | 'dead' | 'warn';
type Verdict = { kind: Kind; reason: string };
type Probe = { status?: number; timeout?: boolean; errCode?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchOnce(url: string, method: 'HEAD' | 'GET'): Promise<Probe> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            method,
            redirect: 'follow',
            headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
            signal: controller.signal,
        });
        return { status: res.status };
    } catch (e: any) {
        if (e?.name === 'AbortError') return { timeout: true };
        return { errCode: String(e?.cause?.code || e?.code || e?.name || 'ERR') };
    } finally {
        clearTimeout(timer);
    }
}

// null result = "HEAD was rejected, retry with GET".
function classify(p: Probe): Verdict | null {
    if (p.status != null) {
        if (p.status >= 200 && p.status < 400) return { kind: 'ok', reason: String(p.status) };
        if (p.status === 404 || p.status === 410) return { kind: 'dead', reason: String(p.status) };
        if (p.status === 405 || p.status === 501 || p.status === 403) return null; // HEAD often blocked
        return { kind: 'warn', reason: String(p.status) }; // 429 / 5xx / other
    }
    if (p.timeout) return { kind: 'warn', reason: 'timeout' };
    const code = p.errCode || 'ERR';
    if (code === 'ENOTFOUND') return { kind: 'dead', reason: 'dns' };
    if (code === 'ECONNREFUSED') return { kind: 'dead', reason: 'refused' };
    if (/CERT|TLS|SSL/i.test(code)) return { kind: 'dead', reason: 'tls' };
    return { kind: 'warn', reason: code.toLowerCase() };
}

async function attempt(url: string, method: 'HEAD' | 'GET'): Promise<Verdict> {
    const first = classify(await fetchOnce(url, method));
    if (first) return first;
    // HEAD rejected → confirm with GET; still rejected → treat as blocked (live, uncertain).
    return classify(await fetchOnce(url, 'GET')) ?? { kind: 'warn', reason: 'blocked' };
}

async function checkUrl(url: string): Promise<Verdict> {
    const a = await attempt(url, 'HEAD');
    if (a.kind === 'ok') return a;
    // Retry once to avoid flagging transient blips as dead.
    await sleep(600);
    const b = await attempt(url, 'GET');
    if (b.kind === 'ok') return b;
    if (a.kind === 'dead' && b.kind === 'dead') return b; // dead only if consistent
    return b.kind === 'dead' ? { kind: 'warn', reason: b.reason } : b;
}

async function main() {
    console.log('🔗 Checking tool links (report-only, no data is modified)...\n');
    const data: ToolsConfig = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));

    // Dedupe by URL; keep every tool that uses it for the report.
    const byUrl = new Map<string, { slug: string; category: string }[]>();
    data.tools.forEach((cat: Category) =>
        cat.content.forEach((tool: Tool) => {
            if (!tool.url || !tool.slug) return;
            const list = byUrl.get(tool.url) ?? [];
            list.push({ slug: tool.slug, category: cat.category });
            byUrl.set(tool.url, list);
        }),
    );

    const urls = [...byUrl.keys()];
    console.log(`Found ${urls.length} unique URLs. Checking (concurrency ${CONCURRENCY})...\n`);

    const dead: { url: string; reason: string; tools: { slug: string; category: string }[] }[] = [];
    const warn: typeof dead = [];
    let done = 0;

    let cursor = 0;
    async function worker() {
        while (cursor < urls.length) {
            const url = urls[cursor++]!;
            const verdict = await checkUrl(url);
            done++;
            if (done % 50 === 0 || done === urls.length) {
                process.stdout.write(`\rChecked ${done}/${urls.length}`);
            }
            if (verdict.kind === 'dead') dead.push({ url, reason: verdict.reason, tools: byUrl.get(url)! });
            else if (verdict.kind === 'warn') warn.push({ url, reason: verdict.reason, tools: byUrl.get(url)! });
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    const fmt = (e: { url: string; reason: string; tools: { slug: string; category: string }[] }) =>
        e.tools
            .map((t) => `  [${t.category}] ${t.slug} — ${e.url} (${e.reason})`)
            .join('\n');

    console.log('\n');
    if (dead.length) {
        console.log(`❌ Likely dead (${dead.length}):`);
        dead.sort((a, b) => a.tools[0]!.category.localeCompare(b.tools[0]!.category));
        console.log(dead.map(fmt).join('\n'));
        console.log('');
    }
    if (warn.length) {
        console.log(`⚠️  Uncertain / blocked / transient (${warn.length}) — verify manually:`);
        warn.sort((a, b) => a.tools[0]!.category.localeCompare(b.tools[0]!.category));
        console.log(warn.map(fmt).join('\n'));
        console.log('');
    }

    const ok = urls.length - dead.length - warn.length;
    console.log(`✅ OK: ${ok}   ❌ Dead: ${dead.length}   ⚠️  Warn: ${warn.length}`);
    // Non-zero exit on hard-dead so this can gate CI if wired up; warns don't fail.
    process.exit(dead.length ? 1 : 0);
}

main();
