'use client';

import React, { useState } from 'react';
import {
  Heart,
  ExternalLink,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Edit2,
  CheckCircle2,
  FileText,
  Globe,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import styles from './InWebManhwaReader.module.css';
import type { KnowledgeDocument, DocumentReadStatus } from '@/types';
import { shiftChapterUrl, parseManhwaUrl } from '@/utils/manhwa';

interface InWebManhwaReaderProps {
  doc: KnowledgeDocument;
  onUpdateDoc: (id: string, updates: Partial<KnowledgeDocument>) => void;
  onToggleLike: (id: string) => void;
  onClose?: () => void;
  onOpenEditModal?: () => void;
}

export default function InWebManhwaReader({
  doc,
  onUpdateDoc,
  onToggleLike,
  onClose,
  onOpenEditModal,
}: InWebManhwaReaderProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState(doc.content || '');
  const [viewMode, setViewMode] = useState<'hub' | 'embed'>('hub');
  const [readerEngine, setReaderEngine] = useState<'proxy' | 'direct'>('proxy');

  const manhwaUrl = (doc.manhwaUrl || '').trim();
  const parsedMeta = parseManhwaUrl(manhwaUrl);
  const siteName = doc.author || parsedMeta?.siteName || 'Web Reader';
  const currentChapter = doc.currentChapter || parsedMeta?.chapterHint || 'Chapter 1';

  // Compute iframe source: default to server proxy
  const frameSrc = manhwaUrl
    ? readerEngine === 'proxy'
      ? `/api/manhwa/proxy?url=${encodeURIComponent(manhwaUrl)}`
      : manhwaUrl
    : '';

  const handleReload = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleOpenDirect = () => {
    if (manhwaUrl) {
      window.open(manhwaUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handlePrevChapter = (openTab = false) => {
    const res = shiftChapterUrl(manhwaUrl, -1);
    if (res) {
      onUpdateDoc(doc.id, {
        manhwaUrl: res.nextUrl,
        currentChapter: res.nextChapter,
      });
      setIframeKey((prev) => prev + 1);
      if (openTab) {
        window.open(res.nextUrl, '_blank', 'noopener,noreferrer');
      }
    } else {
      const numMatch = currentChapter.match(/\d+/);
      if (numMatch) {
        const nextNum = Math.max(1, parseInt(numMatch[0], 10) - 1);
        onUpdateDoc(doc.id, {
          currentChapter: `Chapter ${nextNum}`,
        });
        setIframeKey((prev) => prev + 1);
      }
    }
  };

  const handleNextChapter = (openTab = false) => {
    const res = shiftChapterUrl(manhwaUrl, 1);
    if (res) {
      onUpdateDoc(doc.id, {
        manhwaUrl: res.nextUrl,
        currentChapter: res.nextChapter,
        readStatus: 'reading',
      });
      setIframeKey((prev) => prev + 1);
      if (openTab) {
        window.open(res.nextUrl, '_blank', 'noopener,noreferrer');
      }
    } else {
      const numMatch = currentChapter.match(/\d+/);
      if (numMatch) {
        const nextNum = parseInt(numMatch[0], 10) + 1;
        onUpdateDoc(doc.id, {
          currentChapter: `Chapter ${nextNum}`,
          readStatus: 'reading',
        });
        setIframeKey((prev) => prev + 1);
      }
    }
  };

  const handleStatusChange = (status: DocumentReadStatus) => {
    onUpdateDoc(doc.id, { readStatus: status });
  };

  const handleSaveNotes = () => {
    onUpdateDoc(doc.id, { content: notesText });
  };

  return (
    <div className={`${styles.readerContainer} ${isZenMode ? styles.zenMode : ''}`}>
      {/* Top Reading Header & Controls */}
      <div className={styles.readerTopBar}>
        <div className={styles.titleArea}>
          {onClose && (
            <button
              type="button"
              className={styles.controlBtn}
              onClick={onClose}
              title="Back to library"
              aria-label="Back to library"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <span className={styles.manhwaTitle} title={doc.title}>
            {doc.title}
          </span>
          <span className={styles.siteBadge}>{siteName}</span>
        </div>

        {/* Chapter Stepper Navigation */}
        <div className={styles.navControls}>
          <button
            type="button"
            className={styles.chapterBtn}
            onClick={() => handlePrevChapter(false)}
            title="Previous Chapter"
            aria-label="Previous Chapter"
          >
            <ChevronLeft size={14} />
            <span>Prev Ch</span>
          </button>

          <span className={styles.chapterBadge} title="Current Chapter">
            {currentChapter}
            {doc.latestChapter ? ` / ${doc.latestChapter}` : ''}
          </span>

          <button
            type="button"
            className={styles.chapterBtn}
            onClick={() => handleNextChapter(false)}
            title="Next Chapter"
            aria-label="Next Chapter"
          >
            <span>Next Ch</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Action Controls */}
        <div className={styles.actionControls}>
          {/* Direct Web Link Button */}
          {manhwaUrl && (
            <button
              type="button"
              className={`${styles.controlBtn} ${styles.controlBtnPrimary}`}
              onClick={handleOpenDirect}
              title="Open chapter directly in web browser"
            >
              <ExternalLink size={13} />
              <span>Open on Web ↗</span>
            </button>
          )}

          {/* View Mode Toggle: Direct Web vs Embedded Frame */}
          <button
            type="button"
            className={styles.engineBadge}
            onClick={() => setViewMode(viewMode === 'hub' ? 'embed' : 'hub')}
            title={`Current View: ${viewMode === 'hub' ? 'Fast Web Launcher' : 'In-Page Embed'}. Click to toggle.`}
            aria-label="Toggle reader view mode"
          >
            <span className={viewMode === 'hub' ? styles.engineDotActive : styles.engineDotDirect} />
            <span>{viewMode === 'hub' ? 'Web Link' : 'In-Page Frame'}</span>
          </button>

          {/* Like Button */}
          <button
            type="button"
            className={`${styles.controlBtn} ${doc.isLiked ? styles.controlBtnLikeActive : ''}`}
            onClick={() => onToggleLike(doc.id)}
            title={doc.isLiked ? 'Unlike' : 'Like'}
            aria-label={doc.isLiked ? 'Unlike' : 'Like'}
          >
            <Heart
              size={14}
              fill={doc.isLiked ? 'currentColor' : 'none'}
              color={doc.isLiked ? '#ef4444' : 'currentColor'}
            />
            <span>{doc.isLiked ? 'Liked' : 'Like'}</span>
          </button>

          {/* Reload (in embed mode) */}
          {viewMode === 'embed' && (
            <button
              type="button"
              className={styles.controlBtn}
              onClick={handleReload}
              title="Reload frame"
              aria-label="Reload frame"
            >
              <RotateCcw size={13} />
            </button>
          )}

          {/* Edit Manhwa details */}
          {onOpenEditModal && (
            <button
              type="button"
              className={styles.controlBtn}
              onClick={onOpenEditModal}
              title="Edit manhwa details & URL"
              aria-label="Edit manhwa"
            >
              <Edit2 size={13} />
            </button>
          )}

          {/* Zen Full-Canvas Mode Toggle */}
          <button
            type="button"
            className={styles.controlBtn}
            onClick={() => setIsZenMode(!isZenMode)}
            title={isZenMode ? 'Exit Zen Mode' : 'Zen Full Canvas'}
            aria-label={isZenMode ? 'Exit Zen Mode' : 'Zen Full Canvas'}
          >
            {isZenMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      {viewMode === 'hub' ? (
        /* ── Fast & Direct Web Launcher Hub ── */
        <div className={styles.webLauncherHub}>
          <div className={styles.webLauncherCard}>
            <div className={styles.hubHeader}>
              <div className={styles.hubCoverWrap}>
                {doc.coverImageUrl ? (
                  <img src={doc.coverImageUrl} alt={doc.title} className={styles.hubCoverImg} />
                ) : (
                  <div className={styles.hubCoverPlaceholder}>
                    <BookOpen size={36} color="var(--color-accent)" opacity={0.7} />
                  </div>
                )}
              </div>

              <div className={styles.hubDetails}>
                <div className={styles.hubMetaRow}>
                  <span className={styles.siteBadge}>{siteName}</span>
                  <span className={styles.chapterBadge}>{currentChapter}</span>
                  {doc.readStatus === 'completed' ? (
                    <span className={styles.statusCompletedBadge}>Finished</span>
                  ) : (
                    <span className={styles.statusReadingBadge}>Reading</span>
                  )}
                </div>

                <h2 className={styles.hubTitle}>{doc.title}</h2>

                {manhwaUrl ? (
                  <a
                    href={manhwaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.hubUrlText}
                    title={manhwaUrl}
                  >
                    <Globe size={12} />
                    <span>{manhwaUrl}</span>
                  </a>
                ) : (
                  <p className={styles.hubUrlMissing}>No URL configured. Tap Edit to add your link.</p>
                )}

                {/* Primary Direct Launch Button */}
                <div className={styles.hubActionRow}>
                  {manhwaUrl && (
                    <button
                      type="button"
                      className={styles.hubPrimaryBtn}
                      onClick={handleOpenDirect}
                    >
                      <ExternalLink size={15} />
                      <span>Open {currentChapter} on {siteName} ↗</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className={styles.hubSecondaryBtn}
                    onClick={() => handleNextChapter(true)}
                    title="Advance to next chapter and open in web"
                  >
                    <span>Next Chapter &amp; Open</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick helper banner */}
            <div className={styles.hubHintBar}>
              <span>
                Clicking <strong>Open on Web ↗</strong> launches directly to the chapter in a clean tab with zero bot challenges or loading issues.
              </span>
              <button
                type="button"
                className={styles.embedSwitchBtn}
                onClick={() => setViewMode('embed')}
              >
                Switch to In-Page Frame
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Embedded Frame Canvas ── */
        <div className={styles.iframeWrapper}>
          {manhwaUrl ? (
            <iframe
              key={`${readerEngine}-${iframeKey}`}
              src={frameSrc}
              title={doc.title}
              className={styles.manhwaIframe}
              loading="eager"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            />
          ) : (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <p style={{ margin: 0 }}>No reading URL configured. Please add a website link.</p>
            </div>
          )}
        </div>
      )}

      {/* Reader Assistive Footer Banner */}
      <div className={styles.readerFooterBanner}>
        <div className={styles.readerFooterLeft}>
          <Globe size={14} color="#10b981" />
          <span>
            Reading on <strong>{siteName}</strong> · Bookmark tracked in Life OS
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={() => setIsNotesOpen(!isNotesOpen)}
          >
            <FileText size={12} />
            <span>{isNotesOpen ? 'Hide Notes' : 'Reader Notes'}</span>
          </button>

          <button
            type="button"
            className={styles.chapterBtn}
            onClick={() => handleStatusChange(doc.readStatus === 'completed' ? 'reading' : 'completed')}
            style={doc.readStatus === 'completed' ? { color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' } : undefined}
          >
            <CheckCircle2 size={13} />
            <span>{doc.readStatus === 'completed' ? 'Finished' : 'Mark Finished'}</span>
          </button>
        </div>
      </div>

      {/* Reader Notes Drawer */}
      {isNotesOpen && (
        <div className={styles.notesDrawer}>
          <div className={styles.notesHeader}>
            <span>Reading Notes &amp; Thoughts</span>
            <button
              type="button"
              className={styles.chapterBtn}
              onClick={handleSaveNotes}
              style={{ padding: '4px 8px', minHeight: '32px' }}
            >
              Save Notes
            </button>
          </div>
          <textarea
            className={styles.notesTextarea}
            placeholder="Jot down plot points, character names, or chapter highlights while reading..."
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
