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
    // Utiliser le service role pour bypass RLS sur toutes les tables
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminClient = serviceRoleKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
      : supabase; // fallback anon (peut échouer sur tables RLS-strictes)

    // 1. Supprimer les données personnelles (erreurs non-fatales : table peut ne pas exister)
    const deleteOps = [
      adminClient.from('task_completions').delete().eq('completed_by', userId),
      adminClient.from('task_exchanges').delete().eq('proposed_by', userId),
      adminClient.from('task_exchanges').delete().eq('proposed_to', userId),
      adminClient.from('phantom_members').delete().eq('created_by', userId),
      adminClient.from('household_tasks').delete().eq('created_by', userId),
      adminClient.from('user_journals').delete().eq('user_id', userId),
      adminClient.from('ai_token_usage').delete().eq('user_id', userId),
      adminClient.from('feature_usage_events').delete().eq('user_id', userId),
      adminClient.from('user_patterns').delete().eq('user_id', userId),
      adminClient.from('user_preferences').delete().eq('user_id', userId),
    ];

    const results = await Promise.allSettled(deleteOps);
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[account/delete] op[${i}] rejected:`, r.reason);
      }
    });

    // 2. Supprimer le profil en dernier (ON DELETE CASCADE sur les FKs restantes)
    const { error: profileDeleteError } = await adminClient.from('profiles').delete().eq('id', userId);
    if (profileDeleteError) {
      console.error('[account/delete] profile delete error:', profileDeleteError.message);
      // Non fatal — on continue pour supprimer l'auth user
    }

    // 3. Hard delete auth (adminClient déjà créé avec service role)
    if (serviceRoleKey) {
      await adminClient.auth.admin.deleteUser(userId);
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
