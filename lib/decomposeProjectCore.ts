/**
 * Sprint 12 — Cœur réutilisable de la décomposition de projets.
 *
 * Appelé par :
 *   - `app/api/ai/decompose-project/route.ts` (endpoint direct)
 *   - `app/api/ai/parse-journal/route.ts` (routage automatique depuis le chat)
 *
 * Suppose : user déjà authentifié, consentement RGPD vérifié, rate-limit consommé
 * par l'appelant. Ne touche PAS à ai_calls_this_month (à gérer en amont).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logAiUsage, extractUsageFromResponse } from '@/utils/aiLogger';
import {
  validateDecomposition,
  ValidationError,
  projectTitleSimilarity,
  type DecomposedSubtask,
} from '@/utils/projectDecomposition';
import {
  detectOverlaps,
  buildOverlapQuestion,
  type OverlapMatch,
  type CandidateRecurringTask,
} from '@/utils/overlapDetection';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-6';
const MAX_DURATION_MS = 15_000;

const DURATION_MINUTES: Record<string, number> = {
  very_short: 5, short: 15, medium: 30, long: 60, very_long: 120,
};

const PROJECT_CATEGORY_FALLBACK = ['gestion du foyer', 'divers'];

export type DecomposeCoreInput = {
  prompt: string;
  userId: string;
  userName: string;
  householdId: string;
  supabase: SupabaseClient;       // anon (lecture avec RLS)
  admin: SupabaseClient;          // service role (inserts)
  skipDuplicateCheck?: boolean;   // Sprint 14 — bypass quand user a choisi "ajouter"
};

export type DecomposeCoreOutput =
  | {
      kind: 'decomposed';
      parent_task_id: string;
      title: string;
      description: string | null;
      target_date: string | null;
      subtask_count: number;
      subtasks: Array<{
        name: string;
        duration_minutes: number;
        next_due_at: string;
        assigned_to: string | null;
        assigned_phantom_id: string | null;
        notes: string | null;
      }>;
      duration_ms: number;
    }
  | {
      kind: 'pending';
      question: string;
      missing: string | null;
    }
  | {
      kind: 'duplicate';
      question: string;
      existing_title: string;
      existing_date: string | null;
    }
  | {
      kind: 'overlap_question';
      question: string;
      parent_task_id: string;
      title: string;
      target_date: string | null;
      inserted_subtask_count: number;       // sous-tâches non-overlap déjà créées
      pending_overlap_count: number;
    }
  | {
      kind: 'error';
      http_status: number;
      error: string;
      user_message?: string;
    };

function buildSystemPrompt(p: {
  userName: string; householdSize: number;
  membersBlock: string; profileBlock: string;
  factsBlock: string; turnsBlock: string; todayIso: string;
}): string {
  return `Tu es Yova, assistant IA d'un foyer en surcharge. L'utilisateur te demande de décomposer un projet multi-étapes (repas, anniv, week-end, rdv, ménage saisonnier…).

## RÈGLE ABSOLUE — proposition imparfaite, pas interrogatoire

Tu décomposes en UN SEUL tour. Tu ne poses JAMAIS plus d'une question. Tu t'appuies sur :
1. La mémoire du foyer (profil, membres, faits, derniers échanges)
2. Les défauts nominaux (voir table)
3. Les besoins universels (courses, cuisine, ménage, admin)

Tu proposes une décomposition utilisable. L'utilisateur ajustera ensuite (reporter, réassigner, pas pertinent).

## Table des défauts (si l'info manque ET rien en mémoire)

| Info | Défaut |
|---|---|
| Nb convives | taille foyer (${p.householdSize}) |
| Budget | normal |
| Invités | aucun sauf mention |
| Régimes | allergies déjà en mémoire uniquement |
| Créneau courses | la veille après-midi |
| Créneau prépa | H-2 avant repas |
| Qui fait quoi | patterns mémoire sinon null (foyer) |

## Contexte foyer

Utilisateur : ${p.userName}
Aujourd'hui : ${p.todayIso}

### Membres
${p.membersBlock}

### Profil foyer
${p.profileBlock}

### Faits mémorisés
${p.factsBlock || '(aucun)'}

### Derniers échanges
${p.turnsBlock || '(aucun)'}

## Format de sortie — JSON strict, RIEN d'autre

### Cas 1 — décomposition complète
{
  "project": {
    "title": "court (ex: 'Déjeuner dimanche')",
    "description": "1 phrase contexte ou null",
    "target_date": "YYYY-MM-DD ou null"
  },
  "subtasks": [
    {
      "name": "verbe + objet, max 8 mots",
      "duration_estimate": "very_short | short | medium | long | very_long",
      "next_due_at": "YYYY-MM-DDTHH:mm:ss.000Z (UTC, ≥ maintenant)",
      "assigned_to": "<UUID adulte connecté — celui marqué [uuid] — ou null>",
      "assigned_phantom_id": "<UUID membre non-connecté — celui marqué [phantom:uuid] — ou null>",
      "notes": "≤ 140 chars ou null"
    }
    // 3-6 sous-tâches — jamais < 2, jamais > 6
  ],
  "pending_question": null,
  "pending_missing": null
}

### Cas 2 — UNE question si fait critique manquant sans défaut raisonnable
Ex : "organise un dîner avec mes potes" → tu ne sais pas combien.
{
  "project": null,
  "subtasks": [],
  "pending_question": "Vous serez combien à table ?",
  "pending_missing": "guest_count"
}

## Règles

- Sous-tâches DATÉES sur créneaux réalistes.
- **Assignation par défaut = null (foyer)**. Les DEUX champs \`assigned_to\` et \`assigned_phantom_id\` à null = tâche foyer.
- **Un seul des deux champs peut être non-null par sous-tâche** (jamais les deux). \`assigned_to\` = UUID visible comme \`[uuid]\` dans la liste membres (adulte connecté). \`assigned_phantom_id\` = UUID visible comme \`[phantom:uuid]\` (membre sans compte : Barbara, enfant…).
- N'assigne à un UUID (profile OU phantom) QUE si un fait mémorisé établit un pattern clair ("Barbara cuisine le dimanche", "Jonathan fait les courses"). N'assigne PAS systématiquement à l'utilisateur qui demande — il a pas forcément envie de tout faire. N'assigne PAS à un phantom par défaut juste parce qu'il existe.
- N'invente aucun fait. Défaut nominal > question.
- MAXIMUM 1 pending_question. Sinon décompose même imparfaitement.

## Durées réalistes — repères obligatoires

Les valeurs de duration_estimate correspondent à :
- very_short (5 min) : décider d'un truc, passer un coup de fil court, écrire une liste
- short (15 min) : ranger une pièce, dresser une table, préparer un apéro simple, sortir 3 poubelles
- medium (30 min) : cuisiner un repas simple du quotidien, petites courses d'appoint, nettoyer une salle de bain
- long (60 min) : **courses hebdo au supermarché** (trajet + magasin + déballage), **préparer un vrai repas familial** (entrée + plat + dessert), grand ménage d'une pièce
- very_long (120 min+) : journée courses + grosse cuisine combinées, ménage de printemps d'une pièce, réception avec 6+ invités

**Les courses pour un repas du dimanche ou un événement = toujours "long" minimum** (jamais 15 min — sauf si l'user précise explicitement "juste un truc à acheter"). **Préparer un repas familial = "long" minimum** (30 min = pâtes du soir, pas un déjeuner dominical).

Réponds UNIQUEMENT avec l'objet JSON, sans préambule, sans markdown.`;
}

export async function decomposeProjectCore(input: DecomposeCoreInput): Promise<DecomposeCoreOutput> {
  const startTime = Date.now();
  const { prompt, userId, userName, householdId, supabase, admin, skipDuplicateCheck } = input;

  if (!ANTHROPIC_API_KEY) {
    return { kind: 'error', http_status: 503, error: 'IA indisponible' };
  }

  // ── Charger le contexte foyer ──────────────────────────────────────
  const [membersRes, phantomsRes, categoriesRes, profileRes, factsRes, turnsRes] = await Promise.all([
    supabase.from('profiles').select('id, display_name').eq('household_id', householdId),
    supabase.from('phantom_members').select('id, display_name, member_type, birth_date, school_class, specifics').eq('household_id', householdId),
    supabase.from('task_categories').select('id, name'),
    supabase.from('household_profile').select('energy_level, current_life_events, external_help, crisis_mode_active, notes').eq('household_id', householdId).maybeSingle(),
    supabase.from('agent_memory_facts')
      .select('fact_type, content, confidence')
      .eq('household_id', householdId).eq('is_active', true)
      .order('created_at', { ascending: false }).limit(20),
    supabase.from('conversation_turns')
      .select('speaker, content, created_at')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false }).limit(5),
  ]);

  const members = (membersRes.data ?? []) as Array<{ id: string; display_name: string }>;
  const phantoms = (phantomsRes.data ?? []) as Array<{
    id: string; display_name: string; member_type: string | null;
    birth_date: string | null; school_class: string | null; specifics: Record<string, unknown> | null;
  }>;
  const categories = (categoriesRes.data ?? []) as Array<{ id: string; name: string }>;
  const householdProfile = profileRes.data as {
    energy_level?: string; current_life_events?: string[];
    crisis_mode_active?: boolean; notes?: string | null;
  } | null;
  const facts = (factsRes.data ?? []) as Array<{ fact_type: string; content: string; confidence: number }>;
  const turns = (turnsRes.data ?? []).reverse() as Array<{ speaker: string; content: string }>;

  const householdSize = members.length + phantoms.length;

  const membersBlock = [
    ...members.map((m) => `- [${m.id}] ${m.display_name} (adulte connecté)`),
    ...phantoms.map((p) => {
      const kind = p.member_type === 'child' ? 'enfant' : p.member_type === 'adult' ? 'adulte' : 'membre';
      const age = p.birth_date
        ? ` ${Math.floor((Date.now() - new Date(p.birth_date).getTime()) / (365.25 * 86400000))} ans`
        : '';
      const klass = p.school_class ? ` ${p.school_class}` : '';
      const allerg = (p.specifics as { allergies?: string[] } | null)?.allergies;
      const allergStr = Array.isArray(allerg) && allerg.length > 0 ? ` · allergies : ${allerg.join(', ')}` : '';
      return `- [phantom:${p.id}] ${p.display_name} (${kind}${age}${klass})${allergStr}`;
    }),
  ].join('\n') || '(aucun membre)';

  const profileBlock = householdProfile ? [
    `Énergie : ${householdProfile.energy_level ?? 'medium'}`,
    householdProfile.crisis_mode_active ? 'MODE CRISE ACTIF — périmètre minimal' : null,
    Array.isArray(householdProfile.current_life_events) && householdProfile.current_life_events.length > 0
      ? `Ce qu'on traverse : ${householdProfile.current_life_events.join(', ')}` : null,
    householdProfile.notes ? `Notes : ${householdProfile.notes}` : null,
  ].filter(Boolean).join('\n') : '(pas de profil)';

  const factsBlock = facts.length > 0
    ? facts.map((f) => `[${f.fact_type}] ${f.content} (conf. ${f.confidence.toFixed(2)})`).join('\n')
    : '';

  const turnsBlock = turns.length > 0
    ? turns.map((t) => `${t.speaker === 'user' ? 'User' : 'Yova'} : ${t.content.slice(0, 200)}`).join('\n')
    : '';

  // ── Sprint 14 — Détection de doublon projet (bypass si skipDuplicateCheck) ──
  // Cherche un parent actif existant dont le titre ressemble au prompt user ET
  // dont la date cible est dans les 14 prochains jours. Seuil strict (0.6).
  if (!skipDuplicateCheck) {
    const in14Days = new Date(Date.now() + 14 * 86400000).toISOString();
    const { data: activeParents } = await supabase
      .from('household_tasks')
      .select('id, name, next_due_at, parent_project_id')
      .eq('household_id', householdId)
      .eq('is_active', true)
      .is('parent_project_id', null)
      .eq('frequency', 'once')
      .not('next_due_at', 'is', null)
      .lte('next_due_at', in14Days)
      .gte('next_due_at', new Date().toISOString())
      .limit(50);

    let duplicate: { id: string; name: string; next_due_at: string | null } | null = null;
    if (activeParents && activeParents.length > 0) {
      const candidateIds = activeParents.map((t) => t.id);
      const { data: children } = await supabase
        .from('household_tasks')
        .select('parent_project_id')
        .eq('household_id', householdId)
        .in('parent_project_id', candidateIds);
      const parentIds = new Set((children ?? []).map((c) => c.parent_project_id).filter(Boolean));

      for (const p of activeParents) {
        if (!parentIds.has(p.id)) continue;
        const sim = projectTitleSimilarity(p.name, prompt);
        if (sim >= 0.6) {
          duplicate = { id: p.id, name: p.name, next_due_at: p.next_due_at };
          break;
        }
      }
    }

    if (duplicate) {
      const dateStr = duplicate.next_due_at
        ? new Date(duplicate.next_due_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
        : 'bientôt';
      const question = `Tu as déjà un "${duplicate.name}" prévu le ${dateStr}. Tu veux le remplacer ou j'ajoute à côté ?`;
      await admin.from('conversation_turns').insert({
        household_id: householdId, user_id: userId, speaker: 'agent',
        content: question, source: 'chat',
        extracted_facts: {
          pending_project_duplicate: {
            original_prompt: prompt,
            existing_parent_id: duplicate.id,
            existing_title: duplicate.name,
          },
        },
      });
      return {
        kind: 'duplicate',
        question,
        existing_title: duplicate.name,
        existing_date: duplicate.next_due_at,
      };
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const systemPrompt = buildSystemPrompt({
    userName, householdSize, membersBlock, profileBlock, factsBlock, turnsBlock, todayIso,
  });

  // ── Appel Sonnet avec timeout ──────────────────────────────────────
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), MAX_DURATION_MS);

  let claudeData: { content?: Array<{ text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } } | null = null;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL, max_tokens: 2000, system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutHandle);

    if (!response.ok) {
      const errText = await response.text();
      console.error('[decompose-project-core] Claude error:', errText);
      await logAiUsage(supabase as never, {
        userId, householdId, endpoint: 'decompose-project',
        tokensInput: 0, tokensOutput: 0, durationMs: Date.now() - startTime,
        status: 'error', errorMessage: errText,
      });
      return { kind: 'error', http_status: 502, error: 'Erreur IA', user_message: "J'ai eu un pépin. Réessaye ?" };
    }
    claudeData = await response.json();
  } catch (err) {
    clearTimeout(timeoutHandle);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.error('[decompose-project-core] fetch error:', err);
    await logAiUsage(supabase as never, {
      userId, householdId, endpoint: 'decompose-project',
      tokensInput: 0, tokensOutput: 0, durationMs: Date.now() - startTime,
      status: 'error', errorMessage: isAbort ? 'timeout' : String(err),
    });
    return {
      kind: 'error',
      http_status: isAbort ? 504 : 502,
      error: isAbort ? 'Timeout IA' : 'Erreur IA',
      user_message: isAbort ? "Ça a pris trop de temps. Reformule plus court ?" : "J'ai eu un pépin.",
    };
  }

  const aiText = claudeData?.content?.[0]?.text ?? '{}';
  const usage = extractUsageFromResponse(claudeData ?? {});
  const jsonMatch = aiText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[decompose-project-core] no JSON:', aiText.slice(0, 200));
    return { kind: 'error', http_status: 502, error: 'Réponse IA invalide' };
  }

  let validated;
  try {
    validated = validateDecomposition(JSON.parse(jsonMatch[0]));
  } catch (err) {
    const msg = err instanceof ValidationError ? err.message : 'parse failed';
    console.error('[decompose-project-core] validation error:', msg, aiText.slice(0, 400));
    await logAiUsage(supabase as never, {
      userId, householdId, endpoint: 'decompose-project',
      tokensInput: usage.tokensInput, tokensOutput: usage.tokensOutput,
      durationMs: Date.now() - startTime, status: 'error',
      errorMessage: `validation: ${msg}`,
    });
    return {
      kind: 'error', http_status: 502,
      error: 'Structure IA invalide',
      user_message: "J'ai eu un souci de compréhension. Reformule ?",
    };
  }

  // ── Pending question ───────────────────────────────────────────────
  if (validated.pending_question) {
    await logAiUsage(supabase as never, {
      userId, householdId, endpoint: 'decompose-project',
      tokensInput: usage.tokensInput, tokensOutput: usage.tokensOutput,
      durationMs: Date.now() - startTime, status: 'success',
      metadata: { pending_question: true, missing: validated.pending_missing },
    });
    await admin.from('conversation_turns').insert({
      household_id: householdId, user_id: userId, speaker: 'agent',
      content: validated.pending_question, source: 'chat',
      extracted_facts: {
        pending_project: {
          original_prompt: prompt,
          missing: validated.pending_missing,
        },
      },
    });
    return { kind: 'pending', question: validated.pending_question, missing: validated.pending_missing };
  }

  // ── Décomposition complète ─────────────────────────────────────────
  const fallbackCategoryName = PROJECT_CATEGORY_FALLBACK.find((n) =>
    categories.some((c) => c.name.toLowerCase() === n)
  );
  const fallbackCategoryId = fallbackCategoryName
    ? categories.find((c) => c.name.toLowerCase() === fallbackCategoryName)!.id
    : categories[0]?.id;

  if (!fallbackCategoryId) {
    return { kind: 'error', http_status: 500, error: 'Catégories manquantes' };
  }

  const parentTargetIso = validated.project.target_date
    ? `${validated.project.target_date}T20:00:00.000Z`
    : null;

  const memberIdSet = new Set(members.map((m) => m.id));
  const phantomIdSet = new Set(phantoms.map((p) => p.id));
  const sanitizedSubtasks: DecomposedSubtask[] = validated.subtasks.map((s) => {
    const keepProfile = s.assigned_to && memberIdSet.has(s.assigned_to);
    const keepPhantom = s.assigned_phantom_id && phantomIdSet.has(s.assigned_phantom_id);
    // Mutex côté défensif : si par malheur les deux sont présents (le validator
    // l'interdit déjà), on garde le profile et on lâche le phantom.
    return {
      ...s,
      assigned_to: keepProfile ? s.assigned_to : null,
      assigned_phantom_id: keepProfile ? null : keepPhantom ? s.assigned_phantom_id : null,
    };
  });

  const { data: parentRow, error: parentErr } = await admin.from('household_tasks').insert({
    household_id: householdId,
    name: validated.project.title,
    category_id: fallbackCategoryId,
    frequency: 'once' as never,
    mental_load_score: 5, user_score: 5,
    scoring_category: 'household_management',
    duration_estimate: 'long', physical_effort: 'light',
    assigned_to: userId,
    is_active: true, is_fixed_assignment: false, notifications_enabled: true,
    created_by: userId,
    next_due_at: parentTargetIso,
    parent_project_id: null,
  }).select('id').single();

  if (parentErr || !parentRow) {
    console.error('[decompose-project-core] parent insert error:', parentErr);
    return { kind: 'error', http_status: 500, error: 'Échec création projet' };
  }

  // ── Sprint 16 — Détection de chevauchement avec récurrentes existantes ──
  // Charge les tâches actives RÉCURRENTES (non-once) du foyer dont next_due_at
  // tombe dans une fenêtre large autour des sous-tâches générées.
  // Une tâche `once` n'est jamais une "récurrente qui pourrait couvrir" — on ne
  // détecte pas les overlaps entre projets (out-of-scope sprint 16).
  const subtaskDates = sanitizedSubtasks
    .map((s) => new Date(s.next_due_at).getTime())
    .filter((t) => Number.isFinite(t));
  let overlaps: OverlapMatch[] = [];
  if (subtaskDates.length > 0) {
    const minTs = Math.min(...subtaskDates) - 8 * 86_400_000;
    const maxTs = Math.max(...subtaskDates) + 8 * 86_400_000;
    const { data: candidates } = await supabase
      .from('household_tasks')
      .select('id, name, next_due_at, frequency, parent_project_id')
      .eq('household_id', householdId)
      .eq('is_active', true)
      .is('parent_project_id', null)
      .neq('frequency', 'once')
      .not('next_due_at', 'is', null)
      .gte('next_due_at', new Date(minTs).toISOString())
      .lte('next_due_at', new Date(maxTs).toISOString())
      .limit(50);

    const candList: CandidateRecurringTask[] = (candidates ?? []).map((c) => ({
      id: c.id, name: c.name, next_due_at: c.next_due_at,
    }));

    overlaps = detectOverlaps(
      sanitizedSubtasks.map((s, i) => ({
        index: i, name: s.name, next_due_at: s.next_due_at,
      })),
      candList,
    );
  }

  const overlapIndexSet = new Set(overlaps.map((o) => o.subtask_index));
  const nonOverlapSubs = sanitizedSubtasks.filter((_, i) => !overlapIndexSet.has(i));
  const pendingSubs = sanitizedSubtasks.filter((_, i) => overlapIndexSet.has(i));

  const buildChildRow = (s: DecomposedSubtask) => ({
    household_id: householdId,
    name: s.name,
    category_id: fallbackCategoryId,
    frequency: 'once' as never,
    mental_load_score: 3, user_score: 3,
    scoring_category: 'household_management',
    duration_estimate: s.duration_estimate,
    physical_effort: 'light',
    // null = foyer (tout le monde peut la prendre). Ne PAS forcer userId par
    // défaut — l'user typant le prompt n'est pas forcément celui qui fait
    // tout. Si Yova n'a pas de pattern mémoire clair, laisser foyer.
    assigned_to: s.assigned_to,
    assigned_to_phantom_id: s.assigned_phantom_id,
    is_active: true, is_fixed_assignment: false, notifications_enabled: true,
    created_by: userId,
    next_due_at: s.next_due_at,
    parent_project_id: parentRow.id,
  });

  const childRows = nonOverlapSubs.map(buildChildRow);

  if (childRows.length > 0) {
    const { error: childrenErr } = await admin.from('household_tasks').insert(childRows);
    if (childrenErr) {
      console.error('[decompose-project-core] children insert error:', childrenErr);
      await admin.from('household_tasks').delete().eq('id', parentRow.id);
      return { kind: 'error', http_status: 500, error: 'Échec création sous-tâches' };
    }
  }

  // ── Sprint 16 — Si overlaps détectés, on stoppe ici et on pose la question ──
  if (overlaps.length > 0) {
    const question = buildOverlapQuestion(overlaps);
    const duration = Date.now() - startTime;
    await logAiUsage(supabase as never, {
      userId, householdId, endpoint: 'decompose-project',
      tokensInput: usage.tokensInput, tokensOutput: usage.tokensOutput,
      durationMs: duration, status: 'success',
      metadata: {
        subtask_count: nonOverlapSubs.length,
        target_date: validated.project.target_date,
        parent_task_id: parentRow.id,
        overlap_count: overlaps.length,
      },
    });
    await admin.from('conversation_turns').insert([
      { household_id: householdId, user_id: userId, speaker: 'user', content: prompt, source: 'chat' },
      {
        household_id: householdId, user_id: userId, speaker: 'agent',
        content: question, source: 'chat',
        extracted_facts: {
          pending_overlap: {
            parent_id: parentRow.id,
            project_title: validated.project.title,
            project_target_date: validated.project.target_date,
            pending_subtasks: pendingSubs.map((s) => ({
              name: s.name,
              duration_estimate: s.duration_estimate,
              next_due_at: s.next_due_at,
              assigned_to: s.assigned_to,
              assigned_phantom_id: s.assigned_phantom_id,
              notes: s.notes,
            })),
            overlaps: overlaps.map((o) => ({
              existing_task_id: o.existing_task_id,
              existing_task_name: o.existing_task_name,
              existing_next_due_at: o.existing_next_due_at,
              subtask_name: o.subtask_name,
              subtask_next_due_at: o.subtask_next_due_at,
            })),
          },
        },
      },
    ]);
    return {
      kind: 'overlap_question',
      question,
      parent_task_id: parentRow.id,
      title: validated.project.title,
      target_date: validated.project.target_date,
      inserted_subtask_count: nonOverlapSubs.length,
      pending_overlap_count: overlaps.length,
    };
  }

  const duration = Date.now() - startTime;
  await logAiUsage(supabase as never, {
    userId, householdId, endpoint: 'decompose-project',
    tokensInput: usage.tokensInput, tokensOutput: usage.tokensOutput,
    durationMs: duration, status: 'success',
    metadata: {
      subtask_count: sanitizedSubtasks.length,
      target_date: validated.project.target_date,
      parent_task_id: parentRow.id,
    },
  });

  await admin.from('conversation_turns').insert([
    { household_id: householdId, user_id: userId, speaker: 'user', content: prompt, source: 'chat' },
    {
      household_id: householdId, user_id: userId, speaker: 'agent',
      content: `Projet créé : ${validated.project.title} · ${sanitizedSubtasks.length} sous-tâches`,
      source: 'chat',
      extracted_facts: { project_id: parentRow.id },
    },
  ]);

  return {
    kind: 'decomposed',
    parent_task_id: parentRow.id,
    title: validated.project.title,
    description: validated.project.description,
    target_date: validated.project.target_date,
    subtask_count: sanitizedSubtasks.length,
    subtasks: sanitizedSubtasks.map((s) => ({
      name: s.name,
      duration_minutes: DURATION_MINUTES[s.duration_estimate] ?? 15,
      next_due_at: s.next_due_at,
      assigned_to: s.assigned_to,
      assigned_phantom_id: s.assigned_phantom_id,
      notes: s.notes,
    })),
    duration_ms: duration,
  };
}

/**
 * Récupère un pending_project récent (< 10 min) stocké par Yova, si l'user
 * vient de répondre à une question unique. Renvoie null sinon.
 */
