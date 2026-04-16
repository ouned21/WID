import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { checkAndIncrementAiUsage } from '@/utils/aiRateLimit';
import { getHouseholdPreferences, formatHouseholdPreferencesForPrompt } from '@/utils/userPreferences';
import { logAiUsage, extractUsageFromResponse } from '@/utils/aiLogger';

/**
 * API Route : parse-journal
 *
 * Prend une phrase en langage naturel et :
 * 1. Matche les actions aux tâches existantes → task_completions
 * 2. Pour les actions sans tâche correspondante → crée la tâche automatiquement + completion
 * 3. Seuls les événements non-tâches (films, émotions...) restent dans "unmatched"
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Map scoring_category → category_name pour trouver le bon category_id en DB
const CATEGORY_NAME_MAP: Record<string, string> = {
  cleaning: 'Nettoyage',
  tidying: 'Rangement',
  shopping: 'Courses',
  laundry: 'Linge',
  meals: 'Repas',
  children: 'Enfants',
  admin: 'Administratif',
  transport: 'Transport',
  household_management: 'Gestion du foyer',
  outdoor: 'Extérieur',
  hygiene: 'Hygiène',
  pets: 'Animaux',
  vehicle: 'Véhicule',
  misc: 'Divers',
};

const FREQUENCY_NEXT_DUE: Record<string, number> = {
  daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 90, once: 365,
};

/**
 * Sanitise le texte utilisateur pour prévenir les tentatives d'injection de prompt.
 * Remplace les patterns courants d'injection par [filtré] et tronque à 2000 chars.
 */
function sanitizeUserInput(input: string): string {
  return input
    // Supprimer les tentatives de prompt injection courantes
    .replace(/ignore\s+(previous|all|prior)\s+instructions?/gi, '[filtré]')
    .replace(/forget\s+(everything|all|what|your)/gi, '[filtré]')
    .replace(/you\s+are\s+now\s+/gi, '[filtré]')
    .replace(/pretend\s+(you\s+are|to\s+be)/gi, '[filtré]')
    .replace(/act\s+as\s+(a|an|if)/gi, '[filtré]')
    .replace(/system\s*:/gi, '[filtré]')
    .replace(/\[system\]/gi, '[filtré]')
    // Limite la longueur (déjà validé mais double sécurité)
    .slice(0, 2000)
    .trim();
}

