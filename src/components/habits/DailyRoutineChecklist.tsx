'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { playSuccessChime } from '@/utils/soundAndDopamine';
import { useConfirm } from '@/context/ConfirmContext';
import {
  DEFAULT_DAILY_ROUTINE,
  ROUTINE_STORAGE_KEY,
  PROGRESS_STORAGE_KEY,
  getTodayDateKey,
  notifyDailyRoutineUpdated,
  clearDailyRoutineReminderDoneToday,
  type RoutineBlock,
  type DailyProgressState,
} from '@/utils/dailyRoutineReminder';
import styles from './DailyRoutineChecklist.module.css';

function parseMinutesRange(timeRange: string): { startMinute?: number; endMinute?: number } {
  const match = timeRange.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return {};
  const toMin = (hStr: string, mStr: string, mer?: string) => {
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10) || 0;
    if (mer) {
      const upper = mer.toUpperCase();
      if (upper === 'PM' && h < 12) h += 12;
      if (upper === 'AM' && h === 12) h = 0;
    }
    return h * 60 + m;
  };
  const endMer = match[6];
  const startMer = match[3] || endMer;
  return {
    startMinute: toMin(match[1], match[2], startMer),
    endMinute: toMin(match[4], match[5], endMer),
  };
}

export default function DailyRoutineChecklist() {
  const { confirm: confirmDialog } = useConfirm();
  const [blocks, setBlocks] = useState<RoutineBlock[]>([]);
  const [progress, setProgress] = useState<DailyProgressState>({
    date: getTodayDateKey(),
    completedStepKeys: [],
    completedBlockIds: [],
  });
  const [nowMinutes, setNowMinutes] = useState<number>(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<RoutineBlock | null>(null);
  const [formTimeRange, setFormTimeRange] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSubLabel, setFormSubLabel] = useState('');
  const [formStepsText, setFormStepsText] = useState('');

  useEffect(() => {
    const loadFromStorage = () => {
      try {
        const saved = localStorage.getItem(ROUTINE_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setBlocks(Array.isArray(parsed) ? parsed : []);
        } else {
          setBlocks([]);
        }
      } catch {
        setBlocks([]);
      }

      const today = getTodayDateKey();
      try {
        const savedProgress = localStorage.getItem(PROGRESS_STORAGE_KEY);
        if (savedProgress) {
          const parsed: DailyProgressState = JSON.parse(savedProgress);
          if (parsed && parsed.date === today) {
            setProgress({
              date: today,
              completedStepKeys: Array.isArray(parsed.completedStepKeys) ? parsed.completedStepKeys : [],
              completedBlockIds: Array.isArray(parsed.completedBlockIds) ? parsed.completedBlockIds : [],
            });
            return;
          }
        }
      } catch {}

      const fresh: DailyProgressState = { date: today, completedStepKeys: [], completedBlockIds: [] };
      setProgress(fresh);
      try {
        localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(fresh));
      } catch {}
    };

    loadFromStorage();
    window.addEventListener('life_os_cloud_synced', loadFromStorage);
    window.addEventListener('storage', loadFromStorage);
    return () => {
      window.removeEventListener('life_os_cloud_synced', loadFromStorage);
      window.removeEventListener('storage', loadFromStorage);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const persistBlocks = (next: RoutineBlock[]) => {
    setBlocks(next);
    try {
      localStorage.setItem(ROUTINE_STORAGE_KEY, JSON.stringify(next));
    } catch {}
    notifyDailyRoutineUpdated();
  };

  const persistProgress = (next: DailyProgressState) => {
    setProgress(next);
    try {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
    notifyDailyRoutineUpdated();
  };

  const toggleBlockDone = (block: RoutineBlock) => {
    const today = getTodayDateKey();
    const isDone = progress.completedBlockIds.includes(block.id);
    const blockStepKeys = block.steps.map((_, idx) => `${block.id}:${idx}`);

    let nextBlockIds: string[];
    let nextStepKeys: string[];

    if (isDone) {
      nextBlockIds = progress.completedBlockIds.filter((id) => id !== block.id);
      nextStepKeys = progress.completedStepKeys.filter((k) => !blockStepKeys.includes(k));
    } else {
      nextBlockIds = [...progress.completedBlockIds, block.id];
      nextStepKeys = Array.from(new Set([...progress.completedStepKeys, ...blockStepKeys]));
      playSuccessChime();
    }

    persistProgress({
      date: today,
      completedBlockIds: nextBlockIds,
      completedStepKeys: nextStepKeys,
    });
  };

  const toggleStepDone = (block: RoutineBlock, stepIdx: number) => {
    const today = getTodayDateKey();
    const stepKey = `${block.id}:${stepIdx}`;
    const isStepDone = progress.completedStepKeys.includes(stepKey);

    const nextStepKeys = isStepDone
      ? progress.completedStepKeys.filter((k) => k !== stepKey)
      : [...progress.completedStepKeys, stepKey];

    const allStepsDone =
      block.steps.length > 0 &&
      block.steps.every((_, i) => nextStepKeys.includes(`${block.id}:${i}`));

    let nextBlockIds = progress.completedBlockIds;
    if (allStepsDone && !nextBlockIds.includes(block.id)) {
      nextBlockIds = [...nextBlockIds, block.id];
      playSuccessChime();
    } else if (!allStepsDone && nextBlockIds.includes(block.id)) {
      nextBlockIds = nextBlockIds.filter((id) => id !== block.id);
    }

    persistProgress({
      date: today,
      completedBlockIds: nextBlockIds,
      completedStepKeys: nextStepKeys,
    });
  };

  const handleResetToday = () => {
    persistProgress({
      date: getTodayDateKey(),
      completedBlockIds: [],
      completedStepKeys: [],
    });
    clearDailyRoutineReminderDoneToday();
  };

  const handleRestoreDefault = async () => {
    if (!(await confirmDialog({ title: 'Restore Default Routine', message: 'Restore the default Daily Routine schedule?', confirmLabel: 'Restore', isDestructive: false }))) return;
    persistBlocks(DEFAULT_DAILY_ROUTINE);
    handleResetToday();
  };

  const openAddModal = () => {
    setEditingBlock(null);
    setFormTimeRange('');
    setFormTitle('');
    setFormSubLabel('');
    setFormStepsText('');
    setModalOpen(true);
  };

  const openEditModal = (block: RoutineBlock) => {
    setEditingBlock(block);
    setFormTimeRange(block.timeRange);
    setFormTitle(block.title);
    setFormSubLabel(block.subLabel || '');
    setFormStepsText(block.steps.join('\n'));
    setModalOpen(true);
  };

  const handleSaveBlock = (e: React.FormEvent) => {
    e.preventDefault();
    const title = formTitle.trim();
    if (!title) return;
    const timeRange = formTimeRange.trim() || 'Anytime';
    const steps = formStepsText
      .split('\n')
      .map((s) => s.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean);
    const parsedTimes = parseMinutesRange(timeRange);

    if (editingBlock) {
      const updated = blocks.map((b) =>
        b.id === editingBlock.id
          ? {
              ...b,
              timeRange,
              title,
              subLabel: formSubLabel.trim() || undefined,
              steps,
              ...parsedTimes,
            }
          : b
      );
      persistBlocks(updated);
    } else {
      const newBlock: RoutineBlock = {
        id: `routine-${Date.now()}`,
        timeRange,
        title,
        subLabel: formSubLabel.trim() || undefined,
        steps,
        ...parsedTimes,
      };
      persistBlocks([...blocks, newBlock]);
    }

    setModalOpen(false);
    playSuccessChime();
  };

  const handleDeleteBlock = async (block: RoutineBlock) => {
    if (!(await confirmDialog({ title: 'Remove Routine Block', message: `Remove "${block.title}" from your daily routine?`, confirmLabel: 'Remove' }))) return;
    persistBlocks(blocks.filter((b) => b.id !== block.id));
  };

  const completedCount = useMemo(
    () => blocks.filter((b) => progress.completedBlockIds.includes(b.id)).length,
    [blocks, progress.completedBlockIds]
  );

  const completionPct = blocks.length > 0 ? Math.round((completedCount / blocks.length) * 100) : 0;

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Daily Routine</h1>

        <div className={styles.summaryActions}>
          <button type="button" className={styles.btnGhost} onClick={handleResetToday}>
            <RotateCcw size={13} />
            <span>Reset Today</span>
          </button>
          <button type="button" className={styles.btnGhost} onClick={handleRestoreDefault}>
            <span>Restore Default</span>
          </button>
          <button type="button" className={styles.btnPrimary} onClick={openAddModal}>
            <Plus size={14} />
            <span>Add Block</span>
          </button>
        </div>
      </header>

      <div className={styles.progressSection}>
        <div className={styles.summaryTextRow}>
          <span className={styles.summaryLabel}>
            {completedCount} of {blocks.length} completed today
          </span>
          <span className={styles.summaryPct}>{completionPct}%</span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${completionPct}%` }} />
        </div>
      </div>

      {blocks.length === 0 ? (
        <div className={styles.emptyState}>
          <span>No routine blocks configured yet.</span>
          <div className={styles.summaryActions}>
            <button type="button" className={styles.btnGhost} onClick={handleRestoreDefault}>
              Restore Default Schedule
            </button>
            <button type="button" className={styles.btnPrimary} onClick={openAddModal}>
              <Plus size={14} /> Add Block
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.list}>
          {blocks.map((block) => {
            const isDone = progress.completedBlockIds.includes(block.id);
            const isNow =
              !isDone &&
              typeof block.startMinute === 'number' &&
              typeof block.endMinute === 'number' &&
              nowMinutes >= block.startMinute &&
              nowMinutes < block.endMinute;

            return (
              <article
                key={block.id}
                className={`${styles.blockCard} ${isNow ? styles.blockCardNow : ''} ${isDone ? styles.blockCardDone : ''}`}
              >
                <div className={styles.blockHeader}>
                  <div className={styles.blockHeaderLeft}>
                    <button
                      type="button"
                      className={`${styles.blockCheckBtn} ${isDone ? styles.blockCheckBtnDone : ''}`}
                      onClick={() => toggleBlockDone(block)}
                      aria-label={isDone ? `Mark ${block.title} incomplete` : `Complete ${block.title}`}
                    >
                      {isDone && <Check size={13} strokeWidth={2.5} />}
                    </button>

                    <div className={styles.blockTitleGroup}>
                      <div className={styles.blockMetaRow}>
                        <span className={styles.timeLabel}>{block.timeRange}</span>
                        {isNow && <span className={styles.nowBadge}>Current</span>}
                      </div>
                      <h2 className={`${styles.blockTitle} ${isDone ? styles.blockTitleDone : ''}`}>
                        {block.title}
                      </h2>
                      {block.subLabel && <p className={styles.blockSubLabel}>{block.subLabel}</p>}
                    </div>
                  </div>

                  <div className={styles.blockActions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => openEditModal(block)}
                      title="Edit block"
                      aria-label={`Edit ${block.title}`}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => handleDeleteBlock(block)}
                      title="Delete block"
                      aria-label={`Delete ${block.title}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {block.steps.length > 0 && (
                  <div className={styles.stepsList}>
                    {block.steps.map((step, stepIdx) => {
                      const stepKey = `${block.id}:${stepIdx}`;
                      const stepDone = progress.completedStepKeys.includes(stepKey);
                      return (
                        <button
                          key={stepKey}
                          type="button"
                          className={`${styles.stepRow} ${stepDone ? styles.stepRowDone : ''}`}
                          onClick={() => toggleStepDone(block, stepIdx)}
                        >
                          <span className={`${styles.stepBox} ${stepDone ? styles.stepBoxDone : ''}`}>
                            {stepDone && <Check size={10} strokeWidth={3} />}
                          </span>
                          <span className={styles.stepText}>{step}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {editingBlock ? 'Edit Routine Block' : 'Add Routine Block'}
              </h3>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setModalOpen(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSaveBlock}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="routine-time-range">
                  Time Window
                </label>
                <input
                  id="routine-time-range"
                  type="text"
                  className={styles.input}
                  value={formTimeRange}
                  onChange={(e) => setFormTimeRange(e.target.value)}
                  placeholder="e.g. 7:00 – 8:00 AM"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="routine-title">
                  Block Title
                </label>
                <input
                  id="routine-title"
                  type="text"
                  className={styles.input}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Deep Focus Block"
                  autoFocus
                  required
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="routine-sublabel">
                  Subtitle (Optional)
                </label>
                <input
                  id="routine-sublabel"
                  type="text"
                  className={styles.input}
                  value={formSubLabel}
                  onChange={(e) => setFormSubLabel(e.target.value)}
                  placeholder="Optional context note"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="routine-steps">
                  Checklist Steps (One per line)
                </label>
                <textarea
                  id="routine-steps"
                  rows={4}
                  className={styles.textarea}
                  value={formStepsText}
                  onChange={(e) => setFormStepsText(e.target.value)}
                  placeholder={'Review top 3 priorities\nSilence phone notifications'}
                />
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnGhost} onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  {editingBlock ? 'Save Changes' : 'Add Block'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
