import { useEffect } from 'react';
import './CategoryNav.css';
import data from '../data/tools.json';
import CategoryNavItem from './CategoryNavItem';
import type { Category } from '../types';

interface CategoryNavProps {
    filter: string;
}

interface NavItem {
    title: string;
    category: string;
}

export default function CategoryNav({ filter }: CategoryNavProps) {
    const navItems: NavItem[] = [
        { title: 'All Tools', category: 'all' },
        ...(data.tools as Category[]).map(cat => ({
            title: cat.title,
            category: cat.category,
        })),
    ];

    useEffect(() => {
        const nav = document.querySelector('.category-nav');
        const leftFade = document.querySelector('.nav-fade-left');
        const rightFade = document.querySelector('.nav-fade-right');

        if (!nav || !leftFade || !rightFade) return;

        function checkScroll() {
            if (!nav) return;
            if ((nav as HTMLElement).scrollLeft > 0) {
                leftFade?.classList.add('show');
            } else {
                leftFade?.classList.remove('show');
            }

            if ((nav as HTMLElement).scrollLeft >= (nav as HTMLElement).scrollWidth - (nav as HTMLElement).clientWidth - 5) {
                rightFade?.classList.add('hide');
            } else {
                rightFade?.classList.remove('hide');
            }
        }

        const handleLeftClick = () => {
            (nav as HTMLElement).scrollBy({ left: -200, behavior: 'smooth' });
        };

        const handleRightClick = () => {
            (nav as HTMLElement).scrollBy({ left: 200, behavior: 'smooth' });
        };

        nav.addEventListener('scroll', checkScroll);
        leftFade.addEventListener('click', handleLeftClick);
        rightFade.addEventListener('click', handleRightClick);

        checkScroll();

        return () => {
            nav.removeEventListener('scroll', checkScroll);
            leftFade.removeEventListener('click', handleLeftClick);
            rightFade.removeEventListener('click', handleRightClick);
        };
    }, []);

    return (
        <div className="category-nav-container">
            <nav className="category-nav" aria-label="Categories">
                {navItems.map((c, i) => (
                    <CategoryNavItem
                        key={i}
                        title={c.title}
                        category={c.category}
                        filter={filter}
                    />
                ))}
            </nav>

            <button
                type="button"
                className="nav-fade nav-fade-left"
                aria-label="Scroll categories left"
                tabIndex={-1}
            >
                <svg className="nav-arrow-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" aria-hidden="true">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="m16 20-8-8 8-8" />
                </svg>
            </button>

            <button
                type="button"
                className="nav-fade nav-fade-right"
                aria-label="Scroll categories right"
                tabIndex={-1}
            >
                <svg className="nav-arrow-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" aria-hidden="true">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="m8 20 8-8-8-8" />
                </svg>
            </button>
        </div>
    );
}
