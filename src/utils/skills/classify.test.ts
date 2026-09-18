import { describe, it, expect } from 'vitest';
import { classifySkill, tokenize } from './classify';

describe('tokenize', () => {
    it('splits camelCase, hyphens, and punctuation', () => {
        expect(tokenize('reactHooks-guide')).toEqual(['react', 'hooks', 'guide']);
    });

    it('returns an empty array for empty input', () => {
        expect(tokenize('')).toEqual([]);
        expect(tokenize(undefined)).toEqual([]);
    });
});

describe('classifySkill', () => {
    it('classifies a database skill as databases (primary first)', () => {
        const cats = classifySkill('postgres-migrations', 'Manage SQL database schema migrations for Postgres.');
        expect(cats[0]).toBe('databases');
    });

    it('classifies a React skill as react', () => {
        expect(classifySkill('react-hooks', 'Best practices for React hooks and context.')).toContain('react');
    });

    it('matches multi-word keywords as an ordered sequence', () => {
        expect(classifySkill('routing-helper', 'Uses the Next.js app router and server component patterns.')).toContain(
            'nextjs',
        );
    });

    it('returns an empty array when nothing matches', () => {
        expect(classifySkill('zzz-widget', 'A nondescript gadget.')).toEqual([]);
    });

    it('caps the number of categories at three', () => {
        const cats = classifySkill(
            'everything',
            'react hooks tailwind css design testing vitest database sql marketing seo mobile ios',
        );
        expect(cats.length).toBeLessThanOrEqual(3);
    });
});
