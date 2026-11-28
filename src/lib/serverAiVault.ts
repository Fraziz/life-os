import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AIProvider } from '@/types';
import { isPrivateOrReservedHost } from './rateLimit';

export const SUPPORTED_AI_PROVIDERS: AIProvider[] = [
  'groq',
  'gemini',
  'openai',
  'anthropic',
  'openrouter',
  'deepseek',
  'mistral',
  'cohere',
  'huggingface',
  'custom',
];

export const DEFAULT_PROVIDER_MODELS: Record<AIProvider, string> = {
  groq: 'openai/gpt-oss-120b',
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-latest',
  openrouter: 'google/gemini-2.0-flash-exp:free',
  deepseek: 'deepseek-chat',
  mistral: 'mistral-small-latest',
  cohere: 'command-r',
  huggingface: 'meta-llama/Llama-3.2-3B-Instruct',
  custom: 'llama3',
};

export interface ServerAiVaultConfig {
  provider: AIProvider;
  model: string;
  primaryApiKey: string;
  backupApiKeys: string[];
  apiEndpoint?: string;
  temperature: number;
  autoFailover: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface MaskedAdminAiSummary {
  provider: AIProvider;
  model: string;
  apiEndpoint: string;
  temperature: number;
  autoFailover: boolean;
  hasPrimaryKey: boolean;
  maskedPrimaryKey: string;
  backupKeysMasked: string[];
  backupKeyCount: number;
  envFallbackCount: number;
  envProvidersDetected: AIProvider[];
  persistenceBackend: 'redis+memory' | 'local-file+memory' | 'memory-only';
  updatedAt?: string;
  updatedBy?: string;
}

const VAULT_FILE_PATH = path.join(process.cwd(), '.lifeos-ai-vault.json');
const REDIS_VAULT_KEY = 'lifeos:admin:ai_vault:v1';

let memoryVault: ServerAiVaultConfig | null = null;
let loadedFromBackend = false;

function normalizeProvider(raw: unknown): AIProvider {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return SUPPORTED_AI_PROVIDERS.includes(s as AIProvider) ? (s as AIProvider) : 'groq';
}

export function maskSecretKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

function defaultVaultConfig(): ServerAiVaultConfig {
  return {
    provider: 'groq',
    model: DEFAULT_PROVIDER_MODELS.groq,
    primaryApiKey: '',
    backupApiKeys: [],
    apiEndpoint: '',
    temperature: 0.7,
    autoFailover: true,
  };
}

function sanitizeVaultPayload(raw: Partial<ServerAiVaultConfig> | null | undefined): ServerAiVaultConfig {
  const provider = normalizeProvider(raw?.provider);
  const model =
    typeof raw?.model === 'string' && raw.model.trim()
      ? raw.model.trim().slice(0, 120)
      : DEFAULT_PROVIDER_MODELS[provider];

  const primaryApiKey = typeof raw?.primaryApiKey === 'string' ? raw.primaryApiKey.trim().slice(0, 512) : '';
  const backupApiKeys = Array.isArray(raw?.backupApiKeys)
    ? Array.from(
        new Set(
          raw.backupApiKeys
            .map((k) => (typeof k === 'string' ? k.trim().slice(0, 512) : ''))
            .filter((k) => Boolean(k) && k !== primaryApiKey)
        )
      ).slice(0, 10)
    : [];

  let apiEndpoint = typeof raw?.apiEndpoint === 'string' ? raw.apiEndpoint.trim().slice(0, 300) : '';
  if (provider !== 'custom') {
    apiEndpoint = '';
  }

  const rawTemp = Number(raw?.temperature);
  const temperature = Number.isFinite(rawTemp)
    ? Math.max(0, Math.min(1.5, Math.round(rawTemp * 100) / 100))
    : 0.7;

  return {
    provider,
    model,
    primaryApiKey,
    backupApiKeys,
    apiEndpoint,
    temperature,
    autoFailover: raw?.autoFailover !== false,
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : undefined,
    updatedBy: typeof raw?.updatedBy === 'string' ? raw.updatedBy : undefined,
  };
}

function getVaultEncryptionKey(): Buffer | null {
  const secret = (process.env.AI_VAULT_SECRET || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!secret) return null;
  return crypto.createHash('sha256').update(`lifeos-ai-vault:${secret}`).digest();
}

function encryptVaultJson(plainText: string): string {
  const key = getVaultEncryptionKey();
  if (!key) return plainText;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptVaultJson(raw: string): string | null {
  if (!raw.startsWith('enc1:')) return raw;
  const key = getVaultEncryptionKey();
  if (!key) return null;
  const parts = raw.split(':');
  if (parts.length !== 4) return null;
  try {
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const data = Buffer.from(parts[3], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

async function readFromRedis(): Promise<ServerAiVaultConfig | null> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!redisUrl || !redisToken) return null;
  try {
    const resp = await fetch(`${redisUrl.replace(/\/$/, '')}/get/${encodeURIComponent(REDIS_VAULT_KEY)}`, {
      headers: { Authorization: `Bearer ${redisToken}` },
      signal: AbortSignal.timeout(2000),
      cache: 'no-store',
    });
    if (!resp.ok) return null;
    const body = (await resp.json()) as { result?: string | null };
    if (!body?.result) return null;
    const decrypted = decryptVaultJson(body.result);
    if (!decrypted) return null;
    return sanitizeVaultPayload(JSON.parse(decrypted) as Partial<ServerAiVaultConfig>);
  } catch {
    return null;
  }
}

async function writeToRedis(config: ServerAiVaultConfig): Promise<boolean> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!redisUrl || !redisToken) return false;
  try {
    const serialized = encryptVaultJson(JSON.stringify(config));
    const resp = await fetch(`${redisUrl.replace(/\/$/, '')}/set/${encodeURIComponent(REDIS_VAULT_KEY)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serialized),
      signal: AbortSignal.timeout(2500),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function readFromLocalFile(): Promise<ServerAiVaultConfig | null> {
  try {
    const content = await fs.readFile(VAULT_FILE_PATH, 'utf8');
    const decrypted = decryptVaultJson(content.trim());
    if (!decrypted) return null;
    return sanitizeVaultPayload(JSON.parse(decrypted) as Partial<ServerAiVaultConfig>);
  } catch {
    return null;
  }
}

async function writeToLocalFile(config: ServerAiVaultConfig): Promise<boolean> {
  try {
    const serialized = encryptVaultJson(JSON.stringify(config));
    await fs.writeFile(VAULT_FILE_PATH, serialized, { encoding: 'utf8', mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

export async function getServerAiVault(forceReload = false): Promise<ServerAiVaultConfig> {
  if (!forceReload && loadedFromBackend && memoryVault) {
    return memoryVault;
  }

  const fromRedis = await readFromRedis();
  if (fromRedis) {
    memoryVault = fromRedis;
    loadedFromBackend = true;
    return fromRedis;
  }

  const fromFile = await readFromLocalFile();
  if (fromFile) {
    memoryVault = fromFile;
    loadedFromBackend = true;
    return fromFile;
  }

  if (!memoryVault) {
    memoryVault = defaultVaultConfig();
  }
  loadedFromBackend = true;
  return memoryVault;
}

export async function saveServerAiVault(
  patch: {
    provider?: unknown;
    model?: unknown;
    primaryApiKey?: unknown;
    clearPrimaryKey?: boolean;
    backupApiKeys?: unknown;
    apiEndpoint?: unknown;
    temperature?: unknown;
    autoFailover?: unknown;
  },
  actorEmail: string
): Promise<{ config: ServerAiVaultConfig; persistenceBackend: MaskedAdminAiSummary['persistenceBackend'] }> {
  const existing = await getServerAiVault(true);
  const nextProvider = patch.provider !== undefined ? normalizeProvider(patch.provider) : existing.provider;

  if (nextProvider === 'custom' && typeof patch.apiEndpoint === 'string' && patch.apiEndpoint.trim()) {
    const parsed = new URL(patch.apiEndpoint.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Custom AI endpoint must start with http:// or https://');
    }
    const isDev = process.env.NODE_ENV !== 'production';
    if (isPrivateOrReservedHost(parsed.hostname, isDev)) {
      throw new Error('Forbidden custom endpoint: private network or cloud metadata addresses cannot be saved.');
    }
  }

  let nextPrimaryKey = existing.primaryApiKey;
  if (patch.clearPrimaryKey) {
    nextPrimaryKey = '';
  } else if (typeof patch.primaryApiKey === 'string' && patch.primaryApiKey.trim()) {
    nextPrimaryKey = patch.primaryApiKey.trim();
  }

  const nextBackupKeys = Array.isArray(patch.backupApiKeys)
    ? (patch.backupApiKeys as string[])
    : existing.backupApiKeys;

  const nextConfig = sanitizeVaultPayload({
    provider: nextProvider,
    model: typeof patch.model === 'string' ? patch.model : existing.model,
    primaryApiKey: nextPrimaryKey,
    backupApiKeys: nextBackupKeys,
    apiEndpoint: typeof patch.apiEndpoint === 'string' ? patch.apiEndpoint : existing.apiEndpoint,
    temperature: patch.temperature !== undefined ? Number(patch.temperature) : existing.temperature,
    autoFailover: patch.autoFailover !== undefined ? Boolean(patch.autoFailover) : existing.autoFailover,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail,
  });

  memoryVault = nextConfig;
  loadedFromBackend = true;

  const savedRedis = await writeToRedis(nextConfig);
  const savedFile = await writeToLocalFile(nextConfig);

  const persistenceBackend: MaskedAdminAiSummary['persistenceBackend'] = savedRedis
    ? 'redis+memory'
    : savedFile
    ? 'local-file+memory'
    : 'memory-only';

  return { config: nextConfig, persistenceBackend };
}

export async function clearServerAiKeys(actorEmail: string) {
  return saveServerAiVault(
    {
      clearPrimaryKey: true,
      backupApiKeys: [],
    },
    actorEmail
  );
}

export function getEnvKeysForProvider(provider: AIProvider): string[] {
  const keys: string[] = [];
  const push = (val: string | undefined) => {
    const clean = val?.trim();
    if (clean && !keys.includes(clean)) keys.push(clean);
  };

  if (provider === 'groq') {
    push(process.env.GROQ_API_KEY_1);
    push(process.env.GROQ_API_KEY);
    push(process.env.GROQ_API_KEY_2);
  } else if (provider === 'gemini') {
    push(process.env.GEMINI_API_KEY);
  } else if (provider === 'openai') {
    push(process.env.OPENAI_API_KEY);
  } else if (provider === 'anthropic') {
    push(process.env.ANTHROPIC_API_KEY);
  } else if (provider === 'openrouter') {
    push(process.env.OPENROUTER_API_KEY);
  } else if (provider === 'deepseek') {
    push(process.env.DEEPSEEK_API_KEY);
  } else if (provider === 'mistral') {
    push(process.env.MISTRAL_API_KEY);
  } else if (provider === 'cohere') {
    push(process.env.COHERE_API_KEY);
  } else if (provider === 'huggingface') {
    push(process.env.HUGGINGFACE_API_KEY);
  }
  return keys;
}

export function listEnvProvidersConfigured(): AIProvider[] {
  return SUPPORTED_AI_PROVIDERS.filter((p) => p !== 'custom' && getEnvKeysForProvider(p).length > 0);
}

export async function getEffectiveServerAiConfig(): Promise<{
  provider: AIProvider;
  model: string;
  apiEndpoint: string;
  temperature: number;
  autoFailover: boolean;
  candidateKeys: string[];
}> {
  const vault = await getServerAiVault(false);
  const candidateKeys: string[] = [];

  if (vault.primaryApiKey) {
    candidateKeys.push(vault.primaryApiKey);
  }
  if (vault.autoFailover) {
    for (const bk of vault.backupApiKeys) {
      if (bk && !candidateKeys.includes(bk)) candidateKeys.push(bk);
    }
  }
  for (const ek of getEnvKeysForProvider(vault.provider)) {
    if (!candidateKeys.includes(ek)) candidateKeys.push(ek);
  }

  return {
    provider: vault.provider,
    model: vault.model || DEFAULT_PROVIDER_MODELS[vault.provider],
    apiEndpoint: vault.apiEndpoint || '',
    temperature: vault.temperature,
    autoFailover: vault.autoFailover,
    candidateKeys,
  };
}

export async function getMaskedAdminAiSummary(): Promise<MaskedAdminAiSummary> {
  const vault = await getServerAiVault(false);
  const envKeys = getEnvKeysForProvider(vault.provider);
  const hasRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  let hasFile = false;
  if (!hasRedis) {
    try {
      await fs.access(VAULT_FILE_PATH);
      hasFile = true;
    } catch {
      hasFile = false;
    }
  }

  return {
    provider: vault.provider,
    model: vault.model,
    apiEndpoint: vault.apiEndpoint || '',
    temperature: vault.temperature,
    autoFailover: vault.autoFailover,
    hasPrimaryKey: Boolean(vault.primaryApiKey),
    maskedPrimaryKey: maskSecretKey(vault.primaryApiKey),
    backupKeysMasked: vault.backupApiKeys.map(maskSecretKey),
    backupKeyCount: vault.backupApiKeys.length,
    envFallbackCount: envKeys.length,
    envProvidersDetected: listEnvProvidersConfigured(),
    persistenceBackend: hasRedis ? 'redis+memory' : hasFile ? 'local-file+memory' : 'memory-only',
    updatedAt: vault.updatedAt,
    updatedBy: vault.updatedBy,
  };
}
