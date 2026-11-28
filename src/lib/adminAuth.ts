import { FIREBASE_CLIENT_CONFIG } from './firebaseConfig';
import { verifyFirebaseBearerUser, type VerifiedFirebaseUser } from './firebaseServerAuth';

const FIREBASE_PROJECT_ID = FIREBASE_CLIENT_CONFIG.projectId;

function parseCsvList(raw: string | undefined): string[] {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function isVerifiedFirestoreOwner(uid: string, idToken: string): Promise<boolean> {
  if (!FIREBASE_PROJECT_ID || !uid || !idToken) return false;
  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_PROJECT_ID
    )}/databases/(default)/documents/app/owner`;
    const resp = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(3500),
    });
    if (!resp.ok) return false;
    const docData = (await resp.json()) as {
      fields?: { uid?: { stringValue?: string } };
    };
    return docData?.fields?.uid?.stringValue === uid;
  } catch {
    return false;
  }
}

export interface AdminVerificationResult {
  user: VerifiedFirebaseUser;
  verifiedVia: 'firestore-owner' | 'allowlist-uid' | 'verified-email';
}

/**
 * Verifies that the incoming HTTP request belongs strictly to the configured
 * dedicated Admin account (`ADMIN_UIDS` / `ADMIN_EMAILS`).
 * Fails closed when no server allowlist is configured so normal user accounts
 * can never access /admin or administrative endpoints.
 */
export async function verifyAdminRequest(
  request: Request
): Promise<AdminVerificationResult | null> {
  const bearer = await verifyFirebaseBearerUser(request.headers.get('authorization'));
  if (!bearer) return null;

  const { user, idToken } = bearer;
  const allowedUids = parseCsvList(process.env.ADMIN_UIDS);
  const allowedEmails = parseCsvList(process.env.ADMIN_EMAILS);

  // Fail closed when no explicit admin allowlist is configured
  if (allowedUids.length === 0 && allowedEmails.length === 0) {
    return null;
  }

  // 1. Explicit UID allowlist from server env
  if (allowedUids.includes(user.uid.toLowerCase())) {
    return { user, verifiedVia: 'allowlist-uid' };
  }

  // 2. Explicit email allowlist from server env
  const normalizedEmail = user.email.toLowerCase();
  const isEmailMatch = Boolean(normalizedEmail && allowedEmails.includes(normalizedEmail));
  if (!isEmailMatch) {
    return null;
  }

  // 3. Require verified Firebase email (Google SSO or verified email link) or Firestore owner UID match
  if (user.emailVerified) {
    return { user, verifiedVia: 'verified-email' };
  }

  const isOwner = await isVerifiedFirestoreOwner(user.uid, idToken);
  if (isOwner) {
    return { user, verifiedVia: 'firestore-owner' };
  }

  return null;
}

export function unauthorizedAdminResponse() {
  return Response.json({ error: 'Not found' }, { status: 404 });
}
