import { describe, it, expect } from 'vitest';
import {
  detectOverlaps,
  interpretOverlapAnswer,
  buildOverlapQuestion,
  extractRescheduleDate,
  OVERLAP_SIMILARITY_THRESHOLD,
  type CandidateRecurringTask,
  type SubtaskForOverlap,
} from './overlapDetection';

// ─── detectOverlaps ────────────────────────────────────────────────────────

describe('detectOverlaps', () => {
  it('matches "courses pour dimanche" with weekly "faire les courses" wed within ±3j', () => {
    const wed = new Date('2026-04-29T17:00:00.000Z').toISOString();
    const sunday = new Date('2026-05-03T10:00:00.000Z').toISOString(); // 4 days
    const farSunday = new Date('2026-05-02T10:00:00.000Z').toISOString(); // 3 days exact

    const subtasks: SubtaskForOverlap[] = [
      { index: 0, name: 'Faire les courses pour le déjeuner dimanche', next_due_at: farSunday },
      { index: 1, name: 'Réserver le restau', next_due_at: farSunday },
    ];
    const candidates: CandidateRecurringTask[] = [
      { id: 'rec-1', name: 'Faire les courses', next_due_at: wed },
    ];
    const matches = detectOverlaps(subtasks, candidates);
    expect(matches).toHaveLength(1);
    expect(matches[0].subtask_index).toBe(0);
    expect(matches[0].existing_task_id).toBe('rec-1');
    expect(matches[0].similarity).toBeGreaterThanOrEqual(OVERLAP_SIMILARITY_THRESHOLD);
  });

  it('does NOT match outside ±3 days window', () => {
    const wed = new Date('2026-04-29T17:00:00.000Z').toISOString();
    const farSunday = new Date('2026-05-04T10:00:00.000Z').toISOString(); // 5 days
    const subtasks: SubtaskForOverlap[] = [
      { index: 0, name: 'Faire les courses pour le déjeuner', next_due_at: farSunday },
    ];
    const candidates: CandidateRecurringTask[] = [
      { id: 'rec-1', name: 'Faire les courses', next_due_at: wed },
    ];
    expect(detectOverlaps(subtasks, candidates)).toHaveLength(0);
  });

  it('does NOT match unrelated names ("réserver restau" vs "faire les courses")', () => {
    const wed = new Date('2026-04-29T17:00:00.000Z').toISOString();
    const subtasks: SubtaskForOverlap[] = [
      { index: 0, name: 'Réserver le restaurant', next_due_at: wed },
    ];
    const candidates: CandidateRecurringTask[] = [
      { id: 'rec-1', name: 'Faire les courses', next_due_at: wed },
    ];
    expect(detectOverlaps(subtasks, candidates)).toHaveLength(0);
  });

  it('keeps best match when multiple candidates compete', () => {
    const day = new Date('2026-04-29T10:00:00.000Z').toISOString();
    const subtasks: SubtaskForOverlap[] = [
      { index: 0, name: 'Faire les courses semaine', next_due_at: day },
    ];
    const candidates: CandidateRecurringTask[] = [
      { id: 'rec-bad', name: 'Courses appoint pharmacie', next_due_at: day },
      { id: 'rec-good', name: 'Faire les courses semaine', next_due_at: day },
    ];
    const matches = detectOverlaps(subtasks, candidates);
    expect(matches).toHaveLength(1);
    expect(matches[0].existing_task_id).toBe('rec-good');
  });

  it('returns empty when no candidates', () => {
    expect(detectOverlaps([{ index: 0, name: 'x', next_due_at: new Date().toISOString() }], [])).toEqual([]);
  });

  it('skips candidates with null next_due_at', () => {
    const day = new Date().toISOString();
    const subtasks: SubtaskForOverlap[] = [{ index: 0, name: 'Faire les courses', next_due_at: day }];
    const candidates: CandidateRecurringTask[] = [{ id: 'r', name: 'Faire les courses', next_due_at: null }];
    expect(detectOverlaps(subtasks, candidates)).toHaveLength(0);
  });
});

// ─── interpretOverlapAnswer ────────────────────────────────────────────────

