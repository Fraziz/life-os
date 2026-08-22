'use client';

import React, { useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useGoals } from '@/context/GoalContext';
import { useProjects } from '@/context/ProjectContext';
import { useTasks } from '@/context/TaskContext';
import type { AISuggestion, SuggestedAction } from '@/types';
import {
  generateDeterministicBreakdown,
  generateDeterministicDayPlan,
  generateDeterministicBlockerAnalysis,
  executeOptionalAICall,
} from '@/utils/aiEngine';
import {
  Sparkles,
  Bot,
  Layers,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  X,
  Plus,
  ShieldCheck,
  Zap,
  Lock,
  RotateCcw,
} from 'lucide-react';
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

    // Simulate async / check optional AI
    setTimeout(async () => {
      try {
        let result: AISuggestion;
        if (type === 'day_plan') {
          result = generateDeterministicDayPlan(tasks, settings);
        } else if (type === 'breakdown') {
          const targetGoal = goals.find((g) => g.id === selectedGoalId) || goals[0];
          if (!targetGoal) {
            alert('Please create a goal first to use the breakdown assistant.');
            setIsGenerating(false);
            return;
          }
          result = generateDeterministicBreakdown(targetGoal, projects);
        } else {
          result = generateDeterministicBlockerAnalysis(tasks, projects);
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
    }, 400);
  };

  const handleToggleAction = (id: string) => {
    setSelectedActions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleApplySelected = () => {
    if (!suggestion) return;

    let appliedCount = 0;
    suggestion.actions.forEach((act) => {
      if (selectedActions[act.id] && act.type === 'create_task') {
        addTask({
          title: act.payload.title,
          priority: act.payload.priority || 'medium',
          estimatedDuration: act.payload.estimatedDuration,
          goalId: act.payload.goalId,
          projectId: act.payload.projectId,
          tags: act.payload.tags || ['assistant'],
          subtasks: [],
          status: 'todo',
        });
        appliedCount++;
      }
    });

    setAppliedSuccess(true);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className={styles.botIcon}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className={styles.title}>Life OS Assistant</h2>
              <p className={styles.subtitle}>
                {isAIConfigured
                  ? `AI Mode Enabled (${aiSettings.model}) · Local API Key`
                  : `Deterministic Rules Mode (100% offline & local)`}
              </p>
            </div>
          </div>

          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Safety Banner */}
        <div className={styles.safetyBanner}>
          <ShieldCheck size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
          <span>
            <strong>Safe &amp; Explicit:</strong> Assistant never silently creates or changes data. You review and select every action before applying.
          </span>
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
            <Calendar size={14} /> Plan My Day
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'breakdown' ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab('breakdown');
              setSuggestion(null);
            }}
          >
            <Layers size={14} /> Breakdown Goal
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'blockers' ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab('blockers');
              setSuggestion(null);
            }}
          >
            <AlertTriangle size={14} /> Find Blockers
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {activeTab === 'breakdown' && (
            <div className={styles.selectGroup}>
              <label className={styles.label}>Select Goal to Break Down:</label>
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
            </div>
          )}

          {!suggestion && (
            <div className={styles.promptArea}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
                {activeTab === 'day_plan' &&
                  'Analyze active tasks, estimated durations, and your daily capacity to build a realistic execution list.'}
                {activeTab === 'breakdown' &&
                  'Decompose high-level goal vision into clear, low-friction actionable tasks.'}
                {activeTab === 'blockers' &&
                  'Detect overdue commitments and stalled projects to suggest 15-minute unblock actions.'}
              </p>

              <button
                className={styles.btnGenerate}
                onClick={() => handleGenerate(activeTab)}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <RotateCcw size={16} className={styles.spin} /> Generating Suggestions...
                  </>
                ) : (
                  <>
                    <Zap size={16} /> Run Analysis &amp; Generate
                  </>
                )}
              </button>
            </div>
          )}

          {suggestion && (
            <div className={styles.suggestionResult}>
              <div className={styles.suggestionHeader}>
                <h3 className={styles.sugTitle}>{suggestion.title}</h3>
                <span className={styles.sugBadge}>
                  {suggestion.isDeterministicFallback ? 'Local Rules' : 'AI Verified'}
                </span>
              </div>

              <p className={styles.sugExplanation}>{suggestion.explanation}</p>

              {suggestion.actions.length > 0 && (
                <div className={styles.actionsBox}>
                  <h4 className={styles.actionsTitle}>Suggested Action Items (Select to Apply):</h4>
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
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                      <button className={styles.btnApply} onClick={handleApplySelected}>
                        Apply {Object.values(selectedActions).filter(Boolean).length} Selected Items
                      </button>
                    </div>
                  ) : (
                    <div className={styles.successBanner}>
                      <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
                      <span>Action items successfully added to your Tasks!</span>
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
