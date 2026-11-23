import type { NextConfig } from "next";

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
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  // Disable reactStrictMode double-mounting in dev to cut tab transition latency in half
  reactStrictMode: false,
  async headers() {
    return [
      {
        // Dedicated headers for in-web manhwa reader proxy: allow embedding in Life OS iframe
        source: '/api/manhwa/proxy',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self'",
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      {
        // General security headers for all other routes
        source: '/((?!api/manhwa/proxy).*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
