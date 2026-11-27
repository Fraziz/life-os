const ALLOWED_IFRAME_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'vimeo.com',
  'www.tiktok.com',
  'tiktok.com',
  'www.facebook.com',
  'web.facebook.com',
  'platform.twitter.com',
  'twitter.com',
  'x.com',
  'www.instagram.com',
  'instagram.com',
];

const DANGEROUS_TAGS = new Set([
  'script',
  'style',
  'object',
  'embed',
  'applet',
  'base',
  'meta',
  'link',
  'form',
  'input',
  'textarea',
  'select',
]);

function isTrustedIframeSrc(rawSrc: string): boolean {
  try {
    const parsed = new URL(rawSrc.trim(), 'https://example.invalid');
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_IFRAME_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

export function isSafeRichUrl(rawUrl: string, allowDataImage = false): boolean {
  const clean = (rawUrl || '').trim();
  if (!clean) return false;
  if (clean.startsWith('/') || clean.startsWith('#')) return true;
  if (allowDataImage && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(clean)) {
    return true;
  }
  try {
    const parsed = new URL(clean);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Strips executable HTML, event handler attributes, untrusted iframes,
 * and dangerous URI schemes before rendering or assigning rich editor HTML.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  // Safe regex fallback for non-browser / SSR evaluation
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html
      .replace(/<\s*(script|style|object|embed|applet|iframe|form)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/<\s*(script|style|object|embed|applet|base|meta|link|iframe|form|input)[^>]*\/?\s*>/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s+(href|src|action|formaction)\s*=\s*["']\s*(?:javascript|vbscript|data:text\/html)[^"']*["']/gi, '');
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const walk = (root: ParentNode) => {
      const children = Array.from(root.children);
      for (const el of children) {
        const tag = el.tagName.toLowerCase();
        if (DANGEROUS_TAGS.has(tag)) {
          el.remove();
          continue;
        }

        if (tag === 'iframe') {
          const src = el.getAttribute('src') || '';
          if (!isTrustedIframeSrc(src)) {
            el.remove();
            continue;
          }
        }

        const attrs = Array.from(el.attributes);
        for (const attr of attrs) {
          const name = attr.name.toLowerCase();
          const val = attr.value || '';

          if (name.startsWith('on') || name === 'srcdoc') {
            el.removeAttribute(attr.name);
            continue;
          }

          if (
            name === 'href' ||
            name === 'src' ||
            name === 'action' ||
            name === 'formaction' ||
            name === 'data-preview-url'
          ) {
            const allowImg = tag === 'img' && name === 'src';
            if (val.trim() && !isSafeRichUrl(val, allowImg)) {
              el.removeAttribute(attr.name);
            }
          }
        }

        walk(el);
      }
    };

    walk(doc.body);
    return doc.body.innerHTML;
  } catch {
    return html
      .replace(/<\s*script\b[\s\S]*?<\s*\/\s*script\s*>/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  }
}
