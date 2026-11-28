import { FIREBASE_CLIENT_CONFIG } from './firebaseConfig';

const FIREBASE_WEB_API_KEY = FIREBASE_CLIENT_CONFIG.apiKey;

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  providerIds: string[];
  lastLoginAt?: string;
  createdAt?: string;
}

/**
 * Verifies a Firebase Auth Bearer ID token via Google Identity Toolkit
 * and returns the authenticated user claims, or null when invalid.
 */
export async function verifyFirebaseBearerUser(
  authHeader: string | null
): Promise<{ user: VerifiedFirebaseUser; idToken: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ') || !FIREBASE_WEB_API_KEY) {
    return null;
  }

  const idToken = authHeader.slice(7).trim();
  if (!idToken || idToken.length > 4096) return null;

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      users?: Array<{
        localId?: string;
        email?: string;
        emailVerified?: boolean;
        displayName?: string;
        providerUserInfo?: Array<{ providerId?: string }>;
        lastLoginAt?: string;
        createdAt?: string;
      }>;
    };

    const raw = data?.users?.[0];
    if (!raw?.localId) return null;

    return {
      idToken,
      user: {
        uid: raw.localId,
        email: (raw.email || '').trim(),
        emailVerified: Boolean(raw.emailVerified),
        displayName: (raw.displayName || '').trim(),
        providerIds: Array.isArray(raw.providerUserInfo)
          ? raw.providerUserInfo.map((p) => String(p?.providerId || '')).filter(Boolean)
          : [],
        lastLoginAt: raw.lastLoginAt,
        createdAt: raw.createdAt,
      },
    };
  } catch {
    return null;
  }
}

export async function verifyFirebaseIdToken(authHeader: string | null): Promise<string | null> {
  const verified = await verifyFirebaseBearerUser(authHeader);
  return verified ? verified.user.uid : null;
}
