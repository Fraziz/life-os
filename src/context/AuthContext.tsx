'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  EmailAuthProvider,
  type User,
} from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { explainFirebaseError, getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from '@/lib/firebase';
import { removeCurrentDeviceSession, revokeAllOtherDeviceSessions } from '@/lib/deviceSessions';
import { idbClear } from '@/lib/idbStore';
import { clearLocalWorkspaceSilently, stopCloudSync, wipeCloudKv } from '@/lib/cloudStore';
import { flushPendingBookSaves, wipeCloudBooks } from '@/lib/bookCloudSync';
import { hashLocalPin, verifyLocalPin } from '@/lib/pinHash';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isGuest?: boolean;
  providerData?: Array<{ providerId: string }>;
}

export const GUEST_USER: AppUser = {
  uid: 'local-guest-user',
  email: 'guest@sarilingmundo.local',
  displayName: 'Local Workspace',
  photoURL: null,
  isGuest: true,
};

interface OwnerRecord {
  uid: string;
  email: string;
}

interface AuthContextType {
  user: (User | AppUser) | null;
  owner: OwnerRecord | null;
  ready: boolean;
  isGuest: boolean;
  ownerExists: boolean;
  error: string | null;
  cloudWarning: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (currentPassword?: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function readOwner(): Promise<OwnerRecord | null> {
  try {
    const snap = await withTimeout(
      getDoc(doc(getFirebaseDb(), 'app', 'owner')),
      2500,
      null
    );
    if (!snap || !snap.exists()) return null;
    const data = snap.data() as OwnerRecord;
    if (!data.uid) return null;
    return data;
  } catch {
    return null;
  }
}

async function claimOrVerifyOwner(user: User | AppUser): Promise<OwnerRecord> {
  const email = user.email || '';
  const existing = await readOwner();
  if (!existing || existing.uid !== user.uid) {
    const owner = { uid: user.uid, email, updatedAt: new Date().toISOString() };
    try {
      void withTimeout(
        setDoc(doc(getFirebaseDb(), 'app', 'owner'), owner).catch(() => undefined),
        2500,
        undefined
      );
    } catch {
      // ignore
    }
    return { uid: user.uid, email };
  }
  return existing;
}

function clearUserLocalStorageSync() {
  clearLocalWorkspaceSilently();
}

async function syncUserDirectoryProfile(firebaseUser: User) {
  if (!firebaseUser?.uid) return;
  try {
    const providerId = firebaseUser.providerData?.[0]?.providerId || 'password';
    const now = new Date().toISOString();
    await withTimeout(
      setDoc(
        doc(getFirebaseDb(), 'users', firebaseUser.uid),
        {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || '',
          provider: providerId,
          emailVerified: Boolean(firebaseUser.emailVerified),
          createdAt: firebaseUser.metadata?.creationTime || now,
          lastActiveAt: now,
          updatedAt: now,
        },
        { merge: true }
      ).catch(() => undefined),
      2500,
      undefined
    );
  } catch {
    // Non-fatal summary sync error
  }
}

let accountSwitchQueue: Promise<void> = Promise.resolve();

/**
 * Serializes local workspace cleanup when switching accounts or exiting guest mode
 * so concurrent auth callbacks and login/signup handlers never race on IndexedDB.
 */
function syncActiveLocalAccount(nextUid: string): Promise<void> {
  accountSwitchQueue = accountSwitchQueue
    .catch(() => undefined)
    .then(async () => {
      if (typeof localStorage === 'undefined') return;
      try {
        const lastUid = localStorage.getItem('life_os_active_uid');
        const wasGuest = localStorage.getItem('life_os_guest_mode') === 'true';
        if (wasGuest || (lastUid && lastUid !== nextUid)) {
          clearUserLocalStorageSync();
          await idbClear();
        }
        localStorage.removeItem('life_os_guest_mode');
        localStorage.removeItem('life_os_guest_vault_pin');
        localStorage.setItem('life_os_active_uid', nextUid);
      } catch {
        // ignore storage restrictions
      }
    });
  return accountSwitchQueue;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<(User | AppUser) | null>(null);
  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [ready, setReady] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [ownerExists, setOwnerExists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cloudWarning, setCloudWarning] = useState<string | null>(null);

  useEffect(() => {
    // Check if user previously selected local/guest workspace mode
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('life_os_guest_mode') === 'true') {
        setUser(GUEST_USER);
        setIsGuest(true);
        setReady(true);
        return;
      }
    } catch {}

    let unsub = () => {};
    // Safety fallback: ensure ready is set within 700ms so localhost dev mode or
    // adblockers/network delays never freeze the app on an infinite loading spinner
    const fallbackTimer = setTimeout(() => {
      setReady(true);
    }, 700);

    try {
      const auth = getFirebaseAuth();
      unsub = onAuthStateChanged(auth, async (next) => {
        clearTimeout(fallbackTimer);
        if (next) {
          await syncActiveLocalAccount(next.uid);
        }
        setUser(next);
        setIsGuest(false);
        setReady(true);
        if (next) {
          try {
            void syncUserDirectoryProfile(next);
            const record = await claimOrVerifyOwner(next);
            setOwner(record);
            setOwnerExists(true);
            setCloudWarning(null);
          } catch (err) {
            setCloudWarning(explainFirebaseError(err));
          }
        } else {
          setOwner(null);
          void readOwner().then((record) => {
            setOwner(record);
            setOwnerExists(Boolean(record));
          });
        }
      });
    } catch (err) {
      clearTimeout(fallbackTimer);
      setError(explainFirebaseError(err));
      setReady(true);
    }

    return () => {
      clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  const continueAsGuest = () => {
    try {
      localStorage.setItem('life_os_guest_mode', 'true');
    } catch {}
    setUser(GUEST_USER);
    setIsGuest(true);
    setReady(true);
  };

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const authPromise = signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Check your internet connection or Firebase setup.')), 10000)
      );
      const cred = await Promise.race([authPromise, timeoutPromise]);
      await syncActiveLocalAccount(cred.user.uid);
      setIsGuest(false);
      setUser(cred.user);
      try {
        void syncUserDirectoryProfile(cred.user);
        const record = await claimOrVerifyOwner(cred.user);
        setOwner(record);
        setOwnerExists(true);
      } catch (e) {
        setCloudWarning(explainFirebaseError(e));
      }
    } catch (err) {
      const message = explainFirebaseError(err);
      setError(message);
      throw new Error(message);
    }
  };

