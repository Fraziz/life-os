import type { Metadata } from 'next';
import RoadmapContent from './RoadmapContent';

export const metadata: Metadata = {
  title: 'Life Roadmap — Life OS',
  description: 'Visualize your entire life plan as a node graph. See how your Dreams flow into Goals, Projects, and Tasks.',
};

export default function RoadmapPage() {
  return <RoadmapContent />;
}
