'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Inbox,
  Send,
  Trash2,
  CheckSquare,
  Square,
  Check,
  Folder,
  Target,
  CloudSun,
  FileText,
  Clock,
  RotateCcw,
  Sparkles,
  Zap,
  Layers,
  ArrowRight,
  ArrowLeft,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Wand2,
  CheckCircle2,
  Mic,
  MicOff,
  Copy,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Mail,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { useSpeechToText } from '@/utils/useSpeechToText';
import { useInbox } from '@/context/InboxContext';
import { useProjects } from '@/context/ProjectContext';
import { useGoals } from '@/context/GoalContext';
import { useDreams } from '@/context/DreamContext';
import { useLifeAreas } from '@/context/LifeAreaContext';
import { useSettings } from '@/context/SettingsContext';
import { useTasks } from '@/context/TaskContext';
import { useAuth } from '@/context/AuthContext';
import { getFirebaseAuth, explainFirebaseError } from '@/lib/firebase';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import type { InboxItem, InboxConvertedType } from '@/types';
import { processBrainDumpWithAI, breakdownThoughtWithAI, type ThoughtBreakdownResult } from '@/utils/aiEngine';
import type { BrainDumpClassification } from '@/utils/aiEngine';
import { playSuccessChime } from '@/utils/soundAndDopamine';
import styles from './page.module.css';
import EntityFiles from '@/components/files/EntityFiles';
import PageSkeleton from '@/components/ui/PageSkeleton';
import AutoLinkText from '@/components/ui/AutoLinkText';

