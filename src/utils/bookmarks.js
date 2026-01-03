/**
 * Bookmark management utilities using localStorage
 */

const STORAGE_KEY = 'rom_bookmarks';

/**
 * Get all bookmarked tool slugs from localStorage
 * @returns {string[]} Array of bookmarked tool slugs
 */
export function getBookmarks() {
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
 * @param {string[]} bookmarks - Array of tool slugs
 */
function saveBookmarks(bookmarks) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
        // Dispatch event for cross-component sync
        window.dispatchEvent(new CustomEvent('bookmarks:changed', {
            detail: { bookmarks }
        }));
    } catch (error) {
        console.warn('Failed to save bookmarks to localStorage:', error);
    }
}

/**
 * Check if a tool is bookmarked
 * @param {string} slug - Tool slug
 * @returns {boolean}
 */
export function isBookmarked(slug) {
    const bookmarks = getBookmarks();
    return bookmarks.includes(slug);
}

/**
 * Add a tool to bookmarks
 * @param {string} slug - Tool slug
 * @returns {boolean} Success status
 */
export function addBookmark(slug) {
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
 * @param {string} slug - Tool slug
 * @returns {boolean} Success status
 */
export function removeBookmark(slug) {
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
 * @param {string} slug - Tool slug
 * @returns {boolean} New bookmark state (true = bookmarked, false = not bookmarked)
 */
export function toggleBookmark(slug) {
    if (isBookmarked(slug)) {
        removeBookmark(slug);
        return false;
    } else {
        addBookmark(slug);
        return true;
    }
}

/**
 * Get full tool objects for all bookmarked tools
 * @param {Array} allTools - Array of all tools from tools.json
 * @returns {Array} Array of bookmarked tool objects
 */
export function getBookmarkedTools(allTools) {
    const bookmarks = getBookmarks();
    const bookmarkedTools = [];

    // Flatten all tools and filter by bookmarked slugs
    allTools.forEach(category => {
        category.content.forEach(tool => {
            if (bookmarks.includes(tool.slug)) {
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
 * @returns {number} Number of bookmarked tools
 */
export function getBookmarkCount() {
    return getBookmarks().length;
}
