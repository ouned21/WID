-- Sprint 5 — Table observations (détection de dérives Yova)
-- Pilier 2 : Détection douce des dérives du foyer

CREATE TABLE IF NOT EXISTS observations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  type                  text NOT NULL,
  -- 'cooking_drift' | 'balance_drift' | 'journal_silence' | 'task_overdue_cluster'
  severity              text NOT NULL CHECK (severity IN ('info', 'notice', 'alert')),
  payload               jsonb NOT NULL DEFAULT '{}',
  detected_at           timestamptz NOT NULL DEFAULT now(),
  user_acknowledged_at  timestamptz,
  user_action_taken     text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS observations_household_idx
  ON observations(household_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS observations_unacked_idx
  ON observations(household_id)
  WHERE user_acknowledged_at IS NULL;

-- RLS : visible uniquement par les membres du foyer
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "observations_select_household_members"
  ON observations FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "observations_insert_service_only"
  ON observations FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "observations_update_ack"
  ON observations FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM profiles WHERE id = auth.uid()
    )
  );
