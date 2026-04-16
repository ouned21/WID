import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logAiUsage, extractUsageFromResponse } from '@/utils/aiLogger';

export const maxDuration = 60; // secondes (Vercel Pro/Hobby étendu)

/**
 * API Route : génération de tâches ménagères IA lors de l'onboarding.
 * Appelle Claude Haiku via l'API REST Anthropic.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

type FamilyMember = {
  type: string;
  name: string;
  birthdate?: string;
};

type RequestBody = {
  equipment: string[];   // UUIDs d'équipements
  family: FamilyMember[];
};

export type AiTask = {
  name: string;
  scoring_category: string;
  frequency: string;
  duration_estimate: string;
  physical_effort: string;
  mental_load_score: number;
  description?: string;
};

export async function POST(request: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Service IA non configuré' },
      { status: 503 },
    );
  }

  // Auth check
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

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const { equipment: equipmentIds, family } = body;

  if (!Array.isArray(equipmentIds)) {
    return NextResponse.json({ error: 'equipment doit être un tableau' }, { status: 400 });
  }

  // Résoudre les UUIDs d'équipements en noms lisibles
  let equipmentNames: string[] = [];
  if (equipmentIds.length > 0) {
    const { data: equipRows } = await supabase
      .from('onboarding_equipment')
      .select('id, name')
      .in('id', equipmentIds);
    equipmentNames = (equipRows ?? []).map((e: { id: string; name: string }) => e.name);
  }

  // Construire la description du foyer pour le prompt
  const equipmentList = equipmentNames.length > 0
    ? equipmentNames.join(', ')
    : 'équipements standard (cuisine, salle de bain, salon)';

  const familyDescription = buildFamilyDescription(family ?? []);

  const systemPrompt = `Tu es un expert en organisation domestique francophone.
Tu réponds UNIQUEMENT en JSON valide, sans texte avant ni après, sans backticks markdown.
Le JSON doit être un tableau d'objets directement, sans clé racine.`;

  const userPrompt = `Génère entre 15 et 25 tâches ménagères récurrentes adaptées à ce foyer.

## Équipements du foyer
${equipmentList}

## Composition du foyer
${familyDescription}

## Format strict de chaque tâche
{
  "name": "Nom court en français (max 60 caractères)",
  "scoring_category": "une valeur parmi : cleaning, tidying, shopping, laundry, children, meals, admin, outdoor, hygiene, pets, vehicle, household_management, transport",
  "frequency": "une valeur parmi : daily, weekly, biweekly, monthly, quarterly, semiannual, yearly",
  "duration_estimate": "une valeur parmi : very_short, short, medium, long, very_long",
  "physical_effort": "une valeur parmi : none, light, medium, high",
  "mental_load_score": "entier de 1 à 7",
  "description": "Courte précision optionnelle (max 80 caractères)"
}

## Règles importantes
- Aucun doublon de nom
- Fréquences réalistes : le nettoyage du four ne se fait pas en weekly, tondre la pelouse ne se fait pas en daily
- N'inclure les tâches liées aux équipements que si l'équipement est présent (ex: entretien voiture uniquement si voiture présente)
- N'inclure les tâches enfants/bébé que si des enfants/bébés sont présents dans le foyer
- N'inclure les tâches animaux que si des animaux sont présents
- Les tâches saisonnières (jardinage intense, préparation hiver) doivent être en monthly, quarterly ou semiannual
- Couvrir toutes les catégories pertinentes pour ce foyer
- Viser l'exhaustivité sans redondance`;

  const startTime = Date.now();
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
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[onboarding/generate-tasks] Claude API error:', err);
      await logAiUsage(supabase as never, {
        userId: user.id,
        endpoint: 'onboarding-generate-tasks',
        tokensInput: 0,
        tokensOutput: 0,
        durationMs: Date.now() - startTime,
        status: 'error',
        errorMessage: err,
      });
      return NextResponse.json({ error: 'Erreur IA', tasks: [] }, { status: 502 });
    }

    const data = await response.json();
    const rawText: string = data.content?.[0]?.text ?? '[]';
    const usage = extractUsageFromResponse(data);

    await logAiUsage(supabase as never, {
      userId: user.id,
      endpoint: 'onboarding-generate-tasks',
      tokensInput: usage.tokensInput,
      tokensOutput: usage.tokensOutput,
      durationMs: Date.now() - startTime,
      status: 'success',
      metadata: { equipmentCount: equipmentIds.length, familyCount: family?.length ?? 0 },
    });

    // Stripper les éventuels backticks markdown
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let tasks: AiTask[] = [];
    try {
      const parsed = JSON.parse(cleaned);
      // Accepter un tableau direct ou { tasks: [...] }
      if (Array.isArray(parsed)) {
        tasks = parsed;
      } else if (Array.isArray(parsed?.tasks)) {
        tasks = parsed.tasks;
      }
    } catch (parseErr) {
      console.error('[onboarding/generate-tasks] JSON parse error:', parseErr, '\nRaw:', cleaned.slice(0, 500));
      return NextResponse.json({ tasks: [] });
    }

    // Valider et assainir chaque tâche
    const validCategories = new Set([
      'cleaning', 'tidying', 'shopping', 'laundry', 'children', 'meals',
      'admin', 'outdoor', 'hygiene', 'pets', 'vehicle', 'household_management', 'transport',
    ]);
    const validFrequencies = new Set(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'yearly']);
    const validDurations = new Set(['very_short', 'short', 'medium', 'long', 'very_long']);
    const validEfforts = new Set(['none', 'light', 'medium', 'high']);

    const sanitized: AiTask[] = tasks
      .filter((t): t is AiTask => t !== null && typeof t === 'object')
      .map((t) => ({
        name: String(t.name ?? '').slice(0, 60),
        scoring_category: validCategories.has(t.scoring_category) ? t.scoring_category : 'cleaning',
        frequency: validFrequencies.has(t.frequency) ? t.frequency : 'weekly',
        duration_estimate: validDurations.has(t.duration_estimate) ? t.duration_estimate : 'medium',
        physical_effort: validEfforts.has(t.physical_effort) ? t.physical_effort : 'medium',
        mental_load_score: Math.min(7, Math.max(1, Number(t.mental_load_score) || 3)),
        description: t.description ? String(t.description).slice(0, 80) : undefined,
      }))
      .filter((t) => t.name.length > 0);

    return NextResponse.json({ tasks: sanitized });
  } catch (err) {
    console.error('[onboarding/generate-tasks] Error:', err);
    await logAiUsage(supabase as never, {
      userId: user.id,
      endpoint: 'onboarding-generate-tasks',
      tokensInput: 0,
      tokensOutput: 0,
      durationMs: Date.now() - startTime,
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Unknown',
    });
    return NextResponse.json({ tasks: [] });
  }
}

function buildFamilyDescription(family: FamilyMember[]): string {
  if (family.length === 0) return 'Foyer solo (une seule personne adulte)';

  const lines: string[] = [];
  const adults = family.filter((m) => m.type === 'adult');
  const teens = family.filter((m) => m.type === 'teen');
  const children = family.filter((m) => m.type === 'child');
  const babies = family.filter((m) => m.type === 'baby');
  const pets = family.filter((m) => m.type === 'pet');

  if (adults.length > 0) {
    lines.push(`${adults.length} adulte${adults.length > 1 ? 's' : ''}`);
  }
  if (teens.length > 0) {
    const names = teens.filter((m) => m.name).map((m) => m.name).join(', ');
    lines.push(`${teens.length} adolescent${teens.length > 1 ? 's' : ''} (13-17 ans)${names ? ` : ${names}` : ''}`);
  }
  if (children.length > 0) {
    const withAge = children.map((m) => {
      if (m.birthdate) {
        const age = Math.floor((Date.now() - new Date(m.birthdate).getTime()) / (365.25 * 24 * 3600 * 1000));
        return m.name ? `${m.name} (${age} ans)` : `${age} ans`;
      }
      return m.name || 'enfant';
    });
    lines.push(`${children.length} enfant${children.length > 1 ? 's' : ''} (3-12 ans) : ${withAge.join(', ')}`);
  }
  if (babies.length > 0) {
    const withAge = babies.map((m) => {
      if (m.birthdate) {
        const ageMonths = Math.floor((Date.now() - new Date(m.birthdate).getTime()) / (30.44 * 24 * 3600 * 1000));
        return m.name ? `${m.name} (${ageMonths} mois)` : `${ageMonths} mois`;
      }
      return m.name || 'bébé';
    });
    lines.push(`${babies.length} bébé${babies.length > 1 ? 's' : ''} (0-2 ans) : ${withAge.join(', ')}`);
  }
  if (pets.length > 0) {
    const names = pets.filter((m) => m.name).map((m) => m.name).join(', ');
    lines.push(`${pets.length} animal${pets.length > 1 ? 'x' : ''}${names ? ` : ${names}` : ''}`);
  }

  return lines.join('\n');
}
