'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { explainFirebaseError, getFirebaseDb, getFirebaseStorage } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import type { FileEntityType, FileKind, LifeFile } from '@/types';

const MAX_BYTES = 200 * 1024 * 1024;

interface AttachmentContextType {
  files: LifeFile[];
  isLoaded: boolean;
  error: string | null;
  uploads: Record<string, number>;
  filesFor: (entityType: FileEntityType, entityId: string) => LifeFile[];
  uploadFiles: (params: {
    files: FileList | File[];
    entityType: FileEntityType;
    entityId: string;
    entityTitle: string;
    folder?: string;
  }) => Promise<void>;
  deleteFile: (file: LifeFile) => Promise<void>;
}

const AttachmentContext = createContext<AttachmentContextType | undefined>(undefined);

function classify(mime: string, name: string): FileKind {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  const lower = name.toLowerCase();
  if (
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('sheet') ||
    mime.includes('presentation') ||
    mime.includes('text') ||
    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md|csv)$/.test(lower)
  ) {
    return 'document';
  }
  return 'other';
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 120);
}

export function AttachmentProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [files, setFiles] = useState<LifeFile[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) {
      setFiles([]);
      setIsLoaded(true);
      return;
    }
    setIsLoaded(false);
    const q = collection(getFirebaseDb(), 'users', user.uid, 'files');
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: LifeFile[] = snap.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            name: data.name,
            mimeType: data.mimeType,
            size: data.size,
            kind: data.kind,
            folder: data.folder || 'General',
            storagePath: data.storagePath,
            downloadUrl: data.downloadUrl,
            entityType: data.entityType,
            entityId: data.entityId,
            entityTitle: data.entityTitle || '',
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
          };
        });
        next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setFiles(next);
        setIsLoaded(true);
        setError(null);
      },
      (err) => {
        setError(explainFirebaseError(err));
        setIsLoaded(true);
      }
    );
    return () => unsub();
  }, [user]);

  const filesFor = useCallback(
    (entityType: FileEntityType, entityId: string) =>
      files.filter((f) => f.entityType === entityType && f.entityId === entityId),
    [files]
  );

  const uploadFiles = useCallback(
    async ({
      files: incoming,
      entityType,
      entityId,
      entityTitle,
      folder = 'General',
    }: {
      files: FileList | File[];
      entityType: FileEntityType;
      entityId: string;
      entityTitle: string;
      folder?: string;
    }) => {
      if (!user) throw new Error('Log in first.');
      const list = Array.from(incoming);
      setError(null);

      for (const file of list) {
        if (file.size > MAX_BYTES) {
          setError(`${file.name} is bigger than 200 MB. Pick a smaller file.`);
          continue;
        }
        const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || '';
        const folderName = relative.includes('/')
          ? relative.split('/')[0]
          : folder || 'General';
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const path = `users/${user.uid}/${entityType}/${entityId}/${folderName}/${id}-${safeName(file.name)}`;
        const storageRef = ref(getFirebaseStorage(), path);
        const task = uploadBytesResumable(storageRef, file, { contentType: file.type || 'application/octet-stream' });

        await new Promise<void>((resolve, reject) => {
          task.on(
            'state_changed',
            (snap) => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
              setUploads((prev) => ({ ...prev, [file.name]: pct }));
            },
            (err) => {
              setUploads((prev) => {
                const next = { ...prev };
                delete next[file.name];
                return next;
              });
              setError(explainFirebaseError(err));
              reject(err);
            },
            async () => {
              try {
                const downloadUrl = await getDownloadURL(task.snapshot.ref);
                await addDoc(collection(getFirebaseDb(), 'users', user.uid, 'files'), {
                  name: file.name,
                  mimeType: file.type || 'application/octet-stream',
                  size: file.size,
                  kind: classify(file.type, file.name),
                  folder: folderName,
                  storagePath: path,
                  downloadUrl,
                  entityType,
                  entityId,
                  entityTitle,
                  createdAt: serverTimestamp(),
                });
                setUploads((prev) => {
                  const next = { ...prev };
                  delete next[file.name];
                  return next;
                });
                resolve();
              } catch (err) {
                setError(explainFirebaseError(err));
                reject(err);
              }
            }
          );
        });
      }
    },
    [user]
  );

  const deleteFile = useCallback(
    async (file: LifeFile) => {
      if (!user) return;
      try {
        await deleteObject(ref(getFirebaseStorage(), file.storagePath));
      } catch {
        // Storage object may already be gone — still remove the card.
      }
      await deleteDoc(doc(getFirebaseDb(), 'users', user.uid, 'files', file.id));
    },
    [user]
  );

  const value = useMemo(
    () => ({ files, isLoaded, error, uploads, filesFor, uploadFiles, deleteFile }),
    [files, isLoaded, error, uploads, filesFor, uploadFiles, deleteFile]
  );

  return <AttachmentContext.Provider value={value}>{children}</AttachmentContext.Provider>;
}

export function useAttachments(): AttachmentContextType {
  const context = useContext(AttachmentContext);
  if (!context) throw new Error('useAttachments must be used within AttachmentProvider');
  return context;
}
