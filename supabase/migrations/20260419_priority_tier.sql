-- =============================================================================
-- MIGRATION : Ajout de la colonne priority_tier sur task_templates
-- Date : 2026-04-19
-- Objectif : Suggestion progressive — les tâches sont révélées graduellement
--   - Tier 1 : Essentiels → créé à l'onboarding (~27 templates)
--   - Tier 2 : Courants  → suggéré après J+7 (~150 templates)
--   - Tier 3 : Niche     → suggéré après J+30 (le reste)
-- =============================================================================

-- Ajouter colonne priority_tier
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS priority_tier SMALLINT DEFAULT 2;

-- S'assurer que tous les templates existants ont bien tier 2 par défaut
UPDATE task_templates SET priority_tier = 2 WHERE priority_tier IS NULL;

-- =============================================================================
-- TIER 1 : Essentiels (onboarding)
-- Critères : fréquence daily/weekly, catégories meals/shopping/laundry/cleaning
-- de base, tâches enfants essentielles. Ce que TOUT le monde fait chaque semaine.
-- =============================================================================
UPDATE task_templates SET priority_tier = 1 WHERE name IN (
  -- NETTOYAGE de base (daily/weekly)
  'Nettoyer l''évier de cuisine',
  'Nettoyer le plan de travail cuisine',
  'Nettoyer la table à manger',
  'Aérer la maison',
  'Vider et nettoyer la poubelle de cuisine',
  'Dépoussiérer les étagères',
  'Nettoyer l''entrée',
  -- RANGEMENT quotidien
  'Ranger le salon',
  'Ranger l''entrée',
  'Faire les lits',
  'Ranger les courses',
  -- COURSES essentielles
  'Courses de la semaine',
  'Courses dépannage',
  'Acheter du pain',
  'Acheter fruits et légumes',
  -- LINGE de base
  'Trier le linge sale',
  'Lessive couleurs',
  'Lessive blancs',
  'Laver les torchons de cuisine',
  -- CUISINE / REPAS quotidiens
  'Cuisiner le repas du midi',
  'Cuisiner le repas du soir',
  'Mettre la table',
  'Débarrasser la table',
  'Lancer le lave-vaisselle',
  'Ranger la vaisselle propre',
  'Faire la vaisselle à la main',
  'Nettoyer le plan de travail après cuisine',
  'Préparer le café / thé du matin',
  'Décongeler le repas du soir',
  -- ENFANTS essentiels (daily) — seulement les plus universels
  'Surveiller les devoirs',
  'Vérifier le cahier de liaison',
  'Préparer les habits du lendemain',
  -- TRANSPORT enfants quotidien
  'Amener les enfants à l''école',
  'Récupérer les enfants à l''école'
);

