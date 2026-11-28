'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bot, CheckCircle2, Eye, EyeOff, KeyRound, Plus, Trash2, Zap } from 'lucide-react';
import { writeSystemConfig, type SystemConfig } from '@/lib/systemConfig';
import type { AIProvider } from '@/types';
import type { AuditCategory } from './types';
import styles from '@/app/admin/page.module.css';

interface MaskedAdminAiSummary {
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

const PROVIDER_OPTIONS: Array<{
  id: AIProvider;
  label: string;
  models: string[];
}> = [
  { id: 'groq', label: 'Groq (Fast)', models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'] },
  { id: 'gemini', label: 'Google Gemini', models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-3.1-pro-preview'] },
  { id: 'openai', label: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'] },
  { id: 'anthropic', label: 'Anthropic Claude', models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'] },
  { id: 'openrouter', label: 'OpenRouter', models: ['google/gemini-2.0-flash-exp:free', 'meta-llama/llama-3.3-70b-instruct:free'] },
  { id: 'deepseek', label: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'mistral', label: 'Mistral AI', models: ['mistral-small-latest', 'codestral-latest'] },
  { id: 'cohere', label: 'Cohere', models: ['command-r', 'command-r-plus'] },
  { id: 'huggingface', label: 'HuggingFace', models: ['meta-llama/Llama-3.2-3B-Instruct'] },
  { id: 'custom', label: 'Custom Endpoint', models: ['llama3'] },
];

interface AdminAiSectionProps {
  systemConfig: SystemConfig;
  setSystemConfig: React.Dispatch<React.SetStateAction<SystemConfig>>;
  adminEmail: string;
  getBearerToken: () => Promise<string | null>;
  onAudit: (category: AuditCategory, action: string, detail: string) => Promise<void>;
  onNotify: (msg: string) => void;
  onRefreshAll: () => Promise<void>;
}

export default function AdminAiSection({
  systemConfig,
  setSystemConfig,
  adminEmail,
  getBearerToken,
  onAudit,
  onNotify,
  onRefreshAll,
}: AdminAiSectionProps) {
  const [summary, setSummary] = useState<MaskedAdminAiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [provider, setProvider] = useState<AIProvider>('groq');
  const [model, setModel] = useState('openai/gpt-oss-120b');
  const [primaryApiKeyInput, setPrimaryApiKeyInput] = useState('');
  const [showPrimaryKey, setShowPrimaryKey] = useState(false);
  const [backupKeyInput, setBackupKeyInput] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [autoFailover, setAutoFailover] = useState(true);

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    modelUsed?: string;
  } | null>(null);

  const loadAiSummary = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getBearerToken();
      if (!token) return;
      const resp = await fetch('/api/admin/ai-config', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!resp.ok) return;
      const data = (await resp.json()) as { ok?: boolean; summary?: MaskedAdminAiSummary };
      if (data?.summary) {
        setSummary(data.summary);
        setProvider(data.summary.provider);
        setModel(data.summary.model);
        setApiEndpoint(data.summary.apiEndpoint || '');
        setTemperature(data.summary.temperature ?? 0.7);
        setAutoFailover(data.summary.autoFailover !== false);
      }
    } finally {
      setLoading(false);
    }
  }, [getBearerToken]);

  useEffect(() => {
    void loadAiSummary();
  }, [loadAiSummary]);

  const handleProviderChange = (nextProvider: AIProvider) => {
    setProvider(nextProvider);
    const meta = PROVIDER_OPTIONS.find((p) => p.id === nextProvider);
    if (meta && meta.models.length > 0) {
      setModel(meta.models[0]);
    }
    setTestResult(null);
  };

  const syncSystemFlags = async (nextSummary: MaskedAdminAiSummary) => {
    const isReady =
      nextSummary.hasPrimaryKey ||
      nextSummary.backupKeyCount > 0 ||
      nextSummary.envFallbackCount > 0 ||
      nextSummary.provider === 'custom';

    const saved = await writeSystemConfig(
      {
        ...systemConfig,
        aiConfigured: isReady,
        aiProvider: nextSummary.provider,
        aiModel: nextSummary.model,
      },
      adminEmail
    );
    setSystemConfig(saved);

    const token = await getBearerToken();
    if (token) {
      await fetch('/api/admin/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'refresh-system-config' }),
      }).catch(() => undefined);
    }
  };