  const signup = async (email: string, password: string, name?: string) => {
    setError(null);
    try {
      const authPromise = createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Check your internet connection or Firebase setup.')), 10000)
      );
      const cred = await Promise.race([authPromise, timeoutPromise]);
      if (name && name.trim()) {
        try {
          await updateProfile(cred.user, { displayName: name.trim() });
        } catch {
          // ignore profile update error
        }
      }
      await syncActiveLocalAccount(cred.user.uid);
      setIsGuest(false);
      setUser(cred.user);
      try {
        void syncUserDirectoryProfile(cred.user);
        const record = await claimOrVerifyOwner(cred.user);
        setOwner(record);
        setOwnerExists(true);
      } catch (e) {
        setCloudWarning(explainFirebaseError(e));
      }
    } catch (err) {
      const message = explainFirebaseError(err);
      setError(message);
      throw new Error(message);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      await syncActiveLocalAccount(cred.user.uid);
      setIsGuest(false);
      setUser(cred.user);
      try {
        void syncUserDirectoryProfile(cred.user);
        const record = await claimOrVerifyOwner(cred.user);
        setOwner(record);
        setOwnerExists(true);
      } catch (e) {
        setCloudWarning(explainFirebaseError(e));
      }
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      const message = explainFirebaseError(err);
      setError(message);
      throw new Error(message);
    }
  };

  const clearUserLocalStorage = async () => {
    clearUserLocalStorageSync();
    await idbClear();
  };

  const logout = async () => {
    setError(null);
    try {
      const currentUid = !isGuest ? getFirebaseAuth().currentUser?.uid : undefined;
      await flushPendingBookSaves(currentUid);
      await stopCloudSync({ flushWrites: true });
      if (!isGuest) {
        const current = getFirebaseAuth().currentUser;
        if (current) await removeCurrentDeviceSession(current.uid);
        await signOut(getFirebaseAuth());
      }
    } catch {
      // ignore
    } finally {
      try {
        localStorage.removeItem('life_os_guest_mode');
      } catch {}
      await clearUserLocalStorage();
      setUser(null);
      setIsGuest(false);
      setOwner(null);
    }
  };

  const logoutAllDevices = async () => {
    setError(null);
    try {
      if (!isGuest) {
        const current = getFirebaseAuth().currentUser;
        if (current) {
          const now = Date.now();
          try {
            await setDoc(
              doc(getFirebaseDb(), 'users', current.uid, 'meta', 'session'),
              {
                lastRevocation: now,
                revokedAt: new Date().toISOString(),
                revokedBy: 'user_action_settings',
              },
              { merge: true }
            );
          } catch {
            // ignore firestore error
          }
          try {
            await revokeAllOtherDeviceSessions(current.uid);
          } catch {
            // ignore firestore error
          }
        }
      }
    } finally {
      await logout();
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    setError(null);
    if (!newPassword || newPassword.length < 6) {
      const msg = 'New password must be at least 6 characters long.';
      setError(msg);
      throw new Error(msg);
    }

    try {
      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;

      if (currentUser && currentUser.email && !isGuest) {
        // Reauthenticate with current password first
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword.trim());
        await reauthenticateWithCredential(currentUser, credential);
        // Update Firebase Auth password
        await updatePassword(currentUser, newPassword.trim());
        // Never retain plaintext passwords in localStorage
        try {
          localStorage.removeItem('life_os_guest_vault_pin');
        } catch {}
        return;
      }

      // Guest / Offline Mode PIN (stored only locally as salted SHA-256 digest)
      const stored = typeof window !== 'undefined' ? localStorage.getItem('life_os_guest_vault_pin') : null;
      if (stored && !(await verifyLocalPin(currentPassword.trim(), stored))) {
        const msg = 'Current password is incorrect.';
        setError(msg);
        throw new Error(msg);
      }

      const hashedPin = await hashLocalPin(newPassword.trim());
      localStorage.setItem('life_os_guest_vault_pin', hashedPin);
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : '';
      let message = explainFirebaseError(err);
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        message = 'Current password is incorrect.';
      } else if (code === 'auth/weak-password') {
        message = 'Password is too weak. Please use at least 6 characters.';
      }
      setError(message);
      throw new Error(message);
    }
  };

  const sendPasswordReset = async (email: string) => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      const msg = 'Please enter your email address first.';
      setError(msg);
      throw new Error(msg);
    }
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), trimmed);
    } catch (err: unknown) {
      const message = explainFirebaseError(err);
      setError(message);
      throw new Error(message);
    }
  };

  const deleteAccount = async (currentPassword?: string) => {
    setError(null);
    if (isGuest) {
      await logout();
      return;
    }

    const auth = getFirebaseAuth();
    const current = auth.currentUser;
    if (!current) {
      throw new Error('No signed-in account found.');
    }

    const uid = current.uid;
    const hasPasswordProvider = current.providerData.some((p) => p.providerId === 'password');
    const hasGoogleProvider = current.providerData.some((p) => p.providerId === 'google.com');

    try {
      // Reauthenticate BEFORE deleting any cloud data so aborted/failed reauth never leaves half-wiped data.
      if (hasPasswordProvider && current.email) {
        if (!currentPassword?.trim()) {
          throw new Error('Please enter your current password to confirm account deletion.');
        }
        const cred = EmailAuthProvider.credential(current.email, currentPassword.trim());
        await reauthenticateWithCredential(current, cred);
      } else if (hasGoogleProvider) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await reauthenticateWithPopup(current, provider);
      }

      await flushPendingBookSaves(uid);
      await stopCloudSync({ flushWrites: false });

      const db = getFirebaseDb();
      try {
        const filesSnap = await getDocs(collection(db, 'users', uid, 'files'));
        await Promise.all(
          filesSnap.docs.map(async (fDoc) => {
            const storagePath = fDoc.data()?.storagePath;
            if (typeof storagePath === 'string' && storagePath && storagePath !== 'inline-firestore') {
              await deleteObject(ref(getFirebaseStorage(), storagePath)).catch(() => undefined);
            }
            await deleteDoc(fDoc.ref).catch(() => undefined);
          })
        );
      } catch {}

      try {
        const sessionsSnap = await getDocs(collection(db, 'users', uid, 'sessions'));
        await Promise.all(sessionsSnap.docs.map((s) => deleteDoc(s.ref).catch(() => undefined)));
      } catch {}

      try {
        await deleteDoc(doc(db, 'users', uid, 'meta', 'session')).catch(() => undefined);
      } catch {}

      await Promise.allSettled([
        wipeCloudKv(uid),
        wipeCloudBooks(uid),
      ]);

      try {
        await deleteDoc(doc(db, 'users', uid)).catch(() => undefined);
      } catch {}

      try {
        const ownerSnap = await getDoc(doc(db, 'app', 'owner'));
        if (ownerSnap.exists() && ownerSnap.data()?.uid === uid) {
          await deleteDoc(doc(db, 'app', 'owner'));
        }
      } catch {}

      await deleteUser(current);
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : '';
      let message = explainFirebaseError(err);
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        message = 'Current password is incorrect.';
      } else if (code === 'auth/requires-recent-login') {
        message = 'For security, please sign out, sign back in, and retry deleting your account.';
      }
      setError(message);
      throw new Error(message);
    }

    try {
      localStorage.removeItem('life_os_guest_mode');
    } catch {}
    await clearUserLocalStorage();
    setUser(null);
    setIsGuest(false);
    setOwner(null);
  };

  const value = useMemo(
    () => ({
      user,
      owner,
      ready,
      isGuest,
      ownerExists,
      error,
      cloudWarning,
      login,
      signup,
      signInWithGoogle,
      sendPasswordReset,
      continueAsGuest,
      logout,
      logoutAllDevices,
      changePassword,
      deleteAccount,
      clearError: () => setError(null),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, owner, ready, isGuest, ownerExists, error, cloudWarning]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
