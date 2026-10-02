import React from 'react';
import PageSkeleton from '@/components/ui/PageSkeleton';

export default function InboxLoading() {
  return <PageSkeleton variant="tasks" cardsCount={5} showMetrics={false} showControls={true} />;
}
