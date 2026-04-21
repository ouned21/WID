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

/**
 * GET /api/household/join?code=XXXXXX
 * Retourne les infos publiques d'un foyer à partir de son code d'invitation.
 * Pas d'auth requise — accessible depuis la page /join.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.trim().toUpperCase();
  if (!code || code.length !== 6) {
    return NextResponse.json({ error: 'Code invalide' }, { status: 400 });
  }

  const admin = serviceClient();

  const { data: household, error } = await admin
    .from('households')
    .select('id, name, created_by')
    .eq('invite_code', code)
    .eq('is_active', true)
    .single();

  if (error || !household) {
    return NextResponse.json({ error: 'Invitation introuvable ou expirée' }, { status: 404 });
  }

  // Récupérer le prénom de l'invitant
  const { data: inviter } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', household.created_by)
    .single();

  return NextResponse.json({
    ok: true,
    householdName: household.name,
    inviterName: inviter?.display_name ?? 'ton partenaire',
  });
}

/**
 * POST /api/household/join
 * body: { code: string }
 * Fait rejoindre l'utilisateur connecté au foyer identifié par le code.
 * Marque le profil comme onboarding_complete (Barbara rejoint directement).
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  let body: { code?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }); }

  const code = body.code?.trim().toUpperCase();
  if (!code || code.length !== 6) {
    return NextResponse.json({ error: 'Code invalide' }, { status: 400 });
  }

  const admin = serviceClient();

  // Trouver le foyer
  const { data: household, error: householdError } = await admin
    .from('households')
    .select('id, created_by')
    .eq('invite_code', code)
    .eq('is_active', true)
    .single();

  if (householdError || !household) {
    return NextResponse.json({ error: 'Invitation introuvable' }, { status: 404 });
  }

  // Empêcher de rejoindre son propre foyer
  if (household.created_by === user.id) {
    return NextResponse.json({ error: 'Tu es déjà l\'admin de ce foyer' }, { status: 409 });
  }

  // Vérifier si le profil existe (peut ne pas encore être créé par le trigger)
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, household_id')
    .eq('id', user.id)
    .single();

  if (existingProfile?.household_id) {
    return NextResponse.json({ error: 'Tu appartiens déjà à un foyer' }, { status: 409 });
  }

  if (existingProfile) {
    // Mettre à jour le profil existant
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        household_id: household.id,
        role: 'member',
        joined_at: new Date().toISOString(),
        onboarding_complete: true,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[join] Profile update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  } else {
    // Le trigger n'a pas encore créé le profil — on l'insère nous-mêmes
    const displayName = user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'Membre';
    const { error: insertError } = await admin
      .from('profiles')
      .insert({
        id: user.id,
        display_name: displayName,
        household_id: household.id,
        role: 'member',
        joined_at: new Date().toISOString(),
        onboarding_complete: true,
      });

    if (insertError) {
      console.error('[join] Profile insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  console.log(`[join] ${user.id} a rejoint le foyer ${household.id} via code ${code}`);
  return NextResponse.json({ ok: true, householdId: household.id });
}
