/**
 * POST /api/agent/detect-observations
 * Sprint 5 — Détection de dérives douces du foyer
 *
 * Pilier 2 : "Yova détecte passivement les dérives sans gronder"
 * Tone : jamais culpabilisant, toujours constructif
 *
 * Patterns détectés :
 *  - cooking_drift      : aucun repas maison complété depuis 7+ jours
 *  - balance_drift      : un membre porte >75% des complétions sur 14 jours
 *  - journal_silence    : aucun journal depuis 5+ jours
 *  - task_overdue_cluster : 3+ tâches en retard simultanément
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ObservationType, ObservationSeverity } from '@/types/database';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface DetectedObservation {
  type: ObservationType;
  severity: ObservationSeverity;
  payload: Record<string, unknown>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ── Détections ─────────────────────────────────────────────────────────────

async function detectCookingDrift(householdId: string): Promise<DetectedObservation | null> {
  // Cherche les tâches de catégorie "repas" du foyer
  const { data: mealTasks } = await supabase
    .from('household_tasks')
    .select('id')
    .eq('household_id', householdId)
    .eq('is_active', true)
    .in('scoring_category', ['meals', 'cooking', 'repas']);

  if (!mealTasks || mealTasks.length === 0) return null;

  const taskIds = mealTasks.map((t) => t.id);
  const since = daysAgo(7);

  const { data: recentCompletions } = await supabase
    .from('task_completions')
    .select('id')
    .in('task_id', taskIds)
    .gte('completed_at', since)
    .limit(1);

  if (recentCompletions && recentCompletions.length > 0) return null;

  return {
    type: 'cooking_drift',
    severity: 'notice',
    payload: {
      days_without_meal: 7,
      message: 'Ça fait 7 jours sans cuisine maison — manque de temps ou d\'énergie en ce moment ?',
      action: 'journal',
    },
  };
}

async function detectBalanceDrift(householdId: string): Promise<DetectedObservation | null> {
  const since = daysAgo(14);

  // Complétions par membre réel sur les 14 derniers jours
  const { data: completions } = await supabase
    .from('task_completions')
    .select('completed_by, task_id, household_tasks!inner(household_id)')
    .eq('household_tasks.household_id', householdId)
    .gte('completed_at', since);

  if (!completions || completions.length < 5) return null;

  // Décompte par membre
  const counts: Record<string, number> = {};
  for (const c of completions) {
    if (c.completed_by) {
      counts[c.completed_by] = (counts[c.completed_by] ?? 0) + 1;
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const entries = Object.entries(counts);
  if (entries.length < 2) return null; // Foyer avec un seul contributeur = pas une dérive

  for (const [userId, count] of entries) {
    const pct = Math.round((count / total) * 100);
    if (pct >= 75) {
      // Récupère le nom
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .single();

      const firstName = profile?.display_name?.split(' ')[0] ?? 'Un membre';

      return {
        type: 'balance_drift',
        severity: 'notice',
        payload: {
          user_id: userId,
          first_name: firstName,
          percent: pct,
          days: 14,
          message: `${firstName} gère ${pct}% des tâches du foyer depuis 2 semaines — peut-être qu'une main tendue ferait du bien.`,
          action: 'week',
        },
      };
    }
  }

  return null;
}

async function detectJournalSilence(householdId: string): Promise<DetectedObservation | null> {
  const since = daysAgo(5);

  const { data: recentJournals } = await supabase
    .from('user_journals')
    .select('id')
    .eq('household_id', householdId)
    .gte('created_at', since)
    .limit(1);

  if (recentJournals && recentJournals.length > 0) return null;

  // Vérifie qu'il y a eu des journaux avant (sinon c'est juste un nouveau foyer)
  const { data: anyJournal } = await supabase
    .from('user_journals')
    .select('id')
    .eq('household_id', householdId)
    .limit(1);

  if (!anyJournal || anyJournal.length === 0) return null;

  return {
    type: 'journal_silence',
    severity: 'info',
    payload: {
      days_without_journal: 5,
      message: 'Je n\'ai pas eu de nouvelles depuis 5 jours. Tout va bien ?',
      action: 'journal',
    },
  };
}

async function detectTaskOverdueCluster(householdId: string): Promise<DetectedObservation | null> {
  const now = new Date().toISOString();

  const { data: overdueTasks } = await supabase
    .from('household_tasks')
    .select('id, name')
    .eq('household_id', householdId)
    .eq('is_active', true)
    .lt('next_due_at', now);

  if (!overdueTasks || overdueTasks.length < 3) return null;

  return {
    type: 'task_overdue_cluster',
    severity: overdueTasks.length >= 6 ? 'alert' : 'notice',
    payload: {
      count: overdueTasks.length,
      task_names: overdueTasks.slice(0, 4).map((t) => t.name),
      message: overdueTasks.length >= 10
        ? `${overdueTasks.length} tâches se sont accumulées — le bon moment pour en faire le tri avec moi.`
        : `${overdueTasks.length} tâches attendent encore — on s'y met ?`,
      action: 'today',
    },
  };
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { household_id } = body as { household_id?: string };

    if (!household_id) {
      return NextResponse.json({ error: 'household_id requis' }, { status: 400 });
    }

    // Lance toutes les détections en parallèle
    const [cooking, balance, silence, overdue] = await Promise.all([
      detectCookingDrift(household_id),
      detectBalanceDrift(household_id),
      detectJournalSilence(household_id),
      detectTaskOverdueCluster(household_id),
    ]);

    const detected = [cooking, balance, silence, overdue].filter(
      (obs): obs is DetectedObservation => obs !== null,
    );

    if (detected.length === 0) {
      return NextResponse.json({ inserted: 0, observations: [] });
    }

    // Déduplique : ne pas réinsérer un type déjà non-acquitté
    const { data: existing } = await supabase
      .from('observations')
      .select('type')
      .eq('household_id', household_id)
      .is('user_acknowledged_at', null);

    const existingTypes = new Set((existing ?? []).map((o) => o.type));
    const toInsert = detected.filter((obs) => !existingTypes.has(obs.type));

    if (toInsert.length === 0) {
      return NextResponse.json({ inserted: 0, observations: [], skipped: detected.length });
    }

    const { data: inserted, error } = await supabase
      .from('observations')
      .insert(
        toInsert.map((obs) => ({
          household_id,
          type: obs.type,
          severity: obs.severity,
          payload: obs.payload,
        })),
      )
      .select();

    if (error) {
      console.error('[detect-observations] insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      inserted: inserted?.length ?? 0,
      observations: inserted,
    });
  } catch (err) {
    console.error('[detect-observations] unexpected error:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
