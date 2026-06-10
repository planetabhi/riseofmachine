import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import SearchInput from './SearchInput';

function setUrl(search: string) {
    window.history.replaceState(null, '', `/${search}`);
}

describe('SearchInput', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        setUrl('');
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        setUrl('');
    });

    it('initializes empty then hydrates from URL ?q= after mount', () => {
        setUrl('?q=hello');
        render(<SearchInput />);
        const input = screen.getByRole('textbox') as HTMLInputElement;
        // Effect runs synchronously after mount in React 19; value is hydrated.
        expect(input.value).toBe('hello');
    });

    it('debounces dispatch of tools:search and writes to URL', () => {
        const handler = vi.fn();
        window.addEventListener('tools:search', handler as EventListener);

        render(<SearchInput />);
        const input = screen.getByRole('textbox') as HTMLInputElement;

        fireEvent.change(input, { target: { value: 'foo' } });
        // Before debounce fires: input shows value, URL untouched, no event.
        expect(input.value).toBe('foo');
        expect(handler).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(handler).toHaveBeenCalledTimes(1);
        const detail = (handler.mock.calls[0][0] as CustomEvent).detail;
        expect(detail).toEqual({ query: 'foo' });
        expect(new URLSearchParams(window.location.search).get('q')).toBe('foo');

        window.removeEventListener('tools:search', handler as EventListener);
    });

    it('coalesces rapid changes into a single debounced dispatch', () => {
        const handler = vi.fn();
        window.addEventListener('tools:search', handler as EventListener);

        render(<SearchInput />);
        const input = screen.getByRole('textbox') as HTMLInputElement;

        fireEvent.change(input, { target: { value: 'f' } });
        fireEvent.change(input, { target: { value: 'fo' } });
        fireEvent.change(input, { target: { value: 'foo' } });

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(handler).toHaveBeenCalledTimes(1);
        const detail = (handler.mock.calls[0][0] as CustomEvent).detail;
        expect(detail).toEqual({ query: 'foo' });

        window.removeEventListener('tools:search', handler as EventListener);
    });

    it('removes the q param when query is cleared', () => {
        setUrl('?q=foo');
        render(<SearchInput />);
        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('foo');

        const clearBtn = screen.getByLabelText(/clear search/i);
        fireEvent.click(clearBtn);

        // Clear path dispatches immediately (no debounce); URL should drop q.
        expect(input.value).toBe('');
        expect(window.location.search).toBe('');
    });

    it('focuses the input on Cmd+K / Ctrl+K', () => {
        render(<SearchInput />);
        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(document.activeElement).not.toBe(input);

        fireEvent.keyDown(window, { key: 'k', metaKey: true });
        expect(document.activeElement).toBe(input);

        input.blur();
        fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
        expect(document.activeElement).toBe(input);
    });

    it('Escape clears non-empty value and blurs', () => {
        const handler = vi.fn();
        window.addEventListener('tools:search', handler as EventListener);

        render(<SearchInput />);
        const input = screen.getByRole('textbox') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'foo' } });
        input.focus();
        expect(document.activeElement).toBe(input);

        fireEvent.keyDown(window, { key: 'Escape' });

        expect(input.value).toBe('');
        expect(document.activeElement).not.toBe(input);
        // Escape path dispatches synchronously.
        expect(handler).toHaveBeenCalled();

        window.removeEventListener('tools:search', handler as EventListener);
    });

    it('re-syncs from URL on astro:page-load', () => {
        render(<SearchInput />);
        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('');

        setUrl('?q=bar');
        act(() => {
            document.dispatchEvent(new Event('astro:page-load'));
        });

        expect(input.value).toBe('bar');
    });
});
