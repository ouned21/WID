-- =============================================================
-- RESET COMPLET — 1 seul fichier à coller dans Supabase SQL Editor
-- Ordre : Part1 → Part2a → Part2b → Part3 → Associations
-- =============================================================

-- =============================================================
-- PARTIE 1 : DROP + BASE
-- =============================================================
-- =============================================================
-- PARTIE 1 / 3 — DROP + tables de base
-- Exécute en premier, puis part2, puis part3
-- =============================================================

-- ── DROP tout ────────────────────────────────────────────────
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
DROP FUNCTION IF EXISTS public.increment_ai_usage(uuid,integer,integer,numeric) CASCADE;
DROP FUNCTION IF EXISTS public.reset_ai_counter_if_needed(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.reset_monthly_ai_usage() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_preferences_updated_at() CASCADE;

-- ── HOUSEHOLDS ───────────────────────────────────────────────
CREATE TABLE public.households (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text        NOT NULL,
  invite_code             text        UNIQUE,
  invite_code_expires_at  timestamptz DEFAULT NULL,
  is_active               boolean     DEFAULT true,
  created_by              uuid        NOT NULL,
  total_completions_count integer     DEFAULT 0,
  health_score            numeric(4,2) DEFAULT NULL,
  last_activity_at        timestamptz DEFAULT now(),
  created_at              timestamptz DEFAULT now()
);
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
-- NOTE: households_select dépend de profiles → créée APRÈS profiles ci-dessous
CREATE POLICY "households_insert" ON public.households FOR INSERT
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "households_update" ON public.households FOR UPDATE
  USING (created_by = auth.uid());

-- ── PROFILES ─────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id                     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id           uuid REFERENCES public.households(id) ON DELETE SET NULL,
  display_name           text,
  avatar_url             text,
  role                   text        DEFAULT NULL,
  joined_at              timestamptz DEFAULT NULL,
  left_at                timestamptz DEFAULT NULL,
  notification_token     text        DEFAULT NULL,
  vacation_started_at    timestamptz DEFAULT NULL,
  target_share_percent   smallint    DEFAULT 50,
  vacation_mode          boolean     DEFAULT false,
  is_premium             boolean     DEFAULT false,
  premium_until          timestamptz DEFAULT NULL,
  ai_calls_this_month    integer     DEFAULT 0,
  ai_calls_month_reset   timestamptz DEFAULT (now() + interval '1 month'),
  ai_journal_consent_at  timestamptz DEFAULT NULL,
  ai_tokens_this_month   integer     DEFAULT 0,
  ai_tokens_lifetime     integer     DEFAULT 0,
  ai_cost_this_month_usd numeric(10,6) DEFAULT 0,
  ai_cost_lifetime_usd   numeric(10,6) DEFAULT 0,
  last_journal_at        timestamptz DEFAULT NULL,
  journal_streak_days    integer     DEFAULT 0,
  total_tasks_completed  integer     DEFAULT 0,
  last_active_at         timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  created_at             timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Fonction SECURITY DEFINER pour briser la récursion RLS de profiles_select
CREATE OR REPLACE FUNCTION public.get_my_household_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT household_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (id = auth.uid() OR household_id = public.get_my_household_id());
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (id = auth.uid());
CREATE INDEX idx_profiles_household ON public.profiles(household_id);
CREATE INDEX idx_profiles_premium   ON public.profiles(is_premium);

-- Politique households_select (utilise aussi la fonction pour cohérence)
CREATE POLICY "households_select" ON public.households FOR SELECT
  USING (id = public.get_my_household_id() OR created_by = auth.uid());

-- Trigger auto-création de profil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    now()
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── TASK CATEGORIES ──────────────────────────────────────────
CREATE TABLE public.task_categories (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text NOT NULL UNIQUE,
  icon      text,
  color_hex text,
  sort_order int DEFAULT 0
);
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_categories_select" ON public.task_categories FOR SELECT
  TO authenticated USING (true);

INSERT INTO public.task_categories (id, name, icon, color_hex, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Nettoyage',     '🧹', '#007AFF', 1),
  ('22222222-2222-2222-2222-222222222222', 'Rangement',     '📦', '#5856D6', 2),
  ('33333333-3333-3333-3333-333333333333', 'Courses',       '🛒', '#FF9500', 3),
  ('44444444-4444-4444-4444-444444444444', 'Linge',         '👕', '#34C759', 4),
  ('55555555-5555-5555-5555-555555555555', 'Enfants',       '👶', '#FF6B9D', 5),
  ('66666666-6666-6666-6666-666666666666', 'Cuisine',       '🍳', '#FF9500', 6),
  ('77777777-7777-7777-7777-777777777777', 'Administratif', '📋', '#5856D6', 7),
  ('88888888-8888-8888-8888-888888888888', 'Extérieur',     '🌿', '#34C759', 8),
  ('99999999-9999-9999-9999-999999999999', 'Hygiène',       '🚿', '#00C7BE', 9),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Animaux',       '🐾', '#AF52DE', 10),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Voiture',       '🚗', '#636366', 11),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gestion foyer', '🏠', '#007AFF', 12),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Transport',     '🚌', '#FF9F0A', 13)
ON CONFLICT (id) DO NOTHING;

-- ── TASK TEMPLATES ───────────────────────────────────────────
CREATE TABLE public.task_templates (
  id                        uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id               uuid     REFERENCES public.task_categories(id),
  name                      text     NOT NULL,
  default_frequency         text     DEFAULT 'weekly',
  default_mental_load_score smallint DEFAULT 2,
  scoring_category          text,
  default_duration          text,
  default_physical          text     DEFAULT 'light',
  typical_time              text     DEFAULT 'flexible',
  description               text,
  sort_order                smallint DEFAULT 0,
  is_system                 boolean  DEFAULT true,
  is_premium                boolean  DEFAULT false
);
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_templates_select" ON public.task_templates FOR SELECT
  TO authenticated USING (true);

INSERT INTO public.task_templates
  (category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time)
VALUES
  ('11111111-1111-1111-1111-111111111111','Faire la vaisselle','daily',1,true,'cleaning','short','light','soir'),
  ('22222222-2222-2222-2222-222222222222','Vider le lave-vaisselle','daily',1,true,'tidying','short','light','matin'),
  ('11111111-1111-1111-1111-111111111111','Passer l''aspirateur','weekly',3,true,'cleaning','medium','medium','flexible'),
  ('11111111-1111-1111-1111-111111111111','Laver les sols','weekly',3,true,'cleaning','medium','medium','flexible'),
  ('11111111-1111-1111-1111-111111111111','Nettoyer la cuisine','weekly',3,true,'cleaning','medium','medium','flexible'),
  ('11111111-1111-1111-1111-111111111111','Nettoyer la salle de bain','weekly',3,true,'hygiene','medium','medium','flexible'),
  ('11111111-1111-1111-1111-111111111111','Nettoyer les toilettes','weekly',2,true,'hygiene','short','medium','flexible'),
  ('11111111-1111-1111-1111-111111111111','Dépoussiérer les meubles','weekly',2,true,'cleaning','short','light','flexible'),
  ('11111111-1111-1111-1111-111111111111','Nettoyer les vitres','monthly',3,true,'cleaning','medium','medium','flexible'),
  ('11111111-1111-1111-1111-111111111111','Décrasser le four','monthly',4,true,'cleaning','medium','medium','flexible'),
  ('11111111-1111-1111-1111-111111111111','Nettoyer le réfrigérateur','monthly',4,true,'cleaning','medium','medium','flexible'),
  ('11111111-1111-1111-1111-111111111111','Détartrer la bouilloire','monthly',2,true,'cleaning','short','none','flexible'),
  ('11111111-1111-1111-1111-111111111111','Nettoyer la machine à laver','monthly',2,true,'cleaning','short','none','flexible'),
  ('22222222-2222-2222-2222-222222222222','Ranger la cuisine','daily',1,true,'tidying','short','light','soir'),
  ('22222222-2222-2222-2222-222222222222','Ranger les chambres','weekly',2,true,'tidying','medium','light','flexible'),
  ('22222222-2222-2222-2222-222222222222','Ranger les placards','monthly',3,true,'tidying','medium','light','flexible'),
  ('22222222-2222-2222-2222-222222222222','Vider les poubelles','weekly',1,true,'tidying','short','light','soir'),
  ('22222222-2222-2222-2222-222222222222','Sortir les poubelles','weekly',2,true,'tidying','short','light','soir'),
  ('22222222-2222-2222-2222-222222222222','Désencombrer / donner','quarterly',4,true,'tidying','long','medium','flexible'),
  ('33333333-3333-3333-3333-333333333333','Faire les courses','weekly',3,true,'shopping','long','medium','matin'),
  ('33333333-3333-3333-3333-333333333333','Faire la liste de courses','weekly',2,true,'shopping','short','none','flexible'),
  ('33333333-3333-3333-3333-333333333333','Commander en ligne','weekly',2,true,'shopping','short','none','flexible'),
  ('33333333-3333-3333-3333-333333333333','Gérer les stocks alimentaires','weekly',3,true,'shopping','short','none','flexible'),
  ('44444444-4444-4444-4444-444444444444','Lancer une lessive','weekly',2,true,'laundry','short','light','matin'),
  ('44444444-4444-4444-4444-444444444444','Étendre le linge','weekly',2,true,'laundry','short','light','flexible'),
  ('44444444-4444-4444-4444-444444444444','Plier le linge','weekly',2,true,'laundry','short','light','soir'),
  ('44444444-4444-4444-4444-444444444444','Ranger le linge','weekly',2,true,'laundry','short','light','flexible'),
  ('44444444-4444-4444-4444-444444444444','Repasser','weekly',3,true,'laundry','medium','medium','flexible'),
  ('55555555-5555-5555-5555-555555555555','Amener les enfants à l''école','daily',4,true,'children','short','light','matin'),
  ('55555555-5555-5555-5555-555555555555','Récupérer les enfants à l''école','daily',4,true,'children','short','light','soir'),
  ('55555555-5555-5555-5555-555555555555','Bain / douche des enfants','daily',3,true,'children','short','medium','soir'),
  ('55555555-5555-5555-5555-555555555555','Aide aux devoirs','daily',4,true,'children','medium','none','soir'),
  ('55555555-5555-5555-5555-555555555555','Préparer les cartables','daily',3,true,'children','very_short','none','soir'),
  ('66666666-6666-6666-6666-666666666666','Préparer le dîner','daily',4,true,'meals','medium','light','soir'),
  ('66666666-6666-6666-6666-666666666666','Préparer les déjeuners','daily',3,true,'meals','short','light','matin'),
  ('66666666-6666-6666-6666-666666666666','Planifier les repas','weekly',3,true,'meals','short','none','flexible'),
  ('77777777-7777-7777-7777-777777777777','Gérer le courrier','weekly',3,true,'admin','short','none','flexible'),
  ('77777777-7777-7777-7777-777777777777','Payer les factures','monthly',4,true,'admin','short','none','flexible'),
  ('88888888-8888-8888-8888-888888888888','Tondre la pelouse','weekly',3,true,'outdoor','long','high','flexible'),
  ('88888888-8888-8888-8888-888888888888','Arroser les plantes','weekly',1,true,'outdoor','very_short','light','matin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Nourrir les animaux','daily',2,true,'pets','very_short','none','flexible'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Sortir le chien','daily',3,true,'pets','short','light','matin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Nettoyer la litière','daily',2,true,'pets','very_short','light','flexible'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Faire le plein','weekly',1,true,'vehicle','short','light','flexible'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Laver la voiture','monthly',2,true,'vehicle','medium','medium','flexible'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc','Gérer les réparations','monthly',4,true,'household_management','long','medium','flexible');

SELECT 'Partie 1 OK — tables de base créées' AS statut;

-- =============================================================
-- PARTIE 2a : TABLES PRINCIPALES
-- =============================================================
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

-- =============================================================
-- PARTIE 2b : ONBOARDING EQUIPMENT
-- =============================================================
-- =============================================================
-- PARTIE 2b — Onboarding equipment
-- À exécuter APRÈS la partie 2a
-- =============================================================

CREATE TABLE public.onboarding_equipment (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  icon       text NOT NULL,
  category   text NOT NULL,
  sort_order smallint DEFAULT 0,
  is_default boolean DEFAULT false
);
ALTER TABLE public.onboarding_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onboarding_equipment_select" ON public.onboarding_equipment
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.onboarding_equipment (id, name, icon, category, sort_order, is_default) VALUES
('four','Four','🔥','cuisine',1,true),
('plaque_cuisson','Plaques de cuisson','🍳','cuisine',2,true),
('hotte','Hotte','💨','cuisine',3,false),
('refrigerateur','Réfrigérateur','🧊','cuisine',4,true),
('lave_vaisselle','Lave-vaisselle','🍽','cuisine',5,true),
('micro_ondes','Micro-ondes','📡','cuisine',6,true),
('cafetiere','Cafetière','☕','cuisine',7,false),
('bouilloire','Bouilloire','🫖','cuisine',8,false),
('grille_pain','Grille-pain','🍞','cuisine',9,false),
('poubelle','Poubelle / Tri','🗑','cuisine',10,true),
('douche','Douche','🚿','salle_de_bain',1,true),
('baignoire','Baignoire','🛁','salle_de_bain',2,false),
('toilettes','Toilettes','🚽','salle_de_bain',3,true),
('lavabo','Lavabo','🪥','salle_de_bain',4,true),
('lave_linge','Lave-linge','🧺','linge',1,true),
('seche_linge','Sèche-linge','♨️','linge',2,false),
('fer_a_repasser','Fer à repasser','👔','linge',3,false),
('etendoir','Étendoir / Séchoir','🧵','linge',4,true),
('aspirateur','Aspirateur','🧹','sols',1,true),
('robot_aspirateur','Robot aspirateur','🤖','sols',2,false),
('serpillere','Serpillère / Balai vapeur','🧽','sols',3,true),
('jardin','Jardin / Pelouse','🌿','exterieur',1,false),
('piscine','Piscine','🏊','exterieur',2,false),
('terrasse','Terrasse / Balcon','🪴','exterieur',3,false),
('barbecue','Barbecue','🔥','exterieur',4,false),
('composteur','Composteur','🌱','exterieur',5,false),
('voiture','Voiture','🚗','vehicule',1,false),
('chien','Chien','🐶','animaux',1,false),
('chat','Chat','🐱','animaux',2,false);

SELECT 'Partie 2b OK — onboarding equipment créé' AS statut;

-- =============================================================
-- PARTIE 3 : AI, FONCTIONS, VUES
-- =============================================================
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

-- =============================================================
-- ASSOCIATIONS TACHES (triggers onboarding)
-- =============================================================
-- =============================================================================
-- MIGRATION : Associations de tâches (sous-tâches automatiques)
-- Quand l'utilisateur crée une tâche parente, l'app suggère les sous-tâches associées.
-- Sert aussi à l'onboarding (équipements → tâches) et aux packs projets.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : task_associations
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Le déclencheur : mot-clé ou contexte qui déclenche les suggestions
  trigger_type text NOT NULL, -- 'keyword', 'equipment', 'child_age', 'event', 'pack'
  trigger_value text NOT NULL, -- ex: 'anniversaire', 'four', '0-2', 'mariage'
  -- La sous-tâche suggérée
  suggested_name text NOT NULL,
  suggested_category_id uuid REFERENCES task_categories(id),
  suggested_scoring_category text,
  suggested_frequency text DEFAULT 'once',
  suggested_duration text DEFAULT 'short',
  suggested_physical text DEFAULT 'light',
  suggested_mental_load_score smallint DEFAULT 3,
  -- Timing relatif (pour les événements : J-30, J-7, J-1, J+0)
  relative_days integer DEFAULT 0, -- jours avant/après l'événement parent
  -- Métadonnées
  description text,
  sort_order smallint DEFAULT 0,
  is_premium boolean DEFAULT false, -- true = pack payant
  pack_name text DEFAULT NULL, -- 'demenagement', 'mariage', 'bebe', 'rentree'
  created_at timestamptz DEFAULT now()
);

ALTER TABLE task_associations ENABLE ROW LEVEL SECURITY;

-- Lecture publique (templates système)
CREATE POLICY "task_associations_select" ON task_associations FOR SELECT
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- DONNÉES : Événements du quotidien (trigger_type = 'event')
-- ─────────────────────────────────────────────────────────────────────────────

-- === ANNIVERSAIRE ===
INSERT INTO task_associations (trigger_type, trigger_value, suggested_name, suggested_scoring_category, suggested_frequency, suggested_duration, suggested_physical, suggested_mental_load_score, relative_days, description, sort_order) VALUES
('event', 'anniversaire', 'Choisir et acheter le cadeau', 'shopping', 'once', 'medium', 'light', 5, -14, 'Trouver une idée et acheter', 1),
('event', 'anniversaire', 'Préparer le gâteau', 'meals', 'once', 'long', 'medium', 4, -1, 'Cuisiner ou commander le gâteau', 2),
('event', 'anniversaire', 'Envoyer les invitations', 'admin', 'once', 'short', 'none', 4, -21, 'Créer et envoyer les invitations', 3),
('event', 'anniversaire', 'Décorer la maison', 'tidying', 'once', 'medium', 'medium', 3, 0, 'Ballons, guirlandes, table', 4),
('event', 'anniversaire', 'Préparer les activités', 'children', 'once', 'medium', 'none', 5, -7, 'Jeux, animation, musique', 5),
('event', 'anniversaire', 'Ranger après la fête', 'cleaning', 'once', 'medium', 'medium', 2, 1, 'Nettoyage et rangement post-fête', 6);

-- === NOËL ===
INSERT INTO task_associations (trigger_type, trigger_value, suggested_name, suggested_scoring_category, suggested_frequency, suggested_duration, suggested_physical, suggested_mental_load_score, relative_days, description, sort_order) VALUES
('event', 'noel', 'Acheter les cadeaux de Noël', 'shopping', 'once', 'very_long', 'medium', 7, -21, 'Liste + achats pour toute la famille', 1),
('event', 'noel', 'Emballer les cadeaux', 'misc', 'once', 'long', 'light', 3, -2, 'Papier cadeau, étiquettes', 2),
('event', 'noel', 'Décorer le sapin', 'tidying', 'once', 'medium', 'medium', 2, -14, 'Sapin, guirlandes, crèche', 3),
('event', 'noel', 'Préparer le repas de Noël', 'meals', 'once', 'very_long', 'medium', 7, -1, 'Courses + cuisine du réveillon', 4),
('event', 'noel', 'Planifier le menu de Noël', 'meals', 'once', 'short', 'none', 5, -7, 'Entrée, plat, dessert, boissons', 5),
('event', 'noel', 'Écrire les cartes de vœux', 'admin', 'once', 'medium', 'none', 3, -14, 'Cartes pour famille et amis', 6),
('event', 'noel', 'Ranger les décorations', 'tidying', 'once', 'medium', 'medium', 2, 7, 'Démonter et ranger le sapin', 7);

-- === VACANCES ===
INSERT INTO task_associations (trigger_type, trigger_value, suggested_name, suggested_scoring_category, suggested_frequency, suggested_duration, suggested_physical, suggested_mental_load_score, relative_days, description, sort_order) VALUES
('event', 'vacances', 'Réserver hébergement', 'admin', 'once', 'medium', 'none', 6, -60, 'Hôtel, location, camping', 1),
('event', 'vacances', 'Réserver les transports', 'admin', 'once', 'medium', 'none', 5, -45, 'Billets avion/train, location voiture', 2),
('event', 'vacances', 'Préparer les valises', 'tidying', 'once', 'long', 'medium', 4, -1, 'Vêtements, trousse de toilette, médicaments', 3),
('event', 'vacances', 'Faire garder les animaux', 'pets', 'once', 'short', 'none', 5, -14, 'Pension, voisin, famille', 4),
('event', 'vacances', 'Suspendre le courrier', 'admin', 'once', 'very_short', 'none', 2, -7, 'Demande à La Poste', 5),
('event', 'vacances', 'Vérifier les papiers d''identité', 'admin', 'once', 'short', 'none', 6, -30, 'Passeports, visas, CNI', 6),
('event', 'vacances', 'Faire le ménage avant de partir', 'cleaning', 'once', 'long', 'high', 3, -1, 'Rentrer dans une maison propre', 7),
('event', 'vacances', 'Programmer arrosage plantes', 'outdoor', 'once', 'short', 'none', 3, -3, 'Voisin ou système automatique', 8);

-- === RENTRÉE SCOLAIRE ===
INSERT INTO task_associations (trigger_type, trigger_value, suggested_name, suggested_scoring_category, suggested_frequency, suggested_duration, suggested_physical, suggested_mental_load_score, relative_days, description, sort_order) VALUES
('event', 'rentree', 'Acheter les fournitures scolaires', 'shopping', 'once', 'long', 'medium', 5, -14, 'Liste de l''école', 1),
('event', 'rentree', 'Acheter les vêtements de rentrée', 'shopping', 'once', 'long', 'medium', 4, -21, 'Chaussures, manteau, uniforme', 2),
('event', 'rentree', 'Inscrire à la cantine', 'admin', 'once', 'short', 'none', 5, -30, 'Dossier, paiement', 3),
('event', 'rentree', 'Inscrire aux activités extrascolaires', 'admin', 'once', 'medium', 'none', 6, -21, 'Sport, musique, art', 4),
('event', 'rentree', 'Organiser les trajets école', 'transport', 'once', 'short', 'none', 5, -7, 'Covoiturage, transport en commun', 5),
('event', 'rentree', 'Préparer le cartable', 'children', 'once', 'short', 'none', 3, -1, 'Trousse, cahiers, étiquettes', 6),
('event', 'rentree', 'RDV médecin (certificat médical)', 'admin', 'once', 'medium', 'none', 4, -21, 'Pour le sport ou l''école', 7);

-- === REPAS / DÎNER ===
INSERT INTO task_associations (trigger_type, trigger_value, suggested_name, suggested_scoring_category, suggested_frequency, suggested_duration, suggested_physical, suggested_mental_load_score, relative_days, description, sort_order) VALUES
('event', 'diner', 'Planifier le menu', 'meals', 'once', 'short', 'none', 3, -1, 'Choisir entrée, plat, dessert', 1),
('event', 'diner', 'Faire les courses pour le dîner', 'shopping', 'once', 'medium', 'medium', 3, 0, 'Ingrédients manquants', 2),
('event', 'diner', 'Dresser la table', 'tidying', 'once', 'very_short', 'light', 1, 0, 'Assiettes, couverts, verres', 3),
('event', 'diner', 'Débarrasser et ranger', 'cleaning', 'once', 'short', 'light', 1, 0, 'Après le repas', 4);

-- === RDV MÉDECIN ===
INSERT INTO task_associations (trigger_type, trigger_value, suggested_name, suggested_scoring_category, suggested_frequency, suggested_duration, suggested_physical, suggested_mental_load_score, relative_days, description, sort_order) VALUES
('event', 'medecin', 'Préparer le carnet de santé', 'admin', 'once', 'very_short', 'none', 3, -1, 'Carnet + carte vitale + mutuelle', 1),
('event', 'medecin', 'Noter les symptômes à signaler', 'admin', 'once', 'very_short', 'none', 3, -1, 'Liste des questions au médecin', 2),
('event', 'medecin', 'Aller à la pharmacie', 'shopping', 'once', 'short', 'light', 2, 0, 'Ordonnance après la consultation', 3);

-- ─────────────────────────────────────────────────────────────────────────────
-- DONNÉES : Équipements maison (trigger_type = 'equipment')
-- ─────────────────────────────────────────────────────────────────────────────

-- === CUISINE ===
INSERT INTO task_associations (trigger_type, trigger_value, suggested_name, suggested_scoring_category, suggested_frequency, suggested_duration, suggested_physical, suggested_mental_load_score, relative_days, description, sort_order) VALUES
('equipment', 'four', 'Nettoyer le four', 'cleaning', 'quarterly', 'medium', 'medium', 4, 0, 'Intérieur, grilles, vitre', 1),
('equipment', 'plaque_cuisson', 'Nettoyer les plaques de cuisson', 'cleaning', 'weekly', 'short', 'light', 2, 0, 'Après chaque utilisation intensive', 1),
('equipment', 'hotte', 'Nettoyer les filtres de la hotte', 'cleaning', 'quarterly', 'short', 'light', 3, 0, 'Dégraisser ou remplacer', 1),
('equipment', 'refrigerateur', 'Nettoyer le réfrigérateur', 'cleaning', 'monthly', 'medium', 'medium', 4, 0, 'Intérieur, tiroirs, joints', 1),
('equipment', 'refrigerateur', 'Dégivrer le congélateur', 'cleaning', 'semiannual', 'long', 'medium', 4, 0, 'Si givre > 5mm', 3),
('equipment', 'lave_vaisselle', 'Vider le lave-vaisselle', 'tidying', 'daily', 'short', 'light', 2, 0, 'Ranger la vaisselle propre', 1),
('equipment', 'lave_vaisselle', 'Nettoyer le filtre du lave-vaisselle', 'cleaning', 'monthly', 'short', 'light', 2, 0, 'Retirer et rincer le filtre', 2),
('equipment', 'lave_vaisselle', 'Entretenir le lave-vaisselle', 'cleaning', 'monthly', 'very_short', 'none', 2, 0, 'Sel régénérant + cycle à vide au vinaigre blanc', 3),
('equipment', 'micro_ondes', 'Nettoyer le micro-ondes', 'cleaning', 'monthly', 'short', 'light', 2, 0, 'Eau citronnée 3 min puis essuyer', 1),
('equipment', 'cafetiere', 'Détartrer la cafetière', 'cleaning', 'monthly', 'short', 'none', 2, 0, 'Vinaigre blanc ou détartrant', 1),
('equipment', 'bouilloire', 'Détartrer la bouilloire', 'cleaning', 'monthly', 'short', 'none', 1, 0, 'Vinaigre blanc, rincer', 1),
('equipment', 'grille_pain', 'Nettoyer le grille-pain', 'cleaning', 'monthly', 'very_short', 'none', 1, 0, 'Vider le tiroir à miettes', 1),
('equipment', 'poubelle', 'Sortir les poubelles', 'tidying', 'weekly', 'very_short', 'light', 1, 0, 'Jour de collecte', 1),
('equipment', 'poubelle', 'Nettoyer la poubelle', 'cleaning', 'monthly', 'short', 'medium', 2, 0, 'Désinfecter le bac', 2),

-- === SALLE DE BAIN ===
('equipment', 'douche', 'Nettoyer la douche', 'hygiene', 'weekly', 'short', 'medium', 2, 0, 'Parois, bac, pommeau', 1),
('equipment', 'douche', 'Détartrer le pommeau de douche', 'hygiene', 'quarterly', 'short', 'light', 2, 0, 'Vinaigre blanc une nuit', 2),
('equipment', 'baignoire', 'Nettoyer la baignoire', 'hygiene', 'weekly', 'short', 'medium', 2, 0, 'Émail, robinetterie, joints', 1),
('equipment', 'toilettes', 'Nettoyer les toilettes', 'hygiene', 'weekly', 'short', 'medium', 2, 0, 'Cuvette, abattant, sol autour', 1),
('equipment', 'lavabo', 'Nettoyer le lavabo', 'hygiene', 'weekly', 'very_short', 'light', 1, 0, 'Vasque, robinet, miroir', 1),
('equipment', 'lavabo', 'Déboucher le siphon', 'hygiene', 'quarterly', 'short', 'light', 2, 0, 'Retirer les cheveux, bicarbonate', 2),

-- === LINGE ===
('equipment', 'lave_linge', 'Lancer une lessive', 'laundry', 'weekly', 'short', 'light', 2, 0, 'Trier, charger, lancer', 1),
('equipment', 'lave_linge', 'Nettoyer le joint du lave-linge', 'cleaning', 'monthly', 'short', 'light', 2, 0, 'Vinaigre, chiffon, vérifier moisissures', 2),
('equipment', 'lave_linge', 'Nettoyer le filtre du lave-linge', 'cleaning', 'quarterly', 'short', 'light', 2, 0, 'Ouvrir la trappe, rincer', 3),
('equipment', 'lave_linge', 'Cycle de nettoyage à vide', 'cleaning', 'monthly', 'very_short', 'none', 1, 0, '90°C avec vinaigre blanc', 4),
('equipment', 'seche_linge', 'Vider le filtre et le bac du sèche-linge', 'laundry', 'weekly', 'very_short', 'none', 1, 0, 'Filtre peluches + bac à eau de condensation — après chaque cycle', 1),
('equipment', 'fer_a_repasser', 'Repasser le linge', 'laundry', 'weekly', 'medium', 'medium', 3, 0, 'Chemises, pantalons, nappes', 1),
('equipment', 'fer_a_repasser', 'Détartrer le fer', 'cleaning', 'quarterly', 'short', 'none', 2, 0, 'Vinaigre ou détartrant', 2),
('equipment', 'etendoir', 'Étendre le linge', 'laundry', 'weekly', 'short', 'light', 2, 0, 'Après la machine', 1),
('equipment', 'etendoir', 'Plier et ranger le linge sec', 'laundry', 'weekly', 'short', 'light', 2, 0, 'Trier par personne', 2),

-- === SOLS / MÉNAGE ===
('equipment', 'aspirateur', 'Passer l''aspirateur', 'cleaning', 'weekly', 'medium', 'medium', 2, 0, 'Toutes les pièces', 1),
('equipment', 'aspirateur', 'Vider / changer le sac de l''aspirateur', 'cleaning', 'monthly', 'very_short', 'none', 1, 0, 'Quand le voyant s''allume', 2),
('equipment', 'aspirateur', 'Nettoyer les filtres de l''aspirateur', 'cleaning', 'quarterly', 'short', 'none', 2, 0, 'Rincer et sécher', 3),
('equipment', 'robot_aspirateur', 'Vider le bac du robot aspirateur', 'cleaning', 'weekly', 'very_short', 'none', 1, 0, 'Poussière et débris', 1),
('equipment', 'robot_aspirateur', 'Nettoyer les brosses du robot', 'cleaning', 'monthly', 'short', 'light', 2, 0, 'Retirer cheveux enroulés', 2),
('equipment', 'serpillere', 'Laver les sols', 'cleaning', 'weekly', 'medium', 'medium', 2, 0, 'Serpillère ou balai vapeur', 1),

-- === EXTÉRIEUR ===
('equipment', 'jardin', 'Tondre la pelouse', 'outdoor', 'biweekly', 'long', 'high', 3, 0, 'Tondeuse + ramassage', 1),
('equipment', 'jardin', 'Arroser le jardin', 'outdoor', 'daily', 'short', 'light', 1, 0, 'Matin ou soir en été', 2),
('equipment', 'jardin', 'Désherber', 'outdoor', 'monthly', 'medium', 'high', 2, 0, 'Massifs, allées, potager', 3),
('equipment', 'jardin', 'Tailler les haies', 'outdoor', 'quarterly', 'long', 'high', 3, 0, 'Taille-haie ou sécateur', 4),
('equipment', 'jardin', 'Ramasser les feuilles mortes', 'outdoor', 'monthly', 'medium', 'medium', 2, 0, 'Surtout en automne', 5),
('equipment', 'piscine', 'Vérifier le pH de la piscine', 'outdoor', 'weekly', 'very_short', 'none', 2, 0, 'Bandelettes test', 1),
('equipment', 'piscine', 'Passer l''épuisette', 'outdoor', 'daily', 'short', 'light', 1, 0, 'Feuilles et insectes', 2),
('equipment', 'piscine', 'Nettoyer le filtre de la piscine', 'outdoor', 'biweekly', 'short', 'light', 2, 0, 'Contre-lavage ou nettoyage', 3),
('equipment', 'piscine', 'Hiverner / déshiverner la piscine', 'outdoor', 'semiannual', 'long', 'medium', 5, 0, 'Produits, bâche, robot', 4),
('equipment', 'terrasse', 'Nettoyer la terrasse', 'outdoor', 'monthly', 'medium', 'medium', 2, 0, 'Balai, karcher, anti-mousse', 1),
('equipment', 'barbecue', 'Nettoyer le barbecue', 'cleaning', 'monthly', 'short', 'medium', 2, 0, 'Grilles, bac à graisse', 1),
('equipment', 'composteur', 'Retourner le compost', 'outdoor', 'biweekly', 'short', 'medium', 2, 0, 'Aération', 1),

-- === VOITURE ===
('equipment', 'voiture', 'Faire le plein / recharger', 'vehicle', 'weekly', 'short', 'none', 2, 0, 'Essence ou électrique', 1),
('equipment', 'voiture', 'Laver la voiture', 'vehicle', 'monthly', 'short', 'light', 2, 0, 'Extérieur (karcher/main) + intérieur (aspirateur, lingettes)', 2),
('equipment', 'voiture', 'Vérifier la pression des pneus', 'vehicle', 'monthly', 'very_short', 'none', 2, 0, 'Station service', 3),
('equipment', 'voiture', 'Vidange / entretien', 'vehicle', 'semiannual', 'long', 'none', 5, 0, 'RDV garage', 4),
('equipment', 'voiture', 'Contrôle technique', 'vehicle', 'yearly', 'long', 'none', 6, 0, 'Obligatoire', 5),
('equipment', 'voiture', 'Changement pneus hiver/été', 'vehicle', 'semiannual', 'medium', 'none', 4, 0, 'Novembre et mars', 6),

-- === ANIMAUX ===
('equipment', 'chien', 'Promener le chien', 'pets', 'daily', 'medium', 'medium', 3, 0, 'Matin et soir', 1),
('equipment', 'chien', 'Nourrir le chien', 'pets', 'daily', 'very_short', 'none', 2, 0, 'Croquettes ou pâtée', 2),
('equipment', 'chien', 'Brosser le chien', 'pets', 'weekly', 'short', 'light', 2, 0, 'Selon la race', 3),
('equipment', 'chien', 'RDV vétérinaire', 'pets', 'semiannual', 'long', 'none', 5, 0, 'Vaccins, contrôle', 4),
('equipment', 'chien', 'Acheter la nourriture du chien', 'shopping', 'monthly', 'short', 'light', 2, 0, 'Croquettes, friandises', 5),
('equipment', 'chien', 'Traitement antiparasitaire', 'pets', 'monthly', 'very_short', 'none', 3, 0, 'Antipuces, tiques', 6),
('equipment', 'chat', 'Nourrir le chat', 'pets', 'daily', 'very_short', 'none', 2, 0, 'Croquettes ou pâtée', 1),
('equipment', 'chat', 'Nettoyer la litière', 'pets', 'daily', 'very_short', 'light', 2, 0, 'Quotidien + changement complet hebdo', 2),
('equipment', 'chat', 'RDV vétérinaire', 'pets', 'semiannual', 'long', 'none', 5, 0, 'Vaccins, contrôle', 3),
('equipment', 'chat', 'Acheter la nourriture du chat', 'shopping', 'monthly', 'short', 'light', 2, 0, 'Croquettes, litière', 4),
('equipment', 'chat', 'Traitement antiparasitaire', 'pets', 'monthly', 'very_short', 'none', 3, 0, 'Antipuces', 5);

-- ─────────────────────────────────────────────────────────────────────────────
-- DONNÉES : Enfants par tranche d'âge (trigger_type = 'child_age')
-- ─────────────────────────────────────────────────────────────────────────────

-- === BÉBÉ 0-2 ANS ===
INSERT INTO task_associations (trigger_type, trigger_value, suggested_name, suggested_scoring_category, suggested_frequency, suggested_duration, suggested_physical, suggested_mental_load_score, relative_days, description, sort_order) VALUES
('child_age', '0-2', 'Changer les couches', 'children', 'daily', 'very_short', 'light', 2, 0, 'Plusieurs fois par jour', 1),
('child_age', '0-2', 'Préparer les biberons', 'children', 'daily', 'short', 'none', 3, 0, 'Stériliser, doser, température', 2),
('child_age', '0-2', 'Bain du bébé', 'children', 'daily', 'short', 'medium', 3, 0, 'Bain + soin + habillage', 3),
('child_age', '0-2', 'Préparer les repas bébé', 'meals', 'daily', 'short', 'light', 3, 0, 'Purées, compotes, petits pots', 4),
('child_age', '0-2', 'Stériliser les biberons', 'hygiene', 'daily', 'very_short', 'none', 2, 0, 'Stérilisateur ou casserole', 5),
('child_age', '0-2', 'Laver le linge bébé', 'laundry', 'weekly', 'short', 'light', 2, 0, 'Lessive hypoallergénique', 6),
('child_age', '0-2', 'RDV pédiatre / PMI', 'admin', 'monthly', 'long', 'none', 5, 0, 'Suivi croissance, vaccins', 7),
('child_age', '0-2', 'Acheter couches et lait', 'shopping', 'weekly', 'short', 'light', 3, 0, 'Stock hebdomadaire', 8),
('child_age', '0-2', 'Coucher le bébé', 'children', 'daily', 'short', 'light', 3, 0, 'Routine du soir, berceuse', 9),
('child_age', '0-2', 'Préparer le sac de change', 'children', 'daily', 'very_short', 'none', 3, 0, 'Couches, lingettes, rechange', 10),

-- === PETIT 3-5 ANS ===
('child_age', '3-5', 'Amener à l''école / crèche', 'transport', 'daily', 'short', 'light', 4, 0, 'Trajet aller', 1),
('child_age', '3-5', 'Récupérer à l''école / crèche', 'transport', 'daily', 'short', 'light', 4, 0, 'Trajet retour', 2),
('child_age', '3-5', 'Préparer le goûter', 'meals', 'daily', 'very_short', 'none', 2, 0, 'Fruit, gâteau, boisson', 3),
('child_age', '3-5', 'Bain des enfants', 'children', 'daily', 'short', 'medium', 3, 0, 'Bain ou douche du soir', 4),
('child_age', '3-5', 'Habiller les enfants', 'children', 'daily', 'very_short', 'light', 2, 0, 'Le matin', 5),
('child_age', '3-5', 'Lire une histoire / coucher', 'children', 'daily', 'short', 'none', 2, 0, 'Routine du soir', 6),
('child_age', '3-5', 'Préparer le sac d''école', 'children', 'daily', 'very_short', 'none', 3, 0, 'Doudou, change, goûter', 7),
('child_age', '3-5', 'Gérer les activités extrascolaires', 'admin', 'weekly', 'short', 'none', 4, 0, 'Inscription, transport', 8),
('child_age', '3-5', 'RDV médecin / dentiste', 'admin', 'quarterly', 'medium', 'none', 4, 0, 'Suivi médical', 9),

-- === ENFANT 6-12 ANS ===
('child_age', '6-12', 'Aider aux devoirs', 'children', 'daily', 'medium', 'none', 5, 0, 'Lecture, calcul, exposés', 1),
('child_age', '6-12', 'Préparer le cartable', 'children', 'daily', 'very_short', 'none', 3, 0, 'Vérifier cahiers et trousse', 2),
('child_age', '6-12', 'Amener à l''école', 'transport', 'daily', 'short', 'light', 3, 0, 'Trajet aller', 3),
('child_age', '6-12', 'Récupérer à l''école', 'transport', 'daily', 'short', 'light', 3, 0, 'Trajet retour', 4),
('child_age', '6-12', 'Amener aux activités sportives', 'transport', 'weekly', 'medium', 'none', 4, 0, 'Foot, danse, natation...', 5),
('child_age', '6-12', 'Préparer les affaires de sport', 'children', 'weekly', 'very_short', 'none', 3, 0, 'Sac, tenue, gourde', 6),
('child_age', '6-12', 'Coucher les enfants', 'children', 'daily', 'short', 'none', 2, 0, 'Brossage dents, histoire, câlin', 7),
('child_age', '6-12', 'Signer les papiers d''école', 'admin', 'weekly', 'very_short', 'none', 3, 0, 'Carnets, autorisations, mots', 8),
('child_age', '6-12', 'Organiser les anniversaires copains', 'children', 'monthly', 'medium', 'none', 5, 0, 'Invitations, cadeau, transport', 9),

-- === ADO 13+ ANS ===
('child_age', '13+', 'Gérer l''argent de poche', 'admin', 'monthly', 'very_short', 'none', 2, 0, 'Virement ou espèces', 1),
('child_age', '13+', 'Suivre les résultats scolaires', 'admin', 'weekly', 'short', 'none', 4, 0, 'Pronote, bulletins', 2),
('child_age', '13+', 'RDV orientation scolaire', 'admin', 'yearly', 'long', 'none', 6, 0, 'Forum, portes ouvertes, Parcoursup', 3),
('child_age', '13+', 'Gérer le forfait téléphone', 'admin', 'monthly', 'very_short', 'none', 2, 0, 'Facturation, contrôle parental', 4),
('child_age', '13+', 'Amener aux activités', 'transport', 'weekly', 'medium', 'none', 3, 0, 'Sport, cours particuliers', 5),
('child_age', '13+', 'RDV médecin spécialiste', 'admin', 'semiannual', 'medium', 'none', 4, 0, 'Orthodontiste, dermato, etc.', 6);

-- ─────────────────────────────────────────────────────────────────────────────
-- DONNÉES : Mots-clés déclencheurs (trigger_type = 'keyword')
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO task_associations (trigger_type, trigger_value, suggested_name, suggested_scoring_category, suggested_frequency, suggested_duration, suggested_physical, suggested_mental_load_score, relative_days, description, sort_order) VALUES
-- Invités / recevoir
('keyword', 'invites', 'Faire les courses pour le repas', 'shopping', 'once', 'long', 'medium', 4, -1, 'Ingrédients pour le nombre de convives', 1),
('keyword', 'invites', 'Préparer la chambre d''amis', 'tidying', 'once', 'short', 'light', 3, -1, 'Draps propres, serviettes', 2),
('keyword', 'invites', 'Faire le ménage avant l''arrivée', 'cleaning', 'once', 'long', 'high', 3, -1, 'Ménage complet', 3),
('keyword', 'invites', 'Préparer le repas', 'meals', 'once', 'long', 'medium', 5, 0, 'Cuisine pour les invités', 4),
-- Démarches administratives
('keyword', 'demenagement', 'Changer d''adresse (impôts, banque, sécu)', 'admin', 'once', 'long', 'none', 7, 0, 'Toutes les administrations', 1),
('keyword', 'demenagement', 'Résilier / transférer les abonnements', 'admin', 'once', 'medium', 'none', 6, -14, 'Internet, énergie, assurance', 2),
('keyword', 'demenagement', 'Faire les cartons', 'tidying', 'once', 'very_long', 'high', 5, -7, 'Pièce par pièce', 3),
('keyword', 'demenagement', 'Nettoyer l''ancien logement', 'cleaning', 'once', 'very_long', 'high', 4, 0, 'État des lieux impeccable', 4),
('keyword', 'demenagement', 'Réserver le camion / déménageurs', 'admin', 'once', 'short', 'none', 5, -30, 'Comparer les devis', 5);

-- ─────────────────────────────────────────────────────────────────────────────
-- DONNÉES : Packs projets premium (trigger_type = 'pack')
-- ─────────────────────────────────────────────────────────────────────────────

-- === PACK DÉMÉNAGEMENT (premium) ===
INSERT INTO task_associations (trigger_type, trigger_value, suggested_name, suggested_scoring_category, suggested_frequency, suggested_duration, suggested_physical, suggested_mental_load_score, relative_days, description, sort_order, is_premium, pack_name) VALUES
('pack', 'demenagement', 'Trier et désencombrer chaque pièce', 'tidying', 'once', 'very_long', 'high', 5, -45, 'Donner, vendre, jeter', 1, true, 'demenagement'),
('pack', 'demenagement', 'Comparer les devis déménageurs', 'admin', 'once', 'medium', 'none', 6, -45, 'Minimum 3 devis', 2, true, 'demenagement'),
('pack', 'demenagement', 'Résilier les contrats énergie/internet', 'admin', 'once', 'medium', 'none', 6, -30, 'Préavis et dates', 3, true, 'demenagement'),
('pack', 'demenagement', 'Souscrire les nouveaux contrats', 'admin', 'once', 'medium', 'none', 6, -14, 'Énergie, internet, assurance', 4, true, 'demenagement'),
('pack', 'demenagement', 'Changement d''adresse La Poste', 'admin', 'once', 'short', 'none', 4, -14, 'Réexpédition du courrier', 5, true, 'demenagement'),
('pack', 'demenagement', 'Acheter le matériel d''emballage', 'shopping', 'once', 'short', 'light', 3, -14, 'Cartons, scotch, papier bulle', 6, true, 'demenagement'),
('pack', 'demenagement', 'Emballer les objets fragiles', 'tidying', 'once', 'long', 'medium', 4, -5, 'Vaisselle, cadres, électronique', 7, true, 'demenagement'),
('pack', 'demenagement', 'Faire les cartons par pièce', 'tidying', 'once', 'very_long', 'high', 5, -5, 'Étiqueter chaque carton', 8, true, 'demenagement'),
('pack', 'demenagement', 'Vider et dégivrer le congélateur', 'cleaning', 'once', 'medium', 'light', 3, -3, 'Consommer les stocks', 9, true, 'demenagement'),
('pack', 'demenagement', 'Relever les compteurs', 'admin', 'once', 'very_short', 'none', 3, 0, 'Eau, gaz, électricité', 10, true, 'demenagement'),
('pack', 'demenagement', 'Faire l''état des lieux de sortie', 'admin', 'once', 'short', 'none', 5, 0, 'Photos, formulaire', 11, true, 'demenagement'),
('pack', 'demenagement', 'Nettoyer l''ancien logement', 'cleaning', 'once', 'very_long', 'high', 4, 0, 'Nettoyage complet', 12, true, 'demenagement'),
('pack', 'demenagement', 'Déballer et ranger dans le nouveau', 'tidying', 'once', 'very_long', 'high', 5, 1, 'Pièce par pièce', 13, true, 'demenagement'),
('pack', 'demenagement', 'Faire l''état des lieux d''entrée', 'admin', 'once', 'short', 'none', 5, 0, 'Photos, noter les défauts', 14, true, 'demenagement'),
('pack', 'demenagement', 'Mettre à jour la carte grise', 'admin', 'once', 'short', 'none', 4, 7, 'ANTS en ligne', 15, true, 'demenagement'),
('pack', 'demenagement', 'S''inscrire sur les listes électorales', 'admin', 'once', 'short', 'none', 3, 7, 'Mairie ou en ligne', 16, true, 'demenagement'),
('pack', 'demenagement', 'Mettre à jour l''adresse partout', 'admin', 'once', 'long', 'none', 7, 7, 'Banque, sécu, impôts, mutuelle, employeur', 17, true, 'demenagement'),

-- === PACK MARIAGE (premium) ===
('pack', 'mariage', 'Définir le budget', 'admin', 'once', 'medium', 'none', 7, -365, 'Budget global et par poste', 1, true, 'mariage'),
('pack', 'mariage', 'Choisir la date et le lieu', 'admin', 'once', 'long', 'none', 8, -365, 'Visites, disponibilités', 2, true, 'mariage'),
('pack', 'mariage', 'Réserver le traiteur', 'admin', 'once', 'long', 'none', 7, -270, 'Dégustation, devis, menu', 3, true, 'mariage'),
('pack', 'mariage', 'Choisir le photographe', 'admin', 'once', 'medium', 'none', 5, -240, 'Portfolio, style, prix', 4, true, 'mariage'),
('pack', 'mariage', 'Envoyer les save-the-date', 'admin', 'once', 'short', 'none', 4, -180, 'Invités principaux', 5, true, 'mariage'),
('pack', 'mariage', 'Choisir la robe / le costume', 'shopping', 'once', 'very_long', 'light', 6, -180, 'Essayages, retouches', 6, true, 'mariage'),
('pack', 'mariage', 'Réserver le DJ / groupe', 'admin', 'once', 'short', 'none', 4, -180, 'Playlist, ambiance', 7, true, 'mariage'),
('pack', 'mariage', 'Choisir et commander les alliances', 'shopping', 'once', 'medium', 'none', 5, -120, 'Bijoutier, gravure', 8, true, 'mariage'),
('pack', 'mariage', 'Envoyer les faire-part', 'admin', 'once', 'medium', 'none', 5, -90, 'Design, impression, envoi', 9, true, 'mariage'),
('pack', 'mariage', 'Gérer la liste de mariage', 'admin', 'once', 'medium', 'none', 5, -90, 'Cagnotte ou liste cadeaux', 10, true, 'mariage'),
('pack', 'mariage', 'Organiser l''enterrement de vie', 'household_management', 'once', 'long', 'none', 6, -30, 'Témoins coordonnent', 11, true, 'mariage'),
('pack', 'mariage', 'Faire le plan de table', 'admin', 'once', 'long', 'none', 8, -14, 'Le casse-tête classique', 12, true, 'mariage'),
('pack', 'mariage', 'Confirmer tous les prestataires', 'admin', 'once', 'medium', 'none', 6, -7, 'Appeler chaque prestataire', 13, true, 'mariage'),
('pack', 'mariage', 'Préparer les valises lune de miel', 'tidying', 'once', 'medium', 'light', 3, -1, 'Si départ après le mariage', 14, true, 'mariage'),
('pack', 'mariage', 'Envoyer les remerciements', 'admin', 'once', 'medium', 'none', 4, 14, 'Cartes de remerciement', 15, true, 'mariage'),

-- === PACK BÉBÉ ARRIVE (premium) ===
('pack', 'bebe', 'Préparer la chambre du bébé', 'tidying', 'once', 'very_long', 'high', 6, -60, 'Lit, commode, décoration', 1, true, 'bebe'),
('pack', 'bebe', 'Acheter le matériel essentiel', 'shopping', 'once', 'very_long', 'medium', 7, -60, 'Poussette, siège auto, transat', 2, true, 'bebe'),
('pack', 'bebe', 'Préparer la valise de maternité', 'tidying', 'once', 'medium', 'light', 5, -30, 'Maman + bébé + papa', 3, true, 'bebe'),
('pack', 'bebe', 'Choisir le pédiatre', 'admin', 'once', 'short', 'none', 5, -30, 'Proximité, disponibilité', 4, true, 'bebe'),
('pack', 'bebe', 'Déclarer la naissance', 'admin', 'once', 'short', 'none', 5, 3, 'Mairie, dans les 5 jours', 5, true, 'bebe'),
('pack', 'bebe', 'Mettre à jour la mutuelle', 'admin', 'once', 'short', 'none', 4, 7, 'Ajouter le bébé', 6, true, 'bebe'),
('pack', 'bebe', 'Demander les allocations CAF', 'admin', 'once', 'medium', 'none', 6, 7, 'Dossier en ligne', 7, true, 'bebe'),
('pack', 'bebe', 'Organiser le mode de garde', 'admin', 'once', 'long', 'none', 8, -90, 'Crèche, nounou, assistante maternelle', 8, true, 'bebe'),
('pack', 'bebe', 'Préparer les repas à congeler', 'meals', 'once', 'very_long', 'medium', 4, -14, 'Batch cooking pour les premières semaines', 9, true, 'bebe'),
('pack', 'bebe', 'Faire le stock de couches et lait', 'shopping', 'once', 'medium', 'medium', 3, -7, 'Stock pour 1 mois', 10, true, 'bebe'),
('pack', 'bebe', 'Congé paternité / maternité', 'admin', 'once', 'short', 'none', 5, -60, 'Démarches employeur + sécu', 11, true, 'bebe');

-- ─────────────────────────────────────────────────────────────────────────────
-- VÉRIFICATION
-- ─────────────────────────────────────────────────────────────────────────────

SELECT trigger_type, COUNT(*) AS nb_associations
FROM task_associations
GROUP BY trigger_type
ORDER BY trigger_type;
