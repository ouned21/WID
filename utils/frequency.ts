import type { Frequency } from '@/types/database';

/** Labels francais pour les frequences */
const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: 'Quotidienne',
  weekly: 'Hebdomadaire',
  biweekly: 'Bimensuelle',
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  yearly: 'Annuelle',
  once: 'Ponctuelle',
};

export function frequencyLabel(frequency: Frequency): string {
  return FREQUENCY_LABELS[frequency] ?? frequency;
}

/** Toutes les frequences disponibles pour les selects */
export const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Quotidienne' },
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'biweekly', label: 'Bimensuelle' },
  { value: 'monthly', label: 'Mensuelle' },
  { value: 'quarterly', label: 'Trimestrielle' },
  { value: 'yearly', label: 'Annuelle' },
  { value: 'once', label: 'Ponctuelle' },
];
