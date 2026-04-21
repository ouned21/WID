-- Sprint 9 — Profil narratif Yova
-- Yova maintient un portrait vivant du foyer, mis à jour après chaque journal
-- Injecté dans parse-journal pour des réponses contextuelles riches

ALTER TABLE households
  ADD COLUMN IF NOT EXISTS yova_narrative text,
  ADD COLUMN IF NOT EXISTS yova_narrative_updated_at timestamptz;
