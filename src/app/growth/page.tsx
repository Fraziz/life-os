import type { Metadata } from 'next';
import GrowthContent from './GrowthContent';

export const metadata: Metadata = {
  title: 'The Growth System — Sariling Mundo',
  description: 'Mastery governor, 3 levels of interest, 90-day commitment sprints, and deliberate personal development.',
};

export default function GrowthPage() {
  return <GrowthContent />;
}

