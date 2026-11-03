// Orchestrator: issue body -> fetch -> judge -> enrich -> apply. Emits a decision for the
// workflow to act on (open PR, or comment + label + close). Does no git/GitHub API work itself.

import fs from 'fs';
import crypto from 'crypto';
import { parseIssue } from './parse-issue.ts';
import type { SubmissionFields } from './parse-issue.ts';
import { fetchSite } from './fetch-site.ts';
import { judgeIsAI } from './judge.ts';
import { enrich } from './enrich.ts';
import { applyTool } from './apply.ts';

type Decision = 'pr' | 'reject';
type RejectLabel = 'needs-changes' | 'rejected' | 'not-ai' | 'duplicate';
type Label = RejectLabel | 'needs-review';

interface Result {
    decision: Decision;
    label: Label;
    reason: string;
    slug?: string;
    branch?: string;
    title?: string;
    category?: string;
    tag?: string;
    body?: string;
    finalUrl?: string;
    confidence?: number;
}

function setOutputs(result: Result): void {
    fs.writeFileSync('agent-result.json', JSON.stringify(result, null, 2) + '\n');

    const out = process.env.GITHUB_OUTPUT;
    if (!out) return;
    const lines: string[] = [];
    for (const [key, value] of Object.entries(result)) {
        if (value === undefined) continue;
        const str = String(value);
        if (str.includes('\n')) {
            const delim = `EOF_${crypto.randomBytes(8).toString('hex')}`;
            lines.push(`${key}<<${delim}`, str, delim);
        } else {
            lines.push(`${key}=${str}`);
        }
    }
    fs.appendFileSync(out, lines.join('\n') + '\n');
}

function reject(label: RejectLabel, reason: string): Result {
    return { decision: 'reject', label, reason };
}

// The pipeline, as an explicit linear sequence: each stage either short-circuits
// with a reject, or narrows the data the next stage needs.
async function run(fields: SubmissionFields): Promise<Result> {
    if (!fields.websiteUrl) {
        return reject('needs-changes', 'No Website URL found in the submission.');
    }

    const site = await fetchSite(fields.websiteUrl);
    if (!site.ok) {
        return reject('rejected', site.reason || 'Site could not be verified.');
    }

    const { accepted, judgement, reason } = await judgeIsAI(site);
    if (!accepted) {
        return reject('not-ai', reason);
    }

    const enriched = await enrich(site, fields);
    if (!enriched.ok) {
        return reject('needs-changes', enriched.reason || 'Could not generate listing.');
    }

    const applied = applyTool(enriched.listing, site.finalUrl);
    if (!applied.ok) {
        return reject(applied.duplicate ? 'duplicate' : 'needs-changes', applied.reason || 'Failed to apply entry.');
    }

    return {
        decision: 'pr',
        label: 'needs-review',
        reason: judgement.reason,
        slug: applied.slug,
        branch: `add-tool/${applied.slug}`,
        title: enriched.listing.title,
        category: enriched.listing.category,
        tag: enriched.listing.tag,
        body: enriched.listing.body,
        finalUrl: applied.finalUrl,
        confidence: judgement.confidence,
    };
}

async function main(): Promise<void> {
    // workflow_dispatch passes a URL directly; issues pass the full body.
    const dispatchUrl = process.env.INPUT_URL?.trim();
    const fields: SubmissionFields = dispatchUrl
        ? { websiteUrl: dispatchUrl, toolName: '', description: '', category: '', pricingModel: '' }
        : parseIssue(process.env.ISSUE_BODY || '');

    const result = await run(fields);
    setOutputs(result);
    console.log(`Decision: ${result.decision} (${result.label}) — ${result.reason}`);
}

main().catch((err) => {
    const result: Result = {
        decision: 'reject',
        label: 'needs-changes',
        reason: `Agent error: ${err?.message || String(err)}`,
    };
    setOutputs(result);
    console.error(err);
    process.exit(0); // Exit 0 so the workflow can still comment the failure.
});
