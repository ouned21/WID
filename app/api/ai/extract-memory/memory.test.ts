import { describe, it, expect, vi } from 'vitest';
import {
  normalizeName,
  levenshtein,
  matchPhantomByName,
  applyStructuredUpdates,
  extractStructuredFallback,
} from '../../../../lib/structuredMemory';

type PhantomRow = { id: string; display_name: string; specifics: Record<string, unknown> | null };

describe('normalizeName', () => {
  it('retire accents, casse, ponctuation', () => {
    expect(normalizeName('Éva')).toBe('eva');
    expect(normalizeName(' Léa-Marie ')).toBe('leamarie');
    expect(normalizeName('TINA')).toBe('tina');
  });
});

describe('levenshtein', () => {
  it('0 si identiques', () => {
    expect(levenshtein('eva', 'eva')).toBe(0);
  });
  it('distance 1 par substitution', () => {
    expect(levenshtein('eva', 'ava')).toBe(1);
  });
  it('distance 2 raisonnable', () => {
    expect(levenshtein('tina', 'tino')).toBe(1);
    expect(levenshtein('tina', 'tinas')).toBe(1);
  });
});

describe('matchPhantomByName', () => {
  const phantoms: PhantomRow[] = [
    { id: 'p1', display_name: 'Eva',  specifics: null },
    { id: 'p2', display_name: 'Tina', specifics: null },
    { id: 'p3', display_name: 'Léa',  specifics: null },
  ];

  it('match exact insensible à la casse/accents', () => {
    expect(matchPhantomByName('eva', phantoms)?.id).toBe('p1');
    expect(matchPhantomByName('ÉVA', phantoms)?.id).toBe('p1');
    expect(matchPhantomByName('lea', phantoms)?.id).toBe('p3');
  });

  it('fallback fuzzy si typo ≤ 2', () => {
    expect(matchPhantomByName('Eeva', phantoms)?.id).toBe('p1');
    expect(matchPhantomByName('Tima', phantoms)?.id).toBe('p2');
  });

  it('retourne null si ambigu (2 phantoms même prénom)', () => {
    const ambiguous: PhantomRow[] = [
      { id: 'a', display_name: 'Eva', specifics: null },
      { id: 'b', display_name: 'Eva', specifics: null },
    ];
    expect(matchPhantomByName('Eva', ambiguous)).toBeNull();
  });

  it('retourne null si personne ne match', () => {
    expect(matchPhantomByName('Bartholomew', phantoms)).toBeNull();
  });
});

// ── applyStructuredUpdates ────────────────────────────────────────────────
function makeAdmin() {
  const calls: Array<{ table: string; op: string; patch?: unknown; where?: unknown }> = [];
  const builder = (table: string) => {
    let current: { patch?: unknown; where?: Record<string, unknown> } = {};
    const api = {
      update(patch: unknown) {
        current.patch = patch;
        return api;
      },
      eq(col: string, val: unknown) {
        current.where = { ...(current.where ?? {}), [col]: val };
        return api;
      },
      async insert(patch: unknown) {
        calls.push({ table, op: 'insert', patch });
        return { error: null };
      },
      // Terminal : résout la promesse pour les chains update().eq().eq()
      then(onResolve: (r: { error: null }) => unknown) {
        calls.push({ table, op: 'update', patch: current.patch, where: current.where });
        return Promise.resolve({ error: null }).then(onResolve);
      },
    };
    return api;
  };
  return {
    from: (table: string) => builder(table),
    _calls: calls,
  };
}

