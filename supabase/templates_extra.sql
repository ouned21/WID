-- =============================================================================
-- TEMPLATES SUPPLÉMENTAIRES : de 396 à 500+
-- ~110 templates additionnels dans les catégories sous-représentées
-- =============================================================================

-- ── NETTOYAGE — +10 ──
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer le lave-vaisselle en profondeur', 'monthly', 2, true, 'cleaning', 'short', 'light', 'flexible', 'Joint, bras, filtre, cycle vide', 60),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Laver les poignées de placards', 'monthly', 1, true, 'cleaning', 'short', 'light', 'flexible', 'Cuisine et salle de bain', 61),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer la télévision', 'monthly', 1, true, 'cleaning', 'very_short', 'none', 'flexible', 'Écran + meuble', 62),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer l''ordinateur / clavier', 'monthly', 1, true, 'cleaning', 'very_short', 'none', 'flexible', 'Air comprimé + lingette', 63),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Dépoussiérer les cadres', 'monthly', 1, true, 'cleaning', 'short', 'light', 'flexible', 'Photos et tableaux', 64),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer les chaises', 'monthly', 1, true, 'cleaning', 'short', 'light', 'flexible', 'Assise et pieds', 65),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer la douche italienne', 'weekly', 2, true, 'cleaning', 'short', 'medium', 'flexible', 'Paroi + siphon', 66),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Laver les paniers de rangement', 'quarterly', 1, true, 'cleaning', 'short', 'light', 'flexible', 'Tissu ou osier', 67),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer le congélateur', 'quarterly', 3, true, 'cleaning', 'medium', 'medium', 'flexible', 'Dégivrer + nettoyer', 68),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer les traces sur les murs', 'quarterly', 2, true, 'cleaning', 'medium', 'light', 'flexible', 'Éponge magique', 69);

-- ── COURSES — +10 ──
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter des piles', 'quarterly', 1, true, 'shopping', 'very_short', 'none', 'flexible', 'AAA, AA, boutons', 40),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter des ampoules', 'quarterly', 1, true, 'shopping', 'very_short', 'none', 'flexible', 'LED, type de culot', 41),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter un cadeau de naissance', 'yearly', 3, true, 'shopping', 'medium', 'light', 'flexible', 'Pour un proche', 42),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter des vêtements saison', 'quarterly', 3, true, 'shopping', 'long', 'light', 'flexible', 'Adulte, nouvelle saison', 43),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Renouveler la crème solaire', 'yearly', 1, true, 'shopping', 'very_short', 'none', 'flexible', 'Avant l''été', 44),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter du papier cadeau', 'quarterly', 1, true, 'shopping', 'very_short', 'none', 'flexible', 'Stock pour les fêtes', 45),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter des fleurs pour la maison', 'biweekly', 1, true, 'shopping', 'very_short', 'light', 'flexible', 'Fleurs fraîches', 46),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Comparer les abonnements téléphone', 'yearly', 3, true, 'shopping', 'medium', 'none', 'flexible', 'Meilleur forfait', 47),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter les cadeaux de Noël', 'yearly', 6, true, 'shopping', 'very_long', 'medium', 'flexible', 'Liste complète famille', 48),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter un cadeau fête des mères/pères', 'yearly', 3, true, 'shopping', 'medium', 'light', 'flexible', 'Idée + achat', 49);

