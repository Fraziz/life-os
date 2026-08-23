'use client';

import React, {
  createContext, useContext, useState,
  useCallback, useEffect, ReactNode,
} from 'react';
import type { KnowledgeDocument, DocumentStatus } from '@/types';

const STORAGE_KEY = 'life_os_knowledge_docs_v1';

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
      title: 'Life OS — Complete Operations Manual & Hierarchy Guide',
      content: `# Life OS — Official System Manual & Hierarchy Guide

## 1. Executive Overview
Life OS is an ADHD-friendly personal operating system designed to bridge the gap between long-term ambitions and daily execution. It eliminates overwhelm through structured hierarchy, visual chunking, and dopamine-positive feedback loops.

---

## 2. Core Execution Hierarchy
Every action in Life OS cascades downwards from long-term vision to daily execution:

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
   - Active initiatives with Kanban boards that group related tasks together.
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
    },
    {
      id: generateId(),
      title: 'Game Design Document — Blobbit',
      content: `# Blobbit — Game Design Document\n\n## Concept\nA 2D platformer where the player controls Blobbit, a sentient blob navigating a neon world.\n\n## Core Mechanics\n- **Movement**: Stretch and compress to gain momentum\n- **Abilities**: Wall cling, double jump, dash\n\n## Levels\n1. Tutorial Caverns\n2. Neon City\n3. Final Boss: The Void\n\n## Art Style\nNeon color palette, dark backgrounds, glowing outlines.\n\n## Todo\n- [ ] Design level 2 layout\n- [ ] Write boss fight logic\n- [ ] Create sound effects\n`,
      status: 'active',
      tags: ['game', 'design', 'blobbit'],
      createdAt: t,
      updatedAt: t,
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
      status: 'draft',
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
  resetToDefaultDocs: () => void;
}

const KnowledgeContext = createContext<KnowledgeContextValue | undefined>(undefined);

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const [docs, setDocs]       = useState<KnowledgeDocument[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const reloadFromStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) setDocs(parsed);
        else setDocs(defaultDocs());
      } else {
        setDocs(defaultDocs());
      }
    } catch {
      setDocs(defaultDocs());
    }
  };

  useEffect(() => {
    reloadFromStorage();
    setIsLoaded(true);

    const handleSync = () => reloadFromStorage();
    window.addEventListener('life_os_cloud_synced', handleSync);
    return () => window.removeEventListener('life_os_cloud_synced', handleSync);
  }, []);

  const persist = useCallback((next: KnowledgeDocument[]) => {
    setDocs(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
  }, []);

  const addDoc = useCallback((input: CreateInput): KnowledgeDocument => {
    const t = now();
    const doc: KnowledgeDocument = { ...input, id: generateId(), createdAt: t, updatedAt: t };
    setDocs((prev: KnowledgeDocument[]) => {
      const next = [doc, ...prev];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
    return doc;
  }, []);

  const updateDoc = useCallback((id: string, input: UpdateInput) => {
    setDocs((prev: KnowledgeDocument[]) => {
      const next = prev.map((d: KnowledgeDocument) => d.id === id ? { ...d, ...input, updatedAt: now() } : d);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const deleteDoc = useCallback((id: string) => {
    setDocs((prev: KnowledgeDocument[]) => {
      const next = prev.filter((d: KnowledgeDocument) => d.id !== id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const resetToDefaultDocs = useCallback(() => {
    persist(defaultDocs());
  }, [persist]);

  return (
    <KnowledgeContext.Provider value={{ docs, isLoaded, addDoc, updateDoc, deleteDoc, resetToDefaultDocs }}>
      {children}
    </KnowledgeContext.Provider>
  );
}

export function useKnowledge() {
  const ctx = useContext(KnowledgeContext);
  if (!ctx) throw new Error('useKnowledge must be inside KnowledgeProvider');
  return ctx;
}
