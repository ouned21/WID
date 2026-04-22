-- =============================================================================
-- Sprint 15 — Tracking du dernier check-in du soir
-- Migration idempotente (safe à relancer)
-- Date : 2026-04-23
-- =============================================================================

-- Permet de masquer la CTA "Check-in du soir" sur /today dès qu'un check-in
-- a été fait dans la fenêtre courante (20h → 04h du lendemain).
-- Renseigné par /api/ai/parse-journal dès qu'un message est envoyé dans cette
-- fenêtre (sprint 15 règle "≥ 1 message soir = check-in compté").

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_checkin_at timestamptz;

COMMENT ON COLUMN profiles.last_checkin_at IS
  'Horodatage du dernier message journal envoyé dans la fenêtre soir (20h-04h). Utilisé pour masquer la CTA check-in sur /today.';
