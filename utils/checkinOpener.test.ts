import { describe, it, expect } from 'vitest';
import {
  daysUntilNextBirthday,
  buildOpenerCandidates,
  pickOpenerWithRotation,
  isMemoryEmpty,
  buildContextBlock,
  type OpenerContext,
} from './checkinOpener';

const emptyCtx: OpenerContext = {
  members: [],
  observations: [],
  narrative: null,
  facts: [],
  recentTurns: [],
  lastOpenerSourceDetail: null,
};

function iso(now: Date, offsetHours: number): string {
  return new Date(now.getTime() + offsetHours * 3_600_000).toISOString();
}

/** Retourne une date ISO YYYY-MM-DD décalée de `days` jours à partir de `now`. */
function isoDateOffset(now: Date, days: number): string {
  const d = new Date(now.getTime() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

describe('daysUntilNextBirthday', () => {
  it('compte les jours jusqu\'au prochain anniv (même année)', () => {
    const now = new Date(Date.UTC(2026, 4, 1)); // 1er mai 2026
    expect(daysUntilNextBirthday('2020-05-13', now)).toBe(12);
  });

  it('bascule sur l\'année suivante si l\'anniv est passé', () => {
    const now = new Date(Date.UTC(2026, 4, 20)); // 20 mai
    // anniv 13 mai → passé → prochain = 13 mai 2027 → ~358j
    const d = daysUntilNextBirthday('2020-05-13', now);
    expect(d).toBeGreaterThan(350);
    expect(d).toBeLessThan(370);
  });

  it('retourne 0 le jour même', () => {
    const now = new Date(Date.UTC(2026, 4, 13));
    expect(daysUntilNextBirthday('2020-05-13', now)).toBe(0);
  });

  it('retourne null sur date invalide', () => {
    const now = new Date(Date.UTC(2026, 4, 1));
    expect(daysUntilNextBirthday('pas-une-date', now)).toBeNull();
  });
});

describe('buildOpenerCandidates — priorité', () => {
  const now = new Date(Date.UTC(2026, 4, 1, 20, 0)); // 1er mai 20h UTC

  it('fallback seul si contexte totalement vide', () => {
    const candidates = buildOpenerCandidates(emptyCtx, now);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].source).toBe('fallback');
  });

  it('anniv < 3j passe avant une observation alert', () => {
    const ctx: OpenerContext = {
      ...emptyCtx,
      members: [{ display_name: 'Eva', birth_date: '2020-05-03' }], // dans 2j
      observations: [{ type: 'cooking_drift', severity: 'alert', detected_at: iso(now, -2), payload: { days_without: 10 } }],
    };
    const candidates = buildOpenerCandidates(ctx, now);
    expect(candidates[0].source).toBe('upcoming_event_urgent');
    expect(candidates[0].source_detail).toContain('Eva');
    expect(candidates[1].source).toBe('observation_alert');
  });

  it('observation alert passe avant un anniv 3-7j', () => {
    const ctx: OpenerContext = {
      ...emptyCtx,
      members: [{ display_name: 'Eva', birth_date: '2020-05-06' }], // dans 5j
      observations: [{ type: 'cooking_drift', severity: 'alert', detected_at: iso(now, -2), payload: { days_without: 10 } }],
    };
    const candidates = buildOpenerCandidates(ctx, now);
    expect(candidates[0].source).toBe('observation_alert');
    expect(candidates[1].source).toBe('upcoming_event_near');
  });

  it('recent_mention < 48h utilisé si rien d\'urgent', () => {
    const ctx: OpenerContext = {
      ...emptyCtx,
      recentTurns: [
        { speaker: 'user', content: 'Léa couve quelque chose, elle a mal au ventre depuis ce midi.', created_at: iso(now, -20) },
      ],
    };
    const candidates = buildOpenerCandidates(ctx, now);
    expect(candidates[0].source).toBe('recent_mention');
    expect(candidates[0].directive).toContain('Léa couve');
  });

  it('ignore les turns > 48h et les turns trop courts', () => {
    const ctx: OpenerContext = {
      ...emptyCtx,
      recentTurns: [
        { speaker: 'user', content: 'ok', created_at: iso(now, -1) },
        { speaker: 'user', content: 'Discussion longue et pertinente sur le quotidien.', created_at: iso(now, -60) }, // > 48h
      ],
    };
    const candidates = buildOpenerCandidates(ctx, now);
    expect(candidates.every((c) => c.source !== 'recent_mention')).toBe(true);
  });

  it('anniv 20j → bucket far (entre recent_mention et narrative)', () => {
    const ctx: OpenerContext = {
      ...emptyCtx,
      members: [{ display_name: 'Eva', birth_date: isoDateOffset(now, 20) }],
      narrative: 'Foyer de quatre avec trois enfants en bas âge.',
    };
    const candidates = buildOpenerCandidates(ctx, now);
    const farIdx = candidates.findIndex((c) => c.source === 'upcoming_event_far');
    const narrIdx = candidates.findIndex((c) => c.source === 'narrative');
    expect(farIdx).toBeGreaterThanOrEqual(0);
    expect(farIdx).toBeLessThan(narrIdx);
    expect(candidates[farIdx].source_detail).toContain('Eva');
    expect(candidates[farIdx].directive).toContain('20');
  });

  it('anniv > 30j → aucun candidat event', () => {
    const ctx: OpenerContext = {
      ...emptyCtx,
      members: [{ display_name: 'Eva', birth_date: isoDateOffset(now, 45) }],
    };
    const candidates = buildOpenerCandidates(ctx, now);
    expect(candidates.every((c) => !c.source.startsWith('upcoming_event'))).toBe(true);
  });

  it('facts-based candidat si ≥ 3 faits et pas d\'autre signal', () => {
    const ctx: OpenerContext = {
      ...emptyCtx,
      facts: [
        { content: 'Barbara travaille tard le jeudi' },
        { content: 'Eva allergique aux arachides' },
        { content: 'Week-end prévu chez les parents' },
      ],
    };
    const candidates = buildOpenerCandidates(ctx, now);
    expect(candidates[0].source).toBe('facts');
  });

  it('facts-based sous narrative quand les deux présents', () => {
    const ctx: OpenerContext = {
      ...emptyCtx,
      narrative: 'Portrait du foyer suffisamment long et riche.',
      facts: [
        { content: 'fait 1' }, { content: 'fait 2' }, { content: 'fait 3' },
      ],
    };
    const candidates = buildOpenerCandidates(ctx, now);
    const narrIdx = candidates.findIndex((c) => c.source === 'narrative');
    const factsIdx = candidates.findIndex((c) => c.source === 'facts');
    expect(narrIdx).toBeLessThan(factsIdx);
  });

  it('< 3 faits → pas de candidat facts', () => {
    const ctx: OpenerContext = {
      ...emptyCtx,
      facts: [{ content: 'fait 1' }, { content: 'fait 2' }],
    };
    const candidates = buildOpenerCandidates(ctx, now);
    expect(candidates.every((c) => c.source !== 'facts')).toBe(true);
  });

  it('narrative si rien d\'autre mais portrait existe', () => {
    const ctx: OpenerContext = {
      ...emptyCtx,
      narrative: 'Jonathan et Barbara gèrent un foyer avec trois enfants. Phase de surcharge depuis le déménagement.',
    };
    const candidates = buildOpenerCandidates(ctx, now);
    expect(candidates[0].source).toBe('narrative');
  });

  it('observations non-alert sont ignorées (info/notice)', () => {
    const ctx: OpenerContext = {
      ...emptyCtx,
      observations: [
        { type: 'cooking_drift', severity: 'notice', detected_at: iso(now, -1) },
        { type: 'balance_drift', severity: 'info', detected_at: iso(now, -1) },
      ],
    };
    const candidates = buildOpenerCandidates(ctx, now);
    expect(candidates.every((c) => c.source !== 'observation_alert')).toBe(true);
  });

  it('directive cooking_drift inclut le nombre de jours si payload présent', () => {
    const ctx: OpenerContext = {
      ...emptyCtx,
      observations: [{ type: 'cooking_drift', severity: 'alert', detected_at: iso(now, -1), payload: { days_without: 12 } }],
    };
    const candidates = buildOpenerCandidates(ctx, now);
    expect(candidates[0].directive).toContain('12');
  });
});