/**
 * Sprint 14 — Récupère un pending_project_duplicate récent (< 10 min).
 * Renvoie le contexte + la réponse user attendue ('remplacer' | 'ajouter').
 */
export async function findPendingDuplicate(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ original_prompt: string; existing_parent_id: string; existing_title: string } | null> {
  const { data } = await supabase.from('conversation_turns')
    .select('extracted_facts, created_at')
    .eq('household_id', householdId).eq('speaker', 'agent')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const ageMs = Date.now() - new Date(data.created_at).getTime();
  if (ageMs > 10 * 60 * 1000) return null;
  const facts = data.extracted_facts as Record<string, unknown> | null;
  const p = facts?.pending_project_duplicate as {
    original_prompt?: unknown; existing_parent_id?: unknown; existing_title?: unknown;
  } | undefined;
  if (!p || typeof p.original_prompt !== 'string' || typeof p.existing_parent_id !== 'string' || typeof p.existing_title !== 'string') {
    return null;
  }
  return {
    original_prompt: p.original_prompt,
    existing_parent_id: p.existing_parent_id,
    existing_title: p.existing_title,
  };
}

/**
 * Sprint 14 — Détecte la décision user (remplacer/ajouter) après un
 * pending_project_duplicate. Retourne 'replace' | 'add' | null si ambigu.
 */
