import { addDays, addWeeks, addMonths, addYears } from 'date-fns';
import type { Frequency } from '@/types/database';

/**
 * Calcule la prochaine date d'echeance apres une completion.
 * Fonction pure, testable, utilisee partout (store, utils, jamais dans un composant).
 */
export function computeNextDueAt(
  frequency: Frequency,
  completedAt: Date = new Date(),
): Date | null {
  switch (frequency) {
    case 'daily':
      return addDays(completedAt, 1);
    case 'weekly':
      return addWeeks(completedAt, 1);
    case 'biweekly':
      return addWeeks(completedAt, 2);
    case 'monthly':
      return addMonths(completedAt, 1);
    case 'quarterly':
      return addMonths(completedAt, 3);
    case 'yearly':
      return addYears(completedAt, 1);
    case 'once':
      return null; // Tache ponctuelle : pas de prochaine echeance
    default: {
      // Exhaustive check : si on ajoute une frequence, le build casse ici
      const _never: never = frequency;
      throw new Error(`Frequence inconnue: ${_never}`);
    }
  }
}
