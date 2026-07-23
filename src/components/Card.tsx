import { useEffect, useRef, useState } from 'react';
import { BorderBeam } from 'border-beam';
import './Card.css';
import BookmarkButton from './BookmarkButton';
import { isRecentlyAdded } from '../utils/dates';
import { useReducedMotion } from '../utils/useReducedMotion';

interface CardProps {
    href: string;
    title: string;
    body: string;
    tag?: string | undefined;
    dateAdded?: string | undefined;
    slug?: string | undefined;
}

export default function Card({
    href,
    title,
    body,
    tag,
    dateAdded,
    slug,
}: CardProps) {
    const linkUrl = slug ? `/tools/${slug}` : href;
    const isNew = isRecentlyAdded(dateAdded, 30);
    const tiltRef = useRef<HTMLLIElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const [badgeOpen, setBadgeOpen] = useState(false);
    const [hovered, setHovered] = useState(false);
    const reduced = useReducedMotion();

    useEffect(() => {
        if (!isNew) return;
        const id = requestAnimationFrame(() => setBadgeOpen(true));
        return () => cancelAnimationFrame(id);
    }, [isNew]);

    // Prefetch the tool page HTML on intent (hover/focus/touch) so the click
    // navigation is instant in production. This also covers cards rendered
    // client-side (infinite scroll / search results) that Astro's page-load
    // prefetch scan wouldn't catch. Internal-route only; deduped by Astro.
    const prefetchTool = () => {
        if (!slug) return;
        import('astro:prefetch')
            .then(({ prefetch }) => {
                try {
                    prefetch(linkUrl);
                } catch {
                    /* prefetch disabled or unsupported — ignore */
                }
            })
            .catch(() => {});
    };

    const TILT_MAX = 12;
    const handleTilt = (e: React.PointerEvent<HTMLLIElement>) => {
        if (e.pointerType !== 'mouse') return;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
        const tilt = tiltRef.current;
        const card = cardRef.current;
        if (!tilt || !card) return;
        const r = tilt.getBoundingClientRect();
        const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        tilt.classList.add('is-hover');
        card.classList.add('is-tilting');
        card.style.setProperty('--tilt-ry', `${((px - 0.5) * TILT_MAX).toFixed(2)}deg`);
        card.style.setProperty('--tilt-rx', `${((0.5 - py) * TILT_MAX).toFixed(2)}deg`);
        card.style.setProperty('--tilt-gx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--tilt-gy', `${(py * 100).toFixed(1)}%`);
    };
    const resetTilt = () => {
        setHovered(false);
        const tilt = tiltRef.current;
        const card = cardRef.current;
        if (!tilt || !card) return;
        tilt.classList.remove('is-hover');
        card.classList.remove('is-tilting');
        card.style.setProperty('--tilt-rx', '0deg');
        card.style.setProperty('--tilt-ry', '0deg');
    };

    const cardInner = (
        <div className="t-tilt-card" ref={cardRef}>
            <a
                href={linkUrl}
                onMouseEnter={prefetchTool}
                onFocus={prefetchTool}
                onTouchStart={prefetchTool}
                onClick={() => {
                    window.dispatchEvent(new CustomEvent('tools:save-state'));
                }}
            >
                <strong className="nu-c-fs-normal nu-u-mt-1 nu-u-mb-1">{title}</strong>
                <p className="nu-c-helper-text nu-u-mt-1 nu-u-mb-1">{body}</p>
                <p className="distribution">
                    {isNew && (
                        <span
                            className="tag nu-u-me-2 tag-new t-badge"
                            data-open={badgeOpen}
                            title="Recently added"
                            aria-label="New item"
                        >
                            <span className="t-badge-dot">🔥</span>
                        </span>
                    )}
                    <span className="tag">{tag}</span>
                </p>
            </a>
            {slug && (
                <div className="card-bookmark">
                    <BookmarkButton slug={slug} title={title} variant="small" />
                </div>
            )}
            <div className="t-tilt-glare" aria-hidden="true" />
        </div>
    );

    return (
        <li
            className="link-card t-tilt"
            ref={tiltRef}
            onPointerEnter={() => setHovered(true)}
            onPointerMove={handleTilt}
            onPointerLeave={resetTilt}
        >
            <BorderBeam
                size="pulse-inner"
                colorVariant="ocean"
                theme="dark"
                strength={0.6}
                active={hovered && !reduced}
                style={{ display: 'flex', width: '100%' }}
            >
                {cardInner}
            </BorderBeam>
        </li>
    );
}
