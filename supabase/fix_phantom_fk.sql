-- Fix FK cascades pour phantom_members
-- Quand un fantôme est supprimé, les références deviennent NULL (pas d'orphelins)

-- task_completions.completed_by_phantom_id
ALTER TABLE task_completions
  DROP CONSTRAINT IF EXISTS task_completions_completed_by_phantom_id_fkey;
ALTER TABLE task_completions
  ADD CONSTRAINT task_completions_completed_by_phantom_id_fkey
  FOREIGN KEY (completed_by_phantom_id) REFERENCES phantom_members(id) ON DELETE SET NULL;

-- household_tasks.assigned_to_phantom_id
ALTER TABLE household_tasks
  DROP CONSTRAINT IF EXISTS household_tasks_assigned_to_phantom_id_fkey;
ALTER TABLE household_tasks
  ADD CONSTRAINT household_tasks_assigned_to_phantom_id_fkey
  FOREIGN KEY (assigned_to_phantom_id) REFERENCES phantom_members(id) ON DELETE SET NULL;

SELECT 'FK cascades fixées' AS statut;
