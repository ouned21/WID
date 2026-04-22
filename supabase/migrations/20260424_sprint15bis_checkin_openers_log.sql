-- Sprint 15bis — Log des ouvertures check-in contextualisées
-- Sert à (1) appliquer la rotation anti-harcèlement (ne pas ressasser le même
-- sujet 2 soirs de suite) et (2) mesurer plus tard si les openers tailored
-- génèrent plus d'engagement que la bubble statique sprint 15.

CREATE TABLE IF NOT EXISTS checkin_openers_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id       uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  question           text NOT NULL,
  -- Catégorie de signal utilisé (voir utils/checkinOpener.ts OpenerSource)
  source             text NOT NULL,
  -- Identifiant stable du signal (ex: "obs:cooking_drift", "birthday:Eva:2d")
  -- Utilisé pour la rotation : si égal au dernier log < 30h → descendre d'un cran
  source_detail      text,
  -- True si court-circuit Sonnet (mémoire vide) → pas facturé
  is_static_fallback boolean NOT NULL DEFAULT false,
  generated_at       timestamptz NOT NULL DEFAULT now(),
  -- Post-hoc : a-t-on reçu un message journal dans la fenêtre qui a suivi ?
  was_answered       boolean NOT NULL DEFAULT false,
  answered_at        timestamptz
);

CREATE INDEX IF NOT EXISTS checkin_openers_log_household_idx
  ON checkin_openers_log(household_id, generated_at DESC);

ALTER TABLE checkin_openers_log ENABLE ROW LEVEL SECURITY;

-- Select : membres du foyer (pour debug futur côté UI si besoin)
CREATE POLICY "checkin_openers_log_select"
  ON checkin_openers_log FOR SELECT
  USING (
    household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

-- Insert/update : service role uniquement (route API serveur)
-- Pas de policy FOR INSERT/UPDATE → seul service_role peut écrire
