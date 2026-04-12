-- =============================================================================
-- MIGRATION : Catégories + Templates enrichis pour FairShare
-- À lancer dans Supabase SQL Editor en une seule fois.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : Ajouter les catégories manquantes
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO task_categories (id, name, icon, color_hex, sort_order) VALUES
  ('55555555-5555-5555-5555-555555555555', 'Enfants',      '👶', '#FF6B9D', 5),
  ('66666666-6666-6666-6666-666666666666', 'Cuisine',      '🍳', '#FF9500', 6),
  ('77777777-7777-7777-7777-777777777777', 'Administratif', '📋', '#5856D6', 7),
  ('88888888-8888-8888-8888-888888888888', 'Extérieur',    '🌿', '#34C759', 8),
  ('99999999-9999-9999-9999-999999999999', 'Hygiène',      '🚿', '#00C7BE', 9),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Animaux',      '🐾', '#AF52DE', 10),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Voiture',      '🚗', '#636366', 11),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gestion foyer','🏠', '#007AFF', 12),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Transport',   '🚌', '#FF9F0A', 13)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 : Enrichir le schéma task_templates
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS scoring_category text;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS default_duration text;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS default_physical text;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS typical_time text;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS sort_order smallint DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 : Mettre à jour les templates existants mal catégorisés
-- (templates "Cuisine" actuellement dans "Courses")
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE task_templates
SET category_id = '66666666-6666-6666-6666-666666666666'
WHERE name IN (
  'Cuisiner les repas principaux',
  'Planifier les repas de la semaine',
  'Préparer les déjeuners / tartines',
  'Préparer / cuisiner le dîner'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 4 : Mettre à jour les colonnes enrichies des templates existants
-- ─────────────────────────────────────────────────────────────────────────────

-- Nettoyage
UPDATE task_templates SET scoring_category = 'cleaning', default_duration = 'medium', default_physical = 'medium', typical_time = 'flexible' WHERE name = 'Décrasser le four';
UPDATE task_templates SET scoring_category = 'cleaning', default_duration = 'short', default_physical = 'light', typical_time = 'flexible' WHERE name = 'Dépoussiérer les meubles';
UPDATE task_templates SET scoring_category = 'cleaning', default_duration = 'short', default_physical = 'light', typical_time = 'soir' WHERE name = 'Faire la vaisselle';
UPDATE task_templates SET scoring_category = 'cleaning', default_duration = 'medium', default_physical = 'medium', typical_time = 'flexible' WHERE name = 'Laver les sols';
UPDATE task_templates SET scoring_category = 'cleaning', default_duration = 'medium', default_physical = 'medium', typical_time = 'flexible' WHERE name = 'Nettoyer la cuisine';
UPDATE task_templates SET scoring_category = 'hygiene', default_duration = 'medium', default_physical = 'medium', typical_time = 'flexible' WHERE name = 'Nettoyer la salle de bain';
UPDATE task_templates SET scoring_category = 'cleaning', default_duration = 'short', default_physical = 'light', typical_time = 'flexible' WHERE name = 'Nettoyer le micro-ondes';
UPDATE task_templates SET scoring_category = 'hygiene', default_duration = 'short', default_physical = 'medium', typical_time = 'flexible' WHERE name = 'Nettoyer les toilettes';
UPDATE task_templates SET scoring_category = 'cleaning', default_duration = 'medium', default_physical = 'medium', typical_time = 'flexible' WHERE name = 'Nettoyer les vitres';
UPDATE task_templates SET scoring_category = 'cleaning', default_duration = 'medium', default_physical = 'medium', typical_time = 'flexible' WHERE name = 'Passer l''aspirateur';
UPDATE task_templates SET scoring_category = 'cleaning', default_duration = 'short', default_physical = 'light', typical_time = 'soir' WHERE name = 'Vider le lave-vaisselle';

-- Rangement
UPDATE task_templates SET scoring_category = 'tidying', default_duration = 'long', default_physical = 'medium', typical_time = 'flexible' WHERE name = 'Désencombrer / donner';
UPDATE task_templates SET scoring_category = 'tidying', default_duration = 'long', default_physical = 'medium', typical_time = 'flexible' WHERE name = 'Ranger la cave / grenier';
UPDATE task_templates SET scoring_category = 'tidying', default_duration = 'short', default_physical = 'light', typical_time = 'soir' WHERE name = 'Ranger la cuisine';
UPDATE task_templates SET scoring_category = 'tidying', default_duration = 'medium', default_physical = 'light', typical_time = 'flexible' WHERE name = 'Ranger les chambres';
UPDATE task_templates SET scoring_category = 'tidying', default_duration = 'medium', default_physical = 'light', typical_time = 'flexible' WHERE name = 'Ranger les placards';
UPDATE task_templates SET scoring_category = 'tidying', default_duration = 'short', default_physical = 'light', typical_time = 'soir' WHERE name = 'Sortir les poubelles (tri)';
UPDATE task_templates SET scoring_category = 'tidying', default_duration = 'short', default_physical = 'light', typical_time = 'soir' WHERE name = 'Vider les poubelles';

-- Courses
UPDATE task_templates SET scoring_category = 'shopping', default_duration = 'short', default_physical = 'none', typical_time = 'flexible' WHERE name = 'Commander en ligne';
UPDATE task_templates SET scoring_category = 'shopping', default_duration = 'short', default_physical = 'none', typical_time = 'flexible' WHERE name = 'Faire la liste de courses';
UPDATE task_templates SET scoring_category = 'shopping', default_duration = 'long', default_physical = 'medium', typical_time = 'matin' WHERE name = 'Faire les courses';
UPDATE task_templates SET scoring_category = 'shopping', default_duration = 'short', default_physical = 'none', typical_time = 'flexible' WHERE name ILIKE 'Gérer les stocks%';
UPDATE task_templates SET scoring_category = 'shopping', default_duration = 'short', default_physical = 'none', typical_time = 'flexible' WHERE name ILIKE 'Préparer la liste%';

-- Cuisine (réattribués)
UPDATE task_templates SET scoring_category = 'meals', default_duration = 'medium', default_physical = 'light', typical_time = 'soir' WHERE name = 'Cuisiner les repas principaux';
UPDATE task_templates SET scoring_category = 'meals', default_duration = 'short', default_physical = 'none', typical_time = 'flexible' WHERE name = 'Planifier les repas de la semaine';
UPDATE task_templates SET scoring_category = 'meals', default_duration = 'short', default_physical = 'light', typical_time = 'matin' WHERE name = 'Préparer les déjeuners / tartines';
UPDATE task_templates SET scoring_category = 'meals', default_duration = 'medium', default_physical = 'light', typical_time = 'soir' WHERE name = 'Préparer / cuisiner le dîner';

-- Linge
UPDATE task_templates SET scoring_category = 'laundry', default_duration = 'short', default_physical = 'light', typical_time = 'matin' WHERE name = 'Lancer une lessive';
UPDATE task_templates SET scoring_category = 'laundry', default_duration = 'medium', default_physical = 'light', typical_time = 'flexible' WHERE name ILIKE 'Laver le linge de maison%';
UPDATE task_templates SET scoring_category = 'laundry', default_duration = 'long', default_physical = 'medium', typical_time = 'flexible' WHERE name ILIKE 'Laver les couettes%';
UPDATE task_templates SET scoring_category = 'laundry', default_duration = 'short', default_physical = 'light', typical_time = 'soir' WHERE name = 'Plier le linge';
UPDATE task_templates SET scoring_category = 'laundry', default_duration = 'short', default_physical = 'light', typical_time = 'flexible' WHERE name = 'Ranger le linge dans les armoires';
UPDATE task_templates SET scoring_category = 'laundry', default_duration = 'medium', default_physical = 'medium', typical_time = 'flexible' WHERE name = 'Repasser';

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 5 : Nouveaux templates — Enfants
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Amener les enfants à l''école', 'daily', 4, true, 'children', 'short', 'light', 'matin', 'Trajet aller vers l''école ou la crèche', 1),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Récupérer les enfants à l''école', 'daily', 4, true, 'children', 'short', 'light', 'soir', 'Trajet retour depuis l''école ou la crèche', 2),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Bain des enfants', 'daily', 3, true, 'children', 'short', 'medium', 'soir', 'Bain ou douche des enfants', 3),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Préparer le cartable', 'daily', 3, true, 'children', 'very_short', 'none', 'soir', 'Vérifier les affaires pour le lendemain', 4),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Aider aux devoirs', 'daily', 5, true, 'children', 'medium', 'none', 'soir', 'Accompagner les enfants dans leurs devoirs', 5),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Préparer le goûter', 'daily', 2, true, 'children', 'very_short', 'none', 'soir', 'Goûter après l''école', 6),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Rendez-vous pédiatre / médecin', 'quarterly', 6, true, 'children', 'long', 'none', 'flexible', 'Consultation médicale des enfants', 7),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Gérer les activités extrascolaires', 'weekly', 4, true, 'children', 'short', 'none', 'flexible', 'Inscription, transport, suivi des activités', 8),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Coucher les enfants', 'daily', 3, true, 'children', 'short', 'none', 'soir', 'Routine du soir, histoire, câlin', 9),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Habiller les enfants', 'daily', 2, true, 'children', 'very_short', 'light', 'matin', 'Préparer et habiller les petits', 10),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Préparer les affaires de sport', 'weekly', 3, true, 'children', 'very_short', 'none', 'soir', 'Sac de sport, tenue, gourde', 11),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Organiser un anniversaire', 'yearly', 7, true, 'children', 'very_long', 'light', 'flexible', 'Invitations, gâteau, cadeaux, activités', 12);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 6 : Nouveaux templates — Cuisine
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
  (gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer le petit-déjeuner', 'daily', 2, true, 'meals', 'short', 'light', 'matin', 'Petit-déjeuner pour le foyer', 1),
  (gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer le déjeuner', 'daily', 3, true, 'meals', 'medium', 'light', 'midi', 'Repas du midi', 2),
  (gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Débarrasser la table', 'daily', 1, true, 'meals', 'very_short', 'light', 'soir', 'Après le repas', 3),
  (gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer les lunch box', 'daily', 3, true, 'meals', 'short', 'light', 'soir', 'Lunch box pour le lendemain', 4),
  (gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Cuisiner en batch', 'weekly', 5, true, 'meals', 'very_long', 'medium', 'flexible', 'Préparer plusieurs repas à l''avance', 5),
  (gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Vider le frigo / vérifier les dates', 'weekly', 2, true, 'meals', 'short', 'light', 'flexible', 'Éviter le gaspillage', 6);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 7 : Nouveaux templates — Administratif
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Payer les factures', 'monthly', 5, true, 'admin', 'short', 'none', 'flexible', 'Électricité, eau, internet, etc.', 1),
  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Déclaration d''impôts', 'yearly', 8, true, 'admin', 'very_long', 'none', 'flexible', 'Déclaration annuelle des revenus', 2),
  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Renouveler les assurances', 'yearly', 6, true, 'admin', 'medium', 'none', 'flexible', 'Maison, voiture, santé', 3),
  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Prendre un rendez-vous médical', 'quarterly', 4, true, 'admin', 'short', 'none', 'flexible', 'Médecin, dentiste, spécialiste', 4),
  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Gérer les papiers / courrier', 'weekly', 4, true, 'admin', 'short', 'none', 'flexible', 'Trier, classer, répondre', 5),
  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Mettre à jour les documents officiels', 'yearly', 6, true, 'admin', 'medium', 'none', 'flexible', 'Carte d''identité, passeport, permis', 6),
  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Gérer le budget du foyer', 'monthly', 5, true, 'admin', 'medium', 'none', 'flexible', 'Comptes, dépenses, épargne', 7),
  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Contacter un artisan / prestataire', 'quarterly', 4, true, 'admin', 'short', 'none', 'flexible', 'Plombier, électricien, serrurier', 8),
  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Gérer les abonnements', 'monthly', 3, true, 'admin', 'short', 'none', 'flexible', 'Téléphone, streaming, salle de sport', 9),
  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Inscrire les enfants (école, activités)', 'yearly', 7, true, 'admin', 'long', 'none', 'flexible', 'Dossiers d''inscription, dates limites', 10);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 8 : Nouveaux templates — Extérieur
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Tondre la pelouse', 'biweekly', 4, true, 'outdoor', 'long', 'high', 'flexible', 'Tondeuse, ramassage', 1),
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Arroser les plantes / jardin', 'daily', 2, true, 'outdoor', 'short', 'light', 'matin', 'Plantes intérieures et extérieures', 2),
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Nettoyer la terrasse / balcon', 'monthly', 3, true, 'outdoor', 'medium', 'medium', 'flexible', 'Balayage, nettoyage', 3),
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Entretenir le jardin', 'weekly', 4, true, 'outdoor', 'long', 'high', 'flexible', 'Désherber, tailler, planter', 4),
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Nettoyer les gouttières', 'semiannual', 5, true, 'outdoor', 'medium', 'high', 'flexible', 'Débouchage, nettoyage', 5),
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Déneiger / saler l''entrée', 'daily', 3, true, 'outdoor', 'short', 'high', 'matin', 'En période hivernale', 6),
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Sortir / rentrer les poubelles', 'weekly', 1, true, 'outdoor', 'very_short', 'light', 'soir', 'Jour de collecte', 7);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 9 : Nouveaux templates — Hygiène
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
  (gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Changer les draps', 'biweekly', 3, true, 'hygiene', 'short', 'medium', 'flexible', 'Lit principal et enfants', 1),
  (gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Changer les serviettes', 'weekly', 1, true, 'hygiene', 'very_short', 'light', 'flexible', 'Serviettes de bain et cuisine', 2),
  (gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Désinfecter les surfaces', 'weekly', 2, true, 'hygiene', 'short', 'light', 'flexible', 'Poignées, interrupteurs, plans de travail', 3),
  (gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Nettoyer les miroirs', 'biweekly', 1, true, 'hygiene', 'very_short', 'light', 'flexible', 'Salle de bain, entrée', 4),
  (gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Recharger les consommables', 'monthly', 2, true, 'hygiene', 'very_short', 'none', 'flexible', 'Savon, papier toilette, lessive', 5);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 10 : Nouveaux templates — Animaux
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nourrir les animaux', 'daily', 2, true, 'pets', 'very_short', 'none', 'matin', 'Repas matin et/ou soir', 1),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Promener le chien', 'daily', 3, true, 'pets', 'medium', 'medium', 'matin', 'Balade quotidienne', 2),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nettoyer la litière', 'daily', 2, true, 'pets', 'very_short', 'light', 'soir', 'Nettoyage quotidien', 3),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Rendez-vous vétérinaire', 'semiannual', 5, true, 'pets', 'long', 'none', 'flexible', 'Vaccins, contrôle annuel', 4),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acheter la nourriture animale', 'monthly', 2, true, 'pets', 'short', 'light', 'flexible', 'Croquettes, litière, friandises', 5),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Toilettage / brossage', 'weekly', 2, true, 'pets', 'short', 'light', 'flexible', 'Brossage, coupe de griffes', 6);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 11 : Nouveaux templates — Voiture
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Faire le plein / recharger', 'weekly', 2, true, 'vehicle', 'short', 'none', 'flexible', 'Essence ou recharge électrique', 1),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Lavage voiture', 'monthly', 2, true, 'vehicle', 'short', 'light', 'flexible', 'Lavage intérieur et extérieur', 2),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Contrôle technique', 'yearly', 6, true, 'vehicle', 'long', 'none', 'flexible', 'Rendez-vous, dépôt, récupération', 3),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vidange / entretien', 'semiannual', 5, true, 'vehicle', 'long', 'none', 'flexible', 'Entretien périodique au garage', 4),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Changement de pneus', 'semiannual', 4, true, 'vehicle', 'medium', 'none', 'flexible', 'Pneus hiver / été', 5),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vérifier la pression des pneus', 'monthly', 2, true, 'vehicle', 'very_short', 'none', 'flexible', 'Contrôle rapide à la station', 6);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 12 : Nouveaux templates — Gestion foyer
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
  (gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Planifier la semaine', 'weekly', 5, true, 'household_management', 'short', 'none', 'soir', 'Organiser les repas, activités, rendez-vous', 1),
  (gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Vérifier les stocks du foyer', 'weekly', 3, true, 'household_management', 'short', 'none', 'flexible', 'Ce qui manque, ce qu''il faut racheter', 2),
  (gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Organiser les vacances', 'yearly', 8, true, 'household_management', 'very_long', 'none', 'flexible', 'Recherche, réservation, préparation', 3),
  (gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Organiser un événement familial', 'quarterly', 6, true, 'household_management', 'long', 'none', 'flexible', 'Repas de famille, fête, invitation', 4),
  (gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Relever le courrier', 'daily', 1, true, 'household_management', 'very_short', 'none', 'soir', 'Boîte aux lettres', 5),
  (gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Faire le point couple / foyer', 'weekly', 4, true, 'household_management', 'short', 'none', 'soir', 'Discuter de l''organisation, des priorités', 6),
  (gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Acheter un cadeau', 'monthly', 4, true, 'household_management', 'medium', 'none', 'flexible', 'Anniversaires, fêtes, remerciements', 7);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 13 : Nouveaux templates — Transport
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
  (gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Amener les enfants aux activités', 'weekly', 4, true, 'transport', 'medium', 'none', 'soir', 'Sport, musique, cours particulier', 1),
  (gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Covoiturage', 'weekly', 3, true, 'transport', 'medium', 'none', 'matin', 'Organiser et effectuer le covoiturage', 2),
  (gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Accompagner à un rendez-vous', 'monthly', 3, true, 'transport', 'medium', 'none', 'flexible', 'Médecin, dentiste, administratif', 3);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 14 : Templates bonus — Nettoyage (compléter les manques)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer le réfrigérateur', 'monthly', 4, true, 'cleaning', 'medium', 'medium', 'flexible', 'Intérieur, tiroirs, joints', 20),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Détartrer la bouilloire / cafetière', 'monthly', 2, true, 'cleaning', 'short', 'none', 'flexible', 'Vinaigre blanc, rinçage', 21),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer la machine à laver', 'monthly', 2, true, 'cleaning', 'short', 'none', 'flexible', 'Cycle à vide, nettoyage du joint', 22);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 15 : Templates bonus — Courses (compléter)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter des produits d''hygiène', 'monthly', 2, true, 'shopping', 'short', 'light', 'flexible', 'Shampoing, dentifrice, savon', 10),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter des fournitures scolaires', 'yearly', 4, true, 'shopping', 'medium', 'light', 'flexible', 'Rentrée, réassort en cours d''année', 11),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter des vêtements enfants', 'quarterly', 4, true, 'shopping', 'long', 'light', 'flexible', 'Croissance, saisons', 12);

-- ─────────────────────────────────────────────────────────────────────────────
-- VÉRIFICATION
-- ─────────────────────────────────────────────────────────────────────────────

-- Résumé par catégorie
SELECT tc.name AS categorie, COUNT(tt.id) AS nb_templates
FROM task_templates tt
JOIN task_categories tc ON tc.id = tt.category_id
GROUP BY tc.name, tc.sort_order
ORDER BY tc.sort_order;
