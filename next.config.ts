import type { NextConfig } from "next";

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseio.com https://*.firebaseapp.com https://www.gstatic.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://www.gstatic.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.groq.com https://api.openai.com https://api.anthropic.com https://api.deepseek.com https://openrouter.ai https://api.mistral.com https://api-inference.huggingface.co https://api.cohere.com wss://*.firebaseio.com wss://*.googleapis.com ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://www.youtube.com https://youtube.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=()',
  },
  {
    key: 'Content-Security-Policy',
    value: cspDirectives,
  },
];

const nextConfig: NextConfig = {
  // Disable reactStrictMode double-mounting in dev to cut tab transition latency in half
  reactStrictMode: false,
  async headers() {
    return [
      {
        // General security headers for all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
