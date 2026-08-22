import type { LucideIcon } from 'lucide-react';
import styles from './ComingSoon.module.css';

interface ComingSoonProps {
  /** Feature name displayed as the heading */
  feature: string;
  /** Short description of what this section will do */
  description: string;
  /** Vector icon component to represent the feature */
  icon?: LucideIcon;
  /** Which development phase this feature is scheduled for */
  phase: number;
  /** Optional extra context e.g. "AI-powered planning" */
  tag?: string;
}

/**
 * Placeholder component for features not yet built.
 * Clearly communicates intent without fake functionality.
 * Rendered in all phase-N+ page routes until that phase is built.
 */
export default function ComingSoon({
  feature,
  description,
  icon: Icon,
  phase,
  tag,
}: ComingSoonProps) {
  return (
    <div className={styles.container} role="region" aria-label={`${feature} — coming soon`}>
      <div className={styles.iconWrapper}>
        {Icon ? (
          <Icon size={28} style={{ color: 'var(--color-accent)' }} />
        ) : (
          <span className={styles.iconText} style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
            {phase < 10 ? `0${phase}` : phase}
          </span>
        )}
        <span className={styles.phaseBadge}>Phase {phase}</span>
      </div>

      <h2 className={styles.title}>{feature}</h2>
      <p className={styles.description}>{description}</p>

      <div className={styles.timeline}>
        <span className={styles.timelineLabel}>Scheduled for</span>
        <span className={styles.timelinePhase}>
          Phase {phase}{tag ? ` · ${tag}` : ''}
        </span>
      </div>
    </div>
  );
}

