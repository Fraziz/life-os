import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkRateLimit, getRateLimitDetails, isPrivateOrReservedHost } from '../src/lib/rateLimit';
import { isBookStorageKey, isManagedKvKey } from '../src/lib/cloudStore';
import { hashLocalPin, verifyLocalPin } from '../src/lib/pinHash';
import { isSafeRichUrl, sanitizeRichHtml } from '../src/utils/htmlSanitizer';
import { verifyAdminRequest } from '../src/lib/adminAuth';
import { clearPreviewCache, getCachedPreview, getPreviewCacheSampleHosts, getPreviewCacheStats, setPreviewCache } from '../src/lib/linkPreviewCache';
import { sanitizeBannerHref, sanitizeSystemConfig } from '../src/lib/systemConfig';
import { maskSecretKey } from '../src/lib/serverAiVault';

test('SSRF protection blocks private networks, localhost, metadata, and obfuscated IPs', () => {
  assert.equal(isPrivateOrReservedHost('127.0.0.1'), true);
  assert.equal(isPrivateOrReservedHost('localhost'), true);
  assert.equal(isPrivateOrReservedHost('sub.localhost'), true);
  assert.equal(isPrivateOrReservedHost('169.254.169.254'), true);
  assert.equal(isPrivateOrReservedHost('metadata.google.internal'), true);
  assert.equal(isPrivateOrReservedHost('10.0.0.1'), true);
  assert.equal(isPrivateOrReservedHost('172.16.0.1'), true);
  assert.equal(isPrivateOrReservedHost('192.168.1.50'), true);
  assert.equal(isPrivateOrReservedHost('2130706433'), true); // 127.0.0.1 decimal
  assert.equal(isPrivateOrReservedHost('0x7f000001'), true); // 127.0.0.1 hex
  assert.equal(isPrivateOrReservedHost('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateOrReservedHost('service.internal'), true);

  // Allowed localhost only in explicit local dev override
  assert.equal(isPrivateOrReservedHost('localhost', true), false);

  // Public domains pass
  assert.equal(isPrivateOrReservedHost('api.openai.com'), false);
  assert.equal(isPrivateOrReservedHost('github.com'), false);
});

test('Rate limiter enforces sliding window limits per key', () => {
  const key = `test-limit-${Date.now()}`;
  const r1 = checkRateLimit(key, 2, 60_000);
  const r2 = checkRateLimit(key, 2, 60_000);
  const r3 = checkRateLimit(key, 2, 60_000);

  assert.equal(r1.success, true);
  assert.equal(r1.remaining, 1);
  assert.equal(r2.success, true);
  assert.equal(r2.remaining, 0);
  assert.equal(r3.success, false);
  assert.equal(r3.remaining, 0);
});

test('Storage key classification separates books and secrets from managed KV', () => {
  assert.equal(isBookStorageKey('life_os_knowledge_docs_v1'), true);
  assert.equal(isBookStorageKey('life_os_deleted_book_ids_v1'), true);
  assert.equal(isBookStorageKey('life_os_tasks_v1'), false);

  // Book keys & auth/session keys must NOT sync through generic KV
  assert.equal(isManagedKvKey('life_os_knowledge_docs_v1'), false);
  assert.equal(isManagedKvKey('life_os_active_uid'), false);
  assert.equal(isManagedKvKey('life_os_guest_vault_pin'), false);
  assert.equal(isManagedKvKey('life_os_guest_mode'), false);
  assert.equal(isManagedKvKey('life_os_kv_updated_v1'), false);

  // Normal workspace KV keys must sync
  assert.equal(isManagedKvKey('life_os_tasks_v1'), true);
  assert.equal(isManagedKvKey('life_os_goals_v1'), true);
  assert.equal(isManagedKvKey('life_os_inbox_v1'), true);
  assert.equal(isManagedKvKey('life_os_user_settings_v1'), true);
});

test('Local PIN hashing uses salted SHA-256 and verifies matches safely', async () => {
  const origWindow = (globalThis as { window?: unknown }).window;
  try {
    (globalThis as { window?: unknown }).window = { crypto: globalThis.crypto };
    const hashed = await hashLocalPin('4829');
    assert.match(hashed, /^sha256:[0-9a-f]{16}:[0-9a-f]{64}$/);
    assert.equal(await verifyLocalPin('4829', hashed), true);
    assert.equal(await verifyLocalPin('0000', hashed), false);
    // Legacy plaintext fallback still verifies cleanly
    assert.equal(await verifyLocalPin('1234', '1234'), true);
  } finally {
    if (origWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = origWindow;
    }
  }
});

test('HTML sanitizer strips XSS scripts, event handlers, and unsafe URLs', () => {
  assert.equal(isSafeRichUrl('https://example.com'), true);
  assert.equal(isSafeRichUrl('/tasks'), true);
  assert.equal(isSafeRichUrl('javascript:alert(1)'), false);
  assert.equal(isSafeRichUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeRichUrl('data:image/png;base64,iVBORw0KGgo=', true), true);

  const dirty = '<p onclick="alert(1)">Hello</p><script>evil()</script><a href="javascript:alert(2)">bad</a>';
  const clean = sanitizeRichHtml(dirty);
  assert.equal(clean.includes('<script'), false);
  assert.equal(clean.includes('onclick'), false);
  assert.equal(clean.includes('javascript:'), false);
  assert.equal(clean.includes('Hello'), true);
});

test('Admin verification rejects missing or malformed bearer tokens', async () => {
  const noAuthReq = new Request('http://localhost:3000/api/admin/session');
  assert.equal(await verifyAdminRequest(noAuthReq), null);

  const badAuthReq = new Request('http://localhost:3000/api/admin/session', {
    headers: { authorization: 'Basic invalid' },
  });
  assert.equal(await verifyAdminRequest(badAuthReq), null);
});

test('Link preview cache stores, reads, and flushes entries cleanly', () => {
  clearPreviewCache();
  assert.equal(getPreviewCacheStats().entries, 0);
  setPreviewCache('https://example.com', {
    url: 'https://example.com',
    hostname: 'example.com',
    title: 'Example',
    description: 'Desc',
    image: null,
    favicon: '/favicon.ico',
    siteName: 'Example',
  });
  assert.equal(getPreviewCacheStats().entries, 1);
  assert.equal(getCachedPreview('https://example.com')?.title, 'Example');
  assert.deepEqual(getPreviewCacheSampleHosts(4), ['example.com']);
  assert.equal(clearPreviewCache(), 1);
  assert.equal(getCachedPreview('https://example.com'), null);
});

test('SystemConfig sanitizer clamps rate limits and blocks unsafe banner URLs', () => {
  assert.equal(sanitizeBannerHref('/settings'), '/settings');
  assert.equal(sanitizeBannerHref('https://status.example.com'), 'https://status.example.com/');
  assert.equal(sanitizeBannerHref('javascript:alert(1)'), '');
  assert.equal(sanitizeBannerHref('//evil.com'), '');

  const cfg = sanitizeSystemConfig({
    aiRateLimitPerMin: 9999,
    bannerTone: 'critical',
    bannerActionHref: 'javascript:evil()',
    maintenanceMode: true,
    serverAiEnabled: false,
  });

  assert.equal(cfg.aiRateLimitPerMin, 120);
  assert.equal(cfg.bannerTone, 'critical');
  assert.equal(cfg.bannerActionHref, '');
  assert.equal(cfg.maintenanceMode, true);
  assert.equal(cfg.serverAiEnabled, false);
});

test('RateLimit details surface busiest active buckets cleanly', () => {
  const bucketKey = `admin-diag-test-${Date.now()}`;
  checkRateLimit(bucketKey, 10, 60_000);
  checkRateLimit(bucketKey, 10, 60_000);
  const details = getRateLimitDetails(20);
  const found = details.find((d) => d.bucket === bucketKey);
  assert.ok(found);
  assert.equal(found.count, 2);
});

test('Server AI vault maskSecretKey redacts empty, short, and standard secrets', () => {
  assert.equal(maskSecretKey(''), '');
  assert.equal(maskSecretKey('   '), '');
  assert.equal(maskSecretKey('shortkey'), '••••••••');
  assert.equal(maskSecretKey('gsk_1234567890abcdef'), 'gsk_••••cdef');
  assert.equal(maskSecretKey('  sk-proj-abcdef1234  '), 'sk-p••••1234');
});

test('SystemConfig preserves non-secret AI availability fields without leaking secrets', () => {
  const configured = sanitizeSystemConfig({
    aiConfigured: true,
    aiProvider: '  gemini  ',
    aiModel: 'gemini-2.0-flash',
    serverAiEnabled: true,
  });
  assert.equal(configured.aiConfigured, true);
  assert.equal(configured.aiProvider, 'gemini');
  assert.equal(configured.aiModel, 'gemini-2.0-flash');

  const blankDefaults = sanitizeSystemConfig({
    aiConfigured: false,
    aiProvider: '   ',
    aiModel: '',
  });
  assert.equal(blankDefaults.aiConfigured, false);
  assert.equal(blankDefaults.aiProvider, 'groq');
  assert.equal(blankDefaults.aiModel, 'openai/gpt-oss-120b');
});
