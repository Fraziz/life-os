'use client';

import React, { useState } from 'react';
import {
  Inbox,
  Send,
  Trash2,
  CheckSquare,
  FolderKanban,
  Target,
  CloudSun,
  FileText,
  Clock,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useInbox } from '@/context/InboxContext';
import { useProjects } from '@/context/ProjectContext';
import { useGoals } from '@/context/GoalContext';
import { useDreams } from '@/context/DreamContext';
import { useLifeAreas } from '@/context/LifeAreaContext';
import type { InboxItem, InboxConvertedType } from '@/types';
import styles from './page.module.css';
import EntityFiles from '@/components/files/EntityFiles';

export default function InboxPage() {
  const {
    items,
    activeItems,
    convertedItems,
    somedayItems,
    quickDump,
    bulkDump,
    deleteInboxItem,
    convertToTask,
    convertToProject,
    convertToGoal,
    convertToDream,
    convertToNote,
    convertToSomeday,
    restoreToInbox,
    clearInbox,
    resetToDefaultInbox,
    isLoaded,
  } = useInbox();

  const { projects } = useProjects();
  const { goals } = useGoals();
  const { dreams } = useDreams();
  const { activeAreas } = useLifeAreas();

  // Input states
  const [quickInput, setQuickInput] = useState('');
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState('');

  // Active filter tab
  const [filterTab, setFilterTab] = useState<'inbox' | 'converted' | 'someday'>('inbox');

  // Conversion Modal State
  const [convertModalItem, setConvertModalItem] = useState<InboxItem | null>(null);

  if (!isLoaded) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Loading your Brain Dump Inbox...
        </p>
      </div>
    );
  }

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    quickDump(quickInput.trim());
    setQuickInput('');
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) return;
    const lines = bulkInput.split('\n');
    bulkDump(lines);
    setBulkInput('');
    setIsBulkOpen(false);
  };

  const currentList =
    filterTab === 'inbox'
      ? activeItems
      : filterTab === 'converted'
      ? convertedItems
      : somedayItems;

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Brain Dump & Inbox</h1>
          <p className={styles.subtitle}>
            Capture anything on your mind in seconds with zero friction. Clean your head first, organize into Tasks, Projects, Goals, or Dreams later.
          </p>
        </div>
      </header>

      {/* ── Fast Brain Dump Capture Bar ── */}
      <form onSubmit={handleQuickSubmit} className={styles.dumpCard}>
        <div className={styles.dumpRow}>
          <Sparkles size={20} style={{ color: 'var(--color-accent)' }} />
          <input
            type="text"
            className={styles.dumpInput}
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="Dump a thought, task, idea, or reminder (e.g. Need to learn Blender, research clothing, fix computer)..."
            autoFocus
          />
          <button type="submit" className={styles.dumpBtn}>
            <Send size={14} /> Capture ↵
          </button>
        </div>

        {/* Multi-line dump accordion toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed var(--color-border-subtle)', paddingTop: 'var(--space-2)' }}>
          <button
            type="button"
            style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={() => setIsBulkOpen(!isBulkOpen)}
          >
            {isBulkOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Multi-line Bulk Dump
          </button>
          <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
            Takes 2 seconds • No organization needed
          </span>
        </div>

        {isBulkOpen && (
          <div className={styles.bulkArea}>
            <textarea
              className={styles.bulkTextarea}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="Paste or type multiple thoughts (one item per line)..."
            />
            <button
              type="button"
              className={styles.dumpBtn}
              style={{ alignSelf: 'flex-end' }}
              onClick={handleBulkSubmit}
            >
              Add {bulkInput.split('\n').filter((l) => l.trim().length > 0).length || 0} Items
            </button>
          </div>
        )}
      </form>

      {/* ── Controls Bar & Filter Tabs ── */}
      <div className={styles.controlsBar}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${filterTab === 'inbox' ? styles.activeTab : ''}`}
            onClick={() => setFilterTab('inbox')}
          >
            <Inbox size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Inbox ({activeItems.length})
          </button>
          <button
            className={`${styles.tab} ${filterTab === 'converted' ? styles.activeTab : ''}`}
            onClick={() => setFilterTab('converted')}
          >
            <CheckSquare size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Converted ({convertedItems.length})
          </button>
          <button
            className={`${styles.tab} ${filterTab === 'someday' ? styles.activeTab : ''}`}
            onClick={() => setFilterTab('someday')}
          >
            <Clock size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Someday / Maybe ({somedayItems.length})
          </button>
        </div>

        {currentList.length > 0 && filterTab === 'inbox' && (
          <button
            className={styles.btnSecondary}
            onClick={() => {
              if (confirm('Clear all items from Inbox?')) {
                clearInbox();
              }
            }}
            style={{ fontSize: '11px', color: 'var(--color-danger)' }}
          >
            Clear Inbox
          </button>
        )}
      </div>

      {/* ── Stream List of Inbox Items ── */}
      <div className={styles.inboxList}>
        {currentList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-12) 0', background: 'var(--color-surface)', borderRadius: 'var(--radius-2xl)', border: '1px dashed var(--color-border-subtle)' }}>
            <Inbox size={32} style={{ color: 'var(--color-text-faint)', marginBottom: '8px' }} />
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
              {filterTab === 'inbox'
                ? 'Your head is completely clear! Nothing in the inbox.'
                : 'No items in this category.'}
            </p>
          </div>
        ) : (
          currentList.map((item) => (
            <article key={item.id} className={styles.inboxItemCard}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                <p className={styles.itemContent}>{item.content}</p>
                <span className={styles.itemDate}>
                  Captured {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {item.convertedTo && ` • Converted to ${item.convertedTo.toUpperCase()}`}
                </span>
              </div>

              <div className={styles.convertButtonGroup}>
                <EntityFiles variant="icon" entityType="inbox" entityId={item.id} title={item.content.slice(0, 48)} />
                {item.status === 'inbox' ? (
                  <>
                    <button
                      className={styles.btnConvert}
                      onClick={() => convertToTask(item.id)}
                      title="Convert to actionable Task"
                    >
                      <CheckSquare size={13} /> + Task
                    </button>
                    <button
                      className={styles.btnConvert}
                      onClick={() => convertToProject(item.id)}
                      title="Convert to Project"
                    >
                      <FolderKanban size={13} /> + Project
                    </button>
                    <button
                      className={styles.btnConvert}
                      onClick={() => setConvertModalItem(item)}
                      title="More conversion options (Goal, Dream, Note, Someday)"
                    >
                      More ▾
                    </button>
                  </>
                ) : (
                  <button
                    className={styles.btnConvert}
                    onClick={() => restoreToInbox(item.id)}
                    title="Restore item back to Inbox"
                  >
                    Restore to Inbox
                  </button>
                )}

                <button
                  className={styles.btnDelete}
                  onClick={() => deleteInboxItem(item.id)}
                  title="Delete item"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {/* ── Conversion Modal ── */}
      {convertModalItem && (
        <div className={styles.modalOverlay} onClick={() => setConvertModalItem(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Convert: &ldquo;{convertModalItem.content}&rdquo;
              </h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }} onClick={() => setConvertModalItem(null)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
              Choose which level of your Life OS this thought belongs to:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <button
                className={styles.dumpBtn}
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
                onClick={() => {
                  convertToTask(convertModalItem.id);
                  setConvertModalItem(null);
                }}
              >
                <CheckSquare size={16} style={{ color: 'var(--color-accent)' }} /> Convert to Task
              </button>

              <button
                className={styles.dumpBtn}
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
                onClick={() => {
                  convertToProject(convertModalItem.id);
                  setConvertModalItem(null);
                }}
              >
                <FolderKanban size={16} style={{ color: '#38bdf8' }} /> Convert to Project
              </button>

              <button
                className={styles.dumpBtn}
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
                onClick={() => {
                  convertToGoal(convertModalItem.id);
                  setConvertModalItem(null);
                }}
              >
                <Target size={16} style={{ color: '#f59e0b' }} /> Convert to Goal
              </button>

              <button
                className={styles.dumpBtn}
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
                onClick={() => {
                  convertToDream(convertModalItem.id);
                  setConvertModalItem(null);
                }}
              >
                <CloudSun size={16} style={{ color: '#ec4899' }} /> Convert to Dream
              </button>

              <button
                className={styles.dumpBtn}
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
                onClick={() => {
                  convertToNote(convertModalItem.id);
                  setConvertModalItem(null);
                }}
              >
                <FileText size={16} style={{ color: '#a855f7' }} /> Convert to Note
              </button>

              <button
                className={styles.dumpBtn}
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
                onClick={() => {
                  convertToSomeday(convertModalItem.id);
                  setConvertModalItem(null);
                }}
              >
                <Clock size={16} style={{ color: 'var(--color-text-faint)' }} /> Someday / Maybe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
