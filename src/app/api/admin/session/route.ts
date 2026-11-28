import { NextResponse } from 'next/server';
import { verifyAdminRequest, unauthorizedAdminResponse } from '@/lib/adminAuth';
import { checkRateLimitAsync, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const rate = await checkRateLimitAsync(`admin-session:${clientIp}`, 30, 60 * 1000);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const verified = await verifyAdminRequest(request);
  if (!verified) {
    return unauthorizedAdminResponse();
  }

  return NextResponse.json({
    authorized: true,
    uid: verified.user.uid,
    email: verified.user.email,
    verifiedVia: verified.verifiedVia,
  });
}
