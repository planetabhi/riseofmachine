# Set the foundation

Every responsive page needs a correct viewport meta tag. Without it, mobile browsers render at a fake ~980px width and shrink everything.

```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

Never add `user-scalable=no`, `maximum-scale=1`, or `minimum-scale=1`. Blocking zoom is a Critical accessibility failure (WCAG 1.4.4, 1.4.10). Users with low vision must be able to pinch-zoom.

Use a border-box model and fluid media so nothing forces horizontal scroll:

```css
*, *::before, *::after { box-sizing: border-box; }

img, picture, video, canvas, svg {
  display: block;
  max-width: 100%;
  height: auto;
}
```

Always keep the intrinsic `width` and `height` attributes on `<img>` so the browser reserves space and avoids layout shift, even with `height: auto` in CSS.

For full-height regions, avoid `100vh` on mobile. It can exceed the visible area under dynamic browser UI and clip content. Use `100dvh`, which follows the shrinking or growing browser UI, or `100svh`, the smallest and safest. The `dvh`, `svh`, and `lvh` units are Baseline: widely available.
