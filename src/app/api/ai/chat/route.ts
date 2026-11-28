import { NextResponse } from 'next/server';
import { checkRateLimitAsync, getClientIp, isPrivateOrReservedHost } from '@/lib/rateLimit';
import { verifyFirebaseIdToken } from '@/lib/firebaseServerAuth';
import { getServerSystemConfig } from '@/lib/serverSystemConfig';

interface AiChatRequestBody {
  prompt?: unknown;
  systemPrompt?: unknown;
  aiSettings?: {
    provider?: string;
    apiKey?: string;
    apiEndpoint?: string;
    model?: string;
    temperature?: number;
    savedKeys?: Array<{ apiKey?: string }>;
  };
}

function errMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const e = err as { cause?: { code?: string; message?: string }; message?: string };
    return e.cause?.code || e.cause?.message || e.message || fallback;
  }
  return fallback;
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const [verifiedUid, sysCfg] = await Promise.all([
      verifyFirebaseIdToken(request.headers.get('authorization')),
      getServerSystemConfig(),
    ]);
    const rateKey = verifiedUid ? `ai-chat:user:${verifiedUid}` : `ai-chat:ip:${clientIp}`;

    // Rate limiting: configured centrally from Admin Control Plane (default 25 req/min)
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
      return NextResponse.json({ error: 'Prompt must be a non-empty string under 32,000 characters.' }, { status: 400 });
    }

    if (typeof systemPrompt !== 'string' || systemPrompt.length > 16000) {
      return NextResponse.json({ error: 'System prompt must be a string under 16,000 characters.' }, { status: 400 });
    }

    if (!aiSettings) {
      return NextResponse.json({ error: 'AI Settings are required' }, { status: 400 });
    }

    const provider = aiSettings.provider || 'gemini';
    const rawApiKey = (aiSettings.apiKey || '').trim();

    // Server-only environment keys: strictly require authenticated user AND enabled platform AI quota
    const allowServerQuota = Boolean(verifiedUid) && sysCfg.serverAiEnabled;
    const envGroqKey1 = allowServerQuota ? (process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY || '') : '';
    const envGroqKey2 = allowServerQuota ? (process.env.GROQ_API_KEY_2 || '') : '';
    const envGeminiKey = allowServerQuota ? (process.env.GEMINI_API_KEY || '') : '';
    const envOpenAIKey = allowServerQuota ? (process.env.OPENAI_API_KEY || '') : '';
    const envAnthropicKey = allowServerQuota ? (process.env.ANTHROPIC_API_KEY || '') : '';

    const effectiveApiKey =
      rawApiKey ||
      (provider === 'groq'
        ? envGroqKey1
        : provider === 'gemini'
        ? envGeminiKey
        : provider === 'openai'
        ? envOpenAIKey
        : provider === 'anthropic'
        ? envAnthropicKey
        : '');

    if (!effectiveApiKey && provider !== 'custom') {
      if (verifiedUid && !sysCfg.serverAiEnabled) {
        return NextResponse.json(
          { error: 'Platform server AI quota is temporarily paused by an administrator. Add a personal API key in Settings or try again later.' },
          { status: 503 }
        );
      }
      return NextResponse.json(
        {
          error: verifiedUid
            ? `API key is missing for ${provider.toUpperCase()}. Please configure your API key in Settings.`
            : 'Authentication required to use server AI keys, or provide your own API key in Settings.',
        },
        { status: verifiedUid ? 400 : 401 }
      );
    }

    // ── 1. Google Gemini ────────────────────────────────────────────────────────
    if (provider === 'gemini') {
      const rawModel = aiSettings.model?.trim() || 'gemini-2.0-flash';
      let cleanModel = rawModel.replace(/^models\//, '');
      if (cleanModel === 'gemini-2.5-pro') cleanModel = 'gemini-3.1-pro-preview';

      const candidateModels = Array.from(new Set([
        cleanModel,
        'gemini-3.1-pro-preview',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
      ])).filter(Boolean);

      const candidateKeys: string[] = [effectiveApiKey];
      if (Array.isArray(aiSettings.savedKeys)) {
        for (const k of aiSettings.savedKeys) {
          const c = k.apiKey?.trim();
          if (c && !candidateKeys.includes(c)) candidateKeys.push(c);
        }
      }

      let lastError = 'Gemini API call failed';
      for (const currentKey of candidateKeys) {
        for (const m of candidateModels) {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`;
          try {
            const resp = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': currentKey,
              },
              signal: AbortSignal.timeout(20000),
              body: JSON.stringify({
                systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: aiSettings.temperature ?? 0.7,
                  maxOutputTokens: 2048,
                },
              }),
            });

            if (resp.ok) {
              const data = (await resp.json()) as {
                candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
                usageMetadata?: { totalTokenCount?: number };
              };
              const text =
                data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ||
                data.candidates?.[0]?.content?.parts?.[0]?.text ||
                '';
              const tokensUsed = data.usageMetadata?.totalTokenCount || 400;
              const costUSD = (tokensUsed / 1_000_000) * 0.075;
              return NextResponse.json({ text, tokensUsed, costUSD, modelUsed: m });
            }

            const errJson = await resp.json().catch(() => ({}));
            lastError = errJson.error?.message || `Gemini status ${resp.status}`;
            if (resp.status === 404 || resp.status === 400) continue;
            if (resp.status === 429) break; // try next key
          } catch (e: unknown) {
            lastError = errMessage(e, lastError);
          }
        }
      }
      return NextResponse.json({ error: lastError }, { status: 502 });
    }

    // ── 2. Anthropic Claude ─────────────────────────────────────────────────────
    if (provider === 'anthropic') {
      const requestedModel = aiSettings.model?.trim() || 'claude-3-5-sonnet-20241022';
      const candidateModels = Array.from(new Set([
        requestedModel,
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-haiku-20240307',
      ])).filter(Boolean);

      const candidateKeys: string[] = [effectiveApiKey];
      if (Array.isArray(aiSettings.savedKeys)) {
        for (const k of aiSettings.savedKeys) {
          const c = k.apiKey?.trim();
          if (c && !candidateKeys.includes(c)) candidateKeys.push(c);
        }
      }

      let lastError = 'Anthropic API call failed';
      for (const currentKey of candidateKeys) {
        for (const m of candidateModels) {
          try {
            const resp = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': currentKey,
                'anthropic-version': '2023-06-01',
              },
              signal: AbortSignal.timeout(20000),
              body: JSON.stringify({
                model: m,
                max_tokens: 2048,
                system: systemPrompt || undefined,
                messages: [{ role: 'user', content: prompt }],
                temperature: aiSettings.temperature ?? 0.7,
              }),
            });

            if (resp.ok) {
              const data = await resp.json();
              const text = data.content?.[0]?.text || '';
              const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) || 450;
              const costUSD = (tokensUsed / 1_000_000) * 3.0;
              return NextResponse.json({ text, tokensUsed, costUSD, modelUsed: m });
            }

            const errJson = await resp.json().catch(() => ({}));
            lastError = errJson.error?.message || `Anthropic status ${resp.status}`;
            if (resp.status === 404) continue;
            if (resp.status === 429 || resp.status === 401) break;
          } catch (e: unknown) {
            lastError = errMessage(e, lastError);
          }
        }
      }
      return NextResponse.json({ error: lastError }, { status: 502 });
    }

    // ── 3. Cohere Chat v2 ───────────────────────────────────────────────────────
    if (provider === 'cohere') {
      const requestedModel = aiSettings.model?.trim() || 'command-r';
      const candidateModels = Array.from(new Set([
        requestedModel,
        'command-r',
        'command-r-plus',
        'command-light',
      ])).filter(Boolean);

      const candidateKeys: string[] = [effectiveApiKey];
      if (Array.isArray(aiSettings.savedKeys)) {
        for (const k of aiSettings.savedKeys) {
          const c = k.apiKey?.trim();
          if (c && !candidateKeys.includes(c)) candidateKeys.push(c);
        }
      }

      let lastError = 'Cohere API call failed';
      for (const currentKey of candidateKeys) {
        for (const m of candidateModels) {
          try {
            const resp = await fetch('https://api.cohere.com/v2/chat', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${currentKey}`,
              },
              signal: AbortSignal.timeout(20000),
              body: JSON.stringify({
                model: m,
                messages: [
                  ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                  { role: 'user', content: prompt },
                ],
                temperature: aiSettings.temperature ?? 0.7,
              }),
            });

            if (resp.ok) {
              const data = await resp.json();
              const text = data.message?.content?.[0]?.text || data.text || '';
              const tokensUsed = (data.usage?.tokens?.input_tokens || 0) + (data.usage?.tokens?.output_tokens || 0) || 400;
              const costUSD = (tokensUsed / 1_000_000) * 0.15;
              return NextResponse.json({ text, tokensUsed, costUSD, modelUsed: m });
            }

            const errJson = await resp.json().catch(() => ({}));
            lastError = errJson.message || `Cohere status ${resp.status}`;
            if (resp.status === 404) continue;
            if (resp.status === 429 || resp.status === 401) break;
          } catch (e: unknown) {
            lastError = errMessage(e, lastError);
          }
        }
      }
      return NextResponse.json({ error: lastError }, { status: 502 });
    }

    // ── 4. OpenAI-Compatible (Groq, DeepSeek, Mistral, OpenRouter, OpenAI, HuggingFace, Custom) ──
    let endpoint = 'https://api.openai.com/v1/chat/completions';
    let defaultModel = 'gpt-4o-mini';

    if (provider === 'groq') {
      endpoint = 'https://api.groq.com/openai/v1/chat/completions';
      defaultModel = 'openai/gpt-oss-120b';
    } else if (provider === 'deepseek') {
      endpoint = 'https://api.deepseek.com/v1/chat/completions';
      defaultModel = 'deepseek-chat';
    } else if (provider === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      defaultModel = 'google/gemini-2.0-flash-exp:free';
    } else if (provider === 'mistral') {
      endpoint = 'https://api.mistral.ai/v1/chat/completions';
      defaultModel = 'mistral-small-latest';
    } else if (provider === 'huggingface') {
      endpoint = 'https://api-inference.huggingface.co/v1/chat/completions';
      defaultModel = 'meta-llama/Llama-3.2-3B-Instruct';
    } else if (provider === 'custom') {
      const candidateUrl = aiSettings.apiEndpoint?.trim() || 'http://localhost:11434/v1/chat/completions';
      try {
        const parsed = new URL(candidateUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return NextResponse.json({ error: 'Custom API endpoint must use http or https' }, { status: 400 });
        }
        // Protect against SSRF: block cloud metadata and internal subnets
        const isDev = process.env.NODE_ENV !== 'production';
        if (isPrivateOrReservedHost(parsed.hostname, isDev)) {
          return NextResponse.json(
            { error: 'Forbidden API endpoint: Private or cloud metadata addresses cannot be queried.' },
            { status: 403 }
          );
        }
        endpoint = candidateUrl;
      } catch {
        return NextResponse.json({ error: 'Invalid custom API endpoint URL' }, { status: 400 });
      }
      defaultModel = 'llama3';
    }

    const requestedModel = aiSettings.model?.trim() || defaultModel;

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    // Pool of keys for auto-failover
    const candidateKeys: string[] = [];
    if (effectiveApiKey) candidateKeys.push(effectiveApiKey);
    if (Array.isArray(aiSettings.savedKeys)) {
      for (const k of aiSettings.savedKeys) {
        const c = k.apiKey?.trim();
        if (c && !candidateKeys.includes(c)) candidateKeys.push(c);
      }
    }
    if (provider === 'groq') {
      if (envGroqKey1 && !candidateKeys.includes(envGroqKey1)) candidateKeys.push(envGroqKey1);
      if (envGroqKey2 && !candidateKeys.includes(envGroqKey2)) candidateKeys.push(envGroqKey2);
    }
    if (candidateKeys.length === 0) {
      candidateKeys.push(effectiveApiKey);
    }

    // Candidate models: if a model returns 404 (model not found / deprecated), fallback gracefully
    const candidateModels = provider === 'groq'
      ? Array.from(new Set([requestedModel, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'])).filter(Boolean)
      : provider === 'openai'
      ? Array.from(new Set([requestedModel, 'gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'])).filter(Boolean)
      : provider === 'deepseek'
      ? Array.from(new Set([requestedModel, 'deepseek-chat', 'deepseek-reasoner'])).filter(Boolean)
      : provider === 'mistral'
      ? Array.from(new Set([requestedModel, 'mistral-small-latest', 'codestral-latest', 'open-mistral-7b'])).filter(Boolean)
      : [requestedModel];

    let lastError = `Failed to connect to ${provider.toUpperCase()}`;
    let successfulModel = requestedModel;

    // Try keys in pool
    for (let keyIdx = 0; keyIdx < candidateKeys.length; keyIdx++) {
      const currentKey = candidateKeys[keyIdx];
      const hasBackupKey = keyIdx < candidateKeys.length - 1;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentKey}`,
      };

      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://lifeos.app';
        headers['X-Title'] = 'Sariling Mundo';
      }

      for (const m of candidateModels) {
        try {
          const resp = await fetch(endpoint, {
            method: 'POST',
            headers,
            signal: AbortSignal.timeout(20000),
            body: JSON.stringify({
              model: m,
              messages,
              temperature: aiSettings.temperature ?? 0.7,
              max_tokens: 2048,
            }),
          });

          if (resp.ok) {
            const data = await resp.json();
            const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning || '';
            const tokensUsed = data.usage?.total_tokens || 450;
            const costUSD = (tokensUsed / 1_000_000) * 0.15;
            successfulModel = m;

            return NextResponse.json({ text, tokensUsed, costUSD, modelUsed: successfulModel });
          }

          const errJson = await resp.json().catch(() => ({}));
          const rawErrMsg = errJson.error?.message || errJson.message || `API error (${resp.status})`;

          // Model not found (404) or retired -> try next candidate model
          if (resp.status === 404 || rawErrMsg.toLowerCase().includes('model') && rawErrMsg.toLowerCase().includes('not exist')) {
            lastError = rawErrMsg;
            continue;
          }

          // Rate limit or quota exhausted (429) or unauthorized (401) -> try next key if available
          if ((resp.status === 429 || resp.status === 401) && hasBackupKey) {
            console.warn(`[Life OS AI] Key #${keyIdx + 1} for ${provider} returned ${resp.status} (${rawErrMsg}). Switching to next key in pool...`);
            lastError = `Key #${keyIdx + 1} (${resp.status === 429 ? 'Rate limited' : 'Unauthorized'}). Failover active.`;
            break; // Break inner model loop to try NEXT key
          }

          if (resp.status === 401) {
            return NextResponse.json(
              { error: `Invalid API key for ${provider.toUpperCase()}. Please verify your key.` },
              { status: 401 }
            );
          }

          if (resp.status === 429) {
            return NextResponse.json(
              { error: `Rate limit or quota reached for ${provider.toUpperCase()}. Please wait or add a backup key.` },
              { status: 429 }
            );
          }

          return NextResponse.json({ error: rawErrMsg }, { status: resp.status });
        } catch (fetchErr: unknown) {
          const cause = errMessage(fetchErr, '');
          lastError = `Network connection to ${provider.toUpperCase()} failed${cause ? `: ${cause}` : ''}`;
        }
      }
    }

    return NextResponse.json({ error: lastError }, { status: 502 });
  } catch (error: unknown) {
    console.error('[AI Chat Route Error]:', error);
    return NextResponse.json(
      { error: 'Internal AI Server Proxy Error' },
      { status: 500 }
    );
  }
}
