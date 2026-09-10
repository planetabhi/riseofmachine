// Faithful transform of raw registry entries → McpServer (§5.6). Pure & offline.
import type {
    McpServer,
    McpRemote,
    McpPackage,
    McpRepository,
    McpKeyValue,
    McpTransport,
    McpRegistryType,
    McpStatus,
} from '../../types/mcp';
import { buildInstallCommand } from './install';

// ---- Raw registry shapes (subset we consume) -----------------------------

export interface RawKeyValue {
    name?: string;
    description?: string;
    isRequired?: boolean;
    required?: boolean;
}
export interface RawRemote {
    type?: string;
    url?: string;
    headers?: RawKeyValue[];
}
export interface RawTransport {
    type?: string;
}
export interface RawPackage {
    registryType?: string;
    identifier?: string;
    version?: string;
    transport?: RawTransport;
    runtimeHint?: string;
    environmentVariables?: RawKeyValue[];
    packageArguments?: Array<{ value?: string } | string>;
    runtimeArguments?: Array<{ value?: string } | string>;
    registryBaseUrl?: string;
    fileSha256?: string;
}
export interface RawRepository {
    url?: string;
    source?: string;
    id?: string;
}
export interface RawIcon {
    src?: string;
}
export interface RawServerManifest {
    name?: string;
    title?: string;
    description?: string;
    version?: string;
    websiteUrl?: string;
    repository?: RawRepository;
    remotes?: RawRemote[];
    packages?: RawPackage[];
    icons?: Array<RawIcon | string>;
}
export interface RawOfficialMeta {
    status?: string;
    isLatest?: boolean;
    publishedAt?: string;
    updatedAt?: string;
    statusChangedAt?: string;
}
export interface RawEntry {
    server?: RawServerManifest;
    _meta?: {
        'io.modelcontextprotocol.registry/official'?: RawOfficialMeta;
    };
}

export const OFFICIAL_META_KEY = 'io.modelcontextprotocol.registry/official';

export function officialMeta(entry: RawEntry): RawOfficialMeta {
    return entry._meta?.[OFFICIAL_META_KEY] ?? {};
}

// ---- Helpers --------------------------------------------------------------

const TRANSPORTS: McpTransport[] = ['stdio', 'streamable-http', 'sse'];
const REGISTRY_TYPES: McpRegistryType[] = ['npm', 'pypi', 'oci', 'nuget', 'mcpb'];

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[/.]+/g, '-') // reverse-DNS separators → hyphen
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

// Minimal HTML entity decode + tag strip for registry-provided descriptions.
export function decodeAndSanitize(input: string | undefined): string {
    if (!input) return '';
    const decoded = input
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&nbsp;/g, ' ');
    return decoded.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function normTransport(t: string | undefined): McpTransport {
    return TRANSPORTS.includes(t as McpTransport) ? (t as McpTransport) : 'stdio';
}

function normRegistryType(t: string | undefined): McpRegistryType | undefined {
    return REGISTRY_TYPES.includes(t as McpRegistryType) ? (t as McpRegistryType) : undefined;
}

function mapKeyValues(items: RawKeyValue[] | undefined): McpKeyValue[] | undefined {
    if (!items || items.length === 0) return undefined;
    const out = items
        .filter((i) => i.name)
        .map((i) => {
            const kv: McpKeyValue = { name: i.name! };
            if (i.description) kv.description = i.description;
            const required = i.isRequired ?? i.required;
            if (typeof required === 'boolean') kv.required = required;
            return kv;
        });
    return out.length ? out : undefined;
}

function mapArgs(items: RawPackage['packageArguments']): string[] | undefined {
    if (!items || items.length === 0) return undefined;
    const out = items
        .map((a) => (typeof a === 'string' ? a : a.value))
        .filter((v): v is string => typeof v === 'string' && v.length > 0);
    return out.length ? out : undefined;
}

function mapRemotes(remotes: RawRemote[] | undefined): McpRemote[] {
    if (!remotes) return [];
    return remotes
        .filter((r) => r.url)
        .map((r) => {
            const out: McpRemote = { type: normTransport(r.type), url: r.url! };
            const headers = mapKeyValues(r.headers);
            if (headers) out.headers = headers;
            return out;
        });
}

