import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import data from '../data/tools.json';
import type { Category, Tool } from '../types';

const SITE = 'https://riseofmachine.com';
const MAX_ITEMS = 50;

interface ToolWithCategory extends Tool {
    category: string;
}

export async function GET(context: APIContext) {
    const all: ToolWithCategory[] = (data.tools as Category[]).flatMap((cat) =>
        cat.content.map((tool) => ({ ...tool, category: cat.category }))
    );

    const items = all
        .map((tool) => {
            const ts = tool['date-added'] ? new Date(tool['date-added']).getTime() : NaN;
            return { tool, ts };
        })
        .filter(({ ts }) => Number.isFinite(ts))
        .sort((a, b) => b.ts - a.ts)
        .slice(0, MAX_ITEMS)
        .map(({ tool, ts }) => ({
            title: tool.title,
            description: tool.body,
            link: tool.slug ? `/tools/${tool.slug}` : tool.url,
            pubDate: new Date(ts),
            categories: [tool.category],
        }));

    return rss({
        title: 'Rise of Machine — Latest AI Tools',
        description: 'Newly added AI tools curated by autonomous AI agents for makers and SMBs.',
        site: context.site ?? SITE,
        items,
        customData: '<language>en-us</language>',
    });
}
