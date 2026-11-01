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

import { idbGet, idbSet } from '@/lib/idbStore';
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
      author: 'Life OS System Guide',
      status: 'active',
      category: 'guides',
      docType: 'document',
      readStatus: 'reading',
      currentPage: 1,
      totalPages: 18,
      readProgress: 5,
      tags: ['manual', 'guide', 'life-os', 'hierarchy', 'book'],
      createdAt: t,
      updatedAt: t,
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
      readingLogs: [
        {
          id: 'log_manual_1',
          startedAt: t,
          durationMinutes: 20,
          timeOfDay: '8:00 AM',
          notes: 'Reviewed system hierarchy and keyboard shortcuts cheatsheet.',
        },
      ],
      totalReadMinutes: 20,
    },
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
*An Easy & Proven Way to Build Good Habits & Break Bad Ones*

## Executive Summary
Small habits do not simply add up; they compound. If you can get 1% better each day for one year, you will end up 37 times better by the time you are done. Conversely, if you get 1% worse each day for one year, you will decline nearly down to zero.

---

## 1. The Fundamentals: Why Tiny Changes Make a Big Difference

### The Plateau of Latent Potential
Habits often appear to make no difference until you cross a critical threshold—the **Plateau of Latent Potential**.
- Work is not wasted; it is simply being stored.
- Results lag behind effort; breakthroughs are the result of many prior compounding actions.

### Forget Goals, Focus on Systems
- **Goals** are about the results you want to achieve.
- **Systems** are about the processes that lead to those results.
- Problems arise when you spend too much time thinking about your goals and not enough time designing your systems.
> "You do not rise to the level of your goals. You fall to the level of your systems."

### Identity-Based Habits: The 3 Layers of Behavior Change
1. **Outcomes** (What you get) — losing weight, publishing a book, winning a race.
2. **Processes** (What you do) — implementing a new workout routine, cleaning your desk.
3. **Identity** (What you believe) — your worldviews, your self-image, your beliefs about what you are capable of.
- The goal is not to read a book; the goal is to **become a reader**.
- The goal is not to run a marathon; the goal is to **become a runner**.
- Every action you take is a vote for the type of person you wish to become.

---

## 2. The Habit Loop & The Four Laws of Behavior Change

Every habit is governed by a neurological feedback loop:
**Cue** -> **Craving** -> **Response** -> **Reward**

| Phase | Problem Phase | Solution Phase |
| :--- | :--- | :--- |
| **How to Create a Good Habit** | 1. Make it obvious | 2. Make it attractive | 3. Make it easy | 4. Make it satisfying |
| **How to Break a Bad Habit** | 1. Make it invisible | 2. Make it unattractive | 3. Make it difficult | 4. Make it unsatisfying |

---

## 3. The 1st Law: Make It Obvious

### Implementation Intentions
State clearly when and where you will perform the habit:
> "I will [BEHAVIOR] at [TIME] in [LOCATION]."

### Habit Stacking
Pair a new habit with an existing current habit:
> "After [CURRENT HABIT], I will [NEW HABIT]."
- *Example*: "After I pour my morning cup of coffee, I will meditate for 60 seconds."
- *Example*: "After I close my laptop for the day, I will write down tomorrow's 3 priority tasks."

### Environment Design
- Visual cues are the greatest catalyst of behavior.
- Make the cues of good habits prominent and visible in your space.
- Inversely, make the cues of bad habits invisible: hide snacks, place phone in another room during focus blocks.
- **One space, one use**: Dedicate specific desks or rooms for work, reading, or rest.

---

## 4. The 2nd Law: Make It Attractive

### Temptation Bundling
Link an action you *need* to do with an action you *want* to do:
> "After [HABIT I NEED], I will [HABIT I WANT]."
- *Example*: "After I finish 25 minutes of deep focus study, I will check sports scores."

### The Power of Social Norms
Join a culture where:
1. Your desired behavior is the normal behavior.
2. You already have something in common with the group.

---

## 5. The 3rd Law: Make It Easy

### Reduce Friction
- Prime your environment to make future actions easier.
- Lay out workout clothes the night before.
- Set up your Life OS dashboard with your top focus task before logging off.

### The Two-Minute Rule
When you start a new habit, it should take less than two minutes to do.
- "Read before bed each night" becomes "Read one page."
- "Do thirty minutes of yoga" becomes "Take out my yoga mat."
- "Study for class" becomes "Open my notes."
- Optimize for the starting line. Standardize before you optimize.

