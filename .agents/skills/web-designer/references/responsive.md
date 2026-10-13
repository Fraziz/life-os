# Web Designer Reference: Responsive & Fluid Layouts

Responsive design should feel native on every screen size without fragile breakpoint clutter.

---

## 1. Breakpoint Philosophy

Instead of writing 15 separate media queries, build intrinsically responsive components with fluid CSS functions (`clamp()`, `min()`, `max()`) and CSS Grid.

### Standard Breakpoints (When media queries are needed)
* **Mobile Small**: `< 480px`
* **Mobile / Phablet**: `< 640px`
* **Tablet / Portrait**: `< 768px`
* **Desktop Small / Laptop**: `< 1024px`
* **Desktop Wide**: `> 1280px`

---

## 2. Intrinsically Responsive CSS Grid

Never write:
```css
/* Bad: Fixed columns that break on mobile */
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
}
```

Write:
```css
/* Good: Automatically reflows from 1 column on mobile to 3 columns on desktop */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: var(--space-4);
}
```
* `min(100%, 280px)` prevents overflow on devices with screens narrower than 280px (e.g., small smartwatches or narrow side panels).

---

## 3. Fluid Spacing and Typography

Use `clamp()` to scale smoothly between mobile and desktop without sudden layout jumps:

```css
/* Fluid container padding */
.mainContent {
  padding: clamp(1rem, 0.75rem + 1vw, 2.5rem);
  max-width: 1280px;
  margin: 0 auto;
  width: 100%;
}

/* Fluid hero headline */
.heroTitle {
  font-size: clamp(1.75rem, 1.4rem + 1.5vw, 2.75rem);
  line-height: 1.15;
  letter-spacing: -0.02em;
}
```

---

## 4. Mobile Ergonomics & Thumb Zone

On screens `< 768px`:
1. **Touch Target Size**: Interactive elements (buttons, links, select inputs) must be at least `44px × 44px` with minimum `8px` spacing between targets.
2. **Bottom-Weighted Navigation**: Primary actions and bottom sheets should sit in the lower 40% of the screen where thumbs naturally rest.
3. **No Horizontal Scroll**: Always verify `overflow-x: hidden` on the root viewport container or check children width to prevent horizontal drift:
   ```css
   html, body {
     max-width: 100vw;
     overflow-x: hidden;
   }
   ```
4. **Sticky Topbar Blur**:
   ```css
   .topBar {
     position: sticky;
     top: 0;
     z-index: var(--z-sticky);
     background: rgba(245, 244, 239, 0.85); /* Matches theme background */
     backdrop-filter: blur(12px);
     -webkit-backdrop-filter: blur(12px);
     border-bottom: 1px solid var(--color-border);
   }
   ```

---

## 5. Responsive Data Tables & Lists

Tables often break on mobile. Use these two strategies:
1. **Card Transformation on Mobile**:
   ```css
   @media (max-width: 640px) {
     .tableRow {
       display: flex;
       flex-direction: column;
       padding: var(--space-3);
       border: 1px solid var(--color-border);
       border-radius: var(--radius-md);
       margin-bottom: var(--space-2);
     }
   }
   ```
2. **Horizontal Scroll Container with Visual Hint**:
   ```css
   .tableWrapper {
     overflow-x: auto;
     -webkit-overflow-scrolling: touch;
     border: 1px solid var(--color-border);
     border-radius: var(--radius-lg);
   }
   ```
