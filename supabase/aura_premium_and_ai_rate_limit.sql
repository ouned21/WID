-- =============================================================================
-- MIGRATION : Premium flag + rate limit IA pour les utilisateurs gratuits
-- =============================================================================

-- Ajout du flag premium sur profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS premium_until timestamptz DEFAULT NULL;

-- Compteur d'appels IA du mois courant (pour rate limiting gratuit)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_calls_this_month integer DEFAULT 0;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_calls_month_reset timestamptz DEFAULT (now() + interval '1 month');

-- Index pour requêtes rapides sur premium
CREATE INDEX IF NOT EXISTS idx_profiles_is_premium ON profiles(is_premium);

-- Fonction pour reset automatique du compteur mensuel
CREATE OR REPLACE FUNCTION reset_ai_counter_if_needed(user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET ai_calls_this_month = 0,
      ai_calls_month_reset = now() + interval '1 month'
  WHERE id = user_id
    AND ai_calls_month_reset < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Migration premium + rate limit terminée' AS statut;
