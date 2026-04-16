import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge'; // 30s timeout sur Vercel Hobby (vs 10s serverless)

/**
 * API Route : génération de tâches ménagères IA lors de l'onboarding.
 * Appelle Claude Haiku via l'API REST Anthropic.
 * Edge runtime pour éviter le timeout 10s de Vercel Hobby.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

type FamilyMember = {
  type: string;
  name: string;
  birthdate?: string;
};

type RequestBody = {
  equipment: string[];        // noms d'équipements (déjà résolus côté client)
  family: FamilyMember[];
  equipmentNames?: string[];  // noms lisibles si fournis
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
    return NextResponse.json({ tasks: [] }, { status: 503 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ tasks: [] }, { status: 400 });
  }

  const { equipmentNames = [], family = [] } = body;

  const equipmentList = equipmentNames.length > 0
    ? equipmentNames.join(', ')
    : 'équipements standard (cuisine, salle de bain, salon)';

  const familyDescription = buildFamilyDescription(family);

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
- Fréquences réalistes (nettoyage four = quarterly, tondre pelouse ≠ daily)
- Tâches saisonnières en monthly/quarterly/semiannual
- Tâches enfants uniquement si enfants présents
- Tâches animaux uniquement si animaux présents
- Couvrir toutes les catégories pertinentes sans redondance`;

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
      console.error('[generate-tasks] Claude error:', response.status);
      return NextResponse.json({ tasks: [] });
    }

    const data = await response.json();
    const rawText: string = data.content?.[0]?.text ?? '[]';

    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let tasks: AiTask[] = [];
    try {
      const parsed = JSON.parse(cleaned);
      tasks = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.tasks) ? parsed.tasks : []);
    } catch {
      return NextResponse.json({ tasks: [] });
    }

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
    console.error('[generate-tasks] Error:', err);
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

  if (adults.length > 0) lines.push(`${adults.length} adulte${adults.length > 1 ? 's' : ''}`);
  if (teens.length > 0) lines.push(`${teens.length} adolescent${teens.length > 1 ? 's' : ''} (13-17 ans)`);
  if (children.length > 0) {
    const withAge = children.map((m) => {
      if (m.birthdate) {
        const age = Math.floor((Date.now() - new Date(m.birthdate).getTime()) / (365.25 * 24 * 3600 * 1000));
        return m.name ? `${m.name} (${age} ans)` : `${age} ans`;
      }
      return m.name || 'enfant';
    });
    lines.push(`${children.length} enfant${children.length > 1 ? 's' : ''} : ${withAge.join(', ')}`);
  }
  if (babies.length > 0) lines.push(`${babies.length} bébé${babies.length > 1 ? 's' : ''} (0-2 ans)`);
  if (pets.length > 0) lines.push(`${pets.length} animal${pets.length > 1 ? 'x' : ''}`);

  return lines.join('\n');
}
