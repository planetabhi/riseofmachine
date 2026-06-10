import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    getBookmarks,
    isBookmarked,
    addBookmark,
    removeBookmark,
    toggleBookmark,
    getBookmarkedTools,
    getBookmarkCount,
} from './bookmarks';
import type { Category } from '../types';

const STORAGE_KEY = 'rom_bookmarks';

const sampleCategories: Category[] = [
    {
        category: 'art',
        title: 'Art',
        content: [
            { title: 'Acme', body: 'art tool', url: 'https://acme.test', 'date-added': '2024-01-01', slug: 'acme' },
            { title: 'Bravo', body: 'another', url: 'https://bravo.test', 'date-added': '2024-02-01', slug: 'bravo' },
        ],
    },
    {
        category: 'code',
        title: 'Code',
        content: [
            { title: 'Charlie', body: 'code tool', url: 'https://charlie.test', 'date-added': '2024-03-01', slug: 'charlie' },
            { title: 'Delta (no slug)', body: 'skip', url: 'https://delta.test', 'date-added': '2024-04-01' },
        ],
    },
];

describe('bookmarks', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    describe('getBookmarks', () => {
        it('returns empty array when storage is empty', () => {
            expect(getBookmarks()).toEqual([]);
        });

        it('returns parsed array from localStorage', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(['acme', 'bravo']));
            expect(getBookmarks()).toEqual(['acme', 'bravo']);
        });

        it('returns empty array on corrupt JSON', () => {
            localStorage.setItem(STORAGE_KEY, '{not-json');
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            expect(getBookmarks()).toEqual([]);
        });
    });

    describe('addBookmark', () => {
        it('adds a new slug and returns true', () => {
            expect(addBookmark('acme')).toBe(true);
            expect(getBookmarks()).toEqual(['acme']);
        });

        it('does not duplicate existing slug and returns false', () => {
            addBookmark('acme');
            expect(addBookmark('acme')).toBe(false);
            expect(getBookmarks()).toEqual(['acme']);
        });

        it('rejects empty slug', () => {
            expect(addBookmark('')).toBe(false);
            expect(getBookmarks()).toEqual([]);
        });

        it('dispatches bookmarks:changed event', () => {
            const handler = vi.fn();
            window.addEventListener('bookmarks:changed', handler);
            addBookmark('acme');
            expect(handler).toHaveBeenCalledTimes(1);
            window.removeEventListener('bookmarks:changed', handler);
        });
    });

    describe('removeBookmark', () => {
        it('removes existing slug and returns true', () => {
            addBookmark('acme');
            expect(removeBookmark('acme')).toBe(true);
            expect(getBookmarks()).toEqual([]);
        });

        it('returns false when slug is not present', () => {
            expect(removeBookmark('nope')).toBe(false);
        });

        it('rejects empty slug', () => {
            expect(removeBookmark('')).toBe(false);
        });
    });

    describe('isBookmarked', () => {
        it('returns true when present', () => {
            addBookmark('acme');
            expect(isBookmarked('acme')).toBe(true);
        });

        it('returns false when absent', () => {
            expect(isBookmarked('acme')).toBe(false);
        });
    });

    describe('toggleBookmark', () => {
        it('adds when not present and returns true', () => {
            expect(toggleBookmark('acme')).toBe(true);
            expect(isBookmarked('acme')).toBe(true);
        });

        it('removes when present and returns false', () => {
            addBookmark('acme');
            expect(toggleBookmark('acme')).toBe(false);
            expect(isBookmarked('acme')).toBe(false);
        });
    });

    describe('getBookmarkCount', () => {
        it('returns 0 when none', () => {
            expect(getBookmarkCount()).toBe(0);
        });

        it('returns correct count', () => {
            addBookmark('acme');
            addBookmark('bravo');
            expect(getBookmarkCount()).toBe(2);
        });
    });

    describe('getBookmarkedTools', () => {
        it('returns empty array when no bookmarks', () => {
            expect(getBookmarkedTools(sampleCategories)).toEqual([]);
        });

        it('returns matching tools with category attached', () => {
            addBookmark('acme');
            addBookmark('charlie');
            const result = getBookmarkedTools(sampleCategories);
            expect(result).toHaveLength(2);
            expect(result.map((t) => t.slug)).toEqual(['acme', 'charlie']);
            expect(result[0]?.category).toBe('art');
            expect(result[1]?.category).toBe('code');
        });

        it('ignores tools without a slug', () => {
            // delta has no slug; even if we tried to bookmark it we couldn't match.
            addBookmark('acme');
            const result = getBookmarkedTools(sampleCategories);
            expect(result.every((t) => !!t.slug)).toBe(true);
        });
    });
});
