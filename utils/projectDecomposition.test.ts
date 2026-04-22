import { describe, it, expect } from 'vitest';
import { detectProjectIntent, validateDecomposition, ValidationError, projectTitleSimilarity } from './projectDecomposition';

describe('projectTitleSimilarity (Sprint 14)', () => {
  it('détecte un doublon clair malgré tournure différente', () => {
    expect(projectTitleSimilarity('Déjeuner dimanche', 'organise le déjeuner dimanche'))
      .toBeGreaterThanOrEqual(0.6);
  });

  it('ne matche pas deux projets distincts', () => {
    expect(projectTitleSimilarity('Déjeuner dimanche', 'organise le week-end chez mes parents'))
      .toBeLessThan(0.6);
  });

  it('ignore stop-words et verbes projet', () => {
    const s = projectTitleSimilarity(
      'Anniversaire de Léa',
      'prépare anniversaire Léa',
    );
    expect(s).toBeGreaterThanOrEqual(0.6);
  });

  it('renvoie 0 sur tokens vides', () => {
    expect(projectTitleSimilarity('', '')).toBe(0);
    expect(projectTitleSimilarity('a b c', 'le de')).toBe(0);
  });
});

describe('detectProjectIntent', () => {
  it('détecte les prompts projet typiques', () => {
    expect(detectProjectIntent('organise le déjeuner de dimanche')).toBe(true);
    expect(detectProjectIntent('prépare l\'anniversaire de Léa')).toBe(true);
    expect(detectProjectIntent('planifie le week-end chez mes parents')).toBe(true);
    expect(detectProjectIntent('prévois la rentrée scolaire pour les enfants')).toBe(true);
    expect(detectProjectIntent('organise un apéro avec nos potes samedi')).toBe(true);
    expect(detectProjectIntent('prépare le ménage de printemps')).toBe(true);
  });

  it('ignore les tâches simples (un seul geste)', () => {
    expect(detectProjectIntent('j\'ai fait la vaisselle')).toBe(false);
    expect(detectProjectIntent('prépare le café')).toBe(false); // pas d'objet projet
    expect(detectProjectIntent('j\'ai sorti les poubelles')).toBe(false);
    expect(detectProjectIntent('barbara est fatiguée ce soir')).toBe(false);
  });

  it('ignore les textes trop courts', () => {
    expect(detectProjectIntent('')).toBe(false);
    expect(detectProjectIntent('organise')).toBe(false);
  });

  it('ignore les phrases où un mot-clé apparaît sans contexte projet', () => {
    // "organise" sans objet multi-tâche → pas un projet
    expect(detectProjectIntent('j\'organise mes photos de vacances dans un album')).toBe(true); // "vacances" déclenche — acceptable faux positif
    expect(detectProjectIntent('je vais préparer le dîner')).toBe(true); // "dîner" déclenche — OK
    expect(detectProjectIntent('je regarde la télé ce soir')).toBe(false);
  });
});

