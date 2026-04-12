'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeSkin = 'ios' | 'dark' | 'ocean' | 'sunset';

export type ThemeConfig = {
  name: string;
  description: string;
  preview: string; // emoji
  bg: string;
  bgSecondary: string;
  card: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentGradient: string;
  separator: string;
  inputBg: string;
  navBg: string;
  headerBg: string;
};

export const THEMES: Record<ThemeSkin, ThemeConfig> = {
  ios: {
    name: 'iOS Classic',
    description: 'Clair et épuré',
    preview: '⬜',
    bg: '#f2f2f7',
    bgSecondary: '#ffffff',
    card: '#ffffff',
    text: '#1c1c1e',
    textSecondary: '#3c3c43',
    textMuted: '#8e8e93',
    accent: '#007aff',
    accentGradient: 'linear-gradient(135deg, #007aff, #5856d6)',
    separator: 'rgba(60, 60, 67, 0.12)',
    inputBg: '#f2f2f7',
    navBg: 'rgba(255,255,255,0.8)',
    headerBg: 'rgba(255,255,255,0.8)',
  },
  dark: {
    name: 'Command Center',
    description: 'Sombre et premium',
    preview: '⬛',
    bg: '#0a0e1a',
    bgSecondary: '#111827',
    card: '#1a1f35',
    text: '#f0f4ff',
    textSecondary: '#a0aec0',
    textMuted: '#64748b',
    accent: '#60a5fa',
    accentGradient: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    separator: 'rgba(148, 163, 184, 0.15)',
    inputBg: '#1e293b',
    navBg: 'rgba(10, 14, 26, 0.9)',
    headerBg: 'rgba(10, 14, 26, 0.9)',
  },
  ocean: {
    name: 'Océan',
    description: 'Bleu profond et apaisant',
    preview: '🌊',
    bg: '#0f172a',
    bgSecondary: '#1e293b',
    card: '#1e3a5f',
    text: '#e2e8f0',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    accent: '#06b6d4',
    accentGradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
    separator: 'rgba(148, 163, 184, 0.15)',
    inputBg: '#1e293b',
    navBg: 'rgba(15, 23, 42, 0.9)',
    headerBg: 'rgba(15, 23, 42, 0.9)',
  },
  sunset: {
    name: 'Coucher de soleil',
    description: 'Chaud et énergique',
    preview: '🌅',
    bg: '#1a0a0a',
    bgSecondary: '#2d1515',
    card: '#3d1f1f',
    text: '#fef2f2',
    textSecondary: '#fca5a5',
    textMuted: '#b91c1c',
    accent: '#f59e0b',
    accentGradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    separator: 'rgba(239, 68, 68, 0.15)',
    inputBg: '#2d1515',
    navBg: 'rgba(26, 10, 10, 0.9)',
    headerBg: 'rgba(26, 10, 10, 0.9)',
  },
};

type ThemeState = {
  skin: ThemeSkin;
  setSkin: (skin: ThemeSkin) => void;
  getTheme: () => ThemeConfig;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      skin: 'ios',
      setSkin: (skin) => set({ skin }),
      getTheme: () => THEMES[get().skin] ?? THEMES.ios,
    }),
    { name: 'theload-theme' },
  ),
);
