// Deterministic, config-driven taxonomy for the MCP vertical (§6.2).
// The registry ships no categories; these curated rules derive them offline.
// Adding categories/keywords never touches classifier logic — data only.

export interface CategoryRule {
    slug: string; // e.g. "databases"
    title: string; // e.g. "Databases"
    priority: number; // deterministic tiebreak (lower wins)
    owners?: string[]; // strong: org/owner tokens (supabase, mongodb, stripe)
    packages?: string[]; // strong: package-name tokens (pg, psycopg, prisma)
    keywords?: string[]; // topical terms, word-boundary matched
}

// Ordered list of curated categories. `other` is always last (catch-all).
export const TAXONOMY: CategoryRule[] = [
    {
        slug: 'databases',
        title: 'Databases',
        priority: 10,
        owners: ['supabase', 'mongodb', 'postgres', 'postgresql', 'neon', 'planetscale', 'redis', 'cockroachdb', 'clickhouse', 'snowflake'],
        packages: ['pg', 'psycopg', 'prisma', 'sqlalchemy', 'mongoose', 'knex', 'drizzle'],
        keywords: ['database', 'sql', 'postgres', 'mysql', 'mongodb', 'sqlite', 'query', 'schema', 'nosql'],
    },
    {
        slug: 'dev-tools',
        title: 'Dev Tools',
        priority: 20,
        owners: ['github', 'gitlab', 'jetbrains', 'bitbucket', 'sentry'],
        packages: ['eslint', 'prettier', 'webpack', 'vite'],
        keywords: ['git', 'ci', 'cd', 'lint', 'ide', 'debugger', 'compiler', 'repository', 'codebase', 'pull request'],
    },
    {
        slug: 'cloud-devops',
        title: 'Cloud & DevOps',
        priority: 30,
        owners: ['aws', 'gcp', 'azure', 'cloudflare', 'vercel', 'kubernetes', 'netlify', 'digitalocean', 'heroku', 'terraform'],
        keywords: ['deploy', 'kubernetes', 'docker', 'serverless', 'infrastructure', 'container', 'cloud', 'devops', 'provisioning'],
    },
    {
        slug: 'ai-llm',
        title: 'AI & LLM',
        priority: 40,
        owners: ['openai', 'anthropic', 'huggingface', 'cohere', 'mistral', 'replicate', 'ollama'],
        keywords: ['llm', 'embedding', 'rag', 'agent', 'prompt', 'model', 'inference', 'chatbot', 'completion', 'fine-tune'],
    },
    {
        slug: 'search',
        title: 'Search',
        priority: 50,
        owners: ['elastic', 'elasticsearch', 'algolia', 'meilisearch', 'typesense', 'pinecone', 'weaviate', 'qdrant'],
        keywords: ['search', 'index', 'retrieval', 'vector', 'semantic', 'ranking'],
    },
    {
        slug: 'payments-finance',
        title: 'Payments & Finance',
        priority: 60,
        owners: ['stripe', 'plaid', 'paypal', 'square', 'coinbase', 'wise', 'adyen'],
        keywords: ['payment', 'invoice', 'billing', 'ledger', 'finance', 'accounting', 'transaction', 'checkout', 'subscription'],
    },
    {
        slug: 'communication',
        title: 'Communication',
        priority: 70,
        owners: ['slack', 'discord', 'twilio', 'telegram', 'sendgrid', 'mailgun', 'zoom', 'intercom'],
        keywords: ['chat', 'email', 'sms', 'notification', 'messaging', 'inbox', 'webhook'],
    },
    {
        slug: 'crm-sales',
        title: 'CRM & Sales',
        priority: 80,
        owners: ['salesforce', 'hubspot', 'pipedrive', 'zendesk', 'zoho'],
        keywords: ['crm', 'sales', 'lead', 'pipeline', 'contact', 'deal', 'customer'],
    },
    {
        slug: 'productivity',
        title: 'Productivity',
        priority: 90,
        owners: ['notion', 'asana', 'trello', 'jira', 'linear', 'clickup', 'todoist', 'monday'],
        keywords: ['task', 'todo', 'calendar', 'note', 'workspace', 'project management', 'kanban', 'scheduling'],
    },
    {
        slug: 'data-analytics',
        title: 'Data & Analytics',
        priority: 100,
        owners: ['databricks', 'dbt', 'segment', 'amplitude', 'mixpanel', 'looker', 'tableau', 'bigquery'],
        keywords: ['analytics', 'metrics', 'dashboard', 'etl', 'pipeline', 'warehouse', 'reporting', 'telemetry'],
    },
    {
        slug: 'monitoring',
        title: 'Monitoring',
        priority: 110,
        owners: ['datadog', 'grafana', 'prometheus', 'newrelic', 'pagerduty', 'splunk'],
        keywords: ['monitoring', 'observability', 'logging', 'alerting', 'tracing', 'uptime', 'incident'],
    },
    {
        slug: 'security',
        title: 'Security',
        priority: 120,
        owners: ['okta', 'auth0', 'snyk', 'vault', '1password', 'cloudflare'],
        keywords: ['security', 'auth', 'oauth', 'encryption', 'vulnerability', 'secret', 'firewall', 'compliance', 'identity'],
    },
    {
        slug: 'storage',
        title: 'Storage',
        priority: 130,
        owners: ['s3', 'minio', 'dropbox', 'box', 'backblaze'],
        keywords: ['storage', 'file', 'bucket', 'blob', 'upload', 'filesystem', 'object storage'],
    },
    {
        slug: 'ecommerce',
        title: 'E-commerce',
        priority: 140,
        owners: ['shopify', 'woocommerce', 'bigcommerce', 'magento', 'etsy'],
        keywords: ['ecommerce', 'shop', 'store', 'product', 'cart', 'order', 'inventory', 'catalog'],
    },
    {
        slug: 'marketing',
        title: 'Marketing',
        priority: 150,
        owners: ['mailchimp', 'klaviyo', 'marketo', 'buffer', 'hootsuite'],
        keywords: ['marketing', 'campaign', 'newsletter', 'seo', 'ads', 'audience', 'social media'],
    },
    {
        slug: 'design',
        title: 'Design',
        priority: 160,
        owners: ['figma', 'canva', 'sketch', 'framer', 'adobe'],
        keywords: ['design', 'ui', 'ux', 'prototype', 'wireframe', 'mockup', 'illustration'],
    },
    {
        slug: 'maps-location',
        title: 'Maps & Location',
        priority: 170,
        owners: ['mapbox', 'googlemaps', 'here', 'openstreetmap'],
        keywords: ['map', 'location', 'geocoding', 'geospatial', 'coordinates', 'routing', 'places'],
    },
    {
        slug: 'media',
        title: 'Media',
        priority: 180,
        owners: ['youtube', 'spotify', 'cloudinary', 'mux', 'vimeo', 'unsplash'],
        keywords: ['image', 'video', 'audio', 'media', 'transcription', 'streaming', 'photo', 'thumbnail'],
    },
    {
        slug: 'web-scraping',
        title: 'Web Scraping',
        priority: 190,
        owners: ['firecrawl', 'apify', 'brightdata', 'scrapingbee', 'browserbase'],
        keywords: ['scraping', 'crawler', 'browser', 'puppeteer', 'playwright', 'extract', 'headless', 'spider'],
    },
    {
        slug: 'automation',
        title: 'Automation',
        priority: 200,
        owners: ['zapier', 'make', 'n8n', 'ifttt', 'temporal'],
        keywords: ['automation', 'workflow', 'trigger', 'integration', 'orchestration', 'pipeline'],
    },
    {
        slug: 'docs-knowledge',
        title: 'Docs & Knowledge',
        priority: 210,
        owners: ['confluence', 'gitbook', 'readme', 'mintlify', 'obsidian'],
        keywords: ['documentation', 'docs', 'knowledge', 'wiki', 'markdown', 'reference', 'guide'],
    },
    { slug: 'other', title: 'Other', priority: 999 }, // catch-all, always last
];
