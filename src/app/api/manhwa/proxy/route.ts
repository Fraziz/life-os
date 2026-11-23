import { NextRequest, NextResponse } from 'next/server';
import { isPrivateOrReservedHost } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

async function handleProxy(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url');
  if (!urlParam) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  let targetUrl = urlParam.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return new NextResponse('Unsupported protocol', { status: 400 });
  }

  if (isPrivateOrReservedHost(parsed.hostname)) {
    return new NextResponse('Restricted host', { status: 403 });
  }

  try {
    const isPost = req.method === 'POST';
    const reqHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `${parsed.origin}/`,
      'Origin': parsed.origin,
    };

    const contentTypeHeader = req.headers.get('content-type');
    if (contentTypeHeader) {
      reqHeaders['Content-Type'] = contentTypeHeader;
    }

    let requestBody: ArrayBuffer | undefined = undefined;
    if (isPost) {
      requestBody = await req.arrayBuffer();
    }

    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: reqHeaders,
      body: requestBody,
      redirect: 'follow',
    });

    const contentType = upstreamRes.headers.get('content-type') || 'text/html';

    // 1. If it's JSON (e.g. /auth/chapter-content, /wp-json/...), return as JSON with CORS enabled
    if (contentType.includes('application/json')) {
      const jsonText = await upstreamRes.text();
      return new Response(jsonText, {
        status: upstreamRes.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=60',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    // 2. If it's a binary asset, stylesheet, script, or image
    if (!contentType.includes('text/html')) {
      const buffer = await upstreamRes.arrayBuffer();
      return new Response(buffer, {
        status: upstreamRes.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
          'X-Frame-Options': 'SAMEORIGIN',
        },
      });
    }

    // 3. HTML page: rewrite anti-embedding headers & inject fetch interceptor
    let html = await upstreamRes.text();

    // Strip any meta-tag based CSP or XFO
    html = html.replace(/<meta[^>]*http-equiv=["']?(?:content-security-policy|x-frame-options)["']?[^>]*>/gi, '');

    // Injected base tag and no-referrer meta so relative images and CDN assets load smoothly
    const baseTag = `<base href="${targetUrl}"><meta name="referrer" content="no-referrer">`;

    // Interceptor: monkey-patches window.fetch, XMLHttpRequest, and navigation so all dynamic chapter requests route through proxy
    const injectedScript = `
<script>
  (function() {
    var targetOrigin = "${parsed.origin}";
    var targetHost = "${parsed.hostname}";

    // 1. Neutralize window.top / window.parent navigation traps
    try {
      Object.defineProperty(window, 'top', { get: function() { return window.self; } });
      Object.defineProperty(window, 'parent', { get: function() { return window.self; } });
    } catch(e) {
      try { window.top = window.self; window.parent = window.self; } catch(err) {}
    }

    function toProxyUrl(url) {
      if (!url || typeof url !== 'string') return url;
      if (url.startsWith('/api/manhwa/proxy')) return url;
      try {
        var absolute;
        if (url.startsWith('http://') || url.startsWith('https://')) {
          absolute = url;
        } else if (url.startsWith('//')) {
          absolute = window.location.protocol + url;
        } else if (url.startsWith('/')) {
          absolute = targetOrigin + url;
        } else {
          absolute = targetOrigin + '/' + url;
        }
        var parsedUrl = new URL(absolute);
        if (parsedUrl.hostname === targetHost || parsedUrl.hostname.endsWith("." + targetHost.replace(/^www\\./, ''))) {
          return '/api/manhwa/proxy?url=' + encodeURIComponent(absolute);
        }
      } catch(e) {}
      return url;
    }

    // 2. Monkey-patch window.fetch for dynamic chapter content loading (e.g. /auth/chapter-content)
    if (window.fetch) {
      var rawFetch = window.fetch;
      window.fetch = function(input, init) {
        if (typeof input === 'string') {
          return rawFetch(toProxyUrl(input), init);
        } else if (input && input.url) {
          var proxied = toProxyUrl(input.url);
          if (proxied !== input.url) {
            try {
              return rawFetch(new Request(proxied, input), init);
            } catch(e) {
              return rawFetch(proxied, init);
            }
          }
        }
        return rawFetch.apply(this, arguments);
      };
    }

    // 3. Monkey-patch XMLHttpRequest for legacy AJAX / WordPress admin-ajax
    if (window.XMLHttpRequest) {
      var rawOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        if (typeof url === 'string') {
          url = toProxyUrl(url);
        }
        return rawOpen.call(this, method, url, async, user, password);
      };
    }

    // 4. Intercept link clicks to stay inside proxy engine
    document.addEventListener('click', function(e) {
      var a = e.target && e.target.closest('a');
      if (a && a.href && /^https?:\\/\\//i.test(a.href)) {
        try {
          var dest = new URL(a.href);
          if (dest.hostname === targetHost && !a.href.includes('/api/manhwa/proxy')) {
            e.preventDefault();
            window.location.href = '/api/manhwa/proxy?url=' + encodeURIComponent(a.href);
          }
        } catch(err) {}
      }
    }, true);
  })();
</script>
<style>
  /* Life OS Reader In-Frame Smooth Scroll */
  html {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
  }
</style>
`;

    // Insert base tag and script into <head>
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${baseTag}${injectedScript}`);
    } else if (html.includes('<head ')) {
      html = html.replace(/<head[^>]*>/, `$&${baseTag}${injectedScript}`);
    } else {
      html = `<head>${baseTag}${injectedScript}</head>${html}`;
    }

    // Replace common frame-busting JavaScript patterns in source
    html = html.replace(/\bwindow\.top\.location\b/g, 'window.self.location');
    html = html.replace(/\btop\.location\b/g, 'self.location');
    html = html.replace(/\bwindow\.parent\.location\b/g, 'window.self.location');

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "frame-ancestors 'self'",
      },
    });
  } catch (err: any) {
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Connection Verification</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 48px 24px;
      background: #0b0f19;
      color: #f1f5f9;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
      text-align: center;
      margin: 0;
    }
    .card {
      background: #181d2d;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 32px 28px;
      max-width: 480px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    }
    h2 {
      margin: 0 0 12px;
      font-size: 18px;
      font-weight: 600;
      color: #f8fafc;
    }
    p {
      color: #94a3b8;
      font-size: 13px;
      line-height: 1.6;
      margin: 0 0 24px;
    }
    .btn {
      padding: 10px 20px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #4f46e5;
      color: #ffffff;
      min-height: 44px;
      border: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>Connection Timeout</h2>
    <p>
      Could not connect to ${parsed.hostname} through the proxy channel.
    </p>
    <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" class="btn">
      Open Direct Link ↗
    </a>
  </div>
</body>
</html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'X-Frame-Options': 'SAMEORIGIN',
          'Content-Security-Policy': "frame-ancestors 'self'",
        },
      }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleProxy(req);
}

export async function POST(req: NextRequest) {
  return handleProxy(req);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
