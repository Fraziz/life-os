'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FilePlus, FolderUp, Image as ImageIcon, Paperclip, Trash2, Video, X, FileText, FolderOpen } from 'lucide-react';
import { useAttachments } from '@/context/AttachmentContext';
import type { FileEntityType, LifeFile } from '@/types';
import styles from './EntityFiles.module.css';

interface EntityFilesProps {
  entityType: FileEntityType;
  entityId: string;
  title: string;
  variant?: 'strip' | 'icon' | 'button';
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function Preview({ file }: { file: LifeFile }) {
  if (file.kind === 'image') {
    return <img src={file.downloadUrl} alt={file.name} className={styles.preview} />;
  }
  if (file.kind === 'video') {
    return <video src={file.downloadUrl} className={styles.preview} muted playsInline />;
  }
  return (
    <div className={styles.previewIcon}>
      <FileText size={32} />
    </div>
  );
}

export function FilesDrawer({
  entityType,
  entityId,
  title,
  onClose,
}: {
  entityType: FileEntityType;
  entityId: string;
  title: string;
  onClose: () => void;
}) {
  const { filesFor, uploadFiles, deleteFile, uploads, error } = useAttachments();
  const files = filesFor(entityType, entityId);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState('All');
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = folderRef.current;
    if (!el) return;
    el.setAttribute('webkitdirectory', '');
    el.setAttribute('directory', '');
  }, []);

  const folders = useMemo(() => {
    const set = new Set(files.map((f) => f.folder || 'General'));
    return ['All', ...Array.from(set)];
  }, [files]);

  const visible = folder === 'All' ? files : files.filter((f) => f.folder === folder);

  const handleFiles = async (list: FileList | File[] | null, nextFolder?: string) => {
    if (!list || (list as FileList).length === 0) return;
    await uploadFiles({
      files: list,
      entityType,
      entityId,
      entityTitle: title,
      folder: nextFolder || (folder === 'All' ? 'General' : folder),
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.drawer}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Files for ${title}`}
      >
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Files</h2>
            <p className={styles.subtitle}>
              {title} — add photos, videos, documents, or a whole folder. Same files on phone and computer.
            </p>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close files">
            <X size={20} />
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button className={styles.bigBtn} type="button" onClick={() => photoRef.current?.click()}>
            <ImageIcon size={18} /> Photos
          </button>
          <button className={styles.bigBtn} type="button" onClick={() => videoRef.current?.click()}>
            <Video size={18} /> Videos
          </button>
          <button className={styles.bigBtn} type="button" onClick={() => fileRef.current?.click()}>
            <FilePlus size={18} /> Documents
          </button>
          <button className={styles.bigBtn} type="button" onClick={() => folderRef.current?.click()}>
            <FolderUp size={18} /> Whole folder
          </button>
        </div>

        <input ref={photoRef} className={styles.hidden} type="file" accept="image/*" multiple onChange={(e) => void handleFiles(e.target.files)} />
        <input ref={videoRef} className={styles.hidden} type="file" accept="video/*" multiple onChange={(e) => void handleFiles(e.target.files)} />
        <input ref={fileRef} className={styles.hidden} type="file" multiple onChange={(e) => void handleFiles(e.target.files)} />
        <input
          ref={folderRef}
          className={styles.hidden}
          type="file"
          multiple
          onChange={(e) => void handleFiles(e.target.files)}
        />

        <div
          className={`${styles.drop} ${dragging ? styles.dropActive : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFiles(e.dataTransfer.files);
          }}
        >
          Drop files here — or use the big buttons above.
        </div>

        {Object.entries(uploads).map(([name, pct]) => (
          <div key={name} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
              Saving {name}… {pct}%
            </div>
            <div className={styles.progress}>
              <div className={styles.progressFill} style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}

        {folders.length > 1 && (
          <div className={styles.folderRow}>
            {folders.map((name) => (
              <button
                key={name}
                type="button"
                className={`${styles.chip} ${folder === name ? styles.chipOn : ''}`}
                onClick={() => setFolder(name)}
              >
                <FolderOpen size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {name}
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <div className={styles.empty}>Nothing here yet. Add one file. That is enough.</div>
        ) : (
          <div className={styles.grid}>
            {visible.map((file) => (
              <article key={file.id} className={styles.card}>
                <Preview file={file} />
                <div className={styles.meta}>
                  <div className={styles.name} title={file.name}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>
                    {file.folder} · {formatSize(file.size)}
                  </div>
                  <div className={styles.rowBtns}>
                    <button
                      type="button"
                      className={`${styles.smallBtn} ${styles.openBtn}`}
                      onClick={() => window.open(file.downloadUrl, '_blank', 'noopener,noreferrer')}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className={`${styles.smallBtn} ${styles.deleteBtn}`}
                      onClick={() => {
                        if (confirm(`Delete "${file.name}" from all your devices?`)) {
                          void deleteFile(file);
                        }
                      }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EntityFiles({ entityType, entityId, title, variant = 'strip' }: EntityFilesProps) {
  const { filesFor } = useAttachments();
  const [open, setOpen] = useState(false);
  const files = filesFor(entityType, entityId);
  const thumbs = files.filter((f) => f.kind === 'image' || f.kind === 'video').slice(0, 4);

  return (
    <>
      {variant === 'icon' && (
        <button
          type="button"
          className={styles.iconTrigger}
          onClick={() => setOpen(true)}
          title="Files"
          aria-label={`Files for ${title}`}
        >
          <Paperclip size={15} />
          {files.length > 0 && <span className={styles.dot} />}
        </button>
      )}

      {variant === 'button' && (
        <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
          <Paperclip size={16} />
          Files
          {files.length > 0 && <span className={styles.count}>{files.length}</span>}
        </button>
      )}

      {variant === 'strip' && (
        <div className={styles.strip}>
          {thumbs.map((file) =>
            file.kind === 'image' ? (
              <img key={file.id} src={file.downloadUrl} alt="" className={styles.thumb} />
            ) : (
              <div key={file.id} className={styles.thumbFallback}>
                <Video size={18} />
              </div>
            )
          )}
          <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
            <Paperclip size={16} />
            {files.length === 0 ? 'Add files' : `${files.length} files`}
          </button>
        </div>
      )}

      {open && (
        <FilesDrawer
          entityType={entityType}
          entityId={entityId}
          title={title}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
