import { useState, useEffect } from 'react';
import { BorderBeam } from 'border-beam';
import { getBookmarkedTools, type BookmarkedTool } from '../utils/bookmarks';
import { toolComparators, type SortKey } from '../utils/sorting';
import { useReducedMotion } from '../utils/useReducedMotion';
import Card from './Card';
import EmptyState, { BookmarkIcon } from './EmptyState';
import './CardsContainer.css';
import data from '../data/tools.json';
import type { Category } from '../types';

type FavoritesSortKey = Exclude<SortKey, 'random'>;

export default function FavoritesView() {
    const [bookmarkedTools, setBookmarkedTools] = useState<BookmarkedTool[]>([]);
    const [sortBy, setSortBy] = useState<FavoritesSortKey>('nameAsc');
    const reduced = useReducedMotion();

    const loadBookmarks = () => {
        const tools = getBookmarkedTools(data.tools as Category[]);
        setBookmarkedTools(tools);
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
                {sortedTools.map(({ url, title, body, tag, 'date-added': dateAdded, slug }, i) => (
                    <Card
                        key={`${slug}-${i}`}
                        href={url}
                        title={title}
                        body={body}
                        tag={tag}
                        dateAdded={dateAdded}
                        slug={slug}
                    />
                ))}
            </ul>
        </section>
    );
}
