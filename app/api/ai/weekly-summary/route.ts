import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requirePremium } from '@/utils/aiRateLimit';
import { getHouseholdPreferences, formatHouseholdPreferencesForPrompt } from '@/utils/userPreferences';
import { logAiUsage, extractUsageFromResponse } from '@/utils/aiLogger';

/**
 * API Route : résumé hebdomadaire IA (premium)
 * Analyse les complétions de la semaine et génère un résumé en langage naturel.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ summary: 'IA non configurée.' });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  // Feature premium uniquement
  const premium = await requirePremium(supabase, user.id);
  if (!premium.isPremium) {
    return NextResponse.json({
      error: 'Premium requis',
      code: 'PREMIUM_REQUIRED',
      message: 'Le résumé IA est une fonctionnalité Premium.',
    }, { status: 403 });
  }

  // Sécurité IDOR : on ignore householdId du body, on le lit depuis le profil en DB.
  // Un utilisateur ne peut accéder qu'aux données de son propre foyer.
  const { data: profile } = await supabase
    .from('profiles').select('household_id').eq('id', user.id).maybeSingle();
  const householdId = profile?.household_id;
  if (!householdId) return NextResponse.json({ error: 'Pas de foyer associé' }, { status: 400 });

  // Récupérer les données de la semaine
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [completions, members, tasks] = await Promise.all([
    supabase.from('task_completions')
      .select('completed_by, completed_by_phantom_id, task_id, completed_at')
      .eq('household_id', householdId)
      .gte('completed_at', weekAgo.toISOString()),
    supabase.from('profiles')
      .select('id, display_name')
      .eq('household_id', householdId),
    supabase.from('household_tasks')
      .select('id, name, user_score, mental_load_score, scoring_category, assigned_to, assigned_to_phantom_id')
      .eq('household_id', householdId)
      .eq('is_active', true),
  ]);

  const phantomRes = await supabase.from('phantom_members')
    .select('id, display_name')
    .eq('household_id', householdId);

  // Construire le contexte
  const memberMap = new Map<string, string>();
  for (const m of (members.data ?? [])) memberMap.set(m.id, m.display_name);
  for (const p of (phantomRes.data ?? [])) memberMap.set(p.id, p.display_name + ' (fantôme)');

  const taskMap = new Map<string, { name: string; score: number; category: string }>();
  for (const t of (tasks.data ?? [])) {
    taskMap.set(t.id, { name: t.name, score: t.user_score != null ? t.user_score * 3.6 : t.mental_load_score * 7, category: t.scoring_category ?? 'misc' });
  }

  // Stats par membre
  const stats: Record<string, { count: number; totalScore: number; categories: Record<string, number> }> = {};
  for (const c of (completions.data ?? [])) {
    const memberId = (c.completed_by_phantom_id as string) || c.completed_by;
    if (!stats[memberId]) stats[memberId] = { count: 0, totalScore: 0, categories: {} };
    stats[memberId].count++;
    const task = taskMap.get(c.task_id);
    if (task) {
      stats[memberId].totalScore += task.score;
      stats[memberId].categories[task.category] = (stats[memberId].categories[task.category] ?? 0) + 1;
    }
  }

  const dataText = Object.entries(stats).map(([id, s]) => {
    const name = memberMap.get(id) ?? 'Inconnu';
    const topCats = Object.entries(s.categories).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${c}(${n})`).join(', ');
    return `${name}: ${s.count} tâches, score total ${s.totalScore}, catégories: ${topCats}`;
  }).join('\n');

  const totalScore = Object.values(stats).reduce((s, v) => s + v.totalScore, 0);

  // Préférences des membres (pour personnaliser les suggestions)
  const memberIds = Array.from(memberMap.keys());
  const householdPrefs = await getHouseholdPreferences(supabase as unknown as never, memberIds);
  const prefsBlock = formatHouseholdPreferencesForPrompt(householdPrefs, memberMap);

  const prompt = `Tu es Aura, l'assistant du foyer. Voici les données de la semaine pour ce foyer :

${dataText}

Score total foyer : ${totalScore}
Nombre de membres : ${memberMap.size}${prefsBlock}

Rédige un résumé en français, 4-5 phrases maximum. Sois factuel, neutre, pas accusateur. Mentionne :
1. Qui a fait le plus/moins et dans quelle proportion
2. Les catégories déséquilibrées
3. Une suggestion concrète pour la semaine prochaine

Pas de formule de politesse. Pas de "Bonjour". Juste le résumé.`;

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
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      await logAiUsage(supabase as never, {
        userId: user.id, householdId, endpoint: 'weekly-summary',
        tokensInput: 0, tokensOutput: 0, durationMs: Date.now() - startTime, status: 'error',
      });
      return NextResponse.json({ summary: 'Erreur lors de la génération.' });
    }

    const data = await response.json();
    const usage = extractUsageFromResponse(data);
    const summary = data.content?.[0]?.text ?? 'Pas assez de données cette semaine.';

    await logAiUsage(supabase as never, {
      userId: user.id, householdId, endpoint: 'weekly-summary',
      tokensInput: usage.tokensInput, tokensOutput: usage.tokensOutput,
      durationMs: Date.now() - startTime, status: 'success',
    });

    return NextResponse.json({ summary });
  } catch {
    await logAiUsage(supabase as never, {
      userId: user.id, householdId, endpoint: 'weekly-summary',
      tokensInput: 0, tokensOutput: 0, durationMs: Date.now() - startTime, status: 'error',
    });
    return NextResponse.json({ summary: 'Erreur lors de la génération.' });
  }
}
