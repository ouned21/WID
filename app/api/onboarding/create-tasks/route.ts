/**
 * API Route : /api/onboarding/create-tasks
 * Crée les tâches depuis le catalogue lors de l'onboarding.
 * Utilise le service_role key — bypass RLS, fiable pour les nouveaux utilisateurs.
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

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const admin = serviceClient();

  // Récupérer le household_id depuis le profil
  const { data: profile } = await admin
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single();

  if (!profile?.household_id) {
    return NextResponse.json({ error: 'Aucun foyer trouvé' }, { status: 400 });
  }

  const householdId = profile.household_id as string;

  const body = await req.json() as {
    taskRows: Record<string, unknown>[];
    phantomMembers: { display_name: string }[];
    customSuggestions: string[];
  };

  const { taskRows = [], phantomMembers = [], customSuggestions = [] } = body;

  // Forcer le household_id et created_by pour la sécurité
  const safeRows = taskRows.map((r) => ({
    ...r,
    household_id: householdId,
    created_by: user.id,
  }));

  let insertedTasks: { id: string; name: string }[] = [];
  if (safeRows.length > 0) {
    const { data, error } = await admin
      .from('household_tasks')
      .insert(safeRows)
      .select('id, name');

    if (error) {
      console.error('[onboarding/create-tasks] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    insertedTasks = (data ?? []) as { id: string; name: string }[];
  }

  // Créer les membres fantômes
  if (phantomMembers.length > 0) {
    const { data: existing } = await admin
      .from('phantom_members')
      .select('display_name')
      .eq('household_id', householdId);
    const existingNames = new Set(
      (existing ?? []).map((p: { display_name: string }) => p.display_name.toLowerCase())
    );
    const toCreate = phantomMembers.filter(
      (m) => m.display_name.trim() && !existingNames.has(m.display_name.toLowerCase())
    );
    if (toCreate.length > 0) {
      await admin.from('phantom_members').insert(
        toCreate.map((m) => ({ household_id: householdId, display_name: m.display_name, created_by: user.id }))
      );
    }
  }

  // Enregistrer les suggestions personnalisées
  if (customSuggestions.length > 0) {
    await admin.from('custom_task_suggestions').insert(
      customSuggestions.map((name) => ({ name, household_id: householdId, source: 'onboarding' }))
    );
  }

  return NextResponse.json({ tasks: insertedTasks });
}
