/**
 * Sprint 16 v2 — Dispatch d'une réponse user à une question d'overlap via
 * tool use Haiku.
 *
 * Quand Yova a posé une question de groupement (cf. `decomposeProjectCore`
 * → `kind: 'overlap_question'`), l'user répond en chat libre. Au lieu d'un
 * router regex (sprint 16 v1 abandonné — cf. CHANGELOG 2026-04-27), on
 * appelle Haiku avec 3 tools strictement typés. Haiku choisit le bon tool
 * + paramètres, on exécute le tool en DB de façon déterministe, on renvoie
 * le message naturel généré par Haiku.
 *
 * Garanties :
 *  - L'exécution du tool = action faite en DB. Plus de "Yova promet sans agir".
 *  - Si Haiku ne choisit aucun tool (réponse vraiment ambiguë / hors-sujet)
 *    → fallback `keep_both` silencieux (esprit "user esquive = on lâche",
 *    sprint 15bis + preco #6 sprint 16).
 *  - Si timeout / erreur réseau → fallback `keep_both` silencieux + log.
 *
 * Multi-overlap : 1 décision groupée appliquée à tous les overlaps (preco #4).
 * Le tool `reschedule_recurring` requiert une `new_date_iso` ; sans date claire
 * dans la réponse user, Haiku DOIT préférer `keep_both` (instruit dans le
 * system prompt).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logAiUsage, extractUsageFromResponse } from '../utils/aiLogger';
import type { PendingOverlapData } from './decomposeProjectCore';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_DURATION_MS = 10_000;

export type DispatchResult = {
  aiResponse: string;
  action: 'group' | 'keep_both' | 'reschedule' | 'fallback';
  durationMs: number;
};

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

type AnthropicResponse = {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

const TOOLS = [
  {
    name: 'group_recurring',
    description:
      "L'utilisateur accepte de grouper la/les tâche(s) récurrente(s) avec le projet. " +
      "Choisis ce tool quand l'user dit oui, ok, fais ça, parfait, vas-y, fusionne, etc. " +
      "Action système : déplacement de la récurrente à la date de la sous-tâche projet correspondante + marquage covers_project_ids.",
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'keep_both',
    description:
      "L'utilisateur veut garder les deux tâches séparées (le projet ET la récurrente, sans groupement). " +
      "Choisis ce tool quand l'user dit non, garde les deux, séparément, à côté, etc. " +
      "Choisis aussi ce tool si la réponse est ambiguë / hors-sujet / si l'user esquive — il pourra ajuster ensuite. " +
      "Action système : insertion des sous-tâches du projet telles quelles, sans toucher aux récurrentes.",
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'reschedule_recurring',
    description:
      "L'utilisateur veut décaler la/les tâche(s) récurrente(s) à une date PRÉCISE différente de la date du projet. " +
      "Choisis ce tool UNIQUEMENT si l'user fournit une date claire et exploitable (ex: 'décale au samedi', 'plutôt mardi prochain', 'le 27 mai'). " +
      "Si l'user dit juste 'décale' sans préciser quand, choisis plutôt `keep_both` (on ne devine pas).",
    input_schema: {
      type: 'object' as const,
      properties: {
        new_date_iso: {
          type: 'string',
          description:
            "Date ISO 8601 complète au format YYYY-MM-DDTHH:MM:SS.000Z (UTC), à laquelle déplacer toutes les récurrentes. " +
            "Calculée depuis la mention user et la date du jour fournie en contexte. Heure par défaut : 09:00 UTC.",
        },
      },
      required: ['new_date_iso'],
    },
  },
];

function buildSystemPrompt(p: {
  pendingOverlap: PendingOverlapData;
  todayIso: string;
  questionAsked: string;
}): string {
  const overlapList = p.pendingOverlap.overlaps
    .map(
      (o) =>
        `- "${o.existing_task_name}" prévue ${frenchDateTime(o.existing_next_due_at)} ` +
        `vs sous-tâche projet "${o.subtask_name}" le ${frenchDateTime(o.subtask_next_due_at)}`,
    )
    .join('\n');

  return `Tu es Yova, le 3e adulte du foyer. Un utilisateur en surcharge te répond à une question de groupement de tâches.

## Contexte

Aujourd'hui : ${p.todayIso}
Tu viens de demander à l'user : "${p.questionAsked}"

Projet en cours : "${p.pendingOverlap.project_title}"${
    p.pendingOverlap.project_target_date ? ` (date cible : ${p.pendingOverlap.project_target_date})` : ''
  }

Recoupements détectés :
${overlapList}

## Ton job

Choisis EXACTEMENT UN tool parmi : group_recurring, keep_both, reschedule_recurring.

Règles :
- Si la réponse est positive ("ok", "oui", "groupe", "fais ça") → group_recurring
- Si l'user refuse / veut séparer ("non", "garde les deux", "à côté") → keep_both
- Si l'user fournit une date PRÉCISE pour décaler ("samedi", "le 27 mai", "mardi prochain") → reschedule_recurring avec new_date_iso calculée depuis aujourd'hui
- Si la réponse est ambiguë, hors-sujet, ou si l'user dit "décale" sans préciser quand → keep_both (on ne devine pas, l'user pourra ajuster)

Génère AUSSI un court message en français pour confirmer l'action de manière naturelle et chaleureuse :
- group_recurring : "OK — j'ai groupé X avec le projet, tu y vas qu'une fois."
- keep_both : "OK — gardées séparément, tu pourras ajuster."
- reschedule_recurring : "OK — récurrente décalée au [date], elle couvre aussi ton projet."

Le message doit être factuel sur l'action, sans jargon technique, sans référence à la mémoire passée, max 25 mots. Pas d'emoji. Pas de "Comme la semaine dernière…".`;
}

function frenchDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}

// ---------------------------------------------------------------------------
// Tool execution helpers
// ---------------------------------------------------------------------------

type ExecCtx = {
  pendingOverlap: PendingOverlapData;
  householdId: string;
  userId: string;
  supabase: SupabaseClient;
  admin: SupabaseClient;
};

async function execGroup(ctx: ExecCtx): Promise<string> {
  for (const o of ctx.pendingOverlap.overlaps) {
    const { data: existing } = await ctx.admin
      .from('household_tasks')
      .select('covers_project_ids')
      .eq('id', o.existing_task_id)
      .maybeSingle();
    const current = (existing?.covers_project_ids as string[] | null) ?? [];
    const merged = current.includes(ctx.pendingOverlap.parent_id)
      ? current
      : [...current, ctx.pendingOverlap.parent_id];
    // Preco #1 : déplace la récurrente sur la date de la sous-tâche projet
    await ctx.admin
      .from('household_tasks')
      .update({ next_due_at: o.subtask_next_due_at, covers_project_ids: merged })
      .eq('id', o.existing_task_id);
  }
  return ctx.pendingOverlap.overlaps.length === 1
    ? `OK — j'ai groupé "${ctx.pendingOverlap.overlaps[0].existing_task_name}" avec le projet, tu y vas qu'une fois.`
    : `OK — j'ai groupé ${ctx.pendingOverlap.overlaps.length} tâches récurrentes avec le projet.`;
}

async function execKeepBoth(ctx: ExecCtx): Promise<string> {
  await insertPendingSubtasks(ctx);
  return ctx.pendingOverlap.overlaps.length === 1
    ? 'OK — gardées séparément, tu pourras ajuster sur /week.'
    : 'OK — gardées toutes séparément, tu pourras ajuster sur /week.';
}

async function execReschedule(ctx: ExecCtx, newDateIso: string): Promise<string> {
  for (const o of ctx.pendingOverlap.overlaps) {
    const { data: existing } = await ctx.admin
      .from('household_tasks')
      .select('covers_project_ids')
      .eq('id', o.existing_task_id)
      .maybeSingle();
    const current = (existing?.covers_project_ids as string[] | null) ?? [];
    const merged = current.includes(ctx.pendingOverlap.parent_id)
      ? current
      : [...current, ctx.pendingOverlap.parent_id];
    await ctx.admin
      .from('household_tasks')
      .update({ next_due_at: newDateIso, covers_project_ids: merged })
      .eq('id', o.existing_task_id);
  }
  const dateLabel = new Date(newDateIso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return ctx.pendingOverlap.overlaps.length === 1
    ? `OK — récurrente décalée au ${dateLabel}, elle couvre aussi ton projet.`
    : `OK — récurrentes décalées au ${dateLabel}, elles couvrent aussi ton projet.`;
}

async function insertPendingSubtasks(ctx: ExecCtx): Promise<void> {
  if (ctx.pendingOverlap.pending_subtasks.length === 0) return;
  const { data: cats } = await ctx.supabase.from('task_categories').select('id, name');
  const list = (cats ?? []) as Array<{ id: string; name: string }>;
  const fallbackCat =
    list.find((c) => c.name.toLowerCase() === 'gestion du foyer') ??
    list.find((c) => c.name.toLowerCase() === 'divers') ??
    list[0];
  if (!fallbackCat) {
    console.error('[overlap-dispatch] no fallback category, skipping pending subtask insert');
    return;
  }
  const rows = ctx.pendingOverlap.pending_subtasks.map((s) => ({
    household_id: ctx.householdId,
    name: s.name,
    category_id: fallbackCat.id,
    frequency: 'once' as never,
    mental_load_score: 3,
    user_score: 3,
    scoring_category: 'household_management',
    duration_estimate: s.duration_estimate,
    physical_effort: 'light',
    assigned_to: s.assigned_to,
    assigned_to_phantom_id: s.assigned_phantom_id,
    is_active: true,
    is_fixed_assignment: false,
    notifications_enabled: true,
    created_by: ctx.userId,
    next_due_at: s.next_due_at,
    parent_project_id: ctx.pendingOverlap.parent_id,
  }));
  const { error } = await ctx.admin.from('household_tasks').insert(rows);
  if (error) {
    console.error('[overlap-dispatch] keep_both insert error:', error);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pour les tests : permet d'injecter un fetch mocké. En prod, fetch global.
 */