describe('applyStructuredUpdates', () => {
  const phantoms: PhantomRow[] = [
    { id: 'p1', display_name: 'Eva', specifics: { allergies: ['arachides'] } },
    { id: 'p2', display_name: 'Tina', specifics: null },
  ];

  it('écrit birth_date si confidence ≥ 0.8 et match prénom', async () => {
    const admin = makeAdmin();
    const applied = await applyStructuredUpdates({
      admin: admin as never,
      householdId: 'h1',
      journalId: null,
      phantoms: phantoms.map((p) => ({ ...p })),
      updates: [{ member_name: 'Eva', field: 'birth_date', value: '2019-05-13', confidence: 0.95 }],
    });
    expect(applied).toHaveLength(1);
    expect(applied[0]).toMatchObject({ phantom_id: 'p1', field: 'birth_date', value: '2019-05-13' });
    const updateCall = admin._calls.find((c) => c.op === 'update');
    expect(updateCall?.patch).toEqual({ birth_date: '2019-05-13' });
  });

  it('skip si confidence < 0.8', async () => {
    const admin = makeAdmin();
    const applied = await applyStructuredUpdates({
      admin: admin as never,
      householdId: 'h1',
      journalId: null,
      phantoms: phantoms.map((p) => ({ ...p })),
      updates: [{ member_name: 'Eva', field: 'birth_date', value: '2019-05-13', confidence: 0.5 }],
    });
    expect(applied).toHaveLength(0);
    expect(admin._calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });

  it('skip si date non-ISO (ex: "13 mai" non converti)', async () => {
    const admin = makeAdmin();
    const applied = await applyStructuredUpdates({
      admin: admin as never,
      householdId: 'h1',
      journalId: null,
      phantoms: phantoms.map((p) => ({ ...p })),
      updates: [{ member_name: 'Eva', field: 'birth_date', value: '13 mai', confidence: 0.9 }],
    });
    expect(applied).toHaveLength(0);
  });

  it('skip si prénom ambigu (2 phantoms même nom)', async () => {
    const admin = makeAdmin();
    const applied = await applyStructuredUpdates({
      admin: admin as never,
      householdId: 'h1',
      journalId: null,
      phantoms: [
        { id: 'a', display_name: 'Eva', specifics: null },
        { id: 'b', display_name: 'Eva', specifics: null },
      ],
      updates: [{ member_name: 'Eva', field: 'school_class', value: 'CE1', confidence: 0.9 }],
    });
    expect(applied).toHaveLength(0);
  });

  it('merge allergies sans écraser', async () => {
    const admin = makeAdmin();
    const phantomsCopy = phantoms.map((p) => ({ ...p, specifics: p.specifics ? { ...p.specifics } : null }));
    const applied = await applyStructuredUpdates({
      admin: admin as never,
      householdId: 'h1',
      journalId: null,
      phantoms: phantomsCopy,
      updates: [{ member_name: 'Eva', field: 'allergies', value: ['fruits à coque'], confidence: 0.9 }],
    });
    expect(applied).toHaveLength(1);
    expect(applied[0].value).toEqual(['arachides', 'fruits à coque']);
    const updateCall = admin._calls.find((c) => c.op === 'update');
    expect(updateCall?.patch).toEqual({ specifics: { allergies: ['arachides', 'fruits à coque'] } });
  });

  it('extractStructuredFallback — anniv format check-in', () => {
    const updates = extractStructuredFallback(
      "Comment ça va ? l'anniversaire d'Eva c'est le 13 mai\n\nEt à la maison ? ok",
      ['Eva', 'Tina'],
    );
    const eva = updates.find((u) => u.member_name === 'Eva' && u.field === 'birth_date');
    expect(eva).toBeTruthy();
    expect(typeof eva!.value).toBe('string');
    expect(eva!.value).toMatch(/^\d{4}-05-13$/);
  });

  it('extractStructuredFallback — classe scolaire', () => {
    const updates = extractStructuredFallback('Tina rentre en CE1 en septembre', ['Eva', 'Tina']);
    expect(updates).toContainEqual(expect.objectContaining({
      member_name: 'Tina', field: 'school_class', value: 'CE1',
    }));
  });

  it('extractStructuredFallback — allergie', () => {
    const updates = extractStructuredFallback('Eva est allergique aux arachides', ['Eva']);
    expect(updates).toContainEqual(expect.objectContaining({
      member_name: 'Eva', field: 'allergies',
    }));
    const a = updates.find((u) => u.field === 'allergies');
    expect(a!.value).toEqual(['arachides']);
  });

  it('extractStructuredFallback — skip si prénom pas dans phantoms', () => {
    const updates = extractStructuredFallback("l'anniv de Bertrand c'est le 3 mars", ['Eva', 'Tina']);
    expect(updates).toHaveLength(0);
  });

  it('extractStructuredFallback — date relative ignorée (pas de match regex)', () => {
    const updates = extractStructuredFallback("l'anniv de Tina c'est dans 2 mois", ['Tina']);
    expect(updates.filter((u) => u.field === 'birth_date')).toHaveLength(0);
  });

  it('écrit school_class tel quel (pas de normalisation)', async () => {
    const admin = makeAdmin();
    const applied = await applyStructuredUpdates({
      admin: admin as never,
      householdId: 'h1',
      journalId: null,
      phantoms: phantoms.map((p) => ({ ...p })),
      updates: [{ member_name: 'Tina', field: 'school_class', value: 'Grande Section', confidence: 0.9 }],
    });
    expect(applied).toHaveLength(1);
    expect(applied[0].value).toBe('Grande Section');
  });
});
