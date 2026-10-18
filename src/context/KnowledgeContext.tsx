'use client';

import React, {
  createContext, useContext, useState,
  useCallback, useEffect, useRef, ReactNode,
} from 'react';
import type { KnowledgeDocument, DocumentStatus } from '@/types';
import { notifyItemDeleted } from './UndoContext';

import { idbGet, idbSet } from '@/lib/idbStore';

const STORAGE_KEY = 'life_os_knowledge_docs_v1';
const INITIALIZED_KEY = 'life_os_knowledge_initialized_v1';

function generateId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

function defaultDocs(): KnowledgeDocument[] {
  const t = now();
  return [
    {
      id: generateId(),
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
      id: generateId(),
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
      id: generateId(),
      title: 'Blender Learning Notes',
      content: `# Blender Learning Notes\n\n## Key Shortcuts\n- **G** — Grab/move\n- **R** — Rotate\n- **S** — Scale\n- **X** — Delete\n- **Tab** — Edit mode toggle\n\n## Workflow Tips\n- Always apply transforms before exporting\n- Use N-panel for precision values\n- Shade smooth + Auto Smooth for clean meshes\n\n## Resources\n- Blender Guru Donut tutorial\n- CG Cookie fundamentals\n`,
      status: 'active',
      tags: ['blender', '3d', 'learning'],
      createdAt: t,
      updatedAt: t,
    },
    {
      id: generateId(),
      title: 'Business Ideas',
      content: `# Business Ideas\n\n## Software Products\n- Personal finance tracker with envelope budgeting\n- Simple invoice generator for freelancers\n\n## Creative\n- Sell 3D assets on markets like Fab or Sketchfab\n- Commission character designs\n\n## Questions to Answer\n- What pain point am I uniquely able to solve?\n- What has the lowest startup cost?\n`,
      status: 'active',
      tags: ['business', 'ideas', 'future'],
      createdAt: t,
      updatedAt: t,
    },
  ];
}

type CreateInput = Omit<KnowledgeDocument, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateInput = Partial<Omit<KnowledgeDocument, 'id' | 'createdAt'>>;

interface KnowledgeContextValue {
  docs: KnowledgeDocument[];
  isLoaded: boolean;
  addDoc: (input: CreateInput) => KnowledgeDocument;
  updateDoc: (id: string, input: UpdateInput) => void;
  deleteDoc: (id: string) => void;
  restoreDoc: (doc: KnowledgeDocument) => void;
  togglePinDoc: (id: string) => void;
  createProblemSolvingDoc: (problemTitle?: string, initialDescription?: string) => KnowledgeDocument;
  resetToDefaultDocs: () => void;
}

const KnowledgeContext = createContext<KnowledgeContextValue | undefined>(undefined);

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const docsRef = useRef<KnowledgeDocument[]>([]);
  docsRef.current = docs;

  const reloadFromStorage = useCallback(async () => {
    let localDocs: KnowledgeDocument[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localDocs = parsed;
      }
    } catch {
      // ignore
    }

    // Check IndexedDB (which holds large docs and books without 5MB quota limit)
    try {
      const idbDocs = await idbGet<KnowledgeDocument[]>(STORAGE_KEY);
      if (Array.isArray(idbDocs) && idbDocs.length > 0) {
        // Merge with localDocs, prioritizing IndexedDB's full content for large books
        const map = new Map<string, KnowledgeDocument>();
        localDocs.forEach((d) => map.set(d.id, d));
        idbDocs.forEach((d) => {
          const existing = map.get(d.id);
          if (!existing) {
            map.set(d.id, d);
          } else {
            const idbLen = (d.content || '').length;
            const locLen = (existing.content || '').length;
            if (idbLen >= locLen || new Date(d.updatedAt || 0) >= new Date(existing.updatedAt || 0)) {
              map.set(d.id, d);
            }
          }
        });
        const merged = Array.from(map.values());
        setDocs(merged);
        docsRef.current = merged;
        setIsLoaded(true);
        return;
      }
    } catch (idbErr) {
      console.warn('[KnowledgeContext] IDB read error:', idbErr);
    }

    // Fallback if IDB was empty but localDocs exists
    if (localDocs.length > 0) {
      setDocs(localDocs);
      docsRef.current = localDocs;
      void idbSet(STORAGE_KEY, localDocs);
    } else {
      const isInit = typeof window !== 'undefined' ? localStorage.getItem(INITIALIZED_KEY) : 'true';
      if (!isInit) {
        const defaults = defaultDocs();
        setDocs(defaults);
        docsRef.current = defaults;
        void idbSet(STORAGE_KEY, defaults);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
          localStorage.setItem(INITIALIZED_KEY, 'true');
        } catch {}
      } else {
        setDocs([]);
        docsRef.current = [];
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    reloadFromStorage();

    const handleSync = () => reloadFromStorage();
    window.addEventListener('life_os_cloud_synced', handleSync);
    return () => window.removeEventListener('life_os_cloud_synced', handleSync);
  }, [reloadFromStorage]);

  const saveDocs = useCallback((next: KnowledgeDocument[]) => {
    docsRef.current = next;
    setDocs(next);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(INITIALIZED_KEY, 'true');
      } catch {}
    }

    // 1. Immediately persist full documents & books into IndexedDB (unlimited quota)
    void idbSet(STORAGE_KEY, next);

    // 2. Also save to localStorage for fast initial paint / cloud sync
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (quotaErr) {
      console.warn('[KnowledgeContext] localStorage quota exceeded, saving lightweight index while IndexedDB retains full content:', quotaErr);
      try {
        const lightDocs = next.map((d) => {
          if ((d.content || '').length > 40000) {
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

  const persist = useCallback((next: KnowledgeDocument[]) => {
    saveDocs(next);
  }, [saveDocs]);

  const addDoc = useCallback((input: CreateInput): KnowledgeDocument => {
    const t = now();
    const doc: KnowledgeDocument = { ...input, id: generateId(), createdAt: t, updatedAt: t };
    const next = [doc, ...docsRef.current];
    saveDocs(next);
    return doc;
  }, [saveDocs]);

  const updateDoc = useCallback((id: string, input: UpdateInput) => {
    const next = docsRef.current.map((d) => d.id === id ? { ...d, ...input, updatedAt: now() } : d);
    saveDocs(next);
  }, [saveDocs]);

  const togglePinDoc = useCallback((id: string) => {
    const next = docsRef.current.map((d) => d.id === id ? { ...d, isPinned: !d.isPinned, updatedAt: now() } : d);
    saveDocs(next);
  }, [saveDocs]);

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

  const restoreDoc = useCallback((doc: KnowledgeDocument) => {
    if (docsRef.current.some((d) => d.id === doc.id)) return;
    const next = [doc, ...docsRef.current];
    saveDocs(next);
  }, [saveDocs]);

  const deleteDoc = useCallback((id: string) => {
    const target = docsRef.current.find((d) => d.id === id);
    const next = docsRef.current.filter((d) => d.id !== id);
    saveDocs(next);

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

  const resetToDefaultDocs = useCallback(() => {
    saveDocs(defaultDocs());
  }, [saveDocs]);

  return (
    <KnowledgeContext.Provider value={{
      docs,
      isLoaded,
      addDoc,
      updateDoc,
      deleteDoc,
      restoreDoc,
      togglePinDoc,
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
