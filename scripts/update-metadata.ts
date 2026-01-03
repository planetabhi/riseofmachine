import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'node-html-parser';
import type { ToolsConfig, Tool, MetadataEntry, MetadataMap } from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toolsPath = path.join(__dirname, '../src/data/tools.json');
const metadataPath = path.join(__dirname, '../src/data/metadata.json');
const faviconsDir = path.join(__dirname, '../public/favicons');

const CONCURRENCY_LIMIT = 25;
const TIMEOUT_MS = 6000;
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Ensure favicons directory exists
if (!fs.existsSync(faviconsDir)) {
    fs.mkdirSync(faviconsDir, { recursive: true });
    console.log(`📁 Created favicons directory: ${faviconsDir}`);
}

function extractDomain(url: string): string | null {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return null;
    }
}

async function fetchFavicon(tool: Tool): Promise<boolean> {
    if (!tool.url || !tool.slug) return false;

    const domain = extractDomain(tool.url);
    if (!domain) return false;

    const faviconPath = path.join(faviconsDir, `${tool.slug}.png`);

    // Skip if favicon already exists
    if (fs.existsSync(faviconPath)) {
        return true;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        // Use Google's favicon service to fetch (one-time download, then self-hosted)
        const faviconUrl = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
        const response = await fetch(faviconUrl, {
            headers: { "User-Agent": USER_AGENT },
            signal: controller.signal,
        });

        if (!response.ok) return false;

        const buffer = await response.arrayBuffer();
        fs.writeFileSync(faviconPath, new Uint8Array(buffer));
        return true;

    } catch (err: any) {
        return false;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function fetchMetadata(tool: Tool): Promise<MetadataEntry | null> {
    const url = tool.url;
    if (!url) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            headers: { "User-Agent": USER_AGENT },
            signal: controller.signal,
        });

        if (!response.ok) return null;

        const contentType = response.headers.get("content-type");
        if (contentType && !contentType.includes("text/html")) return null;

        const html = await response.text();
        const root = parse(html);

        const title =
            root.querySelector('title')?.text?.trim() ||
            root.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();

        const description =
            root.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ||
            root.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim();

        // Extract OG image for preview
        const ogImage = root.querySelector('meta[property="og:image"]')?.getAttribute('content')?.trim();

        // Extract Twitter handle from meta tag or link
        let twitterHandle = root.querySelector('meta[name="twitter:site"]')?.getAttribute('content')?.trim() ||
            root.querySelector('meta[name="twitter:creator"]')?.getAttribute('content')?.trim();

        if (!twitterHandle) {
            const twitterLink = root.querySelector('a[href*="twitter.com"]')?.getAttribute('href') ||
                root.querySelector('a[href*="x.com"]')?.getAttribute('href');
            if (twitterLink) {
                const match = twitterLink.match(/(?:twitter\.com|x\.com)\/(@?\w+)/);
                if (match && match[1]) {
                    twitterHandle = match[1].startsWith('@') ? match[1] : `@${match[1]}`;
                }
            }
        }

        // Normalize twitter handle to include @
        if (twitterHandle && !twitterHandle.startsWith('@')) {
            twitterHandle = `@${twitterHandle}`;
        }

        // Extract GitHub link
        const githubLink = root.querySelector('a[href*="github.com"]')?.getAttribute('href')?.trim();
        const githubUrl = githubLink && githubLink.includes('github.com') ? githubLink : undefined;

        // Only return if we found something useful
        if (!title && !description && !ogImage && !twitterHandle && !githubUrl) return null;

        return {
            slug: tool.slug || '',
            title: title || undefined,
            description: description || undefined,
            ogImage: ogImage || undefined,
            twitterHandle: twitterHandle || undefined,
            githubUrl: githubUrl || undefined,
        };

    } catch (err: any) {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function main() {
    console.log("🚀 Starting metadata and favicon update...\n");
    console.log("Reading tools.json...");
    const data: ToolsConfig = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));

    const allTools = data.tools.flatMap(cat => cat.content).filter(t => t.slug && t.url);
    console.log(`Found ${allTools.length} tools. Starting fetch (Concurrency: ${CONCURRENCY_LIMIT})...\n`);

    let completed = 0;
    let metadataFetched = 0;
    let faviconsFetched = 0;
    let existingMetadata: MetadataMap = {};

    if (fs.existsSync(metadataPath)) {
        try {
            existingMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        } catch (e) {
            console.log("Could not read existing metadata, starting fresh.");
        }
    }

    // Initialize results as empty to prune stale keys
    const results: MetadataMap = {};

    for (let i = 0; i < allTools.length; i += CONCURRENCY_LIMIT) {
        const chunk = allTools.slice(i, i + CONCURRENCY_LIMIT);
        const promises = chunk.map(async (tool) => {
            const slug = tool.slug as string;

            // Fetch favicon (always attempt, will skip if exists)
            const faviconSuccess = await fetchFavicon(tool);
            if (faviconSuccess) faviconsFetched++;

            // If we have valid existing metadata, keep it and skip fetch
            if (existingMetadata[slug] && existingMetadata[slug].title) {
                results[slug] = existingMetadata[slug];
                completed++;
                return;
            }

            // Otherwise, fetch fresh metadata
            const res = await fetchMetadata(tool);
            completed++;
            if (completed % 50 === 0) {
                process.stdout.write(`\rProgress: ${completed}/${allTools.length} | Metadata: ${metadataFetched} | Favicons: ${faviconsFetched}`);
            }
            if (res && res.slug) {
                results[res.slug] = res;
                metadataFetched++;
            }
        });

        await Promise.all(promises);
    }

    console.log(`\n\n✨ Update complete!`);
    console.log(`📊 Metadata entries: ${Object.keys(results).length}`);
    console.log(`🎨 Favicons stored: ${faviconsFetched}`);
    console.log(`📁 Favicon directory: ${faviconsDir}`);

    fs.writeFileSync(metadataPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Saved metadata to ${metadataPath}`);
}

main();
