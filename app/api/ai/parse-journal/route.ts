import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { checkAndIncrementAiUsage } from '@/utils/aiRateLimit';
import { getHouseholdPreferences, formatHouseholdPreferencesForPrompt } from '@/utils/userPreferences';
import { logAiUsage, extractUsageFromResponse } from '@/utils/aiLogger';

/**
 * API Route : parse-journal
 *
 * Prend une phrase en langage naturel de l'utilisateur (ex: "ce matin j'ai sorti
 * le chien, fait les courses, Barbara a rangé la cuisine") et extrait les
 * complétions de tâches correspondantes.
 *
 * Utilise Claude Haiku avec le contexte complet du foyer : tâches actives,
 * membres, préférences. Renvoie un JSON avec les complétions, les items non
 * matchés, et une réponse empathique à afficher.
 *
 * Côté DB : crée une ligne dans user_journals, insère les complétions dans
 * task_completions avec completion_method='journal', log l'usage IA.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

type ParsedCompletion = {
  task_id: string;
  task_name: string;
  completed_by: string | null;
  completed_by_phantom_id: string | null;
  duration_minutes: number | null;
  note: string | null;
  confidence: number;
};

type ParsedResult = {
  completions: ParsedCompletion[];
  unmatched: string[];
  ai_response: string;
  mood_tone: string | null;
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Rate limit (compte comme 1 appel IA pour les gratuits)
  const rate = await checkAndIncrementAiUsage(supabase, user.id);
  if (!rate.allowed) {
    await logAiUsage(supabase as never, {
      userId: user.id, endpoint: 'parse-journal', tokensInput: 0, tokensOutput: 0,
      durationMs: Date.now() - startTime, status: 'rate_limited',
    });
    return NextResponse.json({
      error: 'Limite IA atteinte',
      code: 'AI_LIMIT_REACHED',
      message: 'Tu as atteint ta limite mensuelle. Passe en Premium pour un journal illimité.',
      remaining: rate.remaining,
    }, { status: 429 });
  }

  let body: { text?: unknown; inputMethod?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const inputMethod: 'text' | 'voice' = body.inputMethod === 'voice' ? 'voice' : 'text';
  if (!text || text.length < 3 || text.length > 2000) {
    return NextResponse.json({ error: 'Texte requis (3 à 2000 caractères)' }, { status: 400 });
  }

  // ─── Charger le contexte du foyer ────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.household_id) {
    return NextResponse.json({ error: 'Pas de foyer associé' }, { status: 400 });
  }

  const householdId = profile.household_id;

  // Tâches actives + membres + fantômes
  const [tasksRes, membersRes, phantomsRes] = await Promise.all([
    supabase.from('household_tasks')
      .select('id, name, scoring_category, frequency, duration_estimate')
      .eq('household_id', householdId)
      .eq('is_active', true),
    supabase.from('profiles').select('id, display_name').eq('household_id', householdId),
    supabase.from('phantom_members').select('id, display_name').eq('household_id', householdId),
  ]);

  const tasks = tasksRes.data ?? [];
  const members = membersRes.data ?? [];
  const phantoms = phantomsRes.data ?? [];

  if (tasks.length === 0) {
    return NextResponse.json({
      completions: [],
      unmatched: [text],
      ai_response: "Tu n'as pas encore de tâches dans ton foyer. Crée-en d'abord, je pourrai ensuite suivre ce que tu fais.",
    });
  }

  // Préférences pour personnaliser la réponse
  const memberNames = new Map<string, string>();
  for (const m of members) memberNames.set(m.id, m.display_name);
  const memberIds = members.map((m: { id: string }) => m.id);
  const householdPrefs = await getHouseholdPreferences(supabase as unknown as never, memberIds);
  const prefsBlock = formatHouseholdPreferencesForPrompt(householdPrefs, memberNames);

  // ─── Construction du prompt ──────────────────────────────────────────────
  const userName = profile.display_name ?? 'l\'utilisateur';

  const tasksListBlock = tasks.map((t: { id: string; name: string; scoring_category: string | null }) =>
    `- [${t.id}] "${t.name}"${t.scoring_category ? ` (${t.scoring_category})` : ''}`
  ).join('\n');

  const membersBlock = [
    ...members.map((m: { id: string; display_name: string }) => `- [${m.id}] ${m.display_name} (membre)`),
    ...phantoms.map((p: { id: string; display_name: string }) => `- [phantom:${p.id}] ${p.display_name} (fantôme)`),
  ].join('\n');

  const prompt = `Tu es Aura, l'assistant personnel d'un foyer. ${userName} vient de te raconter sa journée en langage naturel. Ton job est d'extraire les complétions de tâches qu'elle/il mentionne et de répondre de manière empathique et brève.

## Contexte du foyer

### Tâches actives (ID entre crochets)
${tasksListBlock}

### Membres du foyer
${membersBlock}
${prefsBlock}

## Ce que ${userName} raconte

"""
${text}
"""

## Ta mission

1. Pour chaque action mentionnée, tente de matcher avec une tâche existante par sémantique (pas juste les mots-clés). Ex: "j'ai lancé une lessive" → tâche "Faire la machine à laver".
2. Identifie QUI a fait la tâche. Par défaut c'est ${userName} (la personne qui raconte). Si elle/il mentionne explicitement un autre membre ("Barbara a rangé", "les enfants ont aidé"), utilise cet ID.
3. Extrait les durées si mentionnées ("en 20 minutes", "pendant 1h") → en minutes.
4. Pour chaque complétion, donne un confidence score : 1.0 = match certain, 0.5 = incertain, 0.3 = très incertain.
5. Liste les items que tu ne peux PAS matcher (événements non liés à une tâche connue) dans unmatched.
6. Détecte l'émotion dominante : happy | tired | overwhelmed | satisfied | frustrated | neutral.
7. Génère une réponse de 1-2 phrases : empathique, factuelle, jamais de leçon de morale. Exemples :
   - "Bien joué 💪 J'ai noté tout ça. Demain tu as 3 tâches prévues."
   - "Bonne journée chargée, repose-toi bien. J'ai crédité Barbara pour la cuisine."
   - "Journée difficile ? Je décale 2 tâches au weekend, ça te soulagera."

## Format de réponse — STRICT JSON

\`\`\`json
{
  "completions": [
    {
      "task_id": "UUID-de-la-tâche",
      "task_name": "Nom lisible",
      "completed_by": "UUID-membre-ou-null",
      "completed_by_phantom_id": "UUID-phantom-ou-null",
      "duration_minutes": 30,
      "note": "optionnel, petite note extraite de la phrase",
      "confidence": 0.9
    }
  ],
  "unmatched": ["phrase non matchée 1", "phrase non matchée 2"],
  "ai_response": "Ta réponse empathique en 1-2 phrases",
  "mood_tone": "happy"
}
\`\`\`

Réponds UNIQUEMENT avec ce JSON, rien d'autre.`;

  // ─── Appel Claude Haiku ──────────────────────────────────────────────────
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({
      completions: [],
      unmatched: [text],
      ai_response: 'Le parser IA est désactivé. Vérifie la configuration.',
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[parse-journal] Claude error:', err);
      await logAiUsage(supabase as never, {
        userId: user.id, householdId, endpoint: 'parse-journal',
        tokensInput: 0, tokensOutput: 0, durationMs: Date.now() - startTime,
        status: 'error', errorMessage: err,
      });
      return NextResponse.json({ error: 'Erreur IA' }, { status: 502 });
    }

    const data = await response.json();
    const aiText = data.content?.[0]?.text ?? '{}';
    const usage = extractUsageFromResponse(data);

    // Extraire le JSON
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      await logAiUsage(supabase as never, {
        userId: user.id, householdId, endpoint: 'parse-journal',
        tokensInput: usage.tokensInput, tokensOutput: usage.tokensOutput,
        durationMs: Date.now() - startTime, status: 'error',
        errorMessage: 'No JSON in response',
      });
      return NextResponse.json({
        completions: [],
        unmatched: [text],
        ai_response: "J'ai eu un petit souci pour comprendre. Tu peux reformuler ?",
      });
    }

    let parsed: ParsedResult;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({
        completions: [],
        unmatched: [text],
        ai_response: "J'ai eu un souci de parsing. Réessaye dans une minute ?",
      });
    }

    const completions = Array.isArray(parsed.completions) ? parsed.completions : [];
    const unmatched = Array.isArray(parsed.unmatched) ? parsed.unmatched : [];

    // ─── Insertion en DB ────────────────────────────────────────────────────
    // 1. Créer l'entrée user_journal
    const { data: journalRow } = await supabase.from('user_journals').insert({
      user_id: user.id,
      household_id: householdId,
      raw_text: text,
      input_method: inputMethod,
      parsed_completions: completions,
      unmatched_items: unmatched,
      ai_response: parsed.ai_response ?? null,
      tokens_input: usage.tokensInput,
      tokens_output: usage.tokensOutput,
      cost_usd: 0, // rempli par aiLogger ci-dessous
      model_used: 'claude-haiku-4-5',
      processing_time_ms: Date.now() - startTime,
      mood_tone: parsed.mood_tone ?? null,
    }).select('id').single();

    // 2. Créer les task_completions
    for (const comp of completions) {
      if (!comp.task_id || comp.confidence < 0.3) continue; // Skip les matches trop incertains
      await supabase.from('task_completions').insert({
        task_id: comp.task_id,
        household_id: householdId,
        completed_by: comp.completed_by ?? user.id,
        completed_by_phantom_id: comp.completed_by_phantom_id ?? null,
        completed_at: new Date().toISOString(),
        duration_minutes: comp.duration_minutes,
        note: comp.note,
        completion_method: 'journal',
        source_text: text,
        confidence: comp.confidence,
        journal_id: journalRow?.id ?? null,
      });
    }

    // 3. Mettre à jour last_journal_at sur le profil
    await supabase.from('profiles').update({
      last_journal_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    }).eq('id', user.id);

    // 4. Log de l'usage IA (coût + agrégats)
    await logAiUsage(supabase as never, {
      userId: user.id, householdId, endpoint: 'parse-journal',
      tokensInput: usage.tokensInput, tokensOutput: usage.tokensOutput,
      durationMs: Date.now() - startTime, status: 'success',
      metadata: { completions_count: completions.length, unmatched_count: unmatched.length, mood: parsed.mood_tone },
    });

    return NextResponse.json({
      journalId: journalRow?.id,
      completions,
      unmatched,
      ai_response: parsed.ai_response ?? 'Bien joué. Tout noté.',
      mood_tone: parsed.mood_tone,
    });
  } catch (err) {
    console.error('[parse-journal] Error:', err);
    await logAiUsage(supabase as never, {
      userId: user.id, householdId, endpoint: 'parse-journal',
      tokensInput: 0, tokensOutput: 0, durationMs: Date.now() - startTime,
      status: 'error', errorMessage: err instanceof Error ? err.message : 'Unknown',
    });
    return NextResponse.json({
      completions: [],
      unmatched: [text],
      ai_response: "J'ai eu un souci technique. Réessaye dans une minute ?",
    }, { status: 500 });
  }
}
