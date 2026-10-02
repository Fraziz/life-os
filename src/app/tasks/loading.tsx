import React from 'react';
import PageSkeleton from '@/components/ui/PageSkeleton';

export default function TasksLoading() {
  return <PageSkeleton variant="tasks" cardsCount={6} showMetrics={true} showControls={true} />;
}