function normalizeTaskName(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function isSimilarTask(a: string, b: string): boolean {
  const na = normalizeTaskName(a);
  const nb = normalizeTaskName(b);
  if (na === nb) return true;
  // Vérifie si les 3 premiers mots significatifs sont communs
  const wordsA = na.split(' ').filter(w => w.length > 3);
  const wordsB = nb.split(' ').filter(w => w.length > 3);
  const common = wordsA.filter(w => wordsB.includes(w));
  return common.length >= 2;
}

type ParsedCompletion = {
  task_id: string;
  task_name: string;
  completed_by: string | null;
  completed_by_phantom_id: string | null;
  duration_minutes: number | null;
  note: string | null;
  confidence: number;
};

type AutoCreateItem = {
  name: string;
  category: string;       // scoring_category : meals, cleaning, etc.
  frequency: string;      // daily, weekly, etc.
  duration: string;       // very_short, short, medium, long, very_long
  physical: string;       // none, light, medium, high
  completed_by: string | null;
  completed_by_phantom_id: string | null;
  duration_minutes: number | null;
  note: string | null;
};

type ParsedResult = {
  completions: ParsedCompletion[];
  auto_create: AutoCreateItem[];
  unmatched: string[];
  ai_response: string;
  mood_tone: string | null;
};

/**
 * POST /api/ai/parse-journal
 *
 * Analyse un texte libre (journal de journée) en langage naturel et en extrait
 * les tâches ménagères accomplies. Crée automatiquement les tâches inconnues et
 * insère les complétions en base.
 *
 * @requires auth Session Supabase valide + consentement RGPD (`ai_journal_consent_at`)
 * @requires rate-limit Quota mensuel IA (freemium : 5 appels/mois)
 *
 * @param body.text       - Texte du journal (3–2000 caractères)
 * @param body.inputMethod - "text" | "voice" (facultatif, défaut "text")
 *
 * @returns {200} {
 *   journalId: string,
 *   completions: ParsedCompletion[],    // tâches existantes matchées
 *   auto_created: { name, task_id }[],  // nouvelles tâches créées + complétées
 *   unmatched: string[],                // éléments non-tâches (émotions, loisirs)
 *   ai_response: string,                // message empathique de Yova
 *   mood_tone: string | null            // humeur détectée
 * }
 * @returns {400} Texte invalide ou foyer manquant
 * @returns {401} Non authentifié
 * @returns {403} Consentement RGPD manquant ou compte non premium
 * @returns {429} Limite IA mensuelle atteinte
 * @returns {500} Erreur technique
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const rate = await checkAndIncrementAiUsage(supabase, user.id);
  if (!rate.allowed) {
    await logAiUsage(supabase as never, {
      userId: user.id, endpoint: 'parse-journal', tokensInput: 0, tokensOutput: 0,
      durationMs: Date.now() - startTime, status: 'rate_limited',
    });
    return NextResponse.json({
      error: 'Limite IA atteinte', code: 'AI_LIMIT_REACHED',
      message: 'Tu as atteint ta limite mensuelle. Passe en Premium pour un journal illimité.',
      remaining: rate.remaining,
    }, { status: 429 });
  }

  let body: { text?: unknown; inputMethod?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const inputMethod: 'text' | 'voice' = body.inputMethod === 'voice' ? 'voice' : 'text';
  if (!text || text.length < 3 || text.length > 2000) {
    return NextResponse.json({ error: 'Texte requis (3 à 2000 caractères)' }, { status: 400 });
  }
  // Sanitiser le texte avant toute injection dans un prompt Claude
  const sanitizedText = sanitizeUserInput(text);

  const { data: profile } = await supabase
    .from('profiles').select('household_id, display_name, ai_journal_consent_at').eq('id', user.id).maybeSingle();

  // Vérification du consentement RGPD (Art. 6 & 7 RGPD)
  // L'utilisateur doit avoir explicitement accepté que ses entrées de journal
  // soient envoyées à l'API Anthropic (hébergée aux États-Unis).
  if (!profile?.ai_journal_consent_at) {
    return NextResponse.json({
      error: 'Consentement requis',
      code: 'CONSENT_REQUIRED',
      message: 'Tu dois accepter que tes données soient traitées par Yova avant de pouvoir utiliser le journal IA.',
    }, { status: 403 });
  }
  if (!profile?.household_id) return NextResponse.json({ error: 'Pas de foyer associé' }, { status: 400 });

  const householdId = profile.household_id;

  const [tasksRes, membersRes, phantomsRes, categoriesRes] = await Promise.all([
    supabase.from('household_tasks')
      .select('id, name, scoring_category, frequency, duration_estimate')
      .eq('household_id', householdId).eq('is_active', true),
    supabase.from('profiles').select('id, display_name').eq('household_id', householdId),
    supabase.from('phantom_members').select('id, display_name').eq('household_id', householdId),
    supabase.from('task_categories').select('id, name'),
  ]);

  const tasks = tasksRes.data ?? [];
  const members = membersRes.data ?? [];
  const phantoms = phantomsRes.data ?? [];
  const categories = categoriesRes.data ?? [];

  // Map category name → id pour créer des tâches
  const categoryIdMap = new Map<string, string>();
  for (const cat of categories) {
    categoryIdMap.set(cat.name.toLowerCase(), cat.id);
  }
  // Fallback : première catégorie disponible
  const fallbackCategoryId = categories[0]?.id ?? '';

  function getCategoryId(scoringCategory: string): string {
    const targetName = CATEGORY_NAME_MAP[scoringCategory]?.toLowerCase() ?? '';
    return categoryIdMap.get(targetName) ?? fallbackCategoryId;
  }

  const memberNames = new Map<string, string>();
  for (const m of members) memberNames.set(m.id, m.display_name);
  const memberIds = members.map((m: { id: string }) => m.id);
  const householdPrefs = await getHouseholdPreferences(supabase as unknown as never, memberIds);
  const prefsBlock = formatHouseholdPreferencesForPrompt(householdPrefs, memberNames);

  const userName = profile.display_name ?? 'l\'utilisateur';

  const tasksListBlock = tasks.length > 0
    ? tasks.map((t: { id: string; name: string; scoring_category: string | null }) =>
        `- [${t.id}] "${t.name}"${t.scoring_category ? ` (${t.scoring_category})` : ''}`
      ).join('\n')
    : '(aucune tâche encore — crée tout en auto_create)';

  const membersBlock = [
    ...members.map((m: { id: string; display_name: string }) => `- [${m.id}] ${m.display_name} (membre)`),
    ...phantoms.map((p: { id: string; display_name: string }) => `- [phantom:${p.id}] ${p.display_name} (fantôme)`),
  ].join('\n');

  const prompt = `Tu es Yova, l'assistant IA spécialisé UNIQUEMENT dans le suivi des tâches ménagères et familiales d'un foyer. Tu ne réponds à RIEN d'autre. Si le message ne contient aucune tâche du foyer et ressemble à une question générale, un conseil de vie, une recette, ou tout sujet hors-foyer → retourne un JSON avec completions et auto_create vides, et dans ai_response dis : "Je suis Yova, spécialisée dans le suivi de ton foyer 🏠 Raconte-moi ce que tu as fait à la maison aujourd'hui !"

${userName} vient de te raconter sa journée. Ton job : extraire TOUTES les tâches ménagères/familiales mentionnées et les enregistrer.

## Tâches existantes du foyer (ID entre crochets)
${tasksListBlock}

## Membres
${membersBlock}
${prefsBlock}

## Ce que ${userName} raconte
"""
${sanitizedText}
"""

## Ta mission

1. Pour chaque action → essaie de matcher une tâche existante (sémantique, pas juste mots-clés).
2. Si une action ne correspond à AUCUNE tâche existante ET que c'est une vraie tâche récurrente du foyer (pas "j'ai regardé un film", "j'ai dormi", "je me suis levé") → mets-la dans "auto_create".
3. Dans "unmatched", mets UNIQUEMENT les choses qui ne sont PAS des tâches ménagères (émotions, événements ponctuels, activités de loisir).
4. Identifie QUI a fait chaque tâche (par défaut = ${userName}).
5. Extrait les durées si mentionnées.
6. Confidence : 1.0 = certain, 0.5 = probable, 0.3 = incertain.
7. Détecte le mood : happy | tired | overwhelmed | satisfied | frustrated | neutral.
8. Réponse empathique 1-2 phrases. Si des tâches ont été créées automatiquement, mentionne-le.

## Format JSON STRICT

\`\`\`json
{
  "completions": [
    {
      "task_id": "UUID-existant",
      "task_name": "Nom lisible",
      "completed_by": "UUID-membre-ou-null",
      "completed_by_phantom_id": "UUID-phantom-ou-null",
      "duration_minutes": 30,
      "note": null,
      "confidence": 0.9
    }
  ],
  "auto_create": [
    {
      "name": "Préparer le petit déjeuner",
      "category": "meals",
      "frequency": "daily",
      "duration": "short",
      "physical": "light",
      "completed_by": "UUID-membre-ou-null",
      "completed_by_phantom_id": null,
      "duration_minutes": null,
      "note": null
    }
  ],
  "unmatched": ["j'ai regardé un film"],
  "ai_response": "Belle journée bien remplie 💪 J'ai tout noté et créé 2 nouvelles tâches.",
  "mood_tone": "satisfied"
}
\`\`\`

Catégories : cleaning, tidying, shopping, laundry, meals, children, admin, transport, household_management, outdoor, hygiene, pets, vehicle, misc
Fréquences : daily, weekly, biweekly, monthly, once
Durées : very_short, short, medium, long, very_long
Physical : none, light, medium, high

Réponds UNIQUEMENT avec ce JSON.`;

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({
      completions: [], auto_created: [], unmatched: [text],
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

    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({
        completions: [], auto_created: [], unmatched: [text],
        ai_response: "J'ai eu un petit souci pour comprendre. Tu peux reformuler ?",
      });
    }

    let parsed: ParsedResult;
    try { parsed = JSON.parse(jsonMatch[0]); }
    catch {
      return NextResponse.json({
        completions: [], auto_created: [], unmatched: [text],
        ai_response: "J'ai eu un souci de parsing. Réessaye dans une minute ?",
      });
    }

    const completions = Array.isArray(parsed.completions) ? parsed.completions : [];
    const autoCreateItems = Array.isArray(parsed.auto_create) ? parsed.auto_create : [];
    const unmatched = Array.isArray(parsed.unmatched) ? parsed.unmatched : [];

    // ─── Créer le journal ──────────────────────────────────────────────────
    const { data: journalRow } = await supabase.from('user_journals').insert({
      user_id: user.id, household_id: householdId, raw_text: text, input_method: inputMethod,
      parsed_completions: completions, unmatched_items: unmatched,
      ai_response: parsed.ai_response ?? null,
      tokens_input: usage.tokensInput, tokens_output: usage.tokensOutput, cost_usd: 0,
      model_used: 'claude-haiku-4-5', processing_time_ms: Date.now() - startTime,
      mood_tone: parsed.mood_tone ?? null,
    }).select('id').single();

    // ─── Insérer les complétions sur tâches existantes ────────────────────
    for (const comp of completions) {
      if (!comp.task_id || comp.confidence < 0.3) continue;
      await supabase.from('task_completions').insert({
        task_id: comp.task_id, household_id: householdId,
        completed_by: comp.completed_by ?? user.id,
        completed_by_phantom_id: comp.completed_by_phantom_id ?? null,
        completed_at: new Date().toISOString(),
        duration_minutes: comp.duration_minutes, note: comp.note,
        completion_method: 'journal', source_text: text,
        confidence: comp.confidence, journal_id: journalRow?.id ?? null,
      });
    }

    // ─── Auto-créer les nouvelles tâches + complétion immédiate ──────────
    const autoCreated: { name: string; task_id: string }[] = [];

    for (const item of autoCreateItems) {
      if (!item.name || item.name.length < 2) continue;

      // Déduplication : vérifie si une tâche similaire existe déjà
      const alreadyExists = tasks.some(t => isSimilarTask(t.name, item.name));
      if (alreadyExists) {
        // Retrouver la tâche existante et créer la complétion dessus
        const existingTask = tasks.find(t => isSimilarTask(t.name, item.name));
        if (existingTask) {
          await supabase.from('task_completions').insert({
            task_id: existingTask.id, household_id: householdId,
            completed_by: item.completed_by ?? user.id,
            completed_by_phantom_id: item.completed_by_phantom_id ?? null,
            completed_at: new Date().toISOString(),
            duration_minutes: item.duration_minutes, note: item.note,
            completion_method: 'journal', source_text: text,
            confidence: 0.8, journal_id: journalRow?.id ?? null,
          });
          autoCreated.push({ name: existingTask.name, task_id: existingTask.id });
        }
        continue;
      }

      // Créer la nouvelle tâche
      const categoryId = getCategoryId(item.category);
      const daysUntilDue = FREQUENCY_NEXT_DUE[item.frequency] ?? 7;
      const nextDueAt = new Date(Date.now() + daysUntilDue * 86400000).toISOString();

      const { data: newTask } = await supabase.from('household_tasks').insert({
        household_id: householdId,
        name: item.name,
        category_id: categoryId,
        frequency: item.frequency as never,
        mental_load_score: 2,
        scoring_category: item.category,
        duration_estimate: item.duration,
        physical_effort: item.physical ?? 'light',
        assigned_to: item.completed_by ?? user.id,
        is_active: true,
        is_fixed_assignment: false,
        notifications_enabled: true,
        created_by: user.id,
        next_due_at: nextDueAt,
      }).select('id').single();

      if (!newTask?.id) continue;

      // Créer la complétion immédiatement
      await supabase.from('task_completions').insert({
        task_id: newTask.id, household_id: householdId,
        completed_by: item.completed_by ?? user.id,
        completed_by_phantom_id: item.completed_by_phantom_id ?? null,
        completed_at: new Date().toISOString(),
        duration_minutes: item.duration_minutes, note: item.note,
        completion_method: 'journal', source_text: text,
        confidence: 0.95, journal_id: journalRow?.id ?? null,
      });

      autoCreated.push({ name: item.name, task_id: newTask.id });
    }

    // ─── Profil + log ─────────────────────────────────────────────────────
    await supabase.from('profiles').update({
      last_journal_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    }).eq('id', user.id);

    await logAiUsage(supabase as never, {
      userId: user.id, householdId, endpoint: 'parse-journal',
      tokensInput: usage.tokensInput, tokensOutput: usage.tokensOutput,
      durationMs: Date.now() - startTime, status: 'success',
      metadata: {
        completions_count: completions.length,
        auto_created_count: autoCreated.length,
        unmatched_count: unmatched.length,
        mood: parsed.mood_tone,
      },
    });

    return NextResponse.json({
      journalId: journalRow?.id,
      completions,
      auto_created: autoCreated,
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
      completions: [], auto_created: [], unmatched: [text],
      ai_response: "J'ai eu un souci technique. Réessaye dans une minute ?",
    }, { status: 500 });
  }
}
