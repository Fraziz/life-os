import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';

/**
 * Per-user device session tracking.
 *
 * Each browser gets a stable random device ID (stored outside the `life_os_`
 * prefix so it is never synced to the cloud or wiped on logout). When a user
 * signs in, this device writes a record to `users/{uid}/sessions/{deviceId}`.
 * Because the path is scoped to the user's UID, every account only ever sees
 * its own devices (enforced by Firestore rules).
 */

export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export interface DeviceSession {
  deviceId: string;
  browser: string;
  os: string;
  deviceType: DeviceType;
  model?: string;
  location?: string;
  signedInAt: number;
  lastActive: number;
  revoked?: boolean;
  revokedAt?: number;
}

const DEVICE_ID_KEY = 'sm_device_id';
const HEARTBEAT_MS = 2 * 60 * 1000;
export const ACTIVE_NOW_WINDOW_MS = 5 * 60 * 1000;

function sessionsCol(uid: string) {
  return collection(getFirebaseDb(), 'users', uid, 'sessions');
}

function sessionRef(uid: string, deviceId: string) {
  return doc(getFirebaseDb(), 'users', uid, 'sessions', deviceId);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms)),
  ]);
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'unknown-device';
  }
}

interface ParsedDevice {
  browser: string;
  os: string;
  deviceType: DeviceType;
  model?: string;
}

export function parseUserAgent(ua: string, maxTouchPoints = 0): ParsedDevice {
  let os = 'Unknown OS';
  let model: string | undefined;

  if (/iPhone/.test(ua)) {
    os = 'iOS';
    model = 'iPhone';
  } else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) {
    os = 'iPadOS';
    model = 'iPad';
  } else if (/Android/.test(ua)) {
    os = 'Android';
    const m = ua.match(/Android [\d.]+;\s*([^;)]+?)(?:\sBuild|\)|;)/);
    if (m && m[1] && m[1].trim() !== 'K') model = m[1].trim();
  } else if (/Windows/.test(ua)) {
    os = 'Windows';
  } else if (/CrOS/.test(ua)) {
    os = 'ChromeOS';
  } else if (/Mac OS X|Macintosh/.test(ua)) {
    os = 'macOS';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  }

  let browser = 'Browser';
  if (/Edg(A|iOS)?\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox|FxiOS/.test(ua)) browser = 'Firefox';
  else if (/CriOS|Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari/.test(ua)) browser = 'Safari';

  let deviceType: DeviceType = 'desktop';
  if (os === 'iPadOS' || (os === 'Android' && !/Mobile/.test(ua))) deviceType = 'tablet';
  else if (os === 'iOS' || /Mobi|Android/.test(ua)) deviceType = 'mobile';

  return { browser, os, deviceType, model };
}

async function detectDevice(): Promise<ParsedDevice> {
  const nav = navigator as Navigator & {
    userAgentData?: {
      getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string; platform?: string; platformVersion?: string }>;
    };
  };
  const parsed = parseUserAgent(nav.userAgent, nav.maxTouchPoints || 0);

  // Client Hints give the real Android model and distinguish Windows 11
  try {
    const hints = await withTimeout(
      nav.userAgentData?.getHighEntropyValues?.(['model', 'platformVersion']) ??
        Promise.resolve(undefined),
      800
    );
    if (hints) {
      if (hints.model) parsed.model = hints.model;
      if (parsed.os === 'Windows' && hints.platformVersion) {
        const major = parseInt(hints.platformVersion.split('.')[0], 10);
        parsed.os = major >= 13 ? 'Windows 11' : 'Windows 10';
      }
    }
  } catch {
    // ignore
  }
  return parsed;
}

function detectLocation(): string | undefined {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return undefined;
    const city = tz.split('/').pop();
    return city ? city.replace(/_/g, ' ') : undefined;
  } catch {
    return undefined;
  }
}

