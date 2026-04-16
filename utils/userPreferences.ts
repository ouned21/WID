/**
 * Helpers pour les préférences utilisateur (personnalisation IA).
 *
 * - getUserPreferences : lit les préfs d'un user (ou renvoie null si non définies)
 * - formatPreferencesForPrompt : formate les préfs en texte à injecter dans un prompt Haiku
 * - getHouseholdPreferences : lit les préfs de TOUS les membres d'un foyer (pour les prompts globaux)
 */

import type { UserPreferences } from '@/types/database';

type SupabaseClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle?: () => Promise<{ data: UserPreferences | null; error: unknown }>;
        in?: (col: string, vals: string[]) => Promise<{ data: UserPreferences[] | null; error: unknown }>;
      };
      in?: (col: string, vals: string[]) => Promise<{ data: UserPreferences[] | null; error: unknown }>;
    };
  };
};

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const TIME_SLOT_LABELS: Record<string, string> = {
  morning: 'le matin',
  evening: 'le soir',
  weekend: 'le weekend',
  flexible: 'flexible (pas de préférence)',
};
const LOAD_LABELS: Record<string, string> = {
  light: 'léger (peu de tâches)',
  balanced: 'équilibré',
  heavy: 'accepte une charge élevée',
};

/**
 * Récupère les préférences d'un utilisateur. Renvoie null si pas encore définies.
 */
export async function getUserPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserPreferences | null> {
  try {
    const result = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle?.();
    return (result?.data as UserPreferences | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Récupère les préférences de tous les membres d'un foyer (via liste d'IDs).
 */
export async function getHouseholdPreferences(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<UserPreferences[]> {
  if (userIds.length === 0) return [];
  try {
    const query = supabase.from('user_preferences').select('*');
    const result = await query.in?.('user_id', userIds);
    return (result?.data as UserPreferences[] | null) ?? [];
  } catch {
    return [];
  }
}

/**
 * Formate les préférences d'un user en texte injectable dans un prompt Haiku.
 * Renvoie une chaîne vide si rien à dire (pas de préfs ou toutes par défaut).
 */
export function formatPreferencesForPrompt(
  prefs: UserPreferences | null,
  userName?: string,
): string {
  if (!prefs) return '';

  const lines: string[] = [];
  const prefix = userName ? `${userName} : ` : '';

  if (prefs.hated_tasks?.length > 0) {
    lines.push(`${prefix}déteste les tâches suivantes (à éviter si possible) : ${prefs.hated_tasks.join(', ')}`);
  }
  if (prefs.loved_tasks?.length > 0) {
    lines.push(`${prefix}préfère ces tâches (à privilégier) : ${prefs.loved_tasks.join(', ')}`);
  }
  if (prefs.preferred_time_slot && prefs.preferred_time_slot !== 'flexible') {
    lines.push(`${prefix}préfère faire les tâches ${TIME_SLOT_LABELS[prefs.preferred_time_slot] ?? prefs.preferred_time_slot}`);
  }
  if (prefs.unavailable_days?.length > 0) {
    const days = prefs.unavailable_days.map((d) => DAY_NAMES[d]).join(', ');
    lines.push(`${prefix}non disponible le(s) : ${days}`);
  }
  if (prefs.load_preference && prefs.load_preference !== 'balanced') {
    lines.push(`${prefix}souhaite un niveau de charge ${LOAD_LABELS[prefs.load_preference] ?? prefs.load_preference}`);
  }
  if (prefs.freeform_note && prefs.freeform_note.trim()) {
    // Sanitisation anti-prompt-injection : tronque à 500 chars et supprime les
    // séquences qui pourraient faire croire à l'IA qu'il s'agit d'instructions système.
    const sanitized = prefs.freeform_note
      .trim()
      .slice(0, 500)
      .replace(/```[\s\S]*?```/g, '') // supprime les blocs de code
      .replace(/^#{1,6}\s/gm, '')     // supprime les titres Markdown
      .replace(/\bignore\b.*\binstructions?\b/gi, '') // pattern d'injection classique
      .replace(/\bsystem\s*:/gi, '')
      .trim();
    if (sanitized) {
      lines.push(`${prefix}note personnelle : "${sanitized}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Formate les préfs de TOUS les membres d'un foyer en bloc texte injectable dans un prompt.
 */
export function formatHouseholdPreferencesForPrompt(
  prefsList: UserPreferences[],
  memberNames: Map<string, string>,
): string {
  if (prefsList.length === 0) return '';
  const blocks: string[] = [];
  for (const prefs of prefsList) {
    const name = memberNames.get(prefs.user_id) ?? 'Membre';
    const text = formatPreferencesForPrompt(prefs, name);
    if (text) blocks.push(text);
  }
  if (blocks.length === 0) return '';
  return `\n\n## Préférences des membres du foyer\n${blocks.join('\n')}\n`;
}
