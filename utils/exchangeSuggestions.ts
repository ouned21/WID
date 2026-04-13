import type { TaskListItem, Profile, HouseholdMember } from '@/types/database';

/**
 * Moteur de suggestions d'échanges de tâches.
 *
 * Compare la répartition actuelle aux objectifs de chaque membre,
 * puis propose des échanges concrets pour s'en rapprocher.
 */

export type MemberBalance = {
  memberId: string;
  displayName: string;
  targetPercent: number;
  currentPercent: number;
  currentScore: number;
  gap: number; // positif = fait trop, négatif = fait pas assez
};

export type ExchangeSuggestion = {
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  taskToGive: TaskListItem;
  taskToReceive: TaskListItem;
  impactDescription: string;
  balanceImprovement: number; // réduction de l'écart total
};

/**
 * Calcule la balance actuelle vs objectifs pour chaque membre.
 * Accepte Profile[] ou HouseholdMember[] via le type unifié.
 */
export function computeMemberBalance(
  tasks: TaskListItem[],
  members: (Profile | HouseholdMember)[],
): MemberBalance[] {
  const totalScore = tasks.reduce((sum, t) => sum + (t.global_score ?? t.mental_load_score), 0);
  if (totalScore === 0 || members.length < 2) return [];

  return members.map((m) => {
    // Tâches assignées à ce membre (par assigned_to ou assigned_to_phantom_id)
    const myTasks = tasks.filter((t) => t.assigned_to === m.id || t.assigned_to_phantom_id === m.id);
    const myScore = myTasks.reduce((sum, t) => sum + (t.global_score ?? t.mental_load_score), 0);
    const currentPercent = Math.round((myScore / totalScore) * 100);
    const targetPercent = m.target_share_percent ?? Math.round(100 / members.length);
    const gap = currentPercent - targetPercent;

    return {
      memberId: m.id,
      displayName: m.display_name,
      targetPercent,
      currentPercent,
      currentScore: myScore,
      gap,
    };
  });
}

/**
 * Génère des suggestions d'échanges pour rééquilibrer la répartition.
 * Prend les membres qui font trop et ceux qui font pas assez,
 * et propose des swaps de tâches qui réduisent l'écart.
 */
export function generateExchangeSuggestions(
  tasks: TaskListItem[],
  members: Profile[],
  maxSuggestions: number = 3,
  allMembers?: HouseholdMember[],
): ExchangeSuggestion[] {
  const balance = computeMemberBalance(tasks, members);
  if (balance.length < 2) return [];

  // Exclure les membres fantômes des propositions d'échange (ils ne peuvent pas répondre)
  const phantomIds = new Set((allMembers ?? []).filter((m) => m.isPhantom).map((m) => m.id));

  // Trier : ceux qui font trop en premier, ceux qui font pas assez en dernier
  const overloaded = balance.filter((b) => b.gap > 3 && !phantomIds.has(b.memberId)).sort((a, b) => b.gap - a.gap);
  const underloaded = balance.filter((b) => b.gap < -3 && !phantomIds.has(b.memberId)).sort((a, b) => a.gap - b.gap);

  if (overloaded.length === 0 || underloaded.length === 0) return [];

  const suggestions: ExchangeSuggestion[] = [];

  for (const over of overloaded) {
    for (const under of underloaded) {
      if (suggestions.length >= maxSuggestions) break;

      // Tâches de chacun, triées par score décroissant
      const overTasks = tasks
        .filter((t) => (t.assigned_to === over.memberId || t.assigned_to_phantom_id === over.memberId) && !t.is_fixed_assignment)
        .sort((a, b) => (b.global_score ?? b.mental_load_score) - (a.global_score ?? a.mental_load_score));

      const underTasks = tasks
        .filter((t) => (t.assigned_to === under.memberId || t.assigned_to_phantom_id === under.memberId) && !t.is_fixed_assignment)
        .sort((a, b) => (a.global_score ?? a.mental_load_score) - (b.global_score ?? b.mental_load_score));

      if (overTasks.length === 0 || underTasks.length === 0) continue;

      // Chercher le meilleur swap : une tâche lourde d'over contre une tâche légère d'under
      for (const heavyTask of overTasks.slice(0, 5)) {
        for (const lightTask of underTasks.slice(0, 5)) {
          const heavyScore = heavyTask.global_score ?? heavyTask.mental_load_score;
          const lightScore = lightTask.global_score ?? lightTask.mental_load_score;
          const scoreDiff = heavyScore - lightScore;

          // Le swap doit réduire l'écart (pas l'inverser)
          if (scoreDiff <= 0) continue;
          if (scoreDiff > over.gap * 2) continue; // Pas de swap trop drastique

          const improvement = Math.min(scoreDiff, Math.abs(over.gap));

          suggestions.push({
            fromMemberId: under.memberId,
            fromMemberName: under.displayName,
            toMemberId: over.memberId,
            toMemberName: over.displayName,
            taskToGive: lightTask,
            taskToReceive: heavyTask,
            impactDescription: `${under.displayName}, acceptez-vous "${heavyTask.name}" en échange de "${lightTask.name}" ?`,
            balanceImprovement: improvement,
          });

          break; // Un swap par paire
        }
        if (suggestions.length >= maxSuggestions) break;
      }
    }
  }

  return suggestions.sort((a, b) => b.balanceImprovement - a.balanceImprovement).slice(0, maxSuggestions);
}
