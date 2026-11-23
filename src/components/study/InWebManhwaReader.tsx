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
  Info,
  CheckCircle2,
  FileText,
  ShieldCheck,
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
  const [readerEngine, setReaderEngine] = useState<'proxy' | 'direct'>('proxy');

  const manhwaUrl = (doc.manhwaUrl || '').trim();
  const parsedMeta = parseManhwaUrl(manhwaUrl);
  const siteName = doc.author || parsedMeta?.siteName || 'Web Reader';
  const currentChapter = doc.currentChapter || parsedMeta?.chapterHint || 'Chapter 1';

  // Compute iframe source: default to server proxy to bypass X-Frame-Options: SAMEORIGIN
  const frameSrc = manhwaUrl
    ? readerEngine === 'proxy'
      ? `/api/manhwa/proxy?url=${encodeURIComponent(manhwaUrl)}`
      : manhwaUrl
    : '';

  const handleReload = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleOpenPopout = () => {
    if (!manhwaUrl) return;
    window.open(
      manhwaUrl,
      'LifeOSManhwaReader',
      'width=1100,height=920,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes'
    );
  };

  const handlePrevChapter = () => {
    const res = shiftChapterUrl(manhwaUrl, -1);
    if (res) {
      onUpdateDoc(doc.id, {
        manhwaUrl: res.nextUrl,
        currentChapter: res.nextChapter,
      });
      setIframeKey((prev) => prev + 1);
    } else {
      // Fallback: decrement numeric chapter
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

  const handleNextChapter = () => {
    const res = shiftChapterUrl(manhwaUrl, 1);
    if (res) {
      onUpdateDoc(doc.id, {
        manhwaUrl: res.nextUrl,
        currentChapter: res.nextChapter,
        readStatus: 'reading',
      });
      setIframeKey((prev) => prev + 1);
    } else {
      // Fallback: increment numeric chapter
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
            onClick={handlePrevChapter}
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
            onClick={handleNextChapter}
            title="Next Chapter"
            aria-label="Next Chapter"
          >
            <span>Next Ch</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Action Controls */}
        <div className={styles.actionControls}>
          {/* Reader Engine Switcher */}
          <button
            type="button"
            className={styles.engineBadge}
            onClick={() => setReaderEngine(readerEngine === 'proxy' ? 'direct' : 'proxy')}
            title={`Current Engine: ${readerEngine === 'proxy' ? 'In-App Proxy (Bypassing X-Frame restrictions)' : 'Direct Embed'}. Click to toggle.`}
            aria-label="Toggle reader engine"
          >
            <span className={readerEngine === 'proxy' ? styles.engineDotActive : styles.engineDotDirect} />
            <span>{readerEngine === 'proxy' ? 'Proxy Active' : 'Direct Mode'}</span>
          </button>

          {/* Dedicated Pop-out Focused Window Button (100% immune to X-Frame restrictions) */}
          <button
            type="button"
            className={`${styles.controlBtn} ${styles.controlBtnPrimary}`}
            onClick={handleOpenPopout}
            title="Open in dedicated pop-out window (Bypasses all frame restrictions & Cloudflare gates)"
            aria-label="Pop-out reader window"
          >
            <ExternalLink size={13} />
            <span>Pop-out ⧉</span>
          </button>

          {/* Like Button */}
          <button
            type="button"
            className={`${styles.controlBtn} ${doc.isLiked ? styles.controlBtnLikeActive : ''}`}
            onClick={() => onToggleLike(doc.id)}
            title={doc.isLiked ? 'Unlike manhwa' : 'Like manhwa'}
            aria-label={doc.isLiked ? 'Unlike manhwa' : 'Like manhwa'}
          >
            <Heart
              size={14}
              fill={doc.isLiked ? 'currentColor' : 'none'}
              color={doc.isLiked ? '#ef4444' : 'currentColor'}
            />
            <span>{doc.isLiked ? 'Liked' : 'Like'}</span>
          </button>

          {/* Reload Frame */}
          <button
            type="button"
            className={styles.controlBtn}
            onClick={handleReload}
            title="Reload web reader"
            aria-label="Reload web reader"
          >
            <RotateCcw size={13} />
          </button>

          {/* Open Direct on Provider Site in New Tab */}
          {manhwaUrl && (
            <a
              href={manhwaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.controlBtn}
              title="Open full page on provider site in new tab"
            >
              <ExternalLink size={13} />
              <span>Open on Site ↗</span>
            </a>
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

          {/* Zen Mode Toggle */}
          <button
            type="button"
            className={styles.controlBtn}
            onClick={() => setIsZenMode(!isZenMode)}
            title={isZenMode ? 'Exit Zen Mode' : 'Zen Full Width Mode'}
            aria-label={isZenMode ? 'Exit Zen Mode' : 'Zen Full Width Mode'}
          >
            {isZenMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Embedded Web Reader Canvas */}
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

      {/* Reader Assistive Footer Banner */}
      <div className={styles.readerFooterBanner}>
        <div className={styles.readerFooterLeft}>
          <ShieldCheck size={14} color="#10b981" />
          <span>
            {readerEngine === 'proxy' ? (
              <>
                In-App Proxy active for <strong>{siteName}</strong>. If a scan site requires Cloudflare human verification, tap{' '}
                <button
                  type="button"
                  onClick={handleOpenPopout}
                  className={styles.footerActionLink}
                >
                  Pop-out ⧉
                </button>{' '}
                to read in a dedicated window while Life OS tracks your progress.
              </>
            ) : (
              <>
                Direct mode active. If you encounter a &quot;refused to connect&quot; message, switch back to{' '}
                <button
                  type="button"
                  onClick={() => setReaderEngine('proxy')}
                  className={styles.footerActionLink}
                >
                  Proxy Mode
                </button>.
              </>
            )}
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
