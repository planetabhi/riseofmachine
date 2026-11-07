import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface SafeHttpResponse {
    status: number;
    headers: IncomingHttpHeaders;
    body: Buffer;
}

interface SafeHttpOptions {
    method: 'GET' | 'HEAD';
    timeoutMs: number;
    maxBytes: number;
    maxRedirects?: number;
    headers?: Record<string, string>;
}

function isPublicAddress(address: string): boolean {
    const family = isIP(address);
    if (family === 4) {
        const [a, b, c] = address.split('.').map(Number);
        if (a === 0 || a === 10 || a === 127 || a! >= 224) return false;
        if (a === 100 && b! >= 64 && b! <= 127) return false;
        if (a === 169 && b === 254) return false;
        if (a === 172 && b! >= 16 && b! <= 31) return false;
        if (a === 192 && (b === 0 || (b === 88 && c === 99) || b === 168)) return false;
        if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
        if (a === 203 && b === 0 && c === 113) return false;
        return true;
    }
    if (family !== 6) return false;

    const normalized = address.toLowerCase().replace(/(\d+\.\d+\.\d+\.\d+)$/, (ipv4) => {
        const octets = ipv4.split('.').map(Number);
        return `${((octets[0]! << 8) | octets[1]!).toString(16)}:${((octets[2]! << 8) | octets[3]!).toString(16)}`;
    });
    const halves = normalized.split('::');
    const left = halves[0] ? halves[0]!.split(':') : [];
    const right = halves[1] ? halves[1]!.split(':') : [];
    const groups = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
    const value = groups.reduce((result, group) => (result << 16n) | BigInt(`0x${group || '0'}`), 0n);

    return value >> 125n === 1n && value >> 105n !== 0x100080n && value >> 96n !== 0x20010db8n && value >> 112n !== 0x2002n;
}

function errorWithCode(code: string, message: string): Error {
    return Object.assign(new Error(message), { code });
}

async function resolvePublicAddress(hostname: string, timeoutMs: number): Promise<LookupAddress> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const deadline = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(errorWithCode('ETIMEDOUT', 'DNS lookup timed out')), timeoutMs);
        });
        const addresses = await Promise.race([
            lookup(hostname.replace(/^\[|\]$/g, ''), { all: true, verbatim: true }),
            deadline,
        ]);
        if (addresses.length === 0) throw errorWithCode('ENOTFOUND', 'Host did not resolve');
        if (addresses.some(({ address }) => !isPublicAddress(address))) {
            throw errorWithCode('EPRIVATE', 'Host resolves to a non-public address');
        }
        return addresses[0]!;
    } finally {
        clearTimeout(timer);
    }
}

function requestOnce(
    url: URL,
    address: LookupAddress,
    options: SafeHttpOptions,
): Promise<SafeHttpResponse> {
    return new Promise((resolve, reject) => {
        const pinnedLookup = (_hostname: string, lookupOptions: any, callback: any) => {
            if (lookupOptions?.all) callback(null, [address]);
            else callback(null, address.address, address.family);
        };
        const requestOptions = {
            method: options.method,
            headers: options.headers,
            agent: false,
            lookup: pinnedLookup,
        };
        const req = url.protocol === 'https:'
            ? httpsRequest(url, requestOptions)
            : httpRequest(url, requestOptions);
        let settled = false;
        const timer = setTimeout(() => req.destroy(errorWithCode('ETIMEDOUT', 'HTTP request timed out')), options.timeoutMs);
        const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(error);
        };
        const finish = (response: SafeHttpResponse) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(response);
        };

        req.once('error', fail);
        req.once('response', (res) => {
            const status = res.statusCode ?? 0;
            const chunks: Buffer[] = [];
            let size = 0;
            const finishResponse = () => {
                res.destroy();
                finish({ status, headers: res.headers, body: Buffer.concat(chunks) });
            };

            if (REDIRECT_STATUSES.has(status) || options.maxBytes <= 0) {
                finishResponse();
                return;
            }
            res.on('data', (chunk: Buffer | string) => {
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                const remaining = options.maxBytes - size;
                if (remaining > 0) {
                    const accepted = buffer.subarray(0, remaining);
                    chunks.push(accepted);
                    size += accepted.length;
                }
                if (size >= options.maxBytes) finishResponse();
            });
            res.once('end', finishResponse);
            res.once('error', fail);
        });
        req.end();
    });
}

export async function safeHttpRequest(url: string, options: SafeHttpOptions): Promise<SafeHttpResponse> {
    let current: URL;
    try {
        current = new URL(url);
    } catch {
        throw errorWithCode('EINVAL', 'Invalid URL');
    }
    const maxRedirects = options.maxRedirects ?? 0;

    for (let redirects = 0; ; redirects++) {
        if ((current.protocol !== 'http:' && current.protocol !== 'https:') || current.username || current.password) {
            throw errorWithCode('EINVAL', 'Only credential-free HTTP(S) URLs are allowed');
        }
        const address = await resolvePublicAddress(current.hostname, options.timeoutMs);
        const response = await requestOnce(current, address, options);
        if (!REDIRECT_STATUSES.has(response.status) || redirects >= maxRedirects) return response;

        const location = response.headers.location;
        if (typeof location !== 'string') return response;
        try {
            current = new URL(location, current);
        } catch {
            throw errorWithCode('EINVAL', 'Invalid redirect URL');
        }
    }
}
