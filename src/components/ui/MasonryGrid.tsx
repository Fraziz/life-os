'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './MasonryGrid.module.css';

export interface MasonryGridProps<T> {
  items: T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Optional relative height estimate for balancing columns; defaults to 100 per item. */
  estimateWeight?: (item: T) => number;
  minColumnWidth?: number;
  maxColumns?: number;
  gap?: number;
  fallbackClassName?: string;
  className?: string;
  emptyState?: React.ReactNode;
}

/**
 * Responsive shortest-column masonry layout.
 * Renders a fluid CSS grid fallback before client measurement to avoid SSR hydration mismatches,
 * then packs cards into equal-width columns so tall cards never leave empty gaps under short neighbors.
 */
export default function MasonryGrid<T>({
  items,
  getKey,
  renderItem,
  estimateWeight,
  minColumnWidth = 280,
  maxColumns = 5,
  gap = 14,
  fallbackClassName,
  className = '',
  emptyState = null,
}: MasonryGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const updateCols = (width: number) => {
      if (width <= 0) return;
      const next = Math.max(1, Math.min(maxColumns, Math.floor((width + gap) / (minColumnWidth + gap))));
      setCols((prev) => (prev === next ? prev : next));
    };

    updateCols(el.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateCols(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [minColumnWidth, maxColumns, gap]);

  const columns = useMemo(() => {
    if (!cols || cols <= 1 || items.length <= 1) return null;

    const buckets: { item: T; index: number }[][] = Array.from({ length: cols }, () => []);
    const heights = new Array<number>(cols).fill(0);

    items.forEach((item, index) => {
      let shortest = 0;
      for (let c = 1; c < cols; c++) {
        if (heights[c] < heights[shortest]) {
          shortest = c;
        }
      }
      buckets[shortest].push({ item, index });
      const weight = estimateWeight ? estimateWeight(item) : 120;
      heights[shortest] += weight + gap;
    });

    return buckets;
  }, [cols, items, estimateWeight, gap]);

  return (
    <div ref={containerRef} className={`${styles.masonryWrap} ${className}`}>
      {items.length === 0 ? (
        emptyState
      ) : columns ? (
        <div className={styles.masonryGrid} style={{ gap: `${gap}px` }}>
          {columns.map((col, colIdx) => (
            <div key={colIdx} className={styles.masonryCol} style={{ gap: `${gap}px` }}>
              {col.map(({ item, index }) => (
                <React.Fragment key={getKey(item, index)}>
                  {renderItem(item, index)}
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className={fallbackClassName || styles.fallbackGrid} style={!fallbackClassName ? { gap: `${gap}px` } : undefined}>
          {items.map((item, index) => (
            <React.Fragment key={getKey(item, index)}>
              {renderItem(item, index)}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
