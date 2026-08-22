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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setDocs(raw ? JSON.parse(raw) : []);
    } catch {
      setDocs([]);
    }
    setIsLoaded(true);
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
