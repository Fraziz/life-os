'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Moon, Sun } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import {
  COLOR_THEMES,
  getColorThemeMeta,
  getNextColorThemeId,
} from '@/config/themes';
import type { AppTheme, ColorThemeId } from '@/types';
import styles from './ThemeOrbButton.module.css';

interface ThemeOrbButtonProps {
  size?: number;
  className?: string;
}

export default function ThemeOrbButton({ size = 17, className }: ThemeOrbButtonProps) {
  const { settings, updateSettings } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isResolvedDark, setIsResolvedDark] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [cycleLabel, setCycleLabel] = useState<{
    text: string;
    color: string;
    top: number;
    left: number;
  } | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Track resolved light/dark state on <html> so icon & swatches always match live OS auto-adjust
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncResolved = () => {
      setIsResolvedDark(document.documentElement.getAttribute('data-theme') === 'dark');
    };
    syncResolved();
    const observer = new MutationObserver(syncResolved);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, [settings.theme]);

  const activePalette = getColorThemeMeta(settings.colorTheme);
  const activeSwatchColor = isResolvedDark
    ? activePalette.darkAccent
    : activePalette.lightAccent;

  const openMenuAtButton = () => {
    if (!btnRef.current || typeof window === 'undefined') return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = 312;
    const menuHeight = 360;
    const left = Math.max(
      12,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12)
    );
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const top =
      spaceBelow >= menuHeight || rect.top < menuHeight
        ? rect.bottom + 8
        : Math.max(12, rect.top - menuHeight - 8);

    setPopoverPos({ top, left });
    setCycleLabel(null);
    setMenuOpen(true);
  };

  // Left-click: auto-cycle color theme cleanly
  const handleLeftClick = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const nextColorId = getNextColorThemeId(settings.colorTheme);
    const nextMeta = getColorThemeMeta(nextColorId);
    updateSettings({ colorTheme: nextColorId });

    if (btnRef.current && typeof window !== 'undefined') {
      const rect = btnRef.current.getBoundingClientRect();
      const left = Math.max(12, Math.min(rect.right - 140, window.innerWidth - 170));
      setCycleLabel({
        text: nextMeta.label,
        color: isResolvedDark ? nextMeta.darkAccent : nextMeta.lightAccent,
        top: rect.bottom + 8,
        left,
      });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setCycleLabel(null), 1400);
    }
  };

  // Right-click: open full formal color palette & Auto-Adjust menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (menuOpen) {
      setMenuOpen(false);
    } else {
      openMenuAtButton();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      openMenuAtButton();
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        btnRef.current &&
        !btnRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onViewportChange = () => setMenuOpen(false);

    document.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onEsc);
    window.addEventListener('resize', onViewportChange);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', onViewportChange);
    };
  }, [menuOpen]);

  const handleSelectMode = (mode: AppTheme) => {
    updateSettings({ theme: mode });
  };

  const handleSelectPalette = (colorTheme: ColorThemeId) => {
    updateSettings({ colorTheme });
  };

  const modeLabel =
    settings.theme === 'system'
      ? `Auto (${isResolvedDark ? 'Night' : 'Day'})`
      : settings.theme === 'dark'
      ? 'Dark'
      : 'Light';

  return (
    <div className={styles.orbWrapper}>
      <button
        ref={btnRef}
        type="button"
        className={className || styles.orbBtn}
        onClick={handleLeftClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        aria-label={`Color theme: ${activePalette.label} (${modeLabel}). Click to cycle color, right-click for palette choices.`}
        title={`${activePalette.label} · ${modeLabel} — Click to change color · Right-click for choices`}
      >
        {isResolvedDark ? <Sun size={size} /> : <Moon size={size} />}
        <span
          className={styles.swatchPip}
          style={{ backgroundColor: activeSwatchColor }}
        />
      </button>

      {mounted &&
        cycleLabel &&
        !menuOpen &&
        createPortal(
          <div
            className={styles.cycleToast}
            style={{ top: `${cycleLabel.top}px`, left: `${cycleLabel.left}px` }}
            role="status"
          >
            <span
              className={styles.cycleToastDot}
              style={{ backgroundColor: cycleLabel.color }}
            />
            <span>{cycleLabel.text}</span>
          </div>,
          document.body
        )}

      {mounted &&
        menuOpen &&
        popoverPos &&
        createPortal(
          <div
            ref={menuRef}
            className={styles.popover}
            style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
            role="dialog"
            aria-label="Theme Palette"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.popoverHeader}>
              <span className={styles.popoverTitle}>Theme Studio</span>
              <span className={styles.popoverSubBadge}>{modeLabel}</span>
            </div>

            {/* Brightness / System Auto-Adjust Selector */}
            <div className={styles.modeSegment} role="group" aria-label="Appearance mode">
              {(
                [
                  { id: 'system', label: 'Auto System' },
                  { id: 'light', label: 'Light' },
                  { id: 'dark', label: 'Dark' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`${styles.modeBtn} ${
                    settings.theme === m.id ? styles.modeBtnActive : ''
                  }`}
                  onClick={() => handleSelectMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Curated Formal ADHD Color Palettes */}
            <div className={styles.paletteList} role="listbox" aria-label="Color themes">
              {COLOR_THEMES.map((item) => {
                const isSelected = (settings.colorTheme || 'slate') === item.id;
                const surfHex = isResolvedDark ? item.darkSurface : item.lightSurface;
                const accHex = isResolvedDark ? item.darkAccent : item.lightAccent;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`${styles.paletteItem} ${
                      isSelected ? styles.paletteItemActive : ''
                    }`}
                    onClick={() => handleSelectPalette(item.id)}
                  >
                    <div className={styles.paletteItemLeft}>
                      <span
                        className={styles.dualSwatch}
                        style={{
                          background: `linear-gradient(135deg, ${surfHex} 50%, ${accHex} 50%)`,
                        }}
                      />
                      <div className={styles.paletteTextCol}>
                        <span className={styles.paletteName}>{item.label}</span>
                        <span className={styles.paletteMood}>{item.mood}</span>
                      </div>
                    </div>
                    {isSelected && <span className={styles.activeDot} />}
                  </button>
                );
              })}
            </div>

            <div className={styles.footerHint}>
              Left-click icon to cycle · Right-click for choices
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
