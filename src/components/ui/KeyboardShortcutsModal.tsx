'use client';

import React from 'react';
import { Keyboard, X, Search, Compass, Headphones, Sparkles, Plus } from 'lucide-react';
import styles from './KeyboardShortcutsModal.module.css';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '⌘ K / Ctrl+K', desc: 'Global Full-Text Search across Life OS' },
    { key: '⌘ J / Ctrl+J', desc: 'What Should I Do Right Now? (Decision Engine)' },
    { key: 'ESC', desc: 'Close any active modal, drawer, or search overlay' },
    { key: '?', desc: 'Open Keyboard Shortcuts Reference' },
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Keyboard size={20} className={styles.icon} />
            <h2 className={styles.title}>Keyboard Shortcuts</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.list}>
            {shortcuts.map((s) => (
              <div key={s.key} className={styles.row}>
                <span className={styles.desc}>{s.desc}</span>
                <kbd className={styles.kbd}>{s.key}</kbd>
              </div>
            ))}
          </div>

          <p className={styles.footerNote}>
            Designed for high-speed executive flow on PC, Mac, and laptop keyboards.
          </p>
        </div>
      </div>
    </div>
  );
}