-- =============================================================================
-- TIER 3 : Niche (J+30)
-- Critères : fréquence quarterly/semiannual/yearly/once, tâches très spécifiques,
-- occasionnelles, ou requérant un équipement particulier.
-- =============================================================================
UPDATE task_templates SET priority_tier = 3 WHERE name IN (
  -- NETTOYAGE rare / spécialisé
  'Nettoyer les plinthes',
  'Nettoyer les radiateurs',
  'Laver les rideaux',
  'Nettoyer les stores / volets',
  'Laver les coussins',
  'Nettoyer les lustres / luminaires',
  'Nettoyer derrière les meubles',
  'Nettoyer les joints de carrelage',
  'Nettoyer les prises électriques',
  'Nettoyer les fenêtres extérieures',
  'Grand ménage de printemps',
  'Nettoyer le garage',
  'Nettoyer la cave',
  'Nettoyer la VMC',
  'Nettoyer les grilles d''aération',
  -- RANGEMENT rare / saisonnier
  'Trier les vêtements de saison',
  'Organiser le dressing',
  'Trier les médicaments périmés',
  'Trier les produits d''entretien',
  'Ranger le garage',
  'Organiser les placards de cuisine',
  'Ranger les câbles / chargeurs',
  'Trier les photos / souvenirs',
  'Mettre à jour les étiquettes / boîtes',
  'Donner / vendre les objets inutiles',
  'Ranger les décorations de Noël',
  'Ranger les affaires de plage / été',
  'Trier les livres',
  'Désencombrer le grenier',
  -- COURSES rares / spécialisées
  'Acheter du matériel bricolage',
  'Acheter des draps / serviettes',
  'Acheter des chaussures enfants',
  'Réapprovisionner la trousse à pharmacie',
  'Acheter les cartouches d''encre',
  -- LINGE rare
  'Repasser les nappes',
  'Apporter au pressing',
  'Récupérer au pressing',
  'Laver les sacs à dos',
  'Laver les housses de coussin',
  -- ENFANTS rares / spécialisés
  'Emmener chez le dentiste',
  'Emmener chez l''orthodontiste',
  'Organiser un goûter d''anniversaire',
  'Acheter les vêtements enfants',
  'Préparer la valise de vacances enfant',
  'Suivre le carnet de santé',
  'Préparer la rentrée scolaire',
  'Gérer les photos de classe',
  'Accompagner à une sortie scolaire',
  'Inscrire à un stage vacances',
  'Gérer Parcoursup / orientation',
  'Réunion parents-profs',
  -- CUISINE rare / spécialisée
  'Faire du pain maison',
  'Faire les confitures / conserves',
  'Ranger les épices et condiments',
  -- ADMINISTRATIF (quasi tout)
  'Renouveler la carte d''identité',
  'Renouveler le passeport',
  'Mettre à jour la carte vitale',
  'Déclarer les revenus',
  'Résilier un abonnement',
  'Comparer les assurances',
  'Gérer la mutuelle santé',
  'Déclarer un sinistre',
  'Voter aux AG de copropriété',
  'Gérer les aides sociales',
  'Mettre à jour le testament',
  'Organiser les archives papier',
  'Changer de fournisseur énergie',
  'Changer de fournisseur internet',
  'Faire les relevés de compteur',
  'Mettre à jour les contacts d''urgence',
  'Vérifier la couverture d''assurance',
  'Préparer les papiers pour un voyage',
  'Remplir un dossier d''aide',
  'S''inscrire sur les listes électorales',
  'Payer la taxe foncière',
  'Payer la taxe d''habitation',
  'Gérer le dossier de crèche',
  -- EXTÉRIEUR rare / saisonnier
  'Planter des fleurs / semis',
  'Rentrer les plantes fragiles',
  'Sortir les plantes au printemps',
  'Ramoner la cheminée',
  'Entretenir le portail',
  'Nettoyer le abri de jardin',
  'Installer / ranger les décorations extérieures',
  'Entretenir la clôture',
  'Vider le composteur',
  'Installer les moustiquaires',
  -- HYGIÈNE rare / spécialisée
  'Remplacer les brosses à dents',
  'Vérifier / remplacer les filtres à eau',
  'Remplacer le tapis de bain',
  'Vérifier les produits de premiers secours',
  'Nettoyer les toilettes en profondeur',
  'Vérifier les joints de salle de bain',
  'Changer la douchette WC',
  'Changer le filtre du purificateur d''air',
  -- ANIMAUX rares
  'Emmener au toiletteur',
  'Faire vacciner l''animal',
  'Renouveler l''identification animal',
  'Faire garder l''animal (vacances)',
  'Changer l''eau de l''aquarium',
  -- VOITURE (quasi tout)
  'Vérifier les essuie-glaces',
  'Renouveler l''assurance auto',
  'Payer le stationnement / vignette',
  'Vérifier le kit de sécurité',
  'Mettre à jour le GPS',
  'Vérifier le siège auto enfant',
  'Vérifier la roue de secours',
  'Mettre à jour la carte grise',
  -- GESTION FOYER rare / événementiel
  'Organiser le repas de Noël',
  'Organiser Pâques',
  'Gérer les clés du foyer',
  'Commander des photos / albums',
  'Gérer les travaux de la maison',
  'Purger les radiateurs',
  'Vérifier la chaudière',
  'Préparer la maison pour l''hiver',
  'Préparer la maison pour l''été',
  'Mettre à jour le carnet d''adresses',
  -- TRANSPORT rare
  'Accompagner chez le médecin',
  'Accompagner chez le dentiste',
  'Amener l''animal chez le véto'
);

