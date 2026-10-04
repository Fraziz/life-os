'use client';

import React from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import styles from './AdhdHierarchyModal.module.css';

interface AdhdHierarchyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdhdHierarchyModal({ isOpen, onClose }: AdhdHierarchyModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <div className={styles.badge}>
              ADHD Mental Model
            </div>
            <h2 className={styles.title}>
              The 4 Levels, Simplified
            </h2>
            <p className={styles.subtitle}>
              A calm, low-friction hierarchy designed for ADHD brains. No rigid rules, no taxonomy paralysis.
            </p>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close guide"
            title="Close guide"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.body}>
          {/* Visual Funnel */}
          <div className={styles.funnelBar}>
            <div className={styles.funnelStep} style={{ color: '#c084fc' }}>
              <span>1. Dream (Vision)</span>
            </div>
            <span className={styles.funnelArrow}>→</span>
            <div className={styles.funnelStep} style={{ color: '#fbbf24' }}>
              <span>2. Goal (Quest)</span>
            </div>
            <span className={styles.funnelArrow}>→</span>
            <div className={styles.funnelStep} style={{ color: '#38bdf8' }}>
              <span>3. Project (Folder)</span>
            </div>
            <span className={styles.funnelArrow}>→</span>
            <div className={styles.funnelStep} style={{ color: '#34d399' }}>
              <span>4. Task (Action)</span>
            </div>
          </div>

          <div className={styles.funnelNotice}>
            <span>
              <strong>Golden Rule:</strong> You do not have to create all 4 levels. You can leap directly from a Dream or Goal into a 15-minute Task at any time.
            </span>
          </div>

          {/* 4 Cards Grid */}
          <div className={styles.levelsGrid}>
            {/* Level 1: Dream */}
            <div className={styles.levelCard} style={{ '--level-color': '#a855f7' } as React.CSSProperties}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle} style={{ color: '#c084fc' }}>
                  Dream
                </div>
                <span className={styles.roleTag}>Someday / Lifetime</span>
              </div>
              <p className={styles.cardDesc}>
                Pure aspiration and visual longing. No deadlines, no pressure, zero guilt. It is the big picture of what you want life to feel like.
              </p>
              <div className={styles.adhdRuleBox}>
                <strong>ADHD note:</strong> No due dates here. Use this for intrinsic motivation when energy is low.
              </div>
              <p className={styles.exampleRow}>
                e.g. &ldquo;Live near the coast&rdquo;, &ldquo;Financial independence&rdquo;
              </p>
              <Link href="/dreams" onClick={onClose} className={styles.cardLinkBtn}>
                Open Dreams →
              </Link>
            </div>

            {/* Level 2: Goal */}
            <div className={styles.levelCard} style={{ '--level-color': '#f59e0b' } as React.CSSProperties}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle} style={{ color: '#fbbf24' }}>
                  Goal
                </div>
                <span className={styles.roleTag}>1 – 3 Months</span>
              </div>
              <p className={styles.cardDesc}>
                A clear, measurable quest with a finish line. You know definitively when it is completed.
              </p>
              <div className={styles.adhdRuleBox}>
                <strong>ADHD note:</strong> Limit to 2–3 active goals at once to prevent dopamine burnout.
              </div>
              <p className={styles.exampleRow}>
                e.g. &ldquo;Save $3,000 emergency fund&rdquo;, &ldquo;Release MVP v1&rdquo;
              </p>
              <Link href="/goals" onClick={onClose} className={styles.cardLinkBtn}>
                Open Goals →
              </Link>
            </div>

            {/* Level 3: Project */}
            <div className={styles.levelCard} style={{ '--level-color': '#38bdf8' } as React.CSSProperties}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle} style={{ color: '#38bdf8' }}>
                  Project
                </div>
                <span className={styles.roleTag}>1 – 4 Weeks</span>
              </div>
              <p className={styles.cardDesc}>
                A folder for related steps. Any outcome requiring more than one action session lives here so your task board stays uncluttered.
              </p>
              <div className={styles.adhdRuleBox}>
                <strong>ADHD note:</strong> If a task feels heavy and you keep avoiding it, it is actually a Project. Break it into 3 small actions.
              </div>
              <p className={styles.exampleRow}>
                e.g. &ldquo;Redesign Portfolio&rdquo;, &ldquo;Organize Home Studio&rdquo;
              </p>
              <Link href="/projects" onClick={onClose} className={styles.cardLinkBtn}>
                Open Projects →
              </Link>
            </div>

            {/* Level 4: Task */}
            <div className={styles.levelCard} style={{ '--level-color': '#10b981' } as React.CSSProperties}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle} style={{ color: '#34d399' }}>
                  Task
                </div>
                <span className={styles.roleTag}>15 – 25 Minutes</span>
              </div>
              <p className={styles.cardDesc}>
                A single physical action you can do immediately with zero deliberation or planning required.
              </p>
              <div className={styles.adhdRuleBox}>
                <strong>ADHD note:</strong> Always start with a verb (&ldquo;Draft&rdquo;, &ldquo;Call&rdquo;, &ldquo;Order&rdquo;). Small steps get done.
              </div>
              <p className={styles.exampleRow}>
                e.g. &ldquo;Write first 3 bullet points&rdquo;, &ldquo;Pay utility invoice&rdquo;
              </p>
              <Link href="/tasks" onClick={onClose} className={styles.cardLinkBtn}>
                Open Tasks →
              </Link>
            </div>
          </div>

          {/* Quick Decision Cheat Sheet */}
          <div className={styles.decisionSection}>
            <h4 className={styles.decisionTitle}>
              Quick Decision: Where does this thought belong?
            </h4>
            <ul className={styles.decisionList}>
              <li className={styles.decisionItem}>
                <span className={styles.decisionQuestion}>Can I sit down and complete it in under 25 minutes right now?</span>
                <span className={styles.decisionAnswer} style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                  Task
                </span>
              </li>
              <li className={styles.decisionItem}>
                <span className={styles.decisionQuestion}>Does it require multiple distinct steps over a week or two?</span>
                <span className={styles.decisionAnswer} style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
                  Project
                </span>
              </li>
              <li className={styles.decisionItem}>
                <span className={styles.decisionQuestion}>Is it a major target for the next 1–3 months?</span>
                <span className={styles.decisionAnswer} style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}>
                  Goal
                </span>
              </li>
              <li className={styles.decisionItem}>
                <span className={styles.decisionQuestion}>Is it a big life aspiration with no strict timeline?</span>
                <span className={styles.decisionAnswer} style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}>
                  Dream
                </span>
              </li>
              <li className={styles.decisionItem}>
                <span className={styles.decisionQuestion}>Not sure or feeling overwhelmed?</span>
                <span className={styles.decisionAnswer} style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#e4e4e7' }}>
                  Idea Parking (Inbox)
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
            Action beats overthinking every time.
          </span>
          <button className={styles.gotItBtn} onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
