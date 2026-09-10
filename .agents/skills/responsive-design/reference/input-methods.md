# Input-method adaptation

You cannot assume the user's input method, whether touch, mouse, trackpad, stylus, or keyboard, and many devices offer several. Adapt to capability, not assumption.

## Target size

Three standards apply. Use the strictest your context requires.

| Standard | Minimum | Notes |
| --- | --- | --- |
| WCAG 2.2 SC 2.5.8 (AA) | 24×24 CSS px | Or smaller if there is at least 24px spacing to neighbors, plus inline and essential exceptions |
| Apple HIG | 44×44 pt | iOS, iPadOS, watchOS |
| Material 3 | 48×48 dp touch | At least 8dp spacing, with pointer targets at least 44dp |

WCAG 24px is a floor for compliance. 44px to 48px is the ergonomic target for primary touch actions. Expand a small visual control's tappable area with padding rather than shrinking the hit target:

```css
/* 24px icon, 44px tap area via padding */
.icon-button { inline-size: 24px; block-size: 24px; padding: 10px; }

/* Primary touch controls */
.button { min-block-size: 44px; padding: 0.75rem 1rem; }
```

## Adapt to pointer capability, not screen size

Use pointer and hover media features instead of assuming that a small screen means touch:

```css
/* Coarse pointer (finger): give roomier targets */
@media (pointer: coarse) {
  .button { min-block-size: 48px; }
}

/* Only decorate with hover where hover truly exists */
@media (hover: hover) {
  .card:hover { box-shadow: 0 0 0 2px currentColor; }
}
```

Never gate essential information or actions behind `:hover` alone. Touch and keyboard users cannot hover. Treat swipe, long-press, and other gestures as enhancements, and always provide a visible button alternative.

## Thumb zones

On phones held one-handed, the bottom third of the screen is the easy-reach zone, and the top is hardest. Put primary navigation and actions within reach. Prefer a bottom tab bar over a top-only navigation, and place a floating action button at the bottom-right for the right-handed majority.