function mapPackages(packages: RawPackage[] | undefined): McpPackage[] {
    if (!packages) return [];
    const out: McpPackage[] = [];
    for (const p of packages) {
        const registryType = normRegistryType(p.registryType);
        if (!registryType || !p.identifier) continue;
        const pkg: McpPackage = {
            registryType,
            identifier: p.identifier,
            transport: normTransport(p.transport?.type),
        };
        if (p.version) pkg.version = p.version;
        if (p.runtimeHint) pkg.runtimeHint = p.runtimeHint;
        const env = mapKeyValues(p.environmentVariables);
        if (env) pkg.environmentVariables = env;
        const pArgs = mapArgs(p.packageArguments);
        if (pArgs) pkg.packageArguments = pArgs;
        const rArgs = mapArgs(p.runtimeArguments);
        if (rArgs) pkg.runtimeArguments = rArgs;
        if (p.registryBaseUrl) pkg.registryBaseUrl = p.registryBaseUrl;
        out.push(pkg);
    }
    return out;
}

function isHttpsHost(url: string): boolean {
    try {
        const u = new URL(url);
        return u.protocol === 'https:' && !!u.hostname;
    } catch {
        return false;
    }
}

function resolveIcons(icons: RawServerManifest['icons']): { icons?: string[]; iconUrl?: string } {
    if (!icons || icons.length === 0) return {};
    const urls = icons
        .map((i) => (typeof i === 'string' ? i : i.src))
        .filter((u): u is string => typeof u === 'string' && u.length > 0);
    if (urls.length === 0) return {};
    const iconUrl = urls.find(isHttpsHost);
    const result: { icons?: string[]; iconUrl?: string } = { icons: urls };
    if (iconUrl) result.iconUrl = iconUrl;
    return result;
}

function mapRepository(repo: RawRepository | undefined): McpRepository | undefined {
    if (!repo?.url) return undefined;
    const out: McpRepository = { url: repo.url };
    if (repo.source) out.source = repo.source;
    if (repo.id) out.id = repo.id;
    return out;
}

function normStatus(status: string | undefined): McpStatus {
    return status === 'deprecated' ? 'deprecated' : 'active';
}

// Transform a single raw entry into a McpServer (category filled by classify()).
export function mapServer(entry: RawEntry): McpServer | null {
    const s = entry.server;
    if (!s?.name) return null;
    const meta = officialMeta(entry);

    const name = s.name;
    const title = s.title?.trim() || name;
    const slug = slugify(name);
    const description = decodeAndSanitize(s.description);
    const repository = mapRepository(s.repository);
    const remotes = mapRemotes(s.remotes);
    const packages = mapPackages(s.packages);
    const { icons, iconUrl } = resolveIcons(s.icons);

    const url = s.websiteUrl || repository?.url || remotes[0]?.url || `/mcp/servers/${slug}`;
    const { installCommand, installKind } = buildInstallCommand({ packages, remotes });

    const server: McpServer = {
        slug,
        name,
        title,
        description,
        version: s.version || '',
        url,
        remotes,
        packages,
        installCommand,
        installKind,
        category: 'other',
        categories: ['other'],
        status: normStatus(meta.status),
        publishedAt: meta.publishedAt || '',
        updatedAt: meta.updatedAt || meta.publishedAt || '',
    };
    if (s.websiteUrl) server.websiteUrl = s.websiteUrl;
    if (repository) server.repository = repository;
    if (icons) server.icons = icons;
    if (iconUrl) server.iconUrl = iconUrl;
    return server;
}

// Keep one entry per name (safety net; registry validated one isLatest per name).
export function dedupeByName<T extends { name: string }>(servers: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const s of servers) {
        if (seen.has(s.name)) continue;
        seen.add(s.name);
        out.push(s);
    }
    return out;
}

// Assign collision-safe slugs; deterministic hash suffix on the rare clash.
export function assignSlugs(servers: McpServer[]): McpServer[] {
    const used = new Set<string>();
    return servers.map((s) => {
        let slug = s.slug || slugify(s.name);
        if (used.has(slug)) {
            let i = 2;
            let candidate = `${slug}-${i}`;
            while (used.has(candidate)) {
                i += 1;
                candidate = `${slug}-${i}`;
            }
            slug = candidate;
        }
        used.add(slug);
        return slug === s.slug ? s : { ...s, slug };
    });
}

// Deterministic stable sort: A–Z by name → minimal diffs.
export function sortStable(servers: McpServer[]): McpServer[] {
    return servers.toSorted((a, b) => a.name.localeCompare(b.name));
}
