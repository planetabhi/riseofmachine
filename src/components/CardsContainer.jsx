import { useMemo, useState, useEffect, useRef } from "react";
import Card from "./Card";
import "./CardsContainer.css";
import data from "../data/tools.json";

const ITEMS_PER_PAGE = 32;

// Sorting comparators
const comparators = {
  nameAsc: (a, b) => a.title.localeCompare(b.title),
  nameDesc: (a, b) => b.title.localeCompare(a.title),
  dateNewest: (a, b) =>
    new Date(b["date-added"] || 0) - new Date(a["date-added"] || 0),
  dateOldest: (a, b) =>
    new Date(a["date-added"] || 0) - new Date(b["date-added"] || 0),
  // random entry placeholder — we'll use a seeded shuffle function below instead
  random: null,
};

export default function CardsContainer({ filter, sort = "nameAsc", randomSeed = 0 }) {
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(false);
  const loaderRef = useRef(null);

  // Restore saved UI state (scroll position + displayedCount) if present
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("toolsState");
      if (raw) {
        const state = JSON.parse(raw);
        // Only restore when the saved filter matches current filter
        if (state && state.filter === filter) {
          if (state.displayedCount && state.displayedCount > displayedCount) {
            setDisplayedCount(state.displayedCount);
          }
          // Restore scroll a tick later so content has rendered
          setTimeout(() => {
            if (typeof window !== "undefined" && typeof state.scrollY !== "undefined") {
              window.scrollTo(0, state.scrollY);
            }
          }, 50);
        }
        sessionStorage.removeItem("toolsState");
      }
    } catch (err) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCards = useMemo(() => {
    const base = data.tools
      .filter((item) => filter === "all" || filter === item.category)
      .flatMap((item) =>
        item.content.map((tool) => ({
          ...tool,
          category: item.category,
        }))
      );

    // Create a copy and apply sort
    const sorted = [...base];
    
    if (sort === "random") {
      // Seeded Fisher-Yates shuffle to reliably shuffle all entries based on seed
      const mulberry32 = (a) => {
        return function () {
          a |= 0;
          a = (a + 0x6d2b79f5) | 0;
          let t = Math.imul(a ^ (a >>> 15), 1 | a);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      };

      const seededShuffle = (arr, seed) => {
        const rnd = mulberry32(seed || 1);
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(rnd() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };

      return seededShuffle(sorted, randomSeed || Date.now());
    } else {
      const comparator = comparators[sort] || comparators.nameAsc;
      sorted.sort(comparator);
    }
    
    return sorted;
  }, [filter, sort, randomSeed]);

  // Reset displayed count when filter changes
  useEffect(() => {
    setDisplayedCount(ITEMS_PER_PAGE);
  }, [filter]);

  // Listen for save-state events (dispatched before navigating to a tool detail)
  useEffect(() => {
    const handleSaveState = () => {
      try {
        const state = {
          filter,
          displayedCount,
          scrollY: typeof window !== "undefined" ? window.scrollY || window.pageYOffset : 0,
        };
        sessionStorage.setItem("toolsState", JSON.stringify(state));
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener("tools:save-state", handleSaveState);
    return () => window.removeEventListener("tools:save-state", handleSaveState);
  }, [displayedCount, filter]);

  // Also attempt restore when page is shown (useful when navigating back)
  useEffect(() => {
    const tryRestore = () => {
      try {
        const raw = sessionStorage.getItem("toolsState");
        if (!raw) return;
        const state = JSON.parse(raw);
        if (state && state.filter === filter) {
          if (state.displayedCount && state.displayedCount > displayedCount) {
            setDisplayedCount(state.displayedCount);
          }
          setTimeout(() => {
            if (typeof window !== "undefined" && typeof state.scrollY !== "undefined") {
              window.scrollTo(0, state.scrollY);
            }
          }, 50);
        }
        sessionStorage.removeItem("toolsState");
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener('pageshow', tryRestore);
    window.addEventListener('astro:page-load', tryRestore);
    return () => {
      window.removeEventListener('pageshow', tryRestore);
      window.removeEventListener('astro:page-load', tryRestore);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && displayedCount < filteredCards.length) {
          setIsLoading(true);
          // Simulate network delay
          setTimeout(() => {
            setDisplayedCount((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredCards.length));
            setIsLoading(false);
          }, 300);
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [displayedCount, isLoading, filteredCards.length]);

  const displayedCards = filteredCards.slice(0, displayedCount);

  return (
    <section>
      <ul role="list" className="link-card-grid">
        {displayedCards.map(({ url, title, body, tag, "date-added": dateAdded, slug, category }, i) => (
          <Card
            key={`${title}-${i}`}
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
      
      {displayedCount < filteredCards.length && (
        <div ref={loaderRef} className="infinite-scroll-loader">
          {isLoading && (
            <p className="loading-text">Loading more...</p>
          )}
        </div>
      )}
    </section>
  );
}
