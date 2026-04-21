-- =============================================================================
-- Sprint 1 — Fiches membres enrichies + Profil foyer
-- Migration idempotente (safe à relancer)
-- Date : 2026-04-21
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enrichissement de phantom_members
--    (enfants + partenaires sans compte avec infos foyer)
-- ---------------------------------------------------------------------------

ALTER TABLE phantom_members
  ADD COLUMN IF NOT EXISTS member_type   text DEFAULT 'adult'  -- 'adult' | 'child' | 'other'
    CHECK (member_type IN ('adult', 'child', 'other')),
  ADD COLUMN IF NOT EXISTS birth_date    date,
  ADD COLUMN IF NOT EXISTS school_class  text,          -- ex: 'CP', 'CE1', '6ème'
  ADD COLUMN IF NOT EXISTS specifics     jsonb DEFAULT '{}'::jsonb;
  -- specifics contient : allergies text[], activities jsonb[], bedtime_routine text, notes text

COMMENT ON COLUMN phantom_members.member_type IS
  'adult = partenaire/adulte sans compte, child = enfant, other = autre';
COMMENT ON COLUMN phantom_members.birth_date IS
  'Date de naissance (utile pour âge auto-calculé et anticipations scolaires)';
COMMENT ON COLUMN phantom_members.school_class IS
  'Classe scolaire (ex: CP, CE2, 6ème) — alimente les anticipations rentrée/vacances';
COMMENT ON COLUMN phantom_members.specifics IS
  'JSONB libre : allergies, activités extra-scolaires, routine du soir, notes libres';

-- ---------------------------------------------------------------------------
-- 2. Nouvelle table household_profile
--    (contexte vivant du foyer : énergie, événements, aides, mode crise)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS household_profile (
  household_id       uuid PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  energy_level       text NOT NULL DEFAULT 'medium'
    CHECK (energy_level IN ('low', 'medium', 'high')),
  current_life_events text[]  DEFAULT ARRAY[]::text[],
    -- ex: ['déménagement', 'nouveau job', 'maladie', 'deuil', 'nouveau bébé']
  external_help      jsonb DEFAULT '[]'::jsonb,
    -- ex: [{"type":"grandparent","freq":"weekly"},{"type":"nanny","days":["lun","mer"]}]
  crisis_mode_active boolean NOT NULL DEFAULT false,
  crisis_started_at  timestamptz,
  notes              text,   -- notes libres sur le foyer (visible IA)
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE household_profile IS
  'Contexte vivant du foyer. Un seul enregistrement par foyer (PK = household_id).';
COMMENT ON COLUMN household_profile.energy_level IS
  'Niveau d''énergie général perçu du foyer : low / medium / high.';
COMMENT ON COLUMN household_profile.current_life_events IS
  'Événements de vie en cours influençant la charge (tableau de textes libres).';
COMMENT ON COLUMN household_profile.external_help IS
  'Aides externes disponibles (grands-parents, nounou, auxiliaire…).';
COMMENT ON COLUMN household_profile.crisis_mode_active IS
  'Mode crise ON : l''app simplifie l''affichage au minimum vital.';

-- Trigger updated_at automatique
CREATE OR REPLACE FUNCTION update_household_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS household_profile_updated_at ON household_profile;
CREATE TRIGGER household_profile_updated_at
  BEFORE UPDATE ON household_profile
  FOR EACH ROW EXECUTE FUNCTION update_household_profile_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS — household_profile
-- ---------------------------------------------------------------------------

ALTER TABLE household_profile ENABLE ROW LEVEL SECURITY;

-- Lecture : tout membre du foyer
DROP POLICY IF EXISTS "household_profile_select" ON household_profile;
CREATE POLICY "household_profile_select"
  ON household_profile FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM profiles
      WHERE id = auth.uid() AND household_id IS NOT NULL
    )
  );

-- Insert : membre du foyer
DROP POLICY IF EXISTS "household_profile_insert" ON household_profile;
CREATE POLICY "household_profile_insert"
  ON household_profile FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM profiles
      WHERE id = auth.uid() AND household_id IS NOT NULL
    )
  );

-- Update : membre du foyer
DROP POLICY IF EXISTS "household_profile_update" ON household_profile;
CREATE POLICY "household_profile_update"
  ON household_profile FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM profiles
      WHERE id = auth.uid() AND household_id IS NOT NULL
    )
  );

-- ---------------------------------------------------------------------------
-- 4. RLS — phantom_members (vérifier que les nouvelles colonnes sont couvertes)
-- ---------------------------------------------------------------------------
-- Les politiques existantes de phantom_members couvrent déjà les nouvelles
-- colonnes (pas de politique par colonne dans Postgres/Supabase).
-- Rien à changer.

-- ---------------------------------------------------------------------------
-- 5. Seed : créer un household_profile pour les foyers existants
--    (UPSERT safe — ne touche pas les foyers qui en ont déjà un)
-- ---------------------------------------------------------------------------

INSERT INTO household_profile (household_id)
SELECT id FROM households
WHERE is_active = true
ON CONFLICT (household_id) DO NOTHING;
