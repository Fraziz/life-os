'use client';

import React, { useState, useEffect } from 'react';
import { Trash2, Archive, X, CheckSquare, Square, MinusSquare } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import styles from './BulkActionBar.module.css';

export interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  itemLabel?: string;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDelete: () => void;
  onArchive?: () => void;
  deleteLabel?: string;
  archiveLabel?: string;
  customActions?: React.ReactNode;
}

export default function BulkActionBar({
  selectedCount,
  totalCount,
  itemLabel = 'items',
  onSelectAll,
  onDeselectAll,
  onDelete,
  onArchive,
  deleteLabel = 'Delete',
  archiveLabel = 'Archive',
  customActions,
}: BulkActionBarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Keyboard shortcut: Escape clears selection
  useEffect(() => {
    if (selectedCount === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showDeleteConfirm && !showArchiveConfirm) {
        onDeselectAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCount, onDeselectAll, showDeleteConfirm, showArchiveConfirm]);

  if (selectedCount === 0) return null;

  const isAllSelected = totalCount > 0 && selectedCount === totalCount;

  return (
    <>
      <aside className={styles.barContainer} role="region" aria-label="Bulk actions">
        <div className={styles.barContent}>
          {/* Left: Selection State & Select All Toggle */}
          <div className={styles.selectionInfo}>
            <button
              type="button"
              className={styles.toggleAllBtn}
              onClick={isAllSelected ? onDeselectAll : onSelectAll}
              title={isAllSelected ? 'Deselect all' : 'Select all'}
              aria-label={isAllSelected ? 'Deselect all' : 'Select all'}
            >
              {isAllSelected ? (
                <CheckSquare size={17} className={styles.checkIcon} />
              ) : selectedCount > 0 ? (
                <MinusSquare size={17} className={styles.checkIcon} />
              ) : (
                <Square size={17} className={styles.checkIcon} />
              )}
            </button>
            <span className={styles.countText}>
              <strong>{selectedCount}</strong>
              <span className={styles.countLabel}>
                {selectedCount === 1 ? itemLabel.replace(/s$/, '') : itemLabel} selected
              </span>
            </span>
          </div>

          {/* Center / Right: Actions */}
          <div className={styles.actionsGroup}>
            {customActions}

            {onArchive && (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setShowArchiveConfirm(true)}
                title={`${archiveLabel} ${selectedCount} ${itemLabel}`}
              >
                <Archive size={14} />
                <span>{archiveLabel} ({selectedCount})</span>
              </button>
            )}

            <button
              type="button"
              className={`${styles.actionBtn} ${styles.deleteBtn}`}
              onClick={() => setShowDeleteConfirm(true)}
              title={`${deleteLabel} ${selectedCount} ${itemLabel}`}
            >
              <Trash2 size={14} />
              <span>{deleteLabel} ({selectedCount})</span>
            </button>

            <button
              type="button"
              className={styles.closeBtn}
              onClick={onDeselectAll}
              title="Clear selection (Esc)"
              aria-label="Clear selection"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={`Delete ${selectedCount} ${selectedCount === 1 ? itemLabel.replace(/s$/, '') : itemLabel}?`}
        message={`Are you sure you want to permanently delete ${selectedCount} ${selectedCount === 1 ? itemLabel.replace(/s$/, '') : itemLabel}? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedCount} ${itemLabel}`}
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Archive Confirmation */}
      {onArchive && (
        <ConfirmDialog
          isOpen={showArchiveConfirm}
          title={`Archive ${selectedCount} ${selectedCount === 1 ? itemLabel.replace(/s$/, '') : itemLabel}?`}
          message={`Are you sure you want to archive ${selectedCount} ${selectedCount === 1 ? itemLabel.replace(/s$/, '') : itemLabel}? You can still view them later.`}
          confirmLabel={`Archive ${selectedCount} ${itemLabel}`}
          cancelLabel="Cancel"
          isDestructive={false}
          onConfirm={() => {
            setShowArchiveConfirm(false);
            onArchive();
          }}
          onCancel={() => setShowArchiveConfirm(false)}
        />
      )}
    </>
  );
}

