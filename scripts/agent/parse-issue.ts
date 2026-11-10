// Parses the "Suggest a new tool" issue body into fields.
// Mirrors the `### Heading` extraction proven in triage-submissions.yml so both stay in sync.

export interface SubmissionFields {
    websiteUrl: string;
    toolName: string;
    description: string;
    category: string;
    pricingModel: string;
}

// First non-empty, non-comment line of a heading block or an inline "Key: value" line.
// Drops HTML comments, then unwraps a Markdown link or <autolink> down to the raw value.
function firstLine(chunk: string | undefined): string {
    return (chunk || '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .split('\n')
        .map((l) => l.trim())
        .find(Boolean) || '';
}

function clean(value: string): string {
    let v = value.trim();
    const link = v.match(/^\[[^\]]*\]\((\S+?)\)$/); // [text](url) -> url
    if (link) v = link[1].trim();
    const auto = v.match(/^<(\S+)>$/); // <url> -> url
    if (auto) v = auto[1].trim();
    return v.trim();
}

// Reads a field written either as a "### Heading" block (issue template) or as an inline
// "Heading: value" line (optionally bold or blockquoted). The template block wins when both
// are present. Returns '' when the field is absent.
export function field(body: string, heading: string): string {
    const capped = (body || '').slice(0, 20000);
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const block = capped.match(new RegExp(`### +${escaped}\\s*([\\s\\S]*?)(?=\\n### |\\n---|$)`, 'i'));
    const inline = capped.match(new RegExp(`^[>\\s]*[*_]{0,2}${escaped}[*_]{0,2}\\s*:\\s*[*_]{0,2}\\s*(.+)$`, 'im'));
    return clean(firstLine(block?.[1]) || firstLine(inline?.[1]));
}

// Fallback for bodies that paste the link in prose instead of a labelled field: the first
// valid https URL, with Markdown/paren wrappers and trailing punctuation stripped and asset
// (image) links skipped. Returns '' when no usable URL is present.
export function findUrl(body: string): string {
    const candidates = (body || '').slice(0, 20000).match(/https?:\/\/[^\s<>()[\]]+/gi) || [];
    for (const raw of candidates) {
        const url = raw.replace(/[.,;:!?'")\]]+$/, '');
        try {
            const u = new URL(url);
            if (u.protocol !== 'https:') continue;
            if (!/[^.]\.[^.]/.test(u.hostname)) continue;
            if (/\.(png|jpe?g|gif|svg|webp|ico|bmp|avif)$/i.test(u.pathname)) continue;
            return url;
        } catch {
            continue;
        }
    }
    return '';
}

export function parseIssue(body: string): SubmissionFields {
    return {
        websiteUrl: field(body, 'Website URL') || findUrl(body),
        toolName: field(body, 'Tool name'),
        description: field(body, 'Description'),
        category: field(body, 'Category'),
        pricingModel: field(body, 'Pricing model'),
    };
}
