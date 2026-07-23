import { useState, useEffect, useRef } from 'react';
import { isBookmarked, toggleBookmark } from '../utils/bookmarks';
import './BookmarkButton.css';

interface BookmarkButtonProps {
    slug: string;
    title: string;
    variant?: 'default' | 'small';
    className?: string;
    showLabel?: boolean;
}

export default function BookmarkButton({
    slug,
    title,
    variant = 'default',
    className = '',
    showLabel = false,
}: BookmarkButtonProps) {
    const [bookmarked, setBookmarked] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (slug) {
            setBookmarked(isBookmarked(slug));
        }
    }, [slug]);

    useEffect(() => {
        const handleBookmarkChange = () => {
            if (slug) {
                setBookmarked(isBookmarked(slug));
            }
        };

        window.addEventListener('bookmarks:changed', handleBookmarkChange);
        return () => window.removeEventListener('bookmarks:changed', handleBookmarkChange);
    }, [slug]);

    useEffect(() => {
        return () => {
            if (burstTimer.current) clearTimeout(burstTimer.current);
        };
    }, []);

    const fireBurst = () => {
        const el = buttonRef.current;
        if (!el) return;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
        const dist = 20;
        el.querySelectorAll<HTMLElement>('.t-like-particles i').forEach((dot, i) => {
            const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
            const d = dist * (0.7 + Math.random() * 0.6);
            dot.style.setProperty('--px', `${Math.cos(angle) * d}px`);
            dot.style.setProperty('--py', `${Math.sin(angle) * d}px`);
            dot.style.setProperty('--psize', `${0.7 + Math.random() * 0.9}`);
            dot.style.setProperty('--pdur', `${480 + Math.random() * 240}ms`);
            dot.style.setProperty('--pdelay', `${Math.random() * 60}ms`);
            dot.style.setProperty('--p-end-scale', `${0.4 + Math.random() * 0.4}`);
        });
        el.classList.remove('is-bursting');
        void el.offsetWidth;
        el.classList.add('is-bursting');
        if (burstTimer.current) clearTimeout(burstTimer.current);
        burstTimer.current = setTimeout(() => el.classList.remove('is-bursting'), 800);
    };

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!slug) return;

        const newState = toggleBookmark(slug);
        setBookmarked(newState);
        if (newState) fireBurst();
    };

    const ariaLabel = bookmarked
        ? `Remove ${title} from saved list`
        : `Add ${title} to saved list`;

    return (
        <button
            ref={buttonRef}
            className={`bookmark-btn bookmark-btn--${variant} t-like ${bookmarked ? 'bookmarked' : ''} ${className}`}
            data-liked={bookmarked}
            onClick={handleClick}
            aria-label={ariaLabel}
            title={ariaLabel}
            type="button"
        >
            <span className="t-like-icon">
                <svg className="t-like-heart" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                        d="M15 19L9.80769 17.0435L5 19V1H15V19Z"
                        stroke="currentColor"
                        strokeMiterlimit={10}
                    />
                </svg>
            </span>
            <span className="t-like-particles" aria-hidden="true">
                <i /><i /><i /><i /><i /><i /><i /><i />
            </span>
            {showLabel && (
                <span className="bookmark-label">
                    {bookmarked ? `Remove ${title} from saved list` : `Add ${title} to saved list`}
                </span>
            )}
        </button>
    );
}
