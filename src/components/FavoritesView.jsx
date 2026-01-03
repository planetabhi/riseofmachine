import { useState, useEffect } from 'react';
import { getBookmarkedTools } from '../utils/bookmarks';
import Card from './Card';
import './CardsContainer.css';
import data from '../data/tools.json';

export default function FavoritesView() {
    const [bookmarkedTools, setBookmarkedTools] = useState([]);
    const [sortBy, setSortBy] = useState('nameAsc');

    const loadBookmarks = () => {
        const tools = getBookmarkedTools(data.tools);
        setBookmarkedTools(tools);
    };

    useEffect(() => {
        loadBookmarks();
    }, []);

    // Listen for bookmark changes
    useEffect(() => {
        const handleBookmarkChange = () => {
            loadBookmarks();
        };

        window.addEventListener('bookmarks:changed', handleBookmarkChange);
        return () => window.removeEventListener('bookmarks:changed', handleBookmarkChange);
    }, []);

    // Sort tools
    const sortedTools = [...bookmarkedTools].sort((a, b) => {
        switch (sortBy) {
            case 'nameAsc':
                return a.title.localeCompare(b.title);
            case 'nameDesc':
                return b.title.localeCompare(a.title);
            case 'dateNewest':
                return new Date(b['date-added'] || 0) - new Date(a['date-added'] || 0);
            case 'dateOldest':
                return new Date(a['date-added'] || 0) - new Date(b['date-added'] || 0);
            default:
                return 0;
        }
    });

    if (bookmarkedTools.length === 0) {
        return (
            <section>
                <div className="empty-state">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="48"
                        height="48"
                        viewBox="0 0 48 48"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ color: 'var(--content-secondary)', marginBottom: 'var(--spacing-05)' }}
                    >
                        <path d="m37 47-13.5-5L11 47V1h26v46z" clipRule="evenodd" />
                    </svg>
                    <p className="nu-c-fs-small nu-u-text--secondary" style={{ maxWidth: '32rem', margin: '0 auto' }}>
                        Start saving AI tools by clicking the bookmark icon on any tool card. Your saved tools will appear here for quick access.
                    </p>
                    <a href="/" className="submit-btn" style={{ marginTop: 'var(--spacing-06)', display: 'inline-block' }}>
                        Browse AI Tools
                    </a>
                </div>
            </section>
        );
    }

    return (
        <section>
            <div className="favorites-header">
                <div className="favorites-info">
                    <p className="nu-c-fs-small nu-u-text--secondary">
                        {bookmarkedTools.length} {bookmarkedTools.length === 1 ? 'tool' : 'tools'} saved
                    </p>
                </div>

                <div className="favorites-controls">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
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
                {sortedTools.map(({ url, title, body, tag, 'date-added': dateAdded, slug, category }, i) => (
                    <Card
                        key={`${slug}-${i}`}
                        href={url}
                        title={title}
                        body={body}
                        tag={tag}
                        dateAdded={dateAdded}
                        slug={slug}
                        category={category}
                    />
                ))}
            </ul>
        </section>
    );
}
