'use client';

import React, { useState, useEffect, useRef } from 'react';
import LinkPreviewCard from './LinkPreviewCard';
import styles from './GlobalLinkPreview.module.css';

interface ActivePreview {
  url: string;
  x: number;
  y: number;
  isAbove: boolean;
}

/**
 * Checks if a string is a valid external web URL
 */
function isExternalUrl(str: string): boolean {
  if (!str) return false;
  const s = str.trim().toLowerCase();
  return s.startsWith('http://') || s.startsWith('https://') || s.startsWith('www.');
}

/**
 * GlobalLinkPreview Component
 * 
 * Automatically attaches to all external web links across the entire application,
 * providing rich, professional website previews on hover.
 */
export default function GlobalLinkPreview() {
  const [activePreview, setActivePreview] = useState<ActivePreview | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTargetRef = useRef<HTMLElement | null>(null);
  const previewCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Find closest link element
      const anchor = target.closest('a') as HTMLAnchorElement | null;
      const previewEl = target.closest('[data-preview-url]') as HTMLElement | null;

      let rawUrl = '';
      let targetEl: HTMLElement | null = null;

      if (previewEl && previewEl.getAttribute('data-preview-url')) {
        rawUrl = previewEl.getAttribute('data-preview-url') || '';
        targetEl = previewEl;
      } else if (anchor && anchor.href) {
        rawUrl = anchor.getAttribute('href') || anchor.href;
        targetEl = anchor;
      }

      if (!rawUrl || !isExternalUrl(rawUrl)) {
        return;
      }

      // If user moved mouse inside existing preview card or same target, cancel close
      if (previewCardRef.current?.contains(target)) {
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }
        return;
      }

      if (currentTargetRef.current === targetEl && activePreview) {
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }
        return;
      }

      currentTargetRef.current = targetEl;

      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }

      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }

      // Debounce hover by 220ms for smooth, intentional trigger
      hoverTimerRef.current = setTimeout(() => {
        if (!targetEl) return;
        const rect = targetEl.getBoundingClientRect();
        const CARD_WIDTH = Math.min(330, Math.max(260, window.innerWidth - 24));
        const ESTIMATED_HEIGHT = 240;

        let x = rect.left + rect.width / 2 - CARD_WIDTH / 2;
        const maxX = Math.max(12, window.innerWidth - CARD_WIDTH - 12);
        x = Math.max(12, Math.min(maxX, x));

        const spaceBelow = window.innerHeight - rect.bottom;
        const isAbove = spaceBelow < ESTIMATED_HEIGHT + 20 && rect.top > ESTIMATED_HEIGHT + 20;

        let y = isAbove ? rect.top - 8 : rect.bottom + 8;

        const cleanUrl = rawUrl.toLowerCase().startsWith('www.') ? `https://${rawUrl}` : rawUrl;

        setActivePreview({
          url: cleanUrl,
          x,
          y,
          isAbove,
        });
      }, 220);
    };

    const handleMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;

      // Don't close if moving into the preview card itself
      if (related && (previewCardRef.current?.contains(related) || currentTargetRef.current?.contains(related))) {
        return;
      }

      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }

      // 280ms grace window so user can move mouse onto the preview card
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        setActivePreview(null);
        currentTargetRef.current = null;
      }, 280);
    };

    const handleScroll = () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      setActivePreview(null);
      currentTargetRef.current = null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePreview(null);
        currentTargetRef.current = null;
      }
    };

    document.addEventListener('mouseover', handleMouseOver, { passive: true });
    document.addEventListener('mouseout', handleMouseOut, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('scroll', handleScroll, { capture: true });
      document.removeEventListener('keydown', handleKeyDown);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [activePreview]);

  if (!activePreview) return null;

  return (
    <div
      ref={previewCardRef}
      className={styles.overlay}
      style={{
        left: `${activePreview.x}px`,
        ...(activePreview.isAbove
          ? { bottom: `${window.innerHeight - activePreview.y}px` }
          : { top: `${activePreview.y}px` }),
      }}
      onMouseEnter={() => {
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }
      }}
      onMouseLeave={() => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
          setActivePreview(null);
          currentTargetRef.current = null;
        }, 200);
      }}
    >
      <LinkPreviewCard
        url={activePreview.url}
        onClose={() => setActivePreview(null)}
      />
    </div>
  );
}
