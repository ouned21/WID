/**
 * Sprint 14 — Module partagé pour l'extraction + écriture de faits structurés
 * dans `phantom_members` (birth_date, school_class, allergies).
 *
 * Appelé par :
 *   - `app/api/ai/extract-memory/route.ts` (après Haiku, en complément)
 *   - `app/api/ai/parse-journal/route.ts` (inline, avant tout routage)
 *
 * Pourquoi inline dans parse-journal : Haiku est peu fiable sur le format
 * check-in (Q/R). Le regex déterministe catch les 3 patterns les plus
 * fréquents et écrit en DB de façon synchrone — pas de fire-and-forget.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────

export type StructuredField = 'birth_date' | 'school_class' | 'allergies';

export type StructuredUpdate = {
  member_name?: unknown;
  field?: unknown;
  value?: unknown;
  confidence?: unknown;
};

export type AppliedUpdate = {
  phantom_id: string;
  member_name: string;
  field: StructuredField;
  value: string | string[];
};

export type PhantomRow = {
  id: string;
  display_name: string;
  specifics: Record<string, unknown> | null;
};

// ── Utilities : normalisation + matching prénom ──────────────────────────

export function normalizeName(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function matchPhantomByName(
  name: string,
  phantoms: PhantomRow[],
): PhantomRow | null {
  const n = normalizeName(name);
  if (!n) return null;
  const exact = phantoms.filter((p) => normalizeName(p.display_name) === n);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const scored = phantoms
    .map((p) => ({ p, d: levenshtein(normalizeName(p.display_name), n) }))
    .sort((a, b) => a.d - b.d);
  if (scored.length === 0 || scored[0].d > 2) return null;
  if (scored.length === 1) return scored[0].p;
  if (scored[1].d - scored[0].d < 1) return null;
  return scored[0].p;
}

// ── Fallback regex déterministe ──────────────────────────────────────────

const MONTHS_FR: Record<string, number> = {
  janvier: 1, janv: 1, jan: 1,
  fevrier: 2, fev: 2,
  mars: 3,
  avril: 4, avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7,
  aout: 8,
  septembre: 9, sept: 9, sep: 9,
  octobre: 10, oct: 10,
  novembre: 11, nov: 11,
  decembre: 12, dec: 12,
};

function normalizeAccents(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function extractStructuredFallback(
  text: string,
  phantomNames: string[],
): StructuredUpdate[] {
  if (!text || phantomNames.length === 0) return [];
  const norm = normalizeAccents(text);
  const updates: StructuredUpdate[] = [];

  const phantomNorms = phantomNames.map((n) => ({ original: n, norm: normalizeAccents(n) }));

  const anniv1 = /anniv(?:ersaire)?\s+d[eu']?\s*([a-zA-ZÀ-ÿ-]+)[^\d]{0,40}?(\d{1,2})\s+(janvier|janv|jan|fevrier|fev|mars|avril|avr|mai|juin|juillet|juil|aout|septembre|sept|sep|octobre|oct|novembre|nov|decembre|dec)/gi;
  const anniv2 = /anniv(?:ersaire)?\s+d[eu']?\s*([a-zA-ZÀ-ÿ-]+)[^\d]{0,40}?(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/gi;

  let m: RegExpExecArray | null;

  while ((m = anniv1.exec(norm)) !== null) {
    const rawName = m[1];
    const day = parseInt(m[2], 10);
    const monthKey = m[3].replace(/\./g, '');
    const month = MONTHS_FR[monthKey];
    if (!month || day < 1 || day > 31) continue;
    const matched = phantomNorms.find((p) => p.norm === rawName);
    if (!matched) continue;
    const now = new Date();
    const currentYear = now.getFullYear();
    const thisYear = new Date(currentYear, month - 1, day);
    const year = thisYear.getTime() < now.getTime() - 86400000 ? currentYear + 1 : currentYear;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!updates.some((u) => u.member_name === matched.original && u.field === 'birth_date')) {
      updates.push({ member_name: matched.original, field: 'birth_date', value: iso, confidence: 0.92 });
    }
  }

  while ((m = anniv2.exec(norm)) !== null) {
    const rawName = m[1];
    const day = parseInt(m[2], 10);
    const month = parseInt(m[3], 10);
    let year = m[4] ? parseInt(m[4], 10) : NaN;
    if (!Number.isFinite(year)) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const thisYear = new Date(currentYear, month - 1, day);
      year = thisYear.getTime() < now.getTime() - 86400000 ? currentYear + 1 : currentYear;
    } else if (year < 100) {
      year += 2000;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    const matched = phantomNorms.find((p) => p.norm === rawName);
    if (!matched) continue;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!updates.some((u) => u.member_name === matched.original && u.field === 'birth_date')) {
      updates.push({ member_name: matched.original, field: 'birth_date', value: iso, confidence: 0.92 });
    }
  }

  const classRegex = /([a-zA-ZÀ-ÿ-]+)\s+(?:rentre|entre|passe|est)\s+en\s+(cp|ce1|ce2|cm1|cm2|6eme|6e|5eme|5e|4eme|4e|3eme|3e|seconde|premiere|terminale|petite\s+section|moyenne\s+section|grande\s+section|maternelle|creche)/gi;
  while ((m = classRegex.exec(norm)) !== null) {
    const rawName = m[1];
    const klass = m[2].trim();
    const matched = phantomNorms.find((p) => p.norm === rawName);
    if (!matched) continue;
    let displayClass: string;
    if (/(section|maternelle|creche|seconde|premiere|terminale)/.test(klass)) {
      displayClass = klass.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    } else {
      displayClass = klass.replace(/eme/, 'ème').toUpperCase();
    }
    if (!updates.some((u) => u.member_name === matched.original && u.field === 'school_class')) {
      updates.push({ member_name: matched.original, field: 'school_class', value: displayClass, confidence: 0.9 });
    }
  }

  const allergyRegex = /([a-zA-ZÀ-ÿ-]+)\s+(?:est\s+allergique|a\s+une\s+allergie)\s+(?:à\s+|a\s+|aux\s+|au\s+)?([a-zA-ZÀ-ÿ, -]+?)(?:\.|$|\n|,\s+(?:et|pour|mais))/gi;
  while ((m = allergyRegex.exec(norm)) !== null) {
    const rawName = m[1];
    const allergensRaw = m[2].trim();
    const matched = phantomNorms.find((p) => p.norm === rawName);
    if (!matched) continue;
    const allergens = allergensRaw
      .split(/,|\s+et\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 40);
    if (allergens.length === 0) continue;
    if (!updates.some((u) => u.member_name === matched.original && u.field === 'allergies')) {
      updates.push({ member_name: matched.original, field: 'allergies', value: allergens, confidence: 0.9 });
    }
  }

  return updates;
}

// ── Application en DB ────────────────────────────────────────────────────

function isIsoDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

export async function applyStructuredUpdates(args: {
  admin: SupabaseClient;
  householdId: string;
  journalId: string | null;
  phantoms: PhantomRow[];
  updates: StructuredUpdate[];
}): Promise<AppliedUpdate[]> {
  const { admin, householdId, journalId, phantoms, updates } = args;
  if (!Array.isArray(updates) || updates.length === 0) return [];

  const applied: AppliedUpdate[] = [];

  for (const u of updates) {
    const name = typeof u.member_name === 'string' ? u.member_name.trim() : '';
    const field = u.field;
    const value = u.value;
    const confidence = typeof u.confidence === 'number' ? u.confidence : 0;

    if (!name || confidence < 0.8) continue;
    if (field !== 'birth_date' && field !== 'school_class' && field !== 'allergies') continue;

    const match = matchPhantomByName(name, phantoms);
    if (!match) continue;

    const patch: Record<string, unknown> = {};
    let appliedValue: string | string[] | null = null;

    if (field === 'birth_date') {
      if (!isIsoDate(value)) continue;
      patch.birth_date = value;
      appliedValue = value;
    } else if (field === 'school_class') {
      if (typeof value !== 'string') continue;
      const v = value.trim().slice(0, 40);
      if (!v) continue;
      patch.school_class = v;
      appliedValue = v;
    } else if (field === 'allergies') {
      const arr = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
      const cleaned = arr
        .map((x) => (typeof x === 'string' ? x.trim().toLowerCase() : ''))
        .filter((x) => x.length > 1 && x.length < 60);
      if (cleaned.length === 0) continue;
      const existing = match.specifics && typeof match.specifics === 'object'
        ? (match.specifics as { allergies?: unknown }).allergies
        : undefined;
      const existingArr: string[] = Array.isArray(existing)
        ? existing.filter((x): x is string => typeof x === 'string')
        : [];
      const merged = Array.from(new Set([...existingArr.map((x) => x.toLowerCase().trim()), ...cleaned]));
      const nextSpecifics = { ...(match.specifics as Record<string, unknown> | null ?? {}), allergies: merged };
      patch.specifics = nextSpecifics;
      appliedValue = merged;
    }

    const { error } = await admin
      .from('phantom_members')
      .update(patch)
      .eq('id', match.id)
      .eq('household_id', householdId);

    if (error) {
      console.error('[structured-memory] update failed:', match.display_name, field, error.message);
      continue;
    }

    if (field === 'allergies') {
      match.specifics = patch.specifics as Record<string, unknown>;
    }

    const traceContent = field === 'birth_date'
      ? `Anniversaire de ${match.display_name} : ${appliedValue}`
      : field === 'school_class'
        ? `${match.display_name} est en ${appliedValue}`
        : `${match.display_name} — allergies : ${(appliedValue as string[]).join(', ')}`;

    await admin.from('agent_memory_facts').insert({
      household_id: householdId,
      about_phantom_id: match.id,
      about_user_id: null,
      fact_type: 'context',
      content: traceContent.slice(0, 500),
      confidence: Math.min(1, confidence),
      source_journal_id: journalId,
      is_active: true,
    });

    applied.push({
      phantom_id: match.id,
      member_name: match.display_name,
      field,
      value: appliedValue as string | string[],
    });
  }

  return applied;
}

export function mergeStructuredUpdates(
  haiku: StructuredUpdate[] | undefined,
  fallback: StructuredUpdate[],
): StructuredUpdate[] {
  const base: StructuredUpdate[] = Array.isArray(haiku) ? [...haiku] : [];
  for (const f of fallback) {
    const dup = base.some(
      (u) =>
        typeof u.member_name === 'string' &&
        typeof f.member_name === 'string' &&
        u.member_name.toLowerCase() === (f.member_name as string).toLowerCase() &&
        u.field === f.field,
    );
    if (!dup) base.push(f);
  }
  return base;
}
