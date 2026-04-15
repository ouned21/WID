-- =============================================================================
-- Aura — Journal conversationnel + analytics enrichies
-- =============================================================================
-- Objectif : permettre à l'utilisateur de raconter sa journée en une phrase,
-- et avoir des données ultra-riches pour pouvoir en soutirer de l'intelligence
-- business (usage, coûts IA, patterns, feedback loop, etc.)
-- =============================================================================

-- ─── TABLE : user_journals ─────────────────────────────────────────────────
-- Chaque entrée = un "raconte-moi ta journée" de l'utilisateur
CREATE TABLE IF NOT EXISTS user_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,

  -- Texte brut envoyé par l'utilisateur
  raw_text text NOT NULL,
  -- Mode d'entrée
  input_method text NOT NULL DEFAULT 'text' CHECK (input_method IN ('text', 'voice')),

  -- Résultats du parsing IA (JSON)
  parsed_completions jsonb DEFAULT '[]'::jsonb,  -- [{ task_id, completed_by, duration_minutes, note, confidence }]
  unmatched_items jsonb DEFAULT '[]'::jsonb,     -- ["trucs dits que je comprends pas"]
  ai_response text DEFAULT NULL,                 -- Réponse empathique d'Aura à afficher

  -- Métadonnées
  tokens_input integer DEFAULT 0,
  tokens_output integer DEFAULT 0,
  cost_usd numeric(10, 6) DEFAULT 0,
  model_used text DEFAULT 'claude-haiku-4-5',
  processing_time_ms integer DEFAULT 0,
  error text DEFAULT NULL,

  -- Mood dérivé (optionnel, extrait par l'IA)
  mood_tone text DEFAULT NULL CHECK (mood_tone IN ('happy', 'tired', 'overwhelmed', 'satisfied', 'frustrated', 'neutral')),

  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own journals"
  ON user_journals FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own journals"
  ON user_journals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own journals"
  ON user_journals FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_journals_user_created ON user_journals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_journals_household_created ON user_journals(household_id, created_at DESC);

-- ─── TABLE : ai_token_usage ────────────────────────────────────────────────
-- Log ultra-détaillé de chaque appel IA pour suivre les coûts et l'usage
CREATE TABLE IF NOT EXISTS ai_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id uuid REFERENCES households(id) ON DELETE SET NULL,

  -- Quel endpoint a été appelé
  endpoint text NOT NULL,  -- 'subtasks' | 'anticipate' | 'insights' | 'weekly-summary' | 'parse-journal' | 'infer-task'
  model text NOT NULL DEFAULT 'claude-haiku-4-5',

  -- Tokens et coût
  tokens_input integer NOT NULL DEFAULT 0,
  tokens_output integer NOT NULL DEFAULT 0,
  cost_usd numeric(10, 6) NOT NULL DEFAULT 0,

  -- Latence
  duration_ms integer NOT NULL DEFAULT 0,

  -- Statut
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'rate_limited', 'premium_required')),
  error_message text DEFAULT NULL,

  -- Métadonnées libres (ex: le nom de tâche demandé, la taille du batch, etc.)
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own token usage"
  ON ai_token_usage FOR SELECT
  USING (user_id = auth.uid());

-- Pas de policy INSERT pour les users : seul le serveur (service role) insère
-- Les policies du service role contournent RLS de toute façon

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_created ON ai_token_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_endpoint ON ai_token_usage(endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_created ON ai_token_usage(created_at DESC);

-- ─── TABLE : feature_usage_events ──────────────────────────────────────────
-- Événements utilisateurs pour analytique funnel / retention
CREATE TABLE IF NOT EXISTS feature_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id uuid REFERENCES households(id) ON DELETE SET NULL,

  event_name text NOT NULL,  -- 'task_created', 'task_completed', 'journal_sent', 'upgrade_viewed', etc.
  event_category text NOT NULL DEFAULT 'general',  -- 'onboarding', 'task', 'ai', 'premium', etc.
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now()
);

ALTER TABLE feature_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own events"
  ON feature_usage_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users see own events"
  ON feature_usage_events FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_feature_usage_events_user ON feature_usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_usage_events_name ON feature_usage_events(event_name, created_at DESC);

