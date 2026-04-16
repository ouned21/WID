import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

/**
 * API Route : suppression complète du compte (RGPD droit à l'effacement).
 *
 * Supprime :
 * - Le profil (row)
 * - Toutes les tâches créées (ON DELETE CASCADE via FK)
 * - Toutes les complétions associées
 * - L'utilisateur auth (via service role key)
 */

export async function POST() {
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

  try {
    // 1. Supprimer les données personnelles en cascade
    // Les tables avec ON DELETE CASCADE (profiles → user_journals, ai_token_usage,
    // feature_usage_events, user_patterns, user_preferences, task_completions via FK)
    // seront nettoyées automatiquement lors de la suppression du profil.
    // On efface manuellement ce qui n'est pas en CASCADE strict :
    await supabase.from('task_completions').delete().eq('completed_by', userId);
    await supabase.from('task_exchanges').delete().eq('proposed_by', userId);
    await supabase.from('task_exchanges').delete().eq('proposed_to', userId);
    await supabase.from('phantom_members').delete().eq('created_by', userId);
    await supabase.from('household_tasks').delete().eq('created_by', userId);

    // 2. Supprimer les données IA personnelles
    await supabase.from('user_journals').delete().eq('user_id', userId);
    await supabase.from('ai_token_usage').delete().eq('user_id', userId);
    await supabase.from('feature_usage_events').delete().eq('user_id', userId);
    await supabase.from('user_patterns').delete().eq('user_id', userId);
    await supabase.from('user_preferences').delete().eq('user_id', userId);

    // 3. Supprimer son profil (ON DELETE CASCADE nettoiera le reste)
    await supabase.from('profiles').delete().eq('id', userId);

    // 3. Si SERVICE_ROLE_KEY disponible : hard delete auth
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
      );
      await admin.auth.admin.deleteUser(userId);
    }

    // 4. Se déconnecter
    await supabase.auth.signOut();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[account/delete] Erreur:', err);
    return NextResponse.json({
      error: 'Erreur lors de la suppression',
      message: err instanceof Error ? err.message : 'Erreur inconnue',
    }, { status: 500 });
  }
}
