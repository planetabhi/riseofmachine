import './Card.css';
import BookmarkButton from './BookmarkButton';
import { isRecentlyAdded } from '../utils/dates';

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

    return (
        <li className="link-card">
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
                            className="tag nu-u-me-2 tag-new"
                            title="Recently added"
                            aria-label="New item"
                        >
                            🔥
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
        </li>
    );
}
