# Media queries versus container queries

Media queries respond to the viewport. Container queries respond to a component's own container, so one component adapts correctly wherever it is placed, whether in the main column, a narrow sidebar, or a modal. Container size queries are Baseline: widely available.

| | Media queries | Container queries |
| --- | --- | --- |
| Responds to | Viewport / device | Nearest query container |
| Best for | Page-level layout | Reusable components |
| Portability | Context-dependent | Truly portable |

```css
/* Establish a containment context on the parent */
.card-host { container-type: inline-size; container-name: card; }

/* Card restyles based on ITS container, not the screen */
@container card (min-width: 25rem) {
  .card { display: grid; grid-template-columns: 8rem 1fr; }
}
```

A container query silently does nothing if no ancestor declares `container-type`. This is a common Serious bug. When sizing inside a container, use the logical units `cqi` for inline and `cqb` for block, not `cqw` or `cqh`, so they follow writing direction and stay internationalization-safe.

As a general rule, use media queries for the page skeleton and container queries for the components inside it.
