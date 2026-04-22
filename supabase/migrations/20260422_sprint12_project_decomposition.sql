-- =============================================================================
-- Sprint 12 — Décomposition de projets complexes (M3)
-- Migration idempotente (safe à relancer)
-- Date : 2026-04-22
--
-- Ajoute un lien de parenté entre tâches pour grouper les sous-tâches d'un
-- projet décomposé par Yova. Le parent est lui-même une row `household_tasks`
-- normale ; ses enfants référencent son `id` via `parent_project_id`.
-- Un parent = row dont d'autres rows ont `parent_project_id = mon id`.
-- =============================================================================

ALTER TABLE household_tasks
  ADD COLUMN IF NOT EXISTS parent_project_id uuid
    REFERENCES household_tasks(id) ON DELETE CASCADE;

COMMENT ON COLUMN household_tasks.parent_project_id IS
  'FK self-ref. NULL = tâche normale ou parent d''un projet. Si non-null, pointe vers la tâche parent du projet (Sprint 12, M3 décomposition).';

-- Index pour regrouper rapidement les enfants d'un parent sur /today et /week
CREATE INDEX IF NOT EXISTS household_tasks_parent_project_idx
  ON household_tasks (parent_project_id)
  WHERE parent_project_id IS NOT NULL;
