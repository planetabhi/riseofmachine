# Breakpoints are conventions, not standards

There is no official set of breakpoints. Popular frameworks disagree, which proves these are conventions rather than rules:

| Framework | Breakpoints (min-width) |
| --- | --- |
| Tailwind | 640 / 768 / 1024 / 1280 / 1536 |
| Bootstrap 5 | 576 / 768 / 992 / 1200 / 1400 |
| MUI | 600 / 900 / 1200 / 1536 |

Do not copy a table without evaluating your own content. Start small, widen the viewport until the layout looks strained, such as too-long lines or awkward gaps, and add a breakpoint there. Verify with browser DevTools device mode. Prefer `min-width` queries for a mobile-first default:

```css
/* Mobile-first: default is the small layout */
.layout { display: flex; flex-direction: column; gap: 1rem; }

@media (min-width: 48rem) {        /* ~768px */
  .layout { flex-direction: row; }
}
```

Use `rem`-based breakpoints so they scale with the user's font size.
