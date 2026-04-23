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
// Interprétation de la réponse user (réponse libre en chat)
// ---------------------------------------------------------------------------

export type OverlapDecision =
  | { kind: 'group' }
  | { kind: 'keep_both' }
  | { kind: 'reschedule'; new_date_iso: string | null }
  | { kind: 'ambiguous' };

const MONTHS_FR: Record<string, number> = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12,
};

const WEEKDAYS_FR: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
};

/**
 * Tente d'extraire une date relative ("samedi", "le 27 mai", "demain") depuis
 * un texte libre. Renvoie une ISO date à 09:00 UTC ou null si rien d'exploitable.
 * Volontairement minimal — gère les patterns les plus fréquents.
 */
export function extractRescheduleDate(text: string, now: Date = new Date()): string | null {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // "apres-demain" AVANT "demain" (sinon /\bdemain\b/ matche dans
  // "après-demain" et on perd le +2 jours)
  if (/\bapres.?demain\b/.test(t)) {
    const d = new Date(now); d.setUTCDate(d.getUTCDate() + 2);
    d.setUTCHours(9, 0, 0, 0);
    return d.toISOString();
  }
  if (/\bdemain\b/.test(t)) {
    const d = new Date(now); d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(9, 0, 0, 0);
    return d.toISOString();
  }
  // "samedi", "lundi prochain"
  for (const [name, dow] of Object.entries(WEEKDAYS_FR)) {
    const norm = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (new RegExp(`\\b${norm}\\b`).test(t)) {
      const d = new Date(now);
      const cur = d.getUTCDay();
      let delta = (dow - cur + 7) % 7;
      if (delta === 0) delta = 7;
      d.setUTCDate(d.getUTCDate() + delta);
      d.setUTCHours(9, 0, 0, 0);
      return d.toISOString();
    }
  }
  // "le 27 mai", "27 mai"
  const m = t.match(/\b(\d{1,2})\s+(janvier|fevrier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = MONTHS_FR[m[2]];
    if (day >= 1 && day <= 31 && month) {
      const year = now.getUTCFullYear();
      const d = new Date(Date.UTC(year, month - 1, day, 9, 0, 0));
      // Si la date est passée, prendre l'an prochain
      if (d.getTime() < now.getTime()) d.setUTCFullYear(year + 1);
      return d.toISOString();
    }
  }
  return null;
}

/**
 * Interprète la réponse en langage naturel de l'user à la question d'overlap.
 *
 * Heuristique regex (pas d'appel IA) — l'user répond généralement en quelques
 * mots. Si vraiment ambigu → on retourne 'ambiguous' et le router reformule
 * une fois, puis fallback keep_both (preco sprint 16).
 */
export function interpretOverlapAnswer(text: string, now: Date = new Date()): OverlapDecision {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!t) return { kind: 'ambiguous' };

  // "decale", "deplace", "bouge" → reschedule
  if (/\b(decale|deplace|bouge|repousse|reporte|change|mets?\s+(la|le)\s+(au|a\s+))/.test(t)
      || /\b(plutot|plut[oô]t)\s+(samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi|demain)\b/.test(t)) {
    const date = extractRescheduleDate(text, now);
    return { kind: 'reschedule', new_date_iso: date };
  }

  // "garde les deux", "non", "les deux", "separement"
  if (/\b(garde|conserve|laisse|maintiens?)\b.*\b(deux|les?\s*deux|deux?)\b/.test(t)
      || /\bles?\s*deux\b/.test(t)
      || /\bseparement?\b|\ba\s+cote\b|\ben\s+plus\b/.test(t)
      || /^non\b/.test(t)
      || /\bgarde\b.*\b(toutes?|tout)\b/.test(t)) {
    return { kind: 'keep_both' };
  }

  // "groupe", "fusionne", "ok", "oui", "vas-y"
  if (/\b(groupe|grouper|fusionne|fusionner|consolide|regroupe|combine|merge)\b/.test(t)
      || /^(ok|oui|d'?accord|carrement|carr[eé]ment|yes|ouais|parfait|nickel|allez\s*y|vas?\s*y|fais\s*comme\s*[cs]a|bonne\s*idee)\b/.test(t)) {
    return { kind: 'group' };
  }

  return { kind: 'ambiguous' };
}
