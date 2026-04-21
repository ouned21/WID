/**
 * Logger des appels IA : tracking des tokens, coûts, latence, errors.
 *
 * Utilisé par toutes les routes /api/ai/* pour :
 * - Insérer une ligne dans `ai_token_usage` (détail par appel)
 * - Incrémenter les compteurs agrégés sur `profiles` (somme mensuelle/lifetime)
 * - Permettre le suivi fin des coûts par user, par endpoint, par jour
 *
 * Les prix sont à jour au moment du commit — à mettre à jour si Anthropic change.
 */

// Prix par million de tokens en USD (Claude Haiku 4.5)
const HAIKU_INPUT_PRICE_PER_MTOK = 1.0;   // $1 / 1M tokens input
const HAIKU_OUTPUT_PRICE_PER_MTOK = 5.0;  // $5 / 1M tokens output

// Prix par million de tokens en USD (Claude Sonnet 4.6) — parse-journal
const SONNET_INPUT_PRICE_PER_MTOK = 3.0;
const SONNET_OUTPUT_PRICE_PER_MTOK = 15.0;

type SupabaseLike = {
  from: (table: string) => {
    insert: (payload: Record<string, unknown>) => Promise<{ error: unknown }>;
  };
  rpc?: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
};

export type LogAiUsageParams = {
  userId: string;
  householdId?: string | null;
  endpoint: string;
  model?: 'claude-haiku-4-5' | 'claude-sonnet-4-6';
  tokensInput: number;
  tokensOutput: number;
  durationMs: number;
  status?: 'success' | 'error' | 'rate_limited' | 'premium_required';
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Calcule le coût d'un appel IA en USD selon le modèle et le nombre de tokens.
 */
export function computeAiCost(
  tokensInput: number,
  tokensOutput: number,
  model: 'claude-haiku-4-5' | 'claude-sonnet-4-6' = 'claude-haiku-4-5',
): number {
  const inputPrice = model === 'claude-haiku-4-5' ? HAIKU_INPUT_PRICE_PER_MTOK : SONNET_INPUT_PRICE_PER_MTOK;
  const outputPrice = model === 'claude-haiku-4-5' ? HAIKU_OUTPUT_PRICE_PER_MTOK : SONNET_OUTPUT_PRICE_PER_MTOK;
  const costInput = (tokensInput / 1_000_000) * inputPrice;
  const costOutput = (tokensOutput / 1_000_000) * outputPrice;
  return Number((costInput + costOutput).toFixed(6));
}

/**
 * Enregistre un appel IA : insère dans `ai_token_usage` et incrémente les
 * compteurs du profil via la fonction SQL `increment_ai_usage`.
 *
 * Ne throw jamais — toujours best-effort pour ne pas casser la réponse user.
 */
export async function logAiUsage(
  supabase: SupabaseLike,
  params: LogAiUsageParams,
): Promise<void> {
  const model = params.model ?? 'claude-haiku-4-5';
  const costUsd = computeAiCost(params.tokensInput, params.tokensOutput, model);

  try {
    // 1. Ligne détaillée
    await supabase.from('ai_token_usage').insert({
      user_id: params.userId,
      household_id: params.householdId ?? null,
      endpoint: params.endpoint,
      model,
      tokens_input: params.tokensInput,
      tokens_output: params.tokensOutput,
      cost_usd: costUsd,
      duration_ms: params.durationMs,
      status: params.status ?? 'success',
      error_message: params.errorMessage ?? null,
      metadata: params.metadata ?? {},
    });

    // 2. Agrégats sur le profil (via fonction SQL pour éviter une race condition)
    if (supabase.rpc && params.status === 'success') {
      await supabase.rpc('increment_ai_usage', {
        p_user_id: params.userId,
        p_tokens_in: params.tokensInput,
        p_tokens_out: params.tokensOutput,
        p_cost_usd: costUsd,
      });
    }
  } catch (err) {
    // Jamais propager — best-effort
    console.error('[aiLogger] Failed to log AI usage:', err);
  }
}

/**
 * Parse la réponse d'Anthropic API pour extraire les métriques d'usage.
 */
export function extractUsageFromResponse(data: {
  usage?: { input_tokens?: number; output_tokens?: number };
}): { tokensInput: number; tokensOutput: number } {
  return {
    tokensInput: data.usage?.input_tokens ?? 0,
    tokensOutput: data.usage?.output_tokens ?? 0,
  };
}
