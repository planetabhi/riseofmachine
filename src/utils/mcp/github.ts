// Pure GitHub repository-URL helpers used by the offline quality gate (§13) to
// require a GitHub-hosted source. No network, no tokens.

export interface GitHubRepo {
    owner: string;
    repo: string;
}

// Parse a repository URL into {owner, repo}. Returns null for non-GitHub or
// malformed URLs. Strips a trailing `.git` and ignores deep paths/tree refs.
export function parseGitHubRepo(url: string | undefined): GitHubRepo | null {
    if (!url) return null;
    try {
        const u = new URL(url);
        if (!/(^|\.)github\.com$/i.test(u.hostname)) return null;
        const segs = u.pathname.split('/').filter(Boolean);
        if (segs.length < 2) return null;
        const owner = segs[0]!;
        const repo = segs[1]!.replace(/\.git$/i, '');
        if (!owner || !repo) return null;
        return { owner, repo };
    } catch {
        return null;
    }
}

// Canonical cache key: case-insensitive "owner/repo".
export function repoKey(repo: GitHubRepo): string {
    return `${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`;
}