---

## 6. The 4th Law: Make It Satisfying

### The Cardinal Rule of Behavior Change
What is immediately rewarded is repeated. What is immediately punished is avoided.
- Use immediate reinforcement to feel good right now.

### Habit Trackers & "Never Miss Twice"
- Tracking creates a visual cue that reminds you to act.
- Making progress is inherently satisfying.
- **Rule**: If you miss one day due to an emergency or fatigue, never miss two days in a row. Missing once is an accident; missing twice is the start of a new habit.

---

## Key Takeaways to Apply in Sariling Mundo
1. **Focus Mode**: Leverage 25-minute Pomodoro sprints to eliminate the friction of starting.
2. **Brain Dump**: Capture loose ideas immediately so mental friction does not hijack your workflow.
3. **Daily Habit Checklist**: Check off tiny votes for your identity every morning and evening.
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
      studyQuiz: [
        {
          question: 'What is the Deep Work Hypothesis according to Cal Newport?',
          answer: 'The ability to perform deep work is becoming increasingly rare at exactly the same time it is becoming increasingly valuable in our economy.',
          userMastered: true,
        },
      ],
      readingLogs: [
        {
          id: 'log_deep_1',
          startedAt: t,
          durationMinutes: 20,
          timeOfDay: '10:00 AM',
          notes: 'Studied core strategies and monastic focus blocks.',
        },
      ],
      totalReadMinutes: 20,
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
    {
      id: 'doc-game-blobbit',
      title: 'Game Design Document — Blobbit',
      author: 'Game Design Workshop',
      status: 'active',
      category: 'learning',
      docType: 'document',
      readStatus: 'reading',
      currentPage: 1,
      totalPages: 12,
      readProgress: 8,
      tags: ['gamedev', 'design', 'blobbit', 'book'],
      createdAt: t,
      updatedAt: t,
      content: `# Blobbit — Game Design Document

## Concept
A 2D platformer where the player controls Blobbit, a sentient blob navigating a neon world.

## Core Mechanics
- **Movement**: Stretch and compress to gain momentum
- **Abilities**: Wall cling, double jump, dash

## Levels
1. Tutorial Caverns
2. Neon City
3. Final Boss: The Void

## Art Style
Neon color palette, dark backgrounds, glowing outlines.

## Todo
- [ ] Design level 2 layout
- [ ] Write boss fight logic
- [ ] Create sound effects
`,
      studyQuiz: [
        {
          question: 'What are the core movement mechanics of Blobbit?',
          answer: 'Stretch and compress to gain momentum, wall cling, double jump, and dash.',
          userMastered: true,
        },
      ],
      readingLogs: [
        {
          id: 'log_blobbit_1',
          startedAt: t,
          durationMinutes: 15,
          timeOfDay: '2:00 PM',
          notes: 'Drafted core mechanics and initial level sketches.',
        },
      ],
      totalReadMinutes: 15,
    },
    {
      id: 'doc-blender-notes',
      title: 'Blender Learning Notes',
      author: '3D Modeling Lab',
      status: 'active',
      category: 'learning',
      docType: 'document',
      readStatus: 'reading',
      currentPage: 1,
      totalPages: 15,
      readProgress: 10,
      tags: ['3d', 'blender', 'shortcuts', 'book'],
      createdAt: t,
      updatedAt: t,
      content: `# Blender Learning Notes

## Key Shortcuts
- **G** — Grab/move
- **R** — Rotate
- **S** — Scale
- **X** — Delete
- **Tab** — Edit mode toggle

## Workflow Tips
- Always apply transforms before exporting (\`Ctrl + A\`)
- Use N-panel for precision values
- Shade smooth + Auto Smooth for clean meshes

## Resources
- Blender Guru Donut tutorial
- CG Cookie fundamentals
`,
      studyQuiz: [
        {
          question: 'What shortcut in Blender is used to toggle between Object Mode and Edit Mode?',
          answer: 'Tab.',
          userMastered: true,
        },
      ],
      readingLogs: [
        {
          id: 'log_blender_1',
          startedAt: t,
          durationMinutes: 20,
          timeOfDay: '3:30 PM',
          notes: 'Reviewed viewport navigation and object transformation shortcuts.',
        },
      ],
      totalReadMinutes: 20,
    },
    {
      id: 'doc-business-ideas',
      title: 'Business Ideas',
      author: 'Product Strategy Guide',
      status: 'active',
      category: 'ideas',
      docType: 'document',
      readStatus: 'reading',
      currentPage: 1,
      totalPages: 8,
      readProgress: 12,
      tags: ['business', 'ideas', 'startups', 'book'],
      createdAt: t,
      updatedAt: t,
      content: `# Business Ideas

## Software Products
- Personal finance tracker with envelope budgeting
- Simple invoice generator for freelancers

## Creative
- Sell 3D assets on markets like Fab or Sketchfab
- Commission character designs

## Questions to Answer
- What pain point am I uniquely able to solve?
- What has the lowest startup cost?
`,
      studyQuiz: [
        {
          question: 'What are the two core questions to answer when evaluating a business idea?',
          answer: 'What pain point am I uniquely able to solve, and what has the lowest startup cost?',
          userMastered: true,
        },
      ],
      readingLogs: [
        {
          id: 'log_ideas_1',
          startedAt: t,
          durationMinutes: 15,
          timeOfDay: '11:00 AM',
          notes: 'Brainstormed software and digital creative product opportunities.',
        },
      ],
      totalReadMinutes: 15,
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
  deleteDocs: (ids: string[]) => void;
  restoreDoc: (doc: KnowledgeDocument) => void;
  togglePinDoc: (id: string) => void;
  toggleDocReminder: (id: string) => void;
  createProblemSolvingDoc: (problemTitle?: string, initialDescription?: string) => KnowledgeDocument;
  resetToDefaultDocs: () => void;
  restoreStarterBooks: () => void;
}