  const handleSaveAiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);
    try {
      const token = await getBearerToken();
      if (!token) return;
      const resp = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'save',
          provider,
          model: model.trim(),
          primaryApiKey: primaryApiKeyInput.trim() || undefined,
          apiEndpoint: provider === 'custom' ? apiEndpoint.trim() : '',
          temperature,
          autoFailover,
        }),
      });
      const payload = (await resp.json()) as {
        ok?: boolean;
        error?: string;
        summary?: MaskedAdminAiSummary;
      };
      if (!resp.ok || !payload.summary) {
        onNotify(payload.error || 'Failed to save platform AI configuration.');
        return;
      }

      setSummary(payload.summary);
      setPrimaryApiKeyInput('');
      await syncSystemFlags(payload.summary);
      await onAudit(
        'config',
        'Updated Platform AI API',
        `Provider=${payload.summary.provider}, Model=${payload.summary.model}, KeySet=${
          payload.summary.hasPrimaryKey ? 'Yes' : 'No'
        }, Backups=${payload.summary.backupKeyCount}`
      );
      onNotify('Platform AI configuration saved. All signed-in users can now use AI automatically.');
      await onRefreshAll();
    } finally {
      setSaving(false);
    }
  };

  const handleAddBackupKey = async () => {
    if (!backupKeyInput.trim()) return;
    setSaving(true);
    try {
      const token = await getBearerToken();
      if (!token) return;
      const resp = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'add-backup-key',
          addBackupKey: backupKeyInput.trim(),
        }),
      });
      const payload = (await resp.json()) as { summary?: MaskedAdminAiSummary; error?: string };
      if (!resp.ok || !payload.summary) {
        onNotify(payload.error || 'Could not add backup key.');
        return;
      }
      setSummary(payload.summary);
      setBackupKeyInput('');
      await syncSystemFlags(payload.summary);
      await onAudit('config', 'Added AI Failover Backup Key', `Provider=${payload.summary.provider}`);
      onNotify('Backup API key added to failover pool.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveBackupKey = async (idx: number) => {
    setSaving(true);
    try {
      const token = await getBearerToken();
      if (!token) return;
      const resp = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'remove-backup-key',
          removeBackupIndex: idx,
        }),
      });
      const payload = (await resp.json()) as { summary?: MaskedAdminAiSummary };
      if (resp.ok && payload.summary) {
        setSummary(payload.summary);
        await syncSystemFlags(payload.summary);
        await onAudit('config', 'Removed AI Backup Key', `Index=${idx}`);
        onNotify('Removed backup key.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClearKeys = async () => {
    setSaving(true);
    try {
      const token = await getBearerToken();
      if (!token) return;
      const resp = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'clear-keys' }),
      });
      const payload = (await resp.json()) as { summary?: MaskedAdminAiSummary };
      if (resp.ok && payload.summary) {
        setSummary(payload.summary);
        setPrimaryApiKeyInput('');
        await syncSystemFlags(payload.summary);
        await onAudit('config', 'Cleared Platform AI Vault Keys', 'Admin cleared saved API keys.');
        onNotify('Cleared saved AI keys from server vault.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const token = await getBearerToken();
      if (!token) return;
      const resp = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'test',
          provider,
          model: model.trim(),
          primaryApiKey: primaryApiKeyInput.trim() || undefined,
          apiEndpoint: provider === 'custom' ? apiEndpoint.trim() : '',
        }),
      });
      const res = (await resp.json()) as {
        success?: boolean;
        message?: string;
        latencyMs?: number;
        modelUsed?: string;
      };
      setTestResult({
        success: Boolean(res.success),
        message: res.message || 'Unable to verify AI endpoint.',
        latencyMs: res.latencyMs,
        modelUsed: res.modelUsed,
      });
    } finally {
      setTesting(false);
    }
  };

  const currentProviderMeta = PROVIDER_OPTIONS.find((p) => p.id === provider) || PROVIDER_OPTIONS[0];

  if (loading && !summary) {
    return (
      <section className={styles.card}>
        <div className={styles.emptyState}>Loading server AI vault configuration…</div>
      </section>
    );
  }

  return (
    <form onSubmit={handleSaveAiConfig} className={styles.stackGap}>
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Centralized Platform AI Credentials</h2>
            <p className={styles.cardDesc}>
              Configure the shared LLM provider and API keys strictly on the server. Signed-in users automatically access AI without entering or seeing API keys.
            </p>
          </div>
          <span className={styles.statusPill}>
            <span
              className={`${styles.statusDot} ${
                summary?.hasPrimaryKey || (summary?.envFallbackCount ?? 0) > 0
                  ? styles.statusDotOk
                  : styles.statusDotWarn
              }`}
              aria-hidden="true"
            />
            <span>
              {summary?.hasPrimaryKey
                ? `Key Active (${summary.maskedPrimaryKey})`
                : (summary?.envFallbackCount ?? 0) > 0
                ? `${summary?.envFallbackCount} Server Env Key(s)`
                : 'No Key Configured'}
            </span>
          </span>
        </div>

        <div className={styles.checkList}>
          <div className={styles.checkRow}>
            <span>Vault Persistence Layer</span>
            <span className={styles.mono}>{summary?.persistenceBackend || 'local-file+memory'}</span>
          </div>
          <div className={styles.checkRow}>
            <span>Detected Env Provider Keys</span>
            <span className={styles.mono}>
              {summary && summary.envProvidersDetected.length > 0
                ? summary.envProvidersDetected.join(', ')
                : 'None set in env'}
            </span>
          </div>
        </div>

        {/* Provider Selection */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>AI Provider</label>
          <div className={styles.chipRow}>
            {PROVIDER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`${styles.tabBtn} ${provider === opt.id ? styles.tabBtnActive : ''}`}
                onClick={() => handleProviderChange(opt.id)}
              >
                <Bot size={13} />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Model Selection */}
        <div className={styles.panelGrid}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="admin-ai-model">
              Default Model ID
            </label>
            <input
              id="admin-ai-model"
              type="text"
              className={styles.input}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. openai/gpt-oss-120b"
            />
            <div className={styles.chipRow}>
              {currentProviderMeta.models.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={styles.miniBtn}
                  onClick={() => setModel(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="admin-ai-temp">
              Default Temperature (0.0 – 1.5)
            </label>
            <input
              id="admin-ai-temp"
              type="number"
              step={0.05}
              min={0}
              max={1.5}
              className={styles.input}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value) || 0.7)}
            />
          </div>
        </div>

        {provider === 'custom' && (
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="admin-ai-endpoint">
              Custom OpenAI-Compatible Endpoint URL
            </label>
            <input
              id="admin-ai-endpoint"
              type="url"
              className={styles.input}
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="https://api.example.com/v1/chat/completions"
            />
          </div>
        )}

        {/* Primary API Key */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="admin-ai-primary-key">
            Primary API Key {summary?.hasPrimaryKey ? `(Stored: ${summary.maskedPrimaryKey})` : ''}
          </label>
          <div className={styles.actionsRow}>
            <input
              id="admin-ai-primary-key"
              type={showPrimaryKey ? 'text' : 'password'}
              className={styles.searchInput}
              autoComplete="off"
              value={primaryApiKeyInput}
              onChange={(e) => setPrimaryApiKeyInput(e.target.value)}
              placeholder={
                summary?.hasPrimaryKey
                  ? 'Leave blank to keep stored primary key, or paste new key to replace…'
                  : `Paste ${currentProviderMeta.label} API key…`
              }
            />
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setShowPrimaryKey((prev) => !prev)}
              aria-label={showPrimaryKey ? 'Hide key' : 'Show key'}
            >
              {showPrimaryKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Auto Failover Toggle & Backup Pool */}
        <label className={styles.toggleRow}>
          <div className={styles.toggleLabel}>
            <span className={styles.toggleTitle}>Automatic Backup Key Failover</span>
            <span className={styles.toggleDesc}>
              Automatically rotate through backup keys when primary returns 429 rate-limit or quota exhaustion.
            </span>
          </div>
          <input
            type="checkbox"
            className={styles.checkboxInput}
            checked={autoFailover}
            onChange={(e) => setAutoFailover(e.target.checked)}
          />
        </label>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="admin-ai-backup-key">
            Add Backup Failover Key ({summary?.backupKeyCount || 0} stored)
          </label>
          <div className={styles.actionsRow}>
            <input
              id="admin-ai-backup-key"
              type="password"
              className={styles.searchInput}
              autoComplete="off"
              value={backupKeyInput}
              onChange={(e) => setBackupKeyInput(e.target.value)}
              placeholder="Paste secondary API key for automatic pool failover…"
            />
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={saving || !backupKeyInput.trim()}
              onClick={() => void handleAddBackupKey()}
            >
              <Plus size={14} />
              <span>Add Backup Key</span>
            </button>
          </div>

          {summary && summary.backupKeysMasked.length > 0 && (
            <div className={styles.checkList} style={{ marginTop: 8 }}>
              {summary.backupKeysMasked.map((masked, idx) => (
                <div key={`${masked}-${idx}`} className={styles.checkRow}>
                  <span className={styles.mono}>
                    <KeyRound size={12} style={{ display: 'inline', marginRight: 6 }} />
                    Backup #{idx + 1}: {masked}
                  </span>
                  <button
                    type="button"
                    className={styles.miniBtn}
                    disabled={saving}
                    onClick={() => void handleRemoveBackupKey(idx)}
                  >
                    <Trash2 size={13} />
                    <span>Remove</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {testResult && (
          <div className={styles.noticeBar} role="status">
            {testResult.success ? (
              <span>
                <CheckCircle2 size={14} style={{ display: 'inline', marginRight: 6 }} />
                Connected to <strong>{provider.toUpperCase()}</strong> ({testResult.modelUsed || model}) in{' '}
                <strong>{testResult.latencyMs}ms</strong> — &ldquo;{testResult.message}&rdquo;
              </span>
            ) : (
              <span>Connection failed ({testResult.latencyMs}ms): {testResult.message}</span>
            )}
          </div>
        )}

        <div className={styles.actionsRow}>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? 'Saving AI Vault…' : 'Save & Activate for All Users'}
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={testing || saving}
            onClick={() => void handleTestConnection()}
          >
            <Zap size={14} />
            <span>{testing ? 'Testing Connection…' : 'Test Connection'}</span>
          </button>
          {(summary?.hasPrimaryKey || (summary?.backupKeyCount ?? 0) > 0) && (
            <button
              type="button"
              className={styles.dangerBtn}
              disabled={saving}
              onClick={() => void handleClearKeys()}
            >
              <Trash2 size={14} />
              <span>Clear Stored Keys</span>
            </button>
          )}
        </div>
      </section>
    </form>
  );
}
