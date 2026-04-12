/**
 * Design System — The Load
 *
 * Tokens centralisés pour couleurs, espacements, typographie.
 * Tous les composants doivent utiliser ces tokens au lieu de valeurs hardcodées.
 */

// Couleurs principales
export const colors = {
  // Accent
  blue: '#007aff',
  green: '#34c759',
  orange: '#ff9500',
  red: '#ff3b30',
  purple: '#af52de',
  indigo: '#5856d6',

  // Fond
  bg: '#f6f8ff',
  card: '#ffffff',

  // Texte
  text: '#1c1c1e',
  textSecondary: '#3c3c43',
  textMuted: '#8e8e93',
  textLight: '#c7c7cc',

  // Séparateurs
  separator: 'rgba(60, 60, 67, 0.12)',

  // Inputs
  inputBg: '#f2f2f7',
} as const;

// Gradients
export const gradients = {
  accent: 'linear-gradient(135deg, #007aff, #5856d6)',
  boost: 'linear-gradient(135deg, #ff9500, #ff3b30)',
  success: 'linear-gradient(135deg, #34c759, #30d158)',
} as const;

/**
 * Calcule le Load d'une tâche.
 * Si global_score existe (V2), l'utilise. Sinon, estime depuis mental_load_score.
 * L'ancien mental_load_score (0-5 ou 0-10) est converti sur l'échelle 0-36.
 */
export function taskLoad(task: { global_score?: number | null; mental_load_score: number }): number {
  if (task.global_score != null) return Math.min(36, task.global_score);
  // Ancien score : 0-5 → convertir proportionnellement sur 36
  // (un score de 5/5 = charge max ≈ 36, score de 3/5 ≈ 22)
  const normalized = Math.min(5, task.mental_load_score); // plafonner à 5
  return Math.round((normalized / 5) * 36);
}

// Couleur du score Load selon la valeur
export function loadColor(score: number): string {
  if (score <= 8) return colors.green;
  if (score <= 16) return colors.blue;
  if (score <= 24) return colors.orange;
  return colors.red;
}

// Message du Load selon la valeur moyenne
export function loadMessage(avgPerTask: number): string {
  if (avgPerTask === 0) return 'Aucune charge';
  if (avgPerTask <= 10) return 'Charge légère — ça roule';
  if (avgPerTask <= 20) return 'Charge modérée — sous contrôle';
  if (avgPerTask <= 28) return 'Charge élevée — attention';
  return 'Surcharge — rééquilibrage urgent';
}

// Ombres
export const shadows = {
  sm: '0 0.5px 3px rgba(0,0,0,0.04)',
  md: '0 1px 4px rgba(0,0,0,0.06)',
  lg: '0 2px 8px rgba(0,0,0,0.1)',
  hero: '0 4px 20px rgba(0,0,0,0.15)',
} as const;

// Styles de cartes réutilisables
export const cardStyle = {
  background: colors.card,
  boxShadow: shadows.sm,
  borderRadius: '16px',
} as const;

export const cardStyleMd = {
  background: colors.card,
  boxShadow: shadows.md,
  borderRadius: '20px',
} as const;
