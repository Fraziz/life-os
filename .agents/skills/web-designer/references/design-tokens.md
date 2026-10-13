# Web Designer Reference: Design Tokens System

A cohesive token architecture ensures visual consistency across all themes and viewports.

## 1. Color Palette Tokens

```css
:root {
  /* Surfaces & Backgrounds */
  --color-bg:             #f5f4ef; /* Main background */
  --color-surface:        #ffffff; /* Primary card surface */
  --color-surface-2:      #f0eee6; /* Nested surface / header */
  --color-surface-3:      #e7e3d8; /* Subtle track / pill */
  --color-surface-hover:  #eae6dc; /* Hover state on surface */

  /* Structural Borders */
  --color-border:         #e8e4dc; /* Card & divider border */
  --color-border-subtle:  #f0eee8; /* Inset border */
  --color-border-focus:   #2d3748; /* Active / focus border */

  /* High-Contrast Typography */
  --color-text:           #1f2937; /* Primary reading text (80%+ contrast) */
  --color-text-muted:     #6b7280; /* Secondary metadata */
  --color-text-faint:     #9ca3af; /* Disabled / subtle captions */
  --color-text-inverse:   #ffffff; /* Contrast on dark accents */

  /* Accents & Brand Actions */
  --color-accent:         #2d3748; /* Primary action button / brand */
  --color-accent-light:   #4a5568; /* Hover on brand button */
  --color-accent-dim:     rgba(45, 55, 72, 0.08); /* Active badge / chip bg */
  --color-accent-glow:    rgba(45, 55, 72, 0.20);

  /* Status Feedback Indicators */
  --color-success:        #10b981;
  --color-success-dim:    rgba(16, 185, 129, 0.12);
  --color-warning:        #f59e0b;
  --color-warning-dim:    rgba(245, 158, 11, 0.12);
  --color-danger:         #ef4444;
  --color-danger-dim:     rgba(239, 68, 68, 0.12);
  --color-info:           #3b82f6;
  --color-info-dim:       rgba(59, 130, 246, 0.12);
}
```

## 2. Spacing Scale (4px System)

Always use these spacing tokens to avoid arbitrary pixel values:

| Token | Pixels | Rem | Typical Usage |
| :--- | :--- | :--- | :--- |
| `--space-1` | 4px | 0.25rem | Icon gaps, micro tags |
| `--space-2` | 8px | 0.5rem | Button padding vertical, list item gap |
| `--space-3` | 12px | 0.75rem | Compact card padding, form input vertical |
| `--space-4` | 16px | 1.0rem | Standard card padding, button padding horizontal |
| `--space-5` | 20px | 1.25rem | Section spacing inside cards |
| `--space-6` | 24px | 1.5rem | Standard page grid gap, modal padding |
| `--space-8` | 32px | 2.0rem | Major section separation |
| `--space-12`| 48px | 3.0rem | Hero padding, dashboard top margin |

## 3. Radii & Soft Curves

```css
:root {
  --radius-xs:   0.25rem;  /* 4px - Small badges */
  --radius-sm:   0.375rem; /* 6px - Dropdowns, tooltip */
  --radius-md:   0.625rem; /* 10px - Inputs, buttons */
  --radius-lg:   0.875rem; /* 14px - Standard cards */
  --radius-xl:   1.125rem; /* 18px - Modals, featured blocks */
  --radius-2xl:  1.5rem;   /* 24px - Shell containers */
  --radius-full: 9999px;   /* Pills, status dots */
}
```

## 4. Layering & Elevation

```css
:root {
  /* Box Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 14px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 10px 30px rgba(0, 0, 0, 0.12);
  --shadow-xl: 0 20px 50px rgba(0, 0, 0, 0.18);

  /* Z-Index Hierarchy */
  --z-base:     0;
  --z-raised:   10;
  --z-dropdown: 100;
  --z-sticky:   200;
  --z-overlay:  300;
  --z-modal:    400;
  --z-toast:    500;
}
```
