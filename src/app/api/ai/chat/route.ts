import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, systemPrompt = '', aiSettings } = body;

    if (!aiSettings) {
      return NextResponse.json({ error: 'AI Settings are required' }, { status: 400 });
    }

    const provider = aiSettings.provider || 'gemini';
    const rawApiKey = (aiSettings.apiKey || '').trim();

    // Fallback to server env keys for Groq if client key is blank
    const envGroqKey1 = process.env.NEXT_PUBLIC_GROQ_API_KEY_1 || process.env.NEXT_PUBLIC_GROQ_API_KEY || '';
    const envGroqKey2 = process.env.NEXT_PUBLIC_GROQ_API_KEY_2 || '';
    const effectiveApiKey = rawApiKey || (provider === 'groq' ? envGroqKey1 : '');

    if (!effectiveApiKey && provider !== 'custom') {
      return NextResponse.json(
        { error: `API key is missing for ${provider.toUpperCase()}. Please configure your API key in Settings.` },
        { status: 400 }
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
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${currentKey}`;
          try {
            const resp = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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
              const data = await resp.json();
              const text =
                data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ||
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
          } catch (e: any) {
            lastError = e?.message || lastError;
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
          } catch (e: any) {
            lastError = e?.message || lastError;
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
          } catch (e: any) {
            lastError = e?.message || lastError;
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
      endpoint = aiSettings.apiEndpoint?.trim() || 'http://localhost:11434/v1/chat/completions';
      defaultModel = 'llama3';
    }

    // ONLY custom provider should ever override the API endpoint with apiEndpoint
    if (provider === 'custom' && aiSettings.apiEndpoint?.trim()) {
      endpoint = aiSettings.apiEndpoint.trim();
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
        headers['X-Title'] = 'Life OS';
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
        } catch (fetchErr: any) {
          const cause = fetchErr?.cause?.code || fetchErr?.cause?.message || fetchErr?.message || '';
          lastError = `Network connection to ${provider.toUpperCase()} failed${cause ? `: ${cause}` : ''}`;
        }
      }
    }

    return NextResponse.json({ error: lastError }, { status: 502 });
  } catch (error: any) {
    const errorDetails = error?.cause ? ` (${error.cause.code || error.cause.message || error.cause})` : '';
    console.error('[AI Chat Route Error]:', error);
    return NextResponse.json(
      { error: (error?.message || 'Internal AI Server Proxy Error') + errorDetails },
      { status: 500 }
    );
  }
}