-- ─── TABLE : user_patterns ─────────────────────────────────────────────────
-- Patterns appris automatiquement par l'IA sur le comportement d'un user
-- Mis à jour par un job périodique (ou à la volée)
CREATE TABLE IF NOT EXISTS user_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

  -- Patterns stockés en JSON structuré
  preferred_completion_hour smallint DEFAULT NULL,   -- 0-23, heure habituelle de complétion
  avg_tasks_per_day numeric(5, 2) DEFAULT NULL,
  most_active_day smallint DEFAULT NULL,             -- 0=dim, 6=sam
  category_affinity jsonb DEFAULT '{}'::jsonb,       -- { "meals": 0.8, "cleaning": 0.2 }
  avg_duration_by_category jsonb DEFAULT '{}'::jsonb, -- { "meals": 25, "cleaning": 40 } (minutes)
  completion_streak_days integer DEFAULT 0,
  longest_streak_days integer DEFAULT 0,

  -- Memory file style : résumé libre écrit par l'IA au fil du temps
  ai_memory_summary text DEFAULT NULL,  -- markdown-style, < 2000 chars
  ai_memory_updated_at timestamptz DEFAULT NULL,

  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own patterns"
  ON user_patterns FOR SELECT
  USING (user_id = auth.uid());

-- Pas de INSERT/UPDATE par les users : rempli par le backend

-- ─── ENRICHIR : profiles ───────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_tokens_this_month integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_tokens_lifetime integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_cost_this_month_usd numeric(10, 6) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_cost_lifetime_usd numeric(10, 6) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_journal_at timestamptz DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS journal_streak_days integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_tasks_completed integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now();

-- ─── ENRICHIR : task_completions ───────────────────────────────────────────
ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS completion_method text DEFAULT 'manual';
-- 'manual' = tap manuel dans /tasks
-- 'journal' = extrait par l'IA depuis un journal texte
-- 'swipe' = via l'écran de swipe
-- 'recap' = via la page de récap du soir
-- 'ai_inferred' = auto-détecté par l'IA

ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS source_text text DEFAULT NULL;
-- La phrase originale qui a déclenché la complétion (si journal)

ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS confidence numeric(3, 2) DEFAULT NULL;
-- 0.00 à 1.00 : confiance de l'IA dans le matching (NULL si manuel)

ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS journal_id uuid REFERENCES user_journals(id) ON DELETE SET NULL;

-- ─── ENRICHIR : households ─────────────────────────────────────────────────
ALTER TABLE households ADD COLUMN IF NOT EXISTS total_completions_count integer DEFAULT 0;
ALTER TABLE households ADD COLUMN IF NOT EXISTS health_score numeric(4, 2) DEFAULT NULL;
-- 0-100 : score de santé du foyer (équilibre, régularité, retard)
ALTER TABLE households ADD COLUMN IF NOT EXISTS last_activity_at timestamptz DEFAULT now();

-- ─── FONCTIONS UTILITAIRES ─────────────────────────────────────────────────

-- Incrémente les compteurs AI d'un user (utilisée par les routes IA)
CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id uuid,
  p_tokens_in integer,
  p_tokens_out integer,
  p_cost_usd numeric
) RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET
    ai_tokens_this_month = ai_tokens_this_month + p_tokens_in + p_tokens_out,
    ai_tokens_lifetime = ai_tokens_lifetime + p_tokens_in + p_tokens_out,
    ai_cost_this_month_usd = ai_cost_this_month_usd + p_cost_usd,
    ai_cost_lifetime_usd = ai_cost_lifetime_usd + p_cost_usd,
    last_active_at = now()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset mensuel (à appeler par un cron)
CREATE OR REPLACE FUNCTION reset_monthly_ai_usage()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET
    ai_calls_this_month = 0,
    ai_tokens_this_month = 0,
    ai_cost_this_month_usd = 0,
    ai_calls_month_reset = now() + interval '1 month';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vue : coût IA total par jour (admin/debug)
CREATE OR REPLACE VIEW v_ai_cost_daily AS
SELECT
  DATE(created_at) as day,
  endpoint,
  COUNT(*) as call_count,
  SUM(tokens_input) as total_tokens_in,
  SUM(tokens_output) as total_tokens_out,
  SUM(cost_usd) as total_cost_usd,
  AVG(duration_ms) as avg_duration_ms
FROM ai_token_usage
GROUP BY DATE(created_at), endpoint
ORDER BY day DESC, total_cost_usd DESC;

-- Vue : top users par consommation (admin/debug)
CREATE OR REPLACE VIEW v_ai_top_users AS
SELECT
  p.id,
  p.display_name,
  p.is_premium,
  COUNT(t.*) as call_count,
  SUM(t.tokens_input + t.tokens_output) as total_tokens,
  SUM(t.cost_usd) as total_cost_usd,
  MAX(t.created_at) as last_call_at
FROM profiles p
LEFT JOIN ai_token_usage t ON t.user_id = p.id
WHERE t.created_at > now() - interval '30 days'
GROUP BY p.id, p.display_name, p.is_premium
ORDER BY total_cost_usd DESC;
