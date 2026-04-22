// Sprint 15 — helpers autour de la notion "task est parent de projet".
// Un parent est une task référencée par ≥ 1 autre task via `parent_project_id`.
// Le parseur de journal doit IGNORER toute completion sur un parent (bug A sprint 15) :
// un parent se complète implicitement quand 100% de ses sous-tâches sont done (règle sprint 12).

export type TaskWithParent = { id: string; parent_project_id?: string | null };

/** Renvoie le Set des IDs qui sont parents de projet (référencés par au moins une autre task). */
export function buildProjectParentIdSet(tasks: readonly TaskWithParent[]): Set<string> {
  const out = new Set<string>();
  for (const t of tasks) {
    if (typeof t.parent_project_id === 'string' && t.parent_project_id.length > 0) {
      out.add(t.parent_project_id);
    }
  }
  return out;
}

/** True si la task doit être exclue de toute completion automatique (c'est un parent de projet). */
export function isProjectParent(taskId: string, parentIds: ReadonlySet<string>): boolean {
  return parentIds.has(taskId);
}
