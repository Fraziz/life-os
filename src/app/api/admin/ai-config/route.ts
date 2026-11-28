import { NextResponse } from 'next/server';
import { verifyAdminRequest, unauthorizedAdminResponse } from '@/lib/adminAuth';
import { checkRateLimitAsync, getClientIp } from '@/lib/rateLimit';
import {
  clearServerAiKeys,
  getEffectiveServerAiConfig,
  getEnvKeysForProvider,
  getMaskedAdminAiSummary,
  getServerAiVault,
  saveServerAiVault,
  SUPPORTED_AI_PROVIDERS,
} from '@/lib/serverAiVault';
import { runServerAiCompletion, ServerAiProxyError } from '@/lib/serverAiRunner';
import type { AIProvider } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const rate = await checkRateLimitAsync(`admin-ai-config:${clientIp}`, 30, 60 * 1000);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const verified = await verifyAdminRequest(request);
  if (!verified) {
    return unauthorizedAdminResponse();
  }

  const summary = await getMaskedAdminAiSummary();
  return NextResponse.json({
    ok: true,
    summary,
  });
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rate = await checkRateLimitAsync(`admin-ai-config-write:${clientIp}`, 20, 60 * 1000);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const verified = await verifyAdminRequest(request);
  if (!verified) {
    return unauthorizedAdminResponse();
  }

  let body: {
    action?: unknown;
    provider?: unknown;
    model?: unknown;
    primaryApiKey?: unknown;
    clearPrimaryKey?: boolean;
    backupApiKeys?: unknown;
    addBackupKey?: unknown;
    removeBackupIndex?: unknown;
    apiEndpoint?: unknown;
    temperature?: unknown;
    autoFailover?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const action = typeof body?.action === 'string' ? body.action : 'save';

  if (action === 'clear-keys') {
    await clearServerAiKeys(verified.user.email || verified.user.uid);
    const summary = await getMaskedAdminAiSummary();
    return NextResponse.json({ ok: true, action, summary });
  }

  if (action === 'add-backup-key') {
    const newKey = typeof body.addBackupKey === 'string' ? body.addBackupKey.trim() : '';
    if (!newKey) {
      return NextResponse.json({ error: 'Backup API key cannot be empty.' }, { status: 400 });
    }
    const existing = await getServerAiVault(true);
    await saveServerAiVault(
      {
        backupApiKeys: [...existing.backupApiKeys, newKey],
      },
      verified.user.email || verified.user.uid
    );
    const summary = await getMaskedAdminAiSummary();
    return NextResponse.json({ ok: true, action, summary });
  }

  if (action === 'remove-backup-key') {
    const idx = Number(body.removeBackupIndex);
    const existing = await getServerAiVault(true);
    if (!Number.isInteger(idx) || idx < 0 || idx >= existing.backupApiKeys.length) {
      return NextResponse.json({ error: 'Invalid backup key index.' }, { status: 400 });
    }
    const nextBackups = existing.backupApiKeys.filter((_, i) => i !== idx);
    await saveServerAiVault(
      { backupApiKeys: nextBackups },
      verified.user.email || verified.user.uid
    );
    const summary = await getMaskedAdminAiSummary();
    return NextResponse.json({ ok: true, action, summary });
  }

  if (action === 'test') {
    const stored = await getEffectiveServerAiConfig();
    const rawProvider = typeof body.provider === 'string' ? body.provider.trim().toLowerCase() : '';
    const testProvider: AIProvider = SUPPORTED_AI_PROVIDERS.includes(rawProvider as AIProvider)
      ? (rawProvider as AIProvider)
      : stored.provider;
    const testModel =
      typeof body.model === 'string' && body.model.trim() ? body.model.trim() : stored.model;
    const inlineKey = typeof body.primaryApiKey === 'string' ? body.primaryApiKey.trim() : '';
    const testEndpoint =
      typeof body.apiEndpoint === 'string' && body.apiEndpoint.trim()
        ? body.apiEndpoint.trim()
        : stored.apiEndpoint;

    const testKeys: string[] = [];
    if (inlineKey) testKeys.push(inlineKey);
    for (const k of stored.candidateKeys) {
      if (k && !testKeys.includes(k)) testKeys.push(k);
    }
    for (const ek of getEnvKeysForProvider(testProvider)) {
      if (ek && !testKeys.includes(ek)) testKeys.push(ek);
    }

    const start = Date.now();
    try {
      const res = await runServerAiCompletion({
        provider: testProvider,
        model: testModel,
        candidateKeys: testKeys,
        prompt: 'Ping! Respond with: "Sariling Mundo AI Connected!"',
        systemPrompt: 'Respond with a short confirmation of 5 words or fewer.',
        temperature: 0.2,
        apiEndpoint: testEndpoint,
        maxTokens: 64,
      });
      return NextResponse.json({
        ok: true,
        success: true,
        message: res.text.trim() || 'Connected successfully!',
        latencyMs: Date.now() - start,
        modelUsed: res.modelUsed,
      });
    } catch (err: unknown) {
      const message =
        err instanceof ServerAiProxyError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Connection test failed.';
      return NextResponse.json({
        ok: true,
        success: false,
        message,
        latencyMs: Date.now() - start,
      });
    }
  }

  if (action === 'save') {
    try {
      await saveServerAiVault(
        {
          provider: body.provider,
          model: body.model,
          primaryApiKey: body.primaryApiKey,
          clearPrimaryKey: Boolean(body.clearPrimaryKey),
          backupApiKeys: body.backupApiKeys,
          apiEndpoint: body.apiEndpoint,
          temperature: body.temperature,
          autoFailover: body.autoFailover,
        },
        verified.user.email || verified.user.uid
      );
      const summary = await getMaskedAdminAiSummary();
      return NextResponse.json({ ok: true, action, summary });
    } catch (err: unknown) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Unable to save AI configuration.' },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
