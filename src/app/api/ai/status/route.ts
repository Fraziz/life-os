import { NextResponse } from 'next/server';
import { checkRateLimitAsync, getClientIp } from '@/lib/rateLimit';
import { getServerSystemConfig } from '@/lib/serverSystemConfig';
import { getEffectiveServerAiConfig } from '@/lib/serverAiVault';

export const dynamic = 'force-dynamic';

/**
 * Public non-secret AI availability endpoint.
 * Tells clients whether Admin-managed AI is enabled & ready and which model is active,
 * without ever transmitting API keys or vault credentials.
 */
export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const rate = await checkRateLimitAsync(`ai-status:${clientIp}`, 60, 60 * 1000);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const [sysCfg, aiCfg] = await Promise.all([
    getServerSystemConfig(),
    getEffectiveServerAiConfig(),
  ]);

  const configured = aiCfg.candidateKeys.length > 0 || aiCfg.provider === 'custom';

  return NextResponse.json(
    {
      enabled: sysCfg.serverAiEnabled,
      configured,
      provider: aiCfg.provider,
      model: aiCfg.model,
    },
    {
      headers: {
        'Cache-Control': 'no-store, private',
      },
    }
  );
}