describe('pickOpenerWithRotation — anti-harcèlement', () => {
  const now = new Date(Date.UTC(2026, 4, 1, 20, 0));

  it('prend le premier candidat si pas de historique', () => {
    const candidates = buildOpenerCandidates(
      { ...emptyCtx, observations: [{ type: 'cooking_drift', severity: 'alert', detected_at: iso(now, -1), payload: {} }] },
      now,
    );
    const pick = pickOpenerWithRotation(candidates, null);
    expect(pick.source).toBe('observation_alert');
  });

  it('descend d\'un cran si même source_detail que la veille', () => {
    const ctx: OpenerContext = {
      ...emptyCtx,
      observations: [{ type: 'cooking_drift', severity: 'alert', detected_at: iso(now, -1), payload: {} }],
      narrative: 'Foyer en phase de surcharge.',
    };
    const candidates = buildOpenerCandidates(ctx, now);
    const pick = pickOpenerWithRotation(candidates, 'obs:cooking_drift');
    expect(pick.source).not.toBe('observation_alert');
    expect(pick.source).toBe('narrative');
  });

  it('revient au fallback si rotation épuise les candidats', () => {
    const ctx: OpenerContext = {
      ...emptyCtx,
      narrative: 'Foyer chaleureux.',
    };
    const candidates = buildOpenerCandidates(ctx, now);
    // 2 candidats : narrative + fallback
    const pick = pickOpenerWithRotation(candidates, 'narrative');
    expect(pick.source).toBe('fallback');
  });
});

