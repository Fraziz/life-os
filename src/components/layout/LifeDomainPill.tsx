'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLifeAreas } from '@/context/LifeAreaContext';
import styles from './LifeDomainPill.module.css';

export default function LifeDomainPill() {
  const { activeAreas, focusedAreaId, setFocusedAreaId, focusedArea } = useLifeAreas();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openPopover = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 240;

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }
    setPopoverPos({
      top: rect.bottom + 6,
      left: Math.max(12, left),
    });
    setIsOpen(true);
  };

  const togglePopover = () => {
    if (isOpen) {
      setIsOpen(false);
    } else {
      openPopover();
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

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

  const activeIndex = focusedArea
    ? activeAreas.findIndex((a) => a.id === focusedArea.id)
    : -1;
  const currentShortcut = activeIndex >= 0 ? `Alt+${activeIndex + 1}` : 'Alt+0';

  const labelText = focusedArea ? `Domain: ${focusedArea.name}` : 'Life Domain';

  return (
    <div className={styles.wrapper}>
      <button
        ref={buttonRef}
        type="button"
        onClick={togglePopover}
        className={`${styles.domainPill} ${focusedArea ? styles.domainPillActive : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title={
          focusedArea
            ? `Domain: ${focusedArea.name} (${currentShortcut} • Click to change / Alt+0 to clear)`
            : 'Domain Focus: All (Click to filter / Alt+0)'
        }
      >
        <span className={styles.domainText}>{labelText}</span>
      </button>

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

          <button
            type="button"
            className={`${styles.popoverItem} ${!focusedAreaId ? styles.popoverItemActive : ''}`}
            onClick={() => {
              setFocusedAreaId(null);
              setIsOpen(false);
            }}
            role="option"
            aria-selected={!focusedAreaId}
          >
            <span className={styles.itemName}>All Domains (Panoramic)</span>
            <span className={styles.hotkeyBadge}>Alt+0</span>
          </button>

          <div className={styles.popoverDivider} />

          {activeAreas.map((area, index) => {
            const isSelected = focusedAreaId === area.id;
            return (
              <button
                key={area.id}
                type="button"
                className={`${styles.popoverItem} ${isSelected ? styles.popoverItemActive : ''}`}
                onClick={() => {
                  setFocusedAreaId(isSelected ? null : area.id);
                  setIsOpen(false);
                }}
                role="option"
                aria-selected={isSelected}
              >
                <span className={styles.itemName}>{area.name}</span>
                <span className={styles.hotkeyBadge}>Alt+{index + 1}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
