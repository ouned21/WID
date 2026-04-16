-- =============================================================================
-- FAIRSHARE / WID — RESET COMPLET + SCHÉMA PROPRE
-- =============================================================================
-- Colle tout dans l'éditeur SQL Supabase et exécute en une seule fois.
-- ⚠️  Cela SUPPRIME toutes les données existantes (tâches, complétions, journaux).
-- Les comptes auth.users ne sont PAS supprimés — recréer via l'UI Supabase si besoin.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. NETTOYAGE — DROP tout dans le bon ordre
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.v_ai_top_users CASCADE;
DROP VIEW IF EXISTS public.v_ai_cost_daily CASCADE;

DROP TABLE IF EXISTS public.feature_usage_events CASCADE;
DROP TABLE IF EXISTS public.user_patterns CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;
DROP TABLE IF EXISTS public.ai_token_usage CASCADE;
DROP TABLE IF EXISTS public.user_journals CASCADE;
DROP TABLE IF EXISTS public.task_exchanges CASCADE;
DROP TABLE IF EXISTS public.task_completions CASCADE;
DROP TABLE IF EXISTS public.household_tasks CASCADE;
DROP TABLE IF EXISTS public.phantom_members CASCADE;
DROP TABLE IF EXISTS public.task_associations CASCADE;
DROP TABLE IF EXISTS public.onboarding_equipment CASCADE;
DROP TABLE IF EXISTS public.task_templates CASCADE;
DROP TABLE IF EXISTS public.task_categories CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.households CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.increment_ai_usage(uuid, integer, integer, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.reset_ai_counter_if_needed(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.reset_monthly_ai_usage() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_preferences_updated_at() CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. HOUSEHOLDS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.households (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  created_by   uuid        NOT NULL,
  -- Enrichissements analytics
  total_completions_count integer       DEFAULT 0,
  health_score            numeric(4,2)  DEFAULT NULL,
  last_activity_at        timestamptz   DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "households_select"
  ON public.households FOR SELECT
  USING (id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "households_insert"
  ON public.households FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "households_update"
  ON public.households FOR UPDATE
  USING (created_by = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PROFILES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id                      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id            uuid        REFERENCES public.households(id) ON DELETE SET NULL,
  display_name            text,
  avatar_url              text,

  -- Répartition & charge
  target_share_percent    smallint    DEFAULT 50,
  vacation_mode           boolean     DEFAULT false,

  -- Premium
  is_premium              boolean     DEFAULT false,
  premium_until           timestamptz DEFAULT NULL,

  -- Rate limiting IA
  ai_calls_this_month     integer     DEFAULT 0,
  ai_calls_month_reset    timestamptz DEFAULT (now() + interval '1 month'),

  -- Agrégats IA lifetime
  ai_tokens_this_month    integer     DEFAULT 0,
  ai_tokens_lifetime      integer     DEFAULT 0,
  ai_cost_this_month_usd  numeric(10,6) DEFAULT 0,
  ai_cost_lifetime_usd    numeric(10,6) DEFAULT 0,

  -- Activité
  last_journal_at         timestamptz DEFAULT NULL,
  journal_streak_days     integer     DEFAULT 0,
  total_tasks_completed   integer     DEFAULT 0,
  last_active_at          timestamptz DEFAULT now(),

  created_at              timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "profiles_insert"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE INDEX idx_profiles_household ON public.profiles(household_id);
CREATE INDEX idx_profiles_is_premium ON public.profiles(is_premium);

-- Trigger : créer le profil automatiquement à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TASK CATEGORIES  (UUIDs fixes pour que les templates pointent dessus)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.task_categories (
  id         uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text  NOT NULL UNIQUE,
  icon       text,
  color_hex  text,
  sort_order int   DEFAULT 0
);

ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_categories_select"
  ON public.task_categories FOR SELECT
  TO authenticated USING (true);

-- Insertion avec UUIDs fixes (référencés par les templates)
INSERT INTO public.task_categories (id, name, icon, color_hex, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Nettoyage',       '🧹', '#007AFF', 1),
  ('22222222-2222-2222-2222-222222222222', 'Rangement',       '📦', '#5856D6', 2),
  ('33333333-3333-3333-3333-333333333333', 'Courses',         '🛒', '#FF9500', 3),
  ('44444444-4444-4444-4444-444444444444', 'Linge',           '👕', '#34C759', 4),
  ('55555555-5555-5555-5555-555555555555', 'Enfants',         '👶', '#FF6B9D', 5),
  ('66666666-6666-6666-6666-666666666666', 'Cuisine',         '🍳', '#FF9500', 6),
  ('77777777-7777-7777-7777-777777777777', 'Administratif',   '📋', '#5856D6', 7),
  ('88888888-8888-8888-8888-888888888888', 'Extérieur',       '🌿', '#34C759', 8),
  ('99999999-9999-9999-9999-999999999999', 'Hygiène',         '🚿', '#00C7BE', 9),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Animaux',         '🐾', '#AF52DE', 10),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Voiture',         '🚗', '#636366', 11),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gestion foyer',   '🏠', '#007AFF', 12),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Transport',       '🚌', '#FF9F0A', 13)
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TASK TEMPLATES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.task_templates (
  id                      uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id             uuid    REFERENCES public.task_categories(id),
  name                    text    NOT NULL,
  default_frequency       text    DEFAULT 'weekly',
  default_mental_load_score smallint DEFAULT 2,
  scoring_category        text,
  default_duration        text,
  default_physical        text    DEFAULT 'light',
  typical_time            text    DEFAULT 'flexible',
  description             text,
  sort_order              smallint DEFAULT 0,
  is_system               boolean DEFAULT true,
  is_premium              boolean DEFAULT false
);

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_templates_select"
  ON public.task_templates FOR SELECT
  TO authenticated USING (true);

-- Templates système (les plus utilisés — liste complète dans templates_500.sql)
INSERT INTO public.task_templates (category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time) VALUES
  -- Nettoyage
  ('11111111-1111-1111-1111-111111111111', 'Faire la vaisselle',           'daily',     1, true, 'cleaning',  'short',      'light',  'soir'),
  ('11111111-1111-1111-1111-111111111111', 'Vider le lave-vaisselle',      'daily',     1, true, 'cleaning',  'short',      'light',  'matin'),
  ('11111111-1111-1111-1111-111111111111', 'Passer l''aspirateur',         'weekly',    3, true, 'cleaning',  'medium',     'medium', 'flexible'),
  ('11111111-1111-1111-1111-111111111111', 'Laver les sols',               'weekly',    3, true, 'cleaning',  'medium',     'medium', 'flexible'),
  ('11111111-1111-1111-1111-111111111111', 'Nettoyer la cuisine',          'weekly',    3, true, 'cleaning',  'medium',     'medium', 'flexible'),
  ('11111111-1111-1111-1111-111111111111', 'Nettoyer la salle de bain',    'weekly',    3, true, 'hygiene',   'medium',     'medium', 'flexible'),
  ('11111111-1111-1111-1111-111111111111', 'Nettoyer les toilettes',       'weekly',    2, true, 'hygiene',   'short',      'medium', 'flexible'),
  ('11111111-1111-1111-1111-111111111111', 'Dépoussiérer les meubles',     'weekly',    2, true, 'cleaning',  'short',      'light',  'flexible'),
  ('11111111-1111-1111-1111-111111111111', 'Nettoyer les vitres',          'monthly',   3, true, 'cleaning',  'medium',     'medium', 'flexible'),
  ('11111111-1111-1111-1111-111111111111', 'Décrasser le four',            'monthly',   4, true, 'cleaning',  'medium',     'medium', 'flexible'),
  ('11111111-1111-1111-1111-111111111111', 'Nettoyer le réfrigérateur',    'monthly',   4, true, 'cleaning',  'medium',     'medium', 'flexible'),
  ('11111111-1111-1111-1111-111111111111', 'Détartrer la bouilloire',      'monthly',   2, true, 'cleaning',  'short',      'none',   'flexible'),
  ('11111111-1111-1111-1111-111111111111', 'Nettoyer la machine à laver',  'monthly',   2, true, 'cleaning',  'short',      'none',   'flexible'),
  -- Rangement
  ('22222222-2222-2222-2222-222222222222', 'Ranger la cuisine',            'daily',     1, true, 'tidying',   'short',      'light',  'soir'),
  ('22222222-2222-2222-2222-222222222222', 'Ranger les chambres',          'weekly',    2, true, 'tidying',   'medium',     'light',  'flexible'),
  ('22222222-2222-2222-2222-222222222222', 'Ranger les placards',          'monthly',   3, true, 'tidying',   'medium',     'light',  'flexible'),
  ('22222222-2222-2222-2222-222222222222', 'Vider les poubelles',          'weekly',    1, true, 'tidying',   'short',      'light',  'soir'),
  ('22222222-2222-2222-2222-222222222222', 'Sortir les poubelles (tri)',   'weekly',    2, true, 'tidying',   'short',      'light',  'soir'),
  ('22222222-2222-2222-2222-222222222222', 'Désencombrer / donner',        'quarterly', 4, true, 'tidying',   'long',       'medium', 'flexible'),
  -- Courses
  ('33333333-3333-3333-3333-333333333333', 'Faire les courses',            'weekly',    3, true, 'shopping',  'long',       'medium', 'matin'),
  ('33333333-3333-3333-3333-333333333333', 'Faire la liste de courses',    'weekly',    2, true, 'shopping',  'short',      'none',   'flexible'),
  ('33333333-3333-3333-3333-333333333333', 'Commander en ligne',           'weekly',    2, true, 'shopping',  'short',      'none',   'flexible'),
  ('33333333-3333-3333-3333-333333333333', 'Gérer les stocks alimentaires','weekly',    3, true, 'shopping',  'short',      'none',   'flexible'),
  -- Linge
  ('44444444-4444-4444-4444-444444444444', 'Lancer une lessive',          'weekly',    2, true, 'laundry',   'short',      'light',  'matin'),
  ('44444444-4444-4444-4444-444444444444', 'Étendre le linge',            'weekly',    2, true, 'laundry',   'short',      'light',  'flexible'),
  ('44444444-4444-4444-4444-444444444444', 'Plier le linge',              'weekly',    2, true, 'laundry',   'short',      'light',  'soir'),
  ('44444444-4444-4444-4444-444444444444', 'Ranger le linge dans les armoires', 'weekly', 2, true, 'laundry', 'short',     'light',  'flexible'),
  ('44444444-4444-4444-4444-444444444444', 'Repasser',                    'weekly',    3, true, 'laundry',   'medium',     'medium', 'flexible'),
  -- Cuisine / Repas
  ('66666666-6666-6666-6666-666666666666', 'Préparer / cuisiner le dîner','daily',     4, true, 'meals',     'medium',     'light',  'soir'),
  ('66666666-6666-6666-6666-666666666666', 'Préparer les déjeuners',      'daily',     3, true, 'meals',     'short',      'light',  'matin'),
  ('66666666-6666-6666-6666-666666666666', 'Planifier les repas de la semaine', 'weekly', 3, true, 'meals',  'short',      'none',   'flexible'),
  ('66666666-6666-6666-6666-666666666666', 'Cuisiner les repas principaux','daily',    4, true, 'meals',     'medium',     'light',  'soir'),
  -- Enfants
  ('55555555-5555-5555-5555-555555555555', 'Amener les enfants à l''école','daily',    4, true, 'children',  'short',      'light',  'matin'),
  ('55555555-5555-5555-5555-555555555555', 'Récupérer les enfants à l''école','daily', 4, true, 'children',  'short',      'light',  'soir'),
  ('55555555-5555-5555-5555-555555555555', 'Bain / douche des enfants',   'daily',     3, true, 'children',  'short',      'medium', 'soir'),
  ('55555555-5555-5555-5555-555555555555', 'Aide aux devoirs',            'daily',     4, true, 'children',  'medium',     'none',   'soir'),
  ('55555555-5555-5555-5555-555555555555', 'Préparer les cartables',      'daily',     3, true, 'children',  'very_short', 'none',   'soir'),
  -- Administratif
  ('77777777-7777-7777-7777-777777777777', 'Gérer le courrier',           'weekly',    3, true, 'admin',     'short',      'none',   'flexible'),
  ('77777777-7777-7777-7777-777777777777', 'Payer les factures',          'monthly',   4, true, 'admin',     'short',      'none',   'flexible'),
  ('77777777-7777-7777-7777-777777777777', 'Gérer les assurances',        'yearly',    4, true, 'admin',     'medium',     'none',   'flexible'),
  -- Extérieur
  ('88888888-8888-8888-8888-888888888888', 'Tondre la pelouse',           'weekly',    3, true, 'outdoor',   'long',       'high',   'flexible'),
  ('88888888-8888-8888-8888-888888888888', 'Arroser les plantes',         'weekly',    1, true, 'outdoor',   'very_short', 'light',  'matin'),
  ('88888888-8888-8888-8888-888888888888', 'Nettoyer le jardin / terrasse','monthly',  3, true, 'outdoor',   'long',       'high',   'flexible'),
  -- Animaux
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nourrir les animaux',         'daily',     2, true, 'pets',      'very_short', 'none',   'flexible'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sortir le chien',             'daily',     3, true, 'pets',      'short',      'light',  'matin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nettoyer la litière',         'daily',     2, true, 'pets',      'very_short', 'light',  'flexible'),
  -- Véhicule
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Faire le plein',              'weekly',    1, true, 'vehicle',   'short',      'light',  'flexible'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Laver la voiture',            'monthly',   2, true, 'vehicle',   'medium',     'medium', 'flexible'),
  -- Gestion foyer
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gérer les réparations',       'monthly',   4, true, 'household_management', 'long', 'medium', 'flexible'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Organiser les placards',      'quarterly', 3, true, 'household_management', 'long', 'medium', 'flexible');


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TASK ASSOCIATIONS  (sous-tâches auto, onboarding)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.task_associations (
  id                        uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type              text    NOT NULL,
  trigger_value             text    NOT NULL,
  suggested_name            text    NOT NULL,
  suggested_category_id     uuid    REFERENCES public.task_categories(id),
  suggested_scoring_category text,
  suggested_frequency       text    DEFAULT 'once',
  suggested_duration        text    DEFAULT 'short',
  suggested_physical        text    DEFAULT 'light',
  suggested_mental_load_score smallint DEFAULT 3,
  relative_days             integer DEFAULT 0,
  description               text,
  sort_order                smallint DEFAULT 0,
  is_premium                boolean DEFAULT false,
  pack_name                 text    DEFAULT NULL,
  created_at                timestamptz DEFAULT now()
);

ALTER TABLE public.task_associations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_associations_select"
  ON public.task_associations FOR SELECT
  USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ONBOARDING EQUIPMENT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.onboarding_equipment (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text  NOT NULL,
  icon        text,
  category_id uuid  REFERENCES public.task_categories(id),
  sort_order  int   DEFAULT 0,
  is_active   boolean DEFAULT true
);

ALTER TABLE public.onboarding_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_equipment_select"
  ON public.onboarding_equipment FOR SELECT
  TO authenticated USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. PHANTOM MEMBERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.phantom_members (
  id                  uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        uuid  NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  display_name        text  NOT NULL,
  target_share_percent smallint DEFAULT NULL,
  created_by          uuid  NOT NULL REFERENCES public.profiles(id),
  linked_profile_id   uuid  DEFAULT NULL REFERENCES public.profiles(id),
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.phantom_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phantom_members_select"
  ON public.phantom_members FOR SELECT
  USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "phantom_members_insert"
  ON public.phantom_members FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "phantom_members_delete"
  ON public.phantom_members FOR DELETE
  USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. HOUSEHOLD TASKS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.household_tasks (
  id                      uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id            uuid    NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name                    text    NOT NULL,
  category_id             uuid    REFERENCES public.task_categories(id),
  scoring_category        text,

  frequency               text    NOT NULL DEFAULT 'weekly'
    CHECK (frequency IN ('daily','weekly','biweekly','monthly','quarterly','once','semiannual','yearly')),
  duration_estimate       text
    CHECK (duration_estimate IN ('very_short','short','medium','long','very_long')),
  physical_effort         text    DEFAULT 'light'
    CHECK (physical_effort IN ('none','light','medium','high')),
  mental_load_score       int     DEFAULT 2  CHECK (mental_load_score BETWEEN 1 AND 5),
  user_score              smallint DEFAULT NULL CHECK (user_score IS NULL OR (user_score >= 0 AND user_score <= 10)),
  estimated_cost          numeric(10,2) DEFAULT NULL,

  assigned_to             uuid    REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to_phantom_id  uuid    REFERENCES public.phantom_members(id) ON DELETE SET NULL,

  is_active               boolean DEFAULT true,
  is_fixed_assignment     boolean DEFAULT false,
  notifications_enabled   boolean DEFAULT true,
  created_by              uuid    NOT NULL REFERENCES public.profiles(id),
  next_due_at             timestamptz,
  created_at              timestamptz DEFAULT now()
);

ALTER TABLE public.household_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household_tasks_select"
  ON public.household_tasks FOR SELECT
  USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "household_tasks_insert"
  ON public.household_tasks FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "household_tasks_update"
  ON public.household_tasks FOR UPDATE
  USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "household_tasks_delete"
  ON public.household_tasks FOR DELETE
  USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX idx_household_tasks_household ON public.household_tasks(household_id);
CREATE INDEX idx_household_tasks_assigned  ON public.household_tasks(assigned_to);
CREATE INDEX idx_household_tasks_due       ON public.household_tasks(next_due_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. USER JOURNALS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.user_journals (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  household_id        uuid    NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  raw_text            text    NOT NULL,
  input_method        text    NOT NULL DEFAULT 'text' CHECK (input_method IN ('text','voice')),
  parsed_completions  jsonb   DEFAULT '[]'::jsonb,
  unmatched_items     jsonb   DEFAULT '[]'::jsonb,
  ai_response         text    DEFAULT NULL,
  mood_tone           text    DEFAULT NULL
    CHECK (mood_tone IN ('happy','tired','overwhelmed','satisfied','frustrated','neutral')),
  tokens_input        integer DEFAULT 0,
  tokens_output       integer DEFAULT 0,
  cost_usd            numeric(10,6) DEFAULT 0,
  model_used          text    DEFAULT 'claude-haiku-4-5',
  processing_time_ms  integer DEFAULT 0,
  error               text    DEFAULT NULL,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.user_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_journals_select"
  ON public.user_journals FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_journals_insert"
  ON public.user_journals FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_journals_delete"
  ON public.user_journals FOR DELETE USING (user_id = auth.uid());

CREATE INDEX idx_user_journals_user    ON public.user_journals(user_id, created_at DESC);
CREATE INDEX idx_user_journals_created ON public.user_journals(created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. TASK COMPLETIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.task_completions (
  id                      uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id                 uuid    NOT NULL REFERENCES public.household_tasks(id) ON DELETE CASCADE,
  household_id            uuid    NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  completed_by            uuid    NOT NULL REFERENCES public.profiles(id),
  completed_by_phantom_id uuid    REFERENCES public.phantom_members(id) ON DELETE SET NULL,
  completed_at            timestamptz DEFAULT now(),
  duration_minutes        integer,
  note                    text,
  mental_load_score       integer,
  completion_method       text    DEFAULT 'manual'
    CHECK (completion_method IN ('manual','journal','recap','voice','ai_inferred')),
  source_text             text,
  confidence              numeric(3,2),
  journal_id              uuid    REFERENCES public.user_journals(id) ON DELETE SET NULL,
  created_at              timestamptz DEFAULT now()
);

ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_completions_select"
  ON public.task_completions FOR SELECT
  USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "task_completions_insert"
  ON public.task_completions FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "task_completions_delete"
  ON public.task_completions FOR DELETE
  USING (completed_by = auth.uid());

CREATE INDEX idx_task_completions_household   ON public.task_completions(household_id);
CREATE INDEX idx_task_completions_task        ON public.task_completions(task_id);
CREATE INDEX idx_task_completions_completed_at ON public.task_completions(completed_at DESC);
CREATE INDEX idx_task_completions_by          ON public.task_completions(completed_by);


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. TASK EXCHANGES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.task_exchanges (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    uuid  NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  proposed_by     uuid  NOT NULL REFERENCES public.profiles(id),
  proposed_to     uuid  NOT NULL REFERENCES public.profiles(id),
  task_id         uuid  REFERENCES public.household_tasks(id) ON DELETE SET NULL,
  status          text  DEFAULT 'pending' CHECK (status IN ('pending','accepted','refused','expired')),
  message         text,
  created_at      timestamptz DEFAULT now(),
  responded_at    timestamptz
);

ALTER TABLE public.task_exchanges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_exchanges_select"
  ON public.task_exchanges FOR SELECT
  USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "task_exchanges_insert"
  ON public.task_exchanges FOR INSERT
  WITH CHECK (proposed_by = auth.uid());

CREATE POLICY "task_exchanges_update"
  ON public.task_exchanges FOR UPDATE
  USING (proposed_to = auth.uid() OR proposed_by = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 12. AI TOKEN USAGE  (log détaillé par appel)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.ai_token_usage (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  household_id    uuid    REFERENCES public.households(id) ON DELETE SET NULL,
  endpoint        text    NOT NULL,
  model           text    NOT NULL DEFAULT 'claude-haiku-4-5',
  tokens_input    integer NOT NULL DEFAULT 0,
  tokens_output   integer NOT NULL DEFAULT 0,
  cost_usd        numeric(10,6) NOT NULL DEFAULT 0,
  duration_ms     integer NOT NULL DEFAULT 0,
  status          text    NOT NULL DEFAULT 'success'
    CHECK (status IN ('success','error','rate_limited','premium_required')),
  error_message   text    DEFAULT NULL,
  metadata        jsonb   DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.ai_token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_token_usage_select"
  ON public.ai_token_usage FOR SELECT USING (user_id = auth.uid());

-- INSERT uniquement depuis le serveur (service role contourne RLS)

CREATE INDEX idx_ai_token_usage_user    ON public.ai_token_usage(user_id, created_at DESC);
CREATE INDEX idx_ai_token_usage_endpoint ON public.ai_token_usage(endpoint, created_at DESC);
CREATE INDEX idx_ai_token_usage_created  ON public.ai_token_usage(created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 13. FEATURE USAGE EVENTS  (funnel / rétention)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.feature_usage_events (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  household_id    uuid  REFERENCES public.households(id) ON DELETE SET NULL,
  event_name      text  NOT NULL,
  event_category  text  NOT NULL DEFAULT 'general',
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.feature_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_usage_events_insert"
  ON public.feature_usage_events FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "feature_usage_events_select"
  ON public.feature_usage_events FOR SELECT USING (user_id = auth.uid());

CREATE INDEX idx_feature_usage_user ON public.feature_usage_events(user_id, created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 14. USER PATTERNS  (patterns comportementaux, rempli par le backend)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.user_patterns (
  id                          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid    NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferred_completion_hour   smallint DEFAULT NULL,
  avg_tasks_per_day           numeric(5,2) DEFAULT NULL,
  most_active_day             smallint DEFAULT NULL,
  category_affinity           jsonb   DEFAULT '{}'::jsonb,
  avg_duration_by_category    jsonb   DEFAULT '{}'::jsonb,
  completion_streak_days      integer DEFAULT 0,
  longest_streak_days         integer DEFAULT 0,
  ai_memory_summary           text    DEFAULT NULL,
  ai_memory_updated_at        timestamptz DEFAULT NULL,
  updated_at                  timestamptz DEFAULT now(),
  created_at                  timestamptz DEFAULT now()
);

ALTER TABLE public.user_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_patterns_select"
  ON public.user_patterns FOR SELECT USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 15. USER PREFERENCES  (personnalisation IA)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.user_preferences (
  id                   uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid  NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  hated_tasks          text[]    DEFAULT '{}',
  loved_tasks          text[]    DEFAULT '{}',
  preferred_time_slot  text      DEFAULT 'flexible',
  unavailable_days     smallint[] DEFAULT '{}',
  load_preference      text      DEFAULT 'balanced',
  freeform_note        text      DEFAULT NULL,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select"
  ON public.user_preferences FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_preferences_insert"
  ON public.user_preferences FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_preferences_update"
  ON public.user_preferences FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "user_preferences_delete"
  ON public.user_preferences FOR DELETE USING (user_id = auth.uid());

CREATE INDEX idx_user_preferences_user ON public.user_preferences(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_user_preferences_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_user_preferences_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 16. FONCTIONS SQL
-- ─────────────────────────────────────────────────────────────────────────────

-- Incrémente les compteurs IA du profil (atomique, sans race condition)
CREATE OR REPLACE FUNCTION public.increment_ai_usage(
  p_user_id   uuid,
  p_tokens_in integer,
  p_tokens_out integer,
  p_cost_usd  numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles SET
    ai_tokens_this_month    = ai_tokens_this_month + p_tokens_in + p_tokens_out,
    ai_tokens_lifetime      = ai_tokens_lifetime + p_tokens_in + p_tokens_out,
    ai_cost_this_month_usd  = ai_cost_this_month_usd + p_cost_usd,
    ai_cost_lifetime_usd    = ai_cost_lifetime_usd + p_cost_usd,
    last_active_at          = now()
  WHERE id = p_user_id;
END;
$$;

-- Reset mensuel du compteur d'appels IA (à appeler si besoin ou via cron)
CREATE OR REPLACE FUNCTION public.reset_ai_counter_if_needed(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles SET
    ai_calls_this_month   = 0,
    ai_calls_month_reset  = now() + interval '1 month'
  WHERE id = p_user_id
    AND ai_calls_month_reset < now();
END;
$$;

-- Reset mensuel global (cron job)
CREATE OR REPLACE FUNCTION public.reset_monthly_ai_usage()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles SET
    ai_calls_this_month    = 0,
    ai_tokens_this_month   = 0,
    ai_cost_this_month_usd = 0,
    ai_calls_month_reset   = now() + interval '1 month';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 17. VUES ANALYTICS  (sans SECURITY DEFINER → fix Security Advisor)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE VIEW public.v_ai_cost_daily AS
SELECT
  DATE(created_at)      AS day,
  endpoint,
  COUNT(*)              AS call_count,
  SUM(tokens_input)     AS total_tokens_in,
  SUM(tokens_output)    AS total_tokens_out,
  SUM(cost_usd)         AS total_cost_usd,
  AVG(duration_ms)      AS avg_duration_ms
FROM public.ai_token_usage
GROUP BY DATE(created_at), endpoint
ORDER BY day DESC, total_cost_usd DESC;

CREATE VIEW public.v_ai_top_users AS
SELECT
  p.id,
  p.display_name,
  p.is_premium,
  COUNT(t.id)                     AS call_count,
  SUM(t.tokens_input + t.tokens_output) AS total_tokens,
  SUM(t.cost_usd)                 AS total_cost_usd,
  MAX(t.created_at)               AS last_call_at
FROM public.profiles p
LEFT JOIN public.ai_token_usage t ON t.user_id = p.id
  AND t.created_at > now() - interval '30 days'
GROUP BY p.id, p.display_name, p.is_premium
ORDER BY total_cost_usd DESC NULLS LAST;


-- ─────────────────────────────────────────────────────────────────────────────
-- 18. APRÈS LE RESET : remettre ton compte en premium
-- ─────────────────────────────────────────────────────────────────────────────
-- Exécute cette ligne APRÈS t'être reconnecté dans l'app
-- (remplace 'Jonathan' par ton display_name si différent)
--
-- UPDATE public.profiles
--   SET is_premium = true, premium_until = '2027-01-01'
--   WHERE display_name = 'Jonathan';


-- ─────────────────────────────────────────────────────────────────────────────
-- VÉRIFICATION FINALE
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = t.table_name AND table_schema = 'public') AS nb_colonnes
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
