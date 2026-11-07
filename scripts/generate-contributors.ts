import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { safeHttpRequest } from './lib/safe-http.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OWNER = 'planetabhi';
const REPO = 'riseofmachine';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

const dataPath = path.join(__dirname, '../src/data/contributors.json');
const avatarDir = path.join(__dirname, '../public/contributors');

const USER_AGENT = 'riseofmachine-contributors-script';
const TIMEOUT_MS = 10_000;
const MAX_JSON_BYTES = 4_000_000;
const MAX_IMG_BYTES = 1_000_000;
const AVATAR_SIZE = 80; // fetch at 2x for crisp 40x40 rendering

type GhUser = { login: string; avatar_url: string; html_url: string; type: string };
type Entry = {
    login: string;
    avatarUrl: string;
    profileUrl: string;
    type: string;
    contributions: number;
    source: 'code' | 'issues' | 'both';
};
type Contributor = {
    login: string;
    avatar: string;
    profileUrl: string;
    type: string;
    contributions: number;
    source: 'code' | 'issues' | 'both';
};

function ghHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'User-Agent': USER_AGENT,
        Accept: 'application/vnd.github+json',
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

function hasNextPage(link: string | string[] | undefined): boolean {
    return typeof link === 'string' && link.includes('rel="next"');
}

// Lowercase, turn "[bot]" into "-bot", drop anything outside [a-z0-9-] so the
// value is safe to use as a filename (no path traversal).
function safeLogin(login: string): string {
    return login.toLowerCase().replace(/\[bot\]/g, '-bot').replace(/[^a-z0-9-]/g, '');
}

function extFromContentType(ct: string | string[] | undefined): string {
    const value = Array.isArray(ct) ? ct[0] : ct;
    if (!value) return 'png';
    if (value.includes('jpeg') || value.includes('jpg')) return 'jpg';
    if (value.includes('gif')) return 'gif';
    if (value.includes('webp')) return 'webp';
    return 'png';
}

async function getJson<T>(url: string): Promise<{ data: T; link: string | string[] | undefined }> {
    const response = await safeHttpRequest(url, {
        method: 'GET',
        timeoutMs: TIMEOUT_MS,
        maxBytes: MAX_JSON_BYTES,
        maxRedirects: 3,
        headers: ghHeaders(),
    });
    if (response.status !== 200) {
        throw new Error(`GitHub responded ${response.status} for ${url}`);
    }
    return { data: JSON.parse(response.body.toString('utf-8')) as T, link: response.headers.link };
}

async function fetchContributors(): Promise<any[]> {
    const out: any[] = [];
    for (let page = 1; ; page++) {
        const { data, link } = await getJson<any[]>(`${API}/contributors?per_page=100&anon=0&page=${page}`);
        if (!Array.isArray(data) || data.length === 0) break;
        out.push(...data);
        if (!hasNextPage(link)) break;
    }
    return out;
}

async function fetchIssueAuthors(): Promise<Map<string, GhUser>> {
    const authors = new Map<string, GhUser>();
    for (let page = 1; ; page++) {
        const { data, link } = await getJson<any[]>(`${API}/issues?state=all&per_page=100&page=${page}`);
        if (!Array.isArray(data) || data.length === 0) break;
        for (const item of data) {
            // The issues endpoint also returns PRs; those carry a pull_request field.
            if (item.pull_request || !item.user) continue;
            if (!authors.has(item.user.login)) authors.set(item.user.login, item.user);
        }
        if (!hasNextPage(link)) break;
    }
    return authors;
}

async function downloadAvatar(entry: Entry): Promise<string | null> {
    const file = safeLogin(entry.login);
    const sep = entry.avatarUrl.includes('?') ? '&' : '?';
    try {
        const response = await safeHttpRequest(`${entry.avatarUrl}${sep}s=${AVATAR_SIZE}`, {
            method: 'GET',
            timeoutMs: TIMEOUT_MS,
            maxBytes: MAX_IMG_BYTES,
            maxRedirects: 3,
            headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' },
        });
        if (response.status === 200 && response.body.length > 0) {
            const name = `${file}.${extFromContentType(response.headers['content-type'])}`;
            fs.writeFileSync(path.join(avatarDir, name), response.body);
            return `/contributors/${name}`;
        }
        console.warn(`  ! avatar ${entry.login}: HTTP ${response.status}`);
    } catch (error: any) {
        console.warn(`  ! avatar ${entry.login}: ${error?.message ?? error}`);
    }
    // Fall back to a previously downloaded file if one exists.
    const existing = fs.existsSync(avatarDir)
        ? fs.readdirSync(avatarDir).find((f) => f.startsWith(`${file}.`))
        : undefined;
    return existing ? `/contributors/${existing}` : null;
}

async function main() {
    console.log('👥 Generating contributors...\n');

    let contributors: any[] = [];
    let issueAuthors = new Map<string, GhUser>();
    let fetched = false;

    try {
        contributors = await fetchContributors();
        fetched = true;
        console.log(`  ✓ ${contributors.length} code contributors`);
    } catch (error: any) {
        console.warn(`  ! contributors fetch failed: ${error?.message ?? error}`);
    }

    try {
        issueAuthors = await fetchIssueAuthors();
        fetched = true;
        console.log(`  ✓ ${issueAuthors.size} issue authors`);
    } catch (error: any) {
        console.warn(`  ! issues fetch failed: ${error?.message ?? error}`);
    }

    if (!fetched) {
        console.warn('  ! both sources failed — keeping existing contributors.json\n');
        return;
    }

    // Code contributors first (GitHub returns them by contributions desc),
    // then issue-only authors, deduped by login.
    const byLogin = new Map<string, Entry>();
    const order: string[] = [];
    for (const c of contributors) {
        if (byLogin.has(c.login)) continue;
        byLogin.set(c.login, {
            login: c.login,
            avatarUrl: c.avatar_url,
            profileUrl: c.html_url,
            type: c.type,
            contributions: c.contributions ?? 0,
            source: 'code',
        });
        order.push(c.login);
    }
    for (const [login, user] of issueAuthors) {
        const existing = byLogin.get(login);
        if (existing) {
            existing.source = 'both';
            continue;
        }
        byLogin.set(login, {
            login,
            avatarUrl: user.avatar_url,
            profileUrl: user.html_url,
            type: user.type,
            contributions: 0,
            source: 'issues',
        });
        order.push(login);
    }

    fs.mkdirSync(avatarDir, { recursive: true });

    const result: Contributor[] = [];
    for (const login of order) {
        const entry = byLogin.get(login)!;
        const avatar = await downloadAvatar(entry);
        if (!avatar) continue; // no image available — skip rather than render a broken tile
        result.push({
            login: entry.login,
            avatar,
            profileUrl: entry.profileUrl,
            type: entry.type,
            contributions: entry.contributions,
            source: entry.source,
        });
    }

    if (result.length === 0) {
        console.warn('  ! no contributors resolved — keeping existing contributors.json\n');
        return;
    }

    fs.writeFileSync(dataPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`\n  ✓ Wrote ${result.length} contributors to src/data/contributors.json\n`);
}

main().catch((error) => {
    console.warn(`  ! generate-contributors failed: ${error?.message ?? error}\n`);
});
