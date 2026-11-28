import type { AIProvider } from '@/types';
import { isPrivateOrReservedHost } from './rateLimit';

function errMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const e = err as { cause?: { code?: string; message?: string }; message?: string };
    return e.cause?.code || e.cause?.message || e.message || fallback;
  }
  return fallback;
}

export interface ServerAiCompletionRequest {
  provider: AIProvider;
  model: string;
  candidateKeys: string[];
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  apiEndpoint?: string;
  maxTokens?: number;
}

export interface ServerAiCompletionResult {
  text: string;
  tokensUsed: number;
  costUSD: number;
  modelUsed: string;
}

export class ServerAiProxyError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function runServerAiCompletion(
  req: ServerAiCompletionRequest
): Promise<ServerAiCompletionResult> {
  const {
    provider,
    model,
    candidateKeys,
    prompt,
    systemPrompt = '',
    temperature = 0.7,
    apiEndpoint,
    maxTokens = 2048,
  } = req;

  if (candidateKeys.length === 0 && provider !== 'custom') {
    throw new ServerAiProxyError(
      `AI service is not configured yet for ${provider.toUpperCase()}. Ask the platform administrator to add an API key in Admin Console.`,
      503
    );
  }

  // 1. Google Gemini
  if (provider === 'gemini') {
    const rawModel = model.trim() || 'gemini-2.0-flash';
    let cleanModel = rawModel.replace(/^models\//, '');
    if (cleanModel === 'gemini-2.5-pro') cleanModel = 'gemini-3.1-pro-preview';

    const candidateModels = Array.from(
      new Set([
        cleanModel,
        'gemini-3.1-pro-preview',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
      ])
    ).filter(Boolean);

    let lastError = 'Gemini API call failed';
    for (const currentKey of candidateKeys) {
      for (const m of candidateModels) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          m
        )}:generateContent`;
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
                temperature,
                maxOutputTokens: maxTokens,
              },
            }),
          });

          if (resp.ok) {
            const data = (await resp.json()) as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
              usageMetadata?: { totalTokenCount?: number };
            };
            const text =
              data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
            const tokensUsed = data.usageMetadata?.totalTokenCount || 400;
            const costUSD = (tokensUsed / 1_000_000) * 0.075;
            return { text, tokensUsed, costUSD, modelUsed: m };
          }

          const errJson = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
          lastError = errJson.error?.message || `Gemini status ${resp.status}`;
          if (resp.status === 404 || resp.status === 400) continue;
          if (resp.status === 429 || resp.status === 401) break;
        } catch (e: unknown) {
          lastError = errMessage(e, lastError);
        }
      }
    }
    throw new ServerAiProxyError(lastError, 502);
  }

  // 2. Anthropic Claude
  if (provider === 'anthropic') {
    const requestedModel = model.trim() || 'claude-3-5-sonnet-latest';
    const candidateModels = Array.from(
      new Set([
        requestedModel,
        'claude-3-5-sonnet-latest',
        'claude-3-5-haiku-latest',
        'claude-3-opus-latest',
      ])
    ).filter(Boolean);

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
              max_tokens: maxTokens,
              system: systemPrompt || undefined,
              messages: [{ role: 'user', content: prompt }],
              temperature,
            }),
          });

          if (resp.ok) {
            const data = (await resp.json()) as {
              content?: Array<{ text?: string }>;
              usage?: { input_tokens?: number; output_tokens?: number };
            };
            const text = data.content?.[0]?.text || '';
            const tokensUsed =
              (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) || 450;
            const costUSD = (tokensUsed / 1_000_000) * 3.0;
            return { text, tokensUsed, costUSD, modelUsed: m };
          }

          const errJson = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
          lastError = errJson.error?.message || `Anthropic status ${resp.status}`;
          if (resp.status === 404) continue;
          if (resp.status === 429 || resp.status === 401) break;
        } catch (e: unknown) {
          lastError = errMessage(e, lastError);
        }
      }
    }
    throw new ServerAiProxyError(lastError, 502);
  }

  // 3. Cohere Chat v2
  if (provider === 'cohere') {
    const requestedModel = model.trim() || 'command-r';
    const candidateModels = Array.from(
      new Set([requestedModel, 'command-r', 'command-r-plus', 'command-light'])
    ).filter(Boolean);

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
              temperature,
            }),
          });

          if (resp.ok) {
            const data = (await resp.json()) as {
              message?: { content?: Array<{ text?: string }> };
              text?: string;
              usage?: { tokens?: { input_tokens?: number; output_tokens?: number } };
            };
            const text = data.message?.content?.[0]?.text || data.text || '';
            const tokensUsed =
              (data.usage?.tokens?.input_tokens || 0) + (data.usage?.tokens?.output_tokens || 0) ||
              400;
            const costUSD = (tokensUsed / 1_000_000) * 0.15;
            return { text, tokensUsed, costUSD, modelUsed: m };
          }

          const errJson = (await resp.json().catch(() => ({}))) as { message?: string };
          lastError = errJson.message || `Cohere status ${resp.status}`;
          if (resp.status === 404) continue;
          if (resp.status === 429 || resp.status === 401) break;
        } catch (e: unknown) {
          lastError = errMessage(e, lastError);
        }
      }
    }
    throw new ServerAiProxyError(lastError, 502);
  }

  // 4. OpenAI-Compatible (Groq, DeepSeek, OpenRouter, Mistral, HuggingFace, OpenAI, Custom)
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
    const candidateUrl = apiEndpoint?.trim() || 'http://localhost:11434/v1/chat/completions';
    let parsed: URL;
    try {
      parsed = new URL(candidateUrl);
    } catch {
      throw new ServerAiProxyError('Invalid custom API endpoint URL', 400);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new ServerAiProxyError('Custom API endpoint must use http or https', 400);
    }
    const isDev = process.env.NODE_ENV !== 'production';
    if (isPrivateOrReservedHost(parsed.hostname, isDev)) {
      throw new ServerAiProxyError(
        'Forbidden API endpoint: Private or cloud metadata addresses cannot be queried.',
        403
      );
    }
    endpoint = candidateUrl;
    defaultModel = 'llama3';
  }

  const requestedModel = model.trim() || defaultModel;
  const candidateModels =
    provider === 'groq'
      ? Array.from(
          new Set([requestedModel, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'])
        ).filter(Boolean)
      : provider === 'openai'
      ? Array.from(new Set([requestedModel, 'gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'])).filter(
          Boolean
        )
      : provider === 'deepseek'
      ? Array.from(new Set([requestedModel, 'deepseek-chat', 'deepseek-reasoner'])).filter(Boolean)
      : provider === 'mistral'
      ? Array.from(
          new Set([requestedModel, 'mistral-small-latest', 'codestral-latest', 'open-mistral-7b'])
        ).filter(Boolean)
      : [requestedModel];

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const keysToTry = candidateKeys.length > 0 ? candidateKeys : [''];
  let lastError = `Failed to connect to ${provider.toUpperCase()}`;

  for (let keyIdx = 0; keyIdx < keysToTry.length; keyIdx++) {
    const currentKey = keysToTry[keyIdx];
    const hasBackupKey = keyIdx < keysToTry.length - 1;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (currentKey) {
      headers.Authorization = `Bearer ${currentKey}`;
    }
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_SITE_URL || 'https://sarilingmundo.app';
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
            temperature,
            max_tokens: maxTokens,
          }),
        });

        if (resp.ok) {
          const data = (await resp.json()) as {
            choices?: Array<{ message?: { content?: string; reasoning?: string } }>;
            usage?: { total_tokens?: number };
          };
          const text =
            data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning || '';
          const tokensUsed = data.usage?.total_tokens || 450;
          const costUSD = (tokensUsed / 1_000_000) * 0.15;
          return { text, tokensUsed, costUSD, modelUsed: m };
        }

        const errJson = (await resp.json().catch(() => ({}))) as {
          error?: { message?: string };
          message?: string;
        };
        const rawErrMsg = errJson.error?.message || errJson.message || `API error (${resp.status})`;

        if (
          resp.status === 404 ||
          (rawErrMsg.toLowerCase().includes('model') && rawErrMsg.toLowerCase().includes('not exist'))
        ) {
          lastError = rawErrMsg;
          continue;
        }

        if ((resp.status === 429 || resp.status === 401) && hasBackupKey) {
          lastError = `Key #${keyIdx + 1} (${resp.status === 429 ? 'Rate limited' : 'Unauthorized'}). Failover active.`;
          break;
        }

        if (resp.status === 401) {
          throw new ServerAiProxyError(
            `Invalid API key configured for ${provider.toUpperCase()}. Contact administrator.`,
            401
          );
        }

        if (resp.status === 429) {
          throw new ServerAiProxyError(
            `Rate limit reached for ${provider.toUpperCase()}. Please wait a moment.`,
            429
          );
        }

        throw new ServerAiProxyError(rawErrMsg, resp.status);
      } catch (e: unknown) {
        if (e instanceof ServerAiProxyError) throw e;
        const cause = errMessage(e, '');
        lastError = `Network connection to ${provider.toUpperCase()} failed${cause ? `: ${cause}` : ''}`;
      }
    }
  }

  throw new ServerAiProxyError(lastError, 502);
}
