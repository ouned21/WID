/**
 * Sprint 16 v2 — Tests d'intégration de dispatchOverlapWithHaiku.
 *
 * Mocks :
 *  - fetch (réponse Anthropic) injecté via fetchImpl
 *  - supabase / admin : stub minimal qui capture les opérations DB attendues
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchOverlapWithHaiku } from './overlapToolDispatch';
import type { PendingOverlapData } from './decomposeProjectCore';

// ─── Stub Supabase ────────────────────────────────────────────────────────

type DbCall =
  | { op: 'select'; table: string; filters: Record<string, unknown>; result: unknown }
  | { op: 'update'; table: string; payload: Record<string, unknown>; filters: Record<string, unknown> }
  | { op: 'insert'; table: string; rows: unknown[] };

function makeSupabaseStub(
  selectResults: Record<string, unknown[]> = {},
): { client: any; calls: DbCall[] } {
  const calls: DbCall[] = [];

  function makeQuery(table: string) {
    const filters: Record<string, unknown> = {};
    let updatePayload: Record<string, unknown> | null = null;
    let mode: 'idle' | 'select' | 'update' | 'insert' = 'idle';
    let selectColumns = '';

    const resolveResult = () => {
      if (mode === 'update' && updatePayload) {
        calls.push({ op: 'update', table, payload: updatePayload, filters: { ...filters } });
        return { error: null };
      }
      if (mode === 'select') {
        const key = `${table}:${selectColumns}`;
        const rows = selectResults[key] ?? [];
        calls.push({ op: 'select', table, filters: { ...filters }, result: rows });
        return { data: rows, error: null };
      }
      return { error: null };
    };

    const builder: any = {
      select(cols: string) {
        mode = 'select';
        selectColumns = cols;
        return builder;
      },
      eq(col: string, val: unknown) {
        filters[col] = val;
        return builder;
      },
      contains(col: string, val: unknown) {
        filters[`${col}@>`] = val;
        return builder;
      },
      maybeSingle() {
        const key = `${table}:${selectColumns}`;
        const rows = selectResults[key] ?? [];
        const result = { data: rows[0] ?? null, error: null };
        calls.push({ op: 'select', table, filters: { ...filters }, result: result.data });
        return Promise.resolve(result);
      },
      update(payload: Record<string, unknown>) {
        mode = 'update';
        updatePayload = payload;
        return builder;
      },
      insert(rows: unknown[]) {
        mode = 'insert';
        const arr = Array.isArray(rows) ? rows : [rows];
        calls.push({ op: 'insert', table, rows: arr });
        return Promise.resolve({ error: null });
      },
      then(onResolve: (v: unknown) => unknown, onReject?: (e: unknown) => unknown) {
        return Promise.resolve(resolveResult()).then(onResolve, onReject);
      },
    };
    return builder;
  }

  return {
    client: { from: (table: string) => makeQuery(table) },
    calls,
  };
}

// ─── Mock Anthropic responses ─────────────────────────────────────────────

function makeFetch(responseBody: unknown, ok = true): typeof fetch {
  return (async () => ({
    ok,
    text: async () => JSON.stringify(responseBody),
    json: async () => responseBody,
  })) as unknown as typeof fetch;
}

function makeFetchTimeout(): typeof fetch {
  return (async () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    throw err;
  }) as unknown as typeof fetch;
}

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makePendingOverlap(): PendingOverlapData {
  return {
    parent_id: 'parent-1',
    project_title: 'Déjeuner dimanche',
    project_target_date: '2026-05-03',
    pending_subtasks: [
      {
        name: 'Faire les courses pour dimanche',
        duration_estimate: 'long',
        next_due_at: '2026-05-02T10:00:00.000Z',
        assigned_to: null,
        assigned_phantom_id: null,
        notes: null,
      },
    ],
    overlaps: [
      {
        existing_task_id: 'rec-1',
        existing_task_name: 'Faire les courses',
        existing_next_due_at: '2026-04-29T17:00:00.000Z',
        subtask_name: 'Faire les courses pour dimanche',
        subtask_next_due_at: '2026-05-02T10:00:00.000Z',
      },
    ],
  };
}

function baseInput(extra: Partial<Parameters<typeof dispatchOverlapWithHaiku>[0]> = {}) {
  const sup = makeSupabaseStub({
    'household_tasks:covers_project_ids': [{ covers_project_ids: [] }],
    'task_categories:id, name': [{ id: 'cat-1', name: 'Gestion du foyer' }],
  });
  const adm = makeSupabaseStub({
    'household_tasks:covers_project_ids': [{ covers_project_ids: [] }],
  });
  return {
    pendingOverlap: makePendingOverlap(),
    questionAsked: 'propose de grouper "Faire les courses" avec Déjeuner dimanche',
    userResponse: 'ok groupe',
    householdId: 'h-1',
    userId: 'u-1',
    supabase: sup.client,
    admin: adm.client,
    now: new Date('2026-04-25T10:00:00.000Z'),
    fetchImpl: makeFetch({ content: [] }),
    ...extra,
    _supCalls: sup.calls,
    _admCalls: adm.calls,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
});

describe('dispatchOverlapWithHaiku — group_recurring tool', () => {
  it('exécute UPDATE next_due_at + covers_project_ids sur la récurrente', async () => {
    const input = baseInput({
      fetchImpl: makeFetch({
        content: [
          { type: 'text', text: 'OK je groupe les courses sur dimanche !' },
          { type: 'tool_use', id: 't1', name: 'group_recurring', input: {} },
        ],
        usage: { input_tokens: 100, output_tokens: 30 },
      }),
    });

    const r = await dispatchOverlapWithHaiku(input);

    expect(r.action).toBe('group');
    expect(r.aiResponse).toContain('groupe');

    const updates = input._admCalls.filter((c) => c.op === 'update' && c.table === 'household_tasks');
    expect(updates).toHaveLength(1);
    expect((updates[0] as any).payload.next_due_at).toBe('2026-05-02T10:00:00.000Z');
    expect((updates[0] as any).payload.covers_project_ids).toEqual(['parent-1']);
    expect((updates[0] as any).filters.id).toBe('rec-1');
  });

  it('préfère le texte généré par Haiku au message canned si Haiku produit un texte', async () => {
    const input = baseInput({
      fetchImpl: makeFetch({
        content: [
          { type: 'text', text: 'Top, je décale tes courses au dimanche pour pas y aller deux fois.' },
          { type: 'tool_use', id: 't1', name: 'group_recurring', input: {} },
        ],
      }),
    });
    const r = await dispatchOverlapWithHaiku(input);
    expect(r.aiResponse).toBe('Top, je décale tes courses au dimanche pour pas y aller deux fois.');
  });
});

describe('dispatchOverlapWithHaiku — keep_both tool', () => {
  it('insère les pending_subtasks dans household_tasks', async () => {
    const input = baseInput({
      userResponse: 'non garde les deux',
      fetchImpl: makeFetch({
        content: [
          { type: 'text', text: 'OK gardées séparément.' },
          { type: 'tool_use', id: 't1', name: 'keep_both', input: {} },
        ],
      }),
    });

    const r = await dispatchOverlapWithHaiku(input);

    expect(r.action).toBe('keep_both');
    const inserts = input._admCalls.filter((c) => c.op === 'insert' && c.table === 'household_tasks');
    expect(inserts).toHaveLength(1);
    const rows = (inserts[0] as any).rows as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Faire les courses pour dimanche');
    expect(rows[0].parent_project_id).toBe('parent-1');
  });
});

describe('dispatchOverlapWithHaiku — reschedule_recurring tool', () => {
  it('exécute UPDATE next_due_at à la date fournie par Haiku', async () => {
    const input = baseInput({
      userResponse: 'décale plutôt au samedi 2 mai',
      fetchImpl: makeFetch({
        content: [
          { type: 'text', text: 'OK décalée au samedi.' },
          {
            type: 'tool_use',
            id: 't1',
            name: 'reschedule_recurring',
            input: { new_date_iso: '2026-05-02T09:00:00.000Z' },
          },
        ],
      }),
    });

    const r = await dispatchOverlapWithHaiku(input);

    expect(r.action).toBe('reschedule');
    const updates = input._admCalls.filter((c) => c.op === 'update' && c.table === 'household_tasks');
    expect((updates[0] as any).payload.next_due_at).toBe('2026-05-02T09:00:00.000Z');
    expect((updates[0] as any).payload.covers_project_ids).toEqual(['parent-1']);
  });

  it('fallback keep_both si new_date_iso est invalide', async () => {
    const input = baseInput({
      userResponse: 'décale',
      fetchImpl: makeFetch({
        content: [
          {
            type: 'tool_use',
            id: 't1',
            name: 'reschedule_recurring',
            input: { new_date_iso: 'pas-une-date' },
          },
        ],
      }),
    });

    const r = await dispatchOverlapWithHaiku(input);

    expect(r.action).toBe('fallback');
    const inserts = input._admCalls.filter((c) => c.op === 'insert' && c.table === 'household_tasks');
    expect(inserts).toHaveLength(1);
  });
});

describe('dispatchOverlapWithHaiku — fallback paths', () => {
  it('fallback keep_both silencieux si Haiku ne choisit aucun tool', async () => {
    const input = baseInput({
      userResponse: 'je sais pas trop, on verra',
      fetchImpl: makeFetch({
        content: [{ type: 'text', text: 'Hmm pas sûre.' }],
        stop_reason: 'end_turn',
      }),
    });

    const r = await dispatchOverlapWithHaiku(input);

    expect(r.action).toBe('fallback');
    const inserts = input._admCalls.filter((c) => c.op === 'insert' && c.table === 'household_tasks');
    expect(inserts).toHaveLength(1);
  });

  it('fallback keep_both sur timeout fetch', async () => {
    const input = baseInput({ fetchImpl: makeFetchTimeout() });
    const r = await dispatchOverlapWithHaiku(input);
    expect(r.action).toBe('fallback');
    const inserts = input._admCalls.filter((c) => c.op === 'insert' && c.table === 'household_tasks');
    expect(inserts).toHaveLength(1);
  });

  it('fallback keep_both si nom de tool inconnu (Haiku hallucine)', async () => {
    const input = baseInput({
      fetchImpl: makeFetch({
        content: [{ type: 'tool_use', id: 't1', name: 'group_and_dance', input: {} }],
      }),
    });
    const r = await dispatchOverlapWithHaiku(input);
    expect(r.action).toBe('fallback');
  });

  it('fallback keep_both si pas de clé API', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const input = baseInput();
    const r = await dispatchOverlapWithHaiku(input);
    expect(r.action).toBe('fallback');
  });
});

describe('dispatchOverlapWithHaiku — multi-overlap (preco #4)', () => {
  it('group applique UPDATE sur chaque récurrente avec sa propre subtask_next_due_at', async () => {
    const sup = makeSupabaseStub({
      'household_tasks:covers_project_ids': [{ covers_project_ids: [] }],
    });
    const adm = makeSupabaseStub({
      'household_tasks:covers_project_ids': [{ covers_project_ids: [] }],
    });
    const multi: PendingOverlapData = {
      parent_id: 'parent-1',
      project_title: 'Anniv Léa',
      project_target_date: '2026-05-10',
      pending_subtasks: [],
      overlaps: [
        {
          existing_task_id: 'rec-courses',
          existing_task_name: 'Courses hebdo',
          existing_next_due_at: '2026-05-06T17:00:00.000Z',
          subtask_name: 'Courses pour anniv',
          subtask_next_due_at: '2026-05-09T10:00:00.000Z',
        },
        {
          existing_task_id: 'rec-menage',
          existing_task_name: 'Ménage hebdo',
          existing_next_due_at: '2026-05-07T17:00:00.000Z',
          subtask_name: 'Ranger pour anniv',
          subtask_next_due_at: '2026-05-09T08:00:00.000Z',
        },
      ],
    };

    const r = await dispatchOverlapWithHaiku({
      pendingOverlap: multi,
      questionAsked: 'multi',
      userResponse: 'génial fais ça',
      householdId: 'h-1',
      userId: 'u-1',
      supabase: sup.client,
      admin: adm.client,
      fetchImpl: makeFetch({
        content: [{ type: 'tool_use', id: 't1', name: 'group_recurring', input: {} }],
      }),
    });

    expect(r.action).toBe('group');
    const updates = adm.calls.filter((c) => c.op === 'update' && c.table === 'household_tasks');
    expect(updates).toHaveLength(2);
    const byId = Object.fromEntries(
      updates.map((u: any) => [u.filters.id, u.payload.next_due_at]),
    );
    expect(byId['rec-courses']).toBe('2026-05-09T10:00:00.000Z');
    expect(byId['rec-menage']).toBe('2026-05-09T08:00:00.000Z');
  });
});
