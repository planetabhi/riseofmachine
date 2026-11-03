// Safely inserts the listing into tools.json and runs the deterministic pipeline + gate.
// Dedupe MUST happen before add-slugs, which silently resolves slug collisions with "-1".

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import type { ToolsConfig, Category, Tool } from '../../src/types/index.ts';
import type { Listing } from './enrich.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '../..');
const toolsPath = path.join(repoRoot, 'src/data/tools.json');

function normalizeUrl(url: string): string {
    try {
        const u = new URL(url);
        u.searchParams.delete('ref');
        const host = u.hostname.replace(/^www\./, '').toLowerCase();
        const pathname = u.pathname.replace(/\/+$/, '');
        return `${host}${pathname}${u.search}`.toLowerCase();
    } catch {
        return url.trim().toLowerCase();
    }
}

function withRef(url: string): string {
    const u = new URL(url);
    u.protocol = 'https:';
    u.searchParams.set('ref', 'riseofmachine.com');
    return u.toString();
}

function run(script: string): void {
    execFileSync('bun', ['run', `scripts/${script}`], { cwd: repoRoot, stdio: 'pipe' });
}

export type ApplyResult =
    | { ok: true; slug: string; finalUrl: string }
    | { ok: false; reason: string; duplicate?: boolean };

export function applyTool(listing: Listing, submittedUrl: string): ApplyResult {
    const data: ToolsConfig = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));

    const finalUrl = withRef(submittedUrl);
    const target = normalizeUrl(finalUrl);

    // Dedupe on URL (anywhere) or title (within the chosen category) — before add-slugs.
    for (const category of data.tools) {
        for (const tool of category.content) {
            if (tool.url && normalizeUrl(tool.url) === target) {
                return { ok: false, duplicate: true, reason: `Duplicate URL — already listed as "${tool.title}".` };
            }
        }
    }
    const categoryEntry = data.tools.find((c: Category) => c.category === listing.category);
    if (!categoryEntry) {
        return { ok: false, reason: `Category "${listing.category}" does not exist.` };
    }
    const titleClash = categoryEntry.content.find(
        (t: Tool) => t.title.trim().toLowerCase() === listing.title.trim().toLowerCase(),
    );
    if (titleClash) {
        return { ok: false, duplicate: true, reason: `Duplicate title "${listing.title}" in category ${listing.category}.` };
    }

    const entry: Tool = {
        title: listing.title,
        body: listing.body,
        tag: listing.tag,
        url: finalUrl,
        'date-added': new Date().toISOString().slice(0, 10),
    };
    categoryEntry.content.push(entry);

    fs.writeFileSync(toolsPath, JSON.stringify(data, null, 2) + '\n');

    try {
        run('add-slugs.ts');
        run('split-data.ts');
        run('generate-slug-map.ts');
        run('check-data.ts');
    } catch (err: any) {
        const out = (err?.stdout?.toString() || '') + (err?.stderr?.toString() || '');
        return { ok: false, reason: `Data pipeline failed:\n${out.slice(-1500)}` };
    }

    // Re-read to recover the generated slug.
    const after: ToolsConfig = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));
    let slug: string | undefined;
    for (const category of after.tools) {
        const found = category.content.find((t: Tool) => t.url && normalizeUrl(t.url) === target);
        if (found?.slug) {
            slug = found.slug;
            break;
        }
    }
    if (!slug) return { ok: false, reason: 'Inserted tool but could not resolve its slug.' };

    return { ok: true, slug, finalUrl };
}