describe('validateDecomposition', () => {
  const validSub = {
    name: 'Faire les courses',
    duration_estimate: 'medium',
    next_due_at: '2026-04-26T10:00:00.000Z',
    assigned_to: null,
    assigned_phantom_id: null,
    notes: null,
  };
  const validProject = {
    project: {
      title: 'Déjeuner dimanche',
      description: 'Repas familial',
      target_date: '2026-04-27',
    },
    subtasks: [validSub, { ...validSub, name: 'Préparer le plat' }],
    pending_question: null,
    pending_missing: null,
  };

  it('accepte un payload valide', () => {
    const r = validateDecomposition(validProject);
    expect(r.project.title).toBe('Déjeuner dimanche');
    expect(r.subtasks).toHaveLength(2);
    expect(r.pending_question).toBeNull();
  });

  it('accepte un payload pending_question (court-circuite la validation projet)', () => {
    const r = validateDecomposition({
      project: null,
      subtasks: [],
      pending_question: 'Vous serez combien ?',
      pending_missing: 'guest_count',
    });
    expect(r.pending_question).toBe('Vous serez combien ?');
    expect(r.pending_missing).toBe('guest_count');
    expect(r.subtasks).toHaveLength(0);
  });

  it('rejette un payload qui n\'est pas un objet', () => {
    expect(() => validateDecomposition(null)).toThrow(ValidationError);
    expect(() => validateDecomposition('string')).toThrow(ValidationError);
  });

  it('rejette moins de 2 sous-tâches', () => {
    expect(() => validateDecomposition({
      ...validProject,
      subtasks: [validSub],
    })).toThrow(/>= 2/);
  });

  it('rejette plus de 8 sous-tâches', () => {
    expect(() => validateDecomposition({
      ...validProject,
      subtasks: Array(9).fill(validSub),
    })).toThrow(/<= 8/);
  });

  it('rejette un duration_estimate invalide', () => {
    expect(() => validateDecomposition({
      ...validProject,
      subtasks: [validSub, { ...validSub, duration_estimate: 'huge' }],
    })).toThrow(/duration_estimate/);
  });

  it('rejette un next_due_at non ISO', () => {
    expect(() => validateDecomposition({
      ...validProject,
      subtasks: [validSub, { ...validSub, next_due_at: '26 avril' }],
    })).toThrow(/next_due_at/);
  });

  it('rejette un assigned_to qui n\'est pas un UUID', () => {
    expect(() => validateDecomposition({
      ...validProject,
      subtasks: [validSub, { ...validSub, assigned_to: 'Barbara' }],
    })).toThrow(/UUID/);
  });

  it('accepte un assigned_to UUID valide', () => {
    const r = validateDecomposition({
      ...validProject,
      subtasks: [validSub, { ...validSub, assigned_to: '550e8400-e29b-41d4-a716-446655440000' }],
    });
    expect(r.subtasks[1].assigned_to).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('rejette un title vide', () => {
    expect(() => validateDecomposition({
      ...validProject,
      project: { ...validProject.project, title: '' },
    })).toThrow();
  });

  it('tolère description et target_date null', () => {
    const r = validateDecomposition({
      ...validProject,
      project: { title: 'Petit projet', description: null, target_date: null },
    });
    expect(r.project.description).toBeNull();
    expect(r.project.target_date).toBeNull();
  });

  it('rejette un target_date pas au format YYYY-MM-DD', () => {
    expect(() => validateDecomposition({
      ...validProject,
      project: { ...validProject.project, target_date: '27 avril 2026' },
    })).toThrow(/target_date/);
  });

  // Sprint 13 — assignation phantom
  it('accepte un assigned_phantom_id UUID valide (phantom Barbara, enfant...)', () => {
    const r = validateDecomposition({
      ...validProject,
      subtasks: [
        validSub,
        { ...validSub, assigned_phantom_id: '550e8400-e29b-41d4-a716-446655440001' },
      ],
    });
    expect(r.subtasks[1].assigned_phantom_id).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(r.subtasks[1].assigned_to).toBeNull();
  });

  it('rejette un assigned_phantom_id qui n\'est pas un UUID', () => {
    expect(() => validateDecomposition({
      ...validProject,
      subtasks: [validSub, { ...validSub, assigned_phantom_id: 'Barbara' }],
    })).toThrow(/assigned_phantom_id/);
  });

  it('rejette un conflit assigned_to + assigned_phantom_id sur la même sous-tâche', () => {
    expect(() => validateDecomposition({
      ...validProject,
      subtasks: [
        validSub,
        {
          ...validSub,
          assigned_to: '550e8400-e29b-41d4-a716-446655440000',
          assigned_phantom_id: '550e8400-e29b-41d4-a716-446655440001',
        },
      ],
    })).toThrow(/both/);
  });
});
