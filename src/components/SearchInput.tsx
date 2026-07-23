import { useState, useEffect, useRef } from 'react';
import { BorderBeam } from 'border-beam';
import { useReducedMotion } from '../utils/useReducedMotion';
import './SearchInput.css';

interface SearchInputProps {
    placeholder?: string;
}

const QUERY_PARAM = 'q';

function readQueryFromUrl(): string {
    if (typeof window === 'undefined') return '';
    try {
        return new URLSearchParams(window.location.search).get(QUERY_PARAM) || '';
    } catch {
        return '';
    }
}

function writeQueryToUrl(value: string) {
    if (typeof window === 'undefined') return;
    try {
        const url = new URL(window.location.href);
        if (value) url.searchParams.set(QUERY_PARAM, value);
        else url.searchParams.delete(QUERY_PARAM);
        const next = url.pathname + (url.search ? url.search : '') + url.hash;
        window.history.replaceState(null, '', next);
    } catch {}
}

function bezier(str: string): (t: number) => number {
    const m = String(str).match(/cubic-bezier\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)/);
    if (!m) return (t) => t;
    const [x1, y1, x2, y2] = m.slice(1).map(parseFloat);
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return (t) => {
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        let s = t;
        for (let i = 0; i < 8; i++) {
            const dx = ((ax * s + bx) * s + cx) * s - t;
            const d = (3 * ax * s + 2 * bx) * s + cx;
            if (Math.abs(dx) < 1e-6 || d === 0) break;
            s -= dx / d;
        }
        return ((ay * s + by) * s + cy) * s;
    };
}

function buildGlow(text: string, input: HTMLInputElement, width: number, spread: number): string {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return '';
    ctx.font = getComputedStyle(input).font;
    const padLeft = parseFloat(getComputedStyle(input).paddingLeft) || 12;
    const layers: string[] = [];
    let x = 0;
    text.split(/(\s+)/).forEach((seg) => {
        const segW = ctx.measureText(seg).width;
        if (seg.trim()) {
            const cx = padLeft + x + segW / 2;
            const hw = Math.max(segW * 0.45, 8) * spread;
            ([[0, 0.8, 7, 0.22], [hw * 0.45, 0.55, 8, 0.18],
              [-hw * 0.4, 0.65, 6, 0.16], [hw * 0.15, 0.9, 5, 0.14]] as const)
                .forEach(([dx, rwm, rh, a]) => {
                    const lx = (((cx + dx) / width) * 100).toFixed(2);
                    layers.push(
                        `radial-gradient(ellipse ${Math.max(hw * rwm, 2).toFixed(1)}px ${rh}px at ${lx}% 100%, rgba(255,255,255,${a}), transparent)`
                    );
                });
        }
        x += segW;
    });
    return layers.join(', ');
}

