// MCP (Model Context Protocol) server data model.
// Full registry fidelity + build-time derived category. See plans/mcp-servers-vertical.md §5.3.

export type McpTransport = 'stdio' | 'streamable-http' | 'sse';
export type McpRegistryType = 'npm' | 'pypi' | 'oci' | 'nuget' | 'mcpb';
export type McpStatus = 'active' | 'deprecated';
export type McpInstallKind = 'package' | 'remote' | 'none';

export interface McpKeyValue {
    name: string;
    description?: string;
    required?: boolean;
}

export interface McpRemote {
    type: McpTransport;
    url: string;
    headers?: McpKeyValue[];
}

export interface McpPackage {
    registryType: McpRegistryType;
    identifier: string;
    version?: string;
    transport: McpTransport;
    runtimeHint?: string;
    environmentVariables?: McpKeyValue[]; // names only — never values
    packageArguments?: string[];
    runtimeArguments?: string[];
    registryBaseUrl?: string;
}

export interface McpRepository {
    url: string;
    source?: string;
    id?: string;
}

export interface McpServer {
    slug: string;
    name: string;
    title: string;
    description: string;
    version: string;
    url: string;
    websiteUrl?: string;
    repository?: McpRepository;
    remotes: McpRemote[];
    packages: McpPackage[];
    icons?: string[]; // raw external icon URLs from the registry
    iconUrl?: string; // resolved first safe (HTTPS, valid host) icon, else undefined
    installCommand: string; // primary CTA — precomputed copyable command (§5.8)
    installKind: McpInstallKind; // drives CTA label/behavior
    category: string; // primary derived category slug (drives the sidebar)
    categories: string[]; // all matched categories (secondary tags / filtering)
    status: McpStatus;
    publishedAt: string;
    updatedAt: string;
}

export interface McpData {
    generatedAt: string;
    servers: McpServer[];
    meta: {
        fromCache: boolean;
        count: number;
        complete: boolean;
        otherRatio: number;
    };
}

// Same shape the sidebar already consumes for tool categories.
export interface McpCategoryIndexEntry {
    title: string;
    count: number;
}
export type McpCategoryIndex = Record<string, McpCategoryIndexEntry>;
