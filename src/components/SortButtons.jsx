import { useState } from "react";
import "./SortButtons.css";

export default function SortButtons({ onSortChange, onRandomSeed }) {
  const [sortMode, setSortMode] = useState("nameAsc"); // nameAsc, nameDesc, random
  const [randomSeed, setRandomSeed] = useState(0); // Force re-sort on each random click

  const handleNameToggle = () => {
    const nextMode = sortMode === "nameAsc" ? "nameDesc" : "nameAsc";
    setSortMode(nextMode);
    if (onSortChange) onSortChange(nextMode);
    // Broadcast a global event so header buttons can communicate with the dashboard
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tools:sort-change", { detail: { sort: nextMode } }));
    }
  };

  const handleRandom = () => {
    setSortMode("random");
    // Increment seed to force a new random shuffle
    const newSeed = randomSeed + 1;
    setRandomSeed(newSeed);
    if (onSortChange) onSortChange("random");
    if (onRandomSeed) onRandomSeed(newSeed);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tools:sort-change", { detail: { sort: "random", randomSeed: newSeed } }));
    }
  };

  return (
    <div className="sort-buttons-group">
      <button
        className="sort-icon-btn"
        onClick={handleNameToggle}
        title={sortMode === "nameAsc" ? "Sort Z → A" : "Sort A → Z"}
        aria-label={sortMode === "nameAsc" ? "Sort Z to A" : "Sort A to Z"}
      >
        {/* Sort icon */}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" className="sort-icon">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="1" d="m11 17-4 4m0 0-4-4m4 4V3m14 4-4-4m0 0-4 4m4-4v18" />
        </svg>
      </button>

      <button
        className="sort-icon-btn"
        onClick={handleRandom}
        title="Shuffle randomly"
        aria-label="Shuffle randomly"
      >
        {/* Shuffle icon */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 6.75H5.16188C6.11693 6.74998 7.0582 6.97794 7.90741 7.41494C8.75662 7.85194 9.48925 8.48535 10.0444 9.2625L13.9556 14.7375C14.5108 15.5147 15.2434 16.1481 16.0926 16.5851C16.9418 17.0221 17.8831 17.25 18.8381 17.25H21.75M21.75 17.25L19.5 15M21.75 17.25L19.5 19.5M19.5 4.5L21.75 6.75M21.75 6.75L19.5 9M21.75 6.75H18.8381C17.8831 6.74998 16.9418 6.97794 16.0926 7.41494C15.2434 7.85194 14.5108 8.48535 13.9556 9.2625L13.8431 9.41906M3 17.25H5.16188C6.11693 17.25 7.0582 17.0221 7.90741 16.5851C8.75662 16.1481 9.48925 15.5147 10.0444 14.7375L10.1569 14.5809" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>

      </button>
    </div>
  );
}
