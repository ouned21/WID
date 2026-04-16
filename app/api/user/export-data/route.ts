import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * API Route : export des données utilisateur (RGPD droit à la portabilité — Art. 20)
 *
 * Retourne un fichier JSON structuré contenant toutes les données de l'utilisateur :
 * - Profil
 * - Foyer
 * - Tâches
 * - Complétions
 * - Journaux
 * - Préférences
 * - Patterns comportementaux
 *
 * Header : Content-Disposition: attachment; filename="mes-donnees-yova.json"
 */
export async function GET() {
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

  const userId = user.id;

  // Rate limit : un export par 24h (RGPD Art. 12 — délai raisonnable de réponse)
  // TODO: add last_export_at column to profiles
  try {
    const { data: exportCheckProfile } = await supabase
      .from('profiles')
      .select('last_export_at')
      .eq('id', userId)
      .maybeSingle();

    if (exportCheckProfile && (exportCheckProfile as Record<string, unknown>).last_export_at) {
      const lastExport = new Date((exportCheckProfile as Record<string, unknown>).last_export_at as string);
      const hoursSince = (Date.now() - lastExport.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        const hoursRemaining = Math.ceil(24 - hoursSince);
        return NextResponse.json(
          { error: `Export disponible une fois par 24h (disponible dans ${hoursRemaining}h)` },
          { status: 429 },
        );
      }
    }
  } catch {
    // Si la colonne n'existe pas encore, on continue sans bloquer l'export
  }

  try {
    // Récupérer toutes les données en parallèle
    const [
      profileRes,
      householdRes,
      preferencesRes,
      patternsRes,
      journalsRes,
      completionsRes,
      aiUsageRes,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, household_id, vacation_mode, target_share_percent, is_premium, ai_calls_this_month, last_journal_at, journal_streak_days, total_tasks_completed, last_active_at, created_at')
        .eq('id', userId)
        .maybeSingle(),

      supabase
        .from('profiles')
        .select('household_id')
        .eq('id', userId)
        .maybeSingle()
        .then(async ({ data: p }) => {
          if (!p?.household_id) return { data: null };
          return supabase
            .from('households')
            .select('id, name, created_at')
            .eq('id', p.household_id)
            .maybeSingle();
        }),

      supabase
        .from('user_preferences')
        .select('hated_tasks, loved_tasks, preferred_time_slot, unavailable_days, load_preference, freeform_note, created_at, updated_at')
        .eq('user_id', userId)
        .maybeSingle(),

      supabase
        .from('user_patterns')
        .select('preferred_completion_hour, avg_tasks_per_day, most_active_day, category_affinity, avg_duration_by_category, completion_streak_days, longest_streak_days, ai_memory_summary, updated_at')
        .eq('user_id', userId)
        .maybeSingle(),

      supabase
        .from('user_journals')
        .select('id, raw_text, input_method, mood_tone, ai_response, parsed_completions, unmatched_items, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      supabase
        .from('task_completions')
        .select('id, task_id, completed_at, duration_minutes, note, completion_method, confidence, created_at')
        .eq('completed_by', userId)
        .order('completed_at', { ascending: false }),

      supabase
        .from('ai_token_usage')
        .select('endpoint, model, tokens_input, tokens_output, cost_usd, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    // Récupérer les tâches du foyer créées par cet utilisateur
    // Inclure les complétions pour un export RGPD complet (droit à la portabilité)
    const tasksRes = await supabase
      .from('household_tasks')
      .select('id, name, category_id, frequency, duration_estimate, physical_effort, mental_load_score, scoring_category, assigned_to, is_active, next_due_at, created_at, task_completions(id, completed_at, duration_minutes, note)')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    const exportData = {
      meta: {
        exported_at: new Date().toISOString(),
        export_version: '1.0',
        rgpd_reference: 'Article 20 du Règlement (UE) 2016/679 (RGPD) — Droit à la portabilité',
        app: 'Yova — suivi des tâches ménagères',
        contact: 'privacy@yova.app',
      },
      account: {
        email: user.email,
        email_confirmed: user.email_confirmed_at,
        created_at: user.created_at,
        last_sign_in: user.last_sign_in_at,
      },
      profile: profileRes.data ?? null,
      household: householdRes.data ?? null,
      preferences: preferencesRes.data ?? null,
      behavioral_patterns: patternsRes.data ?? null,
      tasks_created: tasksRes.data ?? [],
      completions: completionsRes.data ?? [],
      journals: journalsRes.data ?? [],
      ai_usage_log: aiUsageRes.data ?? [],
      summary: {
        total_journals: journalsRes.data?.length ?? 0,
        total_completions: completionsRes.data?.length ?? 0,
        total_tasks_created: tasksRes.data?.length ?? 0,
        total_ai_calls: aiUsageRes.data?.length ?? 0,
      },
    };

    const json = JSON.stringify(exportData, null, 2);
    const filename = `mes-donnees-yova-${new Date().toISOString().split('T')[0]}.json`;

    // Mettre à jour la date du dernier export (rate limiting 24h)
    // TODO: add last_export_at column to profiles
    try {
      await supabase
        .from('profiles')
        .update({ last_export_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('id', userId);
    } catch {
      // Si la colonne n'existe pas encore, on ignore silencieusement
    }

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength(json, 'utf8').toString(),
      },
    });

  } catch (err) {
    console.error('[user/export-data] Erreur:', err);
    return NextResponse.json({
      error: "Erreur lors de l'export des données",
      message: err instanceof Error ? err.message : 'Erreur inconnue',
    }, { status: 500 });
  }
}
