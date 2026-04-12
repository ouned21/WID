'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import DashboardClassic from './DashboardClassic';
import DashboardCommand from './DashboardCommand';

export type DashboardStyle = 'command' | 'classic';

export const useDashboardStyle = create<{
  style: DashboardStyle;
  setStyle: (s: DashboardStyle) => void;
}>()(
  persist(
    (set) => ({
      style: 'command',
      setStyle: (style) => set({ style }),
    }),
    { name: 'theload-dashboard-style' },
  ),
);

export default function DashboardPage() {
  const { style } = useDashboardStyle();

  if (style === 'classic') return <DashboardClassic />;
  return <DashboardCommand />;
}
