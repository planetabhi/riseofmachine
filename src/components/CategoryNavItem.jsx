import { navigate } from "astro:transitions/client";
import { useState, useEffect, useRef } from "react";
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

  const getCategoryCount = () => {
    if (category === "all") {
      return data.tools.reduce((acc, item) => acc + item.content.length, 0);
    }

    const navItemData = data.tools.filter((item) => item.category === category);
    return navItemData[0]?.content.length;
  };

  useEffect(() => {
    let subscription = true;

    if (filter === category) {
      setIsActive(true);
    } else {
      setIsActive(false);
    }

    return () => (subscription = !subscription);
  }, [filter]);

  useEffect(() => {
    let subscription = true;
    const activeButton = buttonRef.current.classList.contains("is-active");

    if (activeButton) {
      buttonRef.current.scrollIntoView({
        behavior: "instant",
        block: "nearest",
        inline: "center",
      });
    }

    return () => (subscription = !subscription);
  }, [isActive]);

  return (
    <button
      ref={buttonRef}
      onClick={handleNavigation}
      className={`nav__item nu-u-text--secondary-alt nu-c-fs-small nav__item--filter ${isActive ? "is-active" : ""
        }`}
      aria-label={`Navigate to ${title} category with ${getCategoryCount()} items`}
      dangerouslySetInnerHTML={{
        __html: `${title} <span class="category-count">${getCategoryCount()}</span>`,
      }}
    ></button>
  );
}
