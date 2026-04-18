/**
 * API Route : /api/admin/catalog
 * Accès réservé à l'email défini dans ADMIN_EMAIL (env var).
 * Utilise le service_role key — accès complet, bypass RLS.
 *
 * GET    → stats + promotions + suggestions en approche
 * DELETE ?id=xxx  → supprime un template promu (+ marque rejeté dans catalog_promotions)
 * POST   ?action=promote → déclenche promote_popular_suggestions() maintenant
 * POST   ?action=enrich  → appelle la Edge Function enrich-templates maintenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';

// Client avec service_role (bypass RLS — côté serveur uniquement)
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

function unauthorized() {
  return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  const user = await getAuthUser();
  if (!user || user.email !== ADMIN_EMAIL) return unauthorized();

  const db = serviceClient();

  const [promotionsRes, pendingRes, statsRes, lastCronRes] = await Promise.all([
    // Promotions récentes (50 dernières)
    db.from('catalog_promotions')
      .select(`
        id, name, promoted_at, household_count, ai_enriched,
        inferred_category, note,
        template:template_id (
          id, name, scoring_category, default_duration, default_frequency,
          default_physical, description, sort_order
        )
      `)
      .order('promoted_at', { ascending: false })
      .limit(50),

    // Suggestions "en approche" (2 foyers distincts, pas encore à 3)
    db.from('custom_task_suggestions')
      .select('name, household_id, created_at')
      .is('processed_at', null)
      .then(async ({ data }) => {
        if (!data) return { data: [] };
        // Group by normalized name, count distinct households
        const grouped: Record<string, { name: string; households: Set<string>; latest: string }> = {};
        for (const row of data) {
          const key = (row.name as string).toLowerCase().trim();
          if (!grouped[key]) grouped[key] = { name: row.name, households: new Set(), latest: row.created_at };
          if (row.household_id) grouped[key].households.add(row.household_id as string);
          if (row.created_at > grouped[key].latest) grouped[key].latest = row.created_at;
        }
        const approaching = Object.values(grouped)
          .filter(g => g.households.size === 2) // 2 foyers = 1 de plus = promotion
          .sort((a, b) => b.latest.localeCompare(a.latest))
          .slice(0, 20)
          .map(g => ({ name: g.name, household_count: g.households.size, latest: g.latest }));
        return { data: approaching };
      }),

    // Stats globales
    Promise.all([
      db.from('task_templates').select('id', { count: 'exact', head: true }),
      db.from('task_templates').select('id', { count: 'exact', head: true }).eq('is_system', false),
      db.from('catalog_promotions').select('id', { count: 'exact', head: true }),
      db.from('custom_task_suggestions').select('id', { count: 'exact', head: true }).is('processed_at', null),
    ]),

    // Dernier passage du cron (depuis les logs pg_cron si disponible)
    db.from('catalog_promotions')
      .select('promoted_at')
      .order('promoted_at', { ascending: false })
      .limit(1),
  ]);

  const [totalTemplates, userTemplates, totalPromotions, pendingSuggestions] = statsRes;

  return NextResponse.json({
    stats: {
      total_templates: totalTemplates.count ?? 0,
      user_promoted_templates: userTemplates.count ?? 0,
      total_promotions: totalPromotions.count ?? 0,
      pending_unprocessed: pendingSuggestions.count ?? 0,
      last_promotion: lastCronRes.data?.[0]?.promoted_at ?? null,
    },
    promotions: promotionsRes.data ?? [],
    approaching: (await pendingRes).data ?? [],
  });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.email !== ADMIN_EMAIL) return unauthorized();

  const { searchParams } = new URL(req.url);
  const promotionId = searchParams.get('id');
  if (!promotionId) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const db = serviceClient();

  // Récupérer le template_id associé
  const { data: promo } = await db
    .from('catalog_promotions')
    .select('template_id, name')
    .eq('id', promotionId)
    .single();

  if (!promo) return NextResponse.json({ error: 'Promotion introuvable' }, { status: 404 });

  // Supprimer le template promu
  if (promo.template_id) {
    await db.from('task_templates').delete().eq('id', promo.template_id);
  }

  // Marquer la promotion comme rejetée (conserver l'historique)
  await db.from('catalog_promotions')
    .update({ note: 'Rejeté manuellement par admin' })
    .eq('id', promotionId);

  // Remettre les suggestions en "non traitées" pour qu'elles puissent être re-évaluées
  await db.from('custom_task_suggestions')
    .update({ processed_at: null })
    .ilike('name', promo.name);

  return NextResponse.json({ ok: true });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.email !== ADMIN_EMAIL) return unauthorized();

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const db = serviceClient();

  if (action === 'promote') {
    // Déclencher la promotion maintenant (sans attendre le cron lundi)
    const { data, error } = await db.rpc('promote_popular_suggestions');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, results: data });
  }

  if (action === 'enrich') {
    // Appeler la Edge Function d'enrichissement IA
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/enrich-templates`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({}),
      },
    );
    const data = await res.json();
    return NextResponse.json({ ok: res.ok, ...data });
  }

  return NextResponse.json({ error: 'action inconnue' }, { status: 400 });
}
