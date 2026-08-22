'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSearch, SearchResultType } from '@/context/SearchContext';
import {
  Search, X, Sparkles, Target, FolderKanban,
  CheckSquare, Repeat, Inbox, CloudSun, BookOpen,
} from 'lucide-react';
import styles from './SearchModal.module.css';

const TYPE_META: Record<SearchResultType, { label: string; icon: React.ReactNode; color: string }> = {
  dream:      { label: 'Dream',      icon: <CloudSun    size={14} />, color: '#a594ff' },
  goal:       { label: 'Goal',       icon: <Target      size={14} />, color: '#38bdf8' },
  project:    { label: 'Project',    icon: <FolderKanban size={14} />, color: '#22d3a5' },
  task:       { label: 'Task',       icon: <CheckSquare size={14} />, color: '#f59e0b' },
  habit:      { label: 'Habit',      icon: <Repeat      size={14} />, color: '#ec4899' },
  brain_dump: { label: 'Brain Dump', icon: <Inbox       size={14} />, color: '#84cc16' },
  document:   { label: 'Document',   icon: <BookOpen    size={14} />, color: '#6366f1' },
};

export default function SearchModal() {
  const { query, setQuery, results, activeTypes, toggleType, closeSearch } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSearch();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeSearch]);

  const handleResultClick = (href: string) => {
    router.push(href);
    closeSearch();
  };

  const grouped = (Object.keys(TYPE_META) as SearchResultType[]).reduce<
    Record<SearchResultType, typeof results>
  >((acc, t) => {
    acc[t] = results.filter((r) => r.type === t);
    return acc;
  }, {} as Record<SearchResultType, typeof results>);

  return (
    <div className={styles.overlay} onClick={closeSearch}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Search Input */}
        <div className={styles.inputRow}>
          <Search size={18} className={styles.searchIcon} />
          <input
            ref={inputRef}
            id="global-search-input"
            type="text"
            className={styles.input}
            placeholder="Search everything… (dreams, goals, tasks, habits…)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => setQuery('')} title="Clear">
              <X size={15} />
            </button>
          )}
          <kbd className={styles.escHint}>ESC</kbd>
        </div>

        {/* Type Filters */}
        <div className={styles.filters}>
          <span className={styles.filterLabel}>Filter:</span>
          {(Object.keys(TYPE_META) as SearchResultType[]).map((t) => {
            const meta = TYPE_META[t];
            const active = activeTypes.includes(t);
            return (
              <button
                key={t}
                className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}
                style={active ? { borderColor: meta.color, color: meta.color, background: `${meta.color}18` } : {}}
                onClick={() => toggleType(t)}
              >
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>

        {/* Results */}
        <div className={styles.results}>
          {query.length < 2 ? (
            <div className={styles.emptyHint}>
              <Search size={32} style={{ color: 'var(--color-text-faint)', marginBottom: '8px' }} />
              <p>Type at least 2 characters to search all of your Life OS.</p>
            </div>
          ) : results.length === 0 ? (
            <div className={styles.emptyHint}>
              <p>No results for &quot;<strong>{query}</strong>&quot;</p>
              <p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--color-text-faint)' }}>
                Try different keywords or check your active filters above.
              </p>
            </div>
          ) : (
            (Object.keys(TYPE_META) as SearchResultType[]).map((t) => {
              const items = grouped[t];
              if (!items.length) return null;
              const meta = TYPE_META[t];
              return (
                <section key={t} className={styles.group}>
                  <div className={styles.groupHeader} style={{ color: meta.color }}>
                    {meta.icon}
                    <span>{meta.label}s</span>
                    <span className={styles.groupCount}>{items.length}</span>
                  </div>
                  {items.map((r) => {
                    const accent = r.color || meta.color;
                    return (
                      <button
                        key={r.id}
                        className={styles.resultItem}
                        style={{ borderLeft: `3px solid ${accent}` }}
                        onClick={() => handleResultClick(r.href)}
                      >
                        <div className={styles.resultMain}>
                          <span className={styles.resultTitle}>{r.title}</span>
                          {r.subtitle && <span className={styles.resultSub}>{r.subtitle}</span>}
                          {r.tags && r.tags.length > 0 && (
                            <div className={styles.tagRow}>
                              {r.tags.map((tag) => (
                                <span key={tag} className={styles.tag}>{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {r.status && (
                          <span className={styles.statusPill} style={{ color: accent, borderColor: `${accent}40`, background: `${accent}15` }}>
                            {r.status}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </section>
              );
            })
          )}
        </div>

        <div className={styles.footer}>
          <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
          <span>Click a result to jump there</span>
        </div>
      </div>
    </div>
  );
}
