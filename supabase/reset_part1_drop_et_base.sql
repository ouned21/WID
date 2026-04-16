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
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (id = auth.uid() OR household_id IN (
    SELECT household_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (id = auth.uid());
CREATE INDEX idx_profiles_household ON public.profiles(household_id);
CREATE INDEX idx_profiles_premium   ON public.profiles(is_premium);

-- Politique households_select ajoutée ici car elle référence profiles
CREATE POLICY "households_select" ON public.households FOR SELECT
  USING (id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

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
  ('11111111-1111-1111-1111-111111111111','Vider le lave-vaisselle','daily',1,true,'cleaning','short','light','matin'),
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
