import React from 'react';
import PageSkeleton from '@/components/ui/PageSkeleton';

export default function KnowledgeLoading() {
  return <PageSkeleton variant="knowledge" cardsCount={5} showMetrics={false} showControls={true} />;
}
