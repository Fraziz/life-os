import { NextResponse } from 'next/server';
import { checkRateLimitAsync, getClientIp } from '@/lib/rateLimit';
import { verifyFirebaseIdToken } from '@/lib/firebaseServerAuth';
import { getServerSystemConfig } from '@/lib/serverSystemConfig';
import { getEffectiveServerAiConfig } from '@/lib/serverAiVault';
import { runServerAiCompletion, ServerAiProxyError } from '@/lib/serverAiRunner';

interface AiChatRequestBody {
  prompt?: unknown;
  systemPrompt?: unknown;
  aiSettings?: {
    temperature?: number;
  };
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const [verifiedUid, sysCfg] = await Promise.all([
      verifyFirebaseIdToken(request.headers.get('authorization')),
      getServerSystemConfig(),
    ]);

    if (!verifiedUid) {
      return NextResponse.json(
        { error: 'Please sign in to your account to use the AI assistant.' },
        { status: 401 }
      );
    }

    if (!sysCfg.serverAiEnabled) {
      return NextResponse.json(
        { error: 'AI service is temporarily paused by the administrator.' },
        { status: 503 }
      );
    }

    const rateKey = `ai-chat:user:${verifiedUid || clientIp}`;
    const rateCheck = await checkRateLimitAsync(rateKey, sysCfg.aiRateLimitPerMin, 60 * 1000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded: Please wait a moment before sending more AI requests.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    let body: AiChatRequestBody;
    try {
      body = (await request.json()) as AiChatRequestBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const { prompt, systemPrompt = '', aiSettings } = body || {};

    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 32000) {
      return NextResponse.json(
        { error: 'Prompt must be a non-empty string under 32,000 characters.' },
        { status: 400 }
      );
    }

    if (typeof systemPrompt !== 'string' || systemPrompt.length > 16000) {
      return NextResponse.json(
        { error: 'System prompt must be a string under 16,000 characters.' },
        { status: 400 }
      );
    }

    const effective = await getEffectiveServerAiConfig();
    const rawTemp = aiSettings?.temperature;
    const temperature =
      typeof rawTemp === 'number' && Number.isFinite(rawTemp)
        ? Math.max(0, Math.min(1.5, rawTemp))
        : effective.temperature;

    const result = await runServerAiCompletion({
      provider: effective.provider,
      model: effective.model,
      candidateKeys: effective.candidateKeys,
      prompt,
      systemPrompt,
      temperature,
      apiEndpoint: effective.apiEndpoint,
      maxTokens: 2048,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof ServerAiProxyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[AI Chat Route Error]:', error);
    return NextResponse.json({ error: 'Internal AI Server Proxy Error' }, { status: 500 });
  }
}