describe('interpretOverlapAnswer', () => {
  const now = new Date('2026-04-25T10:00:00.000Z'); // a Saturday

  it('detects "ok groupe"', () => {
    expect(interpretOverlapAnswer('ok groupe', now).kind).toBe('group');
  });

  it('detects "oui fusionne"', () => {
    expect(interpretOverlapAnswer('oui fusionne stp', now).kind).toBe('group');
  });

  it('detects single "ok"', () => {
    expect(interpretOverlapAnswer('ok', now).kind).toBe('group');
  });

  it('detects "carrement vas-y"', () => {
    expect(interpretOverlapAnswer('carrément vas-y', now).kind).toBe('group');
  });

  it('detects "non garde les deux"', () => {
    expect(interpretOverlapAnswer('non garde les deux', now).kind).toBe('keep_both');
  });

  it('detects "les deux"', () => {
    expect(interpretOverlapAnswer('les deux', now).kind).toBe('keep_both');
  });

  it('detects "separement"', () => {
    expect(interpretOverlapAnswer('séparément', now).kind).toBe('keep_both');
  });

  it('detects "decale au samedi"', () => {
    const r = interpretOverlapAnswer('décale au samedi', now);
    expect(r.kind).toBe('reschedule');
    if (r.kind === 'reschedule') {
      expect(r.new_date_iso).not.toBeNull();
      // Saturday after 2026-04-25 (saturday) → next saturday
      expect(r.new_date_iso!.startsWith('2026-05-02')).toBe(true);
    }
  });

  it('detects "plutot demain"', () => {
    const r = interpretOverlapAnswer('plutôt demain', now);
    expect(r.kind).toBe('reschedule');
    if (r.kind === 'reschedule') {
      expect(r.new_date_iso!.startsWith('2026-04-26')).toBe(true);
    }
  });

  it('detects "decale au 27 mai"', () => {
    const r = interpretOverlapAnswer('décale au 27 mai', now);
    expect(r.kind).toBe('reschedule');
    if (r.kind === 'reschedule') {
      expect(r.new_date_iso!.startsWith('2026-05-27')).toBe(true);
    }
  });

  it('returns ambiguous on unrelated text', () => {
    expect(interpretOverlapAnswer('mouais bof', now).kind).toBe('ambiguous');
  });

  it('returns ambiguous on empty input', () => {
    expect(interpretOverlapAnswer('', now).kind).toBe('ambiguous');
  });
});

// ─── extractRescheduleDate ──────────────────────────────────────────────────

describe('extractRescheduleDate', () => {
  const now = new Date('2026-04-25T10:00:00.000Z'); // Saturday

  it('extracts demain', () => {
    expect(extractRescheduleDate('demain', now)).toMatch(/^2026-04-26/);
  });

  it('extracts apres-demain', () => {
    expect(extractRescheduleDate('après-demain', now)).toMatch(/^2026-04-27/);
  });

  it('returns null if no date found', () => {
    expect(extractRescheduleDate('plus tard quand je sais pas', now)).toBeNull();
  });
});

// ─── buildOverlapQuestion ───────────────────────────────────────────────────

describe('buildOverlapQuestion', () => {
  it('formulates single-overlap question', () => {
    const q = buildOverlapQuestion([{
      subtask_index: 0,
      subtask_name: 'Courses pour dimanche',
      subtask_next_due_at: '2026-05-02T10:00:00.000Z',
      existing_task_id: 'r',
      existing_task_name: 'Faire les courses',
      existing_next_due_at: '2026-04-29T17:00:00.000Z',
      similarity: 0.66,
    }]);
    expect(q).toContain('Faire les courses');
    expect(q).toContain('groupe');
  });

  it('formulates multi-overlap question (grouped, not sequential)', () => {
    const q = buildOverlapQuestion([
      {
        subtask_index: 0, subtask_name: 'Courses', subtask_next_due_at: '2026-05-02T10:00:00.000Z',
        existing_task_id: 'r1', existing_task_name: 'Faire les courses', existing_next_due_at: '2026-04-29T17:00:00.000Z',
        similarity: 0.6,
      },
      {
        subtask_index: 1, subtask_name: 'Ménage', subtask_next_due_at: '2026-05-02T10:00:00.000Z',
        existing_task_id: 'r2', existing_task_name: 'Ménage hebdo', existing_next_due_at: '2026-04-30T17:00:00.000Z',
        similarity: 0.55,
      },
    ]);
    expect(q).toContain('2 sous-tâches');
    expect(q).toContain('Faire les courses');
    expect(q).toContain('Ménage hebdo');
    expect(q).toContain('groupe');
  });

  it('returns empty string for empty list', () => {
    expect(buildOverlapQuestion([])).toBe('');
  });
});