export default function InboxPage() {
  const {
    items,
    activeItems,
    importantItems,
    doneItems,
    activeReminders,
    convertedItems,
    somedayItems,
    quickDump,
    bulkDump,
    deleteInboxItem,
    toggleItemApplied,
    toggleItemReminder,
    toggleItemImportant,
    setReminderTime,
    convertToTask,
    convertToImportant,
    convertToProject,
    convertToGoal,
    convertToDream,
    convertToNote,
    convertToProblemSolver,
    convertToSomeday,
    restoreToInbox,
    updateInboxItem,
    clearInbox,
    resetToDefaultInbox,
    isLoaded,
  } = useInbox();

  const { projects } = useProjects();
  const { goals } = useGoals();
  const { dreams } = useDreams();
  const { activeAreas } = useLifeAreas();

  const { settings, updateSettings } = useSettings();
  const { addTask } = useTasks();

  // AI Breakdown State
  const [aiBreakdownModal, setAiBreakdownModal] = useState<{
    item: InboxItem;
    result: ThoughtBreakdownResult | null;
    loading: boolean;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Inline Editing State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState<string>('');

  const handleStartEdit = (item: InboxItem) => {
    setEditingItemId(item.id);
    setEditingItemText(item.content);
  };

  const handleSaveEdit = (id: string) => {
    const trimmed = editingItemText.trim();
    if (!trimmed) return;
    updateInboxItem(id, { content: trimmed });
    setEditingItemId(null);
    playSuccessChime();
    showToast('Note updated');
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingItemText('');
  };

  const handleToggleItemApplied = (item: InboxItem) => {
    toggleItemApplied(item.id);
    if (!item.isApplied) {
      playSuccessChime();
      showToast('Marked idea as done');
    }
  };

  const handleConvertToTask = (item: InboxItem) => {
    const isDone = item.isApplied;
    convertToTask(item.id);
    if (isDone) {
      playSuccessChime();
      showToast('Placed in Already Done & added to Tasks');
    } else {
      showToast('Converted to Task');
    }
  };

  const handleConvertToImportant = (item: InboxItem) => {
    const isDone = item.isApplied;
    convertToImportant(item.id);
    playSuccessChime();
    if (isDone) {
      showToast('Placed in Already Done & added to Tasks');
    } else {
      showToast('Converted to Important Task');
    }
  };

  const handleActivateGroqKey = (text: string) => {
    const keyMatch = text.match(/gsk_[A-Za-z0-9_]{20,}/);
    if (!keyMatch) return;
    const extractedKey = keyMatch[0];

    const currentSaved = settings.aiSettings?.savedKeys || [];
    const existingIndex = currentSaved.findIndex((k) => k.apiKey === extractedKey);
    let updatedSaved = [...currentSaved];

    if (existingIndex < 0) {
      updatedSaved.push({
        id: `groq-key-${Date.now()}`,
        name: `Groq Key (${extractedKey.slice(0, 8)}...)`,
        apiKey: extractedKey,
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        createdAt: new Date().toISOString(),
      });
    }

    updateSettings({
      aiSettings: {
        ...(settings.aiSettings || {
          monthlyBudgetUSD: 20,
          spentBudgetUSD: 0,
          totalTokensUsed: 0,
          temperature: 0.7,
        }),
        enabled: true,
        provider: 'groq',
        apiKey: extractedKey,
        model: settings.aiSettings?.model || 'openai/gpt-oss-120b',
        autoFailover: true,
        savedKeys: updatedSaved,
        monthlyBudgetUSD: settings.aiSettings?.monthlyBudgetUSD ?? 20,
        spentBudgetUSD: settings.aiSettings?.spentBudgetUSD ?? 0,
        totalTokensUsed: settings.aiSettings?.totalTokensUsed ?? 0,
        temperature: settings.aiSettings?.temperature ?? 0.7,
      },
    });

    playSuccessChime();
    showToast('Groq API Key Activated');
  };

  const handleAiBreakdown = async (item: InboxItem) => {
    setAiBreakdownModal({ item, result: null, loading: true });
    try {
      const result = await breakdownThoughtWithAI(item.content, settings.aiSettings);
      setAiBreakdownModal({ item, result, loading: false });
      playSuccessChime();
    } catch {
      setAiBreakdownModal(null);
      alert('Could not break down thought with AI. Please check your Groq API key.');
    }
  };

  const handleApplyBreakdownAsTasks = (item: InboxItem, result: ThoughtBreakdownResult, createMultiple: boolean) => {
    if (createMultiple) {
      result.steps.forEach((step, idx) => {
        addTask({
          title: step,
          status: 'todo',
          priority: idx === 0 ? 'high' : 'medium',
          tags: ['from-thought', ...(result.tags || [])],
          subtasks: [],
        });
      });
      convertToTask(item.id);
      showToast(`Created ${result.steps.length} tasks from Thought`);
    } else {
      addTask({
        title: result.title || item.content,
        description: `${result.summary}\n\nActionable Steps:\n${result.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
        status: 'todo',
        priority: 'high',
        isCompound: true,
        tags: ['from-thought', ...(result.tags || [])],
        subtasks: result.steps.map((s, idx) => ({
          id: `subtask-${Date.now()}-${idx}`,
          title: s,
          completed: false,
        })),
      });
      convertToTask(item.id);
      showToast('Converted Thought to Task');
    }
    setAiBreakdownModal(null);
    playSuccessChime();
  };

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


  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'task': return <CheckSquare size={16} style={{ color: '#22d3a5' }} />;
      case 'goal': return <Target size={16} style={{ color: '#7c6fff' }} />;
      case 'project': return <Folder size={16} style={{ color: '#3b82f6' }} />;
      case 'dream': return <CloudSun size={16} style={{ color: '#f59e0b' }} />;
      case 'idea': return <Sparkles size={16} style={{ color: '#ec4899' }} />;
      default: return <FileText size={16} style={{ color: '#64748b' }} />;
    }
  };

  const TYPE_COLORS: Record<string, string> = {
    task: '#22d3a5', goal: '#7c6fff', project: '#3b82f6', dream: '#f59e0b', idea: '#ec4899', note: '#64748b',
  };
  const PRIORITY_COLORS: Record<string, string> = {
    urgent: '#ef4444', high: '#f97316', medium: '#7c6fff', low: '#64748b',
  };

  // Active filter tab
  const [filterTab, setFilterTab] = useState<'inbox' | 'important' | 'reminders' | 'done' | 'converted' | 'someday'>('inbox');

  // Confidential Vault State for Important Notes
  const { user, isGuest, changePassword } = useAuth();
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [vaultPassword, setVaultPassword] = useState('');
  const [showVaultPassword, setShowVaultPassword] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [vaultLoading, setVaultLoading] = useState(false);

  // Change Password Modal State
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePassCurrent, setChangePassCurrent] = useState('');
  const [changePassNew, setChangePassNew] = useState('');
  const [changePassConfirm, setChangePassConfirm] = useState('');
  const [changePassError, setChangePassError] = useState<string | null>(null);
  const [changePassBusy, setChangePassBusy] = useState(false);

  const handleModalChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError(null);

    if (changePassNew.length < 6) {
      setChangePassError('New password must be at least 6 characters long.');
      return;
    }

    if (changePassNew !== changePassConfirm) {
      setChangePassError('New passwords do not match.');
      return;
    }

    setChangePassBusy(true);
    try {
      await changePassword(changePassCurrent, changePassNew);
      setShowChangePasswordModal(false);
      setChangePassCurrent('');
      setChangePassNew('');
      setChangePassConfirm('');
      playSuccessChime();
      showToast('Password updated and synced');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password. Try again.';
      setChangePassError(msg);
    } finally {
      setChangePassBusy(false);
    }
  };

  // Guest Mode Local PIN Setup
  const [guestPinSetup, setGuestPinSetup] = useState(false);
  const [guestPinConfirm, setGuestPinConfirm] = useState('');

  // Lock Important Vault whenever user navigates away or switches tabs
  useEffect(() => {
    if (filterTab !== 'important') {
      setIsVaultUnlocked(false);
      setVaultPassword('');
      setVaultError(null);
    } else {
      if (isGuest || !user?.email) {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('life_os_guest_vault_pin') : null;
        setGuestPinSetup(!stored);
      }
    }
  }, [filterTab, user, isGuest]);

  const handleUnlockVault = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!vaultPassword.trim()) {
      setVaultError('Please enter your password.');
      return;
    }

    setVaultLoading(true);
    setVaultError(null);

    try {
      // 1. Account Password Verification (Firebase Auth)
      if (user?.email && !isGuest) {
        const auth = getFirebaseAuth();
        let verified = false;

        // Check active session reauthentication
        if (auth.currentUser && auth.currentUser.email) {
          try {
            const credential = EmailAuthProvider.credential(auth.currentUser.email, vaultPassword.trim());
            await reauthenticateWithCredential(auth.currentUser, credential);
            verified = true;
          } catch (reauthErr: unknown) {
            const code = typeof reauthErr === 'object' && reauthErr && 'code' in reauthErr ? String((reauthErr as { code: string }).code) : '';
            if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
              throw new Error('Incorrect password. Try again.');
            }
            // If reauthentication fails due to provider mismatch or edge condition, fall back to signInWithEmailAndPassword
          }
        }

        if (!verified) {
          try {
            await signInWithEmailAndPassword(auth, user.email, vaultPassword.trim());
            verified = true;
          } catch (signInErr: unknown) {
            const code = typeof signInErr === 'object' && signInErr && 'code' in signInErr ? String((signInErr as { code: string }).code) : '';
            if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
              throw new Error('Incorrect password. Try again.');
            }
            throw new Error(explainFirebaseError(signInErr));
          }
        }

        setIsVaultUnlocked(true);
        setVaultPassword('');
        setVaultError(null);
        playSuccessChime();
        showToast('Important notes unlocked');
        return;
      }

      // 2. Local Guest Mode / Offline Workspace Passcode
      const storedPin = typeof window !== 'undefined' ? localStorage.getItem('life_os_guest_vault_pin') : null;
      if (!storedPin) {
        if (vaultPassword.trim().length < 4) {
          throw new Error('Passcode must be at least 4 characters long.');
        }
        if (guestPinConfirm.trim() !== vaultPassword.trim()) {
          throw new Error('Passcodes do not match. Please re-enter to confirm.');
        }
        localStorage.setItem('life_os_guest_vault_pin', vaultPassword.trim());
        setIsVaultUnlocked(true);
        setVaultPassword('');
        setGuestPinConfirm('');
        setGuestPinSetup(false);
        playSuccessChime();
        showToast('Vault passcode set and unlocked');
        return;
      }

      if (vaultPassword.trim() === storedPin) {
        setIsVaultUnlocked(true);
        setVaultPassword('');
        setVaultError(null);
        playSuccessChime();
        showToast('Important notes unlocked');
      } else {
        throw new Error('Incorrect password. Try again.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed. Try again.';
      setVaultError(msg);
    } finally {
      setVaultLoading(false);
    }
  };

  // Conversion Modal State
  const [convertModalItem, setConvertModalItem] = useState<InboxItem | null>(null);

  // Voice brain dump (must be declared before any conditional returns)
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

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    quickDump(quickInput.trim(), {
      isReminder: dumpType === 'reminder',
      reminderTime: dumpType === 'reminder' && reminderTime.trim() ? reminderTime.trim() : undefined,
      isImportant: filterTab === 'important',
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

  if (!isLoaded) {
    return <PageSkeleton variant="tasks" cardsCount={5} showMetrics={false} showControls={true} />;
  }

  const currentList =
    filterTab === 'inbox'
      ? activeItems
      : filterTab === 'important'
      ? importantItems
      : filterTab === 'reminders'
      ? activeReminders
      : filterTab === 'done'
      ? doneItems
      : filterTab === 'converted'
      ? convertedItems
      : somedayItems;

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Idea Parking & Inbox</h1>
          <p className={styles.subtitle}>
            Capture ideas, thoughts, and flashes of inspiration in seconds with zero friction. Park ideas here first, organize into Tasks, Projects, Goals, or Dreams later.
          </p>
        </div>
      </header>

      {/* ── Fast Idea Parking Capture Bar ── */}
      {!(filterTab === 'important' && !isVaultUnlocked) && (
        <form onSubmit={handleQuickSubmit} className={styles.quickAddCard}>
          <div className={styles.quickAddRow}>
            <div className={styles.typeToggle}>
              <button
                type="button"
                className={`${styles.typeToggleBtn} ${dumpType === 'thought' ? styles.typeToggleActive : ''}`}
                onClick={() => setDumpType('thought')}
                title="Park Idea / Thought"
              >
                Idea
              </button>
              <button
                type="button"
                className={`${styles.typeToggleBtn} ${dumpType === 'reminder' ? styles.typeToggleActiveReminder : ''}`}
                onClick={() => setDumpType('reminder')}
                title="Set as Reminder (shows in system reminders and Today dashboard)"
              >
                Reminder
              </button>
            </div>

            <input
              type="text"
              className={styles.quickAddInput}
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleQuickSubmit(e);
                }
              }}
              placeholder={
                isListening
                  ? 'Listening to voice...'
                  : dumpType === 'reminder'
                  ? 'Set a reminder for today...'
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
                placeholder="Time note (e.g. 3:00 PM)"
                title="Optional reminder time note"
              />
            )}

            <div className={styles.quickAddActions}>
              {speechSupported && (
                <button
                  type="button"
                  className={styles.pillSelect}
                  onClick={handleToggleListening}
                  style={{
                    background: isListening ? 'var(--color-danger, #ef4444)' : 'transparent',
                    color: isListening ? '#ffffff' : 'var(--color-text-muted)',
                    padding: '2px 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title={isListening ? 'Stop recording voice' : 'Voice Brain Dump'}
                  aria-label={isListening ? 'Stop recording voice' : 'Voice Brain Dump'}
                >
                  {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                  <span style={{ fontSize: '11px' }}>{isListening ? 'Listening...' : 'Voice'}</span>
                </button>
              )}
              <button
                type="submit"
                className={styles.quickAddBtn}
                onClick={handleQuickSubmit}
                aria-disabled={!quickInput.trim()}
              >
                <span>{dumpType === 'reminder' ? 'Reminder' : 'Add'}</span> <kbd className={styles.quickAddKbd}>↵</kbd>
              </button>
            </div>
          </div>

          {/* Quick Add Meta Row */}
          <div className={`${styles.quickAddMetaRow} ${quickInput.trim() || isBulkOpen ? styles.quickAddMetaRowOpen : ''}`}>
            <div className={styles.quickAddPills}>
              <button
                type="button"
                className={styles.pillSelect}
                onClick={() => setIsBulkOpen(!isBulkOpen)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                {isBulkOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Multi-line Dump
              </button>
            </div>
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
                disabled={!bulkInput.trim()}
              >
                <span>Add {bulkInput.split('\n').filter((l) => l.trim().length > 0).length || 0} Items</span> <kbd className={styles.quickAddKbd}>↵</kbd>
              </button>
            </div>
          )}
        </form>
      )}

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
            className={`${styles.tab} ${filterTab === 'important' ? styles.activeTab : ''}`}
            onClick={() => {
              if (filterTab === 'important' && isVaultUnlocked) {
                setIsVaultUnlocked(false);
                setVaultPassword('');
                showToast('Important notes locked');
              } else {
                setIsVaultUnlocked(false);
                setFilterTab('important');
                setVaultPassword('');
                setVaultError(null);
              }
            }}
            style={filterTab === 'important' ? undefined : { color: '#d4a373' }}
            title={filterTab === 'important' && isVaultUnlocked ? 'Click to lock Important vault' : 'Confidential Important Notes (requires password)'}
          >
            Important ({importantItems.length})
          </button>
          <button
            className={`${styles.tab} ${filterTab === 'reminders' ? styles.activeTab : ''}`}
            onClick={() => setFilterTab('reminders')}
          >
            Reminders ({activeReminders.length})
          </button>
          <button
            className={`${styles.tab} ${filterTab === 'done' ? styles.activeTab : ''}`}
            onClick={() => setFilterTab('done')}
          >
            Already Done ({doneItems.length})
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

        {filterTab === 'important' && isVaultUnlocked && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className={styles.lockVaultBtn}
              onClick={() => {
                setShowChangePasswordModal(true);
                setChangePassError(null);
                setChangePassCurrent('');
                setChangePassNew('');
                setChangePassConfirm('');
              }}
              title="Change Password (syncs with account and Important vault)"
            >
              <KeyRound size={12} />
              <span>Change Password</span>
            </button>

            <button
              type="button"
              className={styles.lockVaultBtn}
              onClick={() => {
                setIsVaultUnlocked(false);
                setVaultPassword('');
                showToast('Important notes locked');
              }}
              title="Lock Important Vault"
            >
              <Lock size={12} />
              <span>Lock Vault</span>
            </button>
          </div>
        )}

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

      {/* ── Main Content Area: Minimalist Mobile-App Vault Lock Screen OR Stream List ── */}
      {filterTab === 'important' && !isVaultUnlocked ? (
        <section className={styles.vaultSection}>
          <div className={styles.vaultCard}>
            <div className={styles.vaultHeader}>
              <div className={styles.vaultBadgeIcon}>
                <Lock size={18} className={styles.vaultLockIcon} />
              </div>
              <h2 className={styles.vaultTitle}>Important Notes</h2>
              <p className={styles.vaultDesc}>
                {user?.email && !isGuest
                  ? 'Enter account password to unlock'
                  : guestPinSetup
                  ? 'Set a passcode to unlock'
                  : 'Enter passcode to unlock'}
              </p>
            </div>

            <form onSubmit={handleUnlockVault} className={styles.vaultForm}>
              {vaultError && (
                <div className={styles.vaultAlertError} role="alert">
                  <AlertCircle size={13} style={{ flexShrink: 0 }} />
                  <span>{vaultError}</span>
                </div>
              )}

              <div className={styles.vaultInputWrap}>
                <input
                  id="vault-password-input"
                  type={showVaultPassword ? 'text' : 'password'}
                  className={styles.vaultInput}
                  value={vaultPassword}
                  onChange={(e) => {
                    setVaultPassword(e.target.value);
                    if (vaultError) setVaultError(null);
                  }}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  autoFocus
                  disabled={vaultLoading}
                />
                <button
                  type="button"
                  className={styles.vaultEyeBtn}
                  onClick={() => setShowVaultPassword((prev) => !prev)}
                  aria-label={showVaultPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showVaultPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {guestPinSetup && (
                <div className={styles.vaultInputWrap}>
                  <input
                    id="vault-confirm-input"
                    type={showVaultPassword ? 'text' : 'password'}
                    className={styles.vaultInput}
                    value={guestPinConfirm}
                    onChange={(e) => setGuestPinConfirm(e.target.value)}
                    placeholder="Confirm passcode"
                    disabled={vaultLoading}
                  />
                </div>
              )}

              <button
                type="submit"
                className={styles.vaultSubmitBtn}
                disabled={vaultLoading || !vaultPassword.trim()}
              >
                {vaultLoading ? (
                  <>
                    <Loader2 size={14} className={styles.spin} />
                    <span>Verifying…</span>
                  </>
                ) : (
                  <span>{guestPinSetup ? 'Set & Unlock' : 'Unlock'}</span>
                )}
              </button>

              <button
                type="button"
                className={styles.vaultBackBtn}
                onClick={() => setFilterTab('inbox')}
              >
                Cancel
              </button>
            </form>
          </div>
        </section>
      ) : (
        <div className={styles.inboxList}>
        {currentList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-12) 0', background: 'var(--color-surface)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border-subtle)' }}>
            <Inbox size={32} style={{ color: 'var(--color-text-faint)', marginBottom: '8px' }} />
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
              {filterTab === 'inbox'
                ? 'Your head is completely clear! Nothing in the inbox.'
                : filterTab === 'important'
                ? 'No important notes yet. Click "Normal" on any note or idea to move it here (IDs, phone numbers, LRN, credentials, files).'
                : filterTab === 'done'
                ? 'No already done ideas yet. Check any idea to mark it applied/done.'
                : filterTab === 'reminders'
                ? 'No active reminders.'
                : filterTab === 'converted'
                ? 'No converted ideas yet.'
                : 'No items in this category.'}
            </p>
          </div>
        ) : (
          currentList.map((item) => (
            <article key={item.id} className={styles.inboxItemCard}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => handleToggleItemApplied(item)}
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
                  <div className={styles.itemBadgeRow}>
                    {item.status === 'inbox' && (
                      <>
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

                        <button
                          type="button"
                          onClick={() => {
                            const willBeImportant = !item.isImportant;
                            toggleItemImportant(item.id);
                            if (willBeImportant) {
                              setFilterTab('important');
                              playSuccessChime();
                              showToast('Moved to Important Notes');
                            } else {
                              showToast('Unmarked as Important');
                            }
                          }}
                          className={item.isImportant ? styles.importantBadge : styles.dumpBadge}
                          title={
                            item.isImportant
                              ? 'Important Note (click to unmark)'
                              : 'Click to move to Important Notes (IDs, phone, LRN, files)'
                          }
                        >
                          {item.isImportant ? 'Important' : 'Normal'}
                        </button>
                      </>
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
                  {editingItemId === item.id ? (
                    <div className={styles.editContainer}>
                      <textarea
                        className={styles.editTextarea}
                        value={editingItemText}
                        onChange={(e) => setEditingItemText(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEdit(item.id);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            handleCancelEdit();
                          }
                        }}
                        rows={Math.max(2, editingItemText.split('\n').length)}
                        autoFocus
                      />
                      <div className={styles.editActions}>
                        <button
                          type="button"
                          className={styles.btnSaveEdit}
                          onClick={() => handleSaveEdit(item.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className={styles.btnCancelEdit}
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </button>
                        <span className={styles.editHint}>Ctrl+Enter to save, Esc to cancel</span>
                      </div>
                    </div>
                  ) : (
                    <p
                      className={styles.itemContent}
                      style={{
                        textDecoration: item.isApplied ? 'line-through' : 'none',
                        opacity: item.isApplied ? 0.65 : 1,
                      }}
                    >
                      <AutoLinkText text={item.content} />
                    </p>
                  )}
                  <span className={styles.itemDate}>
                    Captured {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {item.isApplied && ' • Applied / Done'}
                    {item.convertedTo && ` • Converted to ${(item.convertedPriority === 'urgent' || item.convertedPriority === 'high') ? 'IMPORTANT ' : ''}${item.convertedTo.toUpperCase()}${item.isApplied ? ' (Done in Tasks)' : ''}`}
                    {item.isReminder && !item.isApplied && item.status === 'inbox' && ' • Active on Today Ticker'}
                  </span>
                </div>
              </div>

              <div
                className={`${styles.convertButtonGroup} ${
                  editingItemId === item.id || convertModalItem?.id === item.id
                    ? styles.convertButtonGroupActive
                    : ''
                }`}
              >
                {item.isImportant || filterTab === 'important' ? (
                  <div className={styles.convertButtonRow}>
                    <div className={styles.convertRightActions}>
                      <button
                        type="button"
                        className={styles.btnCopy}
                        onClick={() => {
                          navigator.clipboard.writeText(item.content);
                          playSuccessChime();
                          showToast('Copied to clipboard');
                        }}
                        title="Copy note text to clipboard"
                        aria-label="Copy note text to clipboard"
                      >
                        <Copy size={13} />
                      </button>

                      <button
                        type="button"
                        className={`${styles.btnCopy} ${editingItemId === item.id ? styles.btnCopyActive : ''}`}
                        onClick={() => {
                          if (editingItemId === item.id) {
                            handleCancelEdit();
                          } else {
                            handleStartEdit(item);
                          }
                        }}
                        title={editingItemId === item.id ? 'Cancel editing' : 'Edit note'}
                        aria-label="Edit note"
                      >
                        <Pencil size={13} />
                      </button>

                      <button
                        className={styles.btnDelete}
                        onClick={() => deleteInboxItem(item.id)}
                        title="Delete item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.convertButtonRow}>
                    <div className={styles.convertLeftActions}>
                      <EntityFiles variant="icon" entityType="inbox" entityId={item.id} title={item.content.slice(0, 48)} />
                      {item.status === 'inbox' ? (
                        <>
                          {/* Groq Key auto-detector */}
                          {/gsk_[A-Za-z0-9_]{20,}/.test(item.content) && (
                            <button
                              type="button"
                              className={styles.groqKeyBadge}
                              onClick={() => handleActivateGroqKey(item.content)}
                              title="Set this Groq API Key as the active key in your Sariling Mundo"
                            >
                              <Sparkles size={11} />
                              {settings.aiSettings?.apiKey && item.content.includes(settings.aiSettings.apiKey)
                                ? '✓ Active Groq Key'
                                : '⚡ Set as Groq Key'}
                            </button>
                          )}

                          <button
                            type="button"
                            className={styles.btnAi}
                            onClick={() => handleAiBreakdown(item)}
                            title="Break down this thought into action steps with Groq AI"
                          >
                            AI Breakdown
                          </button>

                          <button
                            className={`${styles.btnConvert} ${item.isApplied ? styles.btnConvertDone : ''}`}
                            onClick={() => handleConvertToTask(item)}
                            title={item.isApplied ? 'Convert to Completed Task in Tasks (moves to Already Done tab)' : 'Convert to actionable Task'}
                          >
                            {item.isApplied ? <Check size={12} /> : '+'} Task
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
                        <>
                          {item.convertedTo === 'task' && (
                            <Link
                              href={item.convertedEntityId ? `/tasks?highlight=${item.convertedEntityId}` : '/tasks'}
                              className={`${styles.btnConvert} ${styles.btnConvertDone}`}
                              title="View completed task in Tasks"
                            >
                              <Check size={12} /> View in Tasks
                            </Link>
                          )}
                          <button
                            className={styles.btnConvert}
                            onClick={() => {
                              restoreToInbox(item.id);
                              showToast('Restored idea back to Inbox');
                            }}
                            title="Restore item back to Inbox"
                          >
                            Restore to Inbox
                          </button>
                        </>
                      )}
                    </div>

                    <div className={styles.convertRightActions}>
                      <button
                        type="button"
                        className={styles.btnCopy}
                        onClick={() => {
                          navigator.clipboard.writeText(item.content);
                          playSuccessChime();
                          showToast('Copied to clipboard');
                        }}
                        title="Copy note text to clipboard"
                        aria-label="Copy note text to clipboard"
                      >
                        <Copy size={13} />
                      </button>

                      <button
                        type="button"
                        className={`${styles.btnCopy} ${editingItemId === item.id ? styles.btnCopyActive : ''}`}
                        onClick={() => {
                          if (editingItemId === item.id) {
                            handleCancelEdit();
                          } else {
                            handleStartEdit(item);
                          }
                        }}
                        title={editingItemId === item.id ? 'Cancel editing' : 'Edit note'}
                        aria-label="Edit note"
                      >
                        <Pencil size={13} />
                      </button>

                      <button
                        className={styles.btnDelete}
                        onClick={() => deleteInboxItem(item.id)}
                        title="Delete item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    )}

      {/* ── Conversion Modal ── */}
      {convertModalItem && (
        <div className={styles.modalOverlay} onClick={() => setConvertModalItem(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Convert: &ldquo;<AutoLinkText text={convertModalItem.content} />&rdquo;
              </h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }} onClick={() => setConvertModalItem(null)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
              Not sure? Pick Task — you can always move it later.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <button
                className={styles.dumpBtn}
                style={{
                  background: 'rgba(212, 163, 115, 0.12)',
                  color: 'var(--color-text)',
                  border: '1px solid rgba(212, 163, 115, 0.4)',
                  justifyContent: 'flex-start',
                  padding: 'var(--space-3)',
                }}
                onClick={() => {
                  if (!convertModalItem.isImportant) {
                    toggleItemImportant(convertModalItem.id);
                  }
                  setConvertModalItem(null);
                  setFilterTab('important');
                  playSuccessChime();
                  showToast('Moved to Important Notes');
                }}
              >
                <Zap size={16} style={{ color: '#d4a373' }} /> Move to Important Notes <span style={{ marginLeft: 'auto', fontSize: '10.5px', fontWeight: 600, color: '#d4a373' }}>IDs, Phone, LRN, Files</span>
              </button>

              <button
                className={styles.dumpBtn}
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
                onClick={() => {
                  handleConvertToTask(convertModalItem);
                  setConvertModalItem(null);
                }}
              >
                <CheckSquare size={16} style={{ color: 'var(--color-accent)' }} /> Convert to Task <span style={{ marginLeft: 'auto', fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-faint)' }}>15-min action</span>
              </button>

              <button
                className={styles.dumpBtn}
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
                onClick={() => {
                  convertToProject(convertModalItem.id);
                  setConvertModalItem(null);
                }}
              >
                <Folder size={16} style={{ color: '#38bdf8' }} /> Convert to Project <span style={{ marginLeft: 'auto', fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-faint)' }}>Folder of steps</span>
              </button>

              <button
                className={styles.dumpBtn}
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
                onClick={() => {
                  convertToGoal(convertModalItem.id);
                  setConvertModalItem(null);
                }}
              >
                <Target size={16} style={{ color: '#f59e0b' }} /> Convert to Goal <span style={{ marginLeft: 'auto', fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-faint)' }}>1–3 month quest</span>
              </button>

              <button
                className={styles.dumpBtn}
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
                onClick={() => {
                  convertToDream(convertModalItem.id);
                  setConvertModalItem(null);
                }}
              >
                <CloudSun size={16} style={{ color: '#ec4899' }} /> Convert to Dream <span style={{ marginLeft: 'auto', fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-faint)' }}>Big life wish</span>
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', marginTop: '2px', flexShrink: 0 }}>{renderTypeIcon(r.suggestedType)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: 'var(--color-text)', marginBottom: '5px', wordBreak: 'break-word' }}><AutoLinkText text={r.text} /></div>
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

      {/* ── AI Thought Breakdown Modal (Groq Powered) ── */}
      {aiBreakdownModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            if (!aiBreakdownModal.loading) setAiBreakdownModal(null);
          }}
        >
          <div
            className={styles.modalCard}
            style={{ maxWidth: '580px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: '#818cf8' }} />
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                  Groq AI Thought Breakdown
                </h3>
              </div>
              {!aiBreakdownModal.loading && (
                <button
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }}
                  onClick={() => setAiBreakdownModal(null)}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div style={{ background: 'var(--color-surface-2)', padding: '12px 14px', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '4px' }}>
                Original Thought
              </div>
              <div style={{ fontSize: '14px', color: 'var(--color-text)', fontWeight: 500 }}>
                &ldquo;<AutoLinkText text={aiBreakdownModal.item.content} />&rdquo;
              </div>
            </div>

            {aiBreakdownModal.loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 16px', gap: '12px' }}>
                <Loader2 size={26} className={styles.spin} style={{ color: 'var(--color-accent)' }} />
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  Breaking down with Groq Llama/GPT...
                </span>
              </div>
            ) : aiBreakdownModal.result ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '6px' }}>
                    Executive Summary &amp; Proposed Title
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px' }}>
                    {aiBreakdownModal.result.title}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    {aiBreakdownModal.result.summary}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Concrete Action Steps ({aiBreakdownModal.result.steps.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {aiBreakdownModal.result.steps.map((step, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          background: 'var(--color-surface-2)',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <span
                          style={{
                            background: 'var(--color-accent-dim)',
                            color: 'var(--color-accent)',
                            fontWeight: 700,
                            fontSize: '11px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            marginTop: '1px',
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.4 }}>
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={styles.dumpBtn}
                    style={{ flex: 1, minWidth: '200px', background: 'var(--color-accent)', color: '#ffffff', fontWeight: 700, padding: '10px 14px' }}
                    onClick={() => handleApplyBreakdownAsTasks(aiBreakdownModal.item, aiBreakdownModal.result!, false)}
                  >
                    ✓ Create Task with Checklist
                  </button>

                  <button
                    type="button"
                    className={styles.dumpBtn}
                    style={{ flex: 1, minWidth: '200px', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontWeight: 600, padding: '10px 14px' }}
                    onClick={() => handleApplyBreakdownAsTasks(aiBreakdownModal.item, aiBreakdownModal.result!, true)}
                  >
                    + Create as {aiBreakdownModal.result.steps.length} Separate Tasks
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Change Password Modal ── */}
      {showChangePasswordModal && (
        <div className={styles.modalOverlay} onClick={() => !changePassBusy && setShowChangePasswordModal(false)}>
          <div
            className={styles.modalCard}
            style={{ maxWidth: '380px', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={16} style={{ color: 'var(--color-accent)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--color-text)' }}>Change Password</h3>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer', padding: '4px' }}
                onClick={() => !changePassBusy && setShowChangePasswordModal(false)}
              >
                <X size={15} />
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
              Your new password automatically syncs with your account login and this Important Notes Vault.
            </p>

            {changePassError && (
              <div style={{ background: 'var(--color-danger-dim, rgba(239, 68, 68, 0.1))', color: 'var(--color-danger, #ef4444)', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>
                {changePassError}
              </div>
            )}

            <form onSubmit={handleModalChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  Current Password {isGuest && '(or Passcode)'}
                </label>
                <input
                  type="password"
                  value={changePassCurrent}
                  onChange={(e) => setChangePassCurrent(e.target.value)}
                  placeholder="Enter current password"
                  required
                  disabled={changePassBusy}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  New Password
                </label>
                <input
                  type="password"
                  value={changePassNew}
                  onChange={(e) => setChangePassNew(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  disabled={changePassBusy}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={changePassConfirm}
                  onChange={(e) => setChangePassConfirm(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  minLength={6}
                  disabled={changePassBusy}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  className={styles.dumpBtn}
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: '6px 14px', fontSize: '12px' }}
                  onClick={() => !changePassBusy && setShowChangePasswordModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.dumpBtn}
                  style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse, #ffffff)', border: 'none', padding: '6px 16px', fontSize: '12px', fontWeight: 600 }}
                  disabled={changePassBusy || !changePassNew || !changePassConfirm}
                >
                  {changePassBusy ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className={styles.toastBanner} role="status" aria-live="polite">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
