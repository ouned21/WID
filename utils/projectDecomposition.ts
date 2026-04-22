/**
 * Sprint 12 — Décomposition de projets complexes (M3)
 *
 * Utilitaires partagés entre le router (parse-journal) et l'endpoint
 * `/api/ai/decompose-project` :
 *  - Heuristique de détection "projet complexe" (regex)
 *  - Validator runtime du JSON Sonnet (pas de dép zod — validation manuelle
 *    alignée avec le style du repo, cf. utils/validation.ts)
 */

// ---------------------------------------------------------------------------
// Heuristique — détection projet
// ---------------------------------------------------------------------------

/**
 * Verbes déclenchant une décomposition.
 * Liste courte, volontairement conservatrice : on préfère rater un projet
 * (fallback → parseur journal normal) plutôt que décomposer à tort.
 */
const PROJECT_VERBS =
  /\b(organise[rz]?|pr[eé]pare[rz]?|planifie[rz]?|plann?ifie[rz]?|pr[eé]voi[rs]?|prépar(?:ons|er|ez|e|es)|organ[ie]s(?:ons|er|ez|e|es))\b/i;

/**
 * Objets multi-tâches : évènements/moments qui supposent plusieurs étapes.
 * Sans cet ancrage, "prépare le café" → pas un projet.
 */
const PROJECT_OBJECTS =
  /\b(d[eé]jeuner|d[îi]ner|brunch|goûter|go[uû]ter|ap[eé]ro|fête|fete|f[eê]te|soir[eé]e|anniversaire|baby\s*shower|bapt[eê]me|week.?end|weekend|vacances|s[eé]jour|voyage|sortie|pique.?nique|rentr[eé]e|d[eé]m[eé]nagement|mariage|b[eé]b[eé]|travaux|r[eé]novation|am[eé]nagement|r[eé]ception|visite|invit[eé]s?|r[eé]union|rendez.?vous|rdv|m[eé]nage\s+de\s+printemps)\b/i;

export function detectProjectIntent(text: string): boolean {
  if (!text || text.length < 15) return false;
  return PROJECT_VERBS.test(text) && PROJECT_OBJECTS.test(text);
}

// ---------------------------------------------------------------------------
// Types sortie Sonnet
// ---------------------------------------------------------------------------

export type DecomposedSubtask = {
  name: string;
  duration_estimate: 'very_short' | 'short' | 'medium' | 'long' | 'very_long';
  next_due_at: string;              // ISO date
  assigned_to: string | null;       // UUID profile (adulte connecté) — mutex avec assigned_phantom_id
  assigned_phantom_id: string | null; // UUID phantom_members (Barbara, enfant, autre) — mutex avec assigned_to
  notes: string | null;             // contexte court, 0-140 chars
};

export type DecomposedProject = {
  title: string;
  description: string | null;
  target_date: string | null;       // ISO date cible (ex: déjeuner dimanche)
};

export type DecompositionResult = {
  project: DecomposedProject;
  subtasks: DecomposedSubtask[];
  pending_question: string | null;  // si renseigné : Yova demande 1 info
  pending_missing: string | null;   // champ manquant (ex: "guest_count")
};

const DURATION_VALUES = new Set(['very_short', 'short', 'medium', 'long', 'very_long']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ValidationError extends Error {}

function asStr(v: unknown, field: string, max = 500): string {
  if (typeof v !== 'string') throw new ValidationError(`${field} must be a string`);
  const t = v.trim();
  if (t.length === 0) throw new ValidationError(`${field} is empty`);
  if (t.length > max) throw new ValidationError(`${field} exceeds ${max} chars`);
  return t;
}

function asNullableStr(v: unknown, field: string, max = 500): string | null {
  if (v == null || v === '') return null;
  return asStr(v, field, max);
}

/**
 * Valide et normalise le JSON retourné par Sonnet.
 * Soit un projet complet, soit un pending_question (mais pas les deux).
 * Jette ValidationError si quoi que ce soit est malformé.
 */
export function validateDecomposition(raw: unknown): DecompositionResult {
  if (!raw || typeof raw !== 'object') throw new ValidationError('payload must be object');
  const r = raw as Record<string, unknown>;

  // Cas pending_question prioritaire
  const pendingQ = typeof r.pending_question === 'string' && r.pending_question.trim().length > 0
    ? r.pending_question.trim().slice(0, 300)
    : null;
  const pendingM = typeof r.pending_missing === 'string' && r.pending_missing.trim().length > 0
    ? r.pending_missing.trim().slice(0, 50)
    : null;

  if (pendingQ) {
    // Flow "question unique" — on ne valide pas le projet
    return {
      project: { title: '', description: null, target_date: null },
      subtasks: [],
      pending_question: pendingQ,
      pending_missing: pendingM,
    };
  }

  // Flow décomposition complète
  const rawProject = r.project;
  if (!rawProject || typeof rawProject !== 'object') {
    throw new ValidationError('project missing');
  }
  const p = rawProject as Record<string, unknown>;
  const project: DecomposedProject = {
    title: asStr(p.title, 'project.title', 120),
    description: asNullableStr(p.description, 'project.description', 500),
    target_date: asNullableStr(p.target_date, 'project.target_date', 30),
  };
  if (project.target_date && !ISO_DATE.test(project.target_date)) {
    throw new ValidationError('project.target_date not ISO');
  }

  const rawSubs = r.subtasks;
  if (!Array.isArray(rawSubs)) throw new ValidationError('subtasks must be array');
  if (rawSubs.length < 2) throw new ValidationError('subtasks must have >= 2 items');
  if (rawSubs.length > 8) throw new ValidationError('subtasks must have <= 8 items');

  const subtasks: DecomposedSubtask[] = rawSubs.map((s, i) => {
    if (!s || typeof s !== 'object') throw new ValidationError(`subtasks[${i}] not object`);
    const x = s as Record<string, unknown>;
    const duration = typeof x.duration_estimate === 'string' ? x.duration_estimate : 'short';
    if (!DURATION_VALUES.has(duration)) {
      throw new ValidationError(`subtasks[${i}].duration_estimate invalid`);
    }
    const nextDue = asStr(x.next_due_at, `subtasks[${i}].next_due_at`, 30);
    if (!ISO_DATE.test(nextDue)) {
      throw new ValidationError(`subtasks[${i}].next_due_at not ISO`);
    }
    let assigned: string | null = null;
    if (x.assigned_to != null && x.assigned_to !== '') {
      const s2 = String(x.assigned_to);
      if (!UUID.test(s2)) throw new ValidationError(`subtasks[${i}].assigned_to not UUID`);
      assigned = s2;
    }
    let assignedPhantom: string | null = null;
    if (x.assigned_phantom_id != null && x.assigned_phantom_id !== '') {
      const s2 = String(x.assigned_phantom_id);
      if (!UUID.test(s2)) throw new ValidationError(`subtasks[${i}].assigned_phantom_id not UUID`);
      assignedPhantom = s2;
    }
    if (assigned && assignedPhantom) {
      throw new ValidationError(`subtasks[${i}] cannot set both assigned_to and assigned_phantom_id`);
    }
    return {
      name: asStr(x.name, `subtasks[${i}].name`, 100),
      duration_estimate: duration as DecomposedSubtask['duration_estimate'],
      next_due_at: nextDue,
      assigned_to: assigned,
      assigned_phantom_id: assignedPhantom,
      notes: asNullableStr(x.notes, `subtasks[${i}].notes`, 140),
    };
  });

  return { project, subtasks, pending_question: null, pending_missing: null };
}
