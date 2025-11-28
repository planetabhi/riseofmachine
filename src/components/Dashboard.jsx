import { useEffect, useState } from "react";
import CategoryNav from "./CategoryNav";
import CardsContainer from "./CardsContainer";

export default function Dashboard({ category }) {
  const [currentCategory, setCurrentCategory] = useState(category);
  const [currentSort, setCurrentSort] = useState("nameAsc");
  const [randomSeed, setRandomSeed] = useState(0);

  useEffect(() => {
    setCurrentCategory(category);
  }, [category]);

  // Listen for global sort events dispatched by header SortButtons
  useEffect(() => {
    const handleSortChange = (e) => {
      const detail = e?.detail || {};
      if (detail.sort) setCurrentSort(detail.sort);
      if (typeof detail.randomSeed !== "undefined") setRandomSeed(detail.randomSeed);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("tools:sort-change", handleSortChange);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("tools:sort-change", handleSortChange);
      }
    };
  }, []);

  return (
    <>
      <CategoryNav filter={category} />
      <CardsContainer filter={category} sort={currentSort} randomSeed={randomSeed} />
    </>
  );
}
