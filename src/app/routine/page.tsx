import type { Metadata } from 'next';
import DailyRoutineRoadmap from '@/components/roadmap/DailyRoutineRoadmap';

export const metadata: Metadata = {
  title: 'Daily Routine · Sariling Mundo',
  description: 'Interactive 7:00 AM – 9:00 PM daily routine Graph Flow, Grid, and Timeline.',
};

export default function RoutinePage() {
  return <DailyRoutineRoadmap />;
}