-- ── CUISINE — +10 ──
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Faire mariner la viande', 'weekly', 1, true, 'meals', 'very_short', 'none', 'matin', 'Préparer la veille ou le matin', 50),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer les wraps/sandwichs', 'daily', 2, true, 'meals', 'short', 'light', 'matin', 'Repas à emporter', 51),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Faire les courses au marché', 'weekly', 3, true, 'meals', 'medium', 'medium', 'matin', 'Fruits, légumes, fromage', 52),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer le barbecue', 'weekly', 2, true, 'meals', 'medium', 'medium', 'soir', 'Allumer, griller, servir', 53),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Peler et couper les légumes', 'daily', 1, true, 'meals', 'short', 'light', 'soir', 'Préparation avant cuisson', 54),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Faire les courses de dernière minute', 'weekly', 2, true, 'meals', 'short', 'light', 'soir', 'Ce qui manque pour le dîner', 55),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Nettoyer et organiser le frigo', 'weekly', 2, true, 'meals', 'short', 'light', 'flexible', 'Avant les nouvelles courses', 56),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer les sauces maison', 'weekly', 2, true, 'meals', 'short', 'light', 'flexible', 'Vinaigrette, pesto, houmous', 57),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Faire germer des graines', 'daily', 1, true, 'meals', 'very_short', 'none', 'matin', 'Rincer matin et soir', 58),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Cuisiner avec les enfants', 'weekly', 3, true, 'meals', 'long', 'light', 'flexible', 'Gâteau, pizza, crêpes ensemble', 59);

-- ── ENFANTS — +10 ──
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Organiser un playdate', 'monthly', 3, true, 'children', 'short', 'none', 'flexible', 'Inviter un copain', 50),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Préparer le sac de piscine', 'weekly', 2, true, 'children', 'very_short', 'none', 'flexible', 'Maillot, bonnet, lunettes', 51),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Apprendre à faire du vélo', 'weekly', 3, true, 'children', 'medium', 'medium', 'flexible', 'Patience et encouragement', 52),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Vérifier les poux', 'weekly', 2, true, 'children', 'short', 'none', 'flexible', 'Peigne fin, traitement si besoin', 53),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Nettoyer les jouets', 'monthly', 2, true, 'children', 'medium', 'light', 'flexible', 'Désinfection, tri', 54),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Prendre des photos souvenirs', 'monthly', 1, true, 'children', 'very_short', 'none', 'flexible', 'Croissance, événements', 55),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Organiser la chambre de l''enfant', 'quarterly', 3, true, 'children', 'long', 'medium', 'flexible', 'Tri jouets, rangement, déco', 56),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Gérer le temps d''écran', 'daily', 3, true, 'children', 'very_short', 'none', 'soir', 'Tablette, TV, console', 57),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Accompagner les premiers pas', 'daily', 2, true, 'children', 'short', 'light', 'flexible', 'Bébé qui marche', 58),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Gérer le permis ado', 'yearly', 5, true, 'children', 'long', 'none', 'flexible', 'Auto-école, conduite accompagnée', 59);

-- ── ADMINISTRATIF — +10 ──
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Faire la déclaration de revenus fonciers', 'yearly', 6, true, 'admin', 'long', 'none', 'flexible', 'Si propriétaire bailleur', 50),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Gérer le contrat de mariage', 'yearly', 5, true, 'admin', 'medium', 'none', 'flexible', 'Notaire, modification', 51),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Renouveler le permis de conduire', 'yearly', 3, true, 'admin', 'short', 'none', 'flexible', 'ANTS, photo', 52),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Faire les papiers de la crèche', 'yearly', 5, true, 'admin', 'medium', 'none', 'flexible', 'Dossier, justificatifs', 53),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Comparer les crédits immobiliers', 'yearly', 6, true, 'admin', 'long', 'none', 'flexible', 'Renégociation ou achat', 54),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Gérer la succession', 'yearly', 8, true, 'admin', 'very_long', 'none', 'flexible', 'Notaire, héritiers', 55),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Vérifier les prélèvements bancaires', 'monthly', 2, true, 'admin', 'short', 'none', 'flexible', 'Abonnements oubliés', 56),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Mettre à jour l''assurance habitation', 'yearly', 4, true, 'admin', 'medium', 'none', 'flexible', 'Travaux, objets de valeur', 57),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Préparer le dossier de location', 'yearly', 6, true, 'admin', 'long', 'none', 'flexible', 'Fiches de paie, avis, garantie', 58),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Gérer le changement de nom', 'yearly', 5, true, 'admin', 'medium', 'none', 'flexible', 'Mariage, divorce', 59);

