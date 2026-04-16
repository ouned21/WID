/**
 * Rate limiting IA pour les utilisateurs gratuits.
 * - Onboarding initial : illimité (appel unique)
 * - Après onboarding : 5 appels IA / mois pour les gratuits
 * - Illimité pour les premium
 */

import { SupabaseClient } from '@supabase/supabase-js';

export const FREE_AI_MONTHLY_LIMIT = 5;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  isPremium: boolean;
  reason?: 'not_authenticated' | 'limit_reached' | 'ok';
};

/**
 * Vérifie si l'utilisateur peut faire un appel IA.
 * Incrémente le compteur si autorisé.
 *
 * @param supabase Client Supabase authentifié
 * @param userId ID de l'utilisateur
 * @param bypass Si true, on ignore le rate limit (pour les appels internes critiques)
 */
export async function checkAndIncrementAiUsage(
  supabase: SupabaseClient,
  userId: string,
  bypass = false,
): Promise<RateLimitResult> {
  // Récupérer le profil
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_premium, premium_until, ai_calls_this_month, ai_calls_month_reset')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    return { allowed: false, remaining: 0, isPremium: false, reason: 'not_authenticated' };
  }

  // Vérifier si premium valide
  const isPremiumValid =
    profile.is_premium === true &&
    (!profile.premium_until || new Date(profile.premium_until) > new Date());

  // Premium = illimité
  if (isPremiumValid || bypass) {
    return {
      allowed: true,
      remaining: -1, // illimité
      isPremium: true,
      reason: 'ok',
    };
  }

  // Reset mensuel si nécessaire
  const now = new Date();
  let currentCount = profile.ai_calls_this_month ?? 0;

  if (profile.ai_calls_month_reset && new Date(profile.ai_calls_month_reset) < now) {
    await supabase
      .from('profiles')
      .update({
        ai_calls_this_month: 0,
        ai_calls_month_reset: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', userId);
    currentCount = 0;
  }

  // Vérifier la limite
  if (currentCount >= FREE_AI_MONTHLY_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      isPremium: false,
      reason: 'limit_reached',
    };
  }

  // Incrément atomique avec optimistic locking (anti race condition TOCTOU).
  // On ne met à jour QUE si ai_calls_this_month est toujours égal à currentCount —
  // si deux requêtes simultanées passent la vérification, une seule gagne.
  const { data: updated } = await supabase
    .from('profiles')
    .update({ ai_calls_this_month: currentCount + 1 })
    .eq('id', userId)
    .eq('ai_calls_this_month', currentCount) // condition atomique
    .select('id');

  if (!updated || updated.length === 0) {
    // Quelqu'un d'autre a incrémenté en même temps — re-lire et refuser par sécurité
    return {
      allowed: false,
      remaining: 0,
      isPremium: false,
      reason: 'limit_reached',
    };
  }

  return {
    allowed: true,
    remaining: FREE_AI_MONTHLY_LIMIT - (currentCount + 1),
    isPremium: false,
    reason: 'ok',
  };
}

/**
 * Vérifie si l'utilisateur est premium (pour features premium-only).
 * Ne consomme pas le rate limit.
 */
export async function requirePremium(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ isPremium: boolean; reason?: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_premium, premium_until')
    .eq('id', userId)
    .single();

  if (!profile) return { isPremium: false, reason: 'not_found' };

  const isPremiumValid =
    profile.is_premium === true &&
    (!profile.premium_until || new Date(profile.premium_until) > new Date());

  return {
    isPremium: isPremiumValid,
    reason: isPremiumValid ? undefined : 'not_premium',
  };
}

/**
 * Juste vérifier l'état sans incrémenter (pour afficher le compteur dans l'UI).
 */
export async function getAiUsageStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ used: number; limit: number; isPremium: boolean }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_premium, premium_until, ai_calls_this_month')
    .eq('id', userId)
    .single();

  if (!profile) return { used: 0, limit: FREE_AI_MONTHLY_LIMIT, isPremium: false };

  const isPremiumValid =
    profile.is_premium === true &&
    (!profile.premium_until || new Date(profile.premium_until) > new Date());

  return {
    used: profile.ai_calls_this_month ?? 0,
    limit: isPremiumValid ? -1 : FREE_AI_MONTHLY_LIMIT,
    isPremium: isPremiumValid,
  };
}
