'use client';

import React, {
  createContext, useContext, useCallback,
  useState, ReactNode,
} from 'react';
import { useDreams } from './DreamContext';
import { useGoals } from './GoalContext';
import { useProjects } from './ProjectContext';
import { useTasks } from './TaskContext';
import { useHabits } from './HabitContext';
import { useInbox } from './InboxContext';
import { useKnowledge } from './KnowledgeContext';

export type SearchResultType = 'dream' | 'goal' | 'project' | 'task' | 'habit' | 'brain_dump' | 'document';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  tags?: string[];
  href: string;
  color?: string;
  status?: string;
}

interface SearchContextValue {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  activeTypes: SearchResultType[];
  toggleType: (t: SearchResultType) => void;
  isOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
  const { dreams }   = useDreams();
  const { goals }    = useGoals();
  const { projects } = useProjects();
  const { tasks }    = useTasks();
  const { habits }   = useHabits();
  const { items }    = useInbox();
  const { docs }     = useKnowledge();

  const [query, setQuery]           = useState('');
  const [isOpen, setIsOpen]         = useState(false);
  const [activeTypes, setActiveTypes] = useState<SearchResultType[]>([
    'dream', 'goal', 'project', 'task', 'habit', 'brain_dump', 'document',
  ]);

  const openSearch  = useCallback(() => setIsOpen(true), []);
  const closeSearch = useCallback(() => { setIsOpen(false); setQuery(''); }, []);

  const toggleType = useCallback((t: SearchResultType) => {
    setActiveTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }, []);

  const q = query.toLowerCase().trim();

  const results: SearchResult[] = q.length < 2 ? [] : [
    ...(activeTypes.includes('dream') ? dreams
      .filter((d) => d.title.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q) || d.whyItMatters?.toLowerCase().includes(q))
      .map((d) => ({ id: d.id, type: 'dream' as const, title: d.title, subtitle: d.whyItMatters, href: '/dreams', status: d.status }))
      : []),

    ...(activeTypes.includes('goal') ? goals
      .filter((g) => g.title.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q) || g.why?.toLowerCase().includes(q))
      .map((g) => ({ id: g.id, type: 'goal' as const, title: g.title, subtitle: g.why, href: '/goals', color: g.color, status: g.status }))
      : []),

    ...(activeTypes.includes('project') ? projects
      .filter((p) => p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.notes?.toLowerCase().includes(q))
      .map((p) => ({ id: p.id, type: 'project' as const, title: p.title, subtitle: p.description, href: '/projects', color: p.color, status: p.status }))
      : []),

    ...(activeTypes.includes('task') ? tasks
      .filter((t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.tags?.some((tag) => tag.toLowerCase().includes(q)))
      .map((t) => ({ id: t.id, type: 'task' as const, title: t.title, subtitle: t.description, href: '/tasks', color: t.color, tags: t.tags, status: t.status }))
      : []),

    ...(activeTypes.includes('habit') ? habits
      .filter((h) => h.title.toLowerCase().includes(q) || h.description?.toLowerCase().includes(q))
      .map((h) => ({ id: h.id, type: 'habit' as const, title: h.title, subtitle: h.description, href: '/habits', color: h.color }))
      : []),

    ...(activeTypes.includes('brain_dump') ? items
      .filter((i) => i.content.toLowerCase().includes(q) && i.status !== 'archived')
      .map((i) => ({ id: i.id, type: 'brain_dump' as const, title: i.content.slice(0, 80), subtitle: `Brain Dump — ${i.status}`, href: '/inbox' }))
      : []),

    ...(activeTypes.includes('document') ? docs
      .filter((doc) => doc.title.toLowerCase().includes(q) || doc.content.toLowerCase().includes(q) || doc.tags?.some((tag) => tag.toLowerCase().includes(q)))
      .map((doc) => ({ id: doc.id, type: 'document' as const, title: doc.title, subtitle: doc.content.slice(0, 80), href: '/knowledge', tags: doc.tags, status: doc.status }))
      : []),
  ];

  return (
    <SearchContext.Provider value={{ query, setQuery, results, activeTypes, toggleType, isOpen, openSearch, closeSearch }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be inside SearchProvider');
  return ctx;
}
