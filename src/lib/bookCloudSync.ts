import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import type { KnowledgeDocument } from '@/types';

const MAX_CHUNK_SIZE = 500_000;

function safeDb() {
  try {
    return getFirebaseDb();
  } catch {
    return null;
  }
}

/**
 * Strips all undefined fields and ensures clean JSON-serializable types for Firestore.
 */
export function cleanDocForFirestore(docItem: KnowledgeDocument): Record<string, any> {
  const raw: Record<string, any> = {
    id: docItem.id,
    title: docItem.title || 'Untitled',
    content: typeof docItem.content === 'string' ? docItem.content : '',
    status: docItem.status || 'active',
    tags: Array.isArray(docItem.tags) ? docItem.tags.filter(Boolean) : [],
    createdAt: docItem.createdAt || new Date().toISOString(),
    updatedAt: docItem.updatedAt || new Date().toISOString(),
  };

  if (docItem.category) raw.category = docItem.category;
  if (docItem.docType) raw.docType = docItem.docType;
  if (typeof docItem.isPinned === 'boolean') raw.isPinned = docItem.isPinned;
  if (docItem.readStatus) raw.readStatus = docItem.readStatus;
  if (typeof docItem.readProgress === 'number') raw.readProgress = docItem.readProgress;
  if (typeof docItem.currentPage === 'number') raw.currentPage = docItem.currentPage;
  if (typeof docItem.totalPages === 'number') raw.totalPages = docItem.totalPages;
  if (docItem.linkedDreamId) raw.linkedDreamId = docItem.linkedDreamId;
  if (docItem.linkedGoalId) raw.linkedGoalId = docItem.linkedGoalId;
  if (docItem.linkedProjectId) raw.linkedProjectId = docItem.linkedProjectId;
  if (docItem.linkedTaskId) raw.linkedTaskId = docItem.linkedTaskId;
  if (docItem.lastReviewedAt) raw.lastReviewedAt = docItem.lastReviewedAt;
  if (typeof docItem.totalReadMinutes === 'number') raw.totalReadMinutes = docItem.totalReadMinutes;
  if (docItem.lastReadAt) raw.lastReadAt = docItem.lastReadAt;
  if (docItem.preferredReadingTime) raw.preferredReadingTime = docItem.preferredReadingTime;
  if (typeof docItem.isReminder === 'boolean') raw.isReminder = docItem.isReminder;

  if (Array.isArray(docItem.studyQuiz) && docItem.studyQuiz.length > 0) {
    raw.studyQuiz = docItem.studyQuiz.map((q) => ({
      question: q.question || '',
      answer: q.answer || '',
      userMastered: Boolean(q.userMastered),
    }));
  }

  if (Array.isArray(docItem.readingLogs) && docItem.readingLogs.length > 0) {
    raw.readingLogs = docItem.readingLogs.map((log) => {
      const item: Record<string, any> = {
        id: log.id || `log_${Date.now()}`,
        startedAt: log.startedAt || new Date().toISOString(),
        durationMinutes: Number(log.durationMinutes) || 0,
      };
      if (log.timeOfDay) item.timeOfDay = log.timeOfDay;
      if (log.notes) item.notes = log.notes;
      return item;
    });
  }

  return raw;
}

/**
 * Deserializes a Firestore book document, seamlessly joining chunks if chunked.
 */
