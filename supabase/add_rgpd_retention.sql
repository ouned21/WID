-- =============================================================================
-- MIGRATION RGPD — Politiques de rétention et suppression automatique
-- =============================================================================
-- Fichier : supabase/add_rgpd_retention.sql
-- Date    : 2026-04-16
-- Auteur  : Audit RGPD automatisé
--
-- BASE LÉGALE :
--   Art. 5.1.e RGPD : "Limitation de la conservation" — les données ne peuvent
--   être conservées sous une forme permettant l'identification des personnes
--   pendant une durée excédant celle nécessaire aux finalités du traitement.
--
-- DURÉES RETENUES :
--   - Journaux conversationnels : 2 ans  (texte libre sensible, base : consentement)
--   - Logs IA (tokens/coût)     : 1 an   (base : intérêt légitime — facturation/sécurité)
--   - Événements d'usage        : 1 an   (base : intérêt légitime — amélioration UX)
--   - Échanges de tâches        : 1 an   (base : exécution du contrat)
--   - Complétions               : 3 ans  (base : exécution du contrat — historique nécessaire)
--   - Patterns comportementaux  : 2 ans  (base : intérêt légitime — personnalisation)
--
-- INSTRUCTIONS :
--   1. Coller dans l'éditeur SQL Supabase et exécuter
--   2. Activer pg_cron dans les extensions Supabase (Database > Extensions > pg_cron)
--   3. Décommenter et exécuter les blocs pg_cron ci-dessous
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. FONCTION DE NETTOYAGE GLOBAL
-- ─────────────────────────────────────────────────────────────────────────────
-- Appelée manuellement ou via cron mensuel
-- Supprime les données dépassant leurs durées de rétention RGPD

