import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * API Route : anticipation IA (premium)
 * Analyse le foyer et génère des rappels proactifs.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function POST(request: NextRequest) {
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ reminders: [] });

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { householdId } = await request.json();
  if (!householdId) return NextResponse.json({ error: 'householdId requis' }, { status: 400 });

  // Récupérer les tâches et complétions récentes
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const [tasks, completions] = await Promise.all([
    supabase.from('household_tasks')
      .select('id, name, frequency, next_due_at, scoring_category, custom_interval_days')
      .eq('household_id', householdId)
      .eq('is_active', true),
    supabase.from('task_completions')
      .select('task_id, completed_at')
      .eq('household_id', householdId)
      .gte('completed_at', threeMonthsAgo.toISOString())
      .order('completed_at', { ascending: false })
      .limit(500),
  ]);

  const tasksList = tasks.data ?? [];
  const completionsList = completions.data ?? [];

  // Identifier les patterns
  const now = new Date();
  const contextLines: string[] = [];

  // Tâches en retard
  const overdue = tasksList.filter(t => t.next_due_at && new Date(t.next_due_at) < now);
  if (overdue.length > 0) {
    contextLines.push(`TÂCHES EN RETARD (${overdue.length}): ${overdue.map(t => `${t.name} (retard ${Math.floor((now.getTime() - new Date(t.next_due_at!).getTime()) / 86400000)}j)`).join(', ')}`);
  }

  // Tâches prochaines (7 jours)
  const nextWeek = new Date(now.getTime() + 7 * 86400000);
  const upcoming = tasksList.filter(t => t.next_due_at && new Date(t.next_due_at) >= now && new Date(t.next_due_at) <= nextWeek);
  contextLines.push(`TÂCHES CETTE SEMAINE (${upcoming.length}): ${upcoming.map(t => t.name).join(', ')}`);

  // Tâches non faites depuis longtemps
  const taskLastDone = new Map<string, Date>();
  for (const c of completionsList) {
    if (!taskLastDone.has(c.task_id)) taskLastDone.set(c.task_id, new Date(c.completed_at));
  }

  const neglected = tasksList.filter(t => {
    if (t.frequency === 'once') return false;
    const lastDone = taskLastDone.get(t.id);
    if (!lastDone) return true; // jamais fait
    const daysSince = (now.getTime() - lastDone.getTime()) / 86400000;
    const expectedInterval = t.frequency === 'daily' ? 2 : t.frequency === 'weekly' ? 10 : t.frequency === 'monthly' ? 40 : 100;
    return daysSince > expectedInterval;
  });

  if (neglected.length > 0) {
    contextLines.push(`TÂCHES NÉGLIGÉES : ${neglected.map(t => `${t.name} (${t.frequency})`).join(', ')}`);
  }

  contextLines.push(`DATE AUJOURD'HUI : ${now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`);
  contextLines.push(`MOIS EN COURS : ${now.toLocaleDateString('fr-FR', { month: 'long' })}`);

  const prompt = `Tu es Aura, l'assistant proactif du foyer. Voici l'état du foyer :

${contextLines.join('\n')}

Génère 3-5 rappels proactifs et anticipations. Pense à :
- Les tâches en retard qui s'accumulent
- Les tâches saisonnières (vu le mois en cours)
- Les tâches négligées qui vont devenir urgentes
- Les rappels administratifs classiques (impôts, assurances, rentrée)

Format JSON :
{ "reminders": [ { "emoji": "...", "title": "max 50 chars", "body": "1-2 phrases", "urgency": "high" | "medium" | "low" } ] }

Réponds UNIQUEMENT en JSON valide.`;

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

    if (!response.ok) return NextResponse.json({ reminders: [] });

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '{"reminders":[]}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ reminders: [] });

    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch {
    return NextResponse.json({ reminders: [] });
  }
}
