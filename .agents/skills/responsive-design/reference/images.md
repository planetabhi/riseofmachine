# Responsive images

Serve appropriately sized images and, where the composition needs it, different crops per breakpoint.

```html
<!-- Resolution switching: browser picks a file for the rendered size -->
<img
  src="photo-800.jpg"
  srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1600.jpg 1600w"
  sizes="(min-width: 48rem) 50vw, 100vw"
  width="1600" height="900" alt="…" />

<!-- Art direction: different crop/aspect per breakpoint -->
<picture>
  <source media="(min-width: 48rem)" srcset="hero-wide.jpg" />
  <img src="hero-square.jpg" width="800" height="800" alt="…" />
</picture>
```

Keep `width` and `height`, or `aspect-ratio`, to reserve space and prevent layout shift. Provide meaningful `alt` text.
