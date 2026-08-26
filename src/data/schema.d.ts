/**
 * Public type definitions for the riseofmachine data package.
 * Import with: `import type { Tool, ToolsConfig } from "riseofmachine/schema";`
 */

/** A single AI tool entry, as stored in tools.json / the category files. */
export interface Tool {
    title: string;
    body: string;
    tag?: string;
    url: string;
    "date-added": string;
    slug: string;
    /** Present when a tool is flattened out of its category. */
    category?: string;
}

/** One category bucket in the monolithic tools.json. */
export interface Category {
    title: string;
    category: string;
    content: Tool[];
}

/** Shape of the default export from `riseofmachine` / `riseofmachine/tools`. */
export interface ToolsConfig {
    tools: Category[];
}

/** An entry in metadata.json, keyed by slug. */
export interface MetadataEntry {
    slug: string;
    title?: string;
    description?: string;
    ogImage?: string;
    twitterHandle?: string;
    githubUrl?: string;
    /** Editorial "Featured" pick shown on the homepage. */
    featured?: boolean;
}

/** Shape of the default export from `riseofmachine/metadata`. */
export type MetadataMap = Record<string, MetadataEntry>;

/** Shape of the default export from `riseofmachine/slug-map`: slug -> categories. */
export type SlugMap = Record<string, string[]>;

/** Shape of each per-tool file under `riseofmachine/tool/{slug}`. */
export interface ToolMetadata {
    title: string;
    description: string;
    category: string;
    url: string;
    tag?: string;
    "date-added": string;
    slug: string;
    /** Precomputed related tool slugs (alternatives). */
    related?: string[];
}
