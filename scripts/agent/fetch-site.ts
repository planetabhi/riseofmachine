// Fetches a submitted URL and deterministically verifies it is live and real.
// No LLM here — only network + HTML heuristics. The AI/ML judgement happens in judge.ts.

import { parse } from 'node-html-parser';
import { lookup } from 'node:dns/promises';

const TIMEOUT_MS = 10000;
const MAX_BYTES = 500_000;
const MAX_REDIRECTS = 5;
const USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const PARKED_MARKERS = [
    'domain is for sale',
    'buy this domain',
    'parked by',
    'domain parking',
    'this domain is for sale',
    'godaddy.com/domainsearch',
    'hugedomains.com',
    'sedoparking.com',
];

export interface SiteOk {
    ok: true;
    finalUrl: string;
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
    textSample: string;
}

export type SiteResult = SiteOk | { ok: false; reason: string };

function fail(reason: string): SiteResult {
    return { ok: false, reason };
}

// Returns true if a resolved IP (IPv4, IPv6, or IPv4-mapped IPv6) is loopback, link-local,
// cloud-metadata, or an RFC 1918 / CGNAT private range.
function isBlockedAddress(ip: string): boolean {
    const addr = ip.toLowerCase();
    const mapped = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    const v4 = (mapped ? mapped[1] : addr).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (v4) {
        const [a, b] = [Number(v4[1]), Number(v4[2])];
        if (a === 0 || a === 10 || a === 127) return true;          // this-net, private, loopback
        if (a === 169 && b === 254) return true;                    // link-local + cloud metadata
        if (a === 172 && b >= 16 && b <= 31) return true;           // private
        if (a === 192 && b === 168) return true;                    // private
        if (a === 100 && b >= 64 && b <= 127) return true;          // CGNAT
        return false;
    }
    // Real IPv6 literal: loopback (::1), unspecified (::), link-local (fe80::/10), ULA (fc00::/7).
    if (addr === '::1' || addr === '::') return true;
    if (addr.startsWith('fe80:') || addr.startsWith('fc') || addr.startsWith('fd')) return true;
    return false;
}

// Blocks SSRF by hostname: internal names and IP literals in private/internal ranges. The triage
// gate only checks "https + dotted host", so IP literals like 169.254.169.254 would otherwise pass.
function isBlockedHost(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.localhost')) return true;
    if (host === 'metadata' || host === 'metadata.google.internal') return true;
    // Only evaluate as an address when the host is an IP literal; plain domains such as
    // "fcbarcelona.com" must fall through to DNS resolution instead of matching here.
    if (host.includes(':') || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
        return isBlockedAddress(host);
    }
    return false;
}

// Full SSRF check for one hop: reject blocked literals, then resolve the name and reject if any
// A/AAAA record is private/internal (DNS-based SSRF). Returns a failure reason, or null if allowed.
async function hostBlockReason(hostname: string): Promise<string | null> {
    if (isBlockedHost(hostname)) return 'URL points to a private or internal host.';
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        // Bound the lookup so a slow resolver cannot outlast the request timeout or delay retries.
        const deadline = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('dns-timeout')), TIMEOUT_MS);
        });
        const addrs = await Promise.race([lookup(hostname, { all: true }), deadline]);
        if (addrs.some((a) => isBlockedAddress(a.address))) {
            return 'URL resolves to a private or internal address.';
        }
    } catch {
        return 'Could not resolve the site host.';
    } finally {
        clearTimeout(timer);
    }
    return null;
}

export async function fetchSite(url: string): Promise<SiteResult> {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return fail('Submitted URL is not a valid URL.');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return fail('URL must use http or https.');
    }

    const attempt = async (): Promise<SiteResult> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            // Follow redirects manually so every hop's host is validated (literal + DNS) before it
            // is requested, blocking a public URL from redirecting into an internal one.
            let current = new URL(parsed.toString());
            let response: Response;
            for (let hop = 0; ; hop++) {
                if (current.protocol !== 'https:' && current.protocol !== 'http:') {
                    return fail('URL must use http or https.');
                }
                const blocked = await hostBlockReason(current.hostname);
                if (blocked) return fail(blocked);

                response = await fetch(current.toString(), {
                    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
                    redirect: 'manual',
                    signal: controller.signal,
                });

                if ([301, 302, 303, 307, 308].includes(response.status)) {
                    const location = response.headers.get('location');
                    if (!location) return fail(`Site returned HTTP ${response.status} without a redirect target.`);
                    if (hop >= MAX_REDIRECTS) return fail('Too many redirects.');
                    current = new URL(location, current);
                    continue;
                }
                break;
            }

            if (!response.ok) {
                return fail(`Site returned HTTP ${response.status}.`);
            }

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('text/html')) {
                return fail(`Expected an HTML page but got "${contentType || 'unknown'}".`);
            }

            const raw = await response.text();
            const html = raw.slice(0, MAX_BYTES);
            const lower = html.toLowerCase();

            if (PARKED_MARKERS.some((m) => lower.includes(m))) {
                return fail('Domain looks parked or for sale, not a live product.');
            }

            const root = parse(html);
            const title = root.querySelector('title')?.text?.trim() || '';
            const ogTitle =
                root.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || '';
            const description =
                root.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
            const ogDescription =
                root.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() || '';

            root.querySelectorAll('script, style, noscript, svg').forEach((n) => n.remove());
            const visibleText = root.querySelector('body')?.text?.replace(/\s+/g, ' ').trim() || '';

            if (!title && !ogTitle && visibleText.length < 50) {
                return fail('Page has almost no readable content.');
            }

            return {
                ok: true,
                finalUrl: current.toString(),
                title,
                description,
                ogTitle,
                ogDescription,
                textSample: visibleText.slice(0, 4000),
            };
        } finally {
            clearTimeout(timeoutId);
        }
    };

    try {
        return await attempt();
    } catch (err: any) {
        // One retry for transient network/abort failures.
        try {
            return await attempt();
        } catch (err2: any) {
            const msg = err2?.name === 'AbortError' ? 'Request timed out.' : (err2?.message || 'Network error.');
            return fail(`Could not reach the site: ${msg}`);
        }
    }
}
