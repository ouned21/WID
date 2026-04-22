-- =============================================================================
-- Sprint 16 — Consolidation de tâches chevauchantes (Pilier 3)
-- Migration idempotente (safe à relancer)
-- Date : 2026-04-25
--
-- Ajoute `covers_project_ids` : liste d'UUIDs de projets parents qu'une tâche
-- récurrente couvre AUSSI (en plus de son usage normal). Permet à Yova de
-- proposer "tu as déjà les courses mer., je groupe avec le déjeuner dimanche ?"
-- — l'user dit "ok groupe", on déplace la récurrente sur la date du projet et
-- on note ici les projets qu'elle couvre. Affichage badge sur /week.
-- =============================================================================

ALTER TABLE household_tasks
  ADD COLUMN IF NOT EXISTS covers_project_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN household_tasks.covers_project_ids IS
  'Sprint 16 : liste de parent_project_id qu''une tâche récurrente couvre aussi (consolidation). Vide par défaut. Cleanup auto quand un projet listé est archivé.';

-- Index GIN pour les lookups "tâches qui couvrent ce projet" (cascade clear)
CREATE INDEX IF NOT EXISTS household_tasks_covers_project_idx
  ON household_tasks USING GIN (covers_project_ids);
