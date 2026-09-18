// Skills classification taxonomy. Slugs are aligned to the skills.sh topic
// slugs so classifier-assigned categories never fragment from scraped ones.
// Used by the offline crawl (to categorize seed-repo skills) and by the
// category-index generator (for canonical titles).
export interface SkillCategoryRule {
    slug: string;
    title: string;
    keywords: string[]; // single tokens or multi-word phrases (ordered subsequence)
}

export const SKILLS_TAXONOMY: SkillCategoryRule[] = [
    {
        slug: 'agent-workflows',
        title: 'Agent workflows',
        keywords: [
            'agent',
            'agentic',
            'workflow',
            'orchestration',
            'automation',
            'prompt',
            'planning',
            'pipeline',
            'reasoning',
            'mcp',
            'tool use',
            'task',
        ],
    },
    {
        slug: 'databases',
        title: 'Databases',
        keywords: [
            'database',
            'sql',
            'postgres',
            'postgresql',
            'mysql',
            'sqlite',
            'mongodb',
            'redis',
            'prisma',
            'drizzle',
            'orm',
            'query',
            'schema',
            'migration',
            'supabase',
        ],
    },
    {
        slug: 'design',
        title: 'Design',
        keywords: [
            'design',
            'ui',
            'ux',
            'figma',
            'css',
            'tailwind',
            'styling',
            'layout',
            'typography',
            'color',
            'animation',
            'accessibility',
        ],
    },
    {
        slug: 'marketing',
        title: 'Marketing',
        keywords: [
            'marketing',
            'seo',
            'ad',
            'ads',
            'copywriting',
            'campaign',
            'growth',
            'email',
            'social',
            'landing page',
            'conversion',
            'analytics',
        ],
    },
    {
        slug: 'react',
        title: 'React',
        keywords: ['react', 'hook', 'hooks', 'jsx', 'redux', 'context'],
    },
    {
        slug: 'nextjs',
        title: 'Next.js',
        keywords: ['nextjs', 'next js', 'vercel', 'ssr', 'ssg', 'app router', 'server component', 'routing'],
    },
    {
        slug: 'testing',
        title: 'Testing',
        keywords: ['test', 'testing', 'vitest', 'jest', 'playwright', 'cypress', 'unit test', 'e2e', 'coverage', 'mock'],
    },
    {
        slug: 'mobile',
        title: 'Mobile',
        keywords: ['mobile', 'ios', 'android', 'react native', 'expo', 'swift', 'kotlin', 'flutter'],
    },
];

// Slug -> title, for generators that want canonical titles over a humanized slug.
export const SKILLS_CATEGORY_TITLES: Record<string, string> = Object.fromEntries(
    SKILLS_TAXONOMY.map((r) => [r.slug, r.title]),
);

// Fallback when the classifier finds nothing and a seed declares no categories.
export const DEFAULT_SKILL_CATEGORY = 'agent-workflows';
