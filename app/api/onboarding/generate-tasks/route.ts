/**
 * API Route : /api/onboarding/generate-tasks
 *
 * Prend le contexte collecté pendant la conversation d'onboarding
 * et demande à Claude de générer des tâches personnalisées et calibrées.
 *
 * Retourne :
 * - tasks[]        → tâches à insérer dans household_tasks
 * - children[]     → membres à créer dans phantom_members
 * - householdMeta  → energy_level + external_help pour household_profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// UUIDs fixes des catégories (cohérents avec onboarding existant)
const CATEGORY_IDS: Record<string, string> = {
  cleaning:             '11111111-1111-1111-1111-111111111111',
  tidying:              '22222222-2222-2222-2222-222222222222',
  shopping:             '33333333-3333-3333-3333-333333333333',
  laundry:              '44444444-4444-4444-4444-444444444444',
  children:             '55555555-5555-5555-5555-555555555555',
  meals:                '66666666-6666-6666-6666-666666666666',
  admin:                '77777777-7777-7777-7777-777777777777',
  outdoor:              '88888888-8888-8888-8888-888888888888',
  hygiene:              '99999999-9999-9999-9999-999999999999',
  pets:                 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  vehicle:              'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  household_management: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
};
const DEFAULT_CAT_ID = '11111111-1111-1111-1111-111111111111';

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function nextDueISO(daysFromNow: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await req.json() as {
    householdSize: number;
    childrenRaw: string;           // "Léa 7 ans, Tom 4 ans"
    constraints: string;
    hasExternalHelp: boolean;
    externalHelpRaw: string;
    equipment: string[];           // ["lave-linge", "lave-vaisselle", ...]
    energyLevel: 'low' | 'medium' | 'high';
    groceriesDone: 'done' | 'todo' | 'delivery';
    laundryDone: 'done' | 'todo';
    dinnerPlanned: 'yes' | 'no';
  };

  // ── Calibrage des dates selon état actuel ──────────────────────────────────
  // Ces valeurs sont passées au prompt pour que Claude les utilise
  const calibration = {
    groceries: body.groceriesDone === 'done' ? 5 : body.groceriesDone === 'delivery' ? 7 : 0,
    laundry:   body.laundryDone === 'done' ? 4 : 0,
    dinner:    body.dinnerPlanned === 'yes' ? 1 : 0,
    energy:    body.energyLevel,
  };

  const todayISO = nextDueISO(0);
  const prompt = `Tu es Yova, assistant foyer. Tu dois générer une liste de tâches ménagères personnalisées pour ce foyer.

CONTEXTE DU FOYER :
- Nombre de personnes : ${body.householdSize}
- Enfants : ${body.childrenRaw || 'aucun'}
- Contraintes/allergies : ${body.constraints || 'aucune'}
- Aide extérieure : ${body.hasExternalHelp ? body.externalHelpRaw : 'aucune'}
- Équipements disponibles : ${body.equipment.join(', ') || 'standard'}
- Niveau d'énergie actuel du foyer : ${body.energyLevel} (low=épuisé, medium=normal, high=en forme)

ÉTAT ACTUEL (pour calibrer next_due_at) :
- Courses : ${body.groceriesDone === 'done' ? 'faites récemment → prochaine dans ~5 jours' : body.groceriesDone === 'delivery' ? 'livraison habituelle → prochaine dans ~7 jours' : 'à faire → aujourd\'hui ou demain'}
- Lessive : ${body.laundryDone === 'done' ? 'faite récemment → prochaine dans ~4 jours' : 'à lancer → aujourd\'hui'}
- Dîner ce soir : ${body.dinnerPlanned === 'yes' ? 'prévu → prochaine tâche repas demain' : 'non prévu → aujourd\'hui'}

Date actuelle : ${todayISO}

RÈGLES DE GÉNÉRATION :
1. Génère 12 à 18 tâches adaptées à CE foyer (pas générique)
2. N'inclus PAS les tâches couvertes par l'aide extérieure
3. N'inclus PAS les tâches liées à des équipements absents
4. Si enfants présents : inclus les tâches enfants (bain, devoirs, activités)
5. Si animal présent : inclus les tâches animal
6. Si jardin/extérieur : inclus entretien extérieur
7. Si énergie=low : réduis le périmètre aux tâches vitales seulement (cuisine, linge, enfants)
8. Calibre next_due_at selon l'état actuel (voir ci-dessus)

CATÉGORIES DISPONIBLES (utilise exactement ces clés) :
cleaning, tidying, shopping, laundry, children, meals, admin, outdoor, hygiene, pets, vehicle, household_management

FRÉQUENCES DISPONIBLES : daily, every_other_day, twice_weekly, weekly, biweekly, monthly, quarterly, yearly

DURÉES : very_short (5min), short (15min), medium (30min), long (1h), very_long (2h+)

RÉPONDS UNIQUEMENT avec ce JSON (rien d'autre) :
{
  "tasks": [
    {
      "name": "string (nom court, action claire, en français)",
      "category": "cleaning|tidying|shopping|laundry|children|meals|admin|outdoor|hygiene|pets|vehicle|household_management",
      "frequency": "daily|every_other_day|twice_weekly|weekly|biweekly|monthly|quarterly|yearly",
      "duration_estimate": "very_short|short|medium|long|very_long",
      "physical_effort": "none|light|medium|high",
      "mental_load_score": 1-5,
      "next_due_at": "ISO8601 datetime"
    }
  ],
  "children": [
    {
      "name": "string",
      "age": number,
      "school_class": "string ou null"
    }
  ],
  "householdMeta": {
    "energy_level": "low|medium|high",
    "has_external_help": boolean,
    "external_help_description": "string ou null"
  }
}`;

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY manquante' }, { status: 500 });
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
        model: 'claude-haiku-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[generate-tasks] Claude error:', err);
      return NextResponse.json({ error: 'Erreur IA', fallback: true }, { status: 502 });
    }

    const data = await response.json();
    const aiText: string = data.content?.[0]?.text ?? '{}';

    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[generate-tasks] No JSON in response:', aiText);
      return NextResponse.json({ error: 'Réponse IA invalide', fallback: true }, { status: 502 });
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      tasks: {
        name: string;
        category: string;
        frequency: string;
        duration_estimate: string;
        physical_effort: string;
        mental_load_score: number;
        next_due_at: string;
      }[];
      children: { name: string; age: number; school_class: string | null }[];
      householdMeta: {
        energy_level: 'low' | 'medium' | 'high';
        has_external_help: boolean;
        external_help_description: string | null;
      };
    };

    // Convertir en format attendu par /api/onboarding/create-tasks
    const taskRows = (parsed.tasks ?? []).map((t) => ({
      name: t.name,
      category_id: CATEGORY_IDS[t.category] ?? DEFAULT_CAT_ID,
      frequency: t.frequency || 'weekly',
      duration_estimate: t.duration_estimate || 'short',
      physical_effort: t.physical_effort || 'medium',
      mental_load_score: Math.min(5, Math.max(1, t.mental_load_score ?? 3)),
      scoring_category: t.category || 'cleaning',
      is_active: true,
      is_fixed_assignment: false,
      notifications_enabled: true,
      assigned_to: null,
      next_due_at: t.next_due_at || nextDueISO(0),
    }));

    const children = parsed.children ?? [];
    const householdMeta = parsed.householdMeta ?? {
      energy_level: body.energyLevel,
      has_external_help: body.hasExternalHelp,
      external_help_description: body.externalHelpRaw || null,
    };

    return NextResponse.json({ taskRows, children, householdMeta, calibration });

  } catch (err) {
    console.error('[generate-tasks] Exception:', err);
    return NextResponse.json({ error: 'Erreur serveur', fallback: true }, { status: 500 });
  }
}
