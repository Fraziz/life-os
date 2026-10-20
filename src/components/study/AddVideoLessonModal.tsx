'use client';

import React, { useState, useEffect } from 'react';
import { Video, X, Check, AlertCircle } from 'lucide-react';
import styles from './AddVideoLessonModal.module.css';
import { parseYouTubeUrl } from '@/utils/youtube';

interface AddVideoLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (data: { videoId: string; url: string; title: string; startTime: number }) => void;
  initialUrl?: string;
  initialTitle?: string;
  mode?: 'insert' | 'create';
}

export default function AddVideoLessonModal({
  isOpen,
  onClose,
  onInsert,
  initialUrl = '',
  initialTitle = '',
  mode = 'insert',
}: AddVideoLessonModalProps) {
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState(initialTitle);
  const [parsed, setParsed] = useState<ReturnType<typeof parseYouTubeUrl> | null>(null);

  useEffect(() => {
    setUrl(initialUrl);
    setTitle(initialTitle);
    if (initialUrl) {
      setParsed(parseYouTubeUrl(initialUrl));
    } else {
      setParsed(null);
    }
  }, [initialUrl, initialTitle, isOpen]);

  const handleUrlChange = (val: string) => {
    setUrl(val);
    const res = parseYouTubeUrl(val);
    setParsed(res);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    onInsert({
      videoId: parsed.videoId,
      url: parsed.originalUrl,
      title: title.trim() || 'Video Lesson',
      startTime: parsed.startTime,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-modal-title"
      >
        <div className={styles.modalHeader}>
          <h3 id="video-modal-title" className={styles.modalTitle}>
            <Video size={16} style={{ color: 'var(--color-accent-light)' }} />
            <span>{mode === 'create' ? 'New Video Lesson' : 'Add YouTube Video Lesson'}</span>
          </h3>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.formGroup}>
              <label htmlFor="yt-url-input" className={styles.fieldLabel}>
                Paste YouTube video link
              </label>
              <input
                id="yt-url-input"
                type="text"
                className={styles.textInput}
                placeholder="https://www.youtube.com/watch?v=... or youtu.be/..."
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                autoFocus
              />
            </div>

            {/* Validation Feedback */}
            {url.trim().length > 0 && (
              <div>
                {parsed ? (
                  <div className={styles.previewBadge}>
                    <Check size={13} />
                    <span>
                      Valid video ID: <strong>{parsed.videoId}</strong>
                      {parsed.startTime > 0 ? ` (starts at ${parsed.startTime}s)` : ''}
                    </span>
                  </div>
                ) : (
                  <div className={styles.errorBadge}>
                    <AlertCircle size={13} />
                    <span>Please enter a valid YouTube video or shorts link</span>
                  </div>
                )}
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="lesson-title-input" className={styles.fieldLabel}>
                Lesson Title {mode === 'create' ? '' : '(optional)'}
              </label>
              <input
                id="lesson-title-input"
                type="text"
                className={styles.textInput}
                placeholder="e.g. Panaginip - Fingerstyle Guitar (Tabs & Chords)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={styles.btnAddVideo}
              disabled={!parsed}
            >
              {mode === 'create' ? 'Create Video Lesson' : 'Add Video'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
