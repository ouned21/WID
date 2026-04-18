-- =============================================================================
-- MIGRATION : Catalog tags + custom task suggestions
-- Permet le matching templates ↔ équipements à l'onboarding
-- Collecte silencieuse des tâches personnalisées pour enrichir le catalogue
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Colonne equipment_tags sur task_templates
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS equipment_tags text[] DEFAULT '{}';

-- Index GIN pour recherche rapide sur le tableau
CREATE INDEX IF NOT EXISTS idx_templates_equipment_tags
  ON task_templates USING gin(equipment_tags);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tagging des templates par équipement (basé sur le nom)
-- ─────────────────────────────────────────────────────────────────────────────

-- Lave-vaisselle
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'lave_vaisselle')
WHERE (name ILIKE '%lave-vaisselle%' OR name ILIKE '%vaisselle%')
  AND NOT ('lave_vaisselle' = ANY(COALESCE(equipment_tags, '{}')));

-- Lave-linge
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'lave_linge')
WHERE (name ILIKE '%lave-linge%' OR name ILIKE '%lessive%' OR name ILIKE '% linge%' OR scoring_category = 'laundry')
  AND NOT ('lave_linge' = ANY(COALESCE(equipment_tags, '{}')));

-- Sèche-linge
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'seche_linge')
WHERE (name ILIKE '%sèche-linge%' OR name ILIKE '%séchage%')
  AND NOT ('seche_linge' = ANY(COALESCE(equipment_tags, '{}')));

-- Fer à repasser
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'fer_a_repasser')
WHERE (name ILIKE '%repasser%' OR name ILIKE '%repassage%')
  AND NOT ('fer_a_repasser' = ANY(COALESCE(equipment_tags, '{}')));

-- Four
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'four')
WHERE (name ILIKE '%four%')
  AND NOT ('four' = ANY(COALESCE(equipment_tags, '{}')));

-- Hotte
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'hotte')
WHERE (name ILIKE '%hotte%')
  AND NOT ('hotte' = ANY(COALESCE(equipment_tags, '{}')));

-- Réfrigérateur
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'refrigerateur')
WHERE (name ILIKE '%réfrigérateur%' OR name ILIKE '%frigo%' OR name ILIKE '%congélateur%')
  AND NOT ('refrigerateur' = ANY(COALESCE(equipment_tags, '{}')));

-- Cafetière
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'cafetiere')
WHERE (name ILIKE '%café%' OR name ILIKE '%cafetière%' OR name ILIKE '%expresso%')
  AND NOT ('cafetiere' = ANY(COALESCE(equipment_tags, '{}')));

-- Aspirateur
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'aspirateur')
WHERE (name ILIKE '%aspirateur%')
  AND NOT ('aspirateur' = ANY(COALESCE(equipment_tags, '{}')));

-- Robot aspirateur
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'robot_aspirateur')
WHERE (name ILIKE '%robot%aspirateur%' OR name ILIKE '%roomba%')
  AND NOT ('robot_aspirateur' = ANY(COALESCE(equipment_tags, '{}')));

-- Jardin
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'jardin')
WHERE (name ILIKE '%jardin%' OR name ILIKE '%gazon%' OR name ILIKE '%pelouse%' OR name ILIKE '%tonte%' OR name ILIKE '%tondre%' OR scoring_category = 'outdoor')
  AND NOT ('jardin' = ANY(COALESCE(equipment_tags, '{}')));

-- Terrasse / Balcon
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'terrasse')
WHERE (name ILIKE '%terrasse%' OR name ILIKE '%balcon%')
  AND NOT ('terrasse' = ANY(COALESCE(equipment_tags, '{}')));

-- Piscine
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'piscine')
WHERE (name ILIKE '%piscine%')
  AND NOT ('piscine' = ANY(COALESCE(equipment_tags, '{}')));

-- Barbecue
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'barbecue')
WHERE (name ILIKE '%barbecue%' OR name ILIKE '%barbec%')
  AND NOT ('barbecue' = ANY(COALESCE(equipment_tags, '{}')));

-- Composteur
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'composteur')
WHERE (name ILIKE '%compost%')
  AND NOT ('composteur' = ANY(COALESCE(equipment_tags, '{}')));

-- Voiture
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'voiture')
WHERE (name ILIKE '%voiture%' OR name ILIKE '%véhicule%' OR scoring_category = 'vehicle')
  AND NOT ('voiture' = ANY(COALESCE(equipment_tags, '{}')));

-- Chien
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'chien')
WHERE (name ILIKE '%chien%' OR name ILIKE '%labrador%' OR name ILIKE '%golden%')
  AND NOT ('chien' = ANY(COALESCE(equipment_tags, '{}')));

-- Chat
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'chat')
WHERE (name ILIKE '%chat%' OR name ILIKE '%litière%' OR name ILIKE '%félin%')
  AND NOT ('chat' = ANY(COALESCE(equipment_tags, '{}')));

-- Animaux (générique pour chien + chat)
UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'chien')
WHERE scoring_category = 'pets'
  AND NOT ('chien' = ANY(COALESCE(equipment_tags, '{}')));

UPDATE task_templates SET equipment_tags = array_append(COALESCE(equipment_tags, '{}'), 'chat')
WHERE scoring_category = 'pets'
  AND NOT ('chat' = ANY(COALESCE(equipment_tags, '{}')));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Table de collecte silencieuse des tâches personnalisées
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.custom_task_suggestions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  household_id uuid REFERENCES public.households(id) ON DELETE SET NULL,
  source       text DEFAULT 'onboarding' CHECK (source IN ('onboarding', 'task_creation')),
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE public.custom_task_suggestions ENABLE ROW LEVEL SECURITY;

-- Seul l'insert est autorisé par les membres du foyer
CREATE POLICY "suggestions_insert" ON public.custom_task_suggestions
  FOR INSERT WITH CHECK (household_id = public.get_my_household_id());

-- Lecture réservée aux admins (pas de SELECT pour les users normaux)

SELECT 'Migration catalog tags OK' AS statut;
