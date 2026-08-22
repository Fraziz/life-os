'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { CalendarEvent, ScheduledWorkBlock, Task } from '@/types';
import { useTasks } from './TaskContext';
import { useMilestones } from './MilestoneContext';
import { useProjects } from './ProjectContext';
import { loadJsonArray } from '@/lib/localStore';

const EVENTS_STORAGE_KEY = 'life_os_calendar_events_v1';
const BLOCKS_STORAGE_KEY = 'life_os_scheduled_blocks_v1';

export const DEFAULT_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'evt-1',
    title: 'Dentist Checkup & Cleaning',
    date: new Date().toISOString().split('T')[0],
    startTime: '14:00',
    endTime: '15:00',
    allDay: false,
    color: '#38bdf8',
    notes: 'Downtown dental clinic.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'evt-2',
    title: 'Design System & Architecture Sync',
    date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '11:00',
    allDay: false,
    color: '#a855f7',
    notes: 'Review life os roadmap milestones.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const DEFAULT_SCHEDULED_BLOCKS: ScheduledWorkBlock[] = [
  {
    id: 'block-1',
    taskId: 'task-blobbit-env',
    taskTitle: 'Create Blobbit environment',
    date: new Date().toISOString().split('T')[0],
    startTime: '19:00',
    durationMinutes: 90,
    notes: 'I plan to work on level design & lighting Friday evening at 7 PM.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'block-2',
    taskId: 'task-1',
    taskTitle: 'Implement wall-jump vector math and friction curve',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    startTime: '09:30',
    durationMinutes: 45,
    notes: 'Deep focus on detachment impulse.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export interface DeadlineItem {
  id: string;
  title: string;
  date: string;
  sourceType: 'task' | 'milestone' | 'project';
  priority?: string;
  status?: string;
  entityId: string;
}

interface CalendarContextType {
  events: CalendarEvent[];
  scheduledBlocks: ScheduledWorkBlock[];
  deadlines: DeadlineItem[];
  addEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEvent: (id: string, partial: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  scheduleTaskBlock: (taskId: string, date: string, startTime: string, durationMinutes: number, notes?: string) => void;
  removeScheduledBlock: (id: string) => void;
  getDeadlinesForDate: (dateStr: string) => DeadlineItem[];
  getScheduledBlocksForDate: (dateStr: string) => ScheduledWorkBlock[];
  getEventsForDate: (dateStr: string) => CalendarEvent[];
  resetToDefaultCalendar: () => void;
  isLoaded: boolean;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const { tasks, isLoaded: tasksLoaded } = useTasks();
  const { milestones, isLoaded: milestonesLoaded } = useMilestones();
  const { projects, isLoaded: projectsLoaded } = useProjects();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [scheduledBlocks, setScheduledBlocks] = useState<ScheduledWorkBlock[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const reloadFromStorage = () => {
    try {
      const parsedEvents = loadJsonArray<CalendarEvent>(EVENTS_STORAGE_KEY);
      if (parsedEvents && parsedEvents.length > 0) setEvents(parsedEvents);
      else if (!parsedEvents) setEvents(DEFAULT_CALENDAR_EVENTS);

      const parsedBlocks = loadJsonArray<ScheduledWorkBlock>(BLOCKS_STORAGE_KEY);
      if (parsedBlocks && parsedBlocks.length > 0) setScheduledBlocks(parsedBlocks);
      else if (!parsedBlocks) setScheduledBlocks(DEFAULT_SCHEDULED_BLOCKS);
    } catch (err) {
      console.error('Failed to load Calendar data:', err);
    }
  };

  useEffect(() => {
    reloadFromStorage();
    setIsLoaded(true);

    const handleSync = () => reloadFromStorage();
    window.addEventListener('life_os_cloud_synced', handleSync);
    return () => window.removeEventListener('life_os_cloud_synced', handleSync);
  }, []);

  const saveEvents = (newEvents: CalendarEvent[]) => {
    setEvents(newEvents);
    try {
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(newEvents));
    } catch (err) {
      console.error('Failed to save Calendar events:', err);
    }
  };

  const saveBlocks = (newBlocks: ScheduledWorkBlock[]) => {
    setScheduledBlocks(newBlocks);
    try {
      localStorage.setItem(BLOCKS_STORAGE_KEY, JSON.stringify(newBlocks));
    } catch (err) {
      console.error('Failed to save Scheduled work blocks:', err);
    }
  };

  const addEvent = (data: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newEvent: CalendarEvent = {
      ...data,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveEvents([newEvent, ...events]);
  };

  const updateEvent = (id: string, partial: Partial<CalendarEvent>) => {
    const updated = events.map((e) =>
      e.id === id ? { ...e, ...partial, updatedAt: new Date().toISOString() } : e
    );
    saveEvents(updated);
  };

  const deleteEvent = (id: string) => {
    saveEvents(events.filter((e) => e.id !== id));
  };

  const scheduleTaskBlock = (
    taskId: string,
    date: string,
    startTime: string,
    durationMinutes: number,
    notes?: string
  ) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    const newBlock: ScheduledWorkBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      taskId,
      taskTitle: targetTask ? targetTask.title : 'Scheduled Task',
      date,
      startTime,
      durationMinutes,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveBlocks([newBlock, ...scheduledBlocks]);
  };

  const removeScheduledBlock = (id: string) => {
    saveBlocks(scheduledBlocks.filter((b) => b.id !== id));
  };

  const resetToDefaultCalendar = () => {
    saveEvents(DEFAULT_CALENDAR_EVENTS);
    saveBlocks(DEFAULT_SCHEDULED_BLOCKS);
  };

  // Compile all Deadlines across tasks, milestones, and projects
  const deadlines: DeadlineItem[] = [];

  tasks.forEach((t) => {
    if (t.dueDate) {
      deadlines.push({
        id: `dl-task-${t.id}`,
        title: t.title,
        date: t.dueDate,
        sourceType: 'task',
        priority: t.priority,
        status: t.status,
        entityId: t.id,
      });
    }
  });

  milestones.forEach((m) => {
    if (m.targetDate) {
      deadlines.push({
        id: `dl-ms-${m.id}`,
        title: `Milestone: ${m.title}`,
        date: m.targetDate,
        sourceType: 'milestone',
        status: m.status,
        entityId: m.id,
      });
    }
  });

  projects.forEach((p) => {
    if (p.dueDate) {
      deadlines.push({
        id: `dl-proj-${p.id}`,
        title: `Project: ${p.title}`,
        date: p.dueDate,
        sourceType: 'project',
        priority: p.priority,
        status: p.status,
        entityId: p.id,
      });
    }
  });

  const getDeadlinesForDate = (dateStr: string) => {
    return deadlines.filter((d) => d.date === dateStr);
  };

  const getScheduledBlocksForDate = (dateStr: string) => {
    return scheduledBlocks.filter((b) => b.date === dateStr);
  };

  const getEventsForDate = (dateStr: string) => {
    return events.filter((e) => e.date === dateStr);
  };

  return (
    <CalendarContext.Provider
      value={{
        events,
        scheduledBlocks,
        deadlines,
        addEvent,
        updateEvent,
        deleteEvent,
        scheduleTaskBlock,
        removeScheduledBlock,
        getDeadlinesForDate,
        getScheduledBlocksForDate,
        getEventsForDate,
        resetToDefaultCalendar,
        isLoaded: isLoaded && tasksLoaded && milestonesLoaded && projectsLoaded,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar(): CalendarContextType {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}
