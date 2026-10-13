# Web Designer Reference: Design Anti-Patterns Checklist

Avoid these common visual and UX pitfalls that cheapen web applications.

---

## 1. Visual & Aesthetic Anti-Patterns

| Anti-Pattern | Why it Fails | What to Do Instead |
| :--- | :--- | :--- |
| **Pure `#000000` text on `#ffffff`** | Causes harsh eye strain and jarring optical glare. | Use deep charcoal (`#111827`, `#1f2937`) or warm slate. |
| **Saturated neon primaries** | Distracting and looks like a toy or amateur site. | Use curated, muted tones (`#2d3748`, `#3b82f6`, `#10b981`) with soft alphas. |
| **Emoji soup in navigation** | Emojis look different on every OS and look informal/childish. | Use clean typographic labels and minimal subtle micro-dots or SVG icons. |
| **Heavy dark borders (`#000000`)** | Slices the screen into harsh boxes. | Use subtle borders (`1px solid rgba(0,0,0,0.08)` or theme tokens). |
| **Arbitrary spacing (`margin: 17px`)** | Creates subconscious visual imbalance. | Stick strictly to the 4px/8px design scale (4, 8, 12, 16, 24, 32, 48px). |

---

## 2. Interaction & Layout Anti-Patterns

| Anti-Pattern | Why it Fails | What to Do Instead |
| :--- | :--- | :--- |
| **Sudden layout shifts (CLS)** | Frustrating when elements jump as data or fonts load. | Reserve aspect ratios, use skeleton loaders with matching dimensions. |
| **Invisible hover states** | Users don't know what is clickable. | Subtle scale, background tint, or elevation on hover (`translateY(-1px)`). |
| **No `:focus-visible` styling** | Breaks accessibility for keyboard and screen reader users. | Distinct 2px outline offset with theme accent color. |
| **Tiny touch targets (<36px)** | Causes missed taps on mobile and tablet. | Ensure all touch targets are `≥ 44px × 44px` padding box. |
| **Cluttered headers & topbars** | Cognitive overload, especially for ADHD users. | Keep topbars minimal: single title, global search trigger, user avatar/sync status. |
| **Non-semantic HTML tags** | Using `<div onClick=...>` without role or tabIndex. | Use `<button>` for actions, `<a>` for links, `<nav>` for menus. |

---

## 3. Cognitive Load & ADHD Anti-Patterns

* **Wall of options**: Do not display 20 competing buttons on screen simultaneously. Use progressive disclosure.
* **Flashing alerts**: Avoid aggressive pulsating animations unless it is a critical system emergency.
* **Loss of context**: When switching tabs or modals, preserve search queries and filters so users never lose their place.
