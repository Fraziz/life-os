import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCQHHShXsE0HrUTMNrGEoUvtfu3lD7B78k',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'lifeos-123.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'lifeos-123',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'lifeos-123.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '126688811844',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:126688811844:web:569cc1ca34469620a2d511',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-6ZQBCM7KBQ',
};

function isConfigReady(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (!isConfigReady()) return null;
  if (getApps().length > 0) return getApp();
  return initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  const app = getFirebaseApp();
  if (!app) {
    if (!isConfigReady()) {
      throw new Error('Firebase environment variables (NEXT_PUBLIC_FIREBASE_*) are missing. Please add them in your Netlify site environment variables and redeploy.');
    }
    throw new Error('Firebase is not ready yet. Refresh the page.');
  }
  return getAuth(app);
}

export function getFirebaseDb(): Firestore {
  const app = getFirebaseApp();
  if (!app) {
    if (!isConfigReady()) {
      throw new Error('Firebase environment variables (NEXT_PUBLIC_FIREBASE_*) are missing. Please add them in your Netlify site environment variables and redeploy.');
    }
    throw new Error('Firebase is not ready yet. Refresh the page.');
  }
  return getFirestore(app);
}

export function getFirebaseStorage(): FirebaseStorage {
  const app = getFirebaseApp();
  if (!app) {
    if (!isConfigReady()) {
      throw new Error('Firebase environment variables (NEXT_PUBLIC_FIREBASE_*) are missing. Please add them in your Netlify site environment variables and redeploy.');
    }
    throw new Error('Firebase is not ready yet. Refresh the page.');
  }
  return getStorage(app);
}

export async function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null;
  const app = getFirebaseApp();
  if (!app) return null;
  const supported = await isSupported();
  if (!supported) return null;
  return getAnalytics(app);
}

export function explainFirebaseError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code: string }).code)
    : '';
  const message = error instanceof Error ? error.message : 'Something went wrong.';

  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email or password is not right. Try again slowly.';
  }
  if (code === 'auth/invalid-email') return 'That email does not look valid.';
  if (code === 'auth/weak-password') return 'Use at least 6 characters for the password.';
  if (code === 'auth/email-already-in-use') return 'This email already has an account. Tap Log in.';
  if (code === 'auth/operation-not-allowed') {
    return 'Turn on Email/Password in Firebase Console → Authentication → Sign-in method.';
  }
  if (code === 'auth/too-many-requests') return 'Too many tries. Wait a minute, then try once.';
  if (code === 'permission-denied' || message.includes('permission')) {
    return 'Cloud is locked. In Firebase Console, create Firestore + Storage and paste the rules from this project.';
  }
  if (code.startsWith('storage/')) return 'File storage is not ready yet. Turn on Storage in Firebase Console.';
  return message;
}
