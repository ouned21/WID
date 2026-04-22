/**
 * Sprint 14 — Backfill des tâches orphelines de projet.
 *
 * Détecte les household_tasks `frequency='once'` avec `parent_project_id=null`
 * dont le nom évoque une sous-tâche d'un projet parent existant (similarité
 * de titre + fenêtre de 7 jours autour du next_due_at d'un parent candidat).
 *
 * Usage (dry-run par défaut, lecture seule) :
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx \
 *   npx tsx scripts/backfill-orphan-project-tasks.ts
 *
 * Pour appliquer les liens (écriture DB) :
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx \
 *   npx tsx scripts/backfill-orphan-project-tasks.ts --apply
 *
 * Safeguards :
 *  - Pas de magic auto : scope limité aux 60 prochains jours
 *  - Seuil similarité strict (≥ 0.5 Jaccard tokens)
 *  - Jamais de création / suppression — uniquement patch de parent_project_id
 *  - Dry-run dump lisible sur stdout
 */

import { createClient } from '@supabase/supabase-js';
import { projectTitleSimilarity } from '../utils/projectDecomposition';

type TaskRow = {
  id: string;
  household_id: string;
  name: string;
  next_due_at: string | null;
  parent_project_id: string | null;
  frequency: string | null;
  is_active: boolean;
};

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  console.log(`\n🔎 Backfill orphan project tasks — mode : ${APPLY ? 'APPLY (écriture DB)' : 'DRY-RUN (lecture seule)'}\n`);

  const now = new Date().toISOString();
  const in60Days = new Date(Date.now() + 60 * 86400000).toISOString();

  const { data: orphans, error: e1 } = await admin
    .from('household_tasks')
    .select('id, household_id, name, next_due_at, parent_project_id, frequency, is_active')
    .eq('frequency', 'once')
    .eq('is_active', true)
    .is('parent_project_id', null)
    .not('next_due_at', 'is', null)
    .gte('next_due_at', now)
    .lte('next_due_at', in60Days);

  if (e1) {
    console.error('❌ Query orphans failed:', e1.message);
    process.exit(1);
  }
  if (!orphans || orphans.length === 0) {
    console.log('Aucune tâche orpheline éligible.');
    return;
  }

  // Pour chaque household, charger les parents candidats (parent_project_id IS NULL
  // mais référencés par ≥ 1 enfant)
  const byHousehold = new Map<string, TaskRow[]>();
  for (const o of orphans as TaskRow[]) {
    if (!byHousehold.has(o.household_id)) byHousehold.set(o.household_id, []);
    byHousehold.get(o.household_id)!.push(o);
  }

  type Proposal = {
    orphan_id: string;
    orphan_name: string;
    orphan_date: string | null;
    parent_id: string;
    parent_name: string;
    parent_date: string | null;
    similarity: number;
  };
  const proposals: Proposal[] = [];

  for (const [hid, orphansOfHh] of byHousehold) {
    const { data: parents } = await admin
      .from('household_tasks')
      .select('id, name, next_due_at, parent_project_id, frequency, is_active')
      .eq('household_id', hid)
      .eq('is_active', true)
      .is('parent_project_id', null);

    if (!parents || parents.length === 0) continue;

    const { data: childrenRows } = await admin
      .from('household_tasks')
      .select('parent_project_id')
      .eq('household_id', hid)
      .not('parent_project_id', 'is', null);
    const referenced = new Set((childrenRows ?? []).map((c) => c.parent_project_id as string));

    const realParents = parents.filter((p) => referenced.has(p.id));
    if (realParents.length === 0) continue;

    for (const orphan of orphansOfHh) {
      if (!orphan.next_due_at) continue;
      const orphanTime = new Date(orphan.next_due_at).getTime();

      let best: Proposal | null = null;
      for (const parent of realParents) {
        const sim = projectTitleSimilarity(parent.name, orphan.name);
        if (sim < 0.5) continue;
        if (!parent.next_due_at) continue;
        const parentTime = new Date(parent.next_due_at).getTime();
        const deltaDays = Math.abs(orphanTime - parentTime) / 86400000;
        if (deltaDays > 7) continue;
        if (!best || sim > best.similarity) {
          best = {
            orphan_id: orphan.id,
            orphan_name: orphan.name,
            orphan_date: orphan.next_due_at,
            parent_id: parent.id,
            parent_name: parent.name,
            parent_date: parent.next_due_at,
            similarity: sim,
          };
        }
      }
      if (best) proposals.push(best);
    }
  }

  if (proposals.length === 0) {
    console.log('Aucun lien orphan→parent proposé (seuils non atteints).');
    return;
  }

  console.log(`📋 ${proposals.length} lien(s) proposé(s) :\n`);
  for (const p of proposals) {
    const d1 = p.orphan_date ? new Date(p.orphan_date).toISOString().slice(0, 10) : '?';
    const d2 = p.parent_date ? new Date(p.parent_date).toISOString().slice(0, 10) : '?';
    console.log(`  • "${p.orphan_name}" (${d1}) → "${p.parent_name}" (${d2}) — sim ${p.similarity.toFixed(2)}`);
  }

  if (!APPLY) {
    console.log('\n👉 Dry-run. Relance avec --apply pour écrire en DB.');
    return;
  }

  console.log('\n✍️  Application...');
  let ok = 0;
  for (const p of proposals) {
    const { error } = await admin.from('household_tasks')
      .update({ parent_project_id: p.parent_id })
      .eq('id', p.orphan_id);
    if (error) {
      console.error(`  ✗ ${p.orphan_name}: ${error.message}`);
    } else {
      ok++;
    }
  }
  console.log(`✅ ${ok}/${proposals.length} liens appliqués.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
