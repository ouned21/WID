'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from '@/stores/authStore';
import DashboardFree from './DashboardFree';
import DashboardClassic from './DashboardClassic';
import DashboardCommand from './DashboardCommand';
import DashboardPremium from './DashboardPremium';
import DashboardChatGPT from './DashboardChatGPT';

export type DashboardStyle = 'command' | 'classic' | 'premium' | 'chatgpt';

export const useDashboardStyle = create<{
  style: DashboardStyle;
  setStyle: (s: DashboardStyle) => void;
}>()(
  persist(
    (set) => ({
      style: 'command',
      setStyle: (style) => set({ style }),
    }),
    { name: 'aura-dashboard-style' },
  ),
);

export default function DashboardPage() {
  const { style } = useDashboardStyle();
  const isPremium = useAuthStore((s) => s.isPremium());

  // Utilisateurs gratuits : dashboard simplifié (feed + météo + score paywallé)
  if (!isPremium) {
    return <DashboardFree />;
  }

  // Utilisateurs premium : choisissent leur skin préféré
  if (style === 'classic') return <DashboardClassic />;
  if (style === 'premium') return <DashboardPremium />;
  if (style === 'chatgpt') return <DashboardChatGPT />;
  return <DashboardCommand />;
}
