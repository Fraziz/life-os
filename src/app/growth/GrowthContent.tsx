'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  Target,
  Sparkles,
  Layers,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  ArrowRight,
  TrendingUp,
  X,
  Plus,
  Trash2,
  HelpCircle,
  Award,
  Play,
  Bookmark,
  Zap,
} from 'lucide-react';
import { useGrowth } from '@/context/GrowthContext';
import { useGoals } from '@/context/GoalContext';
import { useDreams } from '@/context/DreamContext';
import { useMilestones } from '@/context/MilestoneContext';
import { useProjects } from '@/context/ProjectContext';
import { useTasks } from '@/context/TaskContext';
import type {
  Interest,
  InterestLevel,
  StruggleOption,
  IdentityOption,
} from '@/types/growth';
import styles from './GrowthContent.module.css';

// Semantic category colors for tags
function getCategoryTagStyle(category?: string) {
  if (!category) {
    return {
      background: 'rgba(148, 163, 184, 0.12)',
      color: '#94a3b8',
      border: '1px solid rgba(148, 163, 184, 0.22)',
    };
  }
  const cat = category.toLowerCase();
  if (cat.includes('eng') || cat.includes('code') || cat.includes('tech') || cat.includes('soft') || cat.includes('dev')) {
    return {
      background: 'rgba(56, 189, 248, 0.14)',
      color: '#38bdf8',
      border: '1px solid rgba(56, 189, 248, 0.3)',
    };
  }
  if (cat.includes('creat') || cat.includes('music') || cat.includes('guitar') || cat.includes('sound') || cat.includes('write')) {
    return {
      background: 'rgba(192, 132, 252, 0.14)',
      color: '#c084fc',
      border: '1px solid rgba(192, 132, 252, 0.3)',
    };
  }
  if (cat.includes('health') || cat.includes('fit') || cat.includes('body') || cat.includes('sport') || cat.includes('gym')) {
    return {
      background: 'rgba(52, 211, 153, 0.14)',
      color: '#34d399',
      border: '1px solid rgba(52, 211, 153, 0.3)',
    };
  }
  if (cat.includes('design') || cat.includes('graph') || cat.includes('3d') || cat.includes('art') || cat.includes('ui')) {
    return {
      background: 'rgba(251, 146, 60, 0.14)',
      color: '#fb923c',
      border: '1px solid rgba(251, 146, 60, 0.3)',
    };
  }
  if (cat.includes('psych') || cat.includes('mind') || cat.includes('learn') || cat.includes('sci')) {
    return {
      background: 'rgba(244, 114, 182, 0.14)',
      color: '#f472b6',
      border: '1px solid rgba(244, 114, 182, 0.3)',
    };
  }
  return {
    background: 'rgba(250, 204, 21, 0.14)',
    color: '#facc15',
    border: '1px solid rgba(250, 204, 21, 0.3)',
  };
}

// Educational diagnosis advice matrix (ADHD-friendly, grounded, practical)
const STRUGGLE_ADVICE: Record<StruggleOption, string> = {
  shiny_object:
    'The "Honeymoon Effect" is natural for curious minds. Novelty releases rapid dopamine, while execution requires discipline. Guardrail: When an exciting new topic emerges, place it into your Exploration sandbox with a mandatory 7-day cooldown before taking action.',
  too_many:
    'Pursuing too many disciplines simultaneously produces the illusion of progress without actual depth. Enforce the 1-Primary focus rule strictly. Give your Primary pursuit your first 60–90 minutes of daily focus before touching anything else.',
  inconsistency:
    'Consistency breaks when targets are sized for your best days rather than your lowest-energy days. Lower your daily floor: commit to a 10-minute micro-session on difficult days so the habit streak stays unbroken.',
  fear_wrong_path:
    'Action brings clarity; deliberation brings anxiety. A 90-day sprint is not a lifetime sentence—it is a closed scientific experiment. Commit unconditionally for 90 days, then evaluate with concrete data instead of fear.',
  guilt_unproductive:
    'Downtime is not waste; it is an active biological phase where your brain consolidates neural connections and physical adaptations. Allow yourself deliberate, guilt-free rest so practice remains sharp.',
};

