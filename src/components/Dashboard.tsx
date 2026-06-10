import { useEffect, useState } from 'react';
import CategoryNav from './CategoryNav';
import CardsContainer from './CardsContainer';

interface DashboardProps {
    category: string;
}

interface SearchEventDetail {
    query?: string;
}

interface FilterNewEventDetail {
    filterNew?: boolean;
}

function readQueryFromUrl(): string {
    if (typeof window === 'undefined') return '';
    try {
        return new URLSearchParams(window.location.search).get('q') || '';
    } catch {
        return '';
    }
}

function readFilterNewFromUrl(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return new URLSearchParams(window.location.search).get('new') === '1';
    } catch {
        return false;
    }
}

export default function Dashboard({ category }: DashboardProps) {
    // Initialize to empty/false so SSR output matches client first render
    // (avoids React 19 hydration mismatch warning). The real URL sync
    // happens in the effect below, immediately after hydration.
    const [searchQuery, setSearchQuery] = useState('');
    const [filterNew, setFilterNew] = useState(false);

    useEffect(() => {
        // Sync from URL right after hydration so direct deep-link loads
        // (e.g. /?q=foo or /?new=1) apply the filter on first paint.
        const syncFromUrl = () => {
            setSearchQuery(readQueryFromUrl());
            setFilterNew(readFilterNewFromUrl());
        };
        syncFromUrl();

        const handleSearch = (e: Event) => {
            const detail = (e as CustomEvent<SearchEventDetail>)?.detail || {};
            if (typeof detail.query !== 'undefined') {
                setSearchQuery(detail.query);
            }
        };

        const handleFilterNew = (e: Event) => {
            const detail = (e as CustomEvent<FilterNewEventDetail>)?.detail || {};
            if (typeof detail.filterNew !== 'undefined') {
                setFilterNew(detail.filterNew);
            }
        };

        // Astro view-transition navigations keep this component mounted
        // (transition:persist) but the URL changes — resync from URL on
        // every page-load so cross-category nav clears stale q/new state.
        // popstate covers browser back/forward inside the same page (e.g.
        // SearchInput's replaceState history entries), keeping CardsContainer
        // in lockstep with the URL and the search input value.
        window.addEventListener('tools:search', handleSearch);
        window.addEventListener('tools:filter-new', handleFilterNew);
        window.addEventListener('popstate', syncFromUrl);
        document.addEventListener('astro:page-load', syncFromUrl);

        return () => {
            window.removeEventListener('tools:search', handleSearch);
            window.removeEventListener('tools:filter-new', handleFilterNew);
            window.removeEventListener('popstate', syncFromUrl);
            document.removeEventListener('astro:page-load', syncFromUrl);
        };
    }, []);

    return (
        <>
            <CategoryNav filter={category} />
            <CardsContainer
                filter={category}
                searchQuery={searchQuery}
                filterNew={filterNew}
            />
        </>
    );
}
