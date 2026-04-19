'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import DashboardFree from './DashboardFree';
import DashboardClassic from './DashboardClassic';
import DashboardCommand from './DashboardCommand';
import DashboardPremium from './DashboardPremium';
import DashboardChatGPT from './DashboardChatGPT';

export type DashboardStyle = 'free' | 'command' | 'classic' | 'premium' | 'chatgpt';

export const useDashboardStyle = create<{
  style: DashboardStyle;
  setStyle: (s: DashboardStyle) => void;
}>()(
  persist(
    (set) => ({
      style: 'free', // TODO: remettre 'command' comme défaut au lancement commercial
      setStyle: (style) => set({ style }),
    }),
    { name: 'yova-dashboard-style' },
  ),
);

export default function DashboardPage() {
  const { style } = useDashboardStyle();

  if (style === 'classic') return <DashboardClassic />;
  if (style === 'premium') return <DashboardPremium />;
  if (style === 'chatgpt') return <DashboardChatGPT />;
  if (style === 'command') return <DashboardCommand />;
  return <DashboardFree />;
}
