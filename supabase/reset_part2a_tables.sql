-- =============================================================
-- PARTIE 2a — Tables principales (phantom, tasks, journals, completions, exchanges)
-- À exécuter APRÈS la partie 1
-- =============================================================

-- ── PHANTOM MEMBERS ──────────────────────────────────────────
CREATE TABLE public.phantom_members (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id         uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  display_name         text NOT NULL,
  target_share_percent smallint DEFAULT NULL,
  created_by           uuid NOT NULL REFERENCES public.profiles(id),
  linked_profile_id    uuid DEFAULT NULL REFERENCES public.profiles(id),
  created_at           timestamptz DEFAULT now()
);
ALTER TABLE public.phantom_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phantom_select" ON public.phantom_members FOR SELECT
  USING (household_id = public.get_my_household_id());
CREATE POLICY "phantom_insert" ON public.phantom_members FOR INSERT
  WITH CHECK (household_id = public.get_my_household_id());
CREATE POLICY "phantom_delete" ON public.phantom_members FOR DELETE
  USING (household_id = public.get_my_household_id());

-- ── HOUSEHOLD TASKS ──────────────────────────────────────────
CREATE TABLE public.household_tasks (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id           uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name                   text NOT NULL,
  category_id            uuid REFERENCES public.task_categories(id),
  scoring_category       text,
  frequency              text NOT NULL DEFAULT 'weekly'
    CHECK (frequency IN ('daily','weekly','biweekly','monthly','quarterly','once','semiannual','yearly')),
  duration_estimate      text
    CHECK (duration_estimate IN ('very_short','short','medium','long','very_long')),
  physical_effort        text DEFAULT 'light'
    CHECK (physical_effort IN ('none','light','medium','high')),
  mental_load_score      int DEFAULT 2 CHECK (mental_load_score BETWEEN 1 AND 5),
  user_score             smallint DEFAULT NULL
    CHECK (user_score IS NULL OR (user_score >= 0 AND user_score <= 10)),
  estimated_cost         numeric(10,2) DEFAULT NULL,
  assigned_to            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to_phantom_id uuid REFERENCES public.phantom_members(id) ON DELETE SET NULL,
  is_active              boolean DEFAULT true,
  is_fixed_assignment    boolean DEFAULT false,
  notifications_enabled  boolean DEFAULT true,
  created_by             uuid NOT NULL REFERENCES public.profiles(id),
  next_due_at            timestamptz,
  created_at             timestamptz DEFAULT now()
);
ALTER TABLE public.household_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select" ON public.household_tasks FOR SELECT
  USING (household_id = public.get_my_household_id());
CREATE POLICY "tasks_insert" ON public.household_tasks FOR INSERT
  WITH CHECK (household_id = public.get_my_household_id());
CREATE POLICY "tasks_update" ON public.household_tasks FOR UPDATE
  USING (household_id = public.get_my_household_id());
CREATE POLICY "tasks_delete" ON public.household_tasks FOR DELETE
  USING (household_id = public.get_my_household_id());
CREATE INDEX idx_household_tasks_household ON public.household_tasks(household_id);
CREATE INDEX idx_household_tasks_due       ON public.household_tasks(next_due_at);

-- ── USER JOURNALS ────────────────────────────────────────────
CREATE TABLE public.user_journals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  household_id       uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  raw_text           text NOT NULL,
  input_method       text NOT NULL DEFAULT 'text' CHECK (input_method IN ('text','voice')),
  parsed_completions jsonb DEFAULT '[]'::jsonb,
  unmatched_items    jsonb DEFAULT '[]'::jsonb,
  ai_response        text DEFAULT NULL,
  mood_tone          text DEFAULT NULL
    CHECK (mood_tone IN ('happy','tired','overwhelmed','satisfied','frustrated','neutral')),
  tokens_input       integer DEFAULT 0,
  tokens_output      integer DEFAULT 0,
  cost_usd           numeric(10,6) DEFAULT 0,
  model_used         text DEFAULT 'claude-haiku-4-5',
  processing_time_ms integer DEFAULT 0,
  error              text DEFAULT NULL,
  created_at         timestamptz DEFAULT now()
);
ALTER TABLE public.user_journals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journals_select" ON public.user_journals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "journals_insert" ON public.user_journals FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "journals_delete" ON public.user_journals FOR DELETE USING (user_id = auth.uid());
CREATE INDEX idx_user_journals_user ON public.user_journals(user_id, created_at DESC);

-- ── TASK COMPLETIONS ─────────────────────────────────────────
CREATE TABLE public.task_completions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id                 uuid NOT NULL REFERENCES public.household_tasks(id) ON DELETE CASCADE,
  household_id            uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  completed_by            uuid NOT NULL REFERENCES public.profiles(id),
  completed_by_phantom_id uuid REFERENCES public.phantom_members(id) ON DELETE SET NULL,
  completed_at            timestamptz DEFAULT now(),
  duration_minutes        integer,
  note                    text,
  mental_load_score       integer,
  completion_method       text DEFAULT 'manual'
    CHECK (completion_method IN ('manual','journal','recap','voice','ai_inferred')),
  source_text             text,
  confidence              numeric(3,2),
  journal_id              uuid REFERENCES public.user_journals(id) ON DELETE SET NULL,
  created_at              timestamptz DEFAULT now()
);
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "completions_select" ON public.task_completions FOR SELECT
  USING (household_id = public.get_my_household_id());
CREATE POLICY "completions_insert" ON public.task_completions FOR INSERT
  WITH CHECK (household_id = public.get_my_household_id());
CREATE POLICY "completions_delete" ON public.task_completions FOR DELETE
  USING (completed_by = auth.uid());
CREATE INDEX idx_completions_household    ON public.task_completions(household_id);
CREATE INDEX idx_completions_task         ON public.task_completions(task_id);
CREATE INDEX idx_completions_completed_at ON public.task_completions(completed_at DESC);

-- ── TASK EXCHANGES ───────────────────────────────────────────
CREATE TABLE public.task_exchanges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  proposed_by  uuid NOT NULL REFERENCES public.profiles(id),
  proposed_to  uuid NOT NULL REFERENCES public.profiles(id),
  task_id      uuid REFERENCES public.household_tasks(id) ON DELETE SET NULL,
  status       text DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','refused','expired')),
  message      text,
  created_at   timestamptz DEFAULT now(),
  responded_at timestamptz
);
ALTER TABLE public.task_exchanges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exchanges_select" ON public.task_exchanges FOR SELECT
  USING (household_id = public.get_my_household_id());
CREATE POLICY "exchanges_insert" ON public.task_exchanges FOR INSERT
  WITH CHECK (proposed_by = auth.uid());
CREATE POLICY "exchanges_update" ON public.task_exchanges FOR UPDATE
  USING (proposed_to = auth.uid() OR proposed_by = auth.uid());

SELECT 'Partie 2a OK' AS statut;
