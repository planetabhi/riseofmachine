import { useState, useEffect, useRef } from 'react';
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

export default function SearchInput({
    placeholder = "Search by name, category, or feature...",
}: SearchInputProps) {
    // Initialize empty so SSR HTML matches client first render
    // (avoids React 19 hydration mismatch). URL value is applied right
    // after hydration in the effect below.
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setQuery('');
        dispatchSearch('');
        inputRef.current?.focus();
    };

    return (
        <div className="search-container">
            <div className="search-input-wrapper">
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
                    aria-label="Search AI tools"
                />
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
        </div>
    );
}
