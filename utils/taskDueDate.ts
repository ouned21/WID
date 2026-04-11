import { addDays, addWeeks, addMonths, addYears } from 'date-fns';
import type { Frequency } from '@/types/database';

/**
 * Calcule la prochaine date d'échéance après une complétion.
 * Fonction pure, testable, utilisée partout.
 */
export function computeNextDueAt(
  frequency: Frequency,
  completedAt: Date = new Date(),
  customIntervalDays?: number | null,
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
    case 'semiannual':
      return addMonths(completedAt, 6);
    case 'yearly':
      return addYears(completedAt, 1);
    case 'custom':
      if (customIntervalDays && customIntervalDays > 0) {
        return addDays(completedAt, customIntervalDays);
      }
      return null;
    case 'once':
      return null;
    default:
      return null;
  }
}
