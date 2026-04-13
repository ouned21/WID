import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * API Route : génération de sous-tâches par IA (Claude API)
 * Authentifiée, rate-limitée (simple), input validé.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Rate limit simple en mémoire (par userId, max 10 appels par minute)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ subtasks: [] }); // Dégradation gracieuse, pas d'erreur 500
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

  // Rate limiting (10 appels/minute par user)
  const now = Date.now();
  const userLimit = rateLimitMap.get(user.id);
  if (userLimit && userLimit.resetAt > now && userLimit.count >= 10) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 });
  }
  if (!userLimit || userLimit.resetAt <= now) {
    rateLimitMap.set(user.id, { count: 1, resetAt: now + 60000 });
  } else {
    userLimit.count++;
  }

  let body: { taskName?: unknown; dueDate?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const { taskName, dueDate } = body;

  if (!taskName || typeof taskName !== 'string' || taskName.length > 200) {
    return NextResponse.json({ error: 'taskName requis (max 200 chars)' }, { status: 400 });
  }

  const prompt = `Tu es un assistant de gestion de foyer. L'utilisateur crée la tâche "${taskName}"${dueDate ? ` prévue le ${dueDate}` : ''}.

Génère 3 à 8 sous-tâches associées qui doivent être faites avant, pendant ou après cette tâche principale.

Pour chaque sous-tâche, donne :
- name : nom court en français (max 50 caractères)
- relativeDays : jours par rapport à la tâche principale (négatif = avant, 0 = le jour même, positif = après)
- duration : estimation parmi "very_short", "short", "medium", "long", "very_long"
- category : catégorie parmi "cleaning", "tidying", "shopping", "laundry", "meals", "children", "admin", "transport", "household_management", "outdoor", "hygiene", "pets", "vehicle", "misc"

Réponds UNIQUEMENT en JSON valide, format :
{ "subtasks": [ { "name": "...", "relativeDays": 0, "duration": "short", "category": "misc" } ] }

Si la tâche ne nécessite pas de sous-tâches (tâche simple comme "passer l'aspirateur"), réponds :
{ "subtasks": [] }`;

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
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[ai/subtasks] Claude API error:', err);
      return NextResponse.json({ error: 'Erreur IA' }, { status: 502 });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '{"subtasks":[]}';

    // Extraire le JSON de la réponse
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ subtasks: [] });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[ai/subtasks] Error:', err);
    return NextResponse.json({ subtasks: [] });
  }
}
