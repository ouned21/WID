-- Sprint risques V1 — fix R9 (audit Security Advisor 2026-05-13)
--
-- Les 2 vues analytics public.v_ai_cost_daily et public.v_ai_top_users
-- (définies dans supabase/reset_part3_ai_fonctions_vues.sql) sont créées
-- par défaut en SECURITY DEFINER, ce qui fait bypass la RLS de l'user
-- qui query : un user authentifié pourrait voir les coûts IA de tous les
-- autres users du système.
--
-- Fix : passer les 2 vues en security_invoker = true (Postgres ≥ 15.7 / 16.3).
-- La vue tourne désormais avec les permissions de l'user qui query, et
-- la RLS sur public.ai_token_usage / public.profiles est respectée.
--
-- Idempotent : ALTER VIEW SET (security_invoker = true) ne casse rien
-- si déjà appliqué.

alter view public.v_ai_cost_daily set (security_invoker = true);
alter view public.v_ai_top_users set (security_invoker = true);
