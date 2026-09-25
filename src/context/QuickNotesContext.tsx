'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

const QUICK_NOTES_KEY = 'life_os_quick_notes_v1';

export interface QuickNote {
  id: string;
  text: string;
  createdAt: string;
}

const DEFAULT_QUICK_NOTES: QuickNote[] = [
  {
    id: 'qn-1',
    text: 'Check printing services in PH (affordable + quality)',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'qn-2',
    text: 'Research sweet potato (nutrition, shelf life, FDA)',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'qn-3',
    text: 'Learn business basics (opportunity, customer, market)',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'qn-4',
    text: 'Watch Norman Lewis 30 Days (English)',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

interface QuickNotesContextType {
  notes: QuickNote[];
  addNote: (text: string) => void;
  deleteNote: (id: string) => void;
  isLoaded: boolean;
}

const QuickNotesContext = createContext<QuickNotesContextType | undefined>(undefined);

export function QuickNotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const reloadFromStorage = () => {
    try {
      const raw = localStorage.getItem(QUICK_NOTES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as QuickNote[];
        setNotes(Array.isArray(parsed) ? parsed : []);
      } else {
        setNotes([]);
      }
    } catch {
      setNotes([]);
    }
  };

  useEffect(() => {
    reloadFromStorage();
    setIsLoaded(true);

    // Re-sync notes when cloud data arrives
    const handleSync = () => reloadFromStorage();
    window.addEventListener('life_os_cloud_synced', handleSync);
    return () => window.removeEventListener('life_os_cloud_synced', handleSync);
  }, []);

  const persist = (next: QuickNote[]) => {
    setNotes(next);
    try {
      localStorage.setItem(QUICK_NOTES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const addNote = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const newNote: QuickNote = {
      id: `qn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    persist([...notes, newNote]);
  };

  const deleteNote = (id: string) => {
    persist(notes.filter((n) => n.id !== id));
  };

  return (
    <QuickNotesContext.Provider value={{ notes, addNote, deleteNote, isLoaded }}>
      {children}
    </QuickNotesContext.Provider>
  );
}

export function useQuickNotes(): QuickNotesContextType {
  const ctx = useContext(QuickNotesContext);
  if (!ctx) throw new Error('useQuickNotes must be used within QuickNotesProvider');
  return ctx;
}
