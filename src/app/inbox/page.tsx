'use client';

import React, { useState, useRef } from 'react';
import {
  Inbox,
  Send,
  Trash2,
  CheckSquare,
  Square,
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
  Loader2,
  Wand2,
  CheckCircle2,
  Mic,
  MicOff,
} from 'lucide-react';
import { useSpeechToText } from '@/utils/useSpeechToText';
import { useInbox } from '@/context/InboxContext';
import { useProjects } from '@/context/ProjectContext';
import { useGoals } from '@/context/GoalContext';
import { useDreams } from '@/context/DreamContext';
import { useLifeAreas } from '@/context/LifeAreaContext';
import { useSettings } from '@/context/SettingsContext';
import type { InboxItem, InboxConvertedType } from '@/types';
import { processBrainDumpWithAI } from '@/utils/aiEngine';
import type { BrainDumpClassification } from '@/utils/aiEngine';
import styles from './page.module.css';
import EntityFiles from '@/components/files/EntityFiles';

export default function InboxPage() {
  const {
    items,
    activeItems,
    activeReminders,
    convertedItems,
    somedayItems,
    quickDump,
    bulkDump,
    deleteInboxItem,
    toggleItemApplied,
    toggleItemReminder,
    setReminderTime,
    convertToTask,
    convertToProject,
    convertToGoal,
    convertToDream,
    convertToNote,
    convertToProblemSolver,
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

  const { settings } = useSettings();

  // Input states
  const [quickInput, setQuickInput] = useState('');
  const [dumpType, setDumpType] = useState<'thought' | 'reminder'>('thought');
  const [reminderTime, setReminderTimeInput] = useState('');
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState('');

  // AI Brain Dump Processor state
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiResults, setAiResults] = useState<BrainDumpClassification[] | null>(null);
  const [aiApplied, setAiApplied] = useState(false);

  const handleAIProcess = async () => {
    if (activeItems.length === 0) return;
    setIsAiProcessing(true);
    setAiResults(null);
    setAiApplied(false);
    const results = await processBrainDumpWithAI(
      activeItems.map(i => ({ id: i.id, text: i.content })),
      settings.aiSettings
    );
    setAiResults(results);
    setIsAiProcessing(false);
  };

  const TYPE_ICONS: Record<string, string> = {
    task: '✅', goal: '🎯', project: '📁', dream: '✨', idea: '💡', note: '📝',
  };
  const TYPE_COLORS: Record<string, string> = {
    task: '#22d3a5', goal: '#7c6fff', project: '#3b82f6', dream: '#f59e0b', idea: '#ec4899', note: '#64748b',
  };
  const PRIORITY_COLORS: Record<string, string> = {
    urgent: '#ef4444', high: '#f97316', medium: '#7c6fff', low: '#64748b',
  };

  // Active filter tab
  const [filterTab, setFilterTab] = useState<'inbox' | 'reminders' | 'converted' | 'someday'>('inbox');

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
    quickDump(quickInput.trim(), {
      isReminder: dumpType === 'reminder',
      reminderTime: dumpType === 'reminder' && reminderTime.trim() ? reminderTime.trim() : undefined,
    });
    setQuickInput('');
    setReminderTimeInput('');
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) return;
    const lines = bulkInput.split('\n');
    bulkDump(lines, dumpType === 'reminder');
    setBulkInput('');
    setIsBulkOpen(false);
  };

  // Voice brain dump
  const baseVoiceTextRef = useRef('');

  const { isListening, toggleListening, isSupported: speechSupported } = useSpeechToText({
    onTranscript: (spokenText) => {
      const base = baseVoiceTextRef.current;
      setQuickInput(base ? `${base} ${spokenText}` : spokenText);
    },
  });

  const handleToggleListening = () => {
    if (!isListening) {
      baseVoiceTextRef.current = quickInput.trim();
    }
    toggleListening();
  };

  const currentList =
    filterTab === 'inbox'
      ? activeItems
      : filterTab === 'reminders'
      ? activeReminders
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
      <form onSubmit={handleQuickSubmit} className={styles.quickAddCard}>
        <div className={styles.quickAddRow}>
          <div className={styles.typeToggle}>
            <button
              type="button"
              className={`${styles.typeToggleBtn} ${dumpType === 'thought' ? styles.typeToggleActive : ''}`}
              onClick={() => setDumpType('thought')}
              title="Normal Brain Dump / Idea"
            >
              Dump
            </button>
            <button
              type="button"
              className={`${styles.typeToggleBtn} ${dumpType === 'reminder' ? styles.typeToggleActiveReminder : ''}`}
              onClick={() => setDumpType('reminder')}
              title="Set as Reminder (pops up on Today moving ticker)"
            >
              Reminder
            </button>
          </div>

          <input
            type="text"
            className={styles.quickAddInput}
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder={
              isListening
                ? 'Listening to voice...'
                : dumpType === 'reminder'
                ? 'Set a reminder (will scroll on Today screen)...'
                : 'Dump a thought, task, idea, or worry...'
            }
            autoFocus
          />

          {dumpType === 'reminder' && (
            <input
              type="text"
              className={styles.reminderTimeInput}
              value={reminderTime}
              onChange={(e) => setReminderTimeInput(e.target.value)}
              placeholder="Time note (e.g. 3:00 PM, Today)"
              title="Optional reminder time note"
            />
          )}

          {speechSupported && (
            <button
              type="button"
              className={styles.pillSelect}
              onClick={handleToggleListening}
              style={{
                background: isListening ? 'var(--color-danger, #ef4444)' : 'var(--color-surface-2)',
                color: isListening ? '#ffffff' : 'var(--color-text)',
                padding: '6px 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '36px',
              }}
              title={isListening ? 'Stop recording voice' : 'Voice Brain Dump'}
              aria-label={isListening ? 'Stop recording voice' : 'Voice Brain Dump'}
            >
              {isListening ? <MicOff size={15} /> : <Mic size={15} />}
              <span style={{ fontSize: '12px' }}>{isListening ? 'Listening...' : 'Voice'}</span>
            </button>
          )}
          <button type="submit" className={styles.quickAddBtn}>
            {dumpType === 'reminder' ? 'Add Reminder ↵' : 'Quick Add ↵'}
          </button>
        </div>

        {/* Quick Add Meta Row */}
        <div className={styles.quickAddMetaRow}>
          <div className={styles.quickAddPills}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>Optional:</span>
            <button
              type="button"
              className={styles.pillSelect}
              onClick={() => setIsBulkOpen(!isBulkOpen)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              {isBulkOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Multi-line Dump
            </button>
          </div>

          <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
            Tip: Press <kbd style={{ background: 'var(--color-surface-2)', padding: '2px 4px', borderRadius: '4px' }}>Enter</kbd> to save
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
              className={styles.quickAddBtn}
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
            Inbox ({activeItems.length})
          </button>
          <button
            className={`${styles.tab} ${filterTab === 'reminders' ? styles.activeTab : ''}`}
            onClick={() => setFilterTab('reminders')}
          >
            Reminders ({activeReminders.length})
          </button>
          <button
            className={`${styles.tab} ${filterTab === 'converted' ? styles.activeTab : ''}`}
            onClick={() => setFilterTab('converted')}
          >
            Converted ({convertedItems.length})
          </button>
          <button
            className={`${styles.tab} ${filterTab === 'someday' ? styles.activeTab : ''}`}
            onClick={() => setFilterTab('someday')}
          >
            Someday / Maybe ({somedayItems.length})
          </button>
        </div>

        {currentList.length > 0 && filterTab === 'inbox' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {activeItems.length >= 1 && (
              <button
                className={styles.btnSecondary}
                onClick={handleAIProcess}
                disabled={isAiProcessing}
                id="ai-process-inbox-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'linear-gradient(135deg, var(--color-accent), #8b5cf6)',
                  color: 'white', border: 'none', fontWeight: 600, fontSize: '12px',
                  padding: '6px 14px', borderRadius: '10px',
                }}
              >
                {isAiProcessing ? (
                  <>
                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Processing...
                  </>
                ) : (
                  'AI Process All'
                )}
              </button>
            )}
            <button
              className={styles.btnSecondary}
              onClick={() => { if (confirm('Clear all items from Inbox?')) clearInbox(); }}
              style={{ fontSize: '11px', color: 'var(--color-danger)' }}
            >
              Clear Inbox
            </button>
          </div>
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
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => toggleItemApplied(item.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: item.isApplied ? 'var(--color-success)' : 'var(--color-text-faint)',
                    marginTop: '2px',
                  }}
                  title={item.isApplied ? 'Mark as Not Done' : 'Mark as Done / Applied'}
                >
                  {item.isApplied ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    {item.status === 'inbox' && (
                      <button
                        type="button"
                        onClick={() => toggleItemReminder(item.id)}
                        className={item.isReminder ? styles.reminderBadge : styles.dumpBadge}
                        title={
                          item.isReminder
                            ? 'Reminder: active on Today dashboard (click to convert to thought)'
                            : 'Thought (click to convert to Reminder)'
                        }
                      >
                        {item.isReminder ? 'Reminder' : 'Thought'}
                      </button>
                    )}
                    {item.reminderTime && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--color-text-muted)',
                          background: 'var(--color-surface-2)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {item.reminderTime}
                      </span>
                    )}
                  </div>
                  <p
                    className={styles.itemContent}
                    style={{
                      textDecoration: item.isApplied ? 'line-through' : 'none',
                      opacity: item.isApplied ? 0.65 : 1,
                    }}
                  >
                    {item.content}
                  </p>
                  <span className={styles.itemDate}>
                    Captured {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {item.isApplied && ' • Applied / Done'}
                    {item.convertedTo && ` • Converted to ${item.convertedTo.toUpperCase()}`}
                    {item.isReminder && !item.isApplied && item.status === 'inbox' && ' • Active on Today Ticker'}
                  </span>
                </div>
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
                      + Task
                    </button>
                    <button
                      className={styles.btnConvert}
                      onClick={() => setConvertModalItem(item)}
                      title="More conversion options"
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

              <button
                className={styles.dumpBtn}
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
                onClick={() => {
                  toggleItemReminder(convertModalItem.id);
                  setConvertModalItem(null);
                }}
              >
                {convertModalItem.isReminder ? 'Convert to Normal Thought' : 'Set as Active Reminder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Brain Dump Results Overlay ── */}
      {aiResults && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '20px', width: '100%', maxWidth: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wand2 size={16} style={{ color: 'var(--color-accent)' }} /> AI Classification Results
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Review suggestions below. Convert items using the buttons on each card.
                </div>
              </div>
              <button onClick={() => setAiResults(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {aiResults.map((r) => (
                <div key={r.itemId} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>{TYPE_ICONS[r.suggestedType] || '📝'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: 'var(--color-text)', marginBottom: '5px', wordBreak: 'break-word' }}>{r.text}</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: `${TYPE_COLORS[r.suggestedType]}20`, color: TYPE_COLORS[r.suggestedType] }}>
                          {r.suggestedType}
                        </span>
                        {r.suggestedPriority && (
                          <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: `${PRIORITY_COLORS[r.suggestedPriority] || '#64748b'}20`, color: PRIORITY_COLORS[r.suggestedPriority] || '#64748b' }}>
                            {r.suggestedPriority}
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: 'var(--color-text-faint)', fontStyle: 'italic' }}>{r.reasoning}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                {aiResults.length} items analysed
              </span>
              <button
                onClick={() => { setAiResults(null); setAiApplied(true); }}
                style={{ padding: '8px 18px', borderRadius: '10px', border: 'none', background: 'var(--color-accent)', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCircle2 size={14} /> Got it — I'll convert manually
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
