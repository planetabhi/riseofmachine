# Responsive typography

Scale type fluidly with `clamp()`, but always anchor to `rem` so the user's font-size preference is respected. Viewport-only sizing such as `font-size: 4vw` is a Serious accessibility failure. It ignores user settings and can defeat zoom.

```css
:root {
  --step-0: clamp(1rem,   0.9rem + 0.5vw, 1.25rem);   /* body */
  --step-2: clamp(1.5rem, 1rem   + 2vw,   2.5rem);    /* heading */
}
h2 { font-size: var(--step-2); }
p  { font-size: var(--step-0); max-inline-size: 65ch; } /* ~66 char lines */
```

Constrain line length, known as the measure, to roughly 45 to 75 characters (`ch`) for readability. Add a breakpoint or `max-inline-size` when lines grow past about 10 words. For component-scoped text, combine `clamp()` with `cqi` inside a container.