const IDENTITY_ADVICE: Record<IdentityOption, string> = {
  specialist:
    'Deep Specialist: Prioritize depth over breadth. Say no to 90% of adjacent opportunities. Perfect the unsexy fundamentals and deliberate drills that others avoid.',
  polymath:
    'Polymath: Practice serial mastery rather than simultaneous chaos. Master a foundational domain (Level 1–2) before rotating focus to an adjacent field.',
  synthesizer:
    'Synthesizer & Builder: Your competitive moat is cross-pollination. Combining the top 20% competency in three separate domains makes your creative output unique and irreplaceable.',
  explorer:
    'Curious Explorer: Treat your current season as broad sampling. Run lightweight 2-week mini-experiments across fields before locking into a formal 90-day commitment.',
};

export default function GrowthContent() {
  const {
    interests,
    primaryInterests,
    secondaryInterests,
    explorationInterests,
    addInterest,
    deleteInterest,
    moveInterestLevel,
    activeSprint,
    createSprint,
    toggleCheckpoint,
    toggleMilestone,
    evaluateSprint,
    reflection,
    saveReflection,
  } = useGrowth();

  const { goals } = useGoals();
  const { dreams } = useDreams();
  const { milestones } = useMilestones();
  const { projects } = useProjects();
  const { tasks } = useTasks();

  const [activeTab, setActiveTab] = useState<'interests' | 'sprint' | 'hierarchy' | 'diagnostic' | 'all'>('interests');
  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const [sprintModalOpen, setSprintModalOpen] = useState(false);
  const [evaluationModalOpen, setEvaluationModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Interest form state
  const [newTitle, setNewTitle] = useState('');
  const [newLevel, setNewLevel] = useState<InterestLevel>('exploration');
  const [newCategory, setNewCategory] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newLinkedGoalId, setNewLinkedGoalId] = useState('');

  // New Sprint form state
  const [sprintTitle, setSprintTitle] = useState('');
  const [sprintWhy, setSprintWhy] = useState('');
  const [sprintStartDate, setSprintStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [sprintLinkedGoalId, setSprintLinkedGoalId] = useState('');

  // Evaluation form state
  const [evalDecision, setEvalDecision] = useState<'continue' | 'adjust' | 'pivot'>('continue');
  const [evalRating, setEvalRating] = useState(4);
  const [evalReflection, setEvalReflection] = useState('');

  const openAddInterestModal = (prefillLevel?: InterestLevel) => {
    setErrorMessage(null);
    if (prefillLevel) setNewLevel(prefillLevel);
    setInterestModalOpen(true);
  };

  const handleAddInterestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const res = addInterest({
      title: newTitle.trim(),
      level: newLevel,
      category: newCategory.trim() || undefined,
      notes: newNotes.trim() || undefined,
      linkedGoalId: newLinkedGoalId || undefined,
    });

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to add interest');
      return;
    }

    setNewTitle('');
    setNewCategory('');
    setNewNotes('');
    setNewLinkedGoalId('');
    setErrorMessage(null);
    setInterestModalOpen(false);
  };

  const handleCreateSprintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintTitle.trim() || !sprintWhy.trim()) return;

    const start = new Date(sprintStartDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 90);
    const endDateStr = end.toISOString().split('T')[0];

    const checkpoints = Array.from({ length: 13 }, (_, i) => ({
      week: i + 1,
      completed: false,
    }));

    createSprint({
      title: sprintTitle.trim(),
      startDate: sprintStartDate,
      endDate: endDateStr,
      why: sprintWhy.trim(),
      linkedGoalId: sprintLinkedGoalId || undefined,
      weeklyCheckpoints: checkpoints,
      milestones: [
        { id: `sm-${Date.now()}-1`, title: 'Week 4 Foundation Checkpoint', completed: false, targetWeek: 4 },
        { id: `sm-${Date.now()}-2`, title: 'Week 8 Mid-Sprint Retrospective', completed: false, targetWeek: 8 },
        { id: `sm-${Date.now()}-3`, title: 'Week 13 Final Polish & Evaluation', completed: false, targetWeek: 13 },
      ],
      status: 'active',
    });

    setSprintTitle('');
    setSprintWhy('');
    setSprintLinkedGoalId('');
    setSprintModalOpen(false);
  };

  const handleEvaluationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSprint) return;

    evaluateSprint(activeSprint.id, {
      decision: evalDecision,
      rating: evalRating,
      reflection: evalReflection.trim() || 'Completed 90-day evaluation.',
      evaluatedAt: new Date().toISOString(),
    });

    setEvaluationModalOpen(false);
  };

  const handleStruggleSelect = (st: StruggleOption) => {
    const currentIdentity = reflection?.aspirationalIdentity || 'synthesizer';
    saveReflection({
      struggle: st,
      aspirationalIdentity: currentIdentity,
      reflectionAdvice: `${STRUGGLE_ADVICE[st]} \n\n${IDENTITY_ADVICE[currentIdentity]}`,
      personalNotes: reflection?.personalNotes || '',
      updatedAt: new Date().toISOString(),
    });
  };

  const handleIdentitySelect = (id: IdentityOption) => {
    const currentStruggle = reflection?.struggle || 'shiny_object';
    saveReflection({
      struggle: currentStruggle,
      aspirationalIdentity: id,
      reflectionAdvice: `${STRUGGLE_ADVICE[currentStruggle]} \n\n${IDENTITY_ADVICE[id]}`,
      personalNotes: reflection?.personalNotes || '',
      updatedAt: new Date().toISOString(),
    });
  };

  // Compute days left in active sprint
  let daysRemaining = 90;
  let sprintProgressPct = 0;
  if (activeSprint) {
    const start = new Date(activeSprint.startDate).getTime();
    const end = new Date(activeSprint.endDate).getTime();
    const now = Date.now();
    const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(0, Math.round((now - start) / (1000 * 60 * 60 * 24)));
    daysRemaining = Math.max(0, totalDays - elapsedDays);
    sprintProgressPct = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
  }

  const completedWeeks = activeSprint?.weeklyCheckpoints.filter((c) => c.completed).length || 0;

  return (
    <div className={styles.page}>
      {/* ── MINIMALIST EXECUTIVE HEADER ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.badgeRow}>
            <span className={styles.microBadge}>
              <span className={styles.microDot} />
              Growth System
            </span>
          </div>
          <h1 className={styles.title}>Growth & Deliberate Mastery</h1>
          <p className={styles.subtitle}>
            Direct your attention intentionally. 1 Primary Focus, 2 Secondary, and the rest safely parked in Exploration.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => openAddInterestModal()}
          >
            <Plus size={15} />
            Add Interest
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => setSprintModalOpen(true)}
          >
            <Clock size={15} />
            New 90-Day Sprint
          </button>
          <Link href="/roadmap" className={styles.secondaryBtn}>
            <TrendingUp size={15} />
            Roadmap
          </Link>
        </div>
      </header>

      {/* ── SEAMLESS INFO & LIVE METRICS STRIP (No heavy box) ── */}
      <div className={styles.infoStrip}>
        <p className={styles.infoPrinciple}>
          <span className={styles.principleTag}>Focus Rule:</span> You don&apos;t have to pursue everything today. You have a lifetime to learn.
        </p>

        <div className={styles.liveMetricsGroup}>
          <span className={`${styles.metricChip} ${styles.chipMint}`}>
            ● Primary: {primaryInterests.length}/1
          </span>
          <span className={`${styles.metricChip} ${styles.chipLavender}`}>
            ● Secondary: {secondaryInterests.length}/2
          </span>
          <span className={`${styles.metricChip} ${styles.chipAmber}`}>
            ● Exploration: {explorationInterests.length}
          </span>
          {activeSprint && (
            <span className={`${styles.metricChip} ${styles.chipSprint}`}>
              <Clock size={12} /> {daysRemaining}d Sprint Left
            </span>
          )}
        </div>
      </div>

      {/* ── CLEAN UNDERLINE SEGMENTED VIEW SWITCHER ── */}
      <nav className={styles.segmentedNav} aria-label="Growth sections">
        <button
          type="button"
          className={`${styles.segmentBtn} ${activeTab === 'interests' ? styles.segmentBtnActive : ''}`}
          onClick={() => setActiveTab('interests')}
        >
          <Layers size={14} />
          3 Levels of Focus ({interests.length})
        </button>
        <button
          type="button"
          className={`${styles.segmentBtn} ${activeTab === 'sprint' ? styles.segmentBtnActive : ''}`}
          onClick={() => setActiveTab('sprint')}
        >
          <Clock size={14} />
          90-Day Sprint {activeSprint ? `(${daysRemaining}d)` : ''}
        </button>
        <button
          type="button"
          className={`${styles.segmentBtn} ${activeTab === 'hierarchy' ? styles.segmentBtnActive : ''}`}
          onClick={() => setActiveTab('hierarchy')}
        >
          <TrendingUp size={14} />
          Growth Hierarchy (Live)
        </button>
        <button
          type="button"
          className={`${styles.segmentBtn} ${activeTab === 'diagnostic' ? styles.segmentBtnActive : ''}`}
          onClick={() => setActiveTab('diagnostic')}
        >
          <HelpCircle size={14} />
          Mindset & Reflection
        </button>
        <button
          type="button"
          className={`${styles.segmentBtn} ${activeTab === 'all' ? styles.segmentBtnActive : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Sections
        </button>
      </nav>

      {/* ── SECTION B: THE THREE LEVELS OF INTEREST (COLOR-CODED WIDE GRID, NO OUTER BOX CAGE) ── */}
      {(activeTab === 'interests' || activeTab === 'all') && (
        <div className={styles.levelsGrid}>
          {/* 1. PRIMARY FOCUS (Mint / Emerald identity) */}
          <div className={`${styles.levelColumn} ${styles.colPrimary}`}>
            <div className={styles.levelHeader}>
              <div className={styles.levelTitleWrap}>
                <span className={styles.levelBadgeMint}>Level 1</span>
                <h3 className={styles.levelName}>Primary Focus</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#34d399' }}>
                  {primaryInterests.length}/1
                </span>
                {primaryInterests.length === 0 && (
                  <button
                    type="button"
                    className={styles.miniBtn}
                    onClick={() => openAddInterestModal('primary')}
                    title="Set Primary Focus"
                  >
                    + Add
                  </button>
                )}
              </div>
            </div>
            <p className={styles.levelRuleText}>
              The 1 major discipline receiving 70%+ of your daily deep work and practice.
            </p>
            <div className={styles.interestList}>
              {primaryInterests.length === 0 ? (
                <div className={styles.emptyStateSlot}>
                  No primary focus active. Promote an interest below or add one.
                </div>
              ) : (
                primaryInterests.map((interest) => (
                  <InterestCardItem
                    key={interest.id}
                    interest={interest}
                    linkedGoalTitle={goals.find((g) => g.id === interest.linkedGoalId)?.title}
                    onMove={(lvl) => moveInterestLevel(interest.id, lvl)}
                    onDelete={() => deleteInterest(interest.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* 2. SECONDARY FOCUS (Lavender / Indigo identity) */}
          <div className={`${styles.levelColumn} ${styles.colSecondary}`}>
            <div className={styles.levelHeader}>
              <div className={styles.levelTitleWrap}>
                <span className={styles.levelBadgeLavender}>Level 2</span>
                <h3 className={styles.levelName}>Secondary Focus</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#a5b4fc' }}>
                  {secondaryInterests.length}/2
                </span>
                {secondaryInterests.length < 2 && (
                  <button
                    type="button"
                    className={styles.miniBtn}
                    onClick={() => openAddInterestModal('secondary')}
                    title="Add Secondary Focus"
                  >
                    + Add
                  </button>
                )}
              </div>
            </div>
            <p className={styles.levelRuleText}>
              Up to 2 supporting interests developed steadily (e.g. 20–30m daily).
            </p>
            <div className={styles.interestList}>
              {secondaryInterests.length === 0 ? (
                <div className={styles.emptyStateSlot}>
                  No secondary interests active.
                </div>
              ) : (
                secondaryInterests.map((interest) => (
                  <InterestCardItem
                    key={interest.id}
                    interest={interest}
                    linkedGoalTitle={goals.find((g) => g.id === interest.linkedGoalId)?.title}
                    onMove={(lvl) => moveInterestLevel(interest.id, lvl)}
                    onDelete={() => deleteInterest(interest.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* 3. EXPLORATION BACKLOG (Warm Amber / Gold identity) */}
          <div className={`${styles.levelColumn} ${styles.colExploration}`}>
            <div className={styles.levelHeader}>
              <div className={styles.levelTitleWrap}>
                <span className={styles.levelBadgeAmber}>Level 3</span>
                <h3 className={styles.levelName}>Exploration Backlog</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#fbbf24' }}>
                  {explorationInterests.length}
                </span>
                <button
                  type="button"
                  className={styles.miniBtn}
                  onClick={() => openAddInterestModal('exploration')}
                  title="Park new idea"
                >
                  + Park
                </button>
              </div>
            </div>
            <p className={styles.levelRuleText}>
              Curiosity sandbox. Park shiny ideas here without guilt or pressure.
            </p>
            <div className={styles.interestList}>
              {explorationInterests.length === 0 ? (
                <div className={styles.emptyStateSlot}>
                  Curiosity backlog is empty. Park new hobbies or skills here.
                </div>
              ) : (
                explorationInterests.map((interest) => (
                  <InterestCardItem
                    key={interest.id}
                    interest={interest}
                    linkedGoalTitle={goals.find((g) => g.id === interest.linkedGoalId)?.title}
                    onMove={(lvl) => moveInterestLevel(interest.id, lvl)}
                    onDelete={() => deleteInterest(interest.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION C: THE 90-DAY RULE (COMMITMENT SPRINT) ── */}
      {(activeTab === 'sprint' || activeTab === 'all') && (
        <div className={styles.sprintCard}>
          <div className={styles.sprintTopMeta}>
            <div className={styles.sprintTitleGroup}>
              <span className={styles.sprintLabel}>90-Day Commitment Sprint</span>
              <h3 className={styles.sprintTitle}>{activeSprint?.title || 'No Active Sprint'}</h3>
            </div>
            <div className={styles.sprintPills}>
              {activeSprint && (
                <>
                  <span className={styles.statusPill}>
                    <Calendar size={13} color="#38bdf8" />
                    {daysRemaining} Days Remaining
                  </span>
                  <span className={styles.statusPill}>
                    <CheckCircle2 size={13} color="#10b981" />
                    {completedWeeks} of 13 Weeks Checked
                  </span>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => setEvaluationModalOpen(true)}
                  >
                    <Award size={14} />
                    Evaluate Sprint
                  </button>
                </>
              )}
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => setSprintModalOpen(true)}
              >
                <Plus size={14} />
                New Sprint
              </button>
            </div>
          </div>

          {activeSprint ? (
            <>
              {/* Vibrant Gradient Progress bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                  <span>Sprint Progress</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{sprintProgressPct}%</span>
                </div>
                <div style={{ height: '5px', background: 'var(--color-surface)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${sprintProgressPct}%`,
                      background: 'linear-gradient(90deg, #6366f1, #38bdf8, #10b981)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              <div className={styles.whyContractBox}>
                <div className={styles.contractLabel}>Commitment Contract (Why This Direction?)</div>
                <div>{activeSprint.why}</div>
              </div>

              {/* 13 Weekly Checkpoint Grid */}
              <div>
                <span className={styles.contractLabel}>13 Weekly Checkpoints (Click to toggle week)</span>
                <div className={styles.weeksGrid}>
                  {activeSprint.weeklyCheckpoints.map((cp) => (
                    <div
                      key={cp.week}
                      className={`${styles.weekCheckCard} ${cp.completed ? styles.weekCheckActive : ''}`}
                      onClick={() => toggleCheckpoint(activeSprint.id, cp.week)}
                      title={`Week ${cp.week}: Click to toggle`}
                    >
                      <span className={styles.weekLabel}>W{cp.week}</span>
                      <div className={`${styles.checkIndicator} ${cp.completed ? styles.checkIndicatorDone : ''}`}>
                        {cp.completed ? '✓' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sprint Milestones */}
              {activeSprint.milestones.length > 0 && (
                <div>
                  <span className={styles.contractLabel}>Sprint Milestones</span>
                  <div className={styles.sprintMilestones}>
                    {activeSprint.milestones.map((m) => (
                      <div
                        key={m.id}
                        className={styles.milestoneRow}
                        onClick={() => toggleMilestone(activeSprint.id, m.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {m.completed ? (
                            <CheckCircle2 size={15} color="#10b981" />
                          ) : (
                            <Circle size={15} color="var(--color-text-muted)" />
                          )}
                          <span className={m.completed ? styles.milestoneDoneText : ''}>
                            {m.title}
                          </span>
                        </div>
                        {m.targetWeek && (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            Target: W{m.targetWeek}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptyStateSlot}>
              No active 90-day sprint found. Click &ldquo;New Sprint&rdquo; above to commit to a quarterly cycle.
            </div>
          )}
        </div>
      )}

      {/* ── SECTION D: THE GROWTH HIERARCHY (6 VIBRANT STEPS) ── */}
      {(activeTab === 'hierarchy' || activeTab === 'all') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
                Live Life OS Architecture
              </h3>
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                Your unified execution pipeline from identity down to current focus.
              </p>
            </div>
            <Link href="/roadmap" className={styles.secondaryBtn}>
              Full Node Roadmap
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className={styles.hierarchyGrid}>
            <Link href="/dreams" className={styles.hierarchyStepCard} style={{ borderTop: '2px solid #c084fc' }}>
              <span className={styles.stepNumber} style={{ color: '#c084fc' }}>Layer 1</span>
              <h4 className={styles.stepTitle}>DREAM</h4>
              <div className={styles.stepCount} style={{ color: '#c084fc' }}>{dreams.length}</div>
              <span className={styles.stepQuestion}>What person do I want to become?</span>
            </Link>

            <Link href="/goals" className={styles.hierarchyStepCard} style={{ borderTop: '2px solid #818cf8' }}>
              <span className={styles.stepNumber} style={{ color: '#818cf8' }}>Layer 2</span>
              <h4 className={styles.stepTitle}>GOAL</h4>
              <div className={styles.stepCount} style={{ color: '#818cf8' }}>{goals.length}</div>
              <span className={styles.stepQuestion}>What do I want to accomplish?</span>
            </Link>

            <Link href="/milestones" className={styles.hierarchyStepCard} style={{ borderTop: '2px solid #2dd4bf' }}>
              <span className={styles.stepNumber} style={{ color: '#2dd4bf' }}>Layer 3</span>
              <h4 className={styles.stepTitle}>MILESTONE</h4>
              <div className={styles.stepCount} style={{ color: '#2dd4bf' }}>{milestones.length}</div>
              <span className={styles.stepQuestion}>Measurable progress markers</span>
            </Link>

            <Link href="/projects" className={styles.hierarchyStepCard} style={{ borderTop: '2px solid #38bdf8' }}>
              <span className={styles.stepNumber} style={{ color: '#38bdf8' }}>Layer 4</span>
              <h4 className={styles.stepTitle}>PROJECT</h4>
              <div className={styles.stepCount} style={{ color: '#38bdf8' }}>{projects.length}</div>
              <span className={styles.stepQuestion}>Specific work moving me forward</span>
            </Link>

            <Link href="/tasks" className={styles.hierarchyStepCard} style={{ borderTop: '2px solid #fbbf24' }}>
              <span className={styles.stepNumber} style={{ color: '#fbbf24' }}>Layer 5</span>
              <h4 className={styles.stepTitle}>TASK</h4>
              <div className={styles.stepCount} style={{ color: '#fbbf24' }}>
                {tasks.filter((t) => t.status !== 'done').length}
              </div>
              <span className={styles.stepQuestion}>Action to complete today</span>
            </Link>

            <Link href="/focus" className={styles.hierarchyStepCard} style={{ borderTop: '2px solid #f43f5e' }}>
              <span className={styles.stepNumber} style={{ color: '#f43f5e' }}>Layer 6</span>
              <h4 className={styles.stepTitle}>FOCUS</h4>
              <div className={styles.stepCount} style={{ color: '#f43f5e' }}><Play size={18} /></div>
              <span className={styles.stepQuestion}>Remove noise & do the work</span>
            </Link>
          </div>
        </div>
      )}

      {/* ── SECTION E & F: MINDSET & PERSONAL REFLECTION (VIBRANT CARDS) ── */}
      {(activeTab === 'diagnostic' || activeTab === 'all') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className={styles.comparisonGrid}>
            <div className={styles.comparisonBoxCuriosity}>
              <h3 className={styles.comparisonTitle} style={{ color: '#fbbf24' }}>
                ✦ Exploration — Curiosity
              </h3>
              <p className={styles.comparisonDesc}>
                Learning something purely because you are curious. Zero obligation to monetize, complete, or become an expert.
              </p>
              <ul className={styles.bulletList}>
                <li>Wide breadth with playful discovery</li>
                <li>Safe parking spot for shiny ideas in your backlog</li>
                <li>Zero performance anxiety or timeline pressure</li>
              </ul>
            </div>

            <div className={styles.comparisonBoxMastery}>
              <h3 className={styles.comparisonTitle} style={{ color: '#34d399' }}>
                ★ Mastery — Deliberate Practice
              </h3>
              <p className={styles.comparisonDesc}>
                Deliberately practicing a discipline over time, receiving feedback, and pushing through plateaus.
              </p>
              <ul className={styles.bulletList}>
                <li>Strictly 1 Primary Focus at a time</li>
                <li>90-day unbroken cycles of commitment</li>
                <li>Repetition through resistance and plateau periods</li>
              </ul>
            </div>
          </div>

          <div className={styles.ruleHighlight}>
            Key Principle: &ldquo;You can explore many things while developing mastery in a few.&rdquo;
          </div>

          {/* Interactive Diagnostic */}
          <div className={styles.diagnosticGrid}>
            {/* Question 1 */}
            <div className={styles.questionCard}>
              <h3 className={styles.questionPrompt}>1. What is your biggest struggle right now?</h3>
              <div className={styles.optionsStack}>
                {[
                  { key: 'shiny_object', label: 'I get excited about something new and abandon current goals.' },
                  { key: 'too_many', label: 'I pursue too many things simultaneously and scatter energy.' },
                  { key: 'inconsistency', label: 'I struggle with consistency and drop routines easily.' },
                  { key: 'fear_wrong_path', label: 'I am afraid of choosing the wrong path or wasting time.' },
                  { key: 'guilt_unproductive', label: 'I feel guilty whenever I am not actively learning or working.' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={`${styles.optionBtn} ${reflection?.struggle === opt.key ? styles.optionBtnSelected : ''}`}
                    onClick={() => handleStruggleSelect(opt.key as StruggleOption)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Question 2 */}
            <div className={styles.questionCard}>
              <h3 className={styles.questionPrompt}>2. What kind of person do you want to become?</h3>
              <div className={styles.optionsStack}>
                {[
                  { key: 'specialist', label: 'Someone exceptionally good at a few core things (Deep Specialist).' },
                  { key: 'polymath', label: 'A multidisciplinary person with knowledge across many fields (Polymath).' },
                  { key: 'synthesizer', label: 'Someone who builds meaningful things by combining skills (Synthesizer).' },
                  { key: 'explorer', label: 'Someone actively discovering their true lifelong passions (Explorer).' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={`${styles.optionBtn} ${reflection?.aspirationalIdentity === opt.key ? styles.optionBtnSelected : ''}`}
                    onClick={() => handleIdentitySelect(opt.key as IdentityOption)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Personalized Guidance Card */}
            {reflection && (
              <div className={styles.insightCard}>
                <h4 className={styles.insightTitle} style={{ color: '#c084fc' }}>
                  <Sparkles size={16} />
                  Your Tailored Growth Architecture
                </h4>
                <div className={styles.insightBody} style={{ whiteSpace: 'pre-line' }}>
                  {reflection.reflectionAdvice}
                </div>

                <div className={styles.formGroup} style={{ marginTop: '6px' }}>
                  <label className={styles.formLabel}>Personal Realizations & Strategic Notes</label>
                  <textarea
                    className={styles.notesInput}
                    placeholder="Write down any personal notes or commitments..."
                    value={reflection.personalNotes || ''}
                    onChange={(e) =>
                      saveReflection({
                        ...reflection,
                        personalNotes: e.target.value,
                        updatedAt: new Date().toISOString(),
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ADD INTEREST MODAL ── */}
      {interestModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setInterestModalOpen(false)}>
          <div className={styles.modalWindow} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add New Interest</h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setInterestModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            {errorMessage && <div className={styles.errorBanner}>{errorMessage}</div>}

            <form onSubmit={handleAddInterestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Interest / Skill Title *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Systems Architecture, Guitar, Blender 3D"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Interest Tier *</label>
                <select
                  className={styles.formSelect}
                  value={newLevel}
                  onChange={(e) => setNewLevel(e.target.value as InterestLevel)}
                >
                  <option value="primary">Primary Focus — Mastery (Limit: 1)</option>
                  <option value="secondary">Secondary Focus — Development (Limit: 2)</option>
                  <option value="exploration">Exploration — Curiosity Backlog (Unlimited)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Category / Field</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Engineering, Creative, Health, Languages"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Link to Existing Goal (Optional)</label>
                <select
                  className={styles.formSelect}
                  value={newLinkedGoalId}
                  onChange={(e) => setNewLinkedGoalId(e.target.value)}
                >
                  <option value="">None / Standalone Interest</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Notes & Schedule Intention</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Practice constraints, why this matters, or notes..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setInterestModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn}>
                  Save Interest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE 90-DAY SPRINT MODAL ── */}
      {sprintModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setSprintModalOpen(false)}>
          <div className={styles.modalWindow} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Initiate 90-Day Commitment Sprint</h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setSprintModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSprintSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Sprint Focus / Main Goal *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Master Production Next.js Architecture"
                  value={sprintTitle}
                  onChange={(e) => setSprintTitle(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Start Date *</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={sprintStartDate}
                  onChange={(e) => setSprintStartDate(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Connect to Active Goal</label>
                <select
                  className={styles.formSelect}
                  value={sprintLinkedGoalId}
                  onChange={(e) => setSprintLinkedGoalId(e.target.value)}
                >
                  <option value="">None / Custom Sprint</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>The Commitment Contract (Why This Direction?) *</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Why commit to this for 90 continuous days without quitting?"
                  value={sprintWhy}
                  onChange={(e) => setSprintWhy(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setSprintModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn}>
                  Lock In 90 Days
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EVALUATE SPRINT MODAL ── */}
      {evaluationModalOpen && activeSprint && (
        <div className={styles.modalBackdrop} onClick={() => setEvaluationModalOpen(false)}>
          <div className={styles.modalWindow} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>90-Day Sprint Evaluation</h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setEvaluationModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEvaluationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span className={styles.contractLabel}>Evaluating Sprint</span>
                <p style={{ margin: '2px 0', fontWeight: 600, color: 'var(--color-text)' }}>{activeSprint.title}</p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Next Quarter Decision *</label>
                <select
                  className={styles.formSelect}
                  value={evalDecision}
                  onChange={(e) => setEvalDecision(e.target.value as 'continue' | 'adjust' | 'pivot')}
                >
                  <option value="continue">Continue: Deepen mastery for another 90 days</option>
                  <option value="adjust">Adjust: Modify practice routine or strategy</option>
                  <option value="pivot">Pivot: Promote a secondary or exploration interest</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Rating (1 - 5 Stars)</label>
                <select
                  className={styles.formSelect}
                  value={evalRating}
                  onChange={(e) => setEvalRating(Number(e.target.value))}
                >
                  <option value={5}>⭐⭐⭐⭐⭐ (5/5 Exceptional consistency & breakthrough)</option>
                  <option value={4}>⭐⭐⭐⭐ (4/5 Solid progress with minor resistance)</option>
                  <option value={3}>⭐⭐⭐ (3/5 Moderate consistency, learned a lot)</option>
                  <option value={2}>⭐⭐ (2/5 Struggled with follow-through)</option>
                  <option value={1}>⭐ (1/5 Lost momentum early)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Final Retrospective & Reflections</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="What did you learn? What were key wins and friction points?"
                  value={evalReflection}
                  onChange={(e) => setEvalReflection(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setEvaluationModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn}>
                  Finalize & Archive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subcomponent for individual interest card ──
function InterestCardItem({
  interest,
  linkedGoalTitle,
  onMove,
  onDelete,
}: {
  interest: Interest;
  linkedGoalTitle?: string;
  onMove: (level: InterestLevel) => void;
  onDelete: () => void;
}) {
  const tagStyle = getCategoryTagStyle(interest.category);

  return (
    <div className={styles.interestCard}>
      <div className={styles.interestTop}>
        <h4 className={styles.interestTitle}>{interest.title}</h4>
        {interest.category && (
          <span className={styles.categoryTag} style={tagStyle}>
            {interest.category}
          </span>
        )}
      </div>

      {interest.notes && <p className={styles.interestNotes}>{interest.notes}</p>}

      {linkedGoalTitle && (
        <span className={styles.interestLinkedGoal} title={`Linked to goal: ${linkedGoalTitle}`}>
          <Bookmark size={11} />
          {linkedGoalTitle}
        </span>
      )}

      <div className={styles.interestActions}>
        <div className={styles.moveButtonGroup}>
          {interest.level !== 'primary' && (
            <button
              type="button"
              className={styles.miniBtn}
              onClick={() => onMove('primary')}
              title="Promote to Primary Focus"
              style={{ color: '#10b981' }}
            >
              → Primary
            </button>
          )}
          {interest.level !== 'secondary' && (
            <button
              type="button"
              className={styles.miniBtn}
              onClick={() => onMove('secondary')}
              title="Move to Secondary Focus"
              style={{ color: '#818cf8' }}
            >
              → Secondary
            </button>
          )}
          {interest.level !== 'exploration' && (
            <button
              type="button"
              className={styles.miniBtn}
              onClick={() => onMove('exploration')}
              title="Move to Exploration Backlog"
              style={{ color: '#f59e0b' }}
            >
              → Explore
            </button>
          )}
        </div>

        <button
          type="button"
          className={styles.deleteMiniBtn}
          onClick={onDelete}
          title="Delete interest"
          aria-label={`Delete ${interest.title}`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
