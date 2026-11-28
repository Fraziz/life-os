'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { RefreshCw, ShieldCheck, Users, Sliders, FileText, Server, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import {
  DEFAULT_SYSTEM_CONFIG,
  readSystemConfig,
  writeSystemConfig,
  type SystemConfig,
} from '@/lib/systemConfig';
import PageSkeleton from '@/components/ui/PageSkeleton';
import statusStyles from '../status.module.css';
import styles from './page.module.css';

type AdminTab = 'overview' | 'users' | 'controls' | 'audit';

interface OverviewApiResponse {
  authorized: boolean;
  admin: {
    uid: string;
    email: string;
    verifiedVia: string;
  };
  runtime: {
    nodeVersion: string;
    nodeEnv: string;
    uptimeSeconds: number;
    serverTime: string;
  };
  infrastructure: {
    firebaseProjectConfigured: boolean;
    siteOriginConfigured: boolean;
    upstashRedisConfigured: boolean;
    groqKeyPoolCount: number;
    geminiKeyConfigured: boolean;
    openaiKeyConfigured: boolean;
    anthropicKeyConfigured: boolean;
    customAdminAllowlistConfigured: boolean;
  };
  caches: {
    rateLimit: { activeBuckets: number; totalTracked: number; maxEntries: number };
    linkPreview: { entries: number; maxEntries: number };
  };
}

interface DirectoryUserRecord {
  uid: string;
  email: string;
  displayName: string;
  provider: string;
  emailVerified: boolean;
  createdAt?: string;
  lastActiveAt?: string;
}

interface AuditEntry {
  id: string;
  action: string;
  detail: string;
  actorEmail: string;
  createdAt: string;
}

