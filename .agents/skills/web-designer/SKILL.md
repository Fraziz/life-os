---
name: web-designer
description: >-
  Master UI/UX and frontend design system engineering. Use this skill whenever creating,
  styling, refactoring, or reviewing web user interfaces, responsive layouts, design tokens,
  typography, micro-interactions, accessibility (a11y), and CSS module architecture.
---

# Master Web Designer Skill & UI/UX Design System

This skill equips the agent with executive-tier web design principles, modern CSS engineering, and cognitive-friendly UX architectures. Use it to build beautiful, modern, responsive, and distraction-free web applications.

---

## 1. Core Visual Principles

### A. Executive Craft & Aesthetic Restraint
* **No Visual Clutter**: Avoid juvenile clip-art, excessive emojis in navigation, or garish rainbow borders. Use clean typography, crisp borders, and subtle status indicators (e.g., a 6px glowing dot instead of a loud icon).
* **Intentional Depth & Elevation**:
  * Level 0 (Canvas): Background tone (`--color-bg`).
  * Level 1 (Card/Surface): Crisp container with `1px solid var(--color-border)` and soft shadow (`0 2px 8px rgba(0,0,0,0.04)`).
  * Level 2 (Elevated/Hover): Subtle translate `-1px` or `-2px` with expanded shadow (`0 8px 24px rgba(0,0,0,0.08)`).
  * Level 3 (Modal/Popover): Deep focus shadow with backdrop blur (`backdrop-filter: blur(12px)`).
* **The 60-30-10 Harmony Rule**:
  * **60%**: Dominant neutral canvas & surfaces (backgrounds, card fills).
  * **30%**: Structural elements (subtle dividers, text hierarchies, secondary buttons).
  * **10%**: High-contrast accent color (primary CTAs, active indicators, focus rings).

### B. Cognitive-Friendly & ADHD-Optimized Layouts
* **Visual Anchors**: Every view must have exactly one primary focal point (e.g. today's primary action, central metric, or active document).
* **Chunking**: Group related controls into cohesive card clusters with distinct paddings (`16px` to `24px`).
* **Progressive Disclosure**: Keep default views serene. Move secondary actions behind clean dropdowns or keyboard shortcuts (`⌘K` / `/` search).
* **Predictable Hit Targets**: Minimum 40×40px interactive hit area on touch and pointer targets.

---

## 2. Typography Mastery

1. **Font System**:
   * **Sans-serif (UI & Body)**: `Inter`, system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`).
   * **Monospace (Data, Stats, Code, Timers)**: `JetBrains Mono`, `ui-monospace`, `monospace` for tabular number alignment (`font-variant-numeric: tabular-nums`).
   * **Optional Editorial Serif (Headings)**: `Playfair Display`, `Georgia`, or serif for warm, literary touches.
2. **Fluid Typography Formula**:
   * Hero Heading: `font-size: clamp(1.75rem, 1.5rem + 1.25vw, 2.5rem);`
   * Section Title: `font-size: clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem);`
   * Body Text: `font-size: 0.9375rem; /* 15px */ line-height: 1.55;`
   * Meta / Captions: `font-size: 0.8125rem; /* 13px */ letter-spacing: 0.01em;`
3. **Contrast Compliance**:
   * Text on background must meet **WCAG 2.1 AA** (4.5:1 minimum, 7:1 for faint meta).
   * Never use low-contrast grey on grey for functional information.

---

## 3. Responsive Layout & Modern CSS Architecture

### Responsive Layout Strategy
1. **Never use rigid fixed pixel widths** for content containers.
2. **Fluid Grid without Media Queries**:
   ```css
   .gridAutoFit {
     display: grid;
     grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
     gap: 1rem;
   }
   ```
3. **Container Queries**:
   ```css
   .cardContainer {
     container-type: inline-size;
   }
   @container (max-width: 420px) {
     .cardContent {
       flex-direction: column;
       align-items: flex-start;
     }
   }
   ```
4. **Mobile Navigation Rule**:
   * Desktop: Persistent sidebar or horizontal header.
   * Mobile (<768px): Collapsed drawer or fixed bottom navigation bar with thumb-friendly spacing.

---

## 4. Micro-Interactions & Animation Guidelines

* **Animation Speed**:
  * Fast micro-feedback (hover, button click): `120ms - 180ms ease`.
  * Surface transitions (modal open, sidebar toggle, tab switch): `240ms - 320ms cubic-bezier(0.16, 1, 0.3, 1)` (snappy ease-out).
* **GPU-Accelerated Only**:
  * Only animate `transform`, `opacity`, and `filter`.
  * Never animate `width`, `height`, `top`, `left`, or `margin` to prevent layout reflows (jank).
* **Focus States**:
  * Never remove `:focus` without providing `:focus-visible`:
  ```css
  :focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  ```

---

## 5. Standard Component Blueprints

When building or styling components, follow the reference patterns:
* [Design Tokens & Theme Variables](./references/design-tokens.md)
* [Component Blueprints & CSS Modules](./references/components.md)
* [Responsive & Mobile-First Patterns](./references/responsive.md)
* [Design Anti-Patterns Checklist](./references/anti-patterns.md)

---

## 6. Implementation Checklist for New Pages/Components

Before declaring any UI task complete, verify:
- [ ] **Contrast & Readability**: Is text clearly legible in all active themes?
- [ ] **Viewport Resilience**: Does it look great at 375px (iPhone SE), 768px (Tablet), 1024px, and 1440px+?
- [ ] **Empty States**: Does the view look intentional when there is 0 items of data?
- [ ] **Loading States**: Are skeletons or clean indicators used instead of blank screen flashes?
- [ ] **Hover & Focus**: Do all interactive elements have immediate hover, active, and keyboard-focus states?
- [ ] **Zero Layout Shifts**: Are image and icon dimensions explicitly defined?
