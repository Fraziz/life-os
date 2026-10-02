import React from 'react';
import PageSkeleton from '@/components/ui/PageSkeleton';

export default function CalendarLoading() {
  return <PageSkeleton variant="calendar" cardsCount={4} showMetrics={false} showControls={true} />;
}
