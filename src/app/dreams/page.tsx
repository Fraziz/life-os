'use client';

import React, { useState } from 'react';
import { useDreams } from '@/context/DreamContext';
import { useLifeAreas } from '@/context/LifeAreaContext';
import type { Dream, DreamStatus } from '@/types';
import { AreaIcon } from '@/app/areas/page';
import {
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Heart,
  CheckCircle2,
  X,
  RotateCcw,
  CloudSun,
} from 'lucide-react';
import styles from './page.module.css';
import EntityFiles from '@/components/files/EntityFiles';

const STATUS_CONFIG: Record<DreamStatus, { label: string; className: string }> = {
  dream: { label: 'Dream', className: styles.dream },
  planning: { label: 'Planning', className: styles.planning },
  active: { label: 'Active', className: styles.active },
  paused: { label: 'Paused', className: styles.paused },
  achieved: { label: 'Achieved ✓', className: styles.achieved },
  archived: { label: 'Archived', className: styles.archived },
};

export default function DreamsPage() {
  const { dreams, addDream, updateDream, updateDreamStatus, deleteDream, resetToDefaultDreams, isLoaded } = useDreams();
  const { activeAreas } = useLifeAreas();

  const [activeFilter, setActiveFilter] = useState<'all' | DreamStatus>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDream, setEditingDream] = useState<Dream | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [whyItMatters, setWhyItMatters] = useState('');
  const [lifeAreaId, setLifeAreaId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<DreamStatus>('dream');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  if (!isLoaded) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Loading your Dreams & Vision Board...
        </p>
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingDream(null);
    setTitle('');
    setDescription('');
    setWhyItMatters('');
    setLifeAreaId(activeAreas[0]?.id || '');
    setTargetDate('');
    setStatus('dream');
    setNotes('');
    setImageUrl('');
    setModalOpen(true);
  };

  const openEditModal = (d: Dream) => {
    setEditingDream(d);
    setTitle(d.title);
    setDescription(d.description || '');
    setWhyItMatters(d.whyItMatters);
    setLifeAreaId(d.lifeAreaId || '');
    setTargetDate(d.targetDate || '');
    setStatus(d.status);
    setNotes(d.notes || '');
    setImageUrl(d.imageUrl || '');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !whyItMatters.trim()) return;

    if (editingDream) {
      updateDream(editingDream.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        whyItMatters: whyItMatters.trim(),
        lifeAreaId: lifeAreaId || undefined,
        targetDate: targetDate || undefined,
        status,
        notes: notes.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
      });
    } else {
      addDream({
        title: title.trim(),
        description: description.trim() || undefined,
        whyItMatters: whyItMatters.trim(),
        lifeAreaId: lifeAreaId || undefined,
        targetDate: targetDate || undefined,
        status,
        notes: notes.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
      });
    }
    setModalOpen(false);
  };

  const filteredDreams = dreams.filter((d) => {
    if (activeFilter === 'all') return d.status !== 'archived';
    return d.status === activeFilter;
  });

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Dreams & Vision Board</h1>
          <p className={styles.subtitle}>
            Capture what you want your life to become. Dreams represent your long-term direction, visual aspirations, and core human motivations.
          </p>
        </div>

        <button className={styles.btnCreate} onClick={openCreateModal}>
          <Plus size={18} /> New Dream
        </button>
      </header>

      {/* ── Controls Bar ── */}
      <div className={styles.controlsBar}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeFilter === 'all' ? styles.activeTab : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All Active ({dreams.filter((d) => d.status !== 'archived').length})
          </button>
          <button
            className={`${styles.tab} ${activeFilter === 'dream' ? styles.activeTab : ''}`}
            onClick={() => setActiveFilter('dream')}
          >
            Dreams
          </button>
          <button
            className={`${styles.tab} ${activeFilter === 'planning' ? styles.activeTab : ''}`}
            onClick={() => setActiveFilter('planning')}
          >
            Planning
          </button>
          <button
            className={`${styles.tab} ${activeFilter === 'active' ? styles.activeTab : ''}`}
            onClick={() => setActiveFilter('active')}
          >
            Active
          </button>
          <button
            className={`${styles.tab} ${activeFilter === 'achieved' ? styles.activeTab : ''}`}
            onClick={() => setActiveFilter('achieved')}
          >
            Achieved ({dreams.filter((d) => d.status === 'achieved').length})
          </button>
          <button
            className={`${styles.tab} ${activeFilter === 'archived' ? styles.activeTab : ''}`}
            onClick={() => setActiveFilter('archived')}
          >
            Archived ({dreams.filter((d) => d.status === 'archived').length})
          </button>
        </div>
      </div>

      {/* ── Dreams Grid ── */}
      {filteredDreams.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-12)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px dashed var(--color-border-subtle)',
          }}
        >
          <CloudSun size={40} style={{ color: 'var(--color-text-faint)', marginBottom: 'var(--space-2)' }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            No dreams matching this filter. Click &quot;New Dream&quot; to add your ambition!
          </p>
        </div>
      ) : (
        <div className={styles.dreamsGrid}>
          {filteredDreams.map((d) => {
            const area = activeAreas.find((a) => a.id === d.lifeAreaId);
            const statusInfo = STATUS_CONFIG[d.status] || STATUS_CONFIG.dream;

            return (
              <article key={d.id} className={styles.dreamCard}>
                {d.imageUrl ? (
                  <img src={d.imageUrl} alt={d.title} className={styles.cardCover} />
                ) : (
                  <div className={styles.cardCoverFallback} />
                )}

                <div className={styles.cardBody}>
                  <div className={styles.cardTopRow}>
                    <span className={`${styles.statusBadge} ${statusInfo.className}`}>
                      <Sparkles size={12} /> {statusInfo.label}
                    </span>

                    <div className={styles.cardActions}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => openEditModal(d)}
                        title="Edit Dream"
                      >
                        <Edit2 size={16} />
                      </button>

                      <button
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={() => {
                          if (confirm(`Delete Dream "${d.title}"?`)) {
                            deleteDream(d.id);
                          }
                        }}
                        title="Delete Dream"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className={styles.dreamTitle}>{d.title}</h3>
                    {d.description && <p className={styles.dreamDesc}>{d.description}</p>}
                  </div>

                  <div className={styles.whyBanner}>
                    <span className={styles.whyLabel}>Why it matters</span>
                    <p className={styles.whyText}>&ldquo;{d.whyItMatters}&rdquo;</p>
                  </div>

                  {d.notes && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', background: 'var(--color-surface)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                      <strong>Notes:</strong> {d.notes}
                    </div>
                  )}

                  <div className={styles.cardFooter}>
                    {area ? (
                      <span
                        className={styles.lifeAreaChip}
                        style={{
                          backgroundColor: `${area.color}15`,
                          color: area.color,
                          border: `1px solid ${area.color}40`,
                        }}
                      >
                        <AreaIcon name={area.icon} size={14} /> {area.name}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-faint)' }}>General Life</span>
                    )}

                    {d.targetDate && (
                      <span className={styles.targetDate}>
                        <Calendar size={13} /> {d.targetDate}
                      </span>
                    )}
                  </div>

                  <EntityFiles entityType="dream" entityId={d.id} title={d.title} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── Modal Dialog for Create / Edit ── */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingDream ? 'Edit Dream' : 'New Dream Vision'}
              </h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="dream-title">Dream Title</label>
                <input
                  id="dream-title"
                  type="text"
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Build my own game, Become financially independent"
                  required
                  autoFocus
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="dream-why">Why It Matters (Core Motivation)</label>
                <textarea
                  id="dream-why"
                  className={styles.textarea}
                  value={whyItMatters}
                  onChange={(e) => setWhyItMatters(e.target.value)}
                  placeholder="Why is this dream important to your life? What will achieving it feel like?"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="dream-desc">Description & Context (Optional)</label>
                <textarea
                  id="dream-desc"
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary of what this dream entails..."
                />
              </div>

              <div className={styles.gridTwo}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="dream-status">Status</label>
                  <select
                    id="dream-status"
                    className={styles.select}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as DreamStatus)}
                  >
                    <option value="dream">Dream (Vision / Someday)</option>
                    <option value="planning">Planning (Defining Path)</option>
                    <option value="active">Active (Currently Pursuing)</option>
                    <option value="paused">Paused (On Hold)</option>
                    <option value="achieved">Achieved ✓ (Realized)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="dream-area">Life Area</label>
                  <select
                    id="dream-area"
                    className={styles.select}
                    value={lifeAreaId}
                    onChange={(e) => setLifeAreaId(e.target.value)}
                  >
                    <option value="">-- Select Life Area --</option>
                    {activeAreas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.gridTwo}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="dream-target-date">Target Realization Date (Optional)</label>
                  <input
                    id="dream-target-date"
                    type="date"
                    className={styles.input}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="dream-image">Vision Cover Image URL (Optional)</label>
                  <input
                    id="dream-image"
                    type="url"
                    className={styles.input}
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="dream-notes">Inspiration Notes & Ideas (Optional)</label>
                <textarea
                  id="dream-notes"
                  className={styles.textarea}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Inspirations, books, references, mental notes..."
                />
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnCreate}>
                  {editingDream ? 'Save Dream' : 'Add Dream'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
