/**
 * Lightweight, in-memory sliding window rate limiter for API routes.
 * Protects against DoS, brute force, and runaway API credit consumption.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

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
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count += 1;
  return { success: true, remaining: limit - record.count, resetAt: record.resetAt };
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

/**
 * Validates if an IP / hostname is private, loopback, or cloud metadata.
 * Defends against Server-Side Request Forgery (SSRF).
 */
export function isPrivateOrReservedHost(host: string, allowLocalDev = false): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '').trim();

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

  // Localhost / Loopback
  const isLoopback =
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h === '::' ||
    /^127\./.test(h) ||
    h.endsWith('.localhost');

  if (isLoopback) {
    return !allowLocalDev;
  }

  // Private RFC 1918 / IPv6 ranges
  if (
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h) ||
    /^0\./.test(h) ||
    /^fc00:/i.test(h) ||
    /^fe80:/i.test(h)
  ) {
    return true;
  }

  return false;
}