export async function deserializeFirestoreDoc(
  uid: string,
  data: Record<string, any>
): Promise<KnowledgeDocument> {
  const db = safeDb();
  let content = typeof data.content === 'string' ? data.content : '';

  if (data.isChunked && data.id && db) {
    try {
      const chunksSnap = await getDocs(
        query(
          collection(db, 'users', uid, 'books', data.id, 'chunks'),
          orderBy('index', 'asc')
        )
      );
      if (!chunksSnap.empty) {
        content = chunksSnap.docs
          .sort((a, b) => (a.data().index || 0) - (b.data().index || 0))
          .map((c) => c.data().text || '')
          .join('');
      }
    } catch (err) {
      console.warn(`[bookCloudSync] Failed to load chunks for book ${data.id}:`, err);
    }
  }

  const docItem: KnowledgeDocument = {
    id: String(data.id || ''),
    title: String(data.title || 'Untitled'),
    content,
    status: data.status || 'active',
    tags: Array.isArray(data.tags) ? data.tags : [],
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
    syncedWithCloud: true,
  };

  if (data.category) docItem.category = data.category;
  if (data.docType) docItem.docType = data.docType;
  if (typeof data.isPinned === 'boolean') docItem.isPinned = data.isPinned;
  if (data.readStatus) docItem.readStatus = data.readStatus;
  if (typeof data.readProgress === 'number') docItem.readProgress = data.readProgress;
  if (typeof data.currentPage === 'number') docItem.currentPage = data.currentPage;
  if (typeof data.totalPages === 'number') docItem.totalPages = data.totalPages;
  if (data.linkedDreamId) docItem.linkedDreamId = data.linkedDreamId;
  if (data.linkedGoalId) docItem.linkedGoalId = data.linkedGoalId;
  if (data.linkedProjectId) docItem.linkedProjectId = data.linkedProjectId;
  if (data.linkedTaskId) docItem.linkedTaskId = data.linkedTaskId;
  if (data.lastReviewedAt) docItem.lastReviewedAt = data.lastReviewedAt;
  if (typeof data.totalReadMinutes === 'number') docItem.totalReadMinutes = data.totalReadMinutes;
  if (data.lastReadAt) docItem.lastReadAt = data.lastReadAt;
  if (data.preferredReadingTime) docItem.preferredReadingTime = data.preferredReadingTime;
  if (typeof data.isReminder === 'boolean') docItem.isReminder = data.isReminder;
  if (Array.isArray(data.studyQuiz)) docItem.studyQuiz = data.studyQuiz;
  if (Array.isArray(data.readingLogs)) docItem.readingLogs = data.readingLogs;

  return docItem;
}

const bookDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Debounced cloud saver for books — prevents spamming Firestore on every keystroke.
 */
export function queueBookSaveToCloud(uid: string, docData: KnowledgeDocument, delayMs = 600): void {
  if (!uid || !docData?.id) return;
  const existing = bookDebounceTimers.get(docData.id);
  if (existing) {
    clearTimeout(existing);
  }
  const timer = setTimeout(() => {
    bookDebounceTimers.delete(docData.id);
    void saveBookToCloud(uid, docData);
  }, delayMs);
  bookDebounceTimers.set(docData.id, timer);
}

/**
 * Saves a book permanently to the user's Firestore books subcollection.
 * Handles automatic chunking if the book is exceptionally large (>500,000 characters).
 */
