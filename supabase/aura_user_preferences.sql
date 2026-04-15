-- =============================================================================
-- Aura — Préférences utilisateur (personnalisation IA)
-- =============================================================================
-- Préférences explicites par user, injectées dans chaque prompt Haiku pour que
-- l'IA personnalise ses suggestions sans avoir besoin de "mémoire".
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

  -- Tâches détestées (array de scoring_category ou noms libres)
  hated_tasks text[] DEFAULT '{}',

  -- Tâches préférées (on en assigne plus à ce membre si possible)
  loved_tasks text[] DEFAULT '{}',

  -- Moment préféré pour les tâches : 'morning' | 'evening' | 'weekend' | 'flexible'
  preferred_time_slot text DEFAULT 'flexible',

  -- Jours non dispos (array de 0..6, 0 = dimanche)
  unavailable_days smallint[] DEFAULT '{}',

  -- Niveau de charge accepté : 'light' | 'balanced' | 'heavy'
  load_preference text DEFAULT 'balanced',

  -- Note libre à l'attention d'Aura (max 500 chars)
  freeform_note text DEFAULT NULL,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Chaque user gère ses propres préférences
CREATE POLICY "Users read own preferences"
  ON user_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own preferences"
  ON user_preferences FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own preferences"
  ON user_preferences FOR DELETE
  USING (user_id = auth.uid());

-- Index pour lookups rapides
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();
