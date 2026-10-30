'use client';

import React, {
  createContext, useContext, useState,
  useCallback, useEffect, useRef, ReactNode,
} from 'react';
import type { KnowledgeDocument, DocumentStatus } from '@/types';
import { notifyItemDeleted } from './UndoContext';
import { useAuth } from './AuthContext';
import {
  saveBookToCloud,
  queueBookSaveToCloud,
  deleteBookFromCloud,
  subscribeToCloudBooks,
  migrateLegacyBooksFromKv,
  wipeCloudBooks,
} from '@/lib/bookCloudSync';

import { idbGet, idbSet, idbGetAll } from '@/lib/idbStore';
import { isDocVideoLesson, cleanDocumentContent } from '@/utils/videoLesson';

const STORAGE_KEY = 'life_os_knowledge_docs_v1';
const INITIALIZED_KEY = 'life_os_knowledge_initialized_v1';

function generateId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

function defaultDocs(): KnowledgeDocument[] {
  const t = '2026-08-01T00:00:00.000Z';
  return [
    {
      id: 'doc-atomic-habits',
      title: 'Atomic Habits — James Clear (Book Summary)',
      author: 'James Clear',
      status: 'active',
      category: 'learning',
      docType: 'document',
      readStatus: 'reading',
      currentPage: 42,
      totalPages: 320,
      readProgress: 13,
      tags: ['book', 'reading', 'habits', 'self-improvement'],
      createdAt: t,
      updatedAt: t,
      content: `# Atomic Habits — James Clear

## Core Principles
- **1% Better Every Day**: Small compounding habits create massive results over time.
- **The Four Laws of Behavior Change**:
  1. Make it obvious (Cue)
  2. Make it attractive (Craving)
  3. Make it easy (Response)
  4. Make it satisfying (Reward)

## Identity-Based Habits
The ultimate form of intrinsic motivation is when a habit becomes part of your identity. Not "I want to read", but "I am a reader."

## Key Quotes
> "You do not rise to the level of your goals. You fall to the level of your systems."
`,
      studyQuiz: [
        {
          question: 'What are the 4 Laws of Behavior Change according to Atomic Habits?',
          answer: 'Make it obvious, make it attractive, make it easy, and make it satisfying.',
          userMastered: true,
        },
      ],
      readingLogs: [
        {
          id: 'log_atomic_1',
          startedAt: t,
          durationMinutes: 30,
          timeOfDay: '9:00 AM',
          notes: 'Read Chapters 1 to 3 on compounding small habits.',
        },
      ],
      totalReadMinutes: 30,
    },
    {
      id: 'doc-deep-work',
      title: 'Deep Work — Cal Newport (Study Guide)',
      author: 'Cal Newport',
      status: 'active',
      category: 'learning',
      docType: 'document',
      readStatus: 'to-read',
      currentPage: 1,
      totalPages: 296,
      readProgress: 0,
      tags: ['book', 'reading', 'focus', 'productivity'],
      createdAt: t,
      updatedAt: t,
      content: `# Deep Work — Cal Newport

## The Deep Work Hypothesis
The ability to perform deep work is becoming increasingly rare at exactly the same time it is becoming increasingly valuable in our economy.

## Core Strategies
- **Monastic or Bimodal Scheduling**: Protect deep focus blocks without distraction.
- **Embrace Boredom**: Train your brain to resist the urge for instant novelty.
- **Quit Social Media / Distractions**: Eliminate low-leverage mental noise.
`,
    },
    {
      id: 'doc-guitar-masterclass',
      title: 'Guitar Masterclass — Theory & Soloing',
      author: 'Music Theory Workshop',
      status: 'active',
      category: 'general',
      docType: 'video-lesson',
      readStatus: 'reading',
      content: `# Guitar Masterclass — Theory & Soloing

## Lesson 1: Pentatonic Scale Mastery & Fretboard Visualization
Welcome to the lead guitar study module. Follow the embedded video lesson below, review the practice drills, and launch Focus View for distraction-free study with your active Study Session timer.

<div class="video-lesson-block" data-video-lesson="true" data-video-id="2Q_ZzBGPdqE" data-url="https://www.youtube.com/watch?v=2Q_ZzBGPdqE" data-title="Guitar Lesson 1: Minor Pentatonic Box Patterns" data-start="0"></div>

### Core Concepts & Exercises:
- **Box 1 Pattern**: Root note on 6th string, frets 5-8, 5-7, 5-7, 5-7, 5-8, 5-8.
- **Picking Mechanics**: Alternate picking strictly down-up with relaxed wrist movement.
- **Practice Rhythm**: Set a metronome to 75 BPM and play 1/8th notes smoothly across all 6 strings.
`,
      tags: ['guitar', 'music', 'study', 'lessons'],
      createdAt: t,
      updatedAt: t,
      readingLogs: [
        {
          id: 'sample_read_1',
          startedAt: t,
          durationMinutes: 25,
          timeOfDay: '10:30 AM',
          notes: 'Completed Lesson 1 video and Box 1 finger drills.',
        },
      ],
      totalReadMinutes: 25,
    },
  ];
}