-- =============================================================================
-- TIER 2 : Courants (J+7)
-- Tout ce qui n'est ni tier 1 ni tier 3 reste à 2 (DEFAULT).
-- Les lignes suivantes sont documentaires — elles ne changent rien
-- car priority_tier = 2 est déjà la valeur par défaut.
-- Liste indicative des templates tier 2 :
--
-- NETTOYAGE : Nettoyer les poignées de porte, Nettoyer les interrupteurs,
--   Nettoyer le canapé, Nettoyer les tapis, Dégraisser la crédence de cuisine,
--   Nettoyer les fenêtres intérieures, Détartrer les robinets,
--   Nettoyer la machine à café
-- RANGEMENT : Ranger le bureau, Trier les papiers / courrier,
--   Ranger la salle de bain, Ranger le cellier / garde-manger,
--   Organiser le congélateur
-- COURSES : Acheter de la viande / poisson, Réceptionner une commande en ligne,
--   Acheter des produits ménagers, Acheter des médicaments,
--   Acheter un cadeau d''anniversaire, Comparer les prix / bons plans,
--   Acheter des plantes / fleurs, Racheter les consommables,
--   Acheter de l''eau en pack, Acheter la nourriture bio / spéciale,
--   Commander les courses en drive
-- LINGE : Lessive délicats, Laver les chiffons / serpillères,
--   Repasser les chemises, Coudre un bouton / réparer,
--   Laver les chaussures, Laver les doudous, Détacher un vêtement,
--   Trier les chaussettes orphelines, Nettoyer le panier à linge,
--   Laver les tapis de bain
-- ENFANTS : Préparer le biberon du matin, Changer la couche,
--   Gérer l''argent de poche, Organiser les gardes (séparation),
--   Emmener au parc, Surveiller les siestes, Gérer les invitations copains,
--   Acheter les couches en gros, Préparer la diversification alimentaire,
--   Emmener faire du vélo, Répondre aux mails de l''école,
--   Donner le médicament
-- CUISINE : Préparer un gâteau, Préparer les smoothies,
--   Préparer les repas de la semaine (batch), Vérifier les stocks frigo,
--   Faire la compote maison, Préparer les soupes, Congeler les restes,
--   Préparer un goûter maison, Commander des repas (livraison),
--   Suivre un régime spécial, Planifier les repas de la semaine,
--   Préparer les snacks enfants, Préparer un apéro,
--   Faire les crêpes du dimanche, Préparer un plat pour un voisin / ami,
--   Préparer un repas pour invités
-- ADMINISTRATIF : Vérifier les relevés bancaires, Classer les factures,
--   Prendre RDV ophtalmo, Prendre RDV dentiste, Contacter le syndic,
--   Régler un litige / réclamation, Gérer le compte épargne
-- EXTÉRIEUR : Balayer la cour, Nettoyer les meubles de jardin,
--   Ramasser les fruits, Traiter les plantes, Vérifier les détecteurs de fumée,
--   Nettoyer le barbecue après utilisation, Entretenir le robot tondeuse,
--   Mettre le sel sur les marches (hiver), Nettoyer la niche du chien,
--   Vérifier l''éclairage extérieur
-- HYGIÈNE : Nettoyer le rideau de douche, Nettoyer les brosses à dents électriques,
--   Nettoyer les accessoires de toilette, Nettoyer le porte-brosse WC,
--   Laver les gants de toilette, Nettoyer le sèche-cheveux,
--   Détartrer la douche, Nettoyer le bidet, Nettoyer et désinfecter la baignoire bébé,
--   Nettoyer les toilettes en profondeur, Aérer la salle de bain,
--   Ranger les produits de beauté, Nettoyer la machine à raser
-- ANIMAUX : Promener le chien le matin, Promener le chien le soir,
--   Brosser le chien, Donner le médicament animal, Nettoyer les gamelles,
--   Nourrir les poissons, Nettoyer la cage (lapin, hamster),
--   Couper les griffes, Laver le chien, Ramasser les crottes dans le jardin
-- VOITURE : Vérifier les niveaux (huile, liquide refroid.),
--   Vérifier les phares, Passer au car wash, Aspirer l''intérieur de la voiture,
--   Nettoyer le tableau de bord, Recharger la voiture électrique,
--   Ranger le coffre
-- GESTION FOYER : Faire le point budget mensuel, Préparer les anniversaires du mois,
--   Organiser un week-end en famille, Planifier les repas de la semaine,
--   Coordonner les emplois du temps, Gérer les invitations reçues,
--   Faire le point couple, Programmer les rappels / alarmes,
--   Gérer les mots de passe famille, Sauvegarder les photos / vidéos,
--   Appeler le plombier / électricien, Bricoler / petites réparations,
--   Changer les piles (télécommandes, jouets), Tester les alarmes / sécurité,
--   Gérer la colocation Airbnb
-- TRANSPORT : Amener au sport, Amener au cours de musique,
--   Organiser le covoiturage, Amener chez les grands-parents,
--   Amener à un anniversaire, Récupérer à un anniversaire,
--   Déposer un colis à la poste, Aller chercher un colis au relais,
--   Accompagner au centre aéré, Gérer le pass Navigo / transport
-- =============================================================================

-- Vérification : compter les templates par tier
SELECT
  priority_tier,
  COUNT(*) AS nb_templates
FROM task_templates
GROUP BY priority_tier
ORDER BY priority_tier;

-- =============================================================================
-- TABLE : task_suggestions
-- Stocke les suggestions de tâches proposées par Yova au foyer
-- Une seule suggestion active à la fois par foyer
-- =============================================================================
CREATE TABLE IF NOT EXISTS task_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  template_id UUID REFERENCES task_templates(id) ON DELETE SET NULL,

  -- Contenu de la suggestion (dénormalisé pour affichage rapide)
  name TEXT NOT NULL,
  reason TEXT NOT NULL,         -- ex: "Populaire après 7 jours d'utilisation"
  scoring_category TEXT,

  -- Trigger qui a déclenché cette suggestion
  trigger_reason TEXT NOT NULL CHECK (trigger_reason IN (
    'tier_progression',   -- compte assez ancien pour tier 2/3
    'category_gap',       -- aucune tâche dans cette catégorie
    'journal_mention',    -- mot-clé détecté dans le journal
    'seasonal'            -- suggestion saisonnière
  )),

  -- État
  suggested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  CONSTRAINT one_active_per_household UNIQUE (household_id, template_id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_task_suggestions_household
  ON task_suggestions(household_id, suggested_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_suggestions_active
  ON task_suggestions(household_id)
  WHERE accepted_at IS NULL AND dismissed_at IS NULL;

-- RLS
ALTER TABLE task_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members can view their suggestions"
  ON task_suggestions FOR SELECT
  USING (household_id = get_my_household_id());

CREATE POLICY "household members can update their suggestions"
  ON task_suggestions FOR UPDATE
  USING (household_id = get_my_household_id());
