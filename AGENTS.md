<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Life OS — Agent Guidelines & Architecture Rules

## 1. Design & UI/UX Principles (Active Skill: `web-designer`)
* **Executive Aesthetics**: Calm, warm, high-craft visual design. Minimalist and distraction-free.
* **No Icon Bloat / Emojis**: Never use loud, tacky emoji headers or cluttered icon soup in navigation. Use clean typography, crisp borders, and subtle micro-dots (e.g. status indicators).
* **No Left-Side Border Stripes / Box Colors**: Never use colored left-side borders or stripes (`border-left: 2px/3px solid ...`) on cards, boxes, banners, or list rows. All containers and cards must have clean, uniform, all-around subtle borders (`border: 1px solid var(--color-border-subtle)`), using subtle background highlights (`var(--color-surface-2)`) for active states instead.
* **Styling Technology**: Use **CSS Modules** (`*.module.css`) and native CSS custom properties defined in `src/app/globals.css`. **Do NOT use TailwindCSS**.
* **Color Harmony & Tokens**: Use existing theme tokens (`--color-bg`, `--color-surface`, `--color-border`, `--color-accent`, etc.) to support all themes (`nature`, `light`, `dark`, `cyber`).
* **Responsiveness**: Always use fluid containers, intrinsic CSS Grid (`minmax(min(100%, 280px), 1fr)`), and responsive padding with `clamp()`.

## 2. Cognitive Usability & ADHD Optimization
* **Single Focal Anchor**: Each screen must emphasize one clear primary action or metric.
* **Progressive Disclosure**: Group actions into clean contextual cards; keep default views serene and uncluttered.
* **Touch & Keyboard Ergonomics**: Minimum 44×44px interactive tap targets; preserve `:focus-visible` outlines.

## 3. Technology Stack & Code Conventions
* **Framework**: Next.js App Router (TypeScript, React 19).
* **State Management**: React Context providers with clean synchronization to local storage / cloud sync.
* **Performance**: Animate only GPU-accelerated properties (`opacity`, `transform`). No layout shifts.
