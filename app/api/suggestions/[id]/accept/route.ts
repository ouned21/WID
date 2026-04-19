/**
 * PATCH /api/suggestions/[id]/accept
 * Met à jour accepted_at dans task_suggestions + crée la tâche depuis le template.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

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

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;
  const admin = serviceClient();

  // Récupérer le household_id du profil
  const { data: profile } = await admin
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single();

  if (!profile?.household_id) {
    return NextResponse.json({ error: 'Aucun foyer trouvé' }, { status: 400 });
  }

  // Récupérer la suggestion et vérifier l'ownership
  const { data: suggestion, error: suggError } = await admin
    .from('task_suggestions')
    .select('id, household_id, template_id, name, scoring_category')
    .eq('id', id)
    .single();

  if (suggError || !suggestion) {
    return NextResponse.json({ error: 'Suggestion introuvable' }, { status: 404 });
  }

  if (suggestion.household_id !== profile.household_id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  // Marquer la suggestion comme acceptée
  await admin
    .from('task_suggestions')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', id);

  // Créer la tâche depuis le template si disponible
  if (suggestion.template_id) {
    const { data: template } = await admin
      .from('task_templates')
      .select('name, scoring_category, default_frequency, default_duration, default_physical, default_mental_load_score')
      .eq('id', suggestion.template_id)
      .single();

    if (template) {
      // Calcule next_due_at selon la fréquence
      const freqDays: Record<string, number> = { daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 90 };
      const days = freqDays[template.default_frequency ?? 'weekly'] ?? 7;
      const nextDue = new Date(Date.now() + days * 86_400_000);
      nextDue.setHours(9, 0, 0, 0);

      await admin.from('household_tasks').insert({
        household_id: profile.household_id,
        created_by: user.id,
        template_id: suggestion.template_id,
        name: template.name,
        scoring_category: template.scoring_category,
        frequency: template.default_frequency ?? 'weekly',
        duration_estimate: template.default_duration ?? 'short',
        physical_effort: template.default_physical ?? 'light',
        mental_load_score: template.default_mental_load_score ?? 2,
        is_active: true,
        is_fixed_assignment: false,
        notifications_enabled: true,
        next_due_at: nextDue.toISOString(),
      });
    }
  } else {
    // Pas de template — créer une tâche minimale depuis le nom de la suggestion
    await admin.from('household_tasks').insert({
      household_id: profile.household_id,
      created_by: user.id,
      name: suggestion.name,
      scoring_category: suggestion.scoring_category ?? null,
      frequency: 'weekly',
      is_active: true,
    });
  }

  return NextResponse.json({ ok: true });
}
