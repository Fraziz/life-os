import { NextRequest, NextResponse } from 'next/server';
import { isPrivateOrReservedHost } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    const contentType = upstreamRes.headers.get('content-type') || 'text/html';

    // If it's a binary asset or image
    if (!contentType.includes('text/html')) {
      const buffer = await upstreamRes.arrayBuffer();
      return new Response(buffer, {
        status: upstreamRes.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    let html = await upstreamRes.text();

    // Remove any meta-tag based CSP or XFO injected by CMS/plugins
    html = html.replace(/<meta[^>]*http-equiv=["']?(?:content-security-policy|x-frame-options)["']?[^>]*>/gi, '');

    // 1. Injected base tag and no-referrer meta so relative images and CDN assets load smoothly
    const baseTag = `<base href="${targetUrl}"><meta name="referrer" content="no-referrer">`;

    // 2. Anti-framebusting & in-reader navigation handler
    const injectedScript = `
<script>
  (function() {
    try {
      // Neutralize window.top / window.parent navigation traps
      window.top = window.self;
      window.parent = window.self;
    } catch(e) {}

    // Intercept in-page scanlation navigation to keep reader inside the proxy engine
    document.addEventListener('click', function(e) {
      var a = e.target && e.target.closest('a');
      if (a && a.href && /^https?:\\/\\//i.test(a.href)) {
        try {
          var dest = new URL(a.href);
          if (dest.hostname === "${parsed.hostname}" && !a.href.includes('/api/manhwa/proxy')) {
            e.preventDefault();
            window.location.href = '/api/manhwa/proxy?url=' + encodeURIComponent(a.href);
          }
        } catch(err) {}
      }
    }, true);
  })();
</script>
<style>
  /* Life OS Reader In-Frame Optimizations */
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
        // Omitting X-Frame-Options and Content-Security-Policy allows same-origin iframe embedding
      },
    });
  } catch (err: any) {
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Source Verification Required</title>
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
    .btn-group {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
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
      border: 1px solid transparent;
      min-height: 44px;
    }
    .btn-primary {
      background: #4f46e5;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #4338ca;
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      color: #cbd5e1;
      border-color: rgba(255, 255, 255, 0.15);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>Cloudflare Protection Active</h2>
    <p>
      The provider (<strong>${parsed.hostname}</strong>) requires direct browser verification.
      Launch your dedicated pop-out reader window below to read smoothly without frame restrictions.
    </p>
    <div class="btn-group">
      <button onclick="window.open('${targetUrl}', 'LifeOSManhwaReader', 'width=1100,height=900,resizable=yes,scrollbars=yes')" class="btn btn-primary">
        Launch Focused Window
      </button>
      <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
        Open Direct Link
      </a>
    </div>
  </div>
</body>
</html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
