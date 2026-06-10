import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';

// Stub heavy children so this test exercises only Dashboard's URL/event wiring.
vi.mock('./CategoryNav', () => ({
    default: ({ filter }: { filter: string }) => (
        <div data-testid="category-nav">cat:{filter}</div>
    ),
}));

vi.mock('./CardsContainer', () => ({
    default: ({
        filter,
        searchQuery,
        filterNew,
    }: {
        filter: string;
        searchQuery: string;
        filterNew: boolean;
    }) => (
        <div data-testid="cards">
            <span data-testid="filter">{filter}</span>
            <span data-testid="q">{searchQuery}</span>
            <span data-testid="new">{filterNew ? '1' : '0'}</span>
        </div>
    ),
}));

import Dashboard from './Dashboard';

function setUrl(search: string) {
    window.history.replaceState(null, '', `/${search}`);
}

describe('Dashboard', () => {
    beforeEach(() => {
        setUrl('');
    });

    afterEach(() => {
        cleanup();
        setUrl('');
    });

    it('renders with empty search/filter when URL has no params', () => {
        render(<Dashboard category="all" />);
        expect(screen.getByTestId('q').textContent).toBe('');
        expect(screen.getByTestId('new').textContent).toBe('0');
        expect(screen.getByTestId('filter').textContent).toBe('all');
    });

    it('syncs from ?q= and ?new=1 on mount (deep-link hydration)', () => {
        setUrl('?q=hello&new=1');
        render(<Dashboard category="agents" />);
        expect(screen.getByTestId('q').textContent).toBe('hello');
        expect(screen.getByTestId('new').textContent).toBe('1');
        expect(screen.getByTestId('filter').textContent).toBe('agents');
    });

    it('updates state in response to tools:search events', () => {
        render(<Dashboard category="all" />);
        expect(screen.getByTestId('q').textContent).toBe('');

        act(() => {
            window.dispatchEvent(
                new CustomEvent('tools:search', { detail: { query: 'foo' } })
            );
        });
        expect(screen.getByTestId('q').textContent).toBe('foo');

        act(() => {
            window.dispatchEvent(
                new CustomEvent('tools:search', { detail: { query: '' } })
            );
        });
        expect(screen.getByTestId('q').textContent).toBe('');
    });

    it('updates state in response to tools:filter-new events', () => {
        render(<Dashboard category="all" />);
        expect(screen.getByTestId('new').textContent).toBe('0');

        act(() => {
            window.dispatchEvent(
                new CustomEvent('tools:filter-new', { detail: { filterNew: true } })
            );
        });
        expect(screen.getByTestId('new').textContent).toBe('1');

        act(() => {
            window.dispatchEvent(
                new CustomEvent('tools:filter-new', { detail: { filterNew: false } })
            );
        });
        expect(screen.getByTestId('new').textContent).toBe('0');
    });

    it('re-syncs from URL on astro:page-load (transition:persist cross-nav)', () => {
        setUrl('?q=foo');
        render(<Dashboard category="all" />);
        expect(screen.getByTestId('q').textContent).toBe('foo');

        // Simulate Astro view-transition navigating to a category page with no q.
        setUrl('');
        act(() => {
            document.dispatchEvent(new Event('astro:page-load'));
        });
        expect(screen.getByTestId('q').textContent).toBe('');
        expect(screen.getByTestId('new').textContent).toBe('0');

        // And a navigation that adds ?new=1.
        setUrl('?new=1');
        act(() => {
            document.dispatchEvent(new Event('astro:page-load'));
        });
        expect(screen.getByTestId('new').textContent).toBe('1');
    });

    it('re-syncs from URL on popstate (browser back/forward)', () => {
        setUrl('?q=foo');
        render(<Dashboard category="all" />);
        expect(screen.getByTestId('q').textContent).toBe('foo');

        // Simulate the user hitting Back: URL changes, popstate fires.
        setUrl('?q=bar&new=1');
        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'));
        });
        expect(screen.getByTestId('q').textContent).toBe('bar');
        expect(screen.getByTestId('new').textContent).toBe('1');

        // Forward to a clean URL.
        setUrl('');
        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'));
        });
        expect(screen.getByTestId('q').textContent).toBe('');
        expect(screen.getByTestId('new').textContent).toBe('0');
    });

    it('ignores malformed event detail (no detail object)', () => {
        render(<Dashboard category="all" />);
        act(() => {
            window.dispatchEvent(new Event('tools:search'));
            window.dispatchEvent(new Event('tools:filter-new'));
        });
        // No throw, state unchanged.
        expect(screen.getByTestId('q').textContent).toBe('');
        expect(screen.getByTestId('new').textContent).toBe('0');
    });
});
