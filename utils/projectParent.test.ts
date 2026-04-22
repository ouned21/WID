import { describe, it, expect } from 'vitest';
import { buildProjectParentIdSet, isProjectParent } from './projectParent';

describe('buildProjectParentIdSet', () => {
  it('retourne un Set vide si aucune task n\'a de parent', () => {
    const tasks = [
      { id: 'a', parent_project_id: null },
      { id: 'b', parent_project_id: null },
    ];
    expect(buildProjectParentIdSet(tasks).size).toBe(0);
  });

  it('retourne les IDs parents référencés par ≥ 1 enfant', () => {
    const tasks = [
      { id: 'parent-1', parent_project_id: null },
      { id: 'child-a', parent_project_id: 'parent-1' },
      { id: 'child-b', parent_project_id: 'parent-1' },
      { id: 'parent-2', parent_project_id: null },
      { id: 'child-c', parent_project_id: 'parent-2' },
      { id: 'orphan', parent_project_id: null },
    ];
    const set = buildProjectParentIdSet(tasks);
    expect(set.has('parent-1')).toBe(true);
    expect(set.has('parent-2')).toBe(true);
    expect(set.has('orphan')).toBe(false);
    expect(set.has('child-a')).toBe(false);
    expect(set.size).toBe(2);
  });

  it('ignore les parent_project_id vides ou undefined', () => {
    const tasks = [
      { id: 'a', parent_project_id: '' },
      { id: 'b' },
      { id: 'c', parent_project_id: null },
    ];
    expect(buildProjectParentIdSet(tasks).size).toBe(0);
  });
});

describe('isProjectParent', () => {
  it('true si task référencée comme parent', () => {
    const parents = new Set(['p1', 'p2']);
    expect(isProjectParent('p1', parents)).toBe(true);
  });
  it('false si task orpheline', () => {
    const parents = new Set(['p1']);
    expect(isProjectParent('other', parents)).toBe(false);
  });
});

// Simulation de la règle sprint 15 Bug A : une completion sur un parent doit être skip.
describe('sprint 15 bug A — filter completions sur parents de projet', () => {
  it('skip la completion si task_id est un parent de projet', () => {
    const tasks = [
      { id: 'anniv-eva', parent_project_id: null }, // parent
      { id: 'courses-anniv', parent_project_id: 'anniv-eva' }, // enfant
      { id: 'gateau', parent_project_id: 'anniv-eva' }, // enfant
      { id: 'lessive', parent_project_id: null }, // tâche simple
    ];
    const parents = buildProjectParentIdSet(tasks);

    // Le parseur retourne 2 completions : sur le parent (à tort) et sur une task simple
    const completions = [
      { task_id: 'anniv-eva', task_name: 'Anniversaire Eva' }, // doit être skip
      { task_id: 'lessive', task_name: 'Faire la lessive' }, // doit passer
    ];

    const kept = completions.filter((c) => !isProjectParent(c.task_id, parents));
    expect(kept).toHaveLength(1);
    expect(kept[0].task_id).toBe('lessive');
  });
});
