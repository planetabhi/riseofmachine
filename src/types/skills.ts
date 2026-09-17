// Skills vertical data model. Mirrors the MCP vertical but text-first: skills
// have no icons, versions, or dates. Metadata comes from each repo's SKILL.md
// frontmatter (via the `skills` CLI); topic membership comes from skills.sh.
// See plans/skills-vertical.md.

export interface Skill {
    slug: string; // "vercel-react-best-practices" (last URL segment)
    source: string; // "vercel-labs/agent-skills" (owner/repo)
    description: string;
    url: string; // https://www.skills.sh/{source}/{slug}
    installCommand: string; // "npx skills add https://github.com/{source} --skill {slug}"
    categories: string[]; // all topics the skill appears in; categories[0] is primary
}

export interface SkillsData {
    generatedAt: string;
    skills: Skill[];
}

// Same shape the sidebar already consumes for tool + MCP categories.
export interface SkillsCategoryIndexEntry {
    title: string;
    count: number;
}
export type SkillsCategoryIndex = Record<string, SkillsCategoryIndexEntry>;
