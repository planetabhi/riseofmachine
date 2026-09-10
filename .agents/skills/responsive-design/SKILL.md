---
name: responsive-design
description: >
  Load this skill for any project with a user interface that must work across screen sizes and input methods, such as websites, web apps, dashboards, marketing pages, emails, or design systems. Use when building or reviewing layouts, choosing breakpoints, setting up fluid type, sizing touch targets, or making components adapt to their container. One design must serve phones, tablets, laptops, desktops, touch, mouse, and keyboard. Prefers content-first, mobile-first, framework-agnostic CSS and Baseline-stable features.
---

# Responsive design

Apply these rules to every layout and interactive surface. Examples are framework-agnostic CSS. They translate directly to any framework or utility system. A responsive interface adapts to the viewport, the container, the input method, and the user's own settings, not to a fixed list of devices. The detailed rules and code examples are bundled under `./reference/`. Read the relevant file before applying or citing a rule.

## Core mandate

Design for content and constraints, not for named devices. A layout is responsive when it stays usable and readable at any width from ~320px to ultra-wide, in both orientations, at up to 400% zoom, under touch or pointer, and while respecting the user's font-size, motion, and color-scheme preferences. Start from the smallest reasonable width and enhance upward, an approach called mobile-first. This yields less CSS and a working baseline everywhere.

Never key layout decisions to device brands, operating systems, or product names. Those change and multiply. Let the content decide when the layout needs to change.

## Confirmation

When you are only reviewing, report findings without pausing. Before applying edits to existing files, confirm the intended change set first, and ask for any context you need to judge correctly instead of guessing.

## Severity scale

| Level | Meaning |
| --- | --- |
| **Critical** | Content is unreachable, unreadable, or unusable at a common size or input |
| **Serious** | Major friction from horizontal scroll, clipped content, or unusable targets |
| **Moderate** | Noticeable friction with a workaround |
| **Minor** | Polish gap with marginal impact |

Judge severity by the real effect on the task at a real size and input, not by the rule alone. When reviewing statically, viewport behavior, zoom, orientation, and touch response cannot be confirmed by reading code, so mark those as pending verification rather than passed.

## Reference map

The rules and code examples are bundled under `./reference/`. Read the relevant file before applying or citing a rule.

- Foundations:
   - [reference/foundation.md](./reference/foundation.md) — Set the foundation
   - [reference/strategies.md](./reference/strategies.md) — Responsive strategies
   - [reference/breakpoints.md](./reference/breakpoints.md) — Breakpoints are conventions, not standards
- Layout:
   - [reference/layout-tools.md](./reference/layout-tools.md) — Modern layout tools
   - [reference/container-queries.md](./reference/container-queries.md) — Media queries versus container queries
   - [reference/layout-patterns.md](./reference/layout-patterns.md) — Layout patterns
- Input and ergonomics:
   - [reference/input-methods.md](./reference/input-methods.md) — Input-method adaptation
   - [reference/safe-areas.md](./reference/safe-areas.md) — Safe areas
- Content:
   - [reference/typography.md](./reference/typography.md) — Responsive typography
   - [reference/images.md](./reference/images.md) — Responsive images
   - [reference/user-preferences.md](./reference/user-preferences.md) — User preferences
- Testing:
   - [reference/checklist.md](./reference/checklist.md) — Testing checklist

## Anti-patterns

- Breakpoints named for devices or operating systems instead of content.
- Fixed pixel widths that force horizontal scroll on small screens.
- Hover-only controls with no pointer or keyboard equivalent.
- `width: 100vw`, which ignores the scrollbar and overflows.
- Disabling zoom with `user-scalable=no` or a `maximum-scale` cap.

---

Authored by @planetabhi
