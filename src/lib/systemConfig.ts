import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';

export interface SystemConfig {
  allowRegistrations: boolean;
  allowGuestMode: boolean;
  bannerEnabled: boolean;
  bannerTone: 'info' | 'warning';
  bannerTitle: string;
  bannerMessage: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  allowRegistrations: true,
  allowGuestMode: true,
  bannerEnabled: false,
  bannerTone: 'info',
  bannerTitle: '',
  bannerMessage: '',
};

function sanitizeSystemConfig(raw: Record<string, unknown> | undefined): SystemConfig {
  if (!raw) return { ...DEFAULT_SYSTEM_CONFIG };
  return {
    allowRegistrations: raw.allowRegistrations !== false,
    allowGuestMode: raw.allowGuestMode !== false,
    bannerEnabled: Boolean(raw.bannerEnabled),
    bannerTone: raw.bannerTone === 'warning' ? 'warning' : 'info',
    bannerTitle: typeof raw.bannerTitle === 'string' ? raw.bannerTitle.slice(0, 120) : '',
    bannerMessage: typeof raw.bannerMessage === 'string' ? raw.bannerMessage.slice(0, 500) : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined,
  };
}

export async function readSystemConfig(): Promise<SystemConfig> {
  try {
    const snap = await Promise.race([
      getDoc(doc(getFirebaseDb(), 'app', 'systemConfig')),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    if (!snap || !snap.exists()) return { ...DEFAULT_SYSTEM_CONFIG };
    return sanitizeSystemConfig(snap.data() as Record<string, unknown>);
  } catch {
    return { ...DEFAULT_SYSTEM_CONFIG };
  }
}

export function subscribeSystemConfig(onChange: (cfg: SystemConfig) => void): () => void {
  try {
    return onSnapshot(
      doc(getFirebaseDb(), 'app', 'systemConfig'),
      (snap) => {
        if (!snap.exists()) {
          onChange({ ...DEFAULT_SYSTEM_CONFIG });
          return;
        }
        onChange(sanitizeSystemConfig(snap.data() as Record<string, unknown>));
      },
      () => {
        // Offline/permission fallback keeps default operational state
      }
    );
  } catch {
    return () => {};
  }
}

export async function writeSystemConfig(next: SystemConfig, actorEmail?: string): Promise<SystemConfig> {
  const payload: SystemConfig = {
    ...sanitizeSystemConfig(next as unknown as Record<string, unknown>),
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail || 'admin',
  };
  await setDoc(doc(getFirebaseDb(), 'app', 'systemConfig'), payload, { merge: true });
  return payload;
}