export type DispatchInput = ExecCtx & {
  userResponse: string;
  questionAsked: string;
  fetchImpl?: typeof fetch;
  now?: Date;
};

/**
 * Appelle Haiku avec les 3 tools, exécute le tool choisi en DB, renvoie le
 * message Haiku + l'action effective. Sur échec / ambigu → fallback keep_both
 * silencieux. Logge l'usage IA dans tous les cas (succès et échec).
 */
export async function dispatchOverlapWithHaiku(input: DispatchInput): Promise<DispatchResult> {
  const startTime = Date.now();
  const fetchFn = input.fetchImpl ?? fetch;
  const now = input.now ?? new Date();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Pas de clé API → fallback silencieux (cohérent avec sprint 15bis fallback)
    const msg = await execKeepBoth(input);
    await safeLog(input, 0, 0, Date.now() - startTime, 'error', 'no_api_key');
    return { aiResponse: msg, action: 'fallback', durationMs: Date.now() - startTime };
  }

  const systemPrompt = buildSystemPrompt({
    pendingOverlap: input.pendingOverlap,
    todayIso: now.toISOString().slice(0, 10),
    questionAsked: input.questionAsked,
  });

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), MAX_DURATION_MS);

  let claudeData: AnthropicResponse | null = null;
  try {
    const response = await fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: systemPrompt,
        tools: TOOLS,
        tool_choice: { type: 'auto' },
        messages: [{ role: 'user', content: input.userResponse }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutHandle);

    if (!response.ok) {
      const errText = await response.text();
      console.error('[overlap-dispatch] Haiku error:', errText);
      const msg = await execKeepBoth(input);
      await safeLog(input, 0, 0, Date.now() - startTime, 'error', errText.slice(0, 200));
      return { aiResponse: msg, action: 'fallback', durationMs: Date.now() - startTime };
    }
    claudeData = (await response.json()) as AnthropicResponse;
  } catch (err) {
    clearTimeout(timeoutHandle);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.error('[overlap-dispatch] fetch error:', err);
    const msg = await execKeepBoth(input);
    await safeLog(input, 0, 0, Date.now() - startTime, 'error', isAbort ? 'timeout' : String(err));
    return { aiResponse: msg, action: 'fallback', durationMs: Date.now() - startTime };
  }

  const usage = extractUsageFromResponse(claudeData ?? {});
  const blocks = (claudeData?.content ?? []) as AnthropicContentBlock[];
  const toolBlock = blocks.find((b): b is Extract<AnthropicContentBlock, { type: 'tool_use' }> => b.type === 'tool_use');
  const haikuTextRaw = blocks
    .filter((b): b is Extract<AnthropicContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join(' ')
    .trim();

  // ── Pas de tool choisi → fallback silencieux (preco #6) ────────────────
  if (!toolBlock) {
    const msg = await execKeepBoth(input);
    await safeLog(input, usage.tokensInput, usage.tokensOutput, Date.now() - startTime, 'success', null, {
      action: 'fallback_no_tool',
    });
    return { aiResponse: msg, action: 'fallback', durationMs: Date.now() - startTime };
  }

  // ── Dispatch sur le tool choisi ────────────────────────────────────────
  let action: DispatchResult['action'] = 'fallback';
  let actionMsg: string;

  if (toolBlock.name === 'group_recurring') {
    actionMsg = await execGroup(input);
    action = 'group';
  } else if (toolBlock.name === 'keep_both') {
    actionMsg = await execKeepBoth(input);
    action = 'keep_both';
  } else if (toolBlock.name === 'reschedule_recurring') {
    const newDate = typeof toolBlock.input.new_date_iso === 'string' ? toolBlock.input.new_date_iso : null;
    if (!newDate || Number.isNaN(new Date(newDate).getTime())) {
      // Date invalide → fallback keep_both (Haiku a triché — on protège)
      console.warn('[overlap-dispatch] reschedule called without valid date, fallback keep_both');
      actionMsg = await execKeepBoth(input);
      action = 'fallback';
    } else {
      actionMsg = await execReschedule(input, newDate);
      action = 'reschedule';
    }
  } else {
    // Tool inconnu (Haiku a halluciné un nom) → fallback
    console.warn('[overlap-dispatch] unknown tool name:', toolBlock.name);
    actionMsg = await execKeepBoth(input);
    action = 'fallback';
  }

  // Préfère le message d'Haiku s'il a généré un texte non vide ; sinon
  // utilise le message canned dérivé de l'action exécutée.
  const aiResponse = haikuTextRaw.length > 0 ? haikuTextRaw : actionMsg;

  await safeLog(input, usage.tokensInput, usage.tokensOutput, Date.now() - startTime, 'success', null, {
    action,
    tool_name: toolBlock.name,
  });

  return { aiResponse, action, durationMs: Date.now() - startTime };
}

async function safeLog(
  input: ExecCtx,
  tokensInput: number,
  tokensOutput: number,
  durationMs: number,
  status: 'success' | 'error',
  errorMessage: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await logAiUsage(input.supabase as never, {
      userId: input.userId,
      householdId: input.householdId,
      endpoint: 'overlap-dispatch',
      tokensInput,
      tokensOutput,
      durationMs,
      status,
      errorMessage: errorMessage ?? undefined,
      metadata,
    });
  } catch (err) {
    console.error('[overlap-dispatch] log error:', err);
  }
}
