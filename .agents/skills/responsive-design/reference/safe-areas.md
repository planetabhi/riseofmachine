# Safe areas

On notched and rounded displays, pad interactive edges into the safe area so controls clear the notch, home indicator, and landscape cutouts. The `env()` function and the `safe-area-inset-*` variables are Baseline: widely available.

The cutout insets resolve to `0` unless the viewport meta opts into drawing under the cutouts with `viewport-fit=cover`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

```css
.app-bar {
  padding-block-end: max(1rem, env(safe-area-inset-bottom));
}
.content {
  padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
}
```

`max()` guarantees a minimum padding on devices that report zero insets.
