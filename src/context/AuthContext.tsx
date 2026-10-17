'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { explainFirebaseError, getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import { removeCurrentDeviceSession, revokeAllOtherDeviceSessions } from '@/lib/deviceSessions';

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
  continueAsGuest: () => void;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
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
        setDoc(doc(getFirebaseDb(), 'app', 'owner'), owner),
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
        setUser(next);
        setIsGuest(false);
        setReady(true);
        if (next) {
          try {
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
      try {
        localStorage.removeItem('life_os_guest_mode');
        localStorage.setItem('life_os_guest_vault_pin', password.trim());
      } catch {}
      setIsGuest(false);
      setUser(cred.user);
      try {
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
      try {
        localStorage.removeItem('life_os_guest_mode');
        localStorage.setItem('life_os_guest_vault_pin', password.trim());
      } catch {}
      setIsGuest(false);
      setUser(cred.user);
      try {
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
      try {
        localStorage.removeItem('life_os_guest_mode');
      } catch {}
      setIsGuest(false);
      setUser(cred.user);
      try {
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

  const clearUserLocalStorage = () => {
    if (typeof localStorage !== 'undefined') {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('life_os_') && k !== 'life_os_sidebar_collapsed') {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {
          // ignore
        }
      });
      try {
        localStorage.removeItem('life_os_active_uid');
      } catch {
        // ignore
      }
    }
  };

  const logout = async () => {
    setError(null);
    try {
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
      clearUserLocalStorage();
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
        // Also keep local fallback pin in sync
        try {
          localStorage.setItem('life_os_guest_vault_pin', newPassword.trim());
        } catch {}
        return;
      }

      // Guest / Offline Mode Password
      const stored = typeof window !== 'undefined' ? localStorage.getItem('life_os_guest_vault_pin') : null;
      if (stored && stored !== currentPassword.trim()) {
        const msg = 'Current password is incorrect.';
        setError(msg);
        throw new Error(msg);
      }

      localStorage.setItem('life_os_guest_vault_pin', newPassword.trim());
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
      continueAsGuest,
      logout,
      logoutAllDevices,
      changePassword,
      clearError: () => setError(null),
    }),
    [user, owner, ready, isGuest, ownerExists, error, cloudWarning]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
