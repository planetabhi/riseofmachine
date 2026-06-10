import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import BookmarkButton from './BookmarkButton';

describe('BookmarkButton', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        cleanup();
        localStorage.clear();
    });

    it('renders unbookmarked by default and reflects an existing bookmark', () => {
        localStorage.setItem('rom_bookmarks', JSON.stringify(['already-saved']));

        render(<BookmarkButton slug="not-saved" title="Tool A" />);
        const btnA = screen.getByRole('button');
        expect(btnA.className).not.toMatch(/bookmarked/);
        expect(btnA.getAttribute('aria-label')).toBe('Add Tool A to saved list');

        cleanup();
        render(<BookmarkButton slug="already-saved" title="Tool B" />);
        const btnB = screen.getByRole('button');
        expect(btnB.className).toMatch(/bookmarked/);
        expect(btnB.getAttribute('aria-label')).toBe('Remove Tool B from saved list');
    });

    it('toggles state, persists to localStorage, and dispatches bookmarks:changed', () => {
        const handler = vi.fn();
        window.addEventListener('bookmarks:changed', handler);

        render(<BookmarkButton slug="my-tool" title="My Tool" />);
        const btn = screen.getByRole('button');

        fireEvent.click(btn);
        expect(btn.className).toMatch(/bookmarked/);
        expect(JSON.parse(localStorage.getItem('rom_bookmarks') || '[]')).toEqual([
            'my-tool',
        ]);
        expect(handler).toHaveBeenCalledTimes(1);

        fireEvent.click(btn);
        expect(btn.className).not.toMatch(/bookmarked/);
        expect(JSON.parse(localStorage.getItem('rom_bookmarks') || '[]')).toEqual([]);
        expect(handler).toHaveBeenCalledTimes(2);

        window.removeEventListener('bookmarks:changed', handler);
    });

    it('stops event propagation so it can sit inside a card link', () => {
        const cardClick = vi.fn();
        render(
            <div onClick={cardClick}>
                <BookmarkButton slug="x" title="X" />
            </div>
        );
        fireEvent.click(screen.getByRole('button'));
        expect(cardClick).not.toHaveBeenCalled();
    });

    it('reacts to external bookmarks:changed events', () => {
        render(<BookmarkButton slug="x" title="X" />);
        const btn = screen.getByRole('button');
        expect(btn.className).not.toMatch(/bookmarked/);

        // Simulate another BookmarkButton instance saving this slug.
        act(() => {
            localStorage.setItem('rom_bookmarks', JSON.stringify(['x']));
            window.dispatchEvent(new CustomEvent('bookmarks:changed'));
        });

        expect(btn.className).toMatch(/bookmarked/);
    });

    it('ignores clicks when slug is empty', () => {
        const handler = vi.fn();
        window.addEventListener('bookmarks:changed', handler);

        render(<BookmarkButton slug="" title="No Slug" />);
        fireEvent.click(screen.getByRole('button'));

        expect(localStorage.getItem('rom_bookmarks')).toBeNull();
        expect(handler).not.toHaveBeenCalled();

        window.removeEventListener('bookmarks:changed', handler);
    });

    it('applies the small variant class', () => {
        render(<BookmarkButton slug="x" title="X" variant="small" />);
        expect(screen.getByRole('button').className).toMatch(/bookmark-btn--small/);
    });
});