-- ── EXTÉRIEUR — +10 ──
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Peindre la clôture', 'yearly', 4, true, 'outdoor', 'very_long', 'high', 'flexible', 'Ponçage + 2 couches', 40),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Installer le trampoline', 'yearly', 3, true, 'outdoor', 'long', 'high', 'flexible', 'Montage + sécurité', 41),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Nettoyer le robot de piscine', 'weekly', 1, true, 'outdoor', 'short', 'light', 'flexible', 'Filtre + brosses', 42),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Planter le potager', 'yearly', 4, true, 'outdoor', 'long', 'high', 'flexible', 'Semis, plants, tuteurs', 43),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Récolter les légumes du potager', 'weekly', 2, true, 'outdoor', 'short', 'medium', 'matin', 'Tomates, courgettes, etc.', 44),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Installer les guirlandes de Noël', 'yearly', 3, true, 'outdoor', 'medium', 'medium', 'flexible', 'Extérieur + sécurité', 45),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Nettoyer la serre', 'quarterly', 2, true, 'outdoor', 'medium', 'medium', 'flexible', 'Vitres + sol', 46),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Tailler les rosiers', 'yearly', 2, true, 'outdoor', 'medium', 'medium', 'flexible', 'Fin d''hiver', 47),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Vérifier l''arrosage automatique', 'yearly', 2, true, 'outdoor', 'short', 'light', 'flexible', 'Début de saison', 48),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Ranger les outils de jardin', 'quarterly', 2, true, 'outdoor', 'short', 'light', 'flexible', 'Nettoyer + huiler + ranger', 49);

-- ── GESTION FOYER — +10 ──
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Préparer les valises de vacances', 'yearly', 5, true, 'household_management', 'long', 'medium', 'flexible', 'Liste + packing', 45),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Organiser le garage sale', 'yearly', 5, true, 'household_management', 'very_long', 'high', 'flexible', 'Tri + prix + installation', 46),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Faire le tri numérique', 'yearly', 3, true, 'household_management', 'medium', 'none', 'flexible', 'Emails, fichiers, photos', 47),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Mettre à jour le carnet d''adresses', 'yearly', 2, true, 'household_management', 'short', 'none', 'flexible', 'Nouveaux contacts, déménagements', 48),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gérer les places de concert / spectacle', 'monthly', 3, true, 'household_management', 'short', 'none', 'flexible', 'Réservation, billets', 49),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Organiser un repas entre voisins', 'quarterly', 4, true, 'household_management', 'medium', 'light', 'flexible', 'Invitations, menu, logistique', 50),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Rechercher une baby-sitter', 'monthly', 4, true, 'household_management', 'short', 'none', 'flexible', 'Annonces, entretiens', 51),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gérer les réservations vacances', 'yearly', 6, true, 'household_management', 'long', 'none', 'flexible', 'Hébergement, transport, activités', 52),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Préparer les fêtes d''anniversaire', 'yearly', 5, true, 'household_management', 'long', 'light', 'flexible', 'Thème, invitations, animation', 53),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Faire le bilan annuel du foyer', 'yearly', 5, true, 'household_management', 'medium', 'none', 'flexible', 'Budget, projets, satisfaction', 54);

