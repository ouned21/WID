/**
 * Moteur de scoring automatique des tâches Yova.
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

/**
 * TIME_MAP — Conversion durée estimée → score temps (1-8).
 * Progression non linéaire : very_short (< 5min) = 1, very_long (60+ min) = 8.
 * Les valeurs reflètent l'impact réel sur le planning, pas seulement la durée absolue.
 */
const TIME_MAP: Record<DurationEstimate, number> = {
  very_short: 1, // < 5 min
  short: 2,      // 5–15 min
  medium: 4,     // 15–30 min
  long: 6,       // 30–60 min
  very_long: 8,  // 60+ min
};

/**
 * PHYSICAL_MAP — Conversion effort physique → score physique (0-5).
 * Le score physique est pondéré à 0.8 dans le global (moins pénalisant que le mental).
 * "high" = 5 car un effort physique intense a un coût corporel réel (fatigue, douleur).
 */
const PHYSICAL_MAP: Record<PhysicalEffort, number> = {
  none: 0,   // Pas d'effort physique (ex: passer un appel)
  light: 1,  // Léger (ex: mettre la table)
  medium: 3, // Modéré (ex: passer l'aspirateur)
  high: 5,   // Intense (ex: déménager des meubles, nettoyer à fond)
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

/**
 * CATEGORY_PROFILES — Profils de charge mentale par catégorie de tâche.
 *
 * Chaque catégorie a 7 dimensions (0–3 sauf impact 1–4) :
 * - anticipation       : planification préalable requise (ex: penser à acheter des couches avant rupture de stock)
 * - consequence        : impact si oublié ou mal fait (ex: enfant non récupéré à l'école)
 * - interruption       : interrompt le flux de travail ou de repos (ex: bébé qui pleure = non planifiable)
 * - decision           : nombre de micro-décisions impliquées (ex: admin = beaucoup, balayer = zéro)
 * - rigidity           : contrainte horaire fixe (ex: école a une heure précise, ménage = flexible)
 * - responsibility     : qui porte la responsabilité si non fait (poids psychologique)
 * - impact             : visibilité et importance pour le foyer entier (1 = personnel, 4 = critique)
 *
 * Ces valeurs sont issues d'une modélisation qualitative basée sur la recherche sur la
 * charge mentale domestique (Hochschild 1989, Ruppanner 2020) et affinées par tests.
 */
const CATEGORY_PROFILES: Record<TaskCategory, MentalProfile> = {
  // Enfants : toutes les dimensions au maximum — conséquences graves si oublié, interruptions constantes
  children:              { anticipation: 2, consequence: 3, interruption: 3, decision: 2, rigidity: 2, responsibility: 3, impact: 4 },
  // Repas : charge modérée sur toutes les dimensions, décision quotidienne
  meals:                 { anticipation: 2, consequence: 2, interruption: 2, decision: 2, rigidity: 2, responsibility: 2, impact: 3 },
  // Courses : anticipation (liste) + décision (choisir produits) mais peu d'interruption
  shopping:              { anticipation: 2, consequence: 2, interruption: 1, decision: 2, rigidity: 1, responsibility: 2, impact: 3 },
  // Ménage : charge mentale faible — tâche visible mais peu de décision ou planification
  cleaning:              { anticipation: 0, consequence: 1, interruption: 1, decision: 0, rigidity: 0, responsibility: 1, impact: 2 },
  // Linge : conséquence si oublié (vêtements humides, enfant sans uniforme)
  laundry:               { anticipation: 1, consequence: 2, interruption: 1, decision: 1, rigidity: 1, responsibility: 2, impact: 2 },
  // Rangement : similaire ménage, très peu de charge cognitive
  tidying:               { anticipation: 0, consequence: 1, interruption: 1, decision: 0, rigidity: 0, responsibility: 1, impact: 2 },
  // Administratif : le plus exigeant cognitivement — délais, décisions, anticipation longue
  admin:                 { anticipation: 3, consequence: 3, interruption: 1, decision: 3, rigidity: 2, responsibility: 3, impact: 3 },
  // Transport : rigidité horaire maximale, conséquences graves (enfant non récupéré)
  transport:             { anticipation: 2, consequence: 3, interruption: 1, decision: 1, rigidity: 3, responsibility: 2, impact: 3 },
  // Gestion foyer : planification long terme, décisions stratégiques (artisans, budget...)
  household_management:  { anticipation: 3, consequence: 3, interruption: 2, decision: 3, rigidity: 2, responsibility: 3, impact: 3 },
  // Extérieur : peu de contraintes cognitives, flexible
  outdoor:               { anticipation: 1, consequence: 1, interruption: 0, decision: 0, rigidity: 1, responsibility: 1, impact: 2 },
  // Hygiène : routinier, peu de charge cognitive
  hygiene:               { anticipation: 0, consequence: 1, interruption: 1, decision: 0, rigidity: 0, responsibility: 1, impact: 2 },
  // Animaux : conséquences si oublié (animal non nourri), rigidité modérée
  pets:                  { anticipation: 1, consequence: 2, interruption: 1, decision: 0, rigidity: 1, responsibility: 2, impact: 2 },
  // Véhicule : conséquence si entretien négligé, peu d'interruption
  vehicle:               { anticipation: 1, consequence: 2, interruption: 0, decision: 1, rigidity: 1, responsibility: 1, impact: 2 },
  // Divers : profil moyen par défaut
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

/**
 * Calcule le score de charge d'une tâche sur 4 axes pondérés.
 *
 * ## Formule de pondération
 * `weighted_score = time × 1.0 + physical × 0.8 + mental × 1.5 + impact × 1.0`
 *
 * Pourquoi ces poids :
 * - **Mental × 1.5** : la charge cognitive (planification, responsabilité, conséquence) est
 *   systématiquement sous-estimée et génère le plus d'épuisement à long terme.
 * - **Physical × 0.8** : l'effort physique est mesurable et souvent mieux reconnu ; il est
 *   pondéré légèrement moins que les autres axes.
 * - **Time × 1.0** et **Impact × 1.0** : coefficients neutres.
 *
 * Le score pondéré est normalisé sur 36 (max théorique = 43 avant pondération).
 * La valeur minimale retournée est 2 pour éviter un score nul (toute tâche a une valeur).
 *
 * ## Pipeline de calcul
 * 1. Lookup direct depuis TIME_MAP et PHYSICAL_MAP
 * 2. Profil mental de base depuis CATEGORY_PROFILES
 * 3. Ajustements fréquence (daily → +anticipation, +responsibility)
 * 4. Ajustements durée (very_long → +responsibility, +interruption pour certaines catégories)
 * 5. Ajustements mots-clés du titre (détecter "école", "facture", "balai"...)
 * 6. Somme des 6 dimensions mentales → mental_load_score
 * 7. Score global pondéré → normalisé → label + dominant
 *
 * @param input - Titre, catégorie, durée estimée, effort physique, fréquence
 * @returns ScoreBreakdown complet avec tous les sous-scores et métadonnées
 */
export function computeTaskScore(input: TaskScoringInput): ScoreBreakdown {
  const { title, category, duration, physical, frequency } = input;
  // Normaliser en minuscules pour la détection de mots-clés (insensible à la casse)
  const titleLower = (title ?? '').toLowerCase();

  // 1. Scores directs depuis les mappings — fallback vers misc si catégorie inconnue
  const time_score = TIME_MAP[duration] ?? TIME_MAP.medium;
  const physical_score = PHYSICAL_MAP[physical] ?? PHYSICAL_MAP.light;

  // 2. Profil mental de base depuis la catégorie
  // On clone l'objet pour pouvoir le muter sans affecter CATEGORY_PROFILES
  const profile = { ...(CATEGORY_PROFILES[category] ?? CATEGORY_PROFILES.misc) };
  let anticipation = profile.anticipation;
  let consequence = profile.consequence;
  let interruption = profile.interruption;
  let decision = profile.decision;
  let rigidity = profile.rigidity;
  let responsibility = profile.responsibility;
  let impact = profile.impact;

  // 3. Ajustements par fréquence
  // daily : une tâche quotidienne cumule la charge (penser à la faire chaque jour = responsabilité accrue)
  // monthly admin/gestion : échéances ponctuelles mais à fort enjeu (impôts, assurances...)
  if (frequency === 'daily') {
    anticipation = clamp(anticipation + 1, 0, 3);
    responsibility = clamp(responsibility + 1, 0, 3);
    consequence = clamp(consequence + 1, 0, 3);
  } else if (frequency === 'monthly' && (category === 'admin' || category === 'household_management')) {
    anticipation = clamp(anticipation + 1, 0, 3);
    rigidity = clamp(rigidity + 1, 0, 3);
  }

  // 4. Ajustements par durée
  // long/very_long : plus la tâche est longue, plus la responsabilité est lourde (engagement de temps)
  // very_long + catégories interruptibles : forte probabilité d'être interrompu pendant la tâche
  if (duration === 'long' || duration === 'very_long') {
    responsibility = clamp(responsibility + 1, 0, 3);
  }
  if (duration === 'very_long' && ['children', 'meals', 'shopping', 'cleaning'].includes(category)) {
    interruption = clamp(interruption + 1, 0, 3);
  }

  // 5. Ajustements par mots-clés du titre (inférence sémantique légère)
  // Ces ajustements s'appliquent en combinaison avec le profil de catégorie — ils ne l'écrasent pas.
  // Ex: une tâche "cleaning" avec "école" dans le titre mérite plus de charge que simple nettoyage.
  const hasChildrenKeyword = CHILDREN_KEYWORDS.some((kw) => titleLower.includes(kw));
  const hasAdminKeyword = ADMIN_KEYWORDS.some((kw) => titleLower.includes(kw));
  const hasMealKeyword = MEAL_KEYWORDS.some((kw) => titleLower.includes(kw));
  // Mots-clés "simples" → réduire légèrement la charge (tâche routinière sans décision)
  const hasSimpleKeyword = SIMPLE_KEYWORDS.some((kw) => titleLower.includes(kw));

  if (hasChildrenKeyword) {
    consequence = clamp(consequence + 1, 0, 3);
    impact = clamp(impact, 3, 4); // minimum 3 pour enfants : impact foyer toujours élevé
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
    // Tâche mécanique et routinière : moins de décision et d'anticipation nécessaires
    decision = clamp(decision - 1, 0, 3);
    anticipation = clamp(anticipation - 1, 0, 3);
  }

  // 6. Calcul du score mental : somme des 6 dimensions (max théorique = 18)
  const mental_load_score = anticipation + consequence + interruption + decision + rigidity + responsibility;

  // 7. Score global — pondéré (mental pèse plus, physique pèse moins)
  // Poids : time×1.0 + physical×0.8 + mental×1.5 + impact×1.0
  // Max théorique avant normalisation = 8×1.0 + 5×0.8 + 18×1.5 + 4×1.0 = 43
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
