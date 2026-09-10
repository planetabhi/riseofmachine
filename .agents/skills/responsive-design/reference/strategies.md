# Responsive strategies

Pick per component. Most real designs mix these strategies.

- **Fluid** sizing flexes continuously with the available space using percentages, `fr`, `minmax()`, and `clamp()`. It needs the fewest breakpoints and scales most smoothly.
- **Adaptive** layouts snap distinct arrangements in at chosen breakpoints.
- **Mobile-first** authoring sets the smallest layout as the default and adds complexity with `min-width` queries. It is preferred because it needs less override CSS and enhances progressively.
- **Content-first** design lets the content's own needs, such as line length and minimum card width, decide where breakpoints fall.
