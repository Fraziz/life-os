'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLifeAreas } from '@/context/LifeAreaContext';
import styles from './LifeDomainBar.module.css';

interface LifeDomainBarProps {
  isExpanded?: boolean;
}

export default function LifeDomainBar({ isExpanded = true }: LifeDomainBarProps) {
  const { activeAreas, focusedAreaId, setFocusedAreaId, focusedArea } = useLifeAreas();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate popover coordinates on open
  const openPopover = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 248;

    if (isExpanded) {
      // Positioned directly below the full-width domain bar
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 10) {
        left = window.innerWidth - popoverWidth - 10;
      }
      setPopoverPos({
        top: rect.bottom + 6,
        left: Math.max(10, left),
      });
    } else {
      // Collapsed rail mode: opens to the right of the sidebar rail
      setPopoverPos({
        top: Math.max(10, Math.min(rect.top, window.innerHeight - 340)),
        left: rect.right + 10,
      });
    }
    setIsOpen(true);
  };

  const togglePopover = () => {
    if (isOpen) {
      setIsOpen(false);
    } else {
      openPopover();
    }
  };

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on window resize or scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleClose = () => setIsOpen(false);
    window.addEventListener('resize', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [isOpen]);

  // Global Keyboard Shortcuts
  // - Alt+0: Panoramic (All Domains)
  // - Alt+1..9: Quick-switch to corresponding Life Domain
  // - Alt+D or Alt+L: Toggle Domain selector popover
  // - Escape: Close popover
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        return;
      }

      if (!e.altKey || e.ctrlKey || e.metaKey) return;

      const keyLower = e.key.toLowerCase();

      // Alt+D or Alt+L: Toggle popup dropdown
      if (keyLower === 'd' || keyLower === 'l') {
        e.preventDefault();
        if (isOpen) {
          setIsOpen(false);
        } else {
          openPopover();
        }
        return;
      }

      // Alt+0: All Domains (Panoramic)
      if (e.key === '0') {
        e.preventDefault();
        setFocusedAreaId(null);
        setIsOpen(false);
        return;
      }

      // Alt+1..9: Specific Life Area
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= activeAreas.length) {
        e.preventDefault();
        const target = activeAreas[num - 1];
        if (target) {
          setFocusedAreaId(target.id === focusedAreaId ? null : target.id);
          setIsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAreas, focusedAreaId, setFocusedAreaId, isOpen]);

  if (!activeAreas || activeAreas.length === 0) return null;

  const activeIndex = focusedArea
    ? activeAreas.findIndex((a) => a.id === focusedArea.id)
    : -1;
  const currentShortcut = activeIndex >= 0 ? `Alt+${activeIndex + 1}` : 'Alt+0';

  return (
    <div
      ref={containerRef}
      className={isExpanded ? styles.containerExpanded : styles.containerCollapsed}
      role="region"
      aria-label="Life Domain Selector"
    >
      {/* Trigger: Expanded Sidebar Mode */}
      {isExpanded ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={togglePopover}
          className={`${styles.triggerExpanded} ${focusedArea ? styles.triggerActive : ''}`}
          style={
            focusedArea?.color
              ? ({ '--active-color': focusedArea.color } as React.CSSProperties)
              : undefined
          }
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          title={
            focusedArea
              ? `Domain: ${focusedArea.name} (Shortcut: ${currentShortcut} • Click to change / Alt+0 to clear)`
              : 'Domain Focus: All (Alt+0 • Alt+1 to Alt+7 • Click to filter)'
          }
        >
          <div className={styles.triggerLeft}>
            <span
              className={styles.colorDot}
              style={{
                backgroundColor: focusedArea?.color || '#94a3b8',
                boxShadow: focusedArea?.color ? `0 0 8px ${focusedArea.color}` : undefined,
              }}
            />
            <span className={styles.domainTitle}>
              {focusedArea ? focusedArea.name : 'Domain: All'}
            </span>
          </div>

          <div className={styles.triggerRight}>
            <kbd className={styles.triggerKbd} title={`Keyboard shortcut: ${currentShortcut}`}>
              {currentShortcut}
            </kbd>
            <span className={`${styles.chevronText} ${isOpen ? styles.chevronOpen : ''}`}>
              ▼
            </span>
          </div>
        </button>
      ) : (
        /* Trigger: Collapsed Rail Mode */
        <button
          ref={buttonRef}
          type="button"
          onClick={togglePopover}
          className={`${styles.triggerCollapsed} ${focusedArea ? styles.triggerActive : ''}`}
          style={
            focusedArea?.color
              ? ({ '--active-color': focusedArea.color } as React.CSSProperties)
              : undefined
          }
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          title={
            focusedArea
              ? `Domain: ${focusedArea.name} (${currentShortcut} • Alt+0 to clear)`
              : 'Domain Focus: All (Alt+0 to Alt+7)'
          }
        >
          <span
            className={styles.colorDot}
            style={{
              backgroundColor: focusedArea?.color || '#94a3b8',
              boxShadow: focusedArea?.color ? `0 0 8px ${focusedArea.color}` : undefined,
            }}
          />
          <span className={styles.railLabel}>
            {focusedArea ? focusedArea.name.slice(0, 3).toUpperCase() : 'ALL'}
          </span>
          <span className={styles.tooltip}>
            {focusedArea ? `Domain: ${focusedArea.name} (${currentShortcut})` : 'Domain: All (Alt+0)'}
          </span>
        </button>
      )}

      {/* Popover Dropdown Portal (Formal, Clean, 100% Icon-Free) */}
      {mounted && isOpen && popoverPos && createPortal(
        <div
          ref={popoverRef}
          className={styles.popover}
          style={{
            top: `${popoverPos.top}px`,
            left: `${popoverPos.left}px`,
          }}
          role="listbox"
          aria-label="Filter by Life Domain"
        >
          <div className={styles.popoverHeader}>
            <span>Life Domain Focus</span>
            <span>Shortcut</span>
          </div>

          {/* All Domains (Panoramic) Item */}
          <button
            type="button"
            className={`${styles.domainItem} ${!focusedAreaId ? styles.domainItemActive : ''}`}
            onClick={() => {
              setFocusedAreaId(null);
              setIsOpen(false);
            }}
            role="option"
            aria-selected={!focusedAreaId}
          >
            <div className={styles.domainLeft}>
              <span
                className={styles.colorDot}
                style={{ backgroundColor: '#94a3b8' }}
              />
              <span className={styles.domainName}>All Domains (Panoramic)</span>
            </div>
            <span className={styles.hotkeyBadge}>Alt+0</span>
          </button>

          <div className={styles.popoverDivider} />

          {/* Specific Active Domains */}
          {activeAreas.map((area, index) => {
            const isSelected = focusedAreaId === area.id;
            return (
              <button
                key={area.id}
                type="button"
                className={`${styles.domainItem} ${isSelected ? styles.domainItemActive : ''}`}
                onClick={() => {
                  setFocusedAreaId(isSelected ? null : area.id);
                  setIsOpen(false);
                }}
                role="option"
                aria-selected={isSelected}
              >
                <div className={styles.domainLeft}>
                  <span
                    className={styles.colorDot}
                    style={{
                      backgroundColor: area.color || '#94a3b8',
                      boxShadow: isSelected ? `0 0 8px ${area.color}` : undefined,
                    }}
                  />
                  <span className={styles.domainName}>{area.name}</span>
                </div>
                <span className={styles.hotkeyBadge}>Alt+{index + 1}</span>
              </button>
            );
          })}

          <div className={styles.popoverFooter}>
            <span>Alt+D toggle • Esc close</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