/** Write/refresh this device's session record. */
export async function registerDeviceSession(uid: string): Promise<void> {
  const deviceId = getDeviceId();
  const device = await detectDevice();
  const now = Date.now();
  const record: Omit<DeviceSession, 'model' | 'location'> & { model?: string; location?: string } = {
    deviceId,
    browser: device.browser,
    os: device.os,
    deviceType: device.deviceType,
    signedInAt: now,
    lastActive: now,
    revoked: false,
  };
  if (device.model) record.model = device.model;
  const location = detectLocation();
  if (location) record.location = location;

  await withTimeout(setDoc(sessionRef(uid, deviceId), record, { merge: true }), 4000);
}

/** Bump `lastActive` for this device. */
export async function touchDeviceSession(uid: string): Promise<void> {
  await withTimeout(
    setDoc(sessionRef(uid, getDeviceId()), { lastActive: Date.now() }, { merge: true }),
    4000
  );
}

/** Remove this device's record (normal sign-out). */
export async function removeCurrentDeviceSession(uid: string): Promise<void> {
  try {
    await withTimeout(deleteDoc(sessionRef(uid, getDeviceId())), 2500);
  } catch {
    // ignore
  }
}

/** Sign out a specific other device. That device sees the flag and logs out. */
export async function revokeDeviceSession(uid: string, deviceId: string): Promise<void> {
  await setDoc(
    sessionRef(uid, deviceId),
    { revoked: true, revokedAt: Date.now() },
    { merge: true }
  );
}

/** Flag every other device as revoked (used by "Log out of all devices"). */
export async function revokeAllOtherDeviceSessions(uid: string): Promise<void> {
  const current = getDeviceId();
  const snap = await getDocs(sessionsCol(uid));
  const batch = writeBatch(getFirebaseDb());
  const now = Date.now();
  snap.forEach((d) => {
    if (d.id !== current) batch.set(d.ref, { revoked: true, revokedAt: now }, { merge: true });
  });
  await batch.commit();
}

/** Live list of this user's signed-in devices (revoked ones excluded). */
export function subscribeDeviceSessions(
  uid: string,
  onChange: (sessions: DeviceSession[]) => void,
  onError?: (err: unknown) => void
): () => void {
  return onSnapshot(
    sessionsCol(uid),
    (snap) => {
      const list: DeviceSession[] = [];
      snap.forEach((d) => {
        const data = d.data() as DeviceSession;
        if (data.revoked || !data.os) return;
        list.push({ ...data, deviceId: d.id });
      });
      list.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
      onChange(list);
    },
    (err) => onError?.(err)
  );
}

/**
 * Keep this device's session alive and watch for remote sign-out.
 * Returns a cleanup function.
 */
export function startDeviceSessionTracking(uid: string, onRevoked: () => void): () => void {
  const deviceId = getDeviceId();
  let registered = false;
  let stopped = false;

  void registerDeviceSession(uid)
    .then(() => {
      registered = true;
    })
    .catch(() => {
      registered = true;
    });

  const beat = () => {
    if (stopped || document.visibilityState !== 'visible') return;
    void touchDeviceSession(uid).catch(() => {});
  };
  const interval = setInterval(beat, HEARTBEAT_MS);
  const onVisible = () => {
    if (document.visibilityState === 'visible') beat();
  };
  document.addEventListener('visibilitychange', onVisible);

  let unsub: () => void = () => {};
  try {
    unsub = onSnapshot(sessionRef(uid, deviceId), (snap) => {
      // Ignore the stale record from before this sign-in registered
      if (!registered || stopped) return;
      const data = snap.data() as DeviceSession | undefined;
      if (data?.revoked) {
        stopped = true;
        onRevoked();
      }
    });
  } catch {
    // offline failsafe
  }

  return () => {
    stopped = true;
    clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisible);
    unsub();
  };
}

export function formatLastActive(ts: number, now = Date.now()): string {
  if (!ts) return 'Unknown';
  const diff = now - ts;
  if (diff < ACTIVE_NOW_WINDOW_MS) return 'Active now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
