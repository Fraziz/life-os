'use client';

import React, { useMemo, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useAttachments } from '@/context/AttachmentContext';
import { FilesDrawer } from '@/components/files/EntityFiles';
import type { FileEntityType } from '@/types';

const LABELS: Record<FileEntityType, string> = {
  goal: 'Goals',
  dream: 'Dreams',
  project: 'Projects',
  task: 'Tasks',
  milestone: 'Milestones',
  area: 'Life Areas',
  inbox: 'Brain Dump',
  knowledge: 'Knowledge',
  habit: 'Habits',
  vault: 'General',
};

export default function FilesPage() {
  const { files, isLoaded, error } = useAttachments();
  const [open, setOpen] = useState<{ type: FileEntityType; id: string; title: string } | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, typeof files>();
    files.forEach((file) => {
      const key = `${file.entityType}:${file.entityId}`;
      const list = map.get(key) || [];
      list.push(file);
      map.set(key, list);
    });
    return Array.from(map.entries()).map(([key, list]) => ({
      key,
      entityType: list[0].entityType,
      entityId: list[0].entityId,
      title: list[0].entityTitle || 'Untitled',
      count: list.length,
    }));
  }, [files]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900 }}>
      <header>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, margin: 0 }}>All files</h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.5 }}>
          Every photo, video, document, and folder you attached — on this phone or any other device.
        </p>
      </header>

      {error && (
        <p style={{ color: 'var(--color-danger)' }}>{error}</p>
      )}

      {!isLoaded ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Loading files…</p>
      ) : groups.length === 0 ? (
        <div style={{
          padding: 32,
          border: '1px dashed var(--color-border)',
          borderRadius: 20,
          textAlign: 'center',
          color: 'var(--color-text-muted)',
        }}>
          No files yet. Open a Goal and tap Add files.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groups.map((group) => (
            <button
              key={group.key}
              type="button"
              onClick={() => setOpen({ type: group.entityType, id: group.entityId, title: group.title })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textAlign: 'left',
                minHeight: 64,
                padding: '12px 16px',
                borderRadius: 16,
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              <Paperclip size={18} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: 'block' }}>{group.title}</strong>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {LABELS[group.entityType]} · {group.count} {group.count === 1 ? 'file' : 'files'}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <FilesDrawer
          entityType={open.type}
          entityId={open.id}
          title={open.title}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
