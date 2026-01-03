import { useState, useEffect } from 'react';
import { isBookmarked, toggleBookmark } from '../utils/bookmarks';
import './BookmarkButton.css';

export default function BookmarkButton({
    slug,
    title,
    variant = 'default',
    className = '',
    showLabel = false
}) {
    const [bookmarked, setBookmarked] = useState(false);

    // Initialize bookmark state
    useEffect(() => {
        if (slug) {
            setBookmarked(isBookmarked(slug));
        }
    }, [slug]);

    // Listen for bookmark changes from other components
    useEffect(() => {
        const handleBookmarkChange = (e) => {
            if (slug) {
                setBookmarked(isBookmarked(slug));
            }
        };

        window.addEventListener('bookmarks:changed', handleBookmarkChange);
        return () => window.removeEventListener('bookmarks:changed', handleBookmarkChange);
    }, [slug]);

    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!slug) return;

        const newState = toggleBookmark(slug);
        setBookmarked(newState);
    };

    const ariaLabel = bookmarked
        ? `Remove ${title} from saved list`
        : `Add ${title} to saved list`;

    return (
        <button
            className={`bookmark-btn bookmark-btn--${variant} ${bookmarked ? 'bookmarked' : ''} ${className}`}
            onClick={handleClick}
            aria-label={ariaLabel}
            title={ariaLabel}
            type="button"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                    d="M15 19L9.80769 17.0435L5 19V1H15V19Z"
                    stroke="currentColor"
                    strokeMiterlimit="10"
                    fill={bookmarked ? 'currentColor' : 'none'}
                />
            </svg>
            {showLabel && <span className="bookmark-label">Add tool to saved list</span>}
        </button>
    );
}
