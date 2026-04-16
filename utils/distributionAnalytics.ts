/**
 * distributionAnalytics.ts
 *
 * Fonctions de calcul pour la page de distribution/statistiques.
 * Séparées du composant pour être réutilisables (dashboard, exports, tests).
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type RawCompletion = {
  completed_by: string;
  completed_by_phantom_id?: string | null;
  completed_at: string;
};

export type DailyHistory = Record<string, number[]>;

export type TrendResult = {
  diff: number;
  label: 'En hausse' | 'En baisse' | 'Stable';
  /** Couleur iOS adaptée à la tendance (orange = hausse, vert = baisse, gris = stable) */
  color: string;
};

export type ImbalanceResult = {
  value: number;
  label: 'Équilibré' | 'Léger déséquilibre' | 'Déséquilibre';
  color: string;
};

// -----------------------------------------------------------------------------
// groupCompletionsByMemberDay
// -----------------------------------------------------------------------------

/**
 * Groupe les complétions brutes Supabase par membre et par jour.
 *
 * @param completions - Lignes brutes de task_completions
 * @param period - Nombre de jours à couvrir (7, 30 ou 90)
 * @returns Un objet { memberId → tableau de counts par jour (du plus ancien au plus récent) }
 *
 * @example
 * const history = groupCompletionsByMemberDay(data, 7);
 * // history['uuid-jonathan'] = [0, 2, 1, 3, 0, 1, 2]
 */
export function groupCompletionsByMemberDay(
  completions: RawCompletion[],
  period: number,
): DailyHistory {
  // Construire la liste des N derniers jours (format YYYY-MM-DD)
  const days: string[] = [];
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  // Agréger par membre et par jour
  const dayMap: Record<string, Record<string, number>> = {};
  for (const c of completions) {
    const day = c.completed_at.split('T')[0];
    // Les fantômes priment sur le vrai completed_by
    const memberId = c.completed_by_phantom_id ?? c.completed_by;
    if (!dayMap[memberId]) dayMap[memberId] = {};
    dayMap[memberId][day] = (dayMap[memberId][day] ?? 0) + 1;
  }

  // Convertir en tableau indexé sur les jours
  const history: DailyHistory = {};
  for (const memberId of Object.keys(dayMap)) {
    history[memberId] = days.map((day) => dayMap[memberId][day] ?? 0);
  }

  return history;
}

// -----------------------------------------------------------------------------
// computeTrend
// -----------------------------------------------------------------------------

/**
 * Compare la 1ère moitié de la période vs la 2ème pour détecter une tendance.
 *
 * @param memberHistory - Tableau de counts journaliers pour UN membre
 * @returns TrendResult ou null si pas assez de données
 */
export function computeTrend(memberHistory: number[] | undefined): TrendResult | null {
  if (!memberHistory || memberHistory.length < 4) return null;

  const mid = Math.floor(memberHistory.length / 2);
  const firstHalf = memberHistory.slice(0, mid).reduce((s, v) => s + v, 0);
  const secondHalf = memberHistory.slice(mid).reduce((s, v) => s + v, 0);

  if (firstHalf === 0 && secondHalf === 0) return null;

  const diff = secondHalf - firstHalf;

  if (diff > 0) return { diff, label: 'En hausse', color: '#ff9500' };
  if (diff < 0) return { diff, label: 'En baisse', color: '#34c759' };
  return { diff: 0, label: 'Stable', color: '#8e8e93' };
}

/**
 * Retourne une flèche de tendance (↑ / ↓ / →) pour affichage compact.
 *
 * @param memberHistory - Tableau de counts journaliers pour UN membre
 */
export function computeTrendArrow(memberHistory: number[] | undefined): '↑' | '↓' | '→' | '' {
  const trend = computeTrend(memberHistory);
  if (!trend) return '';
  if (trend.diff > 0) return '↑';
  if (trend.diff < 0) return '↓';
  return '→';
}

// -----------------------------------------------------------------------------
// computeImbalance
// -----------------------------------------------------------------------------

/**
 * Calcule le niveau de déséquilibre entre les membres à partir de leurs pourcentages.
 *
 * @param percentages - Tableau de pourcentages de contribution (ex: [71, 29])
 * @returns Label + couleur iOS pour le badge
 */
export function computeImbalance(percentages: number[]): ImbalanceResult {
  if (percentages.length < 2) {
    return { value: 0, label: 'Équilibré', color: '#34c759' };
  }

  const max = Math.max(...percentages);
  const min = Math.min(...percentages);
  const value = max - min;

  if (value <= 10) return { value, label: 'Équilibré', color: '#34c759' };
  if (value <= 25) return { value, label: 'Léger déséquilibre', color: '#ff9500' };
  return { value, label: 'Déséquilibre', color: '#ff3b30' };
}

// -----------------------------------------------------------------------------
// computeMemberLoad
// -----------------------------------------------------------------------------

type TaskWithLoad = {
  assigned_to?: string | null;
  assigned_to_phantom_id?: string | null;
  user_score?: number | null;
  mental_load_score?: number | null;
};

/**
 * Calcule la charge totale (points) assignée à un membre.
 * Utilise user_score en priorité, sinon mental_load_score, sinon 0.
 *
 * @param tasks - Liste de toutes les tâches actives du foyer
 * @param memberId - ID du membre (réel ou fantôme)
 */
export function computeMemberLoad(tasks: TaskWithLoad[], memberId: string): number {
  return tasks
    .filter((t) => t.assigned_to === memberId || t.assigned_to_phantom_id === memberId)
    .reduce((sum, t) => sum + (t.user_score ?? t.mental_load_score ?? 0), 0);
}

/**
 * Calcule le pourcentage de charge d'un membre par rapport au membre le plus chargé.
 *
 * @param tasks - Liste de toutes les tâches
 * @param memberId - ID du membre
 * @param allMemberIds - IDs de tous les membres du foyer
 */
export function computeMemberLoadPercent(
  tasks: TaskWithLoad[],
  memberId: string,
  allMemberIds: string[],
): number {
  const myLoad = computeMemberLoad(tasks, memberId);
  const maxLoad = Math.max(
    ...allMemberIds.map((id) => computeMemberLoad(tasks, id)),
    1,
  );
  return Math.round((myLoad / maxLoad) * 100);
}
