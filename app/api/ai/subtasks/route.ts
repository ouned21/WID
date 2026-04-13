import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route : génération de sous-tâches par IA (Claude API)
 *
 * POST /api/ai/subtasks
 * Body: { taskName: string, dueDate?: string }
 * Response: { subtasks: { name: string, relativeDays: number, duration: string, category: string }[] }
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function POST(request: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'API key non configurée' }, { status: 500 });
  }

  const { taskName, dueDate } = await request.json();

  if (!taskName || typeof taskName !== 'string') {
    return NextResponse.json({ error: 'taskName requis' }, { status: 400 });
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
