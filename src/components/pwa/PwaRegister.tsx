'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Proactively clear obsolete cache if present
      if ('caches' in window) {
        window.caches.has('life-os-v1').then((hasOldCache) => {
          if (hasOldCache) {
            window.caches.delete('life-os-v1');
          }
        }).catch(() => {});
      }

      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker
            .register('/sw.js')
            .then((reg) => {
              // Immediately check for a newer service worker
              reg.update().catch(() => {});

              if (reg.waiting) {
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
              }

              reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (newWorker) {
                  newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                      newWorker.postMessage({ type: 'SKIP_WAITING' });
                    }
                  });
                }
              });
            })
            .catch(() => {
              // Ignore failure in private browser modes
            });
        });
      }
    }
  }, []);

  return null;
}