export function interpretDuplicateAnswer(text: string): 'replace' | 'add' | null {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(remplace|remplacer|remplacement|a la place|annule|annuler|supprime)\b/.test(t)) return 'replace';
  if (/\b(ajoute|ajouter|a cote|en plus|les deux|garde|conserve|oui.*ajoute|separe|separement)\b/.test(t)) return 'add';
  return null;
}

// ---------------------------------------------------------------------------
// Sprint 16 — Pending overlap (proposition de groupement)
// ---------------------------------------------------------------------------

export type PendingOverlapData = {
  parent_id: string;
  project_title: string;
  project_target_date: string | null;
  pending_subtasks: Array<{
    name: string;
    duration_estimate: 'very_short' | 'short' | 'medium' | 'long' | 'very_long';
    next_due_at: string;
    assigned_to: string | null;
    assigned_phantom_id: string | null;
    notes: string | null;
  }>;
  overlaps: Array<{
    existing_task_id: string;
    existing_task_name: string;
    existing_next_due_at: string;
    subtask_name: string;
    subtask_next_due_at: string;
  }>;
};

/**
 * Récupère un pending_overlap récent (< 10 min). Renvoie le contexte complet
 * pour appliquer la décision user (group / keep_both / reschedule).
 */
export async function findPendingOverlap(
  supabase: SupabaseClient,
  householdId: string,
): Promise<PendingOverlapData | null> {
  const { data } = await supabase.from('conversation_turns')
    .select('extracted_facts, created_at')
    .eq('household_id', householdId).eq('speaker', 'agent')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const ageMs = Date.now() - new Date(data.created_at).getTime();
  if (ageMs > 10 * 60 * 1000) return null;
  const facts = data.extracted_facts as Record<string, unknown> | null;
  const p = facts?.pending_overlap as PendingOverlapData | undefined;
  if (!p || typeof p.parent_id !== 'string' || !Array.isArray(p.pending_subtasks) || !Array.isArray(p.overlaps)) {
    return null;
  }
  return p;
}

