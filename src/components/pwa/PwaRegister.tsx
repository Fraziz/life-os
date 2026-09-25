'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            // Service worker successfully registered
          })
          .catch(() => {
            // Ignore failure in private browser modes
          });
      });
    }
  }, []);

  return null;
}
