import { NextResponse } from 'next/server';
import { verifyAdminRequest, unauthorizedAdminResponse } from '@/lib/adminAuth';
import { checkRateLimitAsync, clearRateLimits, getClientIp } from '@/lib/rateLimit';
import { clearPreviewCache } from '@/lib/linkPreviewCache';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rate = await checkRateLimitAsync(`admin-actions:${clientIp}`, 20, 60 * 1000);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const verified = await verifyAdminRequest(request);
  if (!verified) {
    return unauthorizedAdminResponse();
  }

  let body: { action?: unknown };
  try {
    body = (await request.json()) as { action?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = typeof body?.action === 'string' ? body.action : '';

  if (action === 'clear-rate-limits') {
    const cleared = clearRateLimits();
    return NextResponse.json({ ok: true, action, cleared });
  }

  if (action === 'clear-link-cache') {
    const cleared = clearPreviewCache();
    return NextResponse.json({ ok: true, action, cleared });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