const KnowledgeContext = createContext<KnowledgeContextValue | undefined>(undefined);

export function isTrueBookOrVideo(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  if (!item.id || typeof item.id !== 'string') return false;

  const id = item.id.toLowerCase();

  // 1. Strictly reject Inbox / Idea Parking / Brain Dump items
  if (
    id.startsWith('inbox') ||
    id.startsWith('thought') ||
    id.startsWith('dump') ||
    id.startsWith('idea')
  ) {
    return false;
  }
  if (
    item.itemType === 'thought' ||
    item.itemType === 'reminder' ||
    item.convertedTo !== undefined ||
    item.convertedPriority !== undefined ||
    item.convertedEntityId !== undefined ||
    item.isApplied !== undefined ||
    item.appliedAt !== undefined ||
    item.reminderTime !== undefined
  ) {
    return false;
  }
  if (item.status === 'inbox' || item.status === 'converted' || item.status === 'someday') {
    return false;
  }

  // 2. Strictly reject Tasks & Subtasks
  if (
    id.startsWith('task') ||
    id.startsWith('t_') ||
    id.startsWith('t-') ||
    id.startsWith('subtask')
  ) {
    return false;
  }
  if (
    item.status === 'backlog' ||
    item.status === 'todo' ||
    item.status === 'doing' ||
    item.status === 'done'
  ) {
    return false;
  }
  if (Array.isArray(item.subtasks) || item.isCompound !== undefined || item.parentTaskId !== undefined) {
    return false;
  }
  if (item.estimatedDuration !== undefined || item.actualDuration !== undefined) {
    return false;
  }
  if (item.dueDate !== undefined) {
    return false;
  }
  if (item.projectId !== undefined || item.goalId !== undefined || item.lifeAreaId !== undefined) {
    return false;
  }

  // 3. Strictly reject Goals, Milestones, Dreams, Life Areas
  if (
    id.startsWith('goal') ||
    id.startsWith('g_') ||
    id.startsWith('g-') ||
    id.startsWith('milestone') ||
    id.startsWith('dream') ||
    id.startsWith('d_') ||
    id.startsWith('d-') ||
    id.startsWith('area')
  ) {
    return false;
  }
  if (item.horizon !== undefined || item.why !== undefined || item.parentDreamId !== undefined) {
    return false;
  }
  if (item.whyItMatters !== undefined || item.visionPrompt !== undefined) {
    return false;
  }

  // 4. Strictly reject Projects
  if (
    id.startsWith('project') ||
    id.startsWith('p_') ||
    id.startsWith('p-')
  ) {
    return false;
  }
  if (
    item.status === 'planning' ||
    item.status === 'on-hold' ||
    item.status === 'cancelled' ||
    item.startDate !== undefined ||
    item.milestoneId !== undefined
  ) {
    return false;
  }

  // 5. Strictly reject Habits, Workouts, Routines, Reviews, Calendar Events, Settings
  if (
    id.startsWith('habit') ||
    id.startsWith('h_') ||
    id.startsWith('h-') ||
    id.startsWith('workout') ||
    id.startsWith('routine') ||
    id.startsWith('exercise') ||
    id.startsWith('review') ||
    id.startsWith('event') ||
    id.startsWith('setting') ||
    id.startsWith('user') ||
    id.startsWith('block')
  ) {
    return false;
  }
  if (
    item.streak !== undefined ||
    item.completedDates !== undefined ||
    item.frequency !== undefined ||
    item.exercises !== undefined ||
    item.routineId !== undefined ||
    item.columns !== undefined
  ) {
    return false;
  }

  // 6. Must have either a valid title or non-empty content
  const hasTitle = typeof item.title === 'string' && item.title.trim().length > 0;
  const hasContent = typeof item.content === 'string' && item.content.trim().length > 0;
  if (!hasTitle && !hasContent) return false;

  // 7. Positive Book / Document Confirmation Check:
  const isExplicitDocType = item.docType === 'document' || item.docType === 'video-lesson';
  const hasDocId = id.startsWith('doc') || id.startsWith('book');
  const hasBookProps =
    item.readStatus !== undefined ||
    Array.isArray(item.studyQuiz) ||
    Array.isArray(item.readingLogs) ||
    typeof item.totalPages === 'number' ||
    typeof item.currentPage === 'number' ||
    typeof item.readProgress === 'number' ||
    typeof item.totalReadMinutes === 'number' ||
    item.fileUrl !== undefined ||
    item.fileName !== undefined ||
    item.fileType !== undefined ||
    item.author !== undefined ||
    item.preferredReadingTime !== undefined;

  const validCategories = [
    'personal', 'work', 'learning', 'archive', 'reference',
    'study-guide', 'problem-solving', 'guides', 'systems',
    'business', 'creative', 'health', 'finance', 'mindset', 'tech'
  ];
  const hasDocCategory = typeof item.category === 'string' && validCategories.includes(item.category);

  const hasBookTags =
    Array.isArray(item.tags) &&
    item.tags.some((t: any) =>
      typeof t === 'string' &&
      ['book', 'reading', 'manual', 'guide', 'study', 'notes', 'doc', 'document', 'lesson', 'summary'].includes(t.toLowerCase())
    );

  if (!isExplicitDocType && !hasDocId && !hasBookProps && !hasDocCategory && !hasBookTags) {
    return false;
  }

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
    const isVideo = isDocVideoLesson(doc);
    return {
      ...doc,
      content: doc.content || '',
      status: doc.status || 'active',
      docType: doc.docType || (isVideo ? 'video-lesson' : 'document'),
      tags: Array.isArray(doc.tags) ? doc.tags.filter(Boolean) : [],
    };
  }, []);

  const reloadFromStorage = useCallback(async (isCloudSyncEvent: boolean = false) => {
    const map = new Map<string, KnowledgeDocument>();

    // 1. Recover from specific book storage keys
    const bookKeys = [
      STORAGE_KEY,
      'life_os_knowledge_docs_backup',
      'life_os_books_v1',
      'life_os_books',
      'life_os_knowledge_docs',
      'knowledge_docs',
      'life_os_study_docs',
      'life_os_docs',
      'life_os_imported_books',
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

    // 2. Recover from IndexedDB book keys (strictly dedicated book keys)
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
                const existingIsTruncated = (existing.content || '').includes('[...Full');
                const idbIsTruncated = (d.content || '').includes('[...Full');
                if (existingIsTruncated && !idbIsTruncated) {
                  map.set(d.id, d);
                } else if (!idbIsTruncated && idbLen >= existLen) {
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

    // 4. Defaults & User Books preservation and healing:
    const defaults = defaultDocs();
    defaults.forEach((d) => {
      const existing = map.get(d.id);
      if (!existing) {
        const hasMatchingTitle = Array.from(map.values()).some((e) => e.title === d.title);
        if (!hasMatchingTitle) {
          map.set(d.id, d);
        }
      } else {
        const existContent = existing.content || '';
        const defaultContent = d.content || '';
        // If content was truncated, stripped, or shortened, heal it back to complete content!
        if (
          existContent.includes('[...Full book content preserved') ||
          existContent.includes('[...Full document saved') ||
          (defaultContent.length > existContent.length && existContent.length < 150)
        ) {
          existing.content = defaultContent;
        }
        if ((!existing.studyQuiz || existing.studyQuiz.length === 0) && d.studyQuiz && d.studyQuiz.length > 0) {
          existing.studyQuiz = d.studyQuiz;
        }
        if ((!existing.readingLogs || existing.readingLogs.length === 0) && d.readingLogs && d.readingLogs.length > 0) {
          existing.readingLogs = d.readingLogs;
        }
      }
    });

    // 5. Ensure no non-book objects leaked into the library
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

    // 6. Critical: Persist full merged books library to IndexedDB
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
      } catch (quotaErr) {
        console.warn('[KnowledgeContext] LocalStorage full; IndexedDB retains complete full content:', quotaErr);
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
      console.warn('[KnowledgeContext] localStorage quota exceeded, full content preserved in IndexedDB:', quotaErr);
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

        // Delete ANY confirmed non-book entity mistakenly uploaded to Firestore books collection
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

  const purgeIdsFromAllBookBackups = (ids: string[]) => {
    const idSet = new Set(ids);
    const backupKeys = [
      'life_os_knowledge_docs_backup',
      'life_os_books_v1',
      'life_os_books',
      'life_os_knowledge_docs',
      'knowledge_docs',
      'life_os_study_docs',
      'life_os_docs',
      'life_os_imported_books',
    ];
    if (typeof window !== 'undefined') {
      backupKeys.forEach((k) => {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const cleaned = parsed.filter((item: any) => item && !idSet.has(item.id));
              localStorage.setItem(k, JSON.stringify(cleaned));
            }
          }
        } catch {}
      });
    }
  };

  const deleteDoc = useCallback((id: string) => {
    const target = docsRef.current.find((d) => d.id === id);
    const next = docsRef.current.filter((d) => d.id !== id);
    saveDocs(next);
    purgeIdsFromAllBookBackups([id]);

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

  const deleteDocs = useCallback((ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    const deletedItems = docsRef.current.filter((d) => idSet.has(d.id));
    const next = docsRef.current.filter((d) => !idSet.has(d.id));
    saveDocs(next);
    purgeIdsFromAllBookBackups(ids);

    if (uidRef.current) {
      ids.forEach((id) => {
        void deleteBookFromCloud(uidRef.current!, id);
      });
    }

    if (deletedItems.length > 0) {
      notifyItemDeleted({
        type: 'Document',
        title: deletedItems.length === 1 ? deletedItems[0].title : `${deletedItems.length} books`,
        restore: () => {
          deletedItems.forEach((doc) => restoreDoc(doc));
        },
        redelete: () => {
          deleteDocs(ids);
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

  const restoreStarterBooks = useCallback(() => {
    const defaults = defaultDocs();
    const currentMap = new Map(docsRef.current.map((d) => [d.id, d]));
    let countRestored = 0;

    for (const d of defaults) {
      const existing = currentMap.get(d.id);
      if (!existing) {
        const hasMatchingTitle = Array.from(currentMap.values()).some((e) => e.title === d.title);
        if (!hasMatchingTitle) {
          currentMap.set(d.id, d);
          countRestored++;
          if (uidRef.current) {
            void saveBookToCloud(uidRef.current, d);
          }
        }
      } else {
        const existContent = existing.content || '';
        const defaultContent = d.content || '';
        if (
          existContent.includes('[...Full book content preserved') ||
          existContent.includes('[...Full document saved') ||
          (defaultContent.length > existContent.length && existContent.length < 150)
        ) {
          const healed = {
            ...existing,
            content: defaultContent,
            studyQuiz: existing.studyQuiz?.length ? existing.studyQuiz : d.studyQuiz,
            readingLogs: existing.readingLogs?.length ? existing.readingLogs : d.readingLogs,
          };
          currentMap.set(d.id, healed);
          countRestored++;
          if (uidRef.current) {
            void saveBookToCloud(uidRef.current, healed);
          }
        }
      }
    }

    if (countRestored > 0) {
      const merged = Array.from(currentMap.values()).map(sanitizeDoc);
      saveDocs(merged);
    }
  }, [sanitizeDoc, saveDocs]);

  return (
    <KnowledgeContext.Provider value={{
      docs,
      isLoaded,
      isCloudSynced,
      addDoc,
      updateDoc,
      deleteDoc,
      deleteDocs,
      restoreDoc,
      togglePinDoc,
      toggleDocReminder,
      createProblemSolvingDoc,
      resetToDefaultDocs,
      restoreStarterBooks,
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
