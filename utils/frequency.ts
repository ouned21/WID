import type { Frequency } from '@/types/database';

/** Labels français pour les fréquences */
const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: 'Quotidienne',
  weekly: 'Hebdomadaire',
  biweekly: 'Bimensuelle',
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  semiannual: 'Semestrielle',
  yearly: 'Annuelle',
  once: 'Ponctuelle',
  custom: 'Personnalisée',
};

export function frequencyLabel(frequency: Frequency): string {
  return FREQUENCY_LABELS[frequency] ?? frequency;
}

/** Toutes les fréquences disponibles pour les selects */
export const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Quotidienne' },
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'biweekly', label: 'Bimensuelle' },
  { value: 'monthly', label: 'Mensuelle' },
  { value: 'quarterly', label: 'Trimestrielle' },
  { value: 'semiannual', label: 'Semestrielle' },
  { value: 'yearly', label: 'Annuelle' },
  { value: 'once', label: 'Ponctuelle' },
  { value: 'custom', label: 'Personnalisée (intervalle libre)' },
];
