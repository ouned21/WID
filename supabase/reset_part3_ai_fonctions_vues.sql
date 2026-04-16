-- =============================================================
-- PARTIE 3 / 3 — IA, préférences, fonctions, vues
-- À exécuter APRÈS la partie 2
-- =============================================================

-- ── AI TOKEN USAGE ───────────────────────────────────────────
CREATE TABLE public.ai_token_usage (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  household_id uuid REFERENCES public.households(id) ON DELETE SET NULL,
  endpoint     text NOT NULL,
  model        text NOT NULL DEFAULT 'claude-haiku-4-5',
  tokens_input integer NOT NULL DEFAULT 0,
  tokens_output integer NOT NULL DEFAULT 0,
  cost_usd     numeric(10,6) NOT NULL DEFAULT 0,
  duration_ms  integer NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'success'
    CHECK (status IN ('success','error','rate_limited','premium_required')),
  error_message text DEFAULT NULL,
  metadata     jsonb DEFAULT '{}'::jsonb,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE public.ai_token_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_usage_select" ON public.ai_token_usage FOR SELECT USING (user_id = auth.uid());
CREATE INDEX idx_ai_usage_user     ON public.ai_token_usage(user_id, created_at DESC);
CREATE INDEX idx_ai_usage_endpoint ON public.ai_token_usage(endpoint, created_at DESC);

-- ── FEATURE USAGE EVENTS ─────────────────────────────────────
CREATE TABLE public.feature_usage_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  household_id   uuid REFERENCES public.households(id) ON DELETE SET NULL,
  event_name     text NOT NULL,
  event_category text NOT NULL DEFAULT 'general',
  metadata       jsonb DEFAULT '{}'::jsonb,
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE public.feature_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_insert" ON public.feature_usage_events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "events_select" ON public.feature_usage_events FOR SELECT USING (user_id = auth.uid());

-- ── USER PATTERNS ────────────────────────────────────────────
CREATE TABLE public.user_patterns (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferred_completion_hour smallint DEFAULT NULL,
  avg_tasks_per_day        numeric(5,2) DEFAULT NULL,
  most_active_day          smallint DEFAULT NULL,
  category_affinity        jsonb DEFAULT '{}'::jsonb,
  avg_duration_by_category jsonb DEFAULT '{}'::jsonb,
  completion_streak_days   integer DEFAULT 0,
  longest_streak_days      integer DEFAULT 0,
  ai_memory_summary        text DEFAULT NULL,
  ai_memory_updated_at     timestamptz DEFAULT NULL,
  updated_at               timestamptz DEFAULT now(),
  created_at               timestamptz DEFAULT now()
);
ALTER TABLE public.user_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patterns_select" ON public.user_patterns FOR SELECT USING (user_id = auth.uid());

-- ── USER PREFERENCES ─────────────────────────────────────────
CREATE TABLE public.user_preferences (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  hated_tasks         text[]    DEFAULT '{}',
  loved_tasks         text[]    DEFAULT '{}',
  preferred_time_slot text      DEFAULT 'flexible',
  unavailable_days    smallint[] DEFAULT '{}',
  load_preference     text      DEFAULT 'balanced',
  freeform_note       text      DEFAULT NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefs_select" ON public.user_preferences FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "prefs_insert" ON public.user_preferences FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "prefs_update" ON public.user_preferences FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "prefs_delete" ON public.user_preferences FOR DELETE USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_user_preferences_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_prefs_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_user_preferences_updated_at();

-- ── FONCTIONS IA ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_ai_usage(
  p_user_id    uuid,
  p_tokens_in  integer,
  p_tokens_out integer,
  p_cost_usd   numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles SET
    ai_tokens_this_month   = ai_tokens_this_month + p_tokens_in + p_tokens_out,
    ai_tokens_lifetime     = ai_tokens_lifetime + p_tokens_in + p_tokens_out,
    ai_cost_this_month_usd = ai_cost_this_month_usd + p_cost_usd,
    ai_cost_lifetime_usd   = ai_cost_lifetime_usd + p_cost_usd,
    last_active_at         = now()
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_ai_counter_if_needed(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles SET
    ai_calls_this_month  = 0,
    ai_calls_month_reset = now() + interval '1 month'
  WHERE id = p_user_id AND ai_calls_month_reset < now();
END;
$$;

-- ── VUES ANALYTICS (sans SECURITY DEFINER) ───────────────────
CREATE VIEW public.v_ai_cost_daily AS
SELECT
  DATE(created_at) AS day,
  endpoint,
  COUNT(*)         AS call_count,
  SUM(tokens_input)  AS total_tokens_in,
  SUM(tokens_output) AS total_tokens_out,
  SUM(cost_usd)    AS total_cost_usd,
  AVG(duration_ms) AS avg_duration_ms
FROM public.ai_token_usage
GROUP BY DATE(created_at), endpoint
ORDER BY day DESC;

CREATE VIEW public.v_ai_top_users AS
SELECT
  p.id,
  p.display_name,
  p.is_premium,
  COUNT(t.id)                           AS call_count,
  SUM(t.tokens_input + t.tokens_output) AS total_tokens,
  SUM(t.cost_usd)                       AS total_cost_usd,
  MAX(t.created_at)                     AS last_call_at
FROM public.profiles p
LEFT JOIN public.ai_token_usage t
  ON t.user_id = p.id AND t.created_at > now() - interval '30 days'
GROUP BY p.id, p.display_name, p.is_premium
ORDER BY total_cost_usd DESC NULLS LAST;

-- ── VÉRIFICATION ─────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ─────────────────────────────────────────────────────────────
-- APRÈS t'être reconnecté dans l'app, exécute ceci :
--
-- UPDATE public.profiles
--   SET is_premium = true, premium_until = '2027-01-01'
--   WHERE display_name = 'Jonathan';
-- ─────────────────────────────────────────────────────────────
