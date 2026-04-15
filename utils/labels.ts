/**
 * Labels centralisés pour toute l'app.
 * Tous les textes utilisateur passent par ici pour garantir la cohérence
 * entre les skins et les pages.
 */

export const LABELS = {
  // ── DASHBOARD ──
  dashboard: {
    myScore: 'Mon Score',
    scoreSuffix: '/10',
    weekTrendUp: (n: number) => `+${n} tâches vs semaine passée`,
    weekTrendDown: (n: number) => `${n} tâches vs semaine passée`,
    weekTrendStable: 'Aucune évolution vs semaine passée',
    targetLabel: (target: number, current: number) =>
      `Objectif ${target}% · Actuel ${current}%`,
    interpretation: (score10: number, myPct: number, target: number) => {
      if (score10 >= 8) return 'Ta charge est très élevée cette semaine. Pense à rééquilibrer.';
      if (score10 >= 6) return 'Charge conséquente. Tu gères, mais reste vigilant.';
      if (myPct > target + 10) return `Tu portes plus que ton objectif de ${myPct - target} points.`;
      if (myPct < target - 10) return `Tu es sous ton objectif de ${target - myPct} points.`;
      return 'Tu es proche de ton objectif. Bon équilibre.';
    },
    householdBalance: 'Équilibre du foyer',
    aiInsights: 'Résumé IA',
    aiInsightsSubtitle: 'Analyse de ta répartition et patterns',
    aiInsightsTitle: 'Insights',
    eveningRecap: '🌙 Comment s\'est passée ta journée ?',
    eveningRecapSub: 'Coche en rafale, en 15 secondes',
  },

  // ── COULEURS DU SCORE (fond dynamique) ──
  scoreColors: {
    low: { bg: 'linear-gradient(135deg, #34c759, #30d158)', text: 'white' },       // 0-3 vert
    medium: { bg: 'linear-gradient(135deg, #ff9500, #ffcc00)', text: 'white' },    // 4-5 orange
    high: { bg: 'linear-gradient(135deg, #ff6b00, #ff9500)', text: 'white' },      // 6-7 orange foncé
    critical: { bg: 'linear-gradient(135deg, #ff3b30, #ff6b00)', text: 'white' },  // 8-10 rouge
  },

  // ── NAVIGATION ──
  nav: {
    home: 'Accueil',
    tasks: 'Tâches',
    planning: 'Planning',
    profile: 'Profil',
  },
} as const;

/**
 * Retourne la couleur de fond de la hero card selon le score /10.
 */
export function getScoreGradient(score10: number): { bg: string; text: string } {
  if (score10 <= 3) return LABELS.scoreColors.low;
  if (score10 <= 5) return LABELS.scoreColors.medium;
  if (score10 <= 7) return LABELS.scoreColors.high;
  return LABELS.scoreColors.critical;
}
