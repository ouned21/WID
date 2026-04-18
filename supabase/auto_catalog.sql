-- =============================================================================
-- AUTO-ENRICHISSEMENT DU CATALOGUE
-- Promeut les suggestions populaires (3+ foyers distincts) en templates
-- L'inférence des métadonnées est ensuite affinée par Claude Haiku via Edge Function
-- =============================================================================

-- Table de log : Jonathan peut voir ce qui a été promu, quand, et par quels foyers
CREATE TABLE IF NOT EXISTS public.catalog_promotions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  promoted_at     timestamptz DEFAULT now(),
  household_count int NOT NULL,
  template_id     uuid REFERENCES public.task_templates(id) ON DELETE SET NULL,
  inferred_category text,
  ai_enriched     boolean DEFAULT false,
  note            text
);
ALTER TABLE public.catalog_promotions ENABLE ROW LEVEL SECURITY;
-- Lecture/écriture réservées au service role (pas visible pour les users)

-- Colonne pour marquer les suggestions traitées
ALTER TABLE public.custom_task_suggestions
  ADD COLUMN IF NOT EXISTS processed_at timestamptz DEFAULT NULL;

-- Extension pour le fuzzy matching (déjà dispo sur Supabase)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- FONCTION PRINCIPALE : promote_popular_suggestions()
-- Retourne la liste de ce qui a été promu/skippé pour le log
-- =============================================================================
CREATE OR REPLACE FUNCTION public.promote_popular_suggestions()
RETURNS TABLE(promoted_name text, household_count bigint, action text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_category_id uuid;
  v_template_id uuid;
  v_scoring_cat text;
  v_duration    text;
  v_physical    text;
  v_frequency   text;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      lower(trim(name))                   AS norm_name,
      (array_agg(name ORDER BY name))[1]  AS display_name,
      COUNT(DISTINCT household_id)        AS nb_households,
      COUNT(*)                            AS nb_total
    FROM public.custom_task_suggestions
    WHERE
      processed_at IS NULL
      AND length(trim(name)) BETWEEN 5 AND 80
      AND trim(name) !~ '[0-9]{4,}'
      AND trim(name) NOT LIKE '%@%'
    GROUP BY lower(trim(name))
    HAVING COUNT(DISTINCT household_id) >= 3
  LOOP
    -- Vérifier si un template similaire existe déjà (exact ou fuzzy > 75%)
    IF EXISTS (
      SELECT 1 FROM task_templates
      WHERE lower(trim(name)) = rec.norm_name
         OR similarity(lower(name), rec.norm_name) > 0.75
    ) THEN
      UPDATE public.custom_task_suggestions
        SET processed_at = now()
      WHERE lower(trim(name)) = rec.norm_name AND processed_at IS NULL;

      promoted_name  := rec.display_name;
      household_count := rec.nb_households;
      action         := 'skipped_duplicate';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Inférence métadonnées par mots-clés (affinée ensuite par Claude Haiku)
    v_scoring_cat := 'misc';
    v_duration    := 'medium';
    v_physical    := 'light';
    v_frequency   := 'weekly';

    IF rec.norm_name ~* '(menage|nettoyer|nettoyage|aspir|serpill|laver|epousseter|decrasser)' THEN
      v_scoring_cat := 'cleaning';
    ELSIF rec.norm_name ~* '(linge|machine|repasser|etendre|plier|lessive|trier)' THEN
      v_scoring_cat := 'laundry';
    ELSIF rec.norm_name ~* '(course|super|acheter|commande|marche|livraison)' THEN
      v_scoring_cat := 'shopping';
    ELSIF rec.norm_name ~* '(cuisine|repas|diner|dejeuner|cuisiner|preparer|gouter|recette)' THEN
      v_scoring_cat := 'meals'; v_frequency := 'daily';
    ELSIF rec.norm_name ~* '(ecole|enfant|bebe|devoirs|cartable|creche|nounou|sieste|couche)' THEN
      v_scoring_cat := 'children'; v_frequency := 'daily'; v_duration := 'short';
    ELSIF rec.norm_name ~* '(facture|impot|assurance|banque|rdv|document|dossier|admin)' THEN
      v_scoring_cat := 'admin'; v_frequency := 'monthly';
    ELSIF rec.norm_name ~* '(jardin|pelouse|tondre|arros|terrasse|exterieur|plante)' THEN
      v_scoring_cat := 'outdoor'; v_physical := 'medium';
    ELSIF rec.norm_name ~* '(chien|chat|animal|litiere|veterinaire|aquarium|cage)' THEN
      v_scoring_cat := 'pets'; v_frequency := 'daily';
    ELSIF rec.norm_name ~* '(voiture|garage|vidange|pneu|vehicule)' THEN
      v_scoring_cat := 'vehicle'; v_frequency := 'monthly';
    ELSIF rec.norm_name ~* '(ranger|rangement|trier|organiser|vider|desencombrer)' THEN
      v_scoring_cat := 'tidying';
    END IF;

    IF rec.norm_name ~* '(rapide|vite|sortir|verifier|remplir|jeter)' THEN
      v_duration := 'very_short';
    ELSIF rec.norm_name ~* '(grand|complet|profond|integral|total)' THEN
      v_duration := 'long';
    END IF;

    IF rec.norm_name ~* '(deplacer|porter|jardiner|tondre|peindre)' THEN
      v_physical := 'medium';
    END IF;

    -- Résoudre category_id
    SELECT id INTO v_category_id FROM task_categories
    WHERE name ILIKE CASE v_scoring_cat
      WHEN 'cleaning'  THEN 'Nettoyage'
      WHEN 'tidying'   THEN 'Rangement'
      WHEN 'shopping'  THEN 'Courses'
      WHEN 'laundry'   THEN 'Linge'
      WHEN 'children'  THEN 'Enfants'
      WHEN 'meals'     THEN 'Cuisine'
      WHEN 'admin'     THEN 'Administratif'
      WHEN 'outdoor'   THEN 'Extérieur'
      WHEN 'hygiene'   THEN 'Hygiène'
      WHEN 'pets'      THEN 'Animaux'
      WHEN 'vehicle'   THEN 'Voiture'
      WHEN 'transport' THEN 'Transport'
      ELSE                  'Gestion foyer'
    END
    LIMIT 1;

    IF v_category_id IS NULL THEN
      SELECT id INTO v_category_id FROM task_categories
      WHERE name = 'Gestion foyer' LIMIT 1;
    END IF;

    -- Insérer le template (is_system = false = promu depuis suggestions)
    -- ai_enriched = false → la Edge Function Claude Haiku va l'enrichir ensuite
    INSERT INTO task_templates (
      id, category_id, name,
      default_frequency, default_mental_load_score,
      is_system, scoring_category, default_duration, default_physical,
      typical_time, description, sort_order, equipment_tags
    ) VALUES (
      gen_random_uuid(), v_category_id, rec.display_name,
      v_frequency, 3,
      false, v_scoring_cat, v_duration, v_physical,
      'flexible', 'Suggestion utilisateurs — en attente enrichissement IA', 999, '{}'
    )
    RETURNING id INTO v_template_id;

    -- Log de la promotion
    INSERT INTO public.catalog_promotions
      (name, household_count, template_id, inferred_category, ai_enriched)
    VALUES
      (rec.display_name, rec.nb_households, v_template_id, v_scoring_cat, false);

    -- Marquer les suggestions comme traitées
    UPDATE public.custom_task_suggestions
      SET processed_at = now()
    WHERE lower(trim(name)) = rec.norm_name AND processed_at IS NULL;

    promoted_name  := rec.display_name;
    household_count := rec.nb_households;
    action         := 'promoted';
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

-- =============================================================================
-- CRON : tous les lundis à 3h du matin (heure creuse, aucun impact user)
-- =============================================================================
SELECT cron.schedule(
  'promote-catalog-weekly',
  '0 3 * * 1',
  $$ SELECT * FROM public.promote_popular_suggestions(); $$
);

SELECT 'auto_catalog installé — cron chaque lundi 3h' AS statut;
