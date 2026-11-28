'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AIAssistantPanel from '@/components/assistant/AIAssistantPanel';

export default function AiPopoutPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'Assistant — Sariling Mundo';
    }
  }, []);

  return (
    <AIAssistantPanel
      isOpen={true}
      standalone={true}
      onClose={() => {
        if (typeof window !== 'undefined' && window.opener) {
          window.close();
        } else {
          router.push('/');
        }
      }}
    />
  );
}
