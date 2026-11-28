import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';

export type BannerTone = 'info' | 'warning' | 'critical';

export interface SystemConfig {
  allowRegistrations: boolean;
  allowGuestMode: boolean;
  allowGoogleAuth: boolean;
  requireVerifiedEmail: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  serverAiEnabled: boolean;
  linkPreviewsEnabled: boolean;
  aiRateLimitPerMin: number;
  bannerEnabled: boolean;
  bannerTone: BannerTone;
  bannerTitle: string;
  bannerMessage: string;
  bannerActionLabel: string;
  bannerActionHref: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  allowRegistrations: true,
  allowGuestMode: true,
  allowGoogleAuth: true,
  requireVerifiedEmail: false,
  maintenanceMode: false,
  maintenanceMessage: 'Scheduled platform maintenance is in progress. Please check back shortly.',
  serverAiEnabled: true,
  linkPreviewsEnabled: true,
  aiRateLimitPerMin: 25,
  bannerEnabled: false,
  bannerTone: 'info',
  bannerTitle: '',
  bannerMessage: '',
  bannerActionLabel: '',
  bannerActionHref: '',
};

export function sanitizeBannerHref(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().slice(0, 240);
  if (!trimmed) return '';
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    return '';
  }
  return '';
}

export function sanitizeSystemConfig(raw: Record<string, unknown> | undefined): SystemConfig {
  if (!raw) return { ...DEFAULT_SYSTEM_CONFIG };

  const rawRate = Number(raw.aiRateLimitPerMin);
  const aiRateLimitPerMin = Number.isFinite(rawRate)
    ? Math.max(5, Math.min(120, Math.round(rawRate)))
    : DEFAULT_SYSTEM_CONFIG.aiRateLimitPerMin;

  const bannerTone: BannerTone =
    raw.bannerTone === 'critical'
      ? 'critical'
      : raw.bannerTone === 'warning'
      ? 'warning'
      : 'info';

  return {
    allowRegistrations: raw.allowRegistrations !== false,
    allowGuestMode: raw.allowGuestMode !== false,
    allowGoogleAuth: raw.allowGoogleAuth !== false,
    requireVerifiedEmail: Boolean(raw.requireVerifiedEmail),
    maintenanceMode: Boolean(raw.maintenanceMode),
    maintenanceMessage:
      typeof raw.maintenanceMessage === 'string' && raw.maintenanceMessage.trim()
        ? raw.maintenanceMessage.trim().slice(0, 320)
        : DEFAULT_SYSTEM_CONFIG.maintenanceMessage,
    serverAiEnabled: raw.serverAiEnabled !== false,
    linkPreviewsEnabled: raw.linkPreviewsEnabled !== false,
    aiRateLimitPerMin,
    bannerEnabled: Boolean(raw.bannerEnabled),
    bannerTone,
    bannerTitle: typeof raw.bannerTitle === 'string' ? raw.bannerTitle.slice(0, 120) : '',
    bannerMessage: typeof raw.bannerMessage === 'string' ? raw.bannerMessage.slice(0, 500) : '',
    bannerActionLabel:
      typeof raw.bannerActionLabel === 'string' ? raw.bannerActionLabel.slice(0, 48) : '',
    bannerActionHref: sanitizeBannerHref(raw.bannerActionHref),
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
