import React from 'react';
import PageSkeleton from '@/components/ui/PageSkeleton';

export default function GlobalLoading() {
  return <PageSkeleton variant="default" cardsCount={5} />;
}
