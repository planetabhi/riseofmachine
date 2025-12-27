import { navigate } from "astro:transitions/client";
import { useState, useEffect, useRef, useMemo } from "react";
import data from "../data/tools.json";
import "./CategoryNavItem.css";

export default function CategoryNavItem(props) {
  const buttonRef = useRef(null);
  const { title, category, filter } = props;
  const [isActive, setIsActive] = useState(false);

  const handleNavigation = (e) => {
    e.preventDefault();
    // Use simplified URL format: /:category (except 'all' still goes to /)
    const path = category === 'all' ? '/' : `/${category}`;
    navigate(path, {
      history: "push",
      state: { category },
    });
  };

  // Memoize category count to avoid recalculation on every render
  const categoryCount = useMemo(() => {
    if (category === "all") {
      return data.tools.reduce((acc, item) => acc + item.content.length, 0);
    }
    // Use find instead of filter for better performance
    return data.tools.find((item) => item.category === category)?.content.length || 0;
  }, [category]);

  useEffect(() => {
    setIsActive(filter === category);
  }, [filter, category]);

  useEffect(() => {
    if (isActive && buttonRef.current) {
      buttonRef.current.scrollIntoView({
        behavior: "instant",
        block: "nearest",
        inline: "center",
      });
    }
  }, [isActive]);

  return (
    <button
      ref={buttonRef}
      onClick={handleNavigation}
      className={`nav__item nu-u-text--secondary-alt nu-c-fs-small nav__item--filter ${isActive ? "is-active" : ""
        }`}
      aria-label={`Navigate to ${title} category with ${categoryCount} items`}
    >
      {title} <span className="category-count">{categoryCount}</span>
    </button>
  );
}
