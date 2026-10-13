# Web Designer Reference: Component Blueprints

Modern, clean, CSS Module-ready blueprints for essential web components.

---

## 1. Executive Card with Subtle Elevation

```css
/* Card.module.css */
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-base), box-shadow var(--transition-base), border-color var(--transition-base);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-border-focus);
}

.cardHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
  gap: var(--space-3);
}

.cardTitle {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
  margin: 0;
}

.cardBody {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  line-height: 1.5;
}
```

---

## 2. Metric / KPI Stat Card

```css
/* StatCard.module.css */
.statCard {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.statLabel {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: var(--weight-semibold);
  color: var(--color-text-muted);
}

.statValue {
  font-family: var(--font-mono);
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  color: var(--color-text);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.statChange {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.statPositive {
  color: var(--color-success);
}

.statNegative {
  color: var(--color-danger);
}
```

---

## 3. Executive Button Hierarchy

```css
/* Buttons.module.css */
.btnBase {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid transparent;
  outline: none;
  user-select: none;
  min-height: 38px;
}

.btnBase:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Primary CTA */
.btnPrimary {
  background: var(--color-accent);
  color: var(--color-text-inverse);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.btnPrimary:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
}

.btnPrimary:active {
  transform: translateY(0);
}

/* Secondary / Outline */
.btnSecondary {
  background: var(--color-surface);
  color: var(--color-text);
  border-color: var(--color-border);
}

.btnSecondary:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-text-muted);
}

/* Ghost / Minimal */
.btnGhost {
  background: transparent;
  color: var(--color-text-muted);
}

.btnGhost:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}
```

---

## 4. Status Dot & Tag Pills

Instead of loud emoji badges:

```css
/* Badge.module.css */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  background: var(--color-accent-dim);
  color: var(--color-text);
  border: 1px solid transparent;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dotActive {
  background: var(--color-success);
  box-shadow: 0 0 6px var(--color-success);
}

.dotPending {
  background: var(--color-warning);
}

.dotInactive {
  background: var(--color-text-faint);
}
```

---

## 5. Clean Tab Strip (Pills or Underline)

```css
/* Tabs.module.css */
.tabContainer {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--color-surface-2);
  padding: 4px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-subtle);
  width: fit-content;
}

.tabItem {
  padding: 6px 14px;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
  border-radius: var(--radius-md);
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tabItem:hover {
  color: var(--color-text);
}

.tabItemActive {
  background: var(--color-surface);
  color: var(--color-text);
  font-weight: var(--weight-semibold);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
```