function formatUptime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${s % 60}s`;
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '—';
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatProvider(raw: string): string {
  if (raw === 'google.com') return 'Google';
  if (raw === 'password') return 'Email / Password';
  return raw || 'Email';
}

export default function AdminConsolePage() {
  const { user, isGuest, ready } = useAuth();
  const [authStatus, setAuthStatus] = useState<'checking' | 'authorized' | 'denied'>('checking');
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  const [overview, setOverview] = useState<OverviewApiResponse | null>(null);
  const [usersList, setUsersList] = useState<DirectoryUserRecord[]>([]);
  const [auditList, setAuditList] = useState<AuditEntry[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);

  const [busy, setBusy] = useState(false);
  const [savingControls, setSavingControls] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<'all' | 'google.com' | 'password'>('all');

  const getBearerToken = useCallback(async () => {
    const fbUser = getFirebaseAuth().currentUser;
    if (!fbUser) return null;
    return fbUser.getIdToken();
  }, []);

  const appendAudit = useCallback(async (action: string, detail: string, actorEmail: string) => {
    try {
      await addDoc(collection(getFirebaseDb(), 'app', 'adminAudit'), {
        action,
        detail,
        actorEmail,
        createdAt: new Date().toISOString(),
        ts: serverTimestamp(),
      });
    } catch {
      // Non-fatal if audit rules are not yet deployed
    }
  }, []);

  const loadConsoleData = useCallback(async () => {
    if (!user || isGuest) {
      setAuthStatus('denied');
      return;
    }

    setBusy(true);
    try {
      const token = await getBearerToken();
      if (!token) {
        setAuthStatus('denied');
        return;
      }

      const resp = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      if (!resp.ok) {
        setAuthStatus('denied');
        return;
      }

      const ovData = (await resp.json()) as OverviewApiResponse;
      if (!ovData?.authorized) {
        setAuthStatus('denied');
        return;
      }

      setOverview(ovData);
      setAuthStatus('authorized');

      const db = getFirebaseDb();

      const [cfgResult, usersResult, auditResult] = await Promise.allSettled([
        readSystemConfig(),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'app', 'adminAudit'), orderBy('ts', 'desc'), limit(50))),
      ]);

      if (cfgResult.status === 'fulfilled') {
        setSystemConfig(cfgResult.value);
      }

      if (usersResult.status === 'fulfilled') {
        const parsedUsers: DirectoryUserRecord[] = usersResult.value.docs.map((snap) => {
          const d = snap.data() as Partial<DirectoryUserRecord>;
          return {
            uid: snap.id,
            email: d.email || '—',
            displayName: d.displayName || '',
            provider: d.provider || 'password',
            emailVerified: Boolean(d.emailVerified),
            createdAt: d.createdAt,
            lastActiveAt: d.lastActiveAt,
          };
        });
        parsedUsers.sort((a, b) =>
          (b.lastActiveAt || b.createdAt || '').localeCompare(a.lastActiveAt || a.createdAt || '')
        );
        setUsersList(parsedUsers);
      }

      if (auditResult.status === 'fulfilled') {
        const entries: AuditEntry[] = auditResult.value.docs.map((snap) => {
          const d = snap.data() as Partial<AuditEntry>;
          return {
            id: snap.id,
            action: d.action || 'Admin Action',
            detail: d.detail || '',
            actorEmail: d.actorEmail || ovData.admin.email,
            createdAt: d.createdAt || '',
          };
        });
        setAuditList(entries);
      }
    } catch {
      setAuthStatus('denied');
    } finally {
      setBusy(false);
    }
  }, [user, isGuest, getBearerToken]);

  useEffect(() => {
    if (!ready) return;
    void loadConsoleData();
  }, [ready, loadConsoleData]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return usersList.filter((u) => {
      if (providerFilter !== 'all' && u.provider !== providerFilter) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    });
  }, [usersList, userSearch, providerFilter]);

  const stats = useMemo(() => {
    const now = Date.now();
    const active24h = usersList.filter((u) => {
      const ms = u.lastActiveAt ? Date.parse(u.lastActiveAt) : NaN;
      return !Number.isNaN(ms) && now - ms <= 24 * 60 * 60 * 1000;
    }).length;
    const googleCount = usersList.filter((u) => u.provider === 'google.com').length;
    return {
      totalUsers: usersList.length,
      active24h,
      googleCount,
      emailCount: Math.max(0, usersList.length - googleCount),
    };
  }, [usersList]);

  const showStatusMessage = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleServerCacheAction = async (action: 'clear-rate-limits' | 'clear-link-cache') => {
    setBusy(true);
    try {
      const token = await getBearerToken();
      if (!token) return;
      const resp = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      if (!resp.ok) {
        showStatusMessage('Server rejected administrative action.');
        return;
      }
      const data = (await resp.json()) as { cleared?: number };
      const label = action === 'clear-rate-limits' ? 'Rate-Limit Reset' : 'Link Cache Flush';
      const detail = `Cleared ${data.cleared ?? 0} in-memory entries.`;
      if (overview?.admin.email) {
        await appendAudit(label, detail, overview.admin.email);
      }
      showStatusMessage(`${label}: ${detail}`);
      await loadConsoleData();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveControls = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingControls(true);
    try {
      const saved = await writeSystemConfig(systemConfig, overview?.admin.email);
      setSystemConfig(saved);
      if (overview?.admin.email) {
        await appendAudit(
          'Platform Controls Updated',
          `Registrations=${saved.allowRegistrations ? 'Open' : 'Paused'}, Guest=${saved.allowGuestMode ? 'Enabled' : 'Disabled'}, Banner=${saved.bannerEnabled ? 'On' : 'Off'}`,
          overview.admin.email
        );
      }
      showStatusMessage('Platform controls published to Firestore.');
      await loadConsoleData();
    } catch (err: unknown) {
      showStatusMessage(
        err instanceof Error ? err.message : 'Unable to save platform settings. Verify Firestore rules.'
      );
    } finally {
      setSavingControls(false);
    }
  };

  const handleRemoveUserDirectoryEntry = async (targetUid: string, targetEmail: string) => {
    if (targetUid === overview?.admin.uid) {
      showStatusMessage('Cannot remove your active admin directory record.');
      return;
    }
    setBusy(true);
    try {
      await deleteDoc(doc(getFirebaseDb(), 'users', targetUid));
      if (overview?.admin.email) {
        await appendAudit('Removed Directory Entry', `${targetEmail} (${targetUid.slice(0, 8)}…)`, overview.admin.email);
      }
      showStatusMessage(`Removed directory summary for ${targetEmail}.`);
      await loadConsoleData();
    } catch (err: unknown) {
      showStatusMessage(
        err instanceof Error ? err.message : 'Permission denied while updating directory.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (!ready || authStatus === 'checking') {
    return <PageSkeleton variant="default" cardsCount={4} showMetrics={true} showControls={false} />;
  }

  // Stealth response: unauthorized users receive the standard 404 Not Found view
  if (authStatus === 'denied' || !overview) {
    return (
      <main className={statusStyles.wrap}>
        <section className={statusStyles.card}>
          <div className={statusStyles.kicker}>
            <span className={statusStyles.dot} aria-hidden="true" />
            <span>404 — Not Found</span>
          </div>
          <h1 className={statusStyles.title}>This page does not exist</h1>
          <p className={statusStyles.desc}>
            The link you followed may have moved or is no longer available in your workspace.
          </p>
          <div className={statusStyles.actions}>
            <Link href="/" className={statusStyles.primaryBtn}>
              Return to Workspace
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.kicker}>
            <span className={styles.liveDot} aria-hidden="true" />
            <span>Owner Console · Private Administration</span>
          </div>
          <h1 className={styles.title}>Sariling Mundo Control Center</h1>
          <p className={styles.subtitle}>
            Server telemetry, registered accounts overview, platform controls, and administrative audit trail.
          </p>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.identityBadge} title={`Verified via ${overview.admin.verifiedVia}`}>
            <ShieldCheck size={15} />
            <span>{overview.admin.email}</span>
          </div>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => void loadConsoleData()}
            disabled={busy}
          >
            <RefreshCw size={14} />
            <span>{busy ? 'Refreshing…' : 'Refresh'}</span>
          </button>
          <Link href="/" className={styles.primaryBtn}>
            Workspace
          </Link>
        </div>
      </header>

      {feedback && (
        <div className={styles.noticeBar} role="status">
          {feedback}
        </div>
      )}

      {/* Executive KPI Summary Grid */}
      <section className={styles.kpiGrid} aria-label="System metrics">
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Registered Users</span>
          <span className={styles.kpiValue}>{stats.totalUsers}</span>
          <span className={styles.kpiMeta}>
            {stats.googleCount} Google · {stats.emailCount} Email/Password
          </span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Active (Last 24h)</span>
          <span className={styles.kpiValue}>{stats.active24h}</span>
          <span className={styles.kpiMeta}>
            Verified via {overview.admin.verifiedVia}
          </span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Server Uptime</span>
          <span className={styles.kpiValue}>{formatUptime(overview.runtime.uptimeSeconds)}</span>
          <span className={styles.kpiMeta}>
            {overview.runtime.nodeVersion} · {overview.runtime.nodeEnv}
          </span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Security &amp; Cache</span>
          <span className={styles.kpiValue}>
            {overview.caches.rateLimit.activeBuckets} / {overview.caches.linkPreview.entries}
          </span>
          <span className={styles.kpiMeta}>
            Active rate buckets · Cached previews
          </span>
        </div>
      </section>

      {/* Navigation Tabs */}
      <nav className={styles.tabBar} aria-label="Admin sections">
        {(
          [
            { id: 'overview', label: 'Overview & Health', icon: Server },
            { id: 'users', label: `Users (${stats.totalUsers})`, icon: Users },
            { id: 'controls', label: 'Platform Controls', icon: Sliders },
            { id: 'audit', label: `Audit Log (${auditList.length})`, icon: FileText },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Tab 1: Overview & Infrastructure */}
      {activeTab === 'overview' && (
        <div className={styles.panelGrid}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Infrastructure &amp; Environment Checks</h2>
                <p className={styles.cardDesc}>
                  Server-side readiness checks (secret values are never transmitted to the browser).
                </p>
              </div>
            </div>

            <div className={styles.checkList}>
              {[
                {
                  label: 'Firebase Client Configuration',
                  ok: overview.infrastructure.firebaseProjectConfigured,
                  okText: 'Ready',
                  warnText: 'Missing',
                },
                {
                  label: 'Public Site Origin URL',
                  ok: overview.infrastructure.siteOriginConfigured,
                  okText: 'Configured',
                  warnText: 'Using localhost fallback',
                },
                {
                  label: 'Distributed Rate Limiting (Upstash)',
                  ok: overview.infrastructure.upstashRedisConfigured,
                  okText: 'Redis Active',
                  warnText: 'In-memory fallback',
                },
                {
                  label: 'Server AI Key Pool (Groq)',
                  ok: overview.infrastructure.groqKeyPoolCount > 0,
                  okText: `${overview.infrastructure.groqKeyPoolCount} Key(s) Set`,
                  warnText: 'Not configured',
                },
                {
                  label: 'Server AI Providers (Gemini / OpenAI / Anthropic)',
                  ok:
                    overview.infrastructure.geminiKeyConfigured ||
                    overview.infrastructure.openaiKeyConfigured ||
                    overview.infrastructure.anthropicKeyConfigured,
                  okText: 'Configured',
                  warnText: 'User BYOK only',
                },
                {
                  label: 'Admin Allowlist Env Override',
                  ok: overview.infrastructure.customAdminAllowlistConfigured,
                  okText: 'Custom Env Active',
                  warnText: 'Owner Default Active',
                },
              ].map((item) => (
                <div key={item.label} className={styles.checkRow}>
                  <span>{item.label}</span>
                  <span className={styles.statusPill}>
                    <span
                      className={`${styles.statusDot} ${item.ok ? styles.statusDotOk : styles.statusDotWarn}`}
                      aria-hidden="true"
                    />
                    <span>{item.ok ? item.okText : item.warnText}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Live Cache &amp; Protection Actions</h2>
                <p className={styles.cardDesc}>
                  Inspect server cache memory and reset rate-limit counters if needed.
                </p>
              </div>
            </div>

            <div className={styles.checkList}>
              <div className={styles.checkRow}>
                <span>In-Memory Rate Limiter</span>
                <span className={styles.mono}>
                  {overview.caches.rateLimit.activeBuckets} active / {overview.caches.rateLimit.maxEntries} max
                </span>
              </div>
              <div className={styles.checkRow}>
                <span>Link Preview Cache</span>
                <span className={styles.mono}>
                  {overview.caches.linkPreview.entries} / {overview.caches.linkPreview.maxEntries} URLs
                </span>
              </div>
              <div className={styles.checkRow}>
                <span>Registration Gate</span>
                <span className={styles.statusPill}>
                  <span
                    className={`${styles.statusDot} ${systemConfig.allowRegistrations ? styles.statusDotOk : styles.statusDotWarn}`}
                    aria-hidden="true"
                  />
                  <span>{systemConfig.allowRegistrations ? 'Open' : 'Paused'}</span>
                </span>
              </div>
              <div className={styles.checkRow}>
                <span>Guest / Local Mode</span>
                <span className={styles.statusPill}>
                  <span
                    className={`${styles.statusDot} ${systemConfig.allowGuestMode ? styles.statusDotOk : styles.statusDotWarn}`}
                    aria-hidden="true"
                  />
                  <span>{systemConfig.allowGuestMode ? 'Enabled' : 'Disabled'}</span>
                </span>
              </div>
            </div>

            <div className={styles.actionsRow}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={busy}
                onClick={() => void handleServerCacheAction('clear-rate-limits')}
              >
                Reset Rate-Limit Buckets
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={busy}
                onClick={() => void handleServerCacheAction('clear-link-cache')}
              >
                Flush Link-Preview Cache
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Tab 2: Registered Users Directory */}
      {activeTab === 'users' && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Registered Accounts Directory</h2>
              <p className={styles.cardDesc}>
                Account summaries synced on sign-in. User private notes, books, and vaults remain isolated per UID.
              </p>
            </div>
          </div>

          <div className={styles.filterRow}>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search by email, name, or UID…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <div className={styles.actionsRow}>
              {(
                [
                  { id: 'all', label: 'All Providers' },
                  { id: 'google.com', label: 'Google' },
                  { id: 'password', label: 'Email' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.tabBtn} ${providerFilter === p.id ? styles.tabBtnActive : ''}`}
                  onClick={() => setProviderFilter(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className={styles.emptyState}>
              No matching account summaries found yet. Accounts appear automatically upon sign-in once updated Firestore rules are deployed.
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Provider</th>
                    <th>UID</th>
                    <th>Last Active</th>
                    <th>Joined</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const isSelf = u.uid === overview.admin.uid;
                    return (
                      <tr key={u.uid}>
                        <td>
                          <div className={styles.userPrimary}>
                            {u.displayName || u.email.split('@')[0] || 'User'}
                            {isSelf ? ' (Owner)' : ''}
                          </div>
                          <div className={styles.userSecondary}>{u.email}</div>
                        </td>
                        <td>
                          <span className={styles.statusPill}>
                            <span
                              className={`${styles.statusDot} ${u.emailVerified ? styles.statusDotOk : styles.statusDotWarn}`}
                              aria-hidden="true"
                            />
                            <span>{formatProvider(u.provider)}</span>
                          </span>
                        </td>
                        <td className={styles.mono}>{u.uid.slice(0, 10)}…</td>
                        <td className={styles.userSecondary}>{formatDateTime(u.lastActiveAt)}</td>
                        <td className={styles.userSecondary}>{formatDateTime(u.createdAt)}</td>
                        <td>
                          {!isSelf ? (
                            <button
                              type="button"
                              className={styles.dangerBtn}
                              disabled={busy}
                              onClick={() => void handleRemoveUserDirectoryEntry(u.uid, u.email)}
                            >
                              <Trash2 size={13} />
                              <span>Remove</span>
                            </button>
                          ) : (
                            <span className={styles.userSecondary}>Protected</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Platform Controls & System Broadcast */}
      {activeTab === 'controls' && (
        <form onSubmit={handleSaveControls} className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Platform Access &amp; System Broadcasts</h2>
              <p className={styles.cardDesc}>
                Live workspace controls stored in Firestore (<code>app/systemConfig</code>).
              </p>
            </div>
          </div>

          <label className={styles.toggleRow}>
            <div className={styles.toggleLabel}>
              <span className={styles.toggleTitle}>Allow New Account Registrations</span>
              <span className={styles.toggleDesc}>
                Disable to pause new public sign-ups on /register (existing accounts can still sign in).
              </span>
            </div>
            <input
              type="checkbox"
              checked={systemConfig.allowRegistrations}
              onChange={(e) =>
                setSystemConfig((prev) => ({ ...prev, allowRegistrations: e.target.checked }))
              }
              style={{ width: 20, height: 20 }}
            />
          </label>

          <label className={styles.toggleRow}>
            <div className={styles.toggleLabel}>
              <span className={styles.toggleTitle}>Allow Local / Guest Workspace Mode</span>
              <span className={styles.toggleDesc}>
                Controls whether visitors can enter offline Local Mode without creating an account.
              </span>
            </div>
            <input
              type="checkbox"
              checked={systemConfig.allowGuestMode}
              onChange={(e) =>
                setSystemConfig((prev) => ({ ...prev, allowGuestMode: e.target.checked }))
              }
              style={{ width: 20, height: 20 }}
            />
          </label>

          <label className={styles.toggleRow}>
            <div className={styles.toggleLabel}>
              <span className={styles.toggleTitle}>Show Workspace Announcement Banner</span>
              <span className={styles.toggleDesc}>
                Displays a calm, dismissible notice at the top of signed-in user workspaces.
              </span>
            </div>
            <input
              type="checkbox"
              checked={systemConfig.bannerEnabled}
              onChange={(e) =>
                setSystemConfig((prev) => ({ ...prev, bannerEnabled: e.target.checked }))
              }
              style={{ width: 20, height: 20 }}
            />
          </label>

          <div className={styles.panelGrid}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="admin-banner-tone">
                Banner Severity
              </label>
              <select
                id="admin-banner-tone"
                className={styles.select}
                value={systemConfig.bannerTone}
                onChange={(e) =>
                  setSystemConfig((prev) => ({
                    ...prev,
                    bannerTone: e.target.value === 'warning' ? 'warning' : 'info',
                  }))
                }
              >
                <option value="info">Executive Notice (Neutral)</option>
                <option value="warning">Service Advisory (Amber)</option>
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="admin-banner-title">
                Headline (Optional)
              </label>
              <input
                id="admin-banner-title"
                className={styles.input}
                type="text"
                maxLength={120}
                placeholder="e.g. Scheduled Cloud Maintenance"
                value={systemConfig.bannerTitle}
                onChange={(e) =>
                  setSystemConfig((prev) => ({ ...prev, bannerTitle: e.target.value }))
                }
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="admin-banner-msg">
              Announcement Message
            </label>
            <textarea
              id="admin-banner-msg"
              className={styles.textarea}
              maxLength={500}
              placeholder="Write a clear, concise status message for signed-in users…"
              value={systemConfig.bannerMessage}
              onChange={(e) =>
                setSystemConfig((prev) => ({ ...prev, bannerMessage: e.target.value }))
              }
            />
          </div>

          <div className={styles.actionsRow}>
            <button type="submit" className={styles.primaryBtn} disabled={savingControls}>
              {savingControls ? 'Publishing…' : 'Save Platform Settings'}
            </button>
          </div>
        </form>
      )}

      {/* Tab 4: Audit Log */}
      {activeTab === 'audit' && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Administrative Audit Trail</h2>
              <p className={styles.cardDesc}>
                Recent administrative actions logged strictly in Firestore (<code>app/adminAudit</code>).
              </p>
            </div>
          </div>

          {auditList.length === 0 ? (
            <div className={styles.emptyState}>
              No audit log entries recorded yet.
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Detail</th>
                    <th>Actor</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditList.map((entry) => (
                    <tr key={entry.id}>
                      <td className={styles.userPrimary}>{entry.action}</td>
                      <td className={styles.userSecondary}>{entry.detail || '—'}</td>
                      <td className={styles.userSecondary}>{entry.actorEmail}</td>
                      <td className={styles.mono}>{formatDateTime(entry.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
