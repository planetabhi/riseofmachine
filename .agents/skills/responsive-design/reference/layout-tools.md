# Modern layout tools

Use intrinsic CSS layout before media queries. Flexbox, Grid, and logical properties handle most adaptation with no breakpoints at all.

```css
/* Flexbox: items flow and wrap as space allows */
.toolbar { display: flex; flex-wrap: wrap; gap: 1rem; }

/* Grid with fr units */
.two-col { display: grid; grid-template-columns: 1fr 3fr; gap: 2rem; }

/* Logical properties adapt to writing direction (right-to-left, vertical) */
.card { margin-inline: auto; padding-block: 1rem; max-inline-size: 65ch; }
```

Use **subgrid** to align nested items so that, for example, every card's title, body, and footer line up across a grid. Subgrid is Baseline: widely available.

```css
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 1.5rem; }
.card  { display: grid; grid-template-rows: subgrid; grid-row: span 3; }
```

## Intrinsic, zero-breakpoint grids

`auto-fit` with `minmax()` builds a grid that reflows by itself. The column count follows the available width with no media query:

```css
/* auto-fit: cards stretch to fill; collapses to 1 column when narrow */
.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: 1.5rem; }

/* auto-fill: keeps empty tracks — use for fixed-size items like icons */
.icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr)); gap: 1rem; }
```

Prefer `auto-fit` for content cards that should grow. Use `auto-fill` when you want a stable column rhythm, such as icon grids or swatches.
