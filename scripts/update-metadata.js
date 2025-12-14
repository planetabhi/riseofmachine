import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'node-html-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toolsPath = path.join(__dirname, '../src/data/tools.json');
const metadataPath = path.join(__dirname, '../src/data/metadata.json');

const CONCURRENCY_LIMIT = 25;
const TIMEOUT_MS = 6000;
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";



async function fetchMetadata(tool) {
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

        // Only return if we actually found something useful to augment tools.json
        if (!title && !description) return null;

        return {
            slug: tool.slug,
            title: title || undefined,
            description: description || undefined,
        };

    } catch (err) {
        // console.log(`Failed to fetch ${url}: ${err.message}`);
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function main() {
    console.log("Reading tools.json...");
    const data = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));

    const allTools = data.tools.flatMap(cat => cat.content).filter(t => t.slug && t.url);
    console.log(`Found ${allTools.length} tools. Starting metadata fetch (Concurrency: ${CONCURRENCY_LIMIT})...`);

    // Load existing metadata to avoid re-fetching if we want to add incremental logic later
    // For now, we'll just fetch everything to be fresh. 
    // Optimization: In real world, we might want to checks if metadata.json exists and skip known ones.
    // Let's implement incremental update: only fetch if not already in metadata.json?
    // User said "Update-metadata script", implying a refresh. 
    // But 1000 requests is still slow. Let's do a fresh fetch but show progress.

    let completed = 0;
    const results = {};

    // Chunk array for concurrency
    for (let i = 0; i < allTools.length; i += CONCURRENCY_LIMIT) {
        const chunk = allTools.slice(i, i + CONCURRENCY_LIMIT);
        const promises = chunk.map(tool => fetchMetadata(tool).then(res => {
            completed++;
            if (completed % 50 === 0) process.stdout.write(`\rProgress: ${completed}/${allTools.length}`);
            if (res) results[res.slug] = res;
        }));

        await Promise.all(promises);
    }

    console.log(`\n\nFetched metadata for ${Object.keys(results).length} tools.`);

    fs.writeFileSync(metadataPath, JSON.stringify(results, null, 2));
    console.log(`Saved to ${metadataPath}`);
}

main();
