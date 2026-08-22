'use client';

import React, { useState } from 'react';
import { useLifeAreas } from '@/context/LifeAreaContext';
import type { LifeArea } from '@/types';
import {
  User,
  Briefcase,
  Wallet,
  BookOpen,
  Palette,
  Heart,
  Users,
  Target,
  Sparkles,
  Globe,
  Compass,
  Layers,
  Plus,
  Edit2,
  Trash2,
  Archive,
  ArchiveRestore,
  ChevronUp,
  ChevronDown,
  X,
  RotateCcw,
  LucideIcon,
} from 'lucide-react';
import styles from './page.module.css';
import EntityFiles from '@/components/files/EntityFiles';

// Available icon options for custom Life Areas
const ICON_OPTIONS: Record<string, LucideIcon> = {
  User,
  Briefcase,
  Wallet,
  BookOpen,
  Palette,
  Heart,
  Users,
  Target,
  Sparkles,
  Globe,
  Compass,
  Layers,
};

// Available color preset swatches
const COLOR_PRESETS = [
  '#a594ff', // Lavender/Purple
  '#3b82f6', // Blue
  '#10b981', // Emerald Green
  '#f59e0b', // Amber/Yellow
  '#ec4899', // Pink
  '#f43f5e', // Rose Red
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#64748b', // Slate
];

export function AreaIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const IconComponent = ICON_OPTIONS[name] || Layers;
  return <IconComponent size={size} className={className} />;
}

export default function LifeAreasPage() {
  const {
    areas,
    activeAreas,
    archivedAreas,
    addArea,
    updateArea,
    reorderArea,
    toggleArchiveArea,
    deleteArea,
    resetToDefaultAreas,
    isLoaded,
  } = useLifeAreas();

  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<LifeArea | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [icon, setIcon] = useState('User');
  const [description, setDescription] = useState('');

  if (!isLoaded) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Loading your Life Areas...
        </p>
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingArea(null);
    setName('');
    setColor(COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)]);
    setIcon('User');
    setDescription('');
    setModalOpen(true);
  };

  const openEditModal = (area: LifeArea) => {
    setEditingArea(area);
    setName(area.name);
    setColor(area.color);
    setIcon(area.icon);
    setDescription(area.description || '');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingArea) {
      updateArea(editingArea.id, {
        name: name.trim(),
        color,
        icon,
        description: description.trim() || undefined,
      });
    } else {
      addArea({
        name: name.trim(),
        color,
        icon,
        description: description.trim() || undefined,
      });
    }
    setModalOpen(false);
  };

  const currentList = activeTab === 'active' ? activeAreas : archivedAreas;

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Life Areas</h1>
          <p className={styles.subtitle}>
            Organize your life into distinct areas. Create, rename, reorder, archive, or remove categories to match your personal structure.
          </p>
        </div>

        <button className={styles.btnCreate} onClick={openCreateModal}>
          <Plus size={18} /> New Life Area
        </button>
      </header>

      {/* ── Controls Bar ── */}
      <div className={styles.controlsBar}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'active' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Active Areas ({activeAreas.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'archived' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('archived')}
          >
            Archived ({archivedAreas.length})
          </button>
        </div>
      </div>

      {/* ── Areas Grid ── */}
      {currentList.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-12)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px dashed var(--color-border-subtle)',
          }}
        >
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            {activeTab === 'active'
              ? 'No active Life Areas. Click "New Life Area" to create one!'
              : 'No archived Life Areas.'}
          </p>
        </div>
      ) : (
        <div className={styles.areasGrid}>
          {currentList.map((area, idx) => (
            <article
              key={area.id}
              className={`${styles.areaCard} ${area.isArchived ? styles.archived : ''}`}
            >
              <div className={styles.areaHeader}>
                <div
                  className={styles.iconBadge}
                  style={{
                    backgroundColor: `${area.color}15`,
                    color: area.color,
                    border: `1px solid ${area.color}40`,
                  }}
                >
                  <AreaIcon name={area.icon} size={22} />
                </div>

                <div className={styles.cardActions}>
                  <EntityFiles variant="icon" entityType="area" entityId={area.id} title={area.name} />
                  {activeTab === 'active' && (
                    <>
                      <button
                        className={styles.actionBtn}
                        onClick={() => reorderArea(area.id, 'up')}
                        disabled={idx === 0}
                        title="Move Up"
                        style={{ opacity: idx === 0 ? 0.3 : 1 }}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        className={styles.actionBtn}
                        onClick={() => reorderArea(area.id, 'down')}
                        disabled={idx === currentList.length - 1}
                        title="Move Down"
                        style={{ opacity: idx === currentList.length - 1 ? 0.3 : 1 }}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </>
                  )}

                  <button
                    className={styles.actionBtn}
                    onClick={() => openEditModal(area)}
                    title="Edit Area"
                  >
                    <Edit2 size={16} />
                  </button>

                  <button
                    className={styles.actionBtn}
                    onClick={() => toggleArchiveArea(area.id)}
                    title={area.isArchived ? 'Unarchive Area' : 'Archive Area'}
                  >
                    {area.isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                  </button>

                  <button
                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                    onClick={() => {
                      if (confirm(`Delete Life Area "${area.name}"?`)) {
                        deleteArea(area.id);
                      }
                    }}
                    title="Delete Area"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div>
                <h3 className={styles.areaName}>{area.name}</h3>
                {area.description && <p className={styles.areaDesc}>{area.description}</p>}
              </div>

              <div className={styles.areaMeta}>
                <span>Order #{area.sortOrder}</span>
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: area.color,
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ── Modal Dialog for Create / Edit ── */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingArea ? 'Edit Life Area' : 'Create Life Area'}
              </h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="area-name">Area Name</label>
                <input
                  id="area-name"
                  type="text"
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Health, Business, Learning"
                  required
                  autoFocus
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="area-desc">Description (Optional)</label>
                <textarea
                  id="area-desc"
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this area encompass in your life?"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Accent Color</label>
                <div className={styles.colorsGrid}>
                  {COLOR_PRESETS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={`${styles.colorSwatch} ${color === hex ? styles.selectedColor : ''}`}
                      style={{ backgroundColor: hex }}
                      onClick={() => setColor(hex)}
                    />
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Icon Symbol</label>
                <div className={styles.iconsGrid}>
                  {Object.keys(ICON_OPTIONS).map((key) => {
                    const IconComp = ICON_OPTIONS[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`${styles.iconChoice} ${icon === key ? styles.selectedIcon : ''}`}
                        onClick={() => setIcon(key)}
                      >
                        <IconComp size={20} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnCreate}>
                  {editingArea ? 'Save Changes' : 'Create Area'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
