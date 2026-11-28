import { NextResponse } from 'next/server';
import { verifyAdminRequest, unauthorizedAdminResponse } from '@/lib/adminAuth';
import { FIREBASE_CLIENT_CONFIG } from '@/lib/firebaseConfig';
import { checkRateLimitAsync, getClientIp, getRateLimitDetails, getRateLimitStats } from '@/lib/rateLimit';
import { getPreviewCacheSampleHosts, getPreviewCacheStats } from '@/lib/linkPreviewCache';
import { getServerSystemConfig, getServerSystemConfigMeta } from '@/lib/serverSystemConfig';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const rate = await checkRateLimitAsync(`admin-overview:${clientIp}`, 30, 60 * 1000);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const verified = await verifyAdminRequest(request);
  if (!verified) {
    return unauthorizedAdminResponse();
  }

  const [serverConfig] = await Promise.all([getServerSystemConfig(false)]);
  const groq1 = Boolean(process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY);
  const groq2 = Boolean(process.env.GROQ_API_KEY_2);
  const mem = process.memoryUsage();
  const toMb = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 10) / 10;

  return NextResponse.json({
    authorized: true,
    admin: {
      uid: verified.user.uid,
      email: verified.user.email,
      verifiedVia: verified.verifiedVia,
    },
    runtime: {
      nodeVersion: process.version,
      nodeEnv: process.env.NODE_ENV || 'development',
      platform: process.platform,
      arch: process.arch,
      uptimeSeconds: Math.round(process.uptime()),
      serverTime: new Date().toISOString(),
      memory: {
        rssMb: toMb(mem.rss),
        heapUsedMb: toMb(mem.heapUsed),
        heapTotalMb: toMb(mem.heapTotal),
        externalMb: toMb(mem.external),
      },
    },
    infrastructure: {
      firebaseProjectId: FIREBASE_CLIENT_CONFIG.projectId || '',
      firebaseProjectConfigured: Boolean(FIREBASE_CLIENT_CONFIG.projectId && FIREBASE_CLIENT_CONFIG.apiKey),
      siteOriginConfigured: Boolean(process.env.NEXT_PUBLIC_SITE_URL || process.env.URL),
      upstashRedisConfigured: Boolean(
        process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ),
      groqKeyPoolCount: (groq1 ? 1 : 0) + (groq2 ? 1 : 0),
      geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
      openaiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
      anthropicKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      customAdminAllowlistConfigured: Boolean(process.env.ADMIN_EMAILS || process.env.ADMIN_UIDS),
    },
    caches: {
      rateLimit: {
        ...getRateLimitStats(),
        topBuckets: getRateLimitDetails(12),
      },
      linkPreview: {
        ...getPreviewCacheStats(),
        sampleHosts: getPreviewCacheSampleHosts(8),
      },
    },
    serverConfig,
    serverConfigCache: getServerSystemConfigMeta(),
  });
}
