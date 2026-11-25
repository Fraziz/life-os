'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, X, Check, Globe, BookMarked } from 'lucide-react';
import styles from './AddManhwaModal.module.css';
import { parseManhwaUrl, type ParsedManhwaInfo } from '@/utils/manhwa';
import type { DocumentReadStatus } from '@/types';

interface AddManhwaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (data: {
    title: string;
    manhwaUrl: string;
    author: string;
    currentChapter: string;
    latestChapter?: string;
    coverImageUrl?: string;
    readStatus: DocumentReadStatus;
  }) => void;
  initialUrl?: string;
  initialTitle?: string;
  initialChapter?: string;
  initialTotalChapters?: string;
  initialAuthor?: string;
  initialStatus?: DocumentReadStatus;
  mode?: 'create' | 'edit';
}

export default function AddManhwaModal({
  isOpen,
  onClose,
  onInsert,
  initialUrl = '',
  initialTitle = '',
  initialChapter = 'Chapter 1',
  initialTotalChapters = '',
  initialAuthor = '',
  initialStatus = 'reading',
  mode = 'create',
}: AddManhwaModalProps) {
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState(initialTitle);
  const [chapter, setChapter] = useState(initialChapter);
  const [latestChapter, setLatestChapter] = useState(initialTotalChapters);
  const [author, setAuthor] = useState(initialAuthor);
  const [readStatus, setReadStatus] = useState<DocumentReadStatus>(initialStatus);
  const [parsed, setParsed] = useState<ParsedManhwaInfo | null>(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  useEffect(() => {
    setUrl(initialUrl);
    setTitle(initialTitle);
    setChapter(initialChapter || 'Chapter 1');
    setLatestChapter(initialTotalChapters || '');
    setAuthor(initialAuthor || '');
    setReadStatus(initialStatus || 'reading');
    if (initialUrl) {
      setParsed(parseManhwaUrl(initialUrl));
    } else {
      setParsed(null);
    }
  }, [initialUrl, initialTitle, initialChapter, initialTotalChapters, initialAuthor, initialStatus, isOpen]);

  const handleUrlChange = async (val: string) => {
    setUrl(val);
    const res = parseManhwaUrl(val);
    setParsed(res);

    if (res) {
      if (!title.trim() || title === 'Manhwa' || title === 'New Manhwa') {
        setTitle(res.titleHint);
      }
      if (res.chapterHint && (!chapter.trim() || chapter === 'Chapter 1')) {
        setChapter(res.chapterHint);
      }
      if (res.siteName && !author.trim()) {
        setAuthor(res.siteName);
      }

      // Try fetching rich link preview for cover image / title
      try {
        setIsLoadingMetadata(true);
        const previewRes = await fetch(`/api/link-preview?url=${encodeURIComponent(res.url)}`);
        if (previewRes.ok) {
          const previewData = await previewRes.json();
          if (previewData.title && (!title.trim() || title === res.titleHint)) {
            // Remove common website suffixes e.g. " - Asura Scans"
            const cleanedTitle = previewData.title.split(/ - | \| | – /)[0].trim();
            if (cleanedTitle) setTitle(cleanedTitle);
          }
          if (previewData.image && !coverUrl) {
            setCoverUrl(previewData.image);
          }
          if (previewData.siteName && !author) {
            setAuthor(previewData.siteName);
          }
        }
      } catch {
        // Non-fatal preview fallback
      } finally {
        setIsLoadingMetadata(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const finalTitle = title.trim() || parsed?.titleHint || 'Manhwa Reading';
    const finalAuthor = author.trim() || parsed?.siteName || 'Webtoon';
    const finalChapter = chapter.trim() || 'Chapter 1';

    onInsert({
      title: finalTitle,
      manhwaUrl: url.trim(),
      author: finalAuthor,
      currentChapter: finalChapter,
      latestChapter: latestChapter.trim() || undefined,
      coverImageUrl: coverUrl.trim() || undefined,
      readStatus,
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
        aria-labelledby="manhwa-modal-title"
      >
        <div className={styles.modalHeader}>
          <h3 id="manhwa-modal-title" className={styles.modalTitle}>
            <BookMarked size={16} />
            <span>{mode === 'edit' ? 'Edit Manhwa Reading' : 'Add Manhwa to Web Reader'}</span>
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
              <label htmlFor="manhwa-url-input" className={styles.fieldLabel}>
                <span>Paste Manhwa Website Link</span>
                {isLoadingMetadata && <span style={{ fontSize: '11px', color: 'var(--color-accent)' }}>Detecting metadata...</span>}
              </label>
              <input
                id="manhwa-url-input"
                type="url"
                required
                className={styles.inputField}
                placeholder="e.g. https://asuracomic.net/series/..., https://roliascan.com/..., https://vortexscans.org/..."
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                autoFocus
              />
            </div>

            {parsed && (
              <div className={styles.previewPill}>
                <Globe size={13} />
                <span>Detected source:</span>
                <span className={styles.siteTag}>{parsed.siteName}</span>
                {parsed.chapterHint && <span>• {parsed.chapterHint}</span>}
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="manhwa-title-input" className={styles.fieldLabel}>
                Manhwa / Webtoon Title
              </label>
              <input
                id="manhwa-title-input"
                type="text"
                required
                className={styles.inputField}
                placeholder="e.g. Return of the Mount Hua Sect, Solo Leveling"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className={styles.inputRow}>
              <div className={styles.formGroup}>
                <label htmlFor="manhwa-chapter-input" className={styles.fieldLabel}>
                  Current Chapter
                </label>
                <input
                  id="manhwa-chapter-input"
                  type="text"
                  className={styles.inputField}
                  placeholder="e.g. Chapter 45"
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="manhwa-total-input" className={styles.fieldLabel}>
                  Total / Latest Chapter (Optional)
                </label>
                <input
                  id="manhwa-total-input"
                  type="text"
                  className={styles.inputField}
                  placeholder="e.g. Chapter 140"
                  value={latestChapter}
                  onChange={(e) => setLatestChapter(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.inputRow}>
              <div className={styles.formGroup}>
                <label htmlFor="manhwa-source-input" className={styles.fieldLabel}>
                  Scanlation Site / Group
                </label>
                <input
                  id="manhwa-source-input"
                  type="text"
                  className={styles.inputField}
                  placeholder="e.g. Asura Scans, RoliaScan, Vortex Scans"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="manhwa-status-select" className={styles.fieldLabel}>
                  Reading Status
                </label>
                <select
                  id="manhwa-status-select"
                  className={styles.selectField}
                  value={readStatus}
                  onChange={(e) => setReadStatus(e.target.value as DocumentReadStatus)}
                >
                  <option value="reading">Currently Reading</option>
                  <option value="to-read">Plan to Read</option>
                  <option value="completed">Completed / Caught Up</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={!url.trim()}
            >
              <Check size={14} />
              <span>{mode === 'edit' ? 'Save Changes' : 'Open in Web Reader'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
