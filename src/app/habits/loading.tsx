import React from 'react';
import PageSkeleton from '@/components/ui/PageSkeleton';

export default function HabitsLoading() {
  return <PageSkeleton variant="cards" cardsCount={6} showMetrics={true} showControls={true} />;
}
