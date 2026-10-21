'use client';

import React, { useState, useEffect } from 'react';
import { Video, X, Check, AlertCircle, Sparkles } from 'lucide-react';
import styles from './AddVideoLessonModal.module.css';
import { parseUniversalVideoUrl, type ParsedVideoInfo } from '@/utils/universalVideo';

interface AddVideoLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (data: {
    videoId: string;
    url: string;
    title: string;
    startTime: number;
    platform?: string;
  }) => void;
  initialUrl?: string;
  initialTitle?: string;
  mode?: 'insert' | 'create' | 'edit';
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
  const [parsed, setParsed] = useState<ParsedVideoInfo | null>(null);

  useEffect(() => {
    setUrl(initialUrl);
    setTitle(initialTitle);
    if (initialUrl) {
      setParsed(parseUniversalVideoUrl(initialUrl));
    } else {
      setParsed(null);
    }
  }, [initialUrl, initialTitle, isOpen]);

  const handleUrlChange = async (val: string) => {
    setUrl(val);
    const res = parseUniversalVideoUrl(val);
    setParsed(res);

    // If user hasn't set a title yet, suggest the auto-detected title hint
    if (res?.titleHint && (!title.trim() || title === 'Video Lesson')) {
      setTitle(res.titleHint);
    }

    // Automatically resolve redirecting share links (e.g. fb.watch, facebook.com/share/r/, vm.tiktok.com)
    const trimmed = val.trim();
    if (
      trimmed.includes('fb.watch') ||
      trimmed.includes('/share/r/') ||
      trimmed.includes('/share/v/') ||
      trimmed.includes('vm.tiktok.com') ||
      trimmed.includes('tiktok.com/t/')
    ) {
      try {
        const previewRes = await fetch(`/api/link-preview?url=${encodeURIComponent(trimmed)}`);
        if (previewRes.ok) {
          const previewData = await previewRes.json();
          if (previewData.url && previewData.url !== trimmed) {
            setUrl(previewData.url);
            const canonicalRes = parseUniversalVideoUrl(previewData.url);
            if (canonicalRes) setParsed(canonicalRes);
          }
          if (previewData.title && (!title.trim() || title === 'Video Lesson')) {
            setTitle(previewData.title);
          }
        }
      } catch {
        // non-fatal
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    onInsert({
      videoId: parsed.videoId,
      url: parsed.originalUrl,
      title: title.trim() || parsed.titleHint || 'Video Lesson',
      startTime: parsed.startTime,
      platform: parsed.platform,
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
            <span>
              {mode === 'edit'
                ? 'Edit Video Lesson'
                : mode === 'create'
                ? 'New Video Lesson'
                : 'Add Video Lesson'}
            </span>
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
            {mode === 'edit' && (
              <p style={{ margin: '0 0 12px', fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                Change the video link or lesson name. Your existing practice and study notes will be safely preserved.
              </p>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="video-url-input" className={styles.fieldLabel}>
                {mode === 'edit' ? 'Video link' : 'Paste video link'}
              </label>
              <input
                id="video-url-input"
                type="text"
                className={styles.textInput}
                placeholder="YouTube, TikTok, Instagram, X (Twitter), Facebook, Telegram, or MP4..."
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
                    <div className={styles.previewBadgeIcon}>
                      <Check size={12} />
                    </div>
                    <div className={styles.previewBadgeContent}>
                      <span className={styles.previewBadgePlatform}>
                        {parsed.platformName} detected
                      </span>
                      <span className={styles.previewBadgeDetail}>
                        {parsed.originalUrl}
                        {parsed.startTime > 0 ? ` (starts at ${parsed.startTime}s)` : ''}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={styles.errorBadge}>
                    <AlertCircle size={13} />
                    <span>Please enter a valid link from YouTube, TikTok, Instagram, X, Facebook, Telegram, or direct video.</span>
                  </div>
                )}
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="lesson-title-input" className={styles.fieldLabel}>
                Lesson Name {mode === 'create' || mode === 'edit' ? '' : '(optional)'}
              </label>
              <input
                id="lesson-title-input"
                type="text"
                className={styles.textInput}
                placeholder="e.g. Panaginip - Fingerstyle Guitar (Tabs & Chords)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {parsed?.titleHint && title !== parsed.titleHint && (
                <button
                  type="button"
                  onClick={() => setTitle(parsed.titleHint || '')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-accent-light, #818cf8)',
                    fontSize: '0.72rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 0',
                  }}
                >
                  <Sparkles size={11} />
                  <span>Use suggested: &ldquo;{parsed.titleHint}&rdquo;</span>
                </button>
              )}
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
              {mode === 'edit'
                ? 'Save Changes'
                : mode === 'create'
                ? 'Create Video Lesson'
                : 'Add Video'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
