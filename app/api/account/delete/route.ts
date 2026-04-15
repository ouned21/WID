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
    // 1. Soft cleanup des données liées (requête utilisateur — pas service role)
    // On efface d'abord le contenu qu'il a créé
    await supabase.from('task_completions').delete().eq('completed_by', userId);
    await supabase.from('household_tasks').delete().eq('created_by', userId);
    await supabase.from('phantom_members').delete().eq('created_by', userId);
    await supabase.from('task_exchanges').delete().eq('from_user_id', userId);

    // 2. Supprimer son profil
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