-- ── TRANSPORT — +10 ──
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Amener les enfants chez le coiffeur', 'monthly', 2, true, 'transport', 'medium', 'none', 'flexible', 'RDV + transport', 25),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Aller voter', 'yearly', 2, true, 'transport', 'short', 'none', 'flexible', 'Bureau de vote', 26),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Amener la voiture au garage', 'quarterly', 3, true, 'transport', 'medium', 'none', 'flexible', 'RDV + aller-retour', 27),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Déposer les enfants chez l''ex', 'weekly', 3, true, 'transport', 'medium', 'none', 'flexible', 'Garde alternée', 28),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Récupérer les enfants chez l''ex', 'weekly', 3, true, 'transport', 'medium', 'none', 'flexible', 'Garde alternée retour', 29),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Aller à la déchetterie', 'monthly', 2, true, 'transport', 'medium', 'medium', 'flexible', 'Encombrants, cartons', 30),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Amener les vêtements au pressing', 'monthly', 2, true, 'transport', 'short', 'light', 'flexible', 'Costumes, rideaux', 31),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Aller chercher les résultats médicaux', 'quarterly', 2, true, 'transport', 'short', 'none', 'flexible', 'Labo, radiologue', 32),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Accompagner au permis de conduire', 'yearly', 3, true, 'transport', 'long', 'none', 'flexible', 'Examen code ou conduite', 33),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Faire les allers-retours aéroport', 'yearly', 3, true, 'transport', 'long', 'none', 'flexible', 'Départ et retour vacances', 34);

-- ── HYGIÈNE — +10 ──
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Nettoyer les brossettes du WC', 'monthly', 1, true, 'hygiene', 'very_short', 'light', 'flexible', 'Tremper dans javel', 40),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Remplacer le filtre de la hotte', 'quarterly', 2, true, 'hygiene', 'short', 'light', 'flexible', 'Charbon actif ou graisse', 41),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Nettoyer la machine Nespresso', 'monthly', 1, true, 'hygiene', 'short', 'none', 'flexible', 'Détartrage + rinçage', 42),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Laver les murs de la douche', 'monthly', 2, true, 'hygiene', 'short', 'medium', 'flexible', 'Anti-moisissure', 43),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Vérifier les joints du lavabo', 'semiannual', 2, true, 'hygiene', 'very_short', 'none', 'flexible', 'Étanchéité, moisissures', 44),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Nettoyer le distributeur de savon', 'monthly', 1, true, 'hygiene', 'very_short', 'none', 'flexible', 'Résidus, bouchons', 45),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Remplacer les bougies parfumées', 'monthly', 1, true, 'hygiene', 'very_short', 'none', 'flexible', 'Ambiance et fraîcheur', 46),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Laver les éponges', 'weekly', 1, true, 'hygiene', 'very_short', 'none', 'flexible', 'Micro-ondes 2 min ou machine', 47),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Remplacer les éponges usées', 'monthly', 1, true, 'hygiene', 'very_short', 'none', 'flexible', 'Cuisine et salle de bain', 48),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Vérifier le stock de papier toilette', 'weekly', 1, true, 'hygiene', 'very_short', 'none', 'flexible', 'Ne jamais être à court', 49);

-- ── ANIMAUX — +10 ──
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Dresser le chiot', 'daily', 4, true, 'pets', 'short', 'light', 'flexible', 'Commandes de base', 35),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sociabiliser le chiot', 'weekly', 3, true, 'pets', 'medium', 'light', 'flexible', 'Rencontres avec d''autres chiens', 36),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nettoyer les oreilles du chien', 'biweekly', 2, true, 'pets', 'very_short', 'none', 'flexible', 'Lotion auriculaire', 37),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Brosser les dents du chien', 'weekly', 2, true, 'pets', 'very_short', 'none', 'flexible', 'Dentifrice canin', 38),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Changer la litière complète', 'weekly', 2, true, 'pets', 'short', 'light', 'flexible', 'Vider, laver, remplir', 39),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acheter les jouets pour l''animal', 'quarterly', 2, true, 'pets', 'short', 'none', 'flexible', 'Stimulation mentale', 40),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Jouer avec le chat', 'daily', 1, true, 'pets', 'short', 'light', 'soir', 'Plumeau, laser, souris', 41),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nettoyer l''arbre à chat', 'monthly', 2, true, 'pets', 'short', 'light', 'flexible', 'Aspirer + désinfecter', 42),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Préparer la nourriture maison animal', 'weekly', 3, true, 'pets', 'medium', 'light', 'flexible', 'BARF ou ration ménagère', 43),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Déparasitage externe', 'monthly', 2, true, 'pets', 'very_short', 'none', 'flexible', 'Pipette ou collier', 44);

