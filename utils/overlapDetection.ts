/**
 * Sprint 16 — Détection de chevauchement entre sous-tâches d'un projet et
 * tâches récurrentes existantes.
 *
 * Yova décompose un projet (sprint 12), génère N sous-tâches. Avant insert,
 * on cherche pour chacune si une tâche récurrente active de la DB couvre
 * déjà ±3 jours autour de sa date prévue avec un nom similaire (Jaccard).
 * Si oui → on ne crée pas la sous-tâche silencieusement, on pose la question.
 *
 * Seuil Jaccard à 0.5 (plus permissif que les 0.6 anti-doublon projet du
 * sprint 14 — ici on cherche un recoupement utile, pas un clone strict).
 */

import { projectTitleSimilarity } from './projectDecomposition';

// Seuil Jaccard à 0.33 — calibré sur le cas canonique :
//   "Faire les courses" (1 token significatif : "courses") vs
//   "Faire les courses pour le déjeuner dimanche" (3 tokens : "courses",
//   "dejeuner", "dimanche") → Jaccard = 1/3 = 0.33.
// 0.5 (anti-doublon projet sprint 14) raterait ce match évident.
// Au-dessous de 0.33 on commencerait à matcher du bruit.
export const OVERLAP_SIMILARITY_THRESHOLD = 0.33;
// Fenêtre date élargie à 7 jours (cas canonique : récurrente weekly mer.
// vs sous-tâche courses sam. pour un déjeuner dim. = 4j d'écart). À ±3j
// on ratait le cas le plus fréquent. À ±7j on couvre toute la semaine d'une
// récurrente weekly. Un faux positif = 1 question polie ; un vrai négatif
// = un doublon silencieux (pire). On préfère poser une question de trop.
export const OVERLAP_DATE_WINDOW_DAYS = 7;

export type CandidateRecurringTask = {
  id: string;
  name: string;
  next_due_at: string | null;
};

export type SubtaskForOverlap = {
  index: number;        // position dans la liste de sous-tâches générées
  name: string;
  next_due_at: string;  // ISO
};

export type OverlapMatch = {
  subtask_index: number;
  subtask_name: string;
  subtask_next_due_at: string;
  existing_task_id: string;
  existing_task_name: string;
  existing_next_due_at: string;
  similarity: number;
};

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.abs(a - b) / 86_400_000;
}

/**
 * Pour chaque sous-tâche, cherche la meilleure candidate récurrente qui
 * (1) tombe dans ±3 jours et (2) a un nom Jaccard ≥ 0.5.
 *
 * Une même tâche récurrente peut être matchée par PLUSIEURS sous-tâches
 * (rare, mais possible — on garde toutes les paires).
 *
 * Renvoie une liste vide si aucun chevauchement → flow normal sprint 12.
 */
export function detectOverlaps(
  subtasks: SubtaskForOverlap[],
  candidates: CandidateRecurringTask[],
): OverlapMatch[] {
  const out: OverlapMatch[] = [];
  for (const sub of subtasks) {
    let best: OverlapMatch | null = null;
    for (const cand of candidates) {
      if (!cand.next_due_at) continue;
      if (daysBetween(sub.next_due_at, cand.next_due_at) > OVERLAP_DATE_WINDOW_DAYS) continue;
      const sim = projectTitleSimilarity(sub.name, cand.name);
      if (sim < OVERLAP_SIMILARITY_THRESHOLD) continue;
      if (!best || sim > best.similarity) {
        best = {
          subtask_index: sub.index,
          subtask_name: sub.name,
          subtask_next_due_at: sub.next_due_at,
          existing_task_id: cand.id,
          existing_task_name: cand.name,
          existing_next_due_at: cand.next_due_at,
          similarity: sim,
        };
      }
    }
    if (best) out.push(best);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Question groupée à poser à l'user
// ---------------------------------------------------------------------------

function frenchDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'long',
  });
}

/**
 * Formule UNE question groupée pour 1..N overlaps. Esprit "Yova confident,
 * propose, n'oblige pas". Affiche au plus 2 paires explicites + total.
 */
export function buildOverlapQuestion(overlaps: OverlapMatch[]): string {
  if (overlaps.length === 0) return '';
  if (overlaps.length === 1) {
    const o = overlaps[0];
    return `Tu as déjà "${o.existing_task_name}" ${frenchDate(o.existing_next_due_at)} — je groupe avec ${frenchDate(o.subtask_next_due_at)} pour que tu y ailles qu'une fois ?`;
  }
  const head = overlaps.slice(0, 2).map((o) =>
    `"${o.existing_task_name}" (${frenchDate(o.existing_next_due_at)} ↔ ${frenchDate(o.subtask_next_due_at)})`,
  ).join(' et ');
  const extra = overlaps.length > 2 ? ` et ${overlaps.length - 2} autre${overlaps.length - 2 > 1 ? 's' : ''}` : '';
  return `J'ai ${overlaps.length} sous-tâches qui recoupent l'existant : ${head}${extra}. Je groupe pour t'éviter les doublons ?`;
}

// ---------------------------------------------------------------------------
// Sprint 16 v2 — l'interprétation de la réponse user passe désormais par
// `lib/overlapToolDispatch.ts` (Haiku tool use). Plus de router regex ici :
// quand le regex ratait, Sonnet hallucinait une confirmation sans agir
// (constaté en démo Jonathan, sprint 16 v1 abandonné). Tool use = action
// déterministe garantie. Cf. CHANGELOG 2026-04-27.
// ---------------------------------------------------------------------------
