import { useState, useEffect } from 'react';
import { BorderBeam } from 'border-beam';
import { getBookmarks } from '../utils/bookmarks';
import { toolComparators, type SortKey } from '../utils/sorting';
import { isRecentlyAdded } from '../utils/dates';
import { useReducedMotion } from '../utils/useReducedMotion';
import BookmarkButton from './BookmarkButton';
import EmptyState, { BookmarkIcon } from './EmptyState';
import './Card.css';
import './CardsContainer.css';
import type { Tool } from '../types';

type FavoritesSortKey = Exclude<SortKey, 'random'>;
type SearchRecord = { s: string; t: string; g: string; c: string; b: string; u: string; d: string };

export default function FavoritesView() {
    const [bookmarkedTools, setBookmarkedTools] = useState<Tool[]>([]);
    const [sortBy, setSortBy] = useState<FavoritesSortKey>('nameAsc');
    const reduced = useReducedMotion();

    // Resolve bookmarked slugs against the lazily-fetched search index so this
    // page never bundles the full tools.json.
    const loadBookmarks = async () => {
        const slugs = new Set(getBookmarks());
        if (slugs.size === 0) {
            setBookmarkedTools([]);
            return;
        }
        try {
            const res = await fetch('/search-index.json');
            const records: SearchRecord[] = await res.json();
            setBookmarkedTools(
                records
                    .filter((r) => slugs.has(r.s))
                    .map((r) => ({
                        slug: r.s,
                        title: r.t,
                        body: r.b,
                        tag: r.g,
                        url: r.u,
                        'date-added': r.d,
                    })),
            );
        } catch {
            setBookmarkedTools([]);
        }
    };

    useEffect(() => {
        loadBookmarks();
    }, []);

    useEffect(() => {
        const handleBookmarkChange = () => {
            loadBookmarks();
        };

        window.addEventListener('bookmarks:changed', handleBookmarkChange);
        return () => {
            window.removeEventListener('bookmarks:changed', handleBookmarkChange);
        };
    }, []);

    const sortedTools = [...bookmarkedTools].sort(toolComparators[sortBy]);

    if (bookmarkedTools.length === 0) {
        return (
            <section>
                <EmptyState
                    icon={<BookmarkIcon />}
                    message="Start saving AI tools by clicking the bookmark icon on any tool card. Your saved tools will appear here for quick access."
                    actionText="Browse AI Tools"
                    actionHref="/"
                />
            </section>
        );
    }

    return (
        <section>
            <div className="favorites-header">
                <div className="favorites-info">
                    <BorderBeam
                        size="sm"
                        colorVariant="ocean"
                        theme="dark"
                        strength={0.7}
                        active={!reduced}
                        style={{ display: 'inline-block' }}
                    >
                        <p className="nu-c-fs-small nu-u-text--secondary">
                            {bookmarkedTools.length} {bookmarkedTools.length === 1 ? 'tool' : 'tools'} saved
                        </p>
                    </BorderBeam>
                </div>

                <div className="favorites-controls">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as FavoritesSortKey)}
                        className="sort-select"
                    >
                        <option value="nameAsc">Name (A-Z)</option>
                        <option value="nameDesc">Name (Z-A)</option>
                        <option value="dateNewest">Newest First</option>
                        <option value="dateOldest">Oldest First</option>
                    </select>
                </div>
            </div>

            <ul role="list" className="link-card-grid">
                {sortedTools.map(({ url, title, body, tag, 'date-added': dateAdded, slug }, i) => {
                    const isNew = isRecentlyAdded(dateAdded, 30);
                    const linkUrl = slug ? `/tools/${slug}` : url;
                    return (
                        <li className="link-card" key={`${slug}-${i}`}>
                            <a href={linkUrl}>
                                <strong className="nu-c-fs-normal nu-u-mt-1 nu-u-mb-1">{title}</strong>
                                <p className="nu-c-helper-text nu-u-mt-1 nu-u-mb-1">{body}</p>
                                <p className="distribution">
                                    {isNew && (
                                        <span className="tag nu-u-me-2 tag-new t-badge" data-open="true" title="Recently added" aria-label="New item">
                                            <span className="t-badge-dot">🔥</span>
                                        </span>
                                    )}
                                    {tag && <span className="tag">{tag}</span>}
                                </p>
                            </a>
                            {slug && (
                                <div className="card-bookmark">
                                    <BookmarkButton slug={slug} title={title} variant="small" />
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