-- ── VOITURE — +10 ──
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Nettoyer les vitres de la voiture', 'monthly', 1, true, 'vehicle', 'short', 'light', 'flexible', 'Intérieur et extérieur', 35),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Renouveler la vignette Crit''Air', 'yearly', 2, true, 'vehicle', 'short', 'none', 'flexible', 'Commande en ligne', 36),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vérifier le liquide de frein', 'yearly', 2, true, 'vehicle', 'very_short', 'none', 'flexible', 'Niveau et couleur', 37),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Changer les balais d''essuie-glace', 'yearly', 2, true, 'vehicle', 'short', 'light', 'flexible', 'Taille adaptée', 38),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Nettoyer les sièges enfants', 'monthly', 2, true, 'vehicle', 'short', 'light', 'flexible', 'Miettes, taches, housses', 39),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vérifier l''état des ceintures', 'yearly', 2, true, 'vehicle', 'very_short', 'none', 'flexible', 'Fonctionnement + propreté', 40),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Acheter le liquide lave-glace', 'quarterly', 1, true, 'vehicle', 'very_short', 'none', 'flexible', 'Bidon 5L', 41),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Désodoriser la voiture', 'monthly', 1, true, 'vehicle', 'very_short', 'none', 'flexible', 'Spray ou diffuseur', 42),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Traiter les taches sur les sièges', 'quarterly', 2, true, 'vehicle', 'short', 'light', 'flexible', 'Nettoyant textile', 43),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vérifier les documents dans la voiture', 'yearly', 2, true, 'vehicle', 'very_short', 'none', 'flexible', 'Assurance, CT, carte grise', 44);

-- ── LINGE — +10 ──
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Laver les manteaux', 'yearly', 2, true, 'laundry', 'short', 'light', 'flexible', 'Machine ou pressing', 40),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Laver les couettes', 'quarterly', 3, true, 'laundry', 'medium', 'medium', 'flexible', 'Grande capacité ou laverie', 41),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Laver les oreillers', 'quarterly', 2, true, 'laundry', 'short', 'light', 'flexible', 'Machine 40° + séchage', 42),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Repasser les uniformes enfants', 'weekly', 2, true, 'laundry', 'short', 'light', 'flexible', 'Si école avec uniforme', 43),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Laver les protège-matelas', 'monthly', 2, true, 'laundry', 'short', 'light', 'flexible', 'Hygiène literie', 44),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Teindre un vêtement', 'yearly', 2, true, 'laundry', 'medium', 'light', 'flexible', 'Rafraîchir la couleur', 45),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Repriser les chaussettes trouées', 'monthly', 1, true, 'laundry', 'short', 'none', 'flexible', 'Ou les jeter', 46),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Ranger les vêtements d''été / hiver', 'semiannual', 3, true, 'laundry', 'long', 'medium', 'flexible', 'Sacs sous vide, boîtes', 47),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Laver les rideaux', 'semiannual', 3, true, 'laundry', 'medium', 'medium', 'flexible', 'Décrocher, machine, raccrocher', 48),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Vérifier les tailles des vêtements enfants', 'quarterly', 2, true, 'laundry', 'short', 'none', 'flexible', 'Croissance rapide', 49);

-- VÉRIFICATION
SELECT tc.name AS categorie, COUNT(tt.id) AS nb_templates
FROM task_templates tt
JOIN task_categories tc ON tc.id = tt.category_id
GROUP BY tc.name, tc.sort_order
ORDER BY tc.sort_order;