export async function saveBookToCloud(uid: string, docData: KnowledgeDocument): Promise<void> {
  if (!uid || !docData || !docData.id) return;
  const db = safeDb();
  if (!db) return;

  const docRef = doc(db, 'users', uid, 'books', docData.id);
  const cleaned = cleanDocForFirestore(docData);
  const contentStr = cleaned.content || '';

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('life_os_writing'));
  }

  try {
    if (contentStr.length <= MAX_CHUNK_SIZE) {
      await setDoc(docRef, {
        ...cleaned,
        isChunked: false,
        cloudUpdatedAt: Date.now(),
      });
    } else {
      // Chunking for massive books (e.g. 500+ page books)
      const chunks: string[] = [];
      for (let i = 0; i < contentStr.length; i += MAX_CHUNK_SIZE) {
        chunks.push(contentStr.slice(i, i + MAX_CHUNK_SIZE));
      }

      await setDoc(docRef, {
        ...cleaned,
        content: contentStr.slice(0, 1000) + '\n\n[...Chunked Book in Cloud...]',
        isChunked: true,
        chunkCount: chunks.length,
        totalLength: contentStr.length,
        cloudUpdatedAt: Date.now(),
      });

      for (let i = 0; i < chunks.length; i++) {
        const chunkRef = doc(db, 'users', uid, 'books', docData.id, 'chunks', String(i));
        await setDoc(chunkRef, { index: i, text: chunks[i] });
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('life_os_writing_done'));
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[bookCloudSync] Error saving book ${docData.id} to cloud:`, err);
    }
  }
}

/**
 * Permanently deletes a book from the user's Firestore books subcollection.
 */
export async function deleteBookFromCloud(uid: string, docId: string): Promise<void> {
  if (!uid || !docId) return;
  const db = safeDb();
  if (!db) return;

  const docRef = doc(db, 'users', uid, 'books', docId);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('life_os_writing'));
  }

  try {
    // Delete any subcollection chunks
    const chunksSnap = await getDocs(collection(db, 'users', uid, 'books', docId, 'chunks'));
    if (!chunksSnap.empty) {
      await Promise.all(chunksSnap.docs.map((c) => deleteDoc(c.ref)));
    }
  } catch {
    // Ignore chunks subcollection missing error
  }

  try {
    await deleteDoc(docRef);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[bookCloudSync] Error deleting book ${docId} from cloud:`, err);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('life_os_writing_done'));
  }
}

/**
 * Subscribes to real-time changes in the user's books subcollection.
 */
export function subscribeToCloudBooks(
  uid: string,
  onDocsUpdated: (remoteDocs: KnowledgeDocument[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe | null {
  const db = safeDb();
  if (!db) return null;

  const booksCol = collection(db, 'users', uid, 'books');

  return onSnapshot(
    booksCol,
    async (snapshot) => {
      try {
        const promises = snapshot.docs.map((docSnap) =>
          deserializeFirestoreDoc(uid, { id: docSnap.id, ...docSnap.data() })
        );
        const remoteDocs = await Promise.all(promises);
        onDocsUpdated(remoteDocs);
      } catch (err) {
        if (onError) onError(err);
      }
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

/**
 * Recovers legacy books if previously stored in users/{uid}/kv/ across any known key
 */
export async function migrateLegacyBooksFromKv(uid: string): Promise<KnowledgeDocument[]> {
  if (!uid) return [];
  const db = safeDb();
  if (!db) return [];

  const candidateKeys = [
    'life_os_knowledge_docs_v1',
    'life_os_knowledge_docs_backup',
    'life_os_knowledge_docs',
    'life_os_books_v1',
    'life_os_books',
    'knowledge_docs',
  ];

  const map = new Map<string, KnowledgeDocument>();

  for (const key of candidateKeys) {
    try {
      const kvSnap = await getDoc(doc(db, 'users', uid, 'kv', key));
      if (kvSnap.exists()) {
        const raw = kvSnap.data()?.v;
        if (typeof raw === 'string') {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach((d) => {
              if (d && d.id) {
                const existing = map.get(d.id);
                if (!existing) {
                  map.set(d.id, d);
                } else {
                  const newLen = (d.content || '').length;
                  const existLen = (existing.content || '').length;
                  const newTime = new Date(d.updatedAt || 0).getTime();
                  const existTime = new Date(existing.updatedAt || 0).getTime();
                  if (newLen > existLen || newTime > existTime) {
                    map.set(d.id, d);
                  }
                }
              }
            });
          }
        }
      }
    } catch {
      // Key does not exist in Firestore KV; continue gracefully
    }
  }

  return Array.from(map.values());
}

/**
 * Wipes all books in cloud for full account data resets.
 */
export async function wipeCloudBooks(uid: string): Promise<void> {
  if (!uid) return;
  const db = safeDb();
  if (!db) return;

  try {
    const snap = await getDocs(collection(db, 'users', uid, 'books'));
    for (const docSnap of snap.docs) {
      await deleteBookFromCloud(uid, docSnap.id);
    }
  } catch (err) {
    console.warn('[bookCloudSync] Error wiping cloud books:', err);
  }
}
