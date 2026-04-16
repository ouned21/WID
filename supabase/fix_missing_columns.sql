-- Migration : colonnes manquantes après reset_part1
-- À exécuter UNE FOIS dans l'éditeur SQL Supabase.
--
-- Le reset_part1 avait omis plusieurs colonnes utilisées par le code.

-- ── households : colonnes manquantes ─────────────────────────────────────────
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS invite_code            text        UNIQUE,
  ADD COLUMN IF NOT EXISTS invite_code_expires_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_active              boolean     DEFAULT true;

-- ── profiles : colonnes manquantes ──────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role                text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS joined_at           timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS left_at             timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notification_token  text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vacation_started_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz DEFAULT now();

-- Trigger pour updated_at automatique sur profiles
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
