# Layout patterns

Choose a layout pattern before designing. There is no single best one.

- **Mostly Fluid** is a fluid multi-column grid that adds outer margins on large screens and stacks to one column at the narrowest width. Its structure barely changes until the smallest size.
- **Column Drop** is a multi-column layout that drops columns one at a time as width shrinks, until everything is stacked. Element sizes stay roughly constant.
- **Layout Shifter** is the most adaptive pattern. Content genuinely rearranges between breakpoints rather than only reflowing, using different grids per size.
- **Tiny Tweaks** keeps a single column with small adjustments to font size, padding, and image size. It suits text-heavy pages.
- **Off-Canvas** moves secondary content such as navigation, filters, or a context bar off the viewport on small screens behind a toggle, and makes it persistently visible as width grows. Reserve it for global interface elements such as sidebars.

Two component-level moves compose with these patterns:

- **Reflow** stacks horizontally-arranged elements vertically as width drops.
- **Priority+** shows the highest-priority items inline and pushes the rest into an overflow menu, instead of wrapping or hiding arbitrarily.

Never hide content purely because a screen is small. Screen size does not predict what a user wants. Prefer reflow, disclosure, or overflow over deletion.