export default function SearchInput({
    placeholder = "Search by name, category, or feature...",
}: SearchInputProps) {
    // Initialize empty so SSR HTML matches client first render
    // (avoids React 19 hydration mismatch). URL value is applied right
    // after hydration in the effect below.
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);
    const clearingRef = useRef(false);
    const [focused, setFocused] = useState(false);
    const reduced = useReducedMotion();

    useEffect(() => {
        const syncFromUrl = () => setQuery(readQueryFromUrl());
        // Apply URL value immediately after hydration so direct deep-link
        // loads (e.g. /?q=foo) display the right input value on first paint.
        syncFromUrl();

        // Keep input value in sync with URL across Astro view-transition
        // navigations and browser back/forward.
        document.addEventListener('astro:page-load', syncFromUrl);
        window.addEventListener('popstate', syncFromUrl);

        return () => {
            document.removeEventListener('astro:page-load', syncFromUrl);
            window.removeEventListener('popstate', syncFromUrl);
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
            if (e.key === 'Escape' && document.activeElement === inputRef.current) {
                inputRef.current?.blur();
                if (query) {
                    setQuery('');
                    dispatchSearch('');
                    runClearAnimation(query);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [query]);

    const dispatchSearch = (value: string) => {
        writeQueryToUrl(value);
        window.dispatchEvent(new CustomEvent('tools:search', {
            detail: { query: value }
        }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            dispatchSearch(value);
        }, 300);
    };

    const handleClear = () => {
        const previous = query;
        setQuery('');
        dispatchSearch('');
        inputRef.current?.focus();
        runClearAnimation(previous);
    };

    const runClearAnimation = (text: string) => {
        if (!text) return;
        const wrap = wrapperRef.current;
        const mirror = mirrorRef.current;
        const glow = glowRef.current;
        const input = inputRef.current;
        if (!wrap || !mirror || !glow || !input) return;
        if (clearingRef.current) return;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
        clearingRef.current = true;

        const root = document.documentElement;
        const num = (name: string, fb: number) => {
            const v = parseFloat(getComputedStyle(root).getPropertyValue(name));
            return Number.isFinite(v) ? v : fb;
        };

        mirror.textContent = text.replace(/ /g, '\u00a0');
        const total = num('--clear-dur', 1000);
        const outDur = num('--clear-out-dur', 400);
        const outFly = num('--clear-out-fly', 12);
        const blur = num('--clear-blur', 2);
        const delay = num('--glow-delay', 50);
        const peakAt = num('--glow-peak-at', 0.15);
        const gOp = num('--glow-opacity', 0.42);
        const spread = num('--glow-spread', 1.5);
        const easeOut = bezier(getComputedStyle(root).getPropertyValue('--clear-out-ease'));

        wrap.classList.add('is-clearing');
        glow.style.background = buildGlow(text, input, wrap.clientWidth || 280, spread);
        glow.style.opacity = '0';

        const t0 = performance.now();
        const tick = (now: number) => {
            const el = now - t0;
            const eo = easeOut(Math.min(1, el / outDur));
            mirror.style.transform = `translateY(${(eo * outFly).toFixed(1)}px)`;
            mirror.style.opacity = (1 - eo).toFixed(3);
            mirror.style.filter = `blur(${(eo * blur).toFixed(1)}px)`;

            let g = 0;
            if (el > delay) {
                const gp = Math.min(1, (el - delay) / Math.max(1, total - delay));
                g = gp < peakAt ? gp / peakAt : 1 - (gp - peakAt) / (1 - peakAt);
            }
            glow.style.opacity = (g * gOp).toFixed(3);

            if (el < total) {
                requestAnimationFrame(tick);
            } else {
                wrap.classList.remove('is-clearing');
                mirror.style.cssText = '';
                mirror.textContent = '';
                glow.style.opacity = '0';
                glow.style.background = '';
                clearingRef.current = false;
            }
        };
        requestAnimationFrame(tick);
    };

    return (
        <div className="search-container">
            <BorderBeam
                size="md"
                colorVariant={focused ? 'colorful' : 'mono'}
                theme="dark"
                strength={0.7}
                active={!reduced}
                style={{ display: 'block', width: '100%', maxWidth: '24rem' }}
            >
                <div className="search-input-wrapper t-clear" ref={wrapperRef}>
                    <svg
                        className="search-icon"
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                    >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                        ref={inputRef}
                        type="text"
                        className="search-input"
                        placeholder={placeholder}
                        value={query}
                        onChange={handleChange}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        aria-label="Search AI tools"
                    />
                    <div className="t-clear-mirror" aria-hidden="true" ref={mirrorRef} />
                    <div className="t-clear-glow" aria-hidden="true" ref={glowRef} />
                    {query && (
                        <button
                            className="search-clear"
                            onClick={handleClear}
                            aria-label="Clear search"
                            type="button"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                    <kbd className="search-shortcut">⌘K</kbd>
                </div>
            </BorderBeam>
        </div>
    );
}
