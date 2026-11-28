/**
 * Lightweight, in-memory sliding window rate limiter for API routes.
 * Protects against DoS, brute force, and runaway API credit consumption.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const MAX_RATE_LIMIT_ENTRIES = 10_000;

// Periodic cleanup every 5 minutes to prevent memory leak
if (typeof setInterval !== 'undefined') {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (record.resetAt <= now) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Unref interval if running in Node.js so it does not block process exit
  if (typeof interval === 'object' && interval && 'unref' in interval) {
    (interval as NodeJS.Timeout).unref();
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || record.resetAt <= now) {
    if (!record && rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
      const oldestKey = rateLimitMap.keys().next().value;
      if (oldestKey) rateLimitMap.delete(oldestKey);
    }
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count += 1;
  return { success: true, remaining: limit - record.count, resetAt: record.resetAt };
}

/**
 * Distributed-ready rate limiter: uses Upstash Redis REST when configured
 * (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`), otherwise falls back
 * transparently to the bounded in-memory sliding window.
 */
export async function checkRateLimitAsync(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!redisUrl || !redisToken) {
    return checkRateLimit(key, limit, windowMs);
  }

  try {
    const bucketKey = `ratelimit:${key}`;
    const resp = await fetch(`${redisUrl.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(1500),
      body: JSON.stringify([
        ['INCR', bucketKey],
        ['PTTL', bucketKey],
      ]),
    });
    if (!resp.ok) {
      return checkRateLimit(key, limit, windowMs);
    }
    const results = (await resp.json()) as Array<{ result?: number }>;
    const count = Number(results?.[0]?.result ?? 1);
    let ttl = Number(results?.[1]?.result ?? -1);
    if (ttl < 0) {
      await fetch(`${redisUrl.replace(/\/$/, '')}/pexpire/${encodeURIComponent(bucketKey)}/${windowMs}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${redisToken}` },
        signal: AbortSignal.timeout(1500),
      }).catch(() => undefined);
      ttl = windowMs;
    }
    return {
      success: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: Date.now() + Math.max(0, ttl),
    };
  } catch {
    return checkRateLimit(key, limit, windowMs);
  }
}

export function getClientIp(req: Request): string {
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

function parseNumericIpv4Token(token: string): number | null {
  if (/^0x[0-9a-f]+$/i.test(token)) {
    const n = Number.parseInt(token, 16);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  if (/^0[0-7]+$/.test(token)) {
    const n = Number.parseInt(token, 8);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  if (/^\d+$/.test(token)) {
    const n = Number.parseInt(token, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

function tryNormalizeNumericIpv4(host: string): string | null {
  const parts = host.split('.');
  if (parts.length === 1) {
    const n = parseNumericIpv4Token(parts[0]);
    if (n === null || n > 0xffffffff) return null;
    return [
      (n >>> 24) & 0xff,
      (n >>> 16) & 0xff,
      (n >>> 8) & 0xff,
      n & 0xff,
    ].join('.');
  }
  if (parts.length === 4) {
    const nums = parts.map(parseNumericIpv4Token);
    if (nums.some((n) => n === null || n > 255)) return null;
    return nums.join('.');
  }
  return null;
}

function isPrivateNormalizedIpv4(ip: string, allowLocalDev: boolean): boolean {
  const [a, b] = ip.split('.').map(Number);
  if (a === 127) return !allowLocalDev;
  if (a === 0 || a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 169 && b === 254) return true; // Link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

/**
 * Validates if an IP / hostname is private, loopback, or cloud metadata.
 * Defends against Server-Side Request Forgery (SSRF), including IPv4-mapped IPv6
 * and decimal/hex/octal obfuscated IP literals.
 */
export function isPrivateOrReservedHost(host: string, allowLocalDev = false): boolean {
  let h = host.toLowerCase().replace(/^\[|\]$/g, '').trim();
  const zoneIdx = h.indexOf('%');
  if (zoneIdx !== -1) h = h.slice(0, zoneIdx);

  // Unwrap IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (h.startsWith('::ffff:')) {
    const mapped = h.slice(7);
    if (mapped.includes('.')) {
      const normalized = tryNormalizeNumericIpv4(mapped);
      return normalized ? isPrivateNormalizedIpv4(normalized, allowLocalDev) : true;
    }
    const hexGroups = mapped.split(':');
    if (hexGroups.length === 2) {
      const hi = Number.parseInt(hexGroups[0], 16);
      const lo = Number.parseInt(hexGroups[1], 16);
      if (Number.isFinite(hi) && Number.isFinite(lo)) {
        const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
        return isPrivateNormalizedIpv4(ipv4, allowLocalDev);
      }
    }
    return true;
  }

  // Cloud metadata services (AWS, GCP, Azure, OpenStack) — ALWAYS strictly blocked
  if (
    h === '169.254.169.254' ||
    h === 'metadata.google.internal' ||
    h === 'instance-data' ||
    h === '100.100.100.200' ||
    /^169\.254\./.test(h)
  ) {
    return true;
  }

  // Numeric/obfuscated IPv4 (decimal integer, hex, octal, dotted)
  const normalizedIpv4 = tryNormalizeNumericIpv4(h);
  if (normalizedIpv4) {
    return isPrivateNormalizedIpv4(normalizedIpv4, allowLocalDev);
  }

  // Localhost / Loopback
  const isLoopback =
    h === 'localhost' ||
    h === '::1' ||
    h === '::' ||
    h.endsWith('.localhost');

  if (isLoopback) {
    return !allowLocalDev;
  }

  // Internal domain suffixes & private IPv6 ranges (fc00::/7, fe80::/10, ff00::/8)
  if (
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    /^f[cd][0-9a-f]{0,2}:/i.test(h) ||
    /^fe[89ab][0-9a-f]:/i.test(h) ||
    /^ff[0-9a-f]{2}:/i.test(h)
  ) {
    return true;
  }

  return false;
}

