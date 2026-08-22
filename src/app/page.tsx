import type { Metadata } from 'next';
import TodayDashboardContent from './TodayDashboardContent';

export const metadata: Metadata = {
  title: 'Today — Life OS',
  description: 'Your daily action center. See what to focus on today to make progress toward your goals.',
};

export default function TodayPage() {
  return <TodayDashboardContent />;
}
