'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FilePlus,
  FolderUp,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Video,
  X,
  FileText,
  FolderOpen,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Eye,
} from 'lucide-react';
import { useAttachments } from '@/context/AttachmentContext';
import type { FileEntityType, LifeFile } from '@/types';
import styles from './EntityFiles.module.css';

interface EntityFilesProps {
  entityType: FileEntityType;
  entityId: string;
  title: string;
  variant?: 'strip' | 'icon' | 'button';
  className?: string;
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getBlobFromDataUrl(dataUrl: string, fallbackMime?: string): Blob {
  const parts = dataUrl.split(',');
  if (parts.length < 2) {
    return new Blob([], { type: fallbackMime || 'application/octet-stream' });
  }
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : fallbackMime || 'application/octet-stream';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

function saveBlobToSystem(blob: Blob, fileName: string) {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}

export async function downloadLifeFile(file: LifeFile) {
  if (file.downloadUrl.startsWith('data:')) {
    const blob = getBlobFromDataUrl(file.downloadUrl, file.mimeType);
    saveBlobToSystem(blob, file.name);
  } else if (file.downloadUrl.startsWith('http')) {
    try {
      const res = await fetch(file.downloadUrl);
      if (!res.ok) throw new Error('Fetch failed');
      const blob = await res.blob();
      saveBlobToSystem(blob, file.name);
    } catch {
      const a = document.createElement('a');
      a.href = file.downloadUrl;
      a.download = file.name;
      a.target = '_blank';
      a.rel = 'noopener,noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }
}

function Preview({ file }: { file: LifeFile }) {
  if (file.kind === 'image') {
    return <img src={file.downloadUrl} alt={file.name} className={styles.preview} />;
  }
  if (file.kind === 'video') {
    return <video src={file.downloadUrl} className={styles.preview} muted playsInline />;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isDoc = ext === 'doc' || ext === 'docx';
  const isSheet = ext === 'xls' || ext === 'xlsx' || ext === 'csv';
  const isPdf = ext === 'pdf';

  return (
    <div className={styles.previewIcon}>
      {isPdf ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <FileText size={32} style={{ color: '#ef4444' }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', letterSpacing: '0.05em' }}>PDF</span>
        </div>
      ) : isDoc ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <FileText size={32} style={{ color: '#3b82f6' }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: '#3b82f6', letterSpacing: '0.05em' }}>WORD</span>
        </div>
      ) : isSheet ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <FileSpreadsheet size={32} style={{ color: '#10b981' }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', letterSpacing: '0.05em' }}>SHEET</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <FileText size={32} style={{ color: 'var(--color-accent-light)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            {ext || 'FILE'}
          </span>
        </div>
      )}
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
  const { filesFor, uploadFiles, addLinkAttachment, deleteFile, uploads, error } = useAttachments();
  const files = filesFor(entityType, entityId);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState('All');
  const [dragging, setDragging] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');

  const [previewFile, setPreviewFile] = useState<LifeFile | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewTextContent, setPreviewTextContent] = useState<string | null>(null);

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

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    await addLinkAttachment({
      url: linkUrl.trim(),
      name: linkName.trim() || linkUrl.trim(),
      entityType,
      entityId,
      entityTitle: title,
      folder: 'Links',
    });
    setLinkUrl('');
    setLinkName('');
    setShowLinkInput(false);
  };

  const closePreview = () => {
    if (previewBlobUrl && previewBlobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewBlobUrl(null);
    setPreviewTextContent(null);
    setPreviewFile(null);
  };

  const handleOpenFile = async (file: LifeFile) => {
    if (file.folder === 'Links' || file.downloadUrl.startsWith('http://') || file.downloadUrl.startsWith('https://')) {
      window.open(file.downloadUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (file.downloadUrl.startsWith('data:')) {
      const blob = getBlobFromDataUrl(file.downloadUrl, file.mimeType);
      const blobUrl = URL.createObjectURL(blob);
      setPreviewBlobUrl(blobUrl);
      setPreviewFile(file);

      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (['txt', 'md', 'json', 'csv', 'html', 'css', 'js', 'ts'].includes(ext)) {
        try {
          const text = await blob.text();
          setPreviewTextContent(text);
        } catch {
          setPreviewTextContent(null);
        }
      }
    } else {
      setPreviewBlobUrl(file.downloadUrl);
      setPreviewFile(file);
    }
  };

  const handleDownloadFile = async (file: LifeFile) => {
    await downloadLifeFile(file);
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
            <h2 className={styles.title}>Files & Links</h2>
            <p className={styles.subtitle}>
              {title} — add photos, documents, or Drive links. Free cloud sync across phone & PC.
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
          <button className={styles.bigBtn} type="button" onClick={() => fileRef.current?.click()}>
            <FilePlus size={18} /> Documents
          </button>
          <button className={styles.bigBtn} type="button" onClick={() => setShowLinkInput(!showLinkInput)}>
            <Paperclip size={18} /> Drive / Link
          </button>
          <button className={styles.bigBtn} type="button" onClick={() => folderRef.current?.click()}>
            <FolderUp size={18} /> Folder
          </button>
        </div>

        {showLinkInput && (
          <form onSubmit={handleAddLink} style={{ margin: '12px 0', padding: 12, background: 'var(--color-surface-2)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              placeholder="Link Title (e.g. Google Drive, Figma, Notion)"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)' }}
            />
            <input
              type="url"
              placeholder="https://drive.google.com/..."
              value={linkUrl}
              required
              onChange={(e) => setLinkUrl(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowLinkInput(false)} style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                Cancel
              </button>
              <button type="submit" style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--color-accent)', color: 'white', border: 'none', fontWeight: 600 }}>
                Save Link
              </button>
            </div>
          </form>
        )}

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
                <div onClick={() => void handleOpenFile(file)} style={{ cursor: 'pointer' }} title="Click to open or preview">
                  <Preview file={file} />
                </div>
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
                      onClick={() => void handleOpenFile(file)}
                      title="Open or preview this file"
                    >
                      <Eye size={13} /> Open
                    </button>
                    <button
                      type="button"
                      className={`${styles.smallBtn} ${styles.saveBtn}`}
                      onClick={() => void handleDownloadFile(file)}
                      title="Save file to your computer / system so you can open it anywhere"
                    >
                      <Download size={13} /> Save
                    </button>
                    <button
                      type="button"
                      className={`${styles.smallBtn} ${styles.deleteBtn}`}
                      onClick={() => {
                        if (confirm(`Delete "${file.name}" from all your devices?`)) {
                          void deleteFile(file);
                        }
                      }}
                      title="Delete file"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* ── In-App File Preview Modal ── */}
        {previewFile && (
          <div className={styles.previewModalOverlay} onClick={closePreview}>
            <div className={styles.previewModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.previewModalHeader}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{previewFile.name}</h3>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {previewFile.folder} · {formatSize(previewFile.size)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={closePreview}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }}
                  aria-label="Close preview"
                >
                  <X size={20} />
                </button>
              </div>

              <div className={styles.previewModalBody}>
                {previewFile.kind === 'image' ? (
                  <img
                    src={previewBlobUrl || previewFile.downloadUrl}
                    alt={previewFile.name}
                    style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 10 }}
                  />
                ) : previewFile.kind === 'video' ? (
                  <video
                    src={previewBlobUrl || previewFile.downloadUrl}
                    controls
                    autoPlay
                    style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: 10 }}
                  />
                ) : (previewFile.name.toLowerCase().endsWith('.pdf') || previewFile.mimeType?.includes('pdf')) ? (
                  <iframe
                    src={previewBlobUrl || previewFile.downloadUrl}
                    title={previewFile.name}
                    style={{ width: '100%', height: '65vh', border: 'none', borderRadius: 10, background: '#ffffff' }}
                  />
                ) : previewTextContent !== null ? (
                  <pre style={{
                    width: '100%',
                    maxHeight: '65vh',
                    overflow: 'auto',
                    background: 'var(--color-surface-2)',
                    padding: 16,
                    borderRadius: 10,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {previewTextContent}
                  </pre>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 16px', textAlign: 'center' }}>
                    <FileText size={64} style={{ color: 'var(--color-accent)' }} />
                    <div>
                      <h4 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}>{previewFile.name}</h4>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
                        {formatSize(previewFile.size)} · Ready to save to your device
                      </p>
                    </div>
                    <p style={{ maxWidth: 420, margin: 0, fontSize: 13, color: 'var(--color-text-faint)', lineHeight: 1.6 }}>
                      This file is securely stored in your personal cloud. Click below to save it directly to your computer so you can open it anytime in Microsoft Word, Excel, or any local app.
                    </p>
                    <button
                      type="button"
                      className={styles.bigSaveBtn}
                      onClick={() => void handleDownloadFile(previewFile)}
                    >
                      <Download size={16} /> Save to My System (PC)
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.previewModalFooter}>
                <button
                  type="button"
                  className={`${styles.smallBtn} ${styles.saveBtn}`}
                  style={{ minWidth: 120, height: 38 }}
                  onClick={() => void handleDownloadFile(previewFile)}
                >
                  <Download size={14} /> Save to PC
                </button>
                {previewBlobUrl && (
                  <button
                    type="button"
                    className={`${styles.smallBtn} ${styles.openBtn}`}
                    style={{ minWidth: 130, height: 38 }}
                    onClick={() => window.open(previewBlobUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink size={14} /> Open in Tab
                  </button>
                )}
                <button
                  type="button"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    background: 'var(--color-surface-3)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  onClick={closePreview}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EntityFiles({ entityType, entityId, title, variant = 'strip', className }: EntityFilesProps) {
  const { filesFor } = useAttachments();
  const [open, setOpen] = useState(false);
  const files = filesFor(entityType, entityId);
  const thumbs = files.filter((f) => f.kind === 'image' || f.kind === 'video').slice(0, 4);

  return (
    <>
      {variant === 'icon' && (
        <button
          type="button"
          className={className ? `${styles.iconTrigger} ${className}` : styles.iconTrigger}
          onClick={() => setOpen(true)}
          title="Files"
          aria-label={`Files for ${title}`}
        >
          <Paperclip size={14} />
          {files.length > 0 && <span className={styles.dot} />}
        </button>
      )}

      {variant === 'button' && (
        <button
          type="button"
          className={className ? `${styles.trigger} ${className}` : styles.trigger}
          onClick={() => setOpen(true)}
        >
          <Paperclip size={12} />
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
