/**
 * API Route : GET /api/suggestions/next
 * Retourne la prochaine tâche à suggérer au foyer selon la progression par tiers.
 * Utilise le service_role key pour l'upsert dans task_suggestions (bypass RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

type SuggestionTemplate = {
  id: string;
  name: string;
  scoring_category: string | null;
  default_frequency: string;
  priority_tier: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
 * Construit le message de raison affiché à l'utilisateur pour la suggestion,
 * adapté à l'ancienneté du foyer et à la fréquence de la tâche.
 */
function buildReason(
  template: { scoring_category: string | null; default_frequency: string },
  days: number,
): string {
  const freqMap: Record<string, string> = {
    daily: 'quotidienne',
    weekly: 'hebdomadaire',
    biweekly: 'toutes les 2 semaines',
    monthly: 'mensuelle',
    quarterly: 'trimestrielle',
  };
  const freq = freqMap[template.default_frequency] ?? 'régulière';
  if (days >= 30) return `Tâche ${freq} que la plupart des foyers suivent.`;
  if (days >= 7) return `Tâche ${freq} populaire — prête à être suivie.`;
  return `Tâche ${freq} essentielle pour bien démarrer.`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    // 1. Authentification via cookies
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const admin = serviceClient();

    // 2. Récupérer household_id et joined_at depuis profiles
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('household_id, joined_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.household_id) {
      console.error('[suggestions/next] Profil introuvable:', profileError);
      return NextResponse.json({ error: 'Aucun foyer trouvé' }, { status: 400 });
    }

    const householdId = profile.household_id as string;
    const joinedAt = profile.joined_at as string;

    // 3. Calculer l'ancienneté en jours
    const daysSinceJoined = Math.floor(
      (Date.now() - new Date(joinedAt).getTime()) / 86_400_000,
    );

    // 4. Déterminer le tier maximum accessible selon l'ancienneté
    const maxTier = daysSinceJoined >= 30 ? 3 : daysSinceJoined >= 7 ? 2 : 1;

    // 5. Récupérer les template_ids déjà actifs dans household_tasks
    const { data: existingTasks, error: tasksError } = await admin
      .from('household_tasks')
      .select('template_id')
      .eq('household_id', householdId)
      .eq('is_active', true);

    if (tasksError) {
      console.error('[suggestions/next] Erreur lecture household_tasks:', tasksError);
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    const existingTemplateIds = (existingTasks ?? [])
      .map((t: { template_id: string | null }) => t.template_id)
      .filter(Boolean) as string[];

    // 6. Récupérer les template_ids déjà traités dans task_suggestions
    //    (acceptées ou rejetées — on ne re-suggère pas)
    const { data: handledSuggestions, error: suggestionsError } = await admin
      .from('task_suggestions')
      .select('template_id')
      .eq('household_id', householdId)
      .or('accepted_at.not.is.null,dismissed_at.not.is.null');

    if (suggestionsError) {
      console.error('[suggestions/next] Erreur lecture task_suggestions:', suggestionsError);
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    const handledTemplateIds = (handledSuggestions ?? [])
      .map((s: { template_id: string | null }) => s.template_id)
      .filter(Boolean) as string[];

    // Union des ids à exclure
    const excludedIds = Array.from(new Set([...existingTemplateIds, ...handledTemplateIds]));

    // 7. Chercher le prochain template éligible par ordre de priorité
    let templateQuery = admin
      .from('task_templates')
      .select('id, name, scoring_category, default_frequency, priority_tier')
      .lte('priority_tier', maxTier)
      .order('priority_tier', { ascending: true })
      .order('sort_order', { ascending: true })
      .limit(1);

    if (excludedIds.length > 0) {
      templateQuery = templateQuery.not('id', 'in', `(${excludedIds.join(',')})`);
    }

    const { data: templates, error: templateError } = await templateQuery;

    if (templateError) {
      console.error('[suggestions/next] Erreur lecture task_templates:', templateError);
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    const template = (templates ?? [])[0] as SuggestionTemplate | undefined;

    // 8. Aucun template disponible → réponse vide (pas d'erreur)
    if (!template) {
      return NextResponse.json({ suggestion: null });
    }

    // 9. Upsert dans task_suggestions (service role, bypass RLS)
    //    ON CONFLICT (household_id, template_id) DO NOTHING — évite les doublons
    const reason = buildReason(template, daysSinceJoined);

    const { data: upserted, error: upsertError } = await admin
      .from('task_suggestions')
      .upsert(
        {
          household_id: householdId,
          template_id: template.id,
          name: template.name,
          reason,
          scoring_category: template.scoring_category,
          trigger_reason: 'tier_progression',
          suggested_at: new Date().toISOString(),
        },
        { onConflict: 'household_id,template_id', ignoreDuplicates: true },
      )
      .select('id, name, reason, scoring_category, template_id')
      .single();

    if (upsertError) {
      // Si le conflit a été ignoré, upserted sera null — ce n'est pas une erreur fatale.
      // On reconstruit la réponse depuis les données du template.
      if (upsertError.code !== 'PGRST116') {
        console.error('[suggestions/next] Erreur upsert task_suggestions:', upsertError);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
      }
    }

    // 10. Retourner la suggestion (depuis l'upsert ou reconstituée)
    const suggestion = upserted ?? {
      id: null,
      name: template.name,
      reason,
      scoring_category: template.scoring_category,
      template_id: template.id,
    };

    return NextResponse.json({ suggestion });

  } catch (err) {
    console.error('[suggestions/next] Erreur inattendue:', err);
    return NextResponse.json({ suggestion: null });
  }
}
