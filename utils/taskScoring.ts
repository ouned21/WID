/**
 * Moteur de scoring automatique des tâches FairShare.
 *
 * Calcule 4 sous-scores à partir de 5 inputs simples :
 * - Time Score (1-8) : durée estimée
 * - Physical Score (0-6) : effort physique
 * - Mental Load Score (0-18) : 6 dimensions calculées automatiquement
 * - Household Impact Score (1-4) : impact sur le foyer
 * - Global Score (2-36) : somme normalisée
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type DurationEstimate = 'very_short' | 'short' | 'medium' | 'long' | 'very_long';
export type PhysicalEffort = 'none' | 'light' | 'medium' | 'high';
export type TaskCategory =
  | 'children' | 'meals' | 'shopping' | 'cleaning' | 'laundry'
  | 'tidying' | 'admin' | 'transport' | 'household_management'
  | 'outdoor' | 'hygiene' | 'pets' | 'vehicle' | 'misc';

export type ScoreBreakdown = {
  time_score: number;
  physical_score: number;
  mental_breakdown: {
    anticipation: number;
    consequence_if_forgotten: number;
    interruption: number;
    decision_load: number;
    schedule_rigidity: number;
    responsibility_weight: number;
  };
  mental_load_score: number;
  household_impact_score: number;
  global_score: number;
  global_label: string;
  dominant: 'time' | 'physical' | 'mental' | 'impact';
};

export type TaskScoringInput = {
  title: string;
  category: TaskCategory;
  duration: DurationEstimate;
  physical: PhysicalEffort;
  frequency: string; // 'once' | 'daily' | 'weekly' | 'monthly' etc.
};

// -----------------------------------------------------------------------------
// Mappings
// -----------------------------------------------------------------------------

const TIME_MAP: Record<DurationEstimate, number> = {
  very_short: 1,
  short: 2,
  medium: 4,
  long: 6,
  very_long: 8,
};

const PHYSICAL_MAP: Record<PhysicalEffort, number> = {
  none: 0,
  light: 1,
  medium: 3,
  high: 5,
};

type MentalProfile = {
  anticipation: number;
  consequence: number;
  interruption: number;
  decision: number;
  rigidity: number;
  responsibility: number;
  impact: number; // 1-4
};

const CATEGORY_PROFILES: Record<TaskCategory, MentalProfile> = {
  children:              { anticipation: 2, consequence: 3, interruption: 3, decision: 2, rigidity: 2, responsibility: 3, impact: 4 },
  meals:                 { anticipation: 2, consequence: 2, interruption: 2, decision: 2, rigidity: 2, responsibility: 2, impact: 3 },
  shopping:              { anticipation: 2, consequence: 2, interruption: 1, decision: 2, rigidity: 1, responsibility: 2, impact: 3 },
  cleaning:              { anticipation: 0, consequence: 1, interruption: 1, decision: 0, rigidity: 0, responsibility: 1, impact: 2 },
  laundry:               { anticipation: 1, consequence: 2, interruption: 1, decision: 1, rigidity: 1, responsibility: 2, impact: 2 },
  tidying:               { anticipation: 0, consequence: 1, interruption: 1, decision: 0, rigidity: 0, responsibility: 1, impact: 2 },
  admin:                 { anticipation: 3, consequence: 3, interruption: 1, decision: 3, rigidity: 2, responsibility: 3, impact: 3 },
  transport:             { anticipation: 2, consequence: 3, interruption: 1, decision: 1, rigidity: 3, responsibility: 2, impact: 3 },
  household_management:  { anticipation: 3, consequence: 3, interruption: 2, decision: 3, rigidity: 2, responsibility: 3, impact: 3 },
  outdoor:               { anticipation: 1, consequence: 1, interruption: 0, decision: 0, rigidity: 1, responsibility: 1, impact: 2 },
  hygiene:               { anticipation: 0, consequence: 1, interruption: 1, decision: 0, rigidity: 0, responsibility: 1, impact: 2 },
  pets:                  { anticipation: 1, consequence: 2, interruption: 1, decision: 0, rigidity: 1, responsibility: 2, impact: 2 },
  vehicle:               { anticipation: 1, consequence: 2, interruption: 0, decision: 1, rigidity: 1, responsibility: 1, impact: 2 },
  misc:                  { anticipation: 1, consequence: 1, interruption: 1, decision: 1, rigidity: 1, responsibility: 1, impact: 2 },
};

// Mots-clés pour ajustements automatiques
const CHILDREN_KEYWORDS = ['école', 'ecole', 'crèche', 'creche', 'nounou', 'bébé', 'bebe', 'enfant', 'devoirs', 'bain', 'pédiatre', 'pediatre', 'médecin', 'medecin', 'vaccin', 'cartable', 'goûter', 'gouter'];
const ADMIN_KEYWORDS = ['facture', 'assurance', 'impôt', 'impot', 'document', 'rdv', 'rendez-vous', 'inscription', 'dossier', 'paiement', 'renouveler', 'banque', 'déclaration', 'declaration'];
const MEAL_KEYWORDS = ['courses', 'dîner', 'diner', 'repas', 'frigo', 'lait', 'couches', 'stock', 'cuisine', 'menu'];
const SIMPLE_KEYWORDS = ['poubelle', 'balai', 'serpillère', 'serpillere', 'vaisselle', 'aspirateur', 'essuyer'];

// -----------------------------------------------------------------------------
// Fonction principale
// -----------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeTaskScore(input: TaskScoringInput): ScoreBreakdown {
  const { title, category, duration, physical, frequency } = input;
  const titleLower = title.toLowerCase();

  // 1. Scores directs
  const time_score = TIME_MAP[duration];
  const physical_score = PHYSICAL_MAP[physical];

  // 2. Profil mental de base depuis la catégorie
  const profile = { ...CATEGORY_PROFILES[category] ?? CATEGORY_PROFILES.misc };
  let anticipation = profile.anticipation;
  let consequence = profile.consequence;
  let interruption = profile.interruption;
  let decision = profile.decision;
  let rigidity = profile.rigidity;
  let responsibility = profile.responsibility;
  let impact = profile.impact;

  // 3. Ajustements par fréquence
  if (frequency === 'daily') {
    anticipation = clamp(anticipation + 1, 0, 3);
    responsibility = clamp(responsibility + 1, 0, 3);
    consequence = clamp(consequence + 1, 0, 3);
  } else if (frequency === 'monthly' && (category === 'admin' || category === 'household_management')) {
    anticipation = clamp(anticipation + 1, 0, 3);
    rigidity = clamp(rigidity + 1, 0, 3);
  }

  // 4. Ajustements par durée
  if (duration === 'long' || duration === 'very_long') {
    responsibility = clamp(responsibility + 1, 0, 3);
  }
  if (duration === 'very_long' && ['children', 'meals', 'shopping', 'cleaning'].includes(category)) {
    interruption = clamp(interruption + 1, 0, 3);
  }

  // 5. Ajustements par mots-clés (combinaison, pas isolation)
  const hasChildrenKeyword = CHILDREN_KEYWORDS.some((kw) => titleLower.includes(kw));
  const hasAdminKeyword = ADMIN_KEYWORDS.some((kw) => titleLower.includes(kw));
  const hasMealKeyword = MEAL_KEYWORDS.some((kw) => titleLower.includes(kw));
  const hasSimpleKeyword = SIMPLE_KEYWORDS.some((kw) => titleLower.includes(kw));

  if (hasChildrenKeyword) {
    consequence = clamp(consequence + 1, 0, 3);
    impact = clamp(impact, 3, 4); // minimum 3 pour enfants
  }
  if (hasAdminKeyword) {
    decision = clamp(decision + 1, 0, 3);
    anticipation = clamp(anticipation + 1, 0, 3);
    rigidity = clamp(rigidity + 1, 0, 3);
  }
  if (hasMealKeyword) {
    anticipation = clamp(anticipation + 1, 0, 3);
    consequence = clamp(consequence + 1, 0, 3);
  }
  if (hasSimpleKeyword) {
    decision = clamp(decision - 1, 0, 3);
    anticipation = clamp(anticipation - 1, 0, 3);
  }

  // 6. Calcul du score mental
  const mental_load_score = anticipation + consequence + interruption + decision + rigidity + responsibility;

  // 7. Score global — pondéré (mental pèse plus, physique pèse moins)
  const weighted_score = (time_score * 1.0) + (physical_score * 0.8) + (mental_load_score * 1.5) + (impact * 1.0);
  // Normaliser sur 36 (max théorique pondéré = 8 + 4 + 27 + 4 = 43)
  const global_score = clamp(Math.round((weighted_score / 43) * 36), 2, 36);

  // 8. Label
  const global_label =
    global_score <= 8 ? 'Légère' :
    global_score <= 16 ? 'Modérée' :
    global_score <= 24 ? 'Significative' :
    global_score <= 31 ? 'Lourde' :
    'Très lourde';

  // 9. Dominante
  const scores = { time: time_score, physical: physical_score, mental: mental_load_score, impact };
  const dominant = (Object.entries(scores) as [keyof typeof scores, number][])
    .sort((a, b) => b[1] - a[1])[0][0];

  return {
    time_score,
    physical_score,
    mental_breakdown: {
      anticipation,
      consequence_if_forgotten: consequence,
      interruption,
      decision_load: decision,
      schedule_rigidity: rigidity,
      responsibility_weight: responsibility,
    },
    mental_load_score,
    household_impact_score: impact,
    global_score,
    global_label,
    dominant,
  };
}

// -----------------------------------------------------------------------------
// Labels pour l'UI
// -----------------------------------------------------------------------------

export const DURATION_OPTIONS: { value: DurationEstimate; label: string }[] = [
  { value: 'very_short', label: '< 5 min' },
  { value: 'short', label: '5-15 min' },
  { value: 'medium', label: '15-30 min' },
  { value: 'long', label: '30-60 min' },
  { value: 'very_long', label: '60+ min' },
];

export const PHYSICAL_OPTIONS: { value: PhysicalEffort; label: string }[] = [
  { value: 'none', label: 'Quasi nul' },
  { value: 'light', label: 'Léger' },
  { value: 'medium', label: 'Moyen' },
  { value: 'high', label: 'Intense' },
];

export const SCORING_CATEGORY_OPTIONS: { value: TaskCategory; label: string; emoji: string }[] = [
  { value: 'children', label: 'Enfants', emoji: '👶' },
  { value: 'meals', label: 'Repas', emoji: '🍳' },
  { value: 'shopping', label: 'Courses', emoji: '🛒' },
  { value: 'cleaning', label: 'Ménage', emoji: '🧹' },
  { value: 'laundry', label: 'Linge', emoji: '👕' },
  { value: 'tidying', label: 'Rangement', emoji: '📦' },
  { value: 'admin', label: 'Administratif', emoji: '📋' },
  { value: 'transport', label: 'Transport', emoji: '🚗' },
  { value: 'household_management', label: 'Gestion foyer', emoji: '🏠' },
  { value: 'outdoor', label: 'Extérieur', emoji: '🌿' },
  { value: 'hygiene', label: 'Hygiène', emoji: '🚿' },
  { value: 'pets', label: 'Animaux', emoji: '🐾' },
  { value: 'vehicle', label: 'Voiture', emoji: '🚗' },
  { value: 'misc', label: 'Autre', emoji: '📌' },
];

export function timeLabel(score: number): string {
  if (score <= 2) return 'Rapide';
  if (score <= 4) return 'Modéré';
  if (score <= 6) return 'Long';
  return 'Très long';
}

export function physicalLabel(score: number): string {
  if (score === 0) return 'Quasi nul';
  if (score <= 1) return 'Léger';
  if (score <= 3) return 'Moyen';
  return 'Intense';
}

export function mentalLabel(score: number): string {
  if (score <= 4) return 'Faible';
  if (score <= 8) return 'Présente';
  if (score <= 13) return 'Élevée';
  return 'Très élevée';
}

export function impactLabel(score: number): string {
  if (score <= 1) return 'Personnel';
  if (score <= 2) return 'Partagé';
  if (score <= 3) return 'Foyer';
  return 'Critique';
}

export function dominantEmoji(dominant: string): string {
  switch (dominant) {
    case 'mental': return '🧠';
    case 'physical': return '💪';
    case 'time': return '⏱';
    case 'impact': return '👨‍👩‍👧';
    default: return '📊';
  }
}
