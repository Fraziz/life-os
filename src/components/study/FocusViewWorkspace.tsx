'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  Maximize2,
  Minimize2,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  Save,
  Check,
  Bell,
} from 'lucide-react';
import styles from './FocusViewWorkspace.module.css';
import YouTubePlayer from './YouTubePlayer';
import StudySessionCard from './StudySessionCard';
import { useStudySession } from '@/context/StudySessionContext';
import { useKnowledge } from '@/context/KnowledgeContext';

interface FocusViewWorkspaceProps {
  videoId: string;
  url?: string;
  lessonTitle: string;
  startTime?: number;
  bookId?: string;
  bookTitle?: string;
  onClose: () => void;
  onOpenReadingLogs?: () => void;
}

export default function FocusViewWorkspace({
  videoId,
  url,
  lessonTitle,
  startTime = 0,
  bookId,
  bookTitle,
  onClose,
  onOpenReadingLogs,
}: FocusViewWorkspaceProps) {
  const { setAssociatedBook, setAssociatedLesson } = useStudySession();
  const { docs, updateDoc, toggleDocReminder } = useKnowledge();
  const targetDoc = bookId ? docs.find((d) => d.id === bookId) : null;

  const workspaceRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);
  const [lessonNotes, setLessonNotes] = useState('');
  const [notesSavedToast, setNotesSavedToast] = useState(false);

  // Sync associated lesson & book with the shared timer
  useEffect(() => {
    if (bookId || bookTitle) {
      setAssociatedBook(bookId || null, bookTitle || null);
    }
    setAssociatedLesson(lessonTitle, videoId);
  }, [bookId, bookTitle, lessonTitle, videoId, setAssociatedBook, setAssociatedLesson]);

  // Handle Fullscreen state changes (e.g. user pressed F11 or Esc in browser)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard Escape listener to exit Focus View or browser fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        if (workspaceRef.current) {
          await workspaceRef.current.requestFullscreen();
        }
      } catch (err) {
        console.error('Fullscreen request error:', err);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    }
  };

  const handleSaveNotesToBook = () => {
    if (!lessonNotes.trim()) return;

    if (bookId) {
      const targetDoc = docs.find((d) => d.id === bookId);
      if (targetDoc) {
        const timestampHeader = `\n\n### 📝 Practice Notes — ${new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}\n**Lesson:** ${lessonTitle}\n\n`;

        const updatedContent = (targetDoc.content || '') + timestampHeader + lessonNotes.trim() + '\n';
        updateDoc(bookId, { content: updatedContent });

        setNotesSavedToast(true);
        setTimeout(() => setNotesSavedToast(false), 3000);
        return;
      }
    }

    const videoDoc = docs.find((d) => (d.content || '').includes(videoId));
    if (videoDoc) {
      const timestampHeader = `\n\n### 📝 Study Notes — ${new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}\n\n`;
      const updatedContent = (videoDoc.content || '') + timestampHeader + lessonNotes.trim() + '\n';
      updateDoc(videoDoc.id, { content: updatedContent });
      setNotesSavedToast(true);
      setTimeout(() => setNotesSavedToast(false), 3000);
      return;
    }

    setNotesSavedToast(true);
    setTimeout(() => setNotesSavedToast(false), 2500);
  };

  return (
    <div ref={workspaceRef} className={styles.workspaceOverlay}>
      {/* 1. Header Bar with Back, Title, and Actions */}
      <header className={styles.workspaceTopBar}>
        <div className={styles.topBarLeft}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={onClose}
            title="Return to Knowledge Library"
          >
            <ChevronLeft size={16} />
            <span>Library</span>
          </button>
          <div className={styles.topBarDivider} />
          <div className={styles.topBarTitleGroup}>
            <span className={styles.lessonBadge}>Video Lesson</span>
            <h1 className={styles.topBarTitle}>{lessonTitle}</h1>
            {bookTitle && (
              <span className={styles.associatedBookPill} title={`Linked to book: ${bookTitle}`}>
                📖 {bookTitle}
              </span>
            )}
          </div>
        </div>

        <div className={styles.topBarRight}>
          {targetDoc && (
            <button
              type="button"
              className={styles.topBarActionBtn}
              onClick={() => toggleDocReminder(targetDoc.id)}
              title={targetDoc.isReminder ? "Remove reminder (clears from Today)" : "Set Reminder (Show on Today)"}
              style={targetDoc.isReminder ? { color: 'var(--color-warning, #f59e0b)', borderColor: 'rgba(245, 158, 11, 0.4)' } : undefined}
            >
              <Bell size={14} style={targetDoc.isReminder ? { color: 'var(--color-warning, #f59e0b)' } : undefined} />
              <span>Reminder</span>
            </button>
          )}

          <button
            type="button"
            className={styles.topBarActionBtn}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (Distraction-Free)'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>

          <button
            type="button"
            className={`${styles.topBarActionBtn} ${styles.exitBtn}`}
            onClick={onClose}
            title="Exit Focus View (Esc)"
          >
            <X size={15} />
            <span>Exit</span>
            <span className={styles.escHint}>ESC</span>
          </button>
        </div>
      </header>

      {/* 2. Workspace Body: Left Large Video + Right Study Timer */}
      <div className={styles.workspaceBody}>
        {/* Left Column: Video & Collapsible Notes */}
        <main className={styles.mainVideoColumn}>
          <div className={styles.videoContainer}>
            <YouTubePlayer
              videoId={videoId}
              url={url}
              startTime={startTime}
              title={lessonTitle}
            />
          </div>

          {/* Collapsible Lesson Notes Area */}
          <div className={styles.notesContainer}>
            <button
              type="button"
              className={styles.notesHeader}
              onClick={() => setNotesOpen(!notesOpen)}
              aria-expanded={notesOpen}
            >
              <div className={styles.notesHeaderLeft}>
                <FileText size={14} style={{ color: 'var(--color-accent-light)' }} />
                <span>Lesson Notes &amp; Thoughts</span>
                <span className={styles.notesBadge}>Optional</span>
              </div>
              <div className={styles.notesHeaderRight}>
                {notesSavedToast && (
                  <span className={styles.saveNotesToast}>
                    <Check size={12} style={{ display: 'inline', marginRight: 3 }} />
                    Appended to book!
                  </span>
                )}
                {notesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {notesOpen && (
              <div className={styles.notesBody}>
                <textarea
                  className={styles.notesTextarea}
                  placeholder="Jot down chords, key ideas, timestamps, or practice goals while watching..."
                  value={lessonNotes}
                  onChange={(e) => setLessonNotes(e.target.value)}
                />
                <div className={styles.notesActionsRow}>
                  <button
                    type="button"
                    className={styles.saveNotesBtn}
                    onClick={handleSaveNotesToBook}
                    disabled={!lessonNotes.trim()}
                    title="Append these notes into the active book document"
                  >
                    <Save size={12} />
                    <span>Append to Book</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Column: Persistent Study Session Panel */}
        <aside className={styles.studySidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>Study Session</span>
          </div>

          <StudySessionCard onOpenReadingLogs={onOpenReadingLogs} />
        </aside>
      </div>
    </div>
  );
}
