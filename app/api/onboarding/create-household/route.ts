/**
 * POST /api/onboarding/create-household
 * Crée le foyer du nouvel utilisateur avec le service role (bypass RLS).
 * Appelé depuis la page d'onboarding dès que le profil est chargé.
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

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(_req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const admin = serviceClient();

  // Vérifier si l'utilisateur a déjà un foyer
  const { data: profile } = await admin
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single();

  if (profile?.household_id) {
    // Foyer déjà créé — on retourne son ID sans rien faire
    return NextResponse.json({ ok: true, householdId: profile.household_id, existing: true });
  }

  // Créer le foyer (retry en cas de collision de code d'invitation)
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const householdId = crypto.randomUUID();
    const inviteCode = generateInviteCode();

    const { error: insertError } = await admin.from('households').insert({
      id: householdId,
      name: 'Mon foyer',
      invite_code: inviteCode,
      created_by: user.id,
    });

    if (insertError) {
      // Collision de code → réessayer
      if (insertError.code === '23505') continue;
      console.error('[create-household] Insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Mettre à jour le profil avec le household_id
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        household_id: householdId,
        role: 'admin',
        joined_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('[create-household] Profile update error:', profileError);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, householdId });
  }

  return NextResponse.json({ error: 'Impossible de créer le foyer (collision de codes)' }, { status: 500 });
}