type CreateInput = Omit<KnowledgeDocument, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateInput = Partial<Omit<KnowledgeDocument, 'id' | 'createdAt'>>;

interface KnowledgeContextValue {
  docs: KnowledgeDocument[];
  isLoaded: boolean;
  isCloudSynced: boolean;
  addDoc: (input: CreateInput) => KnowledgeDocument;
  updateDoc: (id: string, input: UpdateInput) => void;
  deleteDoc: (id: string) => void;
  restoreDoc: (doc: KnowledgeDocument) => void;
  togglePinDoc: (id: string) => void;
  toggleDocReminder: (id: string) => void;
  createProblemSolvingDoc: (problemTitle?: string, initialDescription?: string) => KnowledgeDocument;
  resetToDefaultDocs: () => void;
}

const KnowledgeContext = createContext<KnowledgeContextValue | undefined>(undefined);

export function isTrueBookOrVideo(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  if (!item.id || typeof item.id !== 'string') return false;

  const obsoleteIds = new Set([
    'doc-sariling-mundo-manual',
    'doc-life-os-manual',
    'doc-business-ideas',
    'doc-game-blobbit',
    'doc-blender-notes',
  ]);
  if (obsoleteIds.has(item.id)) return false;

  // Reject tasks
  if (item.subtasks !== undefined || item.dueDate !== undefined || item.estimatedDuration !== undefined || item.actualDuration !== undefined) return false;
  if (item.priority === 'urgent' || item.priority === 'high' || item.priority === 'medium' || item.priority === 'low') return false;
  if (item.status === 'todo' || item.status === 'in_progress' || item.status === 'done') return false;
  if (item.id.startsWith('task_') || item.id.startsWith('t_')) return false;

  // Reject inbox / idea parking items
  if (item.id.startsWith('inbox_') || item.id.startsWith('thought_') || item.id.startsWith('dump_')) return false;
  if (item.convertedTo !== undefined || item.isApplied !== undefined || item.reminderTime !== undefined) return false;

  // Reject goals, dreams, habits, workouts, projects
  if (item.horizon !== undefined || item.targetDate !== undefined || item.quarter !== undefined) return false;
  if (item.whyItMatters !== undefined || item.visionPrompt !== undefined) return false;
  if (item.streak !== undefined || item.completedDates !== undefined || item.frequency !== undefined) return false;
  if (item.exercises !== undefined || item.routineId !== undefined) return false;
  if (item.columns !== undefined) return false;

  // Must have a title or content
  if (!item.title && !item.content) return false;

  return true;
}

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const { user, isGuest } = useAuth();
  const uid = user && !isGuest ? user.uid : null;
  const uidRef = useRef<string | null>(null);
  uidRef.current = uid;

  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const docsRef = useRef<KnowledgeDocument[]>([]);
  const isLoadedRef = useRef(false);
  docsRef.current = docs;

  const sanitizeDoc = useCallback((doc: KnowledgeDocument): KnowledgeDocument => {
    let content = doc.content || '';
    if (content.includes('video-lesson-block') || content.includes('video-lesson-frame-wrap') || content.includes(':::video-lesson')) {
      content = cleanDocumentContent(content);
    }
    const isVideo = isDocVideoLesson({ ...doc, content });
    return {
      ...doc,
      content,
      status: doc.status || 'active',
      docType: doc.docType || (isVideo ? 'video-lesson' : 'document'),
      tags: Array.isArray(doc.tags) ? doc.tags.filter(Boolean) : [],
    };
  }, []);

  const reloadFromStorage = useCallback(async (isCloudSyncEvent: boolean = false) => {
    const map = new Map<string, KnowledgeDocument>();

    // 1. Recover from specific book storage keys ONLY (no tasks, no inbox items)
    const bookKeys = [
      STORAGE_KEY,
      'life_os_knowledge_docs_backup',
      'life_os_books_v1',
      'life_os_books',
      'life_os_knowledge_docs',
      'knowledge_docs',
    ];

    for (const key of bookKeys) {
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          list.forEach((d) => {
            if (isTrueBookOrVideo(d)) {
              const existing = map.get(d.id);
              if (!existing) {
                map.set(d.id, d);
              } else {
                const newLen = (d.content || '').length;
                const existLen = (existing.content || '').length;
                const newTime = new Date(d.updatedAt || 0).getTime();
                const existTime = new Date(existing.updatedAt || 0).getTime();
                if (newLen > existLen || newTime > existTime) {
                  map.set(d.id, d);
                }
              }
            }
          });
        }
      } catch {
        // ignore
      }
    }

    // 2. Recover from IndexedDB book keys ONLY
    for (const key of bookKeys) {
      try {
        const idbDocs = await idbGet<KnowledgeDocument[]>(key);
        if (Array.isArray(idbDocs) && idbDocs.length > 0) {
          idbDocs.forEach((d) => {
            if (isTrueBookOrVideo(d)) {
              const existing = map.get(d.id);
              if (!existing) {
                map.set(d.id, d);
              } else {
                const idbLen = (d.content || '').length;
                const existLen = (existing.content || '').length;
                const idbTime = new Date(d.updatedAt || 0).getTime();
                const existTime = new Date(existing.updatedAt || 0).getTime();
                if (idbLen >= existLen || idbTime >= existTime) {
                  map.set(d.id, d);
                }
              }
            }
          });
        }
      } catch (idbErr) {
        console.warn(`[KnowledgeContext] IDB read error for ${key}:`, idbErr);
      }
    }

    // 3. Defaults & User Books preservation:
    const defaults = defaultDocs();
    if (map.size === 0) {
      defaults.forEach((d) => map.set(d.id, d));
    } else {
      defaults.forEach((d) => {
        if (!map.has(d.id)) {
          const hasMatchingTitle = Array.from(map.values()).some((existing) => existing.title === d.title);
          if (!hasMatchingTitle) {
            map.set(d.id, d);
          }
        }
      });
    }

    // 4. Ensure no non-book objects leaked into the library
    for (const [id, item] of Array.from(map.entries())) {
      if (!isTrueBookOrVideo(item)) {
        map.delete(id);
      }
    }

    const merged = Array.from(map.values()).map(sanitizeDoc);
    setDocs(merged);
    docsRef.current = merged;
    isLoadedRef.current = true;
    setIsLoaded(true);

    // 4. Critical: Persist the full merged books library back to BOTH IndexedDB & LocalStorage
    void idbSet(STORAGE_KEY, merged);
    void idbSet('life_os_knowledge_docs_backup', merged);

    if (!isCloudSyncEvent) {
      try {
        const currentRaw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        const newRaw = JSON.stringify(merged);
        if (currentRaw !== newRaw) {
          localStorage.setItem(STORAGE_KEY, newRaw);
          localStorage.setItem(INITIALIZED_KEY, 'true');
        }
      } catch {
        // If full content exceeds localStorage 5MB quota, save lightweight summary while IndexedDB retains full text
        try {
          const lightDocs = merged.map((d) => {
            if ((d.content || '').length > 30000) {
              return {
                ...d,
                content: d.content.slice(0, 10000) + '\n\n[...Full book content preserved in local device storage...]',
              };
            }
            return d;
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(lightDocs));
          localStorage.setItem(INITIALIZED_KEY, 'true');
        } catch {}
      }
    }
  }, [sanitizeDoc]);

  useEffect(() => {
    void reloadFromStorage(false);

    const handleSync = () => {
      void reloadFromStorage(true);
    };
    window.addEventListener('life_os_cloud_synced', handleSync);
    return () => window.removeEventListener('life_os_cloud_synced', handleSync);
  }, [reloadFromStorage]);

  const saveDocs = useCallback((next: KnowledgeDocument[]) => {
    // Safety check: Never allow saving an empty array if loading hasn't finished
    if (!isLoadedRef.current && next.length === 0) {
      return;
    }
    docsRef.current = next;
    setDocs(next);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(INITIALIZED_KEY, 'true');
      } catch {}
    }

    // 1. Immediately persist full documents & books into IndexedDB (unlimited quota)
    void idbSet(STORAGE_KEY, next);
    void idbSet('life_os_knowledge_docs_backup', next);

    // 2. Also save to localStorage for fast initial paint / offline caching
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (quotaErr) {
      console.warn('[KnowledgeContext] localStorage quota exceeded, saving lightweight index while IndexedDB retains full content:', quotaErr);
      try {
        const lightDocs = next.map((d) => {
          if ((d.content || '').length > 30000) {
            return {
              ...d,
              content: d.content.slice(0, 10000) + '\n\n[...Full document saved in local high-capacity storage...]',
            };
          }
          return d;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lightDocs));
      } catch {
        /* noop */
      }
    }
  }, []);

  // Real-time bidirectional Firestore Synchronization
  useEffect(() => {
    if (!uid) {
      setIsCloudSynced(false);
      return;
    }

    let unsub: (() => void) | null = null;
    let isCancelled = false;

    // Check legacy KV migration for existing cloud users
    (async () => {
      try {
        const legacyDocs = await migrateLegacyBooksFromKv(uid);
        if (legacyDocs.length > 0 && !isCancelled) {
          const currentMap = new Map(docsRef.current.map((d) => [d.id, d]));
          let hasNewLegacy = false;
          for (const lDoc of legacyDocs) {
            if (!isTrueBookOrVideo(lDoc)) continue;
            const existing = currentMap.get(lDoc.id);
            if (!existing) {
              currentMap.set(lDoc.id, { ...lDoc, syncedWithCloud: true });
              hasNewLegacy = true;
              queueBookSaveToCloud(uid, lDoc, 1000);
            } else {
              const lLen = (lDoc.content || '').length;
              const exLen = (existing.content || '').length;
              const lTime = new Date(lDoc.updatedAt || 0).getTime();
              const exTime = new Date(existing.updatedAt || 0).getTime();
              if (lLen > exLen || lTime > exTime) {
                currentMap.set(lDoc.id, { ...lDoc, syncedWithCloud: true });
                hasNewLegacy = true;
                queueBookSaveToCloud(uid, lDoc, 1000);
              }
            }
          }
          if (hasNewLegacy) {
            const merged = Array.from(currentMap.values()).map(sanitizeDoc);
            saveDocs(merged);
          }
        }
      } catch {
        // Fallback silently if legacy KV store doesn't exist
      }
    })();

    // Subscribe to users/{uid}/books subcollection in real time
    unsub = subscribeToCloudBooks(
      uid,
      (remoteDocs) => {
        if (isCancelled) return;
        setIsCloudSynced(true);

        const localList = docsRef.current;
        const localMap = new Map(localList.map((d) => [d.id, d]));
        let stateChanged = false;

        // Purge non-books from localMap
        for (const [id, item] of Array.from(localMap.entries())) {
          if (!isTrueBookOrVideo(item)) {
            localMap.delete(id);
            stateChanged = true;
          }
        }

        // Filter valid remote books
        const filteredRemote = remoteDocs.filter(isTrueBookOrVideo);
        const remoteMap = new Map(filteredRemote.map((d) => [d.id, d]));

        // Delete any rogue non-book items mistakenly uploaded to Firestore books collection
        for (const remote of remoteDocs) {
          if (!isTrueBookOrVideo(remote)) {
            void deleteBookFromCloud(uid, remote.id);
          }
        }

        // 1. Process remote books: merge or update local
        for (const remote of filteredRemote) {
          const local = localMap.get(remote.id);
          if (!local) {
            // New book from cloud!
            localMap.set(remote.id, { ...remote, syncedWithCloud: true });
            stateChanged = true;
          } else {
            const remoteTime = new Date(remote.updatedAt || 0).getTime();
            const localTime = new Date(local.updatedAt || 0).getTime();
            const remoteLen = (remote.content || '').length;
            const localLen = (local.content || '').length;

            if (remoteTime > localTime || (remoteLen > localLen && !local.syncedWithCloud)) {
              // Remote is newer or has full text
              localMap.set(remote.id, { ...remote, syncedWithCloud: true });
              stateChanged = true;
            } else if (localTime > remoteTime || (localLen > remoteLen && !remote.isChunked)) {
              // Local is newer -> push local to cloud!
              queueBookSaveToCloud(uid, local, 1000);
            }
          }
        }

        // 2. Process local books not in Firestore:
        for (const local of Array.from(localMap.values())) {
          if (isTrueBookOrVideo(local) && !remoteMap.has(local.id)) {
            // Push valid local books to cloud so they are permanently preserved
            queueBookSaveToCloud(uid, local, 1000);
          }
        }

        if (stateChanged) {
          const merged = Array.from(localMap.values()).map(sanitizeDoc);
          saveDocs(merged);
        }
      },
      () => {
        // Offline resilience fallback to LocalStorage + IndexedDB
      }
    );

    return () => {
      isCancelled = true;
      if (unsub) unsub();
    };
  }, [uid, sanitizeDoc, saveDocs]);

  const addDoc = useCallback((input: CreateInput): KnowledgeDocument => {
    const t = now();
    const docItem: KnowledgeDocument = {
      ...input,
      id: generateId(),
      createdAt: t,
      updatedAt: t,
      syncedWithCloud: Boolean(uidRef.current),
      tags: Array.isArray(input.tags) ? input.tags.filter(Boolean) : [],
    };
    const next = [docItem, ...docsRef.current];
    saveDocs(next);
    if (uidRef.current) {
      void saveBookToCloud(uidRef.current, docItem);
    }
    return docItem;
  }, [saveDocs]);

  const updateDoc = useCallback((id: string, input: UpdateInput) => {
    let updatedDocItem: KnowledgeDocument | null = null;
    const next = docsRef.current.map((d) => {
      if (d.id === id) {
        const updated: KnowledgeDocument = {
          ...d,
          ...input,
          updatedAt: now(),
          syncedWithCloud: Boolean(uidRef.current),
          tags: input.tags !== undefined ? (Array.isArray(input.tags) ? input.tags.filter(Boolean) : []) : (Array.isArray(d.tags) ? d.tags : []),
        };
        updatedDocItem = updated;
        return updated;
      }
      return d;
    });
    saveDocs(next);
    if (uidRef.current && updatedDocItem) {
      queueBookSaveToCloud(uidRef.current, updatedDocItem, 800);
    }
  }, [saveDocs]);

  const togglePinDoc = useCallback((id: string) => {
    const target = docsRef.current.find((d) => d.id === id);
    if (target) {
      updateDoc(id, { isPinned: !target.isPinned });
    }
  }, [updateDoc]);

  const toggleDocReminder = useCallback((id: string) => {
    const target = docsRef.current.find((d) => d.id === id);
    if (target) {
      updateDoc(id, { isReminder: !target.isReminder });
    }
  }, [updateDoc]);

  const createProblemSolvingDoc = useCallback((problemTitle?: string, initialDescription?: string): KnowledgeDocument => {
    const title = problemTitle ? `Problem: ${problemTitle}` : 'Problem Breakdown & Analysis';
    const content = `# ${title}

## 1. Problem Statement
${initialDescription || 'Write down exactly what is happening, what is failing, or what is creating friction. Be precise.'}

---

## 2. Facts vs. Assumptions
- **Fact**: 
- **Assumption**: 

---

## 3. Root Cause Analysis (5 Whys)
1. **Why is this happening?** 
2. **Why?** 
3. **Why?** 

---

## 4. What Does "Solved" Look Like? (Success Metrics)
- [ ] 

---

## 5. Actionable Next Steps
- [ ] **Step 1**: 
- [ ] **Step 2**: 
`;

    return addDoc({
      title,
      content,
      status: 'active',
      category: 'problem-solving',
      isPinned: true,
      tags: ['problem-solving', 'analysis'],
    });
  }, [addDoc]);

  const restoreDoc = useCallback((docItem: KnowledgeDocument) => {
    if (docsRef.current.some((d) => d.id === docItem.id)) return;
    const restored = {
      ...docItem,
      updatedAt: now(),
      syncedWithCloud: Boolean(uidRef.current),
    };
    const next = [restored, ...docsRef.current];
    saveDocs(next);
    if (uidRef.current) {
      void saveBookToCloud(uidRef.current, restored);
    }
  }, [saveDocs]);

  const deleteDoc = useCallback((id: string) => {
    const target = docsRef.current.find((d) => d.id === id);
    const next = docsRef.current.filter((d) => d.id !== id);
    saveDocs(next);

    if (uidRef.current) {
      void deleteBookFromCloud(uidRef.current, id);
    }

    if (target) {
      const docToRestore = target;
      notifyItemDeleted({
        type: 'Document',
        title: docToRestore.title,
        restore: () => {
          restoreDoc(docToRestore);
        },
        redelete: () => {
          deleteDoc(id);
        },
      });
    }
  }, [saveDocs, restoreDoc]);

  const resetToDefaultDocs = useCallback(async () => {
    const defaults = defaultDocs();
    saveDocs(defaults);
    if (uidRef.current) {
      await wipeCloudBooks(uidRef.current);
      for (const d of defaults) {
        await saveBookToCloud(uidRef.current, d);
      }
    }
  }, [saveDocs]);

  return (
    <KnowledgeContext.Provider value={{
      docs,
      isLoaded,
      isCloudSynced,
      addDoc,
      updateDoc,
      deleteDoc,
      restoreDoc,
      togglePinDoc,
      toggleDocReminder,
      createProblemSolvingDoc,
      resetToDefaultDocs,
    }}>
      {children}
    </KnowledgeContext.Provider>
  );
}

export function useKnowledge() {
  const ctx = useContext(KnowledgeContext);
  if (!ctx) throw new Error('useKnowledge must be inside KnowledgeProvider');
  return ctx;
}