describe('isMemoryEmpty — court-circuit Sonnet', () => {
  it('true sur contexte vide total', () => {
    expect(isMemoryEmpty(emptyCtx)).toBe(true);
  });

  it('true si 1-2 facts seulement (pas assez pour tailored)', () => {
    expect(isMemoryEmpty({ ...emptyCtx, facts: [{ content: 'Barbara travaille tard le jeudi' }] })).toBe(true);
  });

  it('false dès que 3 faits sont présents', () => {
    expect(isMemoryEmpty({
      ...emptyCtx,
      facts: [
        { content: 'Barbara travaille tard le jeudi' },
        { content: 'Eva allergique aux arachides' },
        { content: 'Tina est en CE1' },
      ],
    })).toBe(false);
  });

  it('false si narrative long assez', () => {
    expect(isMemoryEmpty({ ...emptyCtx, narrative: 'Un portrait suffisamment long pour compter.' })).toBe(false);
  });

  it('true si narrative présent mais trop court', () => {
    expect(isMemoryEmpty({ ...emptyCtx, narrative: 'court' })).toBe(true);
  });

  it('false si au moins un membre avec birth_date', () => {
    expect(isMemoryEmpty({ ...emptyCtx, members: [{ display_name: 'Eva', birth_date: '2020-05-13' }] })).toBe(false);
  });

  it('true si membre sans birth_date (pas encore personnalisable)', () => {
    expect(isMemoryEmpty({ ...emptyCtx, members: [{ display_name: 'Eva' }] })).toBe(true);
  });
});

describe('buildContextBlock', () => {
  const now = new Date(Date.UTC(2026, 4, 1, 20, 0));

  it('retourne un placeholder si rien à afficher', () => {
    expect(buildContextBlock(emptyCtx, now)).toBe('(mémoire limitée)');
  });

  it('inclut anniv imminent dans le bloc membres', () => {
    const block = buildContextBlock(
      { ...emptyCtx, members: [{ display_name: 'Eva', birth_date: '2020-05-08' }] },
      now,
    );
    expect(block).toContain('Eva');
    expect(block).toMatch(/anniv dans 7j/);
  });

  it('tronque les faits à 8 items max', () => {
    const facts = Array.from({ length: 20 }, (_, i) => ({ content: `Fait numéro ${i}` }));
    const block = buildContextBlock({ ...emptyCtx, facts }, now);
    expect(block).toContain('Fait numéro 0');
    expect(block).toContain('Fait numéro 7');
    expect(block).not.toContain('Fait numéro 8');
  });

  it('ignore les user turns > 72h', () => {
    const block = buildContextBlock(
      {
        ...emptyCtx,
        recentTurns: [{ speaker: 'user', content: 'message ancien très informatif', created_at: iso(now, -100) }],
      },
      now,
    );
    expect(block).not.toContain('message ancien');
  });
});
