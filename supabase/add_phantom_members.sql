-- =============================================================================
-- MIGRATION : Membres fantômes
-- Un membre fantôme est un membre du foyer qui n'a pas de compte.
-- L'utilisateur actif logge les tâches en son nom.
-- =============================================================================

-- Table phantom_members
CREATE TABLE IF NOT EXISTS phantom_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  target_share_percent smallint DEFAULT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id),
  linked_profile_id uuid DEFAULT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE phantom_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phantom_select" ON phantom_members FOR SELECT
  USING (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "phantom_insert" ON phantom_members FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "phantom_update" ON phantom_members FOR UPDATE
  USING (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "phantom_delete" ON phantom_members FOR DELETE
  USING (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()));

-- Colonne sur task_completions : qui a VRAIMENT fait la tâche (si fantôme)
ALTER TABLE task_completions
  ADD COLUMN IF NOT EXISTS completed_by_phantom_id uuid REFERENCES phantom_members(id);

-- Colonne sur household_tasks : assignation à un fantôme
ALTER TABLE household_tasks
  ADD COLUMN IF NOT EXISTS assigned_to_phantom_id uuid REFERENCES phantom_members(id);

SELECT 'Migration phantom_members terminée' AS statut;