/**
 * Sprint 16 — Cleanup cascade : quand un projet parent est archivé, retire
 * son ID de la liste covers_project_ids de toutes les tâches qui le couvraient.
 * Appel idempotent. Safe à lancer même si aucune tâche ne le couvre.
 */
export async function clearCoversForProject(
  admin: SupabaseClient,
  householdId: string,
  projectId: string,
): Promise<void> {
  const { data: covering } = await admin
    .from('household_tasks')
    .select('id, covers_project_ids')
    .eq('household_id', householdId)
    .contains('covers_project_ids', [projectId]);
  if (!covering || covering.length === 0) return;
  for (const t of covering) {
    const remaining = ((t.covers_project_ids as string[] | null) ?? []).filter((id) => id !== projectId);
    await admin.from('household_tasks')
      .update({ covers_project_ids: remaining })
      .eq('id', t.id);
  }
}

export async function findPendingProject(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ original_prompt: string; missing: string | null } | null> {
  const { data } = await supabase.from('conversation_turns')
    .select('content, extracted_facts, created_at')
    .eq('household_id', householdId).eq('speaker', 'agent')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (!data) return null;
  const ageMs = Date.now() - new Date(data.created_at).getTime();
  if (ageMs > 10 * 60 * 1000) return null;

  const facts = data.extracted_facts as Record<string, unknown> | null;
  const p = facts?.pending_project as { original_prompt?: unknown; missing?: unknown } | undefined;
  if (!p || typeof p.original_prompt !== 'string' || !p.original_prompt.trim()) return null;

  return {
    original_prompt: p.original_prompt,
    missing: typeof p.missing === 'string' ? p.missing : null,
  };
}
