-- Migration : consentement explicite pour le journal IA (RGPD Art. 6 & 7)
--
-- Ajoute la colonne ai_journal_consent_at sur profiles.
-- NULL = pas encore consenti. Une valeur timestamptz = consentement donné.
--
-- Exécuter une seule fois dans l'éditeur SQL Supabase.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_journal_consent_at timestamptz DEFAULT NULL;

-- Index pour filtrer rapidement les utilisateurs ayant consenti (utile pour analytics)
CREATE INDEX IF NOT EXISTS idx_profiles_ai_consent
  ON public.profiles (ai_journal_consent_at)
  WHERE ai_journal_consent_at IS NOT NULL;

-- Mettre à jour le reset complet : ajouter cette colonne dans reset_part1
-- (non obligatoire ici, cette migration suffit pour les BDD existantes)
