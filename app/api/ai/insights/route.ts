import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * API Route : insights IA (premium)
 * Analyse les patterns de complétion et génère des observations.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function POST(request: NextRequest) {
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ insights: [] });

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

  // 8 semaines de données
  const since = new Date();
  since.setDate(since.getDate() - 56);

  const [completions, members, tasks] = await Promise.all([
    supabase.from('task_completions')
      .select('completed_by, completed_by_phantom_id, task_id, completed_at')
      .eq('household_id', householdId)
      .gte('completed_at', since.toISOString()),
    supabase.from('profiles')
      .select('id, display_name, target_share_percent')
      .eq('household_id', householdId),
    supabase.from('household_tasks')
      .select('id, name, global_score, mental_load_score, scoring_category, frequency, next_due_at')
      .eq('household_id', householdId)
      .eq('is_active', true),
  ]);

  const phantomRes = await supabase.from('phantom_members')
    .select('id, display_name, target_share_percent')
    .eq('household_id', householdId);

  // Construire le contexte enrichi
  const allMembers = [...(members.data ?? []), ...(phantomRes.data ?? []).map(p => ({ ...p, isPhantom: true }))];
  const completionsList = completions.data ?? [];
  const tasksList = tasks.data ?? [];

  // Agréger par membre, par jour de la semaine, par catégorie
  const byMemberDay: Record<string, Record<number, number>> = {};
  const byMemberCat: Record<string, Record<string, number>> = {};

  for (const c of completionsList) {
    const mid = (c.completed_by_phantom_id as string) || c.completed_by;
    const dow = new Date(c.completed_at).getDay();
    const task = tasksList.find(t => t.id === c.task_id);
    const cat = task?.scoring_category ?? 'misc';

    if (!byMemberDay[mid]) byMemberDay[mid] = {};
    byMemberDay[mid][dow] = (byMemberDay[mid][dow] ?? 0) + 1;

    if (!byMemberCat[mid]) byMemberCat[mid] = {};
    byMemberCat[mid][cat] = (byMemberCat[mid][cat] ?? 0) + 1;
  }

  const contextLines: string[] = [];
  for (const m of allMembers) {
    const name = m.display_name;
    const dayData = byMemberDay[m.id] ?? {};
    const catData = byMemberCat[m.id] ?? {};
    const total = Object.values(dayData).reduce((s, v) => s + v, 0);
    const topDay = Object.entries(dayData).sort((a, b) => b[1] - a[1])[0];
    const topCat = Object.entries(catData).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const dayNames = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

    contextLines.push(`${name}: ${total} complétions en 8 sem. Jour le plus actif: ${topDay ? dayNames[Number(topDay[0])] : '?'} (${topDay?.[1] ?? 0}). Top catégories: ${topCat.map(([c, n]) => `${c}(${n})`).join(', ')}. Objectif: ${m.target_share_percent ?? 50}%.`);
  }

  // Tâches en retard
  const overdue = tasksList.filter(t => t.next_due_at && new Date(t.next_due_at) < new Date());

  const prompt = `Tu es l'assistant FairShare. Analyse ces données de foyer sur 8 semaines et génère 3-5 insights concrets.

DONNÉES PAR MEMBRE :
${contextLines.join('\n')}

TÂCHES EN RETARD : ${overdue.length} (${overdue.slice(0, 5).map(t => t.name).join(', ')})
TOTAL TÂCHES ACTIVES : ${tasksList.length}

Génère des insights en JSON. Chaque insight a :
- type: "pattern" | "imbalance" | "anticipation" | "suggestion"
- emoji: un emoji pertinent
- title: titre court (max 40 chars)
- body: explication en 1-2 phrases

Réponds UNIQUEMENT en JSON :
{ "insights": [ { "type": "...", "emoji": "...", "title": "...", "body": "..." } ] }`;

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

    if (!response.ok) return NextResponse.json({ insights: [] });

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '{"insights":[]}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ insights: [] });

    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch {
    return NextResponse.json({ insights: [] });
  }
}
