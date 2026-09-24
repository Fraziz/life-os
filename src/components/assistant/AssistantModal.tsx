'use client';

import React, { useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useGoals } from '@/context/GoalContext';
import { useProjects } from '@/context/ProjectContext';
import { useTasks } from '@/context/TaskContext';
import type { AISuggestion } from '@/types';
import {
  generateAIBreakdown,
  generateAIDayPlan,
  generateAIBlockerAnalysis,
  generateDeterministicBreakdown,
  generateDeterministicDayPlan,
  generateDeterministicBlockerAnalysis,
} from '@/utils/aiEngine';
import { X, RotateCcw } from 'lucide-react';
import styles from './AssistantModal.module.css';

interface AssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AssistantModal({ isOpen, onClose }: AssistantModalProps) {
  const { settings } = useSettings();
  const { goals } = useGoals();
  const { projects } = useProjects();
  const { tasks, addTask } = useTasks();

  const [activeTab, setActiveTab] = useState<'day_plan' | 'breakdown' | 'blockers'>('day_plan');
  const [selectedGoalId, setSelectedGoalId] = useState<string>(goals[0]?.id || '');
  const [customConstraint, setCustomConstraint] = useState('');
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [selectedActions, setSelectedActions] = useState<Record<string, boolean>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  if (!isOpen) return null;

  const aiSettings = settings.aiSettings;
  const isAIConfigured = aiSettings?.enabled && !!aiSettings.apiKey;

  const handleGenerate = async (type: 'day_plan' | 'breakdown' | 'blockers') => {
    setIsGenerating(true);
    setAppliedSuccess(false);
    setSuggestion(null);

    try {
      let result: AISuggestion;
      if (type === 'day_plan') {
        result = isAIConfigured
          ? await generateAIDayPlan(tasks, settings, aiSettings)
          : generateDeterministicDayPlan(tasks, settings);
      } else if (type === 'breakdown') {
        const targetGoal = goals.find((g) => g.id === selectedGoalId) || goals[0];
        if (!targetGoal) {
          alert('Please create a goal first to use the breakdown assistant.');
          setIsGenerating(false);
          return;
        }
        result = isAIConfigured
          ? await generateAIBreakdown(targetGoal, projects, aiSettings, customConstraint)
          : generateDeterministicBreakdown(targetGoal, projects);
      } else {
        result = isAIConfigured
          ? await generateAIBlockerAnalysis(tasks, projects, aiSettings)
          : generateDeterministicBlockerAnalysis(tasks, projects);
      }

      setSuggestion(result);
      const initialSelected: Record<string, boolean> = {};
      result.actions.forEach((a) => {
        initialSelected[a.id] = a.selected ?? true;
      });
      setSelectedActions(initialSelected);
    } catch (err: any) {
      alert(err.message || 'Failed to generate suggestions');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleAction = (id: string) => {
    setSelectedActions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleApplySelected = () => {
    if (!suggestion) return;

    suggestion.actions.forEach((act) => {
      if (selectedActions[act.id] && (act.type === 'create_task' || act.type === 'schedule_block')) {
        addTask({
          title: act.payload.title,
          priority: act.payload.priority || 'medium',
          estimatedDuration: act.payload.estimatedDuration || act.payload.duration,
          goalId: act.payload.goalId || (activeTab === 'breakdown' ? selectedGoalId : undefined),
          projectId: act.payload.projectId,
          tags: act.payload.tags || ['assistant'],
          subtasks: [],
          status: 'todo',
        });
      }
    });

    setAppliedSuccess(true);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Assistant Actions</h2>
            <p className={styles.subtitle}>
              {isAIConfigured
                ? `AI Mode (${aiSettings.model})`
                : `Local Rules Mode (Offline)`}
            </p>
          </div>

          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Tab Controls */}
        <div className={styles.tabsRow}>
          <button
            className={`${styles.tab} ${activeTab === 'day_plan' ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab('day_plan');
              setSuggestion(null);
            }}
          >
            Plan Day
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'breakdown' ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab('breakdown');
              setSuggestion(null);
            }}
          >
            Break Down Goal
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'blockers' ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab('blockers');
              setSuggestion(null);
            }}
          >
            Detect Blockers
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {activeTab === 'breakdown' && (
            <div className={styles.selectGroup}>
              <label className={styles.label}>Select Goal</label>
              <select
                className={styles.select}
                value={selectedGoalId}
                onChange={(e) => setSelectedGoalId(e.target.value)}
              >
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title} ({g.horizon})
                  </option>
                ))}
              </select>

              <div style={{ marginTop: '6px' }}>
                <label className={styles.label}>Constraint / Instructions (Optional)</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Keep steps under 30 minutes"
                  value={customConstraint}
                  onChange={(e) => setCustomConstraint(e.target.value)}
                />
              </div>
            </div>
          )}

          {!suggestion && (
            <div className={styles.promptArea}>
              <p className={styles.promptDesc}>
                {activeTab === 'day_plan' &&
                  'Analyze pending tasks, priority levels, and capacity to build an executable daily list.'}
                {activeTab === 'breakdown' &&
                  'Decompose your selected high-level goal into actionable, concrete tasks.'}
                {activeTab === 'blockers' &&
                  'Identify stalled projects and overdue items to create 15-minute unblocking actions.'}
              </p>

              <button
                className={styles.btnGenerate}
                onClick={() => handleGenerate(activeTab)}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <RotateCcw size={14} className={styles.spin} /> Generating...
                  </>
                ) : (
                  'Generate Plan'
                )}
              </button>
            </div>
          )}

          {suggestion && (
            <div className={styles.suggestionResult}>
              <div className={styles.suggestionHeader}>
                <h3 className={styles.sugTitle}>{suggestion.title}</h3>
                <span className={styles.sugBadge}>
                  {suggestion.isDeterministicFallback ? 'Local' : 'AI'}
                </span>
              </div>

              <p className={styles.sugExplanation}>{suggestion.explanation}</p>

              {suggestion.actions.length > 0 && (
                <div className={styles.actionsBox}>
                  <h4 className={styles.actionsTitle}>Suggested Action Items</h4>
                  <div className={styles.actionsList}>
                    {suggestion.actions.map((act) => (
                      <label key={act.id} className={styles.actionRow}>
                        <input
                          type="checkbox"
                          checked={!!selectedActions[act.id]}
                          onChange={() => handleToggleAction(act.id)}
                          className={styles.checkbox}
                        />
                        <span className={styles.actionLabel}>{act.label}</span>
                      </label>
                    ))}
                  </div>

                  {!appliedSuccess ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button className={styles.btnApply} onClick={handleApplySelected}>
                        Apply {Object.values(selectedActions).filter(Boolean).length} Selected Tasks
                      </button>
                    </div>
                  ) : (
                    <div className={styles.successBanner}>
                      Tasks added to your workspace.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
