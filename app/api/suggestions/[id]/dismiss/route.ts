/**
 * PATCH /api/suggestions/[id]/dismiss
 * Met à jour dismissed_at dans task_suggestions.
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
    .select('id, household_id')
    .eq('id', id)
    .single();

  if (suggError || !suggestion) {
    return NextResponse.json({ error: 'Suggestion introuvable' }, { status: 404 });
  }

  if (suggestion.household_id !== profile.household_id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  // Marquer comme rejetée
  await admin
    .from('task_suggestions')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json({ ok: true });
}
