import React from 'react';
import PageSkeleton from '@/components/ui/PageSkeleton';

export default function ProjectsLoading() {
  return <PageSkeleton variant="cards" cardsCount={4} showMetrics={true} showControls={true} />;
}
