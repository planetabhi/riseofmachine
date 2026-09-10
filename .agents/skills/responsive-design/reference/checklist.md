# Testing checklist

- [ ] Correct `<meta name="viewport">`; zoom is not disabled.
- [ ] No horizontal scroll from ~320px up to ultra-wide.
- [ ] Layout works in both portrait and landscape.
- [ ] Readable and operable at 200% and 400% zoom (WCAG 1.4.4, 1.4.10).
- [ ] Type scales with `clamp()` and `rem`; measure stays about 45 to 75ch.
- [ ] Touch targets meet the required standard, with adequate spacing.
- [ ] Nothing essential is hover-only; gestures have button fallbacks.
- [ ] Container-scoped components tested in narrow and wide containers.
- [ ] Images use `srcset` and `sizes` (or `<picture>`) and reserve space.
- [ ] Safe-area insets applied on edge-anchored controls.
- [ ] `prefers-reduced-motion` and `prefers-color-scheme` honored.
- [ ] `100dvh` or `100svh` used instead of `100vh` for full-height regions.
- [ ] Verified on real devices, not just a resized desktop browser.
