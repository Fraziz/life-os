'use client';

import React, { useState } from 'react';
import {
  X,
  Search,
  Play,
  Clock,
  Zap,
  Sliders,
  GitBranch,
  Globe,
  Hourglass,
  Database,
  CheckSquare,
  Lightbulb,
  CheckCircle,
} from 'lucide-react';
import type { FlowNodeType } from '@/types';
import styles from './FlowLab.module.css';

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: FlowNodeType) => void;
}

interface NodeDefinition {
  type: FlowNodeType;
  title: string;
  description: string;
  category: 'Triggers' | 'Logic' | 'Network' | 'Life OS';
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

const AVAILABLE_NODES: NodeDefinition[] = [
  // Triggers
  {
    type: 'manual_trigger',
    title: 'Manual Trigger',
    description: 'Start flow with custom test JSON payload',
    category: 'Triggers',
    icon: Play,
  },
  {
    type: 'schedule_trigger',
    title: 'Schedule Trigger',
    description: 'Simulated recurring interval or cron cycle',
    category: 'Triggers',
    icon: Clock,
  },
  {
    type: 'lifeos_trigger',
    title: 'Life OS Event',
    description: 'Trigger when Tasks or Habits are checked',
    category: 'Triggers',
    icon: Zap,
  },

  // Logic & Transform
  {
    type: 'set_fields',
    title: 'Set Fields',
    description: 'Map, transform, and rename payload data',
    category: 'Logic',
    icon: Sliders,
  },
  {
    type: 'if_else',
    title: 'IF / ELSE Branch',
    description: 'Route payload across True or False output paths',
    category: 'Logic',
    icon: GitBranch,
  },
  {
    type: 'delay',
    title: 'Delay',
    description: 'Pause execution for configured seconds',
    category: 'Logic',
    icon: Hourglass,
  },

  // Network & Storage
  {
    type: 'http_request',
    title: 'HTTP Request',
    description: 'Fetch external REST APIs (GET, POST, etc.)',
    category: 'Network',
    icon: Globe,
  },
  {
    type: 'save_record',
    title: 'Save Record',
    description: 'Persist data into FlowLab’s records database',
    category: 'Network',
    icon: Database,
  },

  // Life OS Integrations
  {
    type: 'lifeos_create_task',
    title: 'Create Life OS Task',
    description: 'Spawn actionable tasks directly in your Tasks list',
    category: 'Life OS',
    icon: CheckSquare,
  },
  {
    type: 'lifeos_inbox_idea',
    title: 'Add to Idea Parking',
    description: 'Route thoughts or notes into Idea Parking Inbox',
    category: 'Life OS',
    icon: Lightbulb,
  },
  {
    type: 'lifeos_toggle_habit',
    title: 'Check Habit',
    description: 'Check off a daily habit in your Habit Tracker',
    category: 'Life OS',
    icon: CheckCircle,
  },
];

export default function AddNodeModal({ isOpen, onClose, onSelectType }: AddNodeModalProps) {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = AVAILABLE_NODES.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.description.toLowerCase().includes(search.toLowerCase()) ||
      n.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories = ['Triggers', 'Logic', 'Network', 'Life OS'] as const;

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Add Step to Workflow</h3>
          <button className={styles.iconBtn} onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '12px 24px 0 24px' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search steps (e.g. HTTP, IF/ELSE, Create Task)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.formInput}
              style={{ paddingLeft: 36 }}
              autoFocus
            />
          </div>
        </div>

        <div className={styles.modalBody}>
          {categories.map((cat) => {
            const items = filtered.filter((n) => n.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className={styles.nodeCategorySection}>
                <h4 className={styles.categoryHeading}>{cat}</h4>
                <div className={styles.nodeCatalogGrid}>
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.type}
                        className={styles.catalogItemBtn}
                        onClick={() => {
                          onSelectType(item.type);
                          onClose();
                        }}
                      >
                        <div style={{ color: 'var(--color-accent)' }}>
                          <Icon size={18} />
                        </div>
                        <span className={styles.catalogItemTitle}>{item.title}</span>
                        <p className={styles.catalogItemDesc}>{item.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
