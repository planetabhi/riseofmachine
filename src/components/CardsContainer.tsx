import { useMemo, useState, useEffect, useRef } from 'react';
import type Fuse from 'fuse.js';
import Card from './Card';
import EmptyState, { SearchIcon } from './EmptyState';
import './CardsContainer.css';
import data from '../data/tools.json';
import type { Tool, Category } from '../types';
import { toolComparators, seededShuffle, type SortKey } from '../utils/sorting';
import { isRecentlyAdded } from '../utils/dates';

const ITEMS_PER_PAGE = 32;

interface ToolWithCategory extends Tool {
    category: string;
}

const fuseOptions = {
    keys: [
        { name: 'title', weight: 0.4 },
        { name: 'body', weight: 0.3 },
        { name: 'category', weight: 0.2 },
        { name: 'tag', weight: 0.1 }
    ],
    threshold: 0.3,
    includeScore: true,
    minMatchCharLength: 2,
    ignoreLocation: true
};

interface CardsContainerProps {
    filter: string;
    sort?: SortKey;
    randomSeed?: number;
    searchQuery?: string;
    filterNew?: boolean;
}

export default function CardsContainer({
    filter,
    sort = 'nameAsc',
    randomSeed = 0,
    searchQuery = '',
    filterNew = false,
}: CardsContainerProps) {
    const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE);
    const loaderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const tryRestore = () => {
            try {
                const raw = sessionStorage.getItem('toolsState');
                if (!raw) return;
                const state = JSON.parse(raw);
                if (state && state.filter === filter) {
                    if (state.displayedCount && state.displayedCount > displayedCount) {
                        setDisplayedCount(state.displayedCount);
                    }
                    // Wait for the next paint so the freshly-rendered cards
                    // contribute to scrollHeight before we restore scrollY.
                    requestAnimationFrame(() => {
                        if (typeof window !== 'undefined' && typeof state.scrollY !== 'undefined') {
                            window.scrollTo(0, state.scrollY);
                        }
                    });
                }
                sessionStorage.removeItem('toolsState');
            } catch (err) { }
        };

        tryRestore();
        window.addEventListener('pageshow', tryRestore);
        window.addEventListener('astro:page-load', tryRestore);
        return () => {
            window.removeEventListener('pageshow', tryRestore);
            window.removeEventListener('astro:page-load', tryRestore);
        };
    }, [filter]);

    const allFlatTools = useMemo((): ToolWithCategory[] => {
        return (data.tools as Category[]).flatMap((item) =>
            item.content.map((tool) => ({
                ...tool,
                category: item.category,
            }))
        );
    }, []);

    // Lazy-load Fuse.js: only build the index after the user actually types.
    // Keeps ~15 KB gz off the initial bundle.
    const fuseRef = useRef<Fuse<ToolWithCategory> | null>(null);
    const [fuseReady, setFuseReady] = useState(false);
    const wantsSearch = !!(searchQuery && searchQuery.length >= 2);

    useEffect(() => {
        if (!wantsSearch || fuseRef.current) return;
        let cancelled = false;
        import('fuse.js').then(({ default: FuseCtor }) => {
            if (cancelled) return;
            fuseRef.current = new FuseCtor(allFlatTools, fuseOptions);
            setFuseReady(true);
        });
        return () => { cancelled = true; };
    }, [wantsSearch, allFlatTools]);

    const filteredCards = useMemo((): ToolWithCategory[] => {
        let base: ToolWithCategory[];

        if (wantsSearch) {
            // Fuse not loaded yet — return empty list; UI shows a loader below
            // until the index is built, then this memo re-runs via fuseReady.
            if (!fuseRef.current) return [];
            const results = fuseRef.current.search(searchQuery);
            base = results.map(result => result.item);
            if (filter !== 'all') {
                base = base.filter(tool => tool.category === filter);
            }
        } else {
            base = (data.tools as Category[])
                .filter((item) => filter === 'all' || filter === item.category)
                .flatMap((item) =>
                    item.content.map((tool) => ({
                        ...tool,
                        category: item.category,
                    }))
                );
        }

        // Filter for new tools (added within last 30 days)
        if (filterNew) {
            base = base.filter((tool) => isRecentlyAdded(tool['date-added'], 30));
        }

        if (sort === 'random') {
            // Use provided seed for deterministic shuffling, fallback to stable default
            // If truly random ordering per session is needed, pass Date.now() as randomSeed from parent
            const DEFAULT_SEED = 42;
            return seededShuffle(base, randomSeed || DEFAULT_SEED);
        } else {
            const comparator = toolComparators[sort] || toolComparators.nameAsc;
            return [...base].sort(comparator);
        }
    }, [filter, sort, randomSeed, searchQuery, filterNew, wantsSearch, fuseReady]);

    const isFirstFilterChange = useRef(true);
    useEffect(() => {
        if (isFirstFilterChange.current) {
            isFirstFilterChange.current = false;
            return;
        }
        setDisplayedCount(ITEMS_PER_PAGE);
    }, [filter, searchQuery, filterNew]);

    useEffect(() => {
        const handleSaveState = () => {
            try {
                const state = {
                    filter,
                    displayedCount,
                    scrollY: typeof window !== 'undefined' ? window.scrollY || window.pageYOffset : 0,
                };
                sessionStorage.setItem('toolsState', JSON.stringify(state));
            } catch (err) { }
        };

        window.addEventListener('tools:save-state', handleSaveState);
        return () => window.removeEventListener('tools:save-state', handleSaveState);
    }, [displayedCount, filter]);

    useEffect(() => {
        // No more pages to load — skip observer setup entirely.
        if (displayedCount >= filteredCards.length) return;
        const node = loaderRef.current;
        if (!node) return;

        // rootMargin pre-fetches the next page ~400px before the sentinel
        // enters the viewport — feels instant without the artificial setTimeout.
        // Natural debounce: after a page is appended the sentinel scrolls well
        // below the rootMargin window, so the observer won't re-fire until the
        // user scrolls further.
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) {
                    setDisplayedCount((prev) =>
                        Math.min(prev + ITEMS_PER_PAGE, filteredCards.length)
                    );
                }
            },
            { rootMargin: '400px' }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [displayedCount, filteredCards.length]);

    const displayedCards = filteredCards.slice(0, displayedCount);

    const isFuseLoading = wantsSearch && !fuseRef.current;

    // Check if searching with no results in a specific category
    const isSearchingInCategory = searchQuery && searchQuery.length >= 2 && filter !== 'all';
    const hasNoSearchResults =
        isSearchingInCategory && !isFuseLoading && filteredCards.length === 0;

    if (hasNoSearchResults) {
        return (
            <section>
                <EmptyState
                    icon={<SearchIcon />}
                    message={`No results found for "${searchQuery}" in this category.`}
                    actionText="Search All Tools"
                    actionHref="/"
                />
            </section>
        );
    }

    return (
        <section>
            <ul role="list" className="link-card-grid">
                {displayedCards.map(({ url, title, body, tag, 'date-added': dateAdded, slug, category }, i) => (
                    <Card
                        key={`${title}-${i}`}
                        href={url}
                        title={title}
                        body={body}
                        tag={tag}
                        dateAdded={dateAdded}
                        slug={slug}
                        category={category}
                    />
                ))}
            </ul>

            {isFuseLoading && (
                <div className="infinite-scroll-loader" aria-live="polite">
                    <p className="loading-text">Loading more...</p>
                </div>
            )}

            {!isFuseLoading && displayedCount < filteredCards.length && (
                <div
                    ref={loaderRef}
                    className="infinite-scroll-loader"
                    aria-live="polite"
                >
                    <p className="loading-text">Loading more...</p>
                </div>
            )}
        </section>
    );
}
