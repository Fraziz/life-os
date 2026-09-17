'use client';

import React, { useState } from 'react';
import { useTasks } from '@/context/TaskContext';
import { useGoals } from '@/context/GoalContext';
import { useProjects } from '@/context/ProjectContext';
import { useHabits } from '@/context/HabitContext';
import { useKnowledge } from '@/context/KnowledgeContext';
import { useSettings } from '@/context/SettingsContext';
import styles from './StarterPresetsModal.module.css';

interface StarterPresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StarterPresetsModal({ isOpen, onClose }: StarterPresetsModalProps) {
  const { addTask } = useTasks();
  const { addGoal } = useGoals();
  const { addProject } = useProjects();
  const { addHabit } = useHabits();
  const { addDoc } = useKnowledge();
  const { updateSettings } = useSettings();

  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);

  if (!isOpen) return null;

  const applyPreset = async (presetKey: 'fitness' | 'student' | 'creator' | 'minimal') => {
    setLoadingPreset(presetKey);

    try {
      if (presetKey === 'fitness') {
        const goal = addGoal({
          title: 'Reach 60kg Healthy Target Weight',
          description: 'Achieve lean athletic physique and 60kg body weight through progressive training and nutrition.',
          why: 'Build consistent strength, athletic energy, and confidence.',
          targetDate: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
          horizon: '90-day',
          status: 'in-progress',
          priority: 'high',
          progress: 35,
        });

        const proj = addProject({
          title: '90-Day Body Recomposition & Strength',
          description: '3-day gym split, daily protein targets, and active recovery.',
          goalId: goal.id,
          status: 'active',
          priority: 'high',
          progress: 25,
        });

        addTask({
          title: 'Log daily workout & weight check-in',
          description: 'Track lifts in Workout tab and record morning weight towards 60kg target.',
          priority: 'high',
          status: 'todo',
          projectId: proj.id,
          goalId: goal.id,
          tags: ['workout', 'health'],
          subtasks: [
            { id: 'sub-1', title: 'Weigh in morning on empty stomach', completed: false },
            { id: 'sub-2', title: 'Complete today workout routine', completed: false },
            { id: 'sub-3', title: 'Hit 120g+ protein target', completed: false },
          ],
        });

        addTask({
          title: 'Prepare weekly high-protein meal prep',
          description: 'Cook chicken breast, eggs, rice, and greens in batches.',
          priority: 'medium',
          status: 'todo',
          projectId: proj.id,
          goalId: goal.id,
          tags: ['nutrition'],
          subtasks: [],
        });

        addHabit({
          title: 'Drink 2 Liters of Water',
          frequency: 'daily',
          targetCount: 1,
        });

        addHabit({
          title: 'Daily 30-min Workout or Stretch',
          frequency: 'daily',
          targetCount: 1,
        });

        addDoc({
          title: 'Personal Fitness & 60kg Nutrition Blueprint',
          content: '<h1>60kg Target Weight Blueprint</h1><p>Core strategy for steady muscle gain and body recomposition.</p><h2>Daily Nutrition Rules</h2><ul><li>120g-140g protein daily</li><li>2.5L water minimum</li><li>Caloric slight surplus (+250 kcal)</li></ul><h2>Workout Split</h2><ul><li>Monday: Push (Chest & Shoulders)</li><li>Wednesday: Pull (Back & Biceps)</li><li>Friday: Legs & Core</li></ul>',
          status: 'active',
          tags: ['fitness', 'nutrition', 'blueprint'],
          isPinned: true,
        });

        updateSettings({ starterPreset: 'fitness' });
      } else if (presetKey === 'student') {
        const goal = addGoal({
          title: 'Master Academic Semester with High Honors',
          description: 'Maintain top academic performance with structured study blocks and active recall.',
          why: 'Excel in coursework and build solid intellectual foundations.',
          targetDate: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
          horizon: 'monthly',
          status: 'in-progress',
          priority: 'high',
          progress: 40,
        });

        const proj = addProject({
          title: 'Course Syllabus Synthesis & Exam Preparation',
          description: 'Break down weekly lectures into flashcards and practice problems.',
          goalId: goal.id,
          status: 'active',
          priority: 'high',
          progress: 30,
        });

        addTask({
          title: 'Review and summarize lecture notes within 24h',
          description: 'Use Kidlin\'s Law in Knowledge tab to break down complex lecture concepts.',
          priority: 'high',
          status: 'todo',
          projectId: proj.id,
          goalId: goal.id,
          tags: ['study', 'academic'],
          subtasks: [
            { id: 's-1', title: 'Import PDF lecture slides into Knowledge', completed: false },
            { id: 's-2', title: 'Highlight key theorems and formulas', completed: false },
            { id: 's-3', title: 'Run a 25m Focus reading session', completed: false },
          ],
        });

        addHabit({
          title: '2h Deep Work Focus Session',
          frequency: 'daily',
          targetCount: 1,
        });

        addHabit({
          title: 'Read 20 Pages of Academic Reference',
          frequency: 'daily',
          targetCount: 1,
        });

        addDoc({
          title: 'Problem Solving Matrix (Kidlin\'s Law for Exams)',
          content: '<h1>Kidlin\'s Law Problem Breakdown</h1><p><em>"If you write down a problem clearly and specifically, you have already solved half of it."</em></p><h2>1. The Core Problem</h2><p>State the exact theoretical or mathematical problem clearly here.</p><h2>2. Known Variables &amp; Constraints</h2><ul><li>Input parameters</li><li>Boundary conditions</li></ul><h2>3. Step-by-Step Solution</h2><p>Draft out your logic systematically.</p>',
          status: 'active',
          tags: ['academics', 'kidlin', 'problem-solver'],
          isPinned: true,
        });

        updateSettings({ starterPreset: 'student' });
      } else if (presetKey === 'creator') {
        const goal = addGoal({
          title: 'Launch MVP & Acquire First 100 Users',
          description: 'Ship functional product, publish launch content, and gather feedback.',
          why: 'Validate product value and build sustainable independent income.',
          targetDate: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
          horizon: '90-day',
          status: 'in-progress',
          priority: 'high',
          progress: 50,
        });

        const proj = addProject({
          title: 'Product Launch & User Acquisition Engine',
          description: 'Build landing page, distribution funnel, and onboarding flow.',
          goalId: goal.id,
          status: 'active',
          priority: 'high',
          progress: 45,
        });

        addTask({
          title: 'Finalize landing page copy and screenshots',
          description: 'Highlight key features, testimonials, and clear CTA button.',
          priority: 'high',
          status: 'todo',
          projectId: proj.id,
          goalId: goal.id,
          tags: ['launch', 'marketing'],
          subtasks: [
            { id: 'c-1', title: 'Capture high-res app screenshots', completed: false },
            { id: 'c-2', title: 'Write benefit-driven header copy', completed: false },
            { id: 'c-3', title: 'Test responsive mobile layout', completed: false },
          ],
        });

        addHabit({
          title: 'Daily Public Build & Progress Post',
          frequency: 'daily',
          targetCount: 1,
        });

        addHabit({
          title: '1h Outreach & User Feedback Chat',
          frequency: 'daily',
          targetCount: 1,
        });

        addDoc({
          title: 'Product Roadmap & Go-To-Market Strategy',
          content: '<h1>Product Go-To-Market Strategy</h1><p>Framework for launch velocity and early user feedback.</p><h2>Value Proposition</h2><p>Better habits. A freer you.</p><h2>Launch Milestones</h2><ul><li>Alpha test with 10 close beta users</li><li>Product Hunt & Twitter/X Launch</li><li>Weekly product iteration sprints</li></ul>',
          status: 'active',
          tags: ['product', 'launch', 'strategy'],
          isPinned: true,
        });

        updateSettings({ starterPreset: 'creator' });
      }

      setTimeout(() => {
        setLoadingPreset(null);
        onClose();
      }, 300);
    } catch (err) {
      console.error('Failed to apply preset:', err);
      setLoadingPreset(null);
      onClose();
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Choose a Starter Preset</h2>
            <p className={styles.subtitle}>
              Pre-load your Life OS with goals, habits, and tasks tailored to your current focus.
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.presetGrid}>
            {/* Fitness Preset */}
            <div className={styles.presetCard} onClick={() => applyPreset('fitness')}>
              <div className={styles.presetTop}>
                <span className={styles.presetName}>Fitness &amp; Target Weight (60kg)</span>
                <span className={styles.presetTag}>Health &amp; Body</span>
              </div>
              <p className={styles.presetDesc}>
                Includes 60kg Weight Target Goal, 3-day workout routines, water &amp; exercise habit trackers, and nutrition blueprint note.
              </p>
              <div className={styles.presetIncludes}>
                <span className={styles.includePill}>1 Goal (60kg)</span>
                <span className={styles.includePill}>1 Project</span>
                <span className={styles.includePill}>2 Tasks</span>
                <span className={styles.includePill}>2 Habits</span>
                <span className={styles.includePill}>1 Knowledge Doc</span>
              </div>
            </div>

            {/* Student Preset */}
            <div className={styles.presetCard} onClick={() => applyPreset('student')}>
              <div className={styles.presetTop}>
                <span className={styles.presetName}>Deep Work &amp; Study</span>
                <span className={styles.presetTag}>Academics &amp; Study</span>
              </div>
              <p className={styles.presetDesc}>
                Structured for high academic achievement, 2h deep focus habits, lecture summary workflows, and Kidlin&apos;s Law problem breakdowns.
              </p>
              <div className={styles.presetIncludes}>
                <span className={styles.includePill}>1 Academic Goal</span>
                <span className={styles.includePill}>1 Study Project</span>
                <span className={styles.includePill}>2 Study Tasks</span>
                <span className={styles.includePill}>2 Habits</span>
                <span className={styles.includePill}>1 Problem Canvas</span>
              </div>
            </div>

            {/* Creator / Solopreneur Preset */}
            <div className={styles.presetCard} onClick={() => applyPreset('creator')}>
              <div className={styles.presetTop}>
                <span className={styles.presetName}>Product &amp; Creator Launch</span>
                <span className={styles.presetTag}>Business &amp; Growth</span>
              </div>
              <p className={styles.presetDesc}>
                Tailored for launching products, shipping daily, acquiring first 100 users, and building high-leverage outreach habits.
              </p>
              <div className={styles.presetIncludes}>
                <span className={styles.includePill}>1 Launch Goal</span>
                <span className={styles.includePill}>1 Launch Project</span>
                <span className={styles.includePill}>1 Launch Task</span>
                <span className={styles.includePill}>2 Build Habits</span>
                <span className={styles.includePill}>1 GTM Strategy</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <span>You can modify or delete any added items at any time.</span>
          {loadingPreset && <span>Loading preset data...</span>}
        </div>
      </div>
    </div>
  );
}
