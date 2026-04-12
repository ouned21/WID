'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

/**
 * Applique le thème courant aux CSS variables du document.
 * À utiliser dans le layout principal.
 */
export function useApplyTheme() {
  const theme = useThemeStore((s) => s.getTheme());
  const skin = useThemeStore((s) => s.skin);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--background', theme.bg);
    root.style.setProperty('--foreground', theme.text);
    root.style.setProperty('--card', theme.card);
    root.style.setProperty('--text-secondary', theme.textSecondary);
    root.style.setProperty('--text-muted', theme.textMuted);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--accent-gradient', theme.accentGradient);
    root.style.setProperty('--ios-separator', theme.separator);
    root.style.setProperty('--input-bg', theme.inputBg);
    root.style.setProperty('--nav-bg', theme.navBg);
    root.style.setProperty('--header-bg', theme.headerBg);
    root.style.setProperty('--bg-secondary', theme.bgSecondary);

    // Mettre à jour les meta tags
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', theme.bg);
  }, [skin, theme]);
}