CREATE OR REPLACE FUNCTION public.rgpd_cleanup_expired_data()
RETURNS TABLE(
  table_name text,
  rows_deleted bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count bigint;
BEGIN

  -- Journaux conversationnels > 2 ans
  -- BASE LÉGALE : Art. 5.1.e — les journaux contiennent du texte libre sensible
  DELETE FROM public.user_journals
  WHERE created_at < now() - interval '2 years';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT 'user_journals'::text, v_count;

  -- Logs IA > 1 an
  -- BASE LÉGALE : Art. 5.1.e — données techniques de facturation/sécurité
  DELETE FROM public.ai_token_usage
  WHERE created_at < now() - interval '1 year';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT 'ai_token_usage'::text, v_count;

  -- Événements d'usage > 1 an
  -- BASE LÉGALE : Art. 5.1.e — données d'amélioration UX non nécessaires au-delà de 1 an
  DELETE FROM public.feature_usage_events
  WHERE created_at < now() - interval '1 year';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT 'feature_usage_events'::text, v_count;

  -- Échanges de tâches terminés > 1 an (acceptés, refusés, expirés)
  -- BASE LÉGALE : Art. 5.1.e — historique des échanges non nécessaire au-delà de 1 an
  DELETE FROM public.task_exchanges
  WHERE status IN ('accepted', 'refused', 'expired')
    AND created_at < now() - interval '1 year';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT 'task_exchanges'::text, v_count;

  -- Complétions > 3 ans
  -- BASE LÉGALE : Art. 5.1.e — l'historique sur 3 ans suffit pour les analyses
  DELETE FROM public.task_completions
  WHERE completed_at < now() - interval '3 years';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT 'task_completions'::text, v_count;

  -- Mise à jour de la mémoire IA si trop ancienne (> 2 ans)
  -- On efface la mémoire résumée (ai_memory_summary) sans supprimer la ligne entière
  -- BASE LÉGALE : Art. 5.1.e — la mémoire IA est une donnée de profilage
  UPDATE public.user_patterns
  SET
    ai_memory_summary    = NULL,
    ai_memory_updated_at = NULL
  WHERE ai_memory_updated_at < now() - interval '2 years';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT 'user_patterns_memory_cleared'::text, v_count;

END;
$$;

COMMENT ON FUNCTION public.rgpd_cleanup_expired_data() IS
  'Suppression automatique des données dépassant les durées de rétention RGPD. '
  'Appeler mensuellement via pg_cron ou manuellement. '
  'Bases légales : Art. 5.1.e RGPD (limitation de conservation).';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. VUE DE CONTRÔLE RGPD (audit des volumes)
-- ─────────────────────────────────────────────────────────────────────────────
-- Permet de vérifier combien de données seraient supprimées
-- avant d'exécuter le nettoyage réel

CREATE OR REPLACE VIEW public.v_rgpd_retention_preview AS
SELECT
  'user_journals (> 2 ans)'          AS table_label,
  COUNT(*)                            AS rows_to_delete,
  MIN(created_at)                     AS oldest_record,
  MAX(created_at)                     AS newest_to_delete
FROM public.user_journals
WHERE created_at < now() - interval '2 years'

UNION ALL

SELECT
  'ai_token_usage (> 1 an)',
  COUNT(*),
  MIN(created_at),
  MAX(created_at)
FROM public.ai_token_usage
WHERE created_at < now() - interval '1 year'

UNION ALL

SELECT
  'feature_usage_events (> 1 an)',
  COUNT(*),
  MIN(created_at),
  MAX(created_at)
FROM public.feature_usage_events
WHERE created_at < now() - interval '1 year'

UNION ALL

SELECT
  'task_exchanges terminés (> 1 an)',
  COUNT(*),
  MIN(created_at),
  MAX(created_at)
FROM public.task_exchanges
WHERE status IN ('accepted', 'refused', 'expired')
  AND created_at < now() - interval '1 year'

UNION ALL

SELECT
  'task_completions (> 3 ans)',
  COUNT(*),
  MIN(completed_at),
  MAX(completed_at)
FROM public.task_completions
WHERE completed_at < now() - interval '3 years'

ORDER BY rows_to_delete DESC;

COMMENT ON VIEW public.v_rgpd_retention_preview IS
  'Aperçu des données qui seraient supprimées par rgpd_cleanup_expired_data(). '
  'Utiliser SELECT * FROM v_rgpd_retention_preview; avant le nettoyage réel.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PROGRAMMATION VIA pg_cron (à décommenter une fois pg_cron activé)
-- ─────────────────────────────────────────────────────────────────────────────
-- Activer pg_cron : Database > Extensions > chercher "pg_cron" > Enable
--
-- Une fois activé, décommenter ces lignes et exécuter dans l'éditeur SQL :

/*

-- Nettoyage RGPD : premier dimanche de chaque mois à 03h00 UTC
SELECT cron.schedule(
  'rgpd-cleanup-monthly',
  '0 3 1-7 * 0',  -- chaque mois, les 7 premiers jours, si c'est un dimanche, à 03h00 UTC
  $$SELECT public.rgpd_cleanup_expired_data()$$
);

-- Vérifier les jobs programmés :
-- SELECT * FROM cron.job;

-- Supprimer un job si besoin :
-- SELECT cron.unschedule('rgpd-cleanup-monthly');

*/


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. INDEX pour optimiser les suppressions (si pas déjà présents)
-- ─────────────────────────────────────────────────────────────────────────────

-- Index sur created_at pour les suppressions rapides (au cas où manquants)
CREATE INDEX IF NOT EXISTS idx_user_journals_created_at_retention
  ON public.user_journals(created_at)
  WHERE created_at < now() - interval '1 year';  -- partial index pour perf

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_created_at_retention
  ON public.ai_token_usage(created_at)
  WHERE created_at < now() - interval '6 months';

CREATE INDEX IF NOT EXISTS idx_feature_usage_created_at_retention
  ON public.feature_usage_events(created_at)
  WHERE created_at < now() - interval '6 months';


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VÉRIFICATION
-- ─────────────────────────────────────────────────────────────────────────────
-- Exécuter pour vérifier que la migration s'est bien passée :

SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'rgpd_cleanup_expired_data';

-- Vérifier la vue :
SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_rgpd_retention_preview';

-- Aperçu actuel (devrait retourner 0 sur une DB récente) :
-- SELECT * FROM public.v_rgpd_retention_preview;

-- Test de la fonction (mode dry-run via la vue) :
-- SELECT * FROM public.rgpd_cleanup_expired_data();
