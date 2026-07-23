import { navigate } from 'astro:transitions/client';
import { useState, useEffect, useRef, useMemo } from 'react';
import data from '../data/tools.json';
import './CategoryNavItem.css';
import { useReducedMotion } from '../utils/useReducedMotion';
import type { Category } from '../types';

interface CategoryNavItemProps {
    title: string;
    category: string;
    filter: string;
}

export default function CategoryNavItem({
    title,
    category,
    filter,
}: CategoryNavItemProps) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [isActive, setIsActive] = useState(false);
    const reduced = useReducedMotion();

    const path = category === 'all' ? '/' : `/${category}`;

    const handleNavigation = (e: React.MouseEvent) => {
        e.preventDefault();
        navigate(path, {
            history: 'push',
            state: { category },
        });
    };

    // Prefetch the destination HTML on intent so category switches feel
    // instant. These are <button>s (not <a>), so Astro's built-in prefetch
    // can't discover them — we prefetch manually. Deduped + same-origin only.
    const prefetchCategory = () => {
        import('astro:prefetch')
            .then(({ prefetch }) => {
                try {
                    prefetch(path);
                } catch {
                    /* prefetch disabled or unsupported — ignore */
                }
            })
            .catch(() => {});
    };

    const categoryCount = useMemo(() => {
        if (category === 'all') {
            return (data.tools as Category[]).reduce((acc, item) => acc + item.content.length, 0);
        }
        return (data.tools as Category[]).find((item) => item.category === category)?.content.length || 0;
    }, [category]);

    const [displayCount, setDisplayCount] = useState(categoryCount);

    useEffect(() => {
        if (!isActive) {
            setDisplayCount(categoryCount);
            return;
        }
        if (reduced) {
            setDisplayCount(categoryCount);
            return;
        }
        let raf = 0;
        let startTs = 0;
        const duration = 700;
        const step = (ts: number) => {
            if (!startTs) startTs = ts;
            const t = Math.min(1, (ts - startTs) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setDisplayCount(Math.round(categoryCount * eased));
            if (t < 1) raf = requestAnimationFrame(step);
        };
        setDisplayCount(0);
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [isActive, categoryCount, reduced]);

    useEffect(() => {
        setIsActive(filter === category);
    }, [filter, category]);

    useEffect(() => {
        if (isActive && buttonRef.current) {
            buttonRef.current.scrollIntoView({
                behavior: 'instant',
                block: 'nearest',
                inline: 'center',
            });
        }
    }, [isActive]);

    return (
        <button
            ref={buttonRef}
            onClick={handleNavigation}
            onMouseEnter={prefetchCategory}
            onFocus={prefetchCategory}
            onTouchStart={prefetchCategory}
            className={`nav__item nu-u-text--secondary-alt nu-c-fs-small nav__item--filter ${isActive ? 'is-active' : ''}`}
            aria-label={`Navigate to ${title} category with ${categoryCount} items`}
        >
            {title}{' '}
            <span
                className="category-count"
                style={{ minWidth: `${Math.max(2, String(categoryCount).length)}ch` }}
            >
                {displayCount}
            </span>
        </button>
    );
}
