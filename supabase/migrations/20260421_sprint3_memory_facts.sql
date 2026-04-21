-- =============================================================================
-- Sprint 3 — Mémoire longue de Yova (agent_memory_facts)
-- Migration idempotente
-- Date : 2026-04-21
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table agent_memory_facts
--    Faits persistants sur les membres et le foyer, extraits des journals IA.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_memory_facts (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      uuid        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  -- Qui est concerné par ce fait (null = le foyer entier)
  about_user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  about_phantom_id  uuid        REFERENCES phantom_members(id) ON DELETE SET NULL,
  -- Catégorie du fait
  fact_type         text        NOT NULL
    CHECK (fact_type IN ('preference', 'pattern', 'context', 'tension', 'milestone')),
  -- Le fait en texte libre (ex: "Jonathan déteste faire la vaisselle")
  content           text        NOT NULL CHECK (char_length(content) <= 500),
  -- Confiance : 0.0 = incertain, 1.0 = certain
  confidence        float       NOT NULL DEFAULT 0.8
    CHECK (confidence >= 0 AND confidence <= 1),
  -- Journal d'origine (pour traçabilité)
  source_journal_id uuid        REFERENCES user_journals(id) ON DELETE SET NULL,
  -- false = invalidé par un fait plus récent ou contredisant
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE agent_memory_facts IS
  'Faits mémorisés par Yova sur les membres et le foyer. Alimenté par extract-memory après chaque journal.';
COMMENT ON COLUMN agent_memory_facts.fact_type IS
  'preference=goûts/aversions, pattern=habitudes, context=situation actuelle, tension=stress/surcharge, milestone=événement marquant';
COMMENT ON COLUMN agent_memory_facts.content IS
  'Le fait en langage naturel, court et factuel. Ex: "Jonathan déteste faire la vaisselle"';

-- Index pour les lectures fréquentes
CREATE INDEX IF NOT EXISTS agent_memory_facts_household_active
  ON agent_memory_facts (household_id, is_active)
  WHERE is_active = true;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_memory_facts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS memory_facts_updated_at ON agent_memory_facts;
CREATE TRIGGER memory_facts_updated_at
  BEFORE UPDATE ON agent_memory_facts
  FOR EACH ROW EXECUTE FUNCTION update_memory_facts_updated_at();

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE agent_memory_facts ENABLE ROW LEVEL SECURITY;

-- Lecture : membres du foyer
DROP POLICY IF EXISTS "memory_facts_select" ON agent_memory_facts;
CREATE POLICY "memory_facts_select"
  ON agent_memory_facts FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM profiles
      WHERE id = auth.uid() AND household_id IS NOT NULL
    )
  );

-- Insert via service role uniquement (Edge Function / API route server-side)
-- Pas de policy INSERT pour les utilisateurs directs → sécurité
DROP POLICY IF EXISTS "memory_facts_insert_service" ON agent_memory_facts;
CREATE POLICY "memory_facts_insert_service"
  ON agent_memory_facts FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM profiles
      WHERE id = auth.uid() AND household_id IS NOT NULL
    )
  );

-- Update (invalidation) : membres du foyer
DROP POLICY IF EXISTS "memory_facts_update" ON agent_memory_facts;
CREATE POLICY "memory_facts_update"
  ON agent_memory_facts FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM profiles
      WHERE id = auth.uid() AND household_id IS NOT NULL
    )
  );
