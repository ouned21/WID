/**
 * Moteur de rééquilibrage automatique.
 *
 * Analyse la charge par jour/semaine pour chaque membre.
 * Détecte les pics (jour > 2x la moyenne) et propose de décaler
 * les tâches variables vers des jours plus légers.
 */

import { startOfDay, addDays, isSameDay, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { taskScoreCompare } from '@/utils/designSystem';
import type { TaskListItem } from '@/types/database';

// -- Types -------------------------------------------------------------------

export type DayLoad = {
  date: Date;
  dateStr: string; // 'lundi 14 avr.'
  tasks: TaskListItem[];
  totalScore: number;
  isOverloaded: boolean;
};

export type RebalanceSuggestion = {
  task: TaskListItem;
  fromDate: Date;
  toDate: Date;
  fromDateStr: string;
  toDateStr: string;
  scoreReduction: number; // combien ça allège le jour source
  reason: string;
};

// -- Analyse -----------------------------------------------------------------

/**
 * Calcule la charge par jour sur les N prochains jours.
 */
export function computeDayLoads(
  tasks: TaskListItem[],
  days: number = 7,
  userId?: string,
): DayLoad[] {
  const today = startOfDay(new Date());
  const result: DayLoad[] = [];

  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    const dayTasks = tasks.filter((t) => {
      if (!t.next_due_at) return false;
      if (!isSameDay(new Date(t.next_due_at), day)) return false;
      // Si userId fourni, ne garder que les tâches de cet utilisateur
      if (userId && t.assigned_to !== userId) return false;
      return true;
    });

    const totalScore = dayTasks.reduce((sum, t) => sum + taskScoreCompare(t), 0);

    result.push({
      date: day,
      dateStr: format(day, 'EEEE d MMM', { locale: fr }),
      tasks: dayTasks,
      totalScore,
      isOverloaded: false, // calculé après
    });
  }

  // Marquer les jours surchargés (> 2x la moyenne, minimum 3 tâches)
  const avg = result.reduce((s, d) => s + d.totalScore, 0) / Math.max(1, result.filter(d => d.totalScore > 0).length);
  const threshold = Math.max(avg * 2, 15); // au moins 15 pts pour être "surchargé"

  for (const day of result) {
    day.isOverloaded = day.totalScore > threshold && day.tasks.length >= 3;
  }

  return result;
}

/**
 * Génère des suggestions de rééquilibrage.
 * Prend les tâches variables des jours surchargés et propose
 * de les décaler vers les jours les plus légers.
 */
export function generateRebalanceSuggestions(
  dayLoads: DayLoad[],
  maxSuggestions: number = 5,
): RebalanceSuggestion[] {
  const suggestions: RebalanceSuggestion[] = [];

  // Trouver les jours surchargés et les jours légers
  const overloadedDays = dayLoads.filter((d) => d.isOverloaded);
  const lightDays = [...dayLoads]
    .filter((d) => !d.isOverloaded && d.totalScore < dayLoads.reduce((s, dd) => s + dd.totalScore, 0) / dayLoads.length)
    .sort((a, b) => a.totalScore - b.totalScore);

  if (overloadedDays.length === 0 || lightDays.length === 0) return [];

  for (const heavyDay of overloadedDays) {
    // Tâches variables uniquement (is_fixed_assignment = false)
    const movableTasks = heavyDay.tasks
      .filter((t) => !t.is_fixed_assignment)
      .sort((a, b) => taskScoreCompare(b) - taskScoreCompare(a)); // les plus lourdes d'abord

    for (const task of movableTasks) {
      if (suggestions.length >= maxSuggestions) break;

      // Trouver le jour le plus léger disponible
      const targetDay = lightDays.find((d) =>
        d.date > heavyDay.date || d.date < heavyDay.date // n'importe quel jour différent
      );

      if (!targetDay) continue;

      const score = taskScoreCompare(task);
      suggestions.push({
        task,
        fromDate: heavyDay.date,
        toDate: targetDay.date,
        fromDateStr: heavyDay.dateStr,
        toDateStr: targetDay.dateStr,
        scoreReduction: score,
        reason: `${heavyDay.dateStr} est surchargé (${heavyDay.totalScore} pts). Décaler vers ${targetDay.dateStr} (${targetDay.totalScore} pts) allègerait de ${score} pts.`,
      });
    }
  }

  return suggestions;
}
