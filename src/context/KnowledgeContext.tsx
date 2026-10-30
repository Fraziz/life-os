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
      id: 'doc-sariling-mundo-manual',
      title: 'Sariling Mundo — Complete Operations Manual & Hierarchy Guide',
      content: `# Sariling Mundo — Official System Manual & Hierarchy Guide

## 1. Executive Overview
Sariling Mundo is an ADHD-friendly personal operating system designed to bridge the gap between long-term ambitions and daily execution. It eliminates overwhelm through structured hierarchy, visual chunking, and dopamine-positive feedback loops.

---

## 2. Core Execution Hierarchy
Every action in Sariling Mundo cascades downwards from long-term vision to daily execution:

1. **DREAM** (The Big Vision / North Star)
   - Found under \`Direction → Dreams\`
   - Captures high-level life aspirations and deep "Why it matters" statements.
2. **GOAL** (Measurable Outcome)
   - Found under \`Organize → Goals\`
   - Time-bound outcomes (Yearly, 90-Day, Monthly) that make dreams tangible.
3. **MILESTONE** (Journey Checkpoints)
   - Found under \`Organize → Milestones\`
   - Key checkpoints (25%, 50%, 75%) along a Goal's trajectory with target dates.
4. **PROJECT** (Execution Workstream)
   - Found under \`Organize → Projects\`
   - Active initiatives with visual boards that group related tasks together.
5. **TASK** (Bite-Sized Action)
   - Found under \`Organize → Tasks\` and the \`Today\` dashboard.
   - 15–45 minute actionable next steps. Includes an **AI Breakdown** tool to slice large tasks into tiny subtasks.
6. **FOCUS SESSION** (Execution)
   - Found under \`Today → Focus Mode\`
   - Pomodoro hyperfocus timer with Zen Mode and dopamine completion chimes.

---

## 3. Tab-by-Tab Feature Reference

### A. Today & Execution
- **Today (\`/\`)**: Daily mission control with Focus task, Time Capacity bar, and habit checklist.
- **Focus Mode (\`/focus\`)**: 15/25/45/90 minute timers, Zen Mode, and ambient soundscapes.

### B. Capture
- **Brain Dump (\`/inbox\`)**: Zero-friction idea capture. 1-click convert thoughts into Tasks, Projects, Goals, Dreams, or Notes.

### C. Direction
- **Life Roadmap (\`/roadmap\`)**: Interactive node graph connecting Tasks → Projects → Milestones → Goals → Dreams.
- **Life Areas (\`/areas\`)**: 8 life domains (Health, Career, Wealth, Learning, Social, Creative, Mindset, Family).

### D. Productivity Toolkit
- **Calendar (\`/calendar\`)**: Time-blocking schedule for daily and weekly time management.
- **Habits (\`/habits\`)**: Streak tracking, consistency heatmaps, and past-7-day history.
- **Weekly Review (\`/review\`)**: Sunday reflection system for wins, logged focus hours, and next week's focus.
- **Reset Plan (\`/reset\`)**: Overwhelm recovery button. Cleans backlog noise and gives you 1 simple next action.
- **Knowledge (\`/knowledge\`)**: Formal wiki, markdown documentation, and PDF/Text export.
- **Files (\`/files\`)**: Free cloud file vault for photos, documents, and Google Drive links.

---

## 4. Power Shortcuts
- **Ctrl + J** (or Center Compass button on Mobile): *"What Should I Do Right Now?"* AI Next Action picker.
- **Ctrl + K**: Global search across all entities.
- **Shift + ?**: Keyboard shortcuts cheatsheet.
`,
      status: 'active',
      tags: ['manual', 'guide', 'life-os', 'hierarchy'],
      createdAt: t,
      updatedAt: t,
      studyQuiz: [
        {
          question: 'What is the core execution hierarchy in Sariling Mundo from top to bottom?',
          answer: 'Dream → Goal → Milestone → Project → Task → Focus Session.',
          userMastered: true,
        },
        {
          question: 'What keyboard shortcut opens the "What Should I Do Right Now?" AI Next Action picker?',
          answer: 'Ctrl + J (or the Center Compass button on mobile bottom navigation).',
        },
        {
          question: 'Which view is designed for overwhelm recovery when your backlog is cluttered?',
          answer: 'Reset Plan (/reset), which clears mental noise and gives you 1 high-leverage next action.',
        },
      ],
    },
    {
      id: 'doc-game-blobbit',
      title: 'Game Design Document — Blobbit',
      content: `# Blobbit — Game Design Document\n\n## Concept\nA 2D platformer where the player controls Blobbit, a sentient blob navigating a neon world.\n\n## Core Mechanics\n- **Movement**: Stretch and compress to gain momentum\n- **Abilities**: Wall cling, double jump, dash\n\n## Levels\n1. Tutorial Caverns\n2. Neon City\n3. Final Boss: The Void\n\n## Art Style\nNeon color palette, dark backgrounds, glowing outlines.\n\n## Todo\n- [ ] Design level 2 layout\n- [ ] Write boss fight logic\n- [ ] Create sound effects\n`,
      status: 'active',
      tags: ['game', 'design', 'blobbit'],
      createdAt: t,
      updatedAt: t,
      studyQuiz: [
        {
          question: 'What is Blobbit\'s primary movement mechanic for gaining momentum?',
          answer: 'Stretching and compressing to propel forward and build speed.',
        },
        {
          question: 'What are Blobbit\'s core mobility abilities?',
          answer: 'Wall cling, double jump, and dash.',
        },
      ],
    },
    {
      id: 'doc-blender-notes',
      title: 'Blender Learning Notes',
      content: `# Blender Learning Notes\n\n## Key Shortcuts\n- **G** — Grab/move\n- **R** — Rotate\n- **S** — Scale\n- **X** — Delete\n- **Tab** — Edit mode toggle\n\n## Workflow Tips\n- Always apply transforms before exporting\n- Use N-panel for precision values\n- Shade smooth + Auto Smooth for clean meshes\n\n## Resources\n- Blender Guru Donut tutorial\n- CG Cookie fundamentals\n`,
      status: 'active',
      tags: ['blender', '3d', 'learning'],
      createdAt: t,
      updatedAt: t,
    },
    {
      id: 'doc-business-ideas',
      title: 'Business Ideas',
      content: `# Business Ideas\n\n## Software Products\n- Personal finance tracker with envelope budgeting\n- Simple invoice generator for freelancers\n\n## Creative\n- Sell 3D assets on markets like Fab or Sketchfab\n- Commission character designs\n\n## Questions to Answer\n- What pain point am I uniquely able to solve?\n- What has the lowest startup cost?\n`,
      status: 'active',
      tags: ['business', 'ideas', 'future'],
      createdAt: t,
      updatedAt: t,
    },
    {
      id: 'doc-guitar-masterclass',
      title: 'Guitar Masterclass — Theory & Soloing',
      content: `# Guitar Masterclass — Theory & Soloing

## Lesson 1: Pentatonic Scale Mastery & Fretboard Visualization
Welcome to the lead guitar study module. Follow the embedded video lesson below, review the practice drills, and launch Focus View for distraction-free study with your active Study Session timer.

<div class="video-lesson-block" data-video-lesson="true" data-video-id="2Q_ZzBGPdqE" data-url="https://www.youtube.com/watch?v=2Q_ZzBGPdqE" data-title="Guitar Lesson 1: Minor Pentatonic Box Patterns" data-start="0"></div>

### Core Concepts & Exercises:
- **Box 1 Pattern**: Root note on 6th string, frets 5-8, 5-7, 5-7, 5-7, 5-8, 5-8.
- **Picking Mechanics**: Alternate picking strictly down-up with relaxed wrist movement.
- **Practice Rhythm**: Set a metronome to 75 BPM and play 1/8th notes smoothly across all 6 strings.
`,
      status: 'active',
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
    };
  }, []);

  const reloadFromStorage = useCallback(async (isCloudSyncEvent: boolean = false) => {
    const map = new Map<string, KnowledgeDocument>();

    // 1. Recover from all known localStorage keys (current and legacy)
    const localKeys = [
      STORAGE_KEY,
      'life_os_knowledge_docs',
      'knowledge_docs',
      'life_os_books_v1',
      'life_os_books',
      'life_os_knowledge_docs_backup',
      'life_os_study_docs',
      'life_os_docs',
    ];

    for (const key of localKeys) {
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          list.forEach((d) => {
            if (d && typeof d === 'object' && d.id) {
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

    // Comprehensive scan across all localStorage keys for any saved book or study doc
    if (typeof localStorage !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith('life_os_') || k.includes('doc') || k.includes('book') || k.includes('knowledge')) {
            const raw = localStorage.getItem(k);
            if (raw && (raw.startsWith('[') || raw.startsWith('{'))) {
              try {
                const parsed = JSON.parse(raw);
                const items = Array.isArray(parsed) ? parsed : [parsed];
                items.forEach((d) => {
                  if (d && typeof d === 'object' && d.id && (d.title || d.content)) {
                    const existing = map.get(d.id);
                    if (!existing) {
                      map.set(d.id, d);
                    } else {
                      const newLen = (d.content || '').length;
                      const existLen = (existing.content || '').length;
                      if (newLen > existLen) map.set(d.id, d);
                    }
                  }
                });
              } catch {}
            }
          }
        }
      } catch {}
    }

    // 2. Recover from all IndexedDB keys (which hold large docs & books without 5MB quota limit)
    const idbKeys = [
      STORAGE_KEY,
      'life_os_knowledge_docs_backup',
      'life_os_knowledge_docs',
      'life_os_books_v1',
      'life_os_books',
    ];

    for (const key of idbKeys) {
      try {
        const idbDocs = await idbGet<KnowledgeDocument[]>(key);
        if (Array.isArray(idbDocs) && idbDocs.length > 0) {
          idbDocs.forEach((d) => {
            if (!d || !d.id) return;
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
          });
        }
      } catch (idbErr) {
        console.warn(`[KnowledgeContext] IDB read error for ${key}:`, idbErr);
      }
    }

    // Comprehensive scan across all IndexedDB values via idbGetAll
    try {
      const allIdbEntries = await idbGetAll<unknown>();
      allIdbEntries.forEach((entry) => {
        if (Array.isArray(entry)) {
          entry.forEach((d) => {
            if (d && typeof d === 'object' && d.id && (d.title || d.content)) {
              const existing = map.get(d.id);
              if (!existing) {
                map.set(d.id, d);
              } else {
                const newLen = (d.content || '').length;
                const existLen = (existing.content || '').length;
                if (newLen > existLen) map.set(d.id, d);
              }
            }
          });
        }
      });
    } catch {}

    // 3. Defaults & User Books preservation:
    const defaults = defaultDocs();
    if (map.size === 0) {
      // First time initialization: populate default starter documents
      defaults.forEach((d) => map.set(d.id, d));
    } else {
      // Keep defaults available if user has never touched them, without duplicating
      defaults.forEach((d) => {
        if (!map.has(d.id)) {
          // If a user has another doc with matching title, don't duplicate
          const hasMatchingTitle = Array.from(map.values()).some((existing) => existing.title === d.title);
          if (!hasMatchingTitle) {
            map.set(d.id, d);
          }
        }
      });
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
        const remoteMap = new Map(remoteDocs.map((d) => [d.id, d]));

        let stateChanged = false;

        // 1. Process remote books: merge or update local
        for (const remote of remoteDocs) {
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
        for (const local of localList) {
          if (!remoteMap.has(local.id)) {
            // Never delete local books! Push to cloud so they are permanently preserved.
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
        const updated = {
          ...d,
          ...input,
          updatedAt: now(),
          syncedWithCloud: Boolean(uidRef.current),
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
