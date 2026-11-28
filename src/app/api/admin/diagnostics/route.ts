import { NextResponse } from 'next/server';
import { verifyAdminRequest, unauthorizedAdminResponse } from '@/lib/adminAuth';
import { FIREBASE_CLIENT_CONFIG } from '@/lib/firebaseConfig';
import { checkRateLimitAsync, getClientIp, isPrivateOrReservedHost } from '@/lib/rateLimit';
import { getServerSystemConfig } from '@/lib/serverSystemConfig';

export const dynamic = 'force-dynamic';

export interface DiagnosticCheckResult {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  latencyMs: number;
  detail: string;
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rate = await checkRateLimitAsync(`admin-diagnostics:${clientIp}`, 15, 60 * 1000);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const authStart = performance.now();
  const verified = await verifyAdminRequest(request);
  const authLatencyMs = Math.max(1, Math.round(performance.now() - authStart));
  if (!verified) {
    return unauthorizedAdminResponse();
  }

  const checks: DiagnosticCheckResult[] = [
    {
      id: 'identity-toolkit',
      label: 'Firebase Auth Identity Verification',
      status: 'pass',
      latencyMs: authLatencyMs,
      detail: `Token verified via ${verified.verifiedVia}`,
    },
  ];

  // Probe 2: Firestore REST Public Config Read
  const fsStart = performance.now();
  try {
    const projectId = FIREBASE_CLIENT_CONFIG.projectId;
    if (!projectId) {
      checks.push({
        id: 'firestore-rest',
        label: 'Firestore Control Document Read',
        status: 'fail',
        latencyMs: 0,
        detail: 'Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID configuration',
      });
    } else {
      const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        projectId
      )}/databases/(default)/documents/app/systemConfig`;
      const resp = await fetch(endpoint, {
        cache: 'no-store',
        signal: AbortSignal.timeout(3500),
      });
      const fsLatency = Math.max(1, Math.round(performance.now() - fsStart));
      if (resp.ok || resp.status === 404) {
        checks.push({
          id: 'firestore-rest',
          label: 'Firestore Control Document Read',
          status: 'pass',
          latencyMs: fsLatency,
          detail: resp.ok
            ? `HTTP ${resp.status} — app/systemConfig reachable`
            : `HTTP 404 — Firestore reachable (default config active until first publish)`,
        });
      } else {
        checks.push({
          id: 'firestore-rest',
          label: 'Firestore Control Document Read',
          status: 'warn',
          latencyMs: fsLatency,
          detail: `HTTP ${resp.status} while querying app/systemConfig`,
        });
      }
    }
  } catch (err: unknown) {
    const fsLatency = Math.max(1, Math.round(performance.now() - fsStart));
    checks.push({
      id: 'firestore-rest',
      label: 'Firestore Control Document Read',
      status: 'fail',
      latencyMs: fsLatency,
      detail: err instanceof Error ? err.message : 'Connection timeout',
    });
  }

  // Probe 3: Upstash Redis (if configured)
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (redisUrl && redisToken) {
    const rStart = performance.now();
    try {
      const rResp = await fetch(`${redisUrl.replace(/\/$/, '')}/ping`, {
        headers: { Authorization: `Bearer ${redisToken}` },
        signal: AbortSignal.timeout(2500),
      });
      const rLatency = Math.max(1, Math.round(performance.now() - rStart));
      checks.push({
        id: 'upstash-redis',
        label: 'Upstash Distributed Rate-Limit Store',
        status: rResp.ok ? 'pass' : 'fail',
        latencyMs: rLatency,
        detail: rResp.ok ? 'PING acknowledged by Redis edge node' : `HTTP ${rResp.status}`,
      });
    } catch (err: unknown) {
      const rLatency = Math.max(1, Math.round(performance.now() - rStart));
      checks.push({
        id: 'upstash-redis',
        label: 'Upstash Distributed Rate-Limit Store',
        status: 'fail',
        latencyMs: rLatency,
        detail: err instanceof Error ? err.message : 'Redis probe timeout',
      });
    }
  } else {
    checks.push({
      id: 'upstash-redis',
      label: 'Upstash Distributed Rate-Limit Store',
      status: 'warn',
      latencyMs: 0,
      detail: 'Not configured — bounded in-memory sliding window active',
    });
  }

  // Probe 4: SSRF Egress Guard Self-Test
  const ssrfStart = performance.now();
  const ssrfPassed =
    isPrivateOrReservedHost('127.0.0.1') &&
    isPrivateOrReservedHost('169.254.169.254') &&
    isPrivateOrReservedHost('metadata.google.internal') &&
    isPrivateOrReservedHost('10.0.0.1') &&
    !isPrivateOrReservedHost('api.openai.com');
  checks.push({
    id: 'ssrf-shield',
    label: 'SSRF & Metadata Egress Firewall',
    status: ssrfPassed ? 'pass' : 'fail',
    latencyMs: Math.max(1, Math.round(performance.now() - ssrfStart)),
    detail: ssrfPassed
      ? 'Loopback, RFC1918, and cloud metadata ranges blocked'
      : 'Firewall invariant check failed',
  });

  // Probe 5: Node Memory & Runtime Policy Sync
  const mem = process.memoryUsage();
  const heapRatio = mem.heapTotal > 0 ? mem.heapUsed / mem.heapTotal : 0;
  const serverCfg = await getServerSystemConfig(true);
  checks.push({
    id: 'runtime-heap',
    label: 'Node Runtime Memory & Policy Cache',
    status: heapRatio < 0.9 ? 'pass' : 'warn',
    latencyMs: 1,
    detail: `Heap ${Math.round((mem.heapUsed / (1024 * 1024)) * 10) / 10}MB / ${
      Math.round((mem.heapTotal / (1024 * 1024)) * 10) / 10
    }MB · AI Limit ${serverCfg.aiRateLimitPerMin}/min`,
  });

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    checks,
  });
}
