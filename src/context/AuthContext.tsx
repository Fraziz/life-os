'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { explainFirebaseError, getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';

interface OwnerRecord {
  uid: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  owner: OwnerRecord | null;
  ready: boolean;
  ownerExists: boolean;
  error: string | null;
  cloudWarning: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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

async function claimOrVerifyOwner(user: User): Promise<OwnerRecord> {
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
  const [user, setUser] = useState<User | null>(null);
  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [ready, setReady] = useState(false);
  const [ownerExists, setOwnerExists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cloudWarning, setCloudWarning] = useState<string | null>(null);

  useEffect(() => {
    let unsub = () => {};
    try {
      const auth = getFirebaseAuth();
      void setPersistence(auth, browserLocalPersistence);
      unsub = onAuthStateChanged(auth, async (next) => {
        setUser(next);
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
      setError(explainFirebaseError(err));
      setReady(true);
    }
    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const authPromise = signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Check your internet connection or Firebase setup.')), 10000)
      );
      const cred = await Promise.race([authPromise, timeoutPromise]);
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

  const signup = async (email: string, password: string) => {
    setError(null);
    try {
      const authPromise = createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Check your internet connection or Firebase setup.')), 10000)
      );
      const cred = await Promise.race([authPromise, timeoutPromise]);
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

  const logout = async () => {
    setError(null);
    await signOut(getFirebaseAuth());
    setUser(null);
    setOwner(null);
  };

  const value = useMemo(
    () => ({
      user,
      owner,
      ready,
      ownerExists,
      error,
      cloudWarning,
      login,
      signup,
      logout,
      clearError: () => setError(null),
    }),
    [user, owner, ready, ownerExists, error, cloudWarning]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
