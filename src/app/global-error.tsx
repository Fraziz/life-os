'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error('[Sariling Mundo] Global error boundary caught:', error);
  }, [error]);

  const handleRetry = () => {
    if (typeof retry === 'function') {
      retry();
      return;
    }
    if (typeof reset === 'function') {
      reset();
      return;
    }
    window.location.href = '/';
  };

  return (
    <html lang="en">
      <head>
        <title>Sariling Mundo — Unexpected Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#f4f5f8',
          color: '#0d0f14',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <main
          role="alert"
          style={{
            width: '100%',
            maxWidth: '460px',
            background: '#ffffff',
            border: '1px solid #d0d4df',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#545869', marginBottom: '10px' }}>
            Application Recovery
          </div>
          <h1 style={{ margin: '0 0 10px', fontSize: '22px', lineHeight: 1.25 }}>
            Unable to load Sariling Mundo
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: '14px', lineHeight: 1.55, color: '#545869' }}>
            An unexpected rendering issue occurred. Your cloud and local workspace data remains preserved.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleRetry}
              style={{
                minHeight: '44px',
                padding: '0 18px',
                borderRadius: '8px',
                border: '1px solid #0d0f14',
                background: '#0d0f14',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload App
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/login';
              }}
              style={{
                minHeight: '44px',
                padding: '0 18px',
                borderRadius: '8px',
                border: '1px solid #d0d4df',
                background: '#eaedf2',
                color: '#0d0f14',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Go to Sign In
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
