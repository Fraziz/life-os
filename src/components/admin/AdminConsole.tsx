'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  limit,
  getDocs,
} from 'firebase/firestore';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Sliders,
  Users,
} from 'lucide-react';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import {
  writeSystemConfig,
  type BannerTone,
  type SystemConfig,
} from '@/lib/systemConfig';
import AdminTelemetryCharts from './AdminTelemetryCharts';
import AdminUserDrawer from './AdminUserDrawer';
import {
  downloadTextFile,
  escapeCsvCell,
  formatDateTime,
  formatProvider,
  formatRelativeTime,
  formatUptime,
  type AdminSection,
  type AuditCategory,
  type AuditEntry,
  type DiagnosticsReport,
  type DirectoryUserRecord,
  type IncidentRecord,
  type OverviewApiResponse,
} from './types';
import styles from '@/app/admin/page.module.css';

interface AdminConsoleProps {
  initialOverview: OverviewApiResponse;
  initialConfig: SystemConfig;
  initialUsers: DirectoryUserRecord[];
  initialAudit: AuditEntry[];
  initialIncidents: IncidentRecord[];
}

export default function AdminConsole({
  initialOverview,
  initialConfig,
  initialUsers,
  initialAudit,
  initialIncidents,
}: AdminConsoleProps) {
  const [section, setSection] = useState<AdminSection>('overview');
  const [overview, setOverview] = useState<OverviewApiResponse>(initialOverview);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(initialConfig);
  const [usersList, setUsersList] = useState<DirectoryUserRecord[]>(initialUsers);
  const [auditList, setAuditList] = useState<AuditEntry[]>(initialAudit);
  const [incidents, setIncidents] = useState<IncidentRecord[]>(initialIncidents);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsReport | null>(null);

  const [busy, setBusy] = useState(false);
  const [diagBusy, setDiagBusy] = useState(false);
  const [savingControls, setSavingControls] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => new Date().toISOString());

  // User filtering & drawer state
  const [userSearch, setUserSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<'all' | 'google.com' | 'password'>('all');
  const [standingFilter, setStandingFilter] = useState<
    'all' | 'active24h' | 'active7d' | 'dormant' | 'suspended' | 'privileged'
  >('all');
  const [userSort, setUserSort] = useState<'lastActive' | 'joined' | 'email'>('lastActive');
  const [inspectedUser, setInspectedUser] = useState<DirectoryUserRecord | null>(null);

  // Incident composer state
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentSeverity, setIncidentSeverity] = useState<'minor' | 'major' | 'maintenance'>('minor');
  const [incidentStatus, setIncidentStatus] = useState<
    'investigating' | 'identified' | 'monitoring' | 'resolved'
  >('investigating');
  const [incidentSummary, setIncidentSummary] = useState('');
  const [savingIncident, setSavingIncident] = useState(false);

  // Audit filter state
  const [auditSearch, setAuditSearch] = useState('');
  const [auditCategory, setAuditCategory] = useState<'all' | AuditCategory>('all');

  const notify = useCallback((msg: string) => {
    setFeedback(msg);
    setTimeout(() => {
      setFeedback((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  const getBearerToken = useCallback(async () => {
    const fbUser = getFirebaseAuth().currentUser;
    if (!fbUser) return null;
    return fbUser.getIdToken();
  }, []);

  const appendAudit = useCallback(
    async (category: AuditCategory, action: string, detail: string) => {
      try {
        await addDoc(collection(getFirebaseDb(), 'adminAudit'), {
          category,
          action,
          detail,
          actorEmail: overview.admin.email,
          createdAt: new Date().toISOString(),
          ts: serverTimestamp(),
        });
      } catch {
        // Non-fatal if rules aren't deployed yet
      }
    },
    [overview.admin.email]
  );

  const refreshAllData = useCallback(async () => {
    setBusy(true);
    try {
      const token = await getBearerToken();
      if (!token) return;

      const db = getFirebaseDb();
      const [ovResp, usersRes, auditRes, incRes] = await Promise.all([
        fetch('/api/admin/overview', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
        getDocs(collection(db, 'users')).catch(() => null),
        getDocs(query(collection(db, 'adminAudit'), orderBy('ts', 'desc'), limit(100))).catch(() => null),
        getDocs(query(collection(db, 'adminIncidents'), orderBy('ts', 'desc'), limit(40))).catch(() => null),
      ]);

      if (ovResp.ok) {
        const nextOv = (await ovResp.json()) as OverviewApiResponse;
        if (nextOv?.authorized) {
          setOverview(nextOv);
        }
      }

      if (usersRes) {
        const parsedUsers: DirectoryUserRecord[] = usersRes.docs.map((snap) => {
          const d = snap.data() as Partial<DirectoryUserRecord>;
          return {
            uid: snap.id,
            email: d.email || '—',
            displayName: d.displayName || '',
            provider: d.provider || 'password',
            emailVerified: Boolean(d.emailVerified),
            createdAt: d.createdAt,
            lastActiveAt: d.lastActiveAt,
            accountStatus: d.accountStatus === 'suspended' ? 'suspended' : 'active',
            suspensionReason: d.suspensionReason,
            suspendedAt: d.suspendedAt,
            adminRole:
              d.adminRole === 'owner' || d.adminRole === 'support' ? d.adminRole : 'member',
          };
        });
        setUsersList(parsedUsers);
        if (inspectedUser) {
          const fresh = parsedUsers.find((u) => u.uid === inspectedUser.uid) || null;
          setInspectedUser(fresh);
        }
      }

      if (auditRes) {
        setAuditList(
          auditRes.docs.map((snap) => {
            const d = snap.data() as Partial<AuditEntry>;
            return {
              id: snap.id,
              category:
                d.category === 'users' ||
                d.category === 'config' ||
                d.category === 'security' ||
                d.category === 'operations' ||
                d.category === 'incidents'
                  ? d.category
                  : 'operations',
              action: d.action || 'Admin Action',
              detail: d.detail || '',
              actorEmail: d.actorEmail || overview.admin.email,
              createdAt: d.createdAt || '',
            };
          })
        );
      }

      if (incRes) {
        setIncidents(
          incRes.docs.map((snap) => {
            const d = snap.data() as Partial<IncidentRecord>;
            return {
              id: snap.id,
              title: d.title || 'Untitled Notice',
              severity:
                d.severity === 'major' || d.severity === 'maintenance' ? d.severity : 'minor',
              status:
                d.status === 'identified' ||
                d.status === 'monitoring' ||
                d.status === 'resolved'
                  ? d.status
                  : 'investigating',
              summary: d.summary || '',
              createdAt: d.createdAt || '',
              updatedAt: d.updatedAt || d.createdAt || '',
              createdBy: d.createdBy || overview.admin.email,
            };
          })
        );
      }

      setLastSyncedAt(new Date().toISOString());
    } finally {
      setBusy(false);
    }
  }, [getBearerToken, inspectedUser, overview.admin.email]);

  const metrics = useMemo(() => {
    const now = Date.now();
    let active24h = 0;
    let active7d = 0;
    let dormant = 0;
    let suspended = 0;
    let googleCount = 0;
    let verifiedCount = 0;

    for (const u of usersList) {
      if (u.provider === 'google.com') googleCount += 1;
      if (u.emailVerified) verifiedCount += 1;
      if (u.accountStatus === 'suspended') suspended += 1;
      const ms = u.lastActiveAt ? Date.parse(u.lastActiveAt) : NaN;
      if (!Number.isNaN(ms)) {
        const age = now - ms;
        if (age <= 86_400_000) active24h += 1;
        if (age <= 7 * 86_400_000) active7d += 1;
        if (age >= 30 * 86_400_000) dormant += 1;
      } else {
        dormant += 1;
      }
    }

    const openIncidents = incidents.filter((i) => i.status !== 'resolved').length;
    return {
      totalUsers: usersList.length,
      active24h,
      active7d,
      dormant,
      suspended,
      googleCount,
      emailCount: Math.max(0, usersList.length - googleCount),
      verifiedCount,
      openIncidents,
    };
  }, [usersList, incidents]);

  const filteredUsers = useMemo(() => {
    const now = Date.now();
    const q = userSearch.trim().toLowerCase();

    const list = usersList.filter((u) => {
      if (providerFilter !== 'all' && u.provider !== providerFilter) return false;

      if (standingFilter === 'suspended' && u.accountStatus !== 'suspended') return false;
      if (
        standingFilter === 'privileged' &&
        u.uid !== overview.admin.uid &&
        u.adminRole !== 'support'
      ) {
        return false;
      }
      if (standingFilter === 'active24h' || standingFilter === 'active7d' || standingFilter === 'dormant') {
        const ms = u.lastActiveAt ? Date.parse(u.lastActiveAt) : NaN;
        const age = Number.isNaN(ms) ? Infinity : now - ms;
        if (standingFilter === 'active24h' && age > 86_400_000) return false;
        if (standingFilter === 'active7d' && age > 7 * 86_400_000) return false;
        if (standingFilter === 'dormant' && age < 30 * 86_400_000) return false;
      }

      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      if (userSort === 'email') return a.email.localeCompare(b.email);
      if (userSort === 'joined') return (b.createdAt || '').localeCompare(a.createdAt || '');
      return (b.lastActiveAt || b.createdAt || '').localeCompare(a.lastActiveAt || a.createdAt || '');
    });

    return list;
  }, [usersList, userSearch, providerFilter, standingFilter, userSort, overview.admin.uid]);

  const filteredAudit = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditList.filter((entry) => {
      if (auditCategory !== 'all' && entry.category !== auditCategory) return false;
      if (!q) return true;
      return (
        entry.action.toLowerCase().includes(q) ||
        entry.detail.toLowerCase().includes(q) ||
        entry.actorEmail.toLowerCase().includes(q)
      );
    });
  }, [auditList, auditSearch, auditCategory]);

  const handleServerAction = async (
    action: 'clear-rate-limits' | 'clear-link-cache' | 'refresh-system-config',
    silent = false
  ) => {
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
        if (!silent) notify('Server rejected administrative action.');
        return;
      }
      const data = (await resp.json()) as { cleared?: number };
      if (!silent) {
        const label =
          action === 'clear-rate-limits'
            ? 'Rate-Limit Reset'
            : action === 'clear-link-cache'
            ? 'Link Cache Flush'
            : 'Policy Cache Reloaded';
        const detail =
          action === 'refresh-system-config'
            ? 'Re-synced server policy flags from Firestore.'
            : `Cleared ${data.cleared ?? 0} in-memory entries.`;
        await appendAudit('operations', label, detail);
        notify(`${label}: ${detail}`);
      }
      await refreshAllData();
    } finally {
      setBusy(false);
    }
  };

  const handleRunDiagnostics = async () => {
    setDiagBusy(true);
    try {
      const token = await getBearerToken();
      if (!token) return;
      const resp = await fetch('/api/admin/diagnostics', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        notify('Diagnostics check was rejected by server.');
        return;
      }
      const report = (await resp.json()) as DiagnosticsReport;
      setDiagnostics(report);
      const passedCount = report.checks.filter((c) => c.status === 'pass').length;
      await appendAudit(
        'operations',
        'Ran System Health Diagnostics',
        `${passedCount}/${report.checks.length} live checks passing.`
      );
      notify(`Health diagnostics completed (${passedCount}/${report.checks.length} checks healthy).`);
      await refreshAllData();
    } finally {
      setDiagBusy(false);
    }
  };

  const handleSaveControls = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingControls(true);
    try {
      const saved = await writeSystemConfig(systemConfig, overview.admin.email);
      setSystemConfig(saved);
      await handleServerAction('refresh-system-config', true);
      await appendAudit(
        'config',
        'Platform Controls Updated',
        `Signup=${saved.allowRegistrations ? 'Open' : 'Paused'}, Guest=${
          saved.allowGuestMode ? 'On' : 'Off'
        }, GoogleSSO=${saved.allowGoogleAuth ? 'On' : 'Off'}, VerifiedOnly=${
          saved.requireVerifiedEmail ? 'Yes' : 'No'
        }, Maintenance=${saved.maintenanceMode ? 'ACTIVE' : 'Off'}, ServerAI=${
          saved.serverAiEnabled ? 'On' : 'Paused'
        } (${saved.aiRateLimitPerMin}/min), Banner=${saved.bannerEnabled ? 'On' : 'Off'}`
      );
      notify('Platform policies saved to Firestore and propagated to server APIs.');
      await refreshAllData();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Unable to save controls. Check Firestore rules.');
    } finally {
      setSavingControls(false);
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentTitle.trim() || !incidentSummary.trim()) return;
    setSavingIncident(true);
    try {
      const nowIso = new Date().toISOString();
      await addDoc(collection(getFirebaseDb(), 'adminIncidents'), {
        title: incidentTitle.trim().slice(0, 140),
        severity: incidentSeverity,
        status: incidentStatus,
        summary: incidentSummary.trim().slice(0, 600),
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: overview.admin.email,
        ts: serverTimestamp(),
      });
      await appendAudit(
        'incidents',
        'Logged Operational Incident',
        `${incidentTitle.trim()} [${incidentSeverity}/${incidentStatus}]`
      );
      setIncidentTitle('');
      setIncidentSummary('');
      notify('Incident notice recorded in Firestore.');
      await refreshAllData();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Unable to publish incident.');
    } finally {
      setSavingIncident(false);
    }
  };

  const handleUpdateIncidentStatus = async (
    id: string,
    title: string,
    nextStatus: IncidentRecord['status']
  ) => {
    setBusy(true);
    try {
      await updateDoc(doc(getFirebaseDb(), 'adminIncidents', id), {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
      await appendAudit('incidents', 'Updated Incident Status', `${title} -> ${nextStatus}`);
      notify(`Incident marked ${nextStatus}.`);
      await refreshAllData();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Unable to update incident.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteIncident = async (id: string, title: string) => {
    setBusy(true);
    try {
      await deleteDoc(doc(getFirebaseDb(), 'adminIncidents', id));
      await appendAudit('incidents', 'Removed Incident Record', title);
      notify('Incident record removed.');
      await refreshAllData();
    } finally {
      setBusy(false);
    }
  };

  const handleExportUsersCsv = () => {
    const header = ['UID', 'Name', 'Email', 'Provider', 'Verified', 'Standing', 'Role', 'LastActive', 'Joined'];
    const rows = filteredUsers.map((u) => [
      escapeCsvCell(u.uid),
      escapeCsvCell(u.displayName || ''),
      escapeCsvCell(u.email),
      escapeCsvCell(formatProvider(u.provider)),
      escapeCsvCell(u.emailVerified ? 'Yes' : 'No'),
      escapeCsvCell(u.accountStatus === 'suspended' ? 'Suspended' : 'Active'),
      escapeCsvCell(u.uid === overview.admin.uid ? 'owner' : u.adminRole || 'member'),
      escapeCsvCell(u.lastActiveAt || ''),
      escapeCsvCell(u.createdAt || ''),
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadTextFile(`sariling-mundo-users-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
    void appendAudit('users', 'Exported User Directory CSV', `${filteredUsers.length} account rows`);
    notify(`Exported ${filteredUsers.length} accounts to CSV.`);
  };

  const handleExportAuditJson = () => {
    const json = JSON.stringify(filteredAudit, null, 2);
    downloadTextFile(
      `sariling-mundo-audit-${new Date().toISOString().slice(0, 10)}.json`,
      json,
      'application/json'
    );
    notify(`Exported ${filteredAudit.length} audit events to JSON.`);
  };

  const navGroups: Array<{
    group: string;
    items: Array<{
      id: AdminSection;
      label: string;
      icon: React.ComponentType<{ size?: number }>;
      badge?: string;
    }>;
  }> = [
    {
      group: 'Command',
      items: [{ id: 'overview', label: 'Executive Overview', icon: BarChart3 }],
    },
    {
      group: 'Identity & Access',
      items: [{ id: 'users', label: 'Users & Sessions', icon: Users, badge: String(metrics.totalUsers) }],
    },
    {
      group: 'Platform',
      items: [
        { id: 'controls', label: 'Feature Flags & Config', icon: Sliders },
        { id: 'operations', label: 'Operations & Health', icon: Activity },
        {
          id: 'incidents',
          label: 'Incidents & Status',
          icon: AlertTriangle,
          badge: metrics.openIncidents > 0 ? String(metrics.openIncidents) : undefined,
        },
      ],
    },
    {
      group: 'Governance',
      items: [{ id: 'audit', label: 'Audit Log', icon: FileText, badge: String(auditList.length) }],
    },
  ];

  return (
    <div className={styles.consoleLayout}>
      {/* Enterprise Left Operations Rail */}
      <aside className={styles.opsRail} aria-label="Admin sections">
        <div className={styles.railBrandBlock}>
          <div className={styles.kicker}>
            <span className={styles.liveDot} aria-hidden="true" />
            <span>{overview.runtime.nodeEnv}</span>
          </div>
          <div className={styles.railTitle}>Enterprise Admin</div>
          <div className={styles.railMeta}>
            {overview.infrastructure.firebaseProjectId || 'Firebase Cloud'}
          </div>
        </div>

        <nav className={styles.railNav}>
          {navGroups.map((g) => (
            <div key={g.group} className={styles.railGroup}>
              <div className={styles.railGroupTitle}>{g.group}</div>
              {g.items.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.railBtn} ${active ? styles.railBtnActive : ''}`}
                    onClick={() => setSection(item.id)}
                  >
                    <span className={styles.railBtnLeft}>
                      <Icon size={15} />
                      <span>{item.label}</span>
                    </span>
                    {item.badge && <span className={styles.railBadge}>{item.badge}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={styles.railFooter}>
          <div className={styles.railStatusRow}>
            <span className={styles.userSecondary}>Maintenance</span>
            <span className={styles.statusPill}>
              <span
                className={`${styles.statusDot} ${
                  systemConfig.maintenanceMode ? styles.statusDotDanger : styles.statusDotOk
                }`}
                aria-hidden="true"
              />
              <span>{systemConfig.maintenanceMode ? 'Active' : 'Normal'}</span>
            </span>
          </div>
          <div className={styles.railStatusRow}>
            <span className={styles.userSecondary}>Server AI</span>
            <span className={styles.statusPill}>
              <span
                className={`${styles.statusDot} ${
                  systemConfig.serverAiEnabled ? styles.statusDotOk : styles.statusDotWarn
                }`}
                aria-hidden="true"
              />
              <span>{systemConfig.serverAiEnabled ? 'Live' : 'Paused'}</span>
            </span>
          </div>
        </div>
      </aside>

      {/* Main Operations Canvas */}
      <div className={styles.consoleMain}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.kicker}>
              <span className={styles.liveDot} aria-hidden="true" />
              <span>Sariling Mundo Control Plane · Synced {formatRelativeTime(lastSyncedAt)}</span>
            </div>
            <h1 className={styles.title}>
              {section === 'overview' && 'Executive System Overview'}
              {section === 'users' && 'Accounts, Devices & Access Control'}
              {section === 'controls' && 'Feature Flags, Policies & Broadcasts'}
              {section === 'operations' && 'Diagnostics, Memory & Rate Limits'}
              {section === 'incidents' && 'Operational Incidents & Advisories'}
              {section === 'audit' && 'Compliance Audit Trail'}
            </h1>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.identityBadge} title={`Verified via ${overview.admin.verifiedVia}`}>
              <ShieldCheck size={15} />
              <span>{overview.admin.email}</span>
            </div>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => void refreshAllData()}
              disabled={busy}
            >
              <RefreshCw size={14} />
              <span>{busy ? 'Syncing…' : 'Sync'}</span>
            </button>
            <Link href="/" className={styles.primaryBtn}>
              Workspace
            </Link>
          </div>
        </header>

        {/* Mobile / Tablet Compact Switcher */}
        <nav className={styles.mobileTabBar} aria-label="Mobile admin navigation">
          {navGroups.flatMap((g) =>
            g.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.tabBtn} ${section === item.id ? styles.tabBtnActive : ''}`}
                  onClick={() => setSection(item.id)}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </button>
              );
            })
          )}
        </nav>

        {feedback && (
          <div className={styles.noticeBar} role="status">
            {feedback}
          </div>
        )}

        {/* ── SECTION 1: EXECUTIVE OVERVIEW ───────────────────────────────── */}
        {section === 'overview' && (
          <div className={styles.stackGap}>
            <section className={styles.kpiGrid} aria-label="Executive metrics">
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Total Registered</span>
                <span className={styles.kpiValue}>{metrics.totalUsers}</span>
                <span className={styles.kpiMeta}>
                  {metrics.verifiedCount} verified · {metrics.suspended} suspended
                </span>
              </div>

              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Active (24h / 7d)</span>
                <span className={styles.kpiValue}>
                  {metrics.active24h} / {metrics.active7d}
                </span>
                <span className={styles.kpiMeta}>
                  {metrics.dormant} dormant (30d+)
                </span>
              </div>

              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Node Process Uptime</span>
                <span className={styles.kpiValue}>{formatUptime(overview.runtime.uptimeSeconds)}</span>
                <span className={styles.kpiMeta}>
                  {overview.runtime.nodeVersion} · RSS {overview.runtime.memory.rssMb}MB
                </span>
              </div>

              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>API Guards &amp; Cache</span>
                <span className={styles.kpiValue}>
                  {overview.caches.rateLimit.activeBuckets} / {overview.caches.linkPreview.entries}
                </span>
                <span className={styles.kpiMeta}>
                  AI cap {systemConfig.aiRateLimitPerMin}/min · {systemConfig.serverAiEnabled ? 'AI On' : 'AI Paused'}
                </span>
              </div>
            </section>

            <AdminTelemetryCharts users={usersList} overview={overview} />

            <div className={styles.panelGrid}>
              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Platform Infrastructure Readiness</h2>
                    <p className={styles.cardDesc}>
                      Live environment binding checks without exposing secret credentials.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.miniBtn}
                    onClick={() => setSection('operations')}
                  >
                    <span>Open Diagnostics</span>
                    <ChevronRight size={13} />
                  </button>
                </div>

                <div className={styles.checkList}>
                  {[
                    {
                      label: 'Firebase Project & Identity Binding',
                      ok: overview.infrastructure.firebaseProjectConfigured,
                      okText: overview.infrastructure.firebaseProjectId || 'Configured',
                      warnText: 'Incomplete',
                    },
                    {
                      label: 'Distributed Rate Store (Upstash Redis)',
                      ok: overview.infrastructure.upstashRedisConfigured,
                      okText: 'Connected',
                      warnText: 'In-memory sliding window',
                    },
                    {
                      label: 'Server AI Key Pool (Groq / Gemini / OpenAI / Anthropic)',
                      ok:
                        overview.infrastructure.groqKeyPoolCount > 0 ||
                        overview.infrastructure.geminiKeyConfigured ||
                        overview.infrastructure.openaiKeyConfigured ||
                        overview.infrastructure.anthropicKeyConfigured,
                      okText: `${overview.infrastructure.groqKeyPoolCount} Groq + Provider keys`,
                      warnText: 'User BYOK only',
                    },
                    {
                      label: 'Canonical Site Origin URL',
                      ok: overview.infrastructure.siteOriginConfigured,
                      okText: 'Configured',
                      warnText: 'Localhost fallback',
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
                    <h2 className={styles.cardTitle}>Recent Administrative Activity</h2>
                    <p className={styles.cardDesc}>Latest configuration, user, and security events.</p>
                  </div>
                  <button
                    type="button"
                    className={styles.miniBtn}
                    onClick={() => setSection('audit')}
                  >
                    <span>View All</span>
                    <ChevronRight size={13} />
                  </button>
                </div>

                {auditList.length === 0 ? (
                  <div className={styles.emptyState}>No administrative actions recorded yet.</div>
                ) : (
                  <div className={styles.checkList}>
                    {auditList.slice(0, 5).map((entry) => (
                      <div key={entry.id} className={styles.checkRow}>
                        <div>
                          <div className={styles.userPrimary}>{entry.action}</div>
                          <div className={styles.userSecondary}>{entry.detail || entry.actorEmail}</div>
                        </div>
                        <span className={styles.mono}>{formatRelativeTime(entry.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* ── SECTION 2: USERS & ACCESS DIRECTORY ─────────────────────────── */}
        {section === 'users' && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Account Directory &amp; Session Governance</h2>
                <p className={styles.cardDesc}>
                  Inspect account standing, device sessions, suspend compromised accounts, or export directory CSV. Private workspace contents remain strictly isolated per UID.
                </p>
              </div>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleExportUsersCsv}
                disabled={filteredUsers.length === 0}
              >
                <Download size={14} />
                <span>Export CSV ({filteredUsers.length})</span>
              </button>
            </div>

            <div className={styles.filterToolbar}>
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search by email, display name, or UID…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />

              <select
                className={styles.selectCompact}
                aria-label="Filter by provider"
                value={providerFilter}
                onChange={(e) =>
                  setProviderFilter(
                    e.target.value === 'google.com' || e.target.value === 'password'
                      ? e.target.value
                      : 'all'
                  )
                }
              >
                <option value="all">All Providers</option>
                <option value="google.com">Google SSO</option>
                <option value="password">Email / Password</option>
              </select>

              <select
                className={styles.selectCompact}
                aria-label="Filter by standing"
                value={standingFilter}
                onChange={(e) =>
                  setStandingFilter(
                    e.target.value as typeof standingFilter
                  )
                }
              >
                <option value="all">All Standing</option>
                <option value="active24h">Active 24h</option>
                <option value="active7d">Active 7d</option>
                <option value="dormant">Dormant 30d+</option>
                <option value="suspended">Suspended Only</option>
                <option value="privileged">Owner &amp; VIP Tag</option>
              </select>

              <select
                className={styles.selectCompact}
                aria-label="Sort accounts"
                value={userSort}
                onChange={(e) => setUserSort(e.target.value as typeof userSort)}
              >
                <option value="lastActive">Sort: Last Active</option>
                <option value="joined">Sort: Newest Joined</option>
                <option value="email">Sort: Email A–Z</option>
              </select>
            </div>

            {filteredUsers.length === 0 ? (
              <div className={styles.emptyState}>
                No matching accounts found for the current filters.
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Standing</th>
                      <th>Provider</th>
                      <th>Last Seen</th>
                      <th>Joined</th>
                      <th>Inspector</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isSelf = u.uid === overview.admin.uid;
                      const suspended = u.accountStatus === 'suspended';
                      return (
                        <tr
                          key={u.uid}
                          className={styles.clickableRow}
                          onClick={() => setInspectedUser(u)}
                        >
                          <td>
                            <div className={styles.userPrimary}>
                              {u.displayName || u.email.split('@')[0] || 'User'}
                              {isSelf ? ' (Owner)' : u.adminRole === 'support' ? ' (Support)' : ''}
                            </div>
                            <div className={styles.userSecondary}>{u.email}</div>
                          </td>
                          <td>
                            <span className={styles.statusPill}>
                              <span
                                className={`${styles.statusDot} ${
                                  suspended ? styles.statusDotDanger : styles.statusDotOk
                                }`}
                                aria-hidden="true"
                              />
                              <span>{suspended ? 'Suspended' : 'Active'}</span>
                            </span>
                          </td>
                          <td>
                            <span className={styles.statusPill}>
                              <span
                                className={`${styles.statusDot} ${
                                  u.emailVerified ? styles.statusDotOk : styles.statusDotWarn
                                }`}
                                aria-hidden="true"
                              />
                              <span>{formatProvider(u.provider)}</span>
                            </span>
                          </td>
                          <td className={styles.userSecondary}>{formatRelativeTime(u.lastActiveAt)}</td>
                          <td className={styles.userSecondary}>{formatDateTime(u.createdAt)}</td>
                          <td>
                            <button
                              type="button"
                              className={styles.miniBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectedUser(u);
                              }}
                            >
                              Inspect
                            </button>
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

        {/* ── SECTION 3: FEATURE FLAGS & POLICY GOVERNANCE ────────────────── */}
        {section === 'controls' && (
          <form onSubmit={handleSaveControls} className={styles.stackGap}>
            <div className={styles.panelGrid}>
              {/* Access Policies */}
              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Identity &amp; Onboarding Policies</h2>
                    <p className={styles.cardDesc}>
                      Enforced live across sign-in, sign-up, and active sessions.
                    </p>
                  </div>
                </div>

                <label className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Allow New Account Registrations</span>
                    <span className={styles.toggleDesc}>
                      Pause public /register onboarding while keeping existing accounts active.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={systemConfig.allowRegistrations}
                    onChange={(e) =>
                      setSystemConfig((prev) => ({ ...prev, allowRegistrations: e.target.checked }))
                    }
                  />
                </label>

                <label className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Allow Google SSO Sign-In</span>
                    <span className={styles.toggleDesc}>
                      Controls availability of Continue with Google across auth flows.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={systemConfig.allowGoogleAuth}
                    onChange={(e) =>
                      setSystemConfig((prev) => ({ ...prev, allowGoogleAuth: e.target.checked }))
                    }
                  />
                </label>

                <label className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Allow Offline Local / Guest Workspace</span>
                    <span className={styles.toggleDesc}>
                      Allows local workspace entry without cloud registration.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={systemConfig.allowGuestMode}
                    onChange={(e) =>
                      setSystemConfig((prev) => ({ ...prev, allowGuestMode: e.target.checked }))
                    }
                  />
                </label>

                <label className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Require Verified Email Policy</span>
                    <span className={styles.toggleDesc}>
                      Holds unverified email/password workspaces behind a verification gate (owner exempt).
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={systemConfig.requireVerifiedEmail}
                    onChange={(e) =>
                      setSystemConfig((prev) => ({ ...prev, requireVerifiedEmail: e.target.checked }))
                    }
                  />
                </label>
              </section>

              {/* Operations & Service Kill-Switches */}
              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Service Guardrails &amp; Maintenance</h2>
                    <p className={styles.cardDesc}>
                      Enforced directly inside <code>/api/ai/chat</code>, <code>/api/link-preview</code>, and workspace gate.
                    </p>
                  </div>
                </div>

                <label className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Scheduled Maintenance Mode</span>
                    <span className={styles.toggleDesc}>
                      Locks end-user workspaces cleanly with maintenance notice while keeping Admin Console accessible.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={systemConfig.maintenanceMode}
                    onChange={(e) =>
                      setSystemConfig((prev) => ({ ...prev, maintenanceMode: e.target.checked }))
                    }
                  />
                </label>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="admin-maintenance-msg">
                    Maintenance Window Message
                  </label>
                  <input
                    id="admin-maintenance-msg"
                    className={styles.input}
                    type="text"
                    maxLength={320}
                    value={systemConfig.maintenanceMessage}
                    onChange={(e) =>
                      setSystemConfig((prev) => ({ ...prev, maintenanceMessage: e.target.value }))
                    }
                  />
                </div>

                <label className={styles.toggleRow}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Server AI Quota Kill-Switch</span>
                    <span className={styles.toggleDesc}>
                      Controls whether shared server API keys (Groq/Gemini) are served on <code>/api/ai/chat</code>.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={systemConfig.serverAiEnabled}
                    onChange={(e) =>
                      setSystemConfig((prev) => ({ ...prev, serverAiEnabled: e.target.checked }))
                    }
                  />
                </label>

                <div className={styles.panelGrid}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="admin-ai-rate">
                      AI Rate Limit (req / min)
                    </label>
                    <input
                      id="admin-ai-rate"
                      className={styles.input}
                      type="number"
                      min={5}
                      max={120}
                      value={systemConfig.aiRateLimitPerMin}
                      onChange={(e) =>
                        setSystemConfig((prev) => ({
                          ...prev,
                          aiRateLimitPerMin: Number(e.target.value) || 25,
                        }))
                      }
                    />
                  </div>

                  <label className={styles.toggleRow} style={{ alignSelf: 'end' }}>
                    <div className={styles.toggleLabel}>
                      <span className={styles.toggleTitle}>Link Previews API</span>
                      <span className={styles.toggleDesc}>Allow external URL metadata proxy</span>
                    </div>
                    <input
                      type="checkbox"
                      className={styles.checkboxInput}
                      checked={systemConfig.linkPreviewsEnabled}
                      onChange={(e) =>
                        setSystemConfig((prev) => ({
                          ...prev,
                          linkPreviewsEnabled: e.target.checked,
                        }))
                      }
                    />
                  </label>
                </div>
              </section>
            </div>

            {/* Global Workspace Broadcast + Live Preview */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Global Workspace Announcement Banner</h2>
                  <p className={styles.cardDesc}>
                    Broadcast system updates or advisories across all signed-in workspaces with live preview.
                  </p>
                </div>
                <label className={styles.inlineCheck}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={systemConfig.bannerEnabled}
                    onChange={(e) =>
                      setSystemConfig((prev) => ({ ...prev, bannerEnabled: e.target.checked }))
                    }
                  />
                  <span>Publish Banner Live</span>
                </label>
              </div>

              <div className={styles.panelGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="admin-banner-tone">
                    Severity Tone
                  </label>
                  <select
                    id="admin-banner-tone"
                    className={styles.select}
                    value={systemConfig.bannerTone}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSystemConfig((prev) => ({
                        ...prev,
                        bannerTone: (v === 'warning' || v === 'critical' ? v : 'info') as BannerTone,
                      }));
                    }}
                  >
                    <option value="info">Executive Notice (Neutral)</option>
                    <option value="warning">Service Advisory (Amber)</option>
                    <option value="critical">Critical Incident (Red)</option>
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
                    placeholder="e.g. Cloud Sync Upgrade"
                    value={systemConfig.bannerTitle}
                    onChange={(e) =>
                      setSystemConfig((prev) => ({ ...prev, bannerTitle: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="admin-banner-msg">
                  Announcement Body
                </label>
                <textarea
                  id="admin-banner-msg"
                  className={styles.textarea}
                  maxLength={500}
                  placeholder="Write a clear, concise status notice for workspace users…"
                  value={systemConfig.bannerMessage}
                  onChange={(e) =>
                    setSystemConfig((prev) => ({ ...prev, bannerMessage: e.target.value }))
                  }
                />
              </div>

              <div className={styles.panelGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="admin-banner-cta-label">
                    Optional CTA Button Label
                  </label>
                  <input
                    id="admin-banner-cta-label"
                    className={styles.input}
                    type="text"
                    maxLength={48}
                    placeholder="e.g. View Release Notes"
                    value={systemConfig.bannerActionLabel}
                    onChange={(e) =>
                      setSystemConfig((prev) => ({ ...prev, bannerActionLabel: e.target.value }))
                    }
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="admin-banner-cta-href">
                    Optional CTA Target (/path or https://)
                  </label>
                  <input
                    id="admin-banner-cta-href"
                    className={styles.input}
                    type="text"
                    maxLength={240}
                    placeholder="e.g. /settings or https://status.example.com"
                    value={systemConfig.bannerActionHref}
                    onChange={(e) =>
                      setSystemConfig((prev) => ({ ...prev, bannerActionHref: e.target.value }))
                    }
                  />
                </div>
              </div>

              {(systemConfig.bannerMessage || systemConfig.bannerTitle) && (
                <div className={styles.bannerPreviewBox}>
                  <span className={styles.fieldLabel}>Live Preview</span>
                  <div
                    className={`${styles.bannerPreviewItem} ${
                      systemConfig.bannerTone === 'warning'
                        ? styles.bannerPreviewWarn
                        : systemConfig.bannerTone === 'critical'
                        ? styles.bannerPreviewCritical
                        : ''
                    }`}
                  >
                    <div>
                      {systemConfig.bannerTitle && <strong>{systemConfig.bannerTitle}: </strong>}
                      <span>{systemConfig.bannerMessage || 'Your announcement body appears here.'}</span>
                    </div>
                    {systemConfig.bannerActionLabel && systemConfig.bannerActionHref && (
                      <span className={styles.statusPill}>{systemConfig.bannerActionLabel}</span>
                    )}
                  </div>
                </div>
              )}

              <div className={styles.actionsRow}>
                <button type="submit" className={styles.primaryBtn} disabled={savingControls}>
                  {savingControls ? 'Publishing Controls…' : 'Publish & Propagate Controls'}
                </button>
                <span className={styles.userSecondary}>
                  {systemConfig.updatedAt
                    ? `Last published ${formatDateTime(systemConfig.updatedAt)} by ${systemConfig.updatedBy || 'owner'}`
                    : 'Not yet published'}
                </span>
              </div>
            </section>
          </form>
        )}

        {/* ── SECTION 4: OPERATIONS, DIAGNOSTICS & RATE LIMITS ────────────── */}
        {section === 'operations' && (
          <div className={styles.stackGap}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Live Service Health Diagnostics</h2>
                  <p className={styles.cardDesc}>
                    Executes real-time network latency probes from the Node server against Identity Toolkit, Firestore, Redis, and SSRF protections.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={diagBusy}
                  onClick={() => void handleRunDiagnostics()}
                >
                  <Server size={14} />
                  <span>{diagBusy ? 'Running Probes…' : 'Run Health Check'}</span>
                </button>
              </div>

              {!diagnostics ? (
                <div className={styles.emptyState}>
                  Click <strong>Run Health Check</strong> to measure live dependency latencies and security self-tests.
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Subsystem</th>
                        <th>Status</th>
                        <th>Latency</th>
                        <th>Diagnostic Output</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnostics.checks.map((chk) => (
                        <tr key={chk.id}>
                          <td className={styles.userPrimary}>{chk.label}</td>
                          <td>
                            <span className={styles.statusPill}>
                              <span
                                className={`${styles.statusDot} ${
                                  chk.status === 'pass'
                                    ? styles.statusDotOk
                                    : chk.status === 'fail'
                                    ? styles.statusDotDanger
                                    : styles.statusDotWarn
                                }`}
                                aria-hidden="true"
                              />
                              <span>{chk.status.toUpperCase()}</span>
                            </span>
                          </td>
                          <td className={styles.mono}>
                            {chk.latencyMs > 0 ? `${chk.latencyMs} ms` : '—'}
                          </td>
                          <td className={styles.userSecondary}>{chk.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className={styles.panelGrid}>
              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Rate-Limit Hotspots &amp; Memory</h2>
                    <p className={styles.cardDesc}>
                      Active sliding-window counters ({overview.caches.rateLimit.activeBuckets} / {overview.caches.rateLimit.maxEntries} buckets).
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    disabled={busy}
                    onClick={() => void handleServerAction('clear-rate-limits')}
                  >
                    Reset Buckets
                  </button>
                </div>

                {overview.caches.rateLimit.topBuckets.length === 0 ? (
                  <div className={styles.emptyState}>No active rate-limit pressure in current window.</div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Bucket Key</th>
                          <th>Hits</th>
                          <th>Resets In</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.caches.rateLimit.topBuckets.map((b) => (
                          <tr key={b.bucket}>
                            <td className={styles.mono}>{b.bucket}</td>
                            <td className={styles.mono}>{b.count}</td>
                            <td className={styles.mono}>{b.resetsInSeconds}s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Server Memory &amp; Link Preview Cache</h2>
                    <p className={styles.cardDesc}>
                      Node runtime {overview.runtime.nodeVersion} ({overview.runtime.platform}/{overview.runtime.arch}).
                    </p>
                  </div>
                  <div className={styles.actionsRow}>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={busy}
                      onClick={() => void handleServerAction('clear-link-cache')}
                    >
                      Flush Link Cache
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={busy}
                      onClick={() => void handleServerAction('refresh-system-config')}
                    >
                      Reload Policy Cache
                    </button>
                  </div>
                </div>

                <div className={styles.checkList}>
                  <div className={styles.checkRow}>
                    <span>Resident Set Size (RSS)</span>
                    <span className={styles.mono}>{overview.runtime.memory.rssMb} MB</span>
                  </div>
                  <div className={styles.checkRow}>
                    <span>V8 Heap Used / Allocated</span>
                    <span className={styles.mono}>
                      {overview.runtime.memory.heapUsedMb} / {overview.runtime.memory.heapTotalMb} MB
                    </span>
                  </div>
                  <div className={styles.checkRow}>
                    <span>Link Preview Cache Occupancy</span>
                    <span className={styles.mono}>
                      {overview.caches.linkPreview.entries} / {overview.caches.linkPreview.maxEntries} URLs
                    </span>
                  </div>
                  <div className={styles.checkRow}>
                    <span>Server Policy Cache Source</span>
                    <span className={styles.mono}>
                      {overview.serverConfigCache?.source || 'firestore'} (
                      {Math.round((overview.serverConfigCache?.ageMs || 0) / 1000)}s old)
                    </span>
                  </div>
                </div>

                {overview.caches.linkPreview.sampleHosts.length > 0 && (
                  <div className={styles.chipRow}>
                    {overview.caches.linkPreview.sampleHosts.map((host) => (
                      <span key={host} className={styles.statusPill}>
                        {host}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* ── SECTION 5: OPERATIONAL INCIDENTS ────────────────────────────── */}
        {section === 'incidents' && (
          <div className={styles.stackGap}>
            <form onSubmit={handleCreateIncident} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Publish Operational Incident or Changelog Notice</h2>
                  <p className={styles.cardDesc}>
                    Track production incidents, maintenance windows, and resolution timelines in Firestore (<code>adminIncidents</code>).
                  </p>
                </div>
              </div>

              <div className={styles.panelGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="inc-title">
                    Incident / Advisory Title
                  </label>
                  <input
                    id="inc-title"
                    className={styles.input}
                    type="text"
                    required
                    maxLength={140}
                    placeholder="e.g. Elevated latency on external link previews"
                    value={incidentTitle}
                    onChange={(e) => setIncidentTitle(e.target.value)}
                  />
                </div>

                <div className={styles.panelGrid}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="inc-severity">
                      Severity
                    </label>
                    <select
                      id="inc-severity"
                      className={styles.select}
                      value={incidentSeverity}
                      onChange={(e) =>
                        setIncidentSeverity(e.target.value as IncidentRecord['severity'])
                      }
                    >
                      <option value="minor">Minor Notice</option>
                      <option value="maintenance">Scheduled Maintenance</option>
                      <option value="major">Major Incident</option>
                    </select>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="inc-status">
                      Initial Stage
                    </label>
                    <select
                      id="inc-status"
                      className={styles.select}
                      value={incidentStatus}
                      onChange={(e) =>
                        setIncidentStatus(e.target.value as IncidentRecord['status'])
                      }
                    >
                      <option value="investigating">Investigating</option>
                      <option value="identified">Identified</option>
                      <option value="monitoring">Monitoring</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="inc-summary">
                  Operational Summary
                </label>
                <textarea
                  id="inc-summary"
                  className={styles.textarea}
                  required
                  maxLength={600}
                  placeholder="Describe scope, impact, and mitigation status…"
                  value={incidentSummary}
                  onChange={(e) => setIncidentSummary(e.target.value)}
                />
              </div>

              <div className={styles.actionsRow}>
                <button type="submit" className={styles.primaryBtn} disabled={savingIncident}>
                  <Plus size={14} />
                  <span>{savingIncident ? 'Recording…' : 'Log Incident Record'}</span>
                </button>
              </div>
            </form>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Incident Timeline ({incidents.length})</h2>
                  <p className={styles.cardDesc}>Update lifecycle stage or resolve active advisories.</p>
                </div>
              </div>

              {incidents.length === 0 ? (
                <div className={styles.emptyState}>All systems nominal — no logged incidents.</div>
              ) : (
                <div className={styles.checkList}>
                  {incidents.map((inc) => {
                    const isResolved = inc.status === 'resolved';
                    return (
                      <div key={inc.id} className={styles.incidentRow}>
                        <div className={styles.incidentMain}>
                          <div className={styles.drawerBadgeRow}>
                            <span className={styles.statusPill}>
                              <span
                                className={`${styles.statusDot} ${
                                  isResolved
                                    ? styles.statusDotOk
                                    : inc.severity === 'major'
                                    ? styles.statusDotDanger
                                    : styles.statusDotWarn
                                }`}
                                aria-hidden="true"
                              />
                              <span>{inc.status}</span>
                            </span>
                            <span className={styles.statusPill}>{inc.severity}</span>
                            <span className={styles.userSecondary}>{formatDateTime(inc.createdAt)}</span>
                          </div>
                          <div className={styles.userPrimary}>{inc.title}</div>
                          <div className={styles.userSecondary}>{inc.summary}</div>
                        </div>

                        <div className={styles.actionsRow}>
                          {!isResolved && (
                            <button
                              type="button"
                              className={styles.miniBtn}
                              disabled={busy}
                              onClick={() => void handleUpdateIncidentStatus(inc.id, inc.title, 'resolved')}
                            >
                              <CheckCircle2 size={13} />
                              <span>Mark Resolved</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.miniBtn}
                            disabled={busy}
                            onClick={() => void handleDeleteIncident(inc.id, inc.title)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── SECTION 6: AUDIT & COMPLIANCE TRAIL ─────────────────────────── */}
        {section === 'audit' && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Compliance &amp; Security Audit Trail</h2>
                <p className={styles.cardDesc}>
                  Immutable-style operational history stored in Firestore (<code>adminAudit</code>).
                </p>
              </div>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleExportAuditJson}
                disabled={filteredAudit.length === 0}
              >
                <Download size={14} />
                <span>Export JSON ({filteredAudit.length})</span>
              </button>
            </div>

            <div className={styles.filterToolbar}>
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search action, detail, or actor email…"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
              <select
                className={styles.selectCompact}
                aria-label="Filter audit category"
                value={auditCategory}
                onChange={(e) => setAuditCategory(e.target.value as typeof auditCategory)}
              >
                <option value="all">All Categories</option>
                <option value="users">Users</option>
                <option value="security">Security</option>
                <option value="config">Config</option>
                <option value="operations">Operations</option>
                <option value="incidents">Incidents</option>
              </select>
            </div>

            {filteredAudit.length === 0 ? (
              <div className={styles.emptyState}>No matching audit log events recorded.</div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Action</th>
                      <th>Detail</th>
                      <th>Actor</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAudit.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <span className={styles.statusPill}>{entry.category}</span>
                        </td>
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

      <AdminUserDrawer
        userRecord={inspectedUser}
        adminUid={overview.admin.uid}
        adminEmail={overview.admin.email}
        onClose={() => setInspectedUser(null)}
        onAudit={appendAudit}
        onRefresh={refreshAllData}
        onNotify={notify}
      />
    </div>
  );
}
