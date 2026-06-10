import type { Category, Tool } from '../types';

export const STORAGE_KEY = 'rom_bookmarks';

/**
 * Get all bookmarked tool slugs from localStorage
 * @returns Array of bookmarked tool slugs
 */
export function getBookmarks(): string[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.warn('Failed to read bookmarks from localStorage:', error);
        return [];
    }
}

/**
 * Save bookmarks to localStorage
 * @param bookmarks - Array of tool slugs
 */
function saveBookmarks(bookmarks: string[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
        window.dispatchEvent(new CustomEvent('bookmarks:changed', {
            detail: { bookmarks }
        }));
    } catch (error) {
        console.warn('Failed to save bookmarks to localStorage:', error);
    }
}

/**
 * Check if a tool is bookmarked
 * @param slug - Tool slug
 * @returns true if bookmarked
 */
export function isBookmarked(slug: string): boolean {
    const bookmarks = getBookmarks();
    return bookmarks.includes(slug);
}

/**
 * Add a tool to bookmarks
 * @param slug - Tool slug
 * @returns true if successfully added
 */
export function addBookmark(slug: string): boolean {
    if (!slug) return false;

    const bookmarks = getBookmarks();
    if (!bookmarks.includes(slug)) {
        bookmarks.push(slug);
        saveBookmarks(bookmarks);
        return true;
    }
    return false;
}

/**
 * Remove a tool from bookmarks
 * @param slug - Tool slug
 * @returns true if successfully removed
 */
export function removeBookmark(slug: string): boolean {
    if (!slug) return false;

    const bookmarks = getBookmarks();
    const index = bookmarks.indexOf(slug);
    if (index > -1) {
        bookmarks.splice(index, 1);
        saveBookmarks(bookmarks);
        return true;
    }
    return false;
}

/**
 * Toggle bookmark state for a tool
 * @param slug - Tool slug
 * @returns New bookmark state (true = bookmarked, false = not bookmarked)
 */
export function toggleBookmark(slug: string): boolean {
    if (isBookmarked(slug)) {
        removeBookmark(slug);
        return false;
    } else {
        addBookmark(slug);
        return true;
    }
}

/**
 * Tool with category information
 */
export interface BookmarkedTool extends Tool {
    category: string;
}

/**
 * Get full tool objects for all bookmarked tools
 * @param allCategories - Array of all categories from tools.json
 * @returns Array of bookmarked tool objects with category
 */
export function getBookmarkedTools(allCategories: Category[]): BookmarkedTool[] {
    const bookmarks = getBookmarks();
    const bookmarkedTools: BookmarkedTool[] = [];

    allCategories.forEach(category => {
        category.content.forEach(tool => {
            if (tool.slug && bookmarks.includes(tool.slug)) {
                bookmarkedTools.push({
                    ...tool,
                    category: category.category
                });
            }
        });
    });

    return bookmarkedTools;
}

/**
 * Get bookmark count
 * @returns Number of bookmarked tools
 */
export function getBookmarkCount(): number {
    return getBookmarks().length;
}
