/**
 * Design System — Yova
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
  inputBg: '#f0f2f8',
} as const;

// Gradients
export const gradients = {
  accent: 'linear-gradient(135deg, #007aff, #5856d6)',
  boost: 'linear-gradient(135deg, #ff9500, #ff3b30)',
  success: 'linear-gradient(135deg, #34c759, #30d158)',
} as const;

/**
 * Score AFFICHAGE — ce que l'utilisateur voit sur ses propres tâches.
 * Priorité : user_score (choix utilisateur /10) > legacy mental_load_score.
 * Retourne un score /10.
 */
export function taskScoreDisplay(task: { user_score?: number | null; mental_load_score: number }): number {
  if (task.user_score != null) return Math.min(10, task.user_score);
  // Legacy 0-5 → /10
  return Math.min(10, Math.round((Math.min(5, task.mental_load_score) / 5) * 10));
}

/**
 * Score COMPARAISON — utilisé pour les échanges, le rééquilibrage, les analytics.
 * Utilise user_score /10 converti en /36, ou legacy mental_load_score.
 */
export function taskScoreCompare(task: { user_score?: number | null; mental_load_score: number }): number {
  if (task.user_score != null) return Math.round(task.user_score * 3.6);
  const normalized = Math.min(5, task.mental_load_score);
  return Math.round((normalized / 5) * 36);
}

/**
 * @deprecated Utiliser taskScoreDisplay() ou taskScoreCompare() selon le contexte.
 * Conservé pour rétrocompatibilité — redirige vers taskScoreCompare.
 */
export function taskLoad(task: { user_score?: number | null; mental_load_score: number }): number {
  return taskScoreCompare(task);
}

/** Convertir un score Load /36 en base 10 */
export function loadTo10(score36: number): number {
  return Math.min(10, Math.round((score36 / 36) * 10));
}

// ─── Temps réel (minutes par semaine) ────────────────────────────────────────

/** Durée estimée → minutes pour une occurrence */
const DURATION_MINUTES: Record<string, number> = {
  very_short: 5,
  short: 20,
  medium: 45,
  long: 90,
  very_long: 180,
};

/** Fréquence → coefficient hebdomadaire (occurrences par semaine) */
const FREQUENCY_WEEKLY_COEFF: Record<string, number> = {
  daily: 7,
  weekly: 1,
  biweekly: 0.5,
  monthly: 0.25,
  quarterly: 0.083,
  semiannual: 0.042,
  yearly: 0.019,
  once: 0,
};

/**
 * Calcule le nombre de minutes par semaine pour une tâche.
 * Basé sur duration_estimate × fréquence hebdomadaire.
 */
export function weeklyMinutes(task: { duration_estimate?: string | null; frequency?: string | null }): number {
  const duration = DURATION_MINUTES[task.duration_estimate ?? 'short'] ?? 20;
  const coeff = FREQUENCY_WEEKLY_COEFF[task.frequency ?? 'weekly'] ?? 1;
  return Math.round(duration * coeff);
}

/**
 * Formate des minutes en chaîne lisible : "45min", "2h", "2h30"
 */
export function formatWeeklyTime(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

/** Couleur cohérente base 10 : 0-3 vert, 4-5 orange, 6-7 orange foncé, 8-10 rouge */
export function scoreColor10(score10: number): string {
  if (score10 <= 3) return '#34c759';
  if (score10 <= 5) return '#ff9500';
  if (score10 <= 7) return '#ff6b00';
  return '#ff3b30';
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
  if (avgPerTask === 0) return 'Rien en vue. Profite.';
  if (avgPerTask <= 10) return 'Tu gères. Continue comme ça.';
  if (avgPerTask <= 20) return 'Sous contrôle. Quelques priorités à suivre.';
  if (avgPerTask <= 28) return 'Forte pression cette semaine. Reste vigilant.';
  return 'Surcharge détectée. Pense à rééquilibrer.';
}

// Typographie — échelle limitée à 6 tailles
export const typo = {
  hero: 'text-[40px] font-black',        // Score principal, chiffre hero
  title: 'text-[28px] font-bold',         // Titre de page
  section: 'text-[18px] font-semibold',   // Titre de section
  body: 'text-[15px]',                    // Texte courant
  caption: 'text-[12px]',                 // Labels, sous-titres
  micro: 'text-[10px]',                   // Tags, badges, metadata
} as const;

// Espacement — système 8px
export const space = {
  xs: '8px',   // 0.5rem — entre éléments très proches
  sm: '12px',  // 0.75rem — entre éléments liés
  md: '16px',  // 1rem — espacement standard
  lg: '24px',  // 1.5rem — entre sections
  xl: '32px',  // 2rem — entre blocs majeurs
} as const;

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
