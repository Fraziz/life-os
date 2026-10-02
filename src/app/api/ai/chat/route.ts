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

    // ── 2. OpenAI-Compatible (Groq, DeepSeek, Mistral, OpenRouter, OpenAI, Custom) ──
    let endpoint = 'https://api.openai.com/v1/chat/completions';
    let defaultModel = 'gpt-4o-mini';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${effectiveApiKey}`,
    };

    if (provider === 'groq') {
      endpoint = 'https://api.groq.com/openai/v1/chat/completions';
      defaultModel = 'openai/gpt-oss-120b';
    } else if (provider === 'deepseek') {
      endpoint = 'https://api.deepseek.com/v1/chat/completions';
      defaultModel = 'deepseek-chat';
    } else if (provider === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      defaultModel = 'google/gemini-2.0-flash-exp:free';
      headers['HTTP-Referer'] = 'https://lifeos.app';
      headers['X-Title'] = 'Life OS';
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

    if (aiSettings.apiEndpoint?.trim()) {
      endpoint = aiSettings.apiEndpoint.trim();
    }

    const modelName = aiSettings.model?.trim() || defaultModel;

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    let resp = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature: aiSettings.temperature ?? 0.7,
        max_tokens: 2048,
      }),
    });

    // Auto-Failover to backup key if Groq returns 429 or 401
    if (!resp.ok && provider === 'groq' && (resp.status === 429 || resp.status === 401)) {
      const backupKey =
        aiSettings.savedKeys?.find((k: any) => k.apiKey && k.apiKey !== effectiveApiKey)?.apiKey || envGroqKey2;
      if (backupKey && backupKey !== effectiveApiKey) {
        resp = await fetch(endpoint, {
          method: 'POST',
          headers: { ...headers, Authorization: `Bearer ${backupKey}` },
          body: JSON.stringify({
            model: modelName,
            messages,
            temperature: aiSettings.temperature ?? 0.7,
            max_tokens: 2048,
          }),
        });
      }
    }

    if (!resp.ok) {
      const errJson = await resp.json().catch(() => ({}));
      const rawErrMsg = errJson.error?.message || errJson.message || `API error (${resp.status})`;
      if (resp.status === 401) {
        return NextResponse.json(
          { error: `Invalid API key for ${provider.toUpperCase()}. Please verify your key.` },
          { status: 401 }
        );
      }
      if (resp.status === 429) {
        return NextResponse.json(
          { error: `Rate limit or quota reached for ${provider.toUpperCase()}. Please wait or check your balance.` },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: rawErrMsg }, { status: resp.status });
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 450;
    const costUSD = (tokensUsed / 1_000_000) * 0.15;

    return NextResponse.json({ text, tokensUsed, costUSD, modelUsed: modelName });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal AI Server Proxy Error' },
      { status: 500 }
    );
  }
}
