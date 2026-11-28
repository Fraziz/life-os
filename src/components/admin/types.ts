import type { SystemConfig } from '@/lib/systemConfig';

export type AdminSection =
  | 'overview'
  | 'users'
  | 'ai'
  | 'controls'
  | 'operations'
  | 'incidents'
  | 'audit';

export type AuditCategory = 'users' | 'config' | 'security' | 'operations' | 'incidents';

export interface OverviewApiResponse {
  authorized: boolean;
  admin: {
    uid: string;
    email: string;
    verifiedVia: string;
  };
  runtime: {
    nodeVersion: string;
    nodeEnv: string;
    platform: string;
    arch: string;
    uptimeSeconds: number;
    serverTime: string;
    memory: {
      rssMb: number;
      heapUsedMb: number;
      heapTotalMb: number;
      externalMb: number;
    };
  };
  infrastructure: {
    firebaseProjectId: string;
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
    rateLimit: {
      activeBuckets: number;
      totalTracked: number;
      maxEntries: number;
      topBuckets: Array<{
        bucket: string;
        count: number;
        resetsInSeconds: number;
      }>;
    };
    linkPreview: {
      entries: number;
      maxEntries: number;
      sampleHosts: string[];
    };
  };
  serverConfig?: SystemConfig;
  serverConfigCache?: {
    cached: boolean;
    source: string;
    ageMs: number;
  };
}

export interface DiagnosticCheckItem {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  latencyMs: number;
  detail: string;
}

export interface DiagnosticsReport {
  ok: boolean;
  checkedAt: string;
  checks: DiagnosticCheckItem[];
}

export interface DirectoryUserRecord {
  uid: string;
  email: string;
  displayName: string;
  provider: string;
  emailVerified: boolean;
  createdAt?: string;
  lastActiveAt?: string;
  accountStatus?: 'active' | 'suspended';
  suspensionReason?: string;
  suspendedAt?: string;
  adminRole?: 'member' | 'support' | 'owner';
}

export interface AdminUserNote {
  note: string;
  riskFlag: 'normal' | 'watch' | 'vip';
  updatedAt?: string;
  updatedBy?: string;
}

export interface DeviceSessionRecord {
  deviceId: string;
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  model?: string;
  signedInAt: number;
  lastActive: number;
  revoked?: boolean;
}

export interface AuditEntry {
  id: string;
  category: AuditCategory;
  action: string;
  detail: string;
  actorEmail: string;
  createdAt: string;
}

export interface IncidentRecord {
  id: string;
  title: string;
  severity: 'minor' | 'major' | 'maintenance';
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  summary: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export function formatUptime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${s % 60}s`;
}

export function formatDateTime(iso?: string): string {
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

export function formatRelativeTime(input?: string | number): string {
  const ms = typeof input === 'number' ? input : input ? Date.parse(input) : NaN;
  if (!Number.isFinite(ms)) return '—';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDateTime(new Date(ms).toISOString());
}

export function formatProvider(raw: string): string {
  if (raw === 'google.com') return 'Google SSO';
  if (raw === 'password') return 'Email / Password';
  return raw || 'Email';
}

export function escapeCsvCell(raw: unknown): string {
  const text = String(raw ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
