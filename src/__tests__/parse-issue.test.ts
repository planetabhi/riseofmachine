import { describe, it, expect } from 'vitest';
import { field, findUrl, parseIssue } from '../../scripts/agent/parse-issue.ts';

// Canonical issue-template body (### Heading blocks).
const TEMPLATE = `## Tool information

### Website URL
<!-- Main URL of the tool -->
https://example-tool.com/

### Tool name
Exampletool

### Description
<!-- example -->
AI-powered audio transcription and subtitle generator.

### Category
audio

### Pricing model
Freemium

---
**Checklist before submitting:**
- [ ] The tool is genuinely AI or ML powered.`;

// Inline "Key: value" body with a Markdown-linked URL, wrapped in --- fences.
const INLINE = `---
Website URL: [https://example-tool.com/](https://example-tool.com/)
Tool name: Exampletool
Description: AI-powered audio transcription and subtitle generator.
Category: audio
Pricing model: Freemium
---`;

describe('parse-issue field()', () => {
    it('reads the canonical ### Heading template (no regression)', () => {
        expect(field(TEMPLATE, 'Website URL')).toBe('https://example-tool.com/');
        expect(field(TEMPLATE, 'Tool name')).toBe('Exampletool');
        expect(field(TEMPLATE, 'Description')).toBe('AI-powered audio transcription and subtitle generator.');
        expect(field(TEMPLATE, 'Category')).toBe('audio');
        expect(field(TEMPLATE, 'Pricing model')).toBe('Freemium');
    });

    it('reads the inline "Key: value" format and unwraps Markdown links', () => {
        expect(field(INLINE, 'Website URL')).toBe('https://example-tool.com/');
        expect(field(INLINE, 'Tool name')).toBe('Exampletool');
        expect(field(INLINE, 'Category')).toBe('audio');
        expect(field(INLINE, 'Pricing model')).toBe('Freemium');
    });

    it('strips HTML comments before reading the value', () => {
        expect(field(TEMPLATE, 'Website URL')).not.toContain('Main URL');
    });

    it('handles bold and blockquoted inline keys', () => {
        expect(field('**Website URL:** https://x.dev/', 'Website URL')).toBe('https://x.dev/');
        expect(field('**Website URL**: https://x.dev/', 'Website URL')).toBe('https://x.dev/');
        expect(field('> Website URL: https://x.dev/', 'Website URL')).toBe('https://x.dev/');
    });

    it('unwraps an <autolink> wrapper', () => {
        expect(field('Website URL: <https://x.dev/>', 'Website URL')).toBe('https://x.dev/');
    });

    it('prefers the ### block when both formats are present', () => {
        const mixed = 'Website URL: https://inline.dev/\n\n### Website URL\nhttps://block.dev/';
        expect(field(mixed, 'Website URL')).toBe('https://block.dev/');
    });

    it('does not match a different heading as a prefix', () => {
        expect(field('Website URL Notes: ignore\nWebsite URL: https://x.dev/', 'Website URL')).toBe('https://x.dev/');
    });

    it('returns empty string for a missing field', () => {
        expect(field('Nothing here', 'Website URL')).toBe('');
        expect(field('', 'Website URL')).toBe('');
    });

    it('escapes regex metacharacters in the heading', () => {
        expect(field('Price ($/mo): 10', 'Price ($/mo)')).toBe('10');
    });
});

describe('parse-issue parseIssue()', () => {
    it('parses every field from the inline format', () => {
        expect(parseIssue(INLINE)).toEqual({
            websiteUrl: 'https://example-tool.com/',
            toolName: 'Exampletool',
            description: 'AI-powered audio transcription and subtitle generator.',
            category: 'audio',
            pricingModel: 'Freemium',
        });
    });

    it('parses every field from the template format', () => {
        expect(parseIssue(TEMPLATE)).toEqual({
            websiteUrl: 'https://example-tool.com/',
            toolName: 'Exampletool',
            description: 'AI-powered audio transcription and subtitle generator.',
            category: 'audio',
            pricingModel: 'Freemium',
        });
    });

    it('falls back to a prose URL when the Website URL field is absent', () => {
        const prose = `Exampletool is an AI-native platform for shared business context.

[https://example-tool.com/](https://example-tool.com/)`;
        expect(parseIssue(prose).websiteUrl).toBe('https://example-tool.com/');
    });

    it('prefers the labelled Website URL over any prose URL', () => {
        const mixed = 'See https://other.dev/ for context.\n\n### Website URL\nhttps://labelled.dev/';
        expect(parseIssue(mixed).websiteUrl).toBe('https://labelled.dev/');
    });
});

describe('parse-issue findUrl()', () => {
    it('extracts a bare https URL from prose', () => {
        expect(findUrl('Check out https://example.com/ today.')).toBe('https://example.com/');
    });

    it('unwraps a Markdown-linked URL and strips the closing paren', () => {
        expect(findUrl('[https://example.com/](https://example.com/)')).toBe('https://example.com/');
    });

    it('returns the first usable URL when several are present', () => {
        expect(findUrl('https://first.dev/ and https://second.dev/')).toBe('https://first.dev/');
    });

    it('skips image/asset links', () => {
        expect(findUrl('![logo](https://cdn.example.com/logo.png) then https://example.com/')).toBe('https://example.com/');
    });

    it('ignores non-https and host-less URLs', () => {
        expect(findUrl('http://insecure.dev/ and https://localhost/')).toBe('');
    });

    it('strips trailing sentence punctuation', () => {
        expect(findUrl('Visit https://example.com/.')).toBe('https://example.com/');
    });

    it('returns empty string when no URL is present', () => {
        expect(findUrl('No links here at all.')).toBe('');
        expect(findUrl('')).toBe('');
    });
});
