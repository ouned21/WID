-- =============================================================================
-- ENRICHISSEMENT TEMPLATES : de 93 à 500+
-- Chaque template a : scoring_category, default_duration, default_physical,
-- typical_time, description, sort_order
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- NETTOYAGE (11111111...) — +30 templates
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer les poignées de porte', 'weekly', 1, true, 'cleaning', 'very_short', 'none', 'flexible', 'Désinfection rapide', 30),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer les interrupteurs', 'weekly', 1, true, 'cleaning', 'very_short', 'none', 'flexible', 'Lingette désinfectante', 31),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer les plinthes', 'monthly', 2, true, 'cleaning', 'medium', 'medium', 'flexible', 'Chiffon humide le long des murs', 32),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer les radiateurs', 'quarterly', 3, true, 'cleaning', 'medium', 'light', 'flexible', 'Dépoussiérer et dégraisser', 33),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Laver les rideaux', 'semiannual', 3, true, 'cleaning', 'long', 'medium', 'flexible', 'Machine ou pressing', 34),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer les stores / volets', 'quarterly', 3, true, 'cleaning', 'long', 'medium', 'flexible', 'Lamelles ou volets roulants', 35),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer le canapé', 'monthly', 2, true, 'cleaning', 'medium', 'light', 'flexible', 'Aspirer et détacher', 36),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer les tapis', 'monthly', 2, true, 'cleaning', 'medium', 'medium', 'flexible', 'Aspirer en profondeur, shampouiner', 37),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Laver les coussins', 'quarterly', 2, true, 'cleaning', 'short', 'light', 'flexible', 'Housses en machine', 38),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer les lustres / luminaires', 'quarterly', 2, true, 'cleaning', 'medium', 'light', 'flexible', 'Dépoussiérer, laver les abat-jour', 39),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer derrière les meubles', 'quarterly', 2, true, 'cleaning', 'medium', 'medium', 'flexible', 'Déplacer et aspirer', 40),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Dégraisser la crédence de cuisine', 'weekly', 2, true, 'cleaning', 'short', 'light', 'soir', 'Produit dégraissant', 41),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer l''évier de cuisine', 'daily', 1, true, 'cleaning', 'very_short', 'light', 'soir', 'Rincer et désinfecter', 42),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Vider et nettoyer la poubelle de cuisine', 'weekly', 1, true, 'cleaning', 'short', 'light', 'soir', 'Sac + désinfection du bac', 43),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer les joints de carrelage', 'quarterly', 3, true, 'cleaning', 'long', 'medium', 'flexible', 'Bicarbonate + brosse à dents', 44),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer les prises électriques', 'quarterly', 1, true, 'cleaning', 'short', 'none', 'flexible', 'Chiffon sec, couper le courant', 45),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Dépoussiérer les étagères', 'weekly', 1, true, 'cleaning', 'short', 'light', 'flexible', 'Chiffon microfibre', 46),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer les fenêtres intérieures', 'monthly', 3, true, 'cleaning', 'medium', 'medium', 'flexible', 'Produit vitres + raclette', 47),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer les fenêtres extérieures', 'quarterly', 4, true, 'cleaning', 'long', 'high', 'flexible', 'Escabeau ou perche', 48),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer le plan de travail cuisine', 'daily', 1, true, 'cleaning', 'very_short', 'light', 'soir', 'Après chaque repas', 49),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer la table à manger', 'daily', 1, true, 'cleaning', 'very_short', 'light', 'soir', 'Après chaque repas', 50),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Grand ménage de printemps', 'yearly', 7, true, 'cleaning', 'very_long', 'high', 'flexible', 'Nettoyage complet de la maison', 51),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer le garage', 'semiannual', 4, true, 'cleaning', 'very_long', 'high', 'flexible', 'Balayer, ranger, trier', 52),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer la cave', 'yearly', 4, true, 'cleaning', 'very_long', 'high', 'flexible', 'Aération, rangement, nettoyage', 53),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer l''entrée', 'weekly', 1, true, 'cleaning', 'short', 'light', 'flexible', 'Balayer, essuyer les chaussures', 54),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Aérer la maison', 'daily', 1, true, 'cleaning', 'very_short', 'none', 'matin', 'Ouvrir les fenêtres 15 min', 55),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer la machine à café', 'weekly', 1, true, 'cleaning', 'short', 'none', 'flexible', 'Rincer le réservoir, nettoyer le bac', 56),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Détartrer les robinets', 'monthly', 2, true, 'cleaning', 'short', 'light', 'flexible', 'Vinaigre blanc', 57),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer la VMC', 'semiannual', 3, true, 'cleaning', 'medium', 'light', 'flexible', 'Bouches + filtres', 58),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Nettoyer les grilles d''aération', 'quarterly', 2, true, 'cleaning', 'short', 'light', 'flexible', 'Aspirer + chiffon humide', 59);

-- ─────────────────────────────────────────────────────────────────────────────
-- RANGEMENT (22222222...) — +25 templates
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Ranger le salon', 'daily', 1, true, 'tidying', 'short', 'light', 'soir', 'Coussins, télécommandes, magazines', 20),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Ranger l''entrée', 'daily', 1, true, 'tidying', 'very_short', 'light', 'soir', 'Chaussures, manteaux, clés', 21),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Ranger le bureau', 'weekly', 2, true, 'tidying', 'short', 'light', 'flexible', 'Papiers, câbles, fournitures', 22),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Ranger les jouets', 'daily', 2, true, 'tidying', 'short', 'light', 'soir', 'Caisse à jouets, étagères', 23),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Trier les vêtements de saison', 'semiannual', 4, true, 'tidying', 'long', 'medium', 'flexible', 'Stocker hiver/été', 24),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Trier les papiers / courrier', 'weekly', 3, true, 'tidying', 'short', 'none', 'flexible', 'Classer, jeter, archiver', 25),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Organiser le dressing', 'quarterly', 4, true, 'tidying', 'long', 'medium', 'flexible', 'Trier, plier, réorganiser', 26),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Ranger les courses', 'weekly', 2, true, 'tidying', 'short', 'medium', 'flexible', 'Frigo, placards, congélateur', 27),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Faire les lits', 'daily', 1, true, 'tidying', 'very_short', 'light', 'matin', 'Couette, oreillers', 28),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Ranger la salle de bain', 'weekly', 1, true, 'tidying', 'short', 'light', 'flexible', 'Produits, serviettes', 29),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Vider le lave-linge', 'weekly', 1, true, 'tidying', 'very_short', 'light', 'flexible', 'Transférer au sèche-linge ou étendoir', 30),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Trier les médicaments périmés', 'semiannual', 2, true, 'tidying', 'short', 'none', 'flexible', 'Vérifier les dates, rapporter en pharmacie', 31),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Trier les produits d''entretien', 'quarterly', 2, true, 'tidying', 'short', 'none', 'flexible', 'Jeter les vides, regrouper', 32),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Ranger le garage', 'quarterly', 4, true, 'tidying', 'very_long', 'high', 'flexible', 'Outils, vélos, cartons', 33),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Organiser les placards de cuisine', 'quarterly', 3, true, 'tidying', 'medium', 'light', 'flexible', 'Épices, conserves, ustensiles', 34),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Ranger les câbles / chargeurs', 'quarterly', 2, true, 'tidying', 'short', 'none', 'flexible', 'Étiqueter, regrouper', 35),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Trier les photos / souvenirs', 'yearly', 3, true, 'tidying', 'long', 'none', 'flexible', 'Albums, boîtes, numérique', 36),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Ranger le cellier / garde-manger', 'monthly', 2, true, 'tidying', 'short', 'light', 'flexible', 'Rotation des stocks', 37),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Organiser le congélateur', 'monthly', 2, true, 'tidying', 'short', 'light', 'flexible', 'Étiqueter, trier par date', 38),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Mettre à jour les étiquettes / boîtes', 'yearly', 2, true, 'tidying', 'short', 'none', 'flexible', 'Boîtes de rangement, bacs', 39),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Donner / vendre les objets inutiles', 'quarterly', 4, true, 'tidying', 'long', 'medium', 'flexible', 'Le Bon Coin, Emmaüs, vide-grenier', 40),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Ranger les décorations de Noël', 'yearly', 2, true, 'tidying', 'medium', 'medium', 'flexible', 'Cartons étiquetés au grenier', 41),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Ranger les affaires de plage / été', 'yearly', 2, true, 'tidying', 'short', 'light', 'flexible', 'Fin de saison', 42),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Trier les livres', 'yearly', 2, true, 'tidying', 'medium', 'light', 'flexible', 'Donner, revendre, classer', 43),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Désencombrer le grenier', 'yearly', 5, true, 'tidying', 'very_long', 'high', 'flexible', 'Tri complet', 44);

-- ─────────────────────────────────────────────────────────────────────────────
-- COURSES (33333333...) — +20 templates
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Courses de la semaine', 'weekly', 4, true, 'shopping', 'long', 'medium', 'matin', 'Supermarché, liste complète', 20),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Courses dépannage', 'weekly', 2, true, 'shopping', 'short', 'light', 'flexible', 'Ce qui manque en urgence', 21),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter du pain', 'daily', 1, true, 'shopping', 'very_short', 'light', 'matin', 'Boulangerie', 22),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter fruits et légumes', 'weekly', 2, true, 'shopping', 'short', 'light', 'matin', 'Marché ou primeur', 23),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter de la viande / poisson', 'weekly', 2, true, 'shopping', 'short', 'light', 'flexible', 'Boucher ou poissonnier', 24),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Réceptionner une commande en ligne', 'weekly', 1, true, 'shopping', 'very_short', 'light', 'flexible', 'Drive, livraison', 25),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter des produits ménagers', 'monthly', 2, true, 'shopping', 'short', 'light', 'flexible', 'Lessive, nettoyant, éponges', 26),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter des médicaments', 'monthly', 3, true, 'shopping', 'short', 'none', 'flexible', 'Pharmacie, ordonnance', 27),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter un cadeau d''anniversaire', 'monthly', 4, true, 'shopping', 'medium', 'light', 'flexible', 'Trouver une idée + acheter', 28),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Comparer les prix / bons plans', 'weekly', 2, true, 'shopping', 'short', 'none', 'flexible', 'Promos, comparateurs', 29),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter du matériel bricolage', 'monthly', 3, true, 'shopping', 'medium', 'light', 'flexible', 'Leroy Merlin, Castorama', 30),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter des plantes / fleurs', 'monthly', 2, true, 'shopping', 'short', 'light', 'flexible', 'Jardinerie ou fleuriste', 31),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Racheter les consommables', 'monthly', 2, true, 'shopping', 'short', 'light', 'flexible', 'Ampoules, piles, filtres', 32),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter des draps / serviettes', 'yearly', 3, true, 'shopping', 'medium', 'light', 'flexible', 'Renouveler le linge de maison', 33),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter des chaussures enfants', 'quarterly', 3, true, 'shopping', 'medium', 'light', 'flexible', 'Essayage, pointure', 34),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Réapprovisionner la trousse à pharmacie', 'semiannual', 3, true, 'shopping', 'short', 'none', 'flexible', 'Pansements, doliprane, thermomètre', 35),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter les cartouches d''encre', 'quarterly', 2, true, 'shopping', 'very_short', 'none', 'flexible', 'Imprimante', 36),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter de l''eau en pack', 'weekly', 1, true, 'shopping', 'short', 'high', 'flexible', 'Lourd à porter', 37),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Acheter la nourriture bio / spéciale', 'weekly', 3, true, 'shopping', 'medium', 'light', 'flexible', 'Magasin spécialisé', 38),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Commander les courses en drive', 'weekly', 3, true, 'shopping', 'short', 'none', 'flexible', 'Préparer la liste + commander', 39);

-- ─────────────────────────────────────────────────────────────────────────────
-- LINGE (44444444...) — +20 templates
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Trier le linge sale', 'weekly', 2, true, 'laundry', 'short', 'light', 'flexible', 'Couleurs, blancs, délicats', 20),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Lessive couleurs', 'weekly', 2, true, 'laundry', 'short', 'light', 'matin', 'Programme couleurs 40°', 21),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Lessive blancs', 'weekly', 2, true, 'laundry', 'short', 'light', 'matin', 'Programme blanc 60°', 22),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Lessive délicats', 'biweekly', 2, true, 'laundry', 'short', 'light', 'flexible', 'Programme délicat 30°', 23),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Laver les chiffons / serpillères', 'weekly', 1, true, 'laundry', 'very_short', 'light', 'flexible', '90° pour désinfecter', 24),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Repasser les chemises', 'weekly', 3, true, 'laundry', 'medium', 'medium', 'flexible', 'Fer ou défroisseur', 25),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Repasser les nappes', 'monthly', 2, true, 'laundry', 'short', 'light', 'flexible', 'Grandes pièces', 26),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Coudre un bouton / réparer', 'monthly', 2, true, 'laundry', 'short', 'none', 'flexible', 'Petit raccommodage', 27),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Apporter au pressing', 'monthly', 3, true, 'laundry', 'short', 'light', 'flexible', 'Costumes, manteaux, rideaux', 28),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Récupérer au pressing', 'monthly', 2, true, 'laundry', 'short', 'light', 'flexible', 'Vérifier et ranger', 29),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Laver les chaussures', 'monthly', 2, true, 'laundry', 'short', 'light', 'flexible', 'Machine ou à la main', 30),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Ranger le linge repassé', 'weekly', 1, true, 'laundry', 'short', 'light', 'flexible', 'Cintres, tiroirs, étagères', 31),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Laver les doudous', 'monthly', 2, true, 'laundry', 'short', 'light', 'flexible', 'Machine programme délicat', 32),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Détacher un vêtement', 'weekly', 2, true, 'laundry', 'short', 'none', 'flexible', 'Avant passage en machine', 33),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Laver les sacs à dos', 'quarterly', 2, true, 'laundry', 'short', 'light', 'flexible', 'Machine ou à la main', 34),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Trier les chaussettes orphelines', 'monthly', 1, true, 'laundry', 'very_short', 'none', 'flexible', 'Retrouver les paires', 35),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Nettoyer le panier à linge', 'monthly', 1, true, 'laundry', 'very_short', 'light', 'flexible', 'Essuyer ou laver', 36),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Laver les torchons de cuisine', 'weekly', 1, true, 'laundry', 'very_short', 'light', 'flexible', 'Programme chaud', 37),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Laver les tapis de bain', 'biweekly', 1, true, 'laundry', 'very_short', 'light', 'flexible', 'Machine 40°', 38),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'Laver les housses de coussin', 'quarterly', 2, true, 'laundry', 'short', 'light', 'flexible', 'Canapé et coussins déco', 39);

-- ─────────────────────────────────────────────────────────────────────────────
-- ENFANTS (55555555...) — +30 templates
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Préparer le biberon du matin', 'daily', 2, true, 'children', 'very_short', 'none', 'matin', 'Dosage, température', 20),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Changer la couche', 'daily', 2, true, 'children', 'very_short', 'light', 'flexible', 'Plusieurs fois par jour', 21),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Surveiller les devoirs', 'daily', 4, true, 'children', 'medium', 'none', 'soir', 'Vérifier le travail fait', 22),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Emmener chez le dentiste', 'semiannual', 4, true, 'children', 'long', 'none', 'flexible', 'RDV + accompagnement', 23),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Emmener chez l''orthodontiste', 'monthly', 4, true, 'children', 'long', 'none', 'flexible', 'Suivi appareil dentaire', 24),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Organiser un goûter d''anniversaire', 'yearly', 6, true, 'children', 'long', 'light', 'flexible', 'Copains, gâteau, jeux', 25),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Acheter les vêtements enfants', 'quarterly', 4, true, 'children', 'medium', 'light', 'flexible', 'Croissance rapide', 26),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Préparer la valise de vacances enfant', 'yearly', 4, true, 'children', 'medium', 'light', 'flexible', 'Vêtements, jeux, médicaments', 27),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Gérer l''argent de poche', 'monthly', 2, true, 'children', 'very_short', 'none', 'flexible', 'Virement ou espèces', 28),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Suivre le carnet de santé', 'quarterly', 3, true, 'children', 'short', 'none', 'flexible', 'Vaccins, courbes, RDV', 29),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Préparer la rentrée scolaire', 'yearly', 6, true, 'children', 'long', 'light', 'flexible', 'Fournitures, vêtements, inscription', 30),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Gérer les photos de classe', 'yearly', 2, true, 'children', 'short', 'none', 'flexible', 'Commander, distribuer', 31),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Organiser les gardes (séparation)', 'weekly', 5, true, 'children', 'short', 'none', 'flexible', 'Planning alternance', 32),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Accompagner à une sortie scolaire', 'quarterly', 3, true, 'children', 'long', 'medium', 'flexible', 'Parent accompagnateur', 33),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Gérer les écrans / temps de jeu', 'daily', 3, true, 'children', 'very_short', 'none', 'soir', 'Limiter et surveiller', 34),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Préparer les habits du lendemain', 'daily', 2, true, 'children', 'very_short', 'none', 'soir', 'Choisir la tenue', 35),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Donner le médicament', 'daily', 3, true, 'children', 'very_short', 'none', 'matin', 'Si traitement en cours', 36),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Vérifier le cahier de liaison', 'daily', 3, true, 'children', 'very_short', 'none', 'soir', 'Mots, autorisations, infos', 37),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Répondre aux mails de l''école', 'weekly', 3, true, 'children', 'short', 'none', 'flexible', 'Pronote, ENT, mails prof', 38),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Inscrire à un stage vacances', 'quarterly', 4, true, 'children', 'short', 'none', 'flexible', 'Centre aéré, camp, stage', 39),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Emmener au parc', 'weekly', 2, true, 'children', 'medium', 'medium', 'flexible', 'Sortie extérieure', 40),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Raconter une histoire', 'daily', 1, true, 'children', 'short', 'none', 'soir', 'Routine du coucher', 41),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Surveiller les siestes', 'daily', 2, true, 'children', 'short', 'none', 'flexible', 'Bébé / petit', 42),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Gérer les invitations copains', 'monthly', 3, true, 'children', 'short', 'none', 'flexible', 'Qui vient, transport, goûter', 43),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Acheter les couches en gros', 'monthly', 2, true, 'children', 'short', 'medium', 'flexible', 'Stock mensuel', 44),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Préparer la diversification alimentaire', 'daily', 3, true, 'children', 'short', 'light', 'flexible', 'Purées, compotes maison', 45),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Gérer Parcoursup / orientation', 'yearly', 7, true, 'children', 'very_long', 'none', 'flexible', 'Vœux, dossiers, motivation', 46),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Réunion parents-profs', 'quarterly', 3, true, 'children', 'medium', 'none', 'soir', 'Se libérer, y aller, discuter', 47),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Préparer le pique-nique sortie', 'monthly', 3, true, 'children', 'short', 'light', 'matin', 'Sandwichs, boissons, snacks', 48),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Emmener faire du vélo', 'weekly', 2, true, 'children', 'medium', 'medium', 'flexible', 'Parc ou piste cyclable', 49);

-- ─────────────────────────────────────────────────────────────────────────────
-- CUISINE (66666666...) — +30 templates
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Cuisiner le repas du midi', 'daily', 3, true, 'meals', 'medium', 'light', 'midi', 'Déjeuner maison', 20),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Cuisiner le repas du soir', 'daily', 3, true, 'meals', 'medium', 'light', 'soir', 'Dîner quotidien', 21),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer un gâteau', 'weekly', 2, true, 'meals', 'medium', 'light', 'flexible', 'Dessert maison', 22),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Faire du pain maison', 'weekly', 3, true, 'meals', 'long', 'medium', 'flexible', 'Pétrissage, levée, cuisson', 23),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer les smoothies', 'daily', 1, true, 'meals', 'very_short', 'light', 'matin', 'Fruits + blender', 24),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer un repas pour invités', 'monthly', 5, true, 'meals', 'very_long', 'medium', 'soir', 'Menu élaboré', 25),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Faire les confitures / conserves', 'yearly', 4, true, 'meals', 'very_long', 'medium', 'flexible', 'Saison des fruits', 26),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer les repas de la semaine (batch)', 'weekly', 5, true, 'meals', 'very_long', 'medium', 'flexible', 'Meal prep dimanche', 27),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Nettoyer le plan de travail après cuisine', 'daily', 1, true, 'meals', 'very_short', 'light', 'soir', 'Essuyage rapide', 28),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Ranger la vaisselle propre', 'daily', 1, true, 'meals', 'short', 'light', 'flexible', 'Égouttoir ou lave-vaisselle', 29),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Vérifier les stocks frigo', 'weekly', 2, true, 'meals', 'very_short', 'none', 'flexible', 'Avant les courses', 30),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Faire la compote maison', 'weekly', 2, true, 'meals', 'short', 'light', 'flexible', 'Pommes, poires, fruits de saison', 31),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer les soupes', 'weekly', 2, true, 'meals', 'medium', 'light', 'soir', 'Légumes de saison', 32),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Congeler les restes', 'weekly', 1, true, 'meals', 'very_short', 'none', 'soir', 'Portions, étiquetage, date', 33),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Décongeler le repas du soir', 'daily', 1, true, 'meals', 'very_short', 'none', 'matin', 'Sortir du congélateur le matin', 34),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer un goûter maison', 'weekly', 2, true, 'meals', 'short', 'light', 'flexible', 'Cookies, muffins, crêpes', 35),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Mettre la table', 'daily', 1, true, 'meals', 'very_short', 'light', 'soir', 'Assiettes, couverts, verres', 36),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Débarrasser la table', 'daily', 1, true, 'meals', 'very_short', 'light', 'soir', 'Après le repas', 37),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Faire la vaisselle à la main', 'daily', 2, true, 'meals', 'short', 'light', 'soir', 'Ce qui ne va pas au lave-vaisselle', 38),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Lancer le lave-vaisselle', 'daily', 1, true, 'meals', 'very_short', 'none', 'soir', 'Remplir + pastille + lancer', 39),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer le café / thé du matin', 'daily', 1, true, 'meals', 'very_short', 'none', 'matin', 'Machine ou bouilloire', 40),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer les tartines du matin', 'daily', 1, true, 'meals', 'very_short', 'none', 'matin', 'Pain, beurre, confiture', 41),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Commander des repas (livraison)', 'weekly', 2, true, 'meals', 'short', 'none', 'soir', 'Uber Eats, Deliveroo', 42),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Suivre un régime spécial', 'daily', 3, true, 'meals', 'short', 'none', 'flexible', 'Sans gluten, végan, allergies', 43),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Planifier les repas de la semaine', 'weekly', 4, true, 'meals', 'short', 'none', 'flexible', 'Menu + liste de courses', 44),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer les snacks enfants', 'daily', 1, true, 'meals', 'very_short', 'none', 'matin', 'Petits en-cas pour la journée', 45),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer un apéro', 'weekly', 2, true, 'meals', 'short', 'light', 'soir', 'Chips, fromage, olives', 46),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Faire les crêpes du dimanche', 'weekly', 2, true, 'meals', 'medium', 'light', 'matin', 'Tradition familiale', 47),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Préparer un plat pour un voisin / ami', 'monthly', 3, true, 'meals', 'medium', 'light', 'flexible', 'Naissance, maladie, solidarité', 48),
(gen_random_uuid(), '66666666-6666-6666-6666-666666666666', 'Ranger les épices et condiments', 'quarterly', 2, true, 'meals', 'short', 'none', 'flexible', 'Vérifier dates, réorganiser', 49);

-- ─────────────────────────────────────────────────────────────────────────────
-- ADMINISTRATIF (77777777...) — +30 templates
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Vérifier les relevés bancaires', 'monthly', 3, true, 'admin', 'short', 'none', 'flexible', 'Contrôle des débits', 20),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Classer les factures', 'monthly', 3, true, 'admin', 'short', 'none', 'flexible', 'Numériser ou archiver papier', 21),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Renouveler la carte d''identité', 'yearly', 5, true, 'admin', 'medium', 'none', 'flexible', 'RDV mairie, photos, timbre', 22),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Renouveler le passeport', 'yearly', 5, true, 'admin', 'medium', 'none', 'flexible', 'RDV, photos, timbre fiscal', 23),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Mettre à jour la carte vitale', 'yearly', 2, true, 'admin', 'very_short', 'none', 'flexible', 'Pharmacie ou borne CPAM', 24),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Déclarer les revenus', 'yearly', 7, true, 'admin', 'long', 'none', 'flexible', 'Impôts en ligne', 25),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Résilier un abonnement', 'quarterly', 3, true, 'admin', 'short', 'none', 'flexible', 'Lettre ou en ligne', 26),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Comparer les assurances', 'yearly', 5, true, 'admin', 'medium', 'none', 'flexible', 'Habitation, auto, santé', 27),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Prendre RDV ophtalmo', 'yearly', 3, true, 'admin', 'short', 'none', 'flexible', 'Délai souvent long', 28),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Prendre RDV dentiste', 'semiannual', 3, true, 'admin', 'short', 'none', 'flexible', 'Contrôle bisannuel', 29),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Gérer la mutuelle santé', 'yearly', 4, true, 'admin', 'medium', 'none', 'flexible', 'Comparaison, changement, remboursements', 30),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Déclarer un sinistre', 'yearly', 6, true, 'admin', 'medium', 'none', 'flexible', 'Assurance, constat, photos', 31),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Contacter le syndic', 'quarterly', 3, true, 'admin', 'short', 'none', 'flexible', 'Copropriété, travaux, charges', 32),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Voter aux AG de copropriété', 'yearly', 4, true, 'admin', 'long', 'none', 'soir', 'Assemblée générale', 33),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Gérer les aides sociales', 'yearly', 5, true, 'admin', 'medium', 'none', 'flexible', 'CAF, APL, prime activité', 34),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Mettre à jour le testament', 'yearly', 5, true, 'admin', 'medium', 'none', 'flexible', 'Notaire', 35),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Organiser les archives papier', 'yearly', 3, true, 'admin', 'medium', 'none', 'flexible', 'Classeur, scanner, jeter', 36),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Régler un litige / réclamation', 'quarterly', 5, true, 'admin', 'medium', 'none', 'flexible', 'Courrier recommandé, médiateur', 37),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Changer de fournisseur énergie', 'yearly', 5, true, 'admin', 'medium', 'none', 'flexible', 'Comparer, souscrire, résilier', 38),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Changer de fournisseur internet', 'yearly', 4, true, 'admin', 'medium', 'none', 'flexible', 'Box, installation, résiliation', 39),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Faire les relevés de compteur', 'semiannual', 1, true, 'admin', 'very_short', 'none', 'flexible', 'Eau, gaz, électricité', 40),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Mettre à jour les contacts d''urgence', 'yearly', 2, true, 'admin', 'very_short', 'none', 'flexible', 'École, médecin, assurance', 41),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Vérifier la couverture d''assurance', 'yearly', 4, true, 'admin', 'short', 'none', 'flexible', 'Habitation, RC, garanties', 42),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Préparer les papiers pour un voyage', 'yearly', 5, true, 'admin', 'medium', 'none', 'flexible', 'Visa, ESTA, assurance voyage', 43),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Gérer le compte épargne', 'monthly', 3, true, 'admin', 'short', 'none', 'flexible', 'Virements, suivi', 44),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Remplir un dossier d''aide', 'yearly', 6, true, 'admin', 'long', 'none', 'flexible', 'MDPH, bourse, allocation', 45),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'S''inscrire sur les listes électorales', 'yearly', 2, true, 'admin', 'short', 'none', 'flexible', 'Mairie ou en ligne', 46),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Payer la taxe foncière', 'yearly', 3, true, 'admin', 'very_short', 'none', 'flexible', 'Prélèvement ou paiement', 47),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Payer la taxe d''habitation', 'yearly', 3, true, 'admin', 'very_short', 'none', 'flexible', 'Si applicable', 48),
(gen_random_uuid(), '77777777-7777-7777-7777-777777777777', 'Gérer le dossier de crèche', 'yearly', 6, true, 'admin', 'long', 'none', 'flexible', 'Inscription, liste d''attente', 49);

-- ─────────────────────────────────────────────────────────────────────────────
-- EXTÉRIEUR (88888888...) — +20 templates
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Balayer la cour', 'weekly', 1, true, 'outdoor', 'short', 'medium', 'flexible', 'Feuilles, poussière', 20),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Nettoyer les meubles de jardin', 'monthly', 2, true, 'outdoor', 'medium', 'medium', 'flexible', 'Table, chaises, parasol', 21),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Planter des fleurs / semis', 'quarterly', 3, true, 'outdoor', 'medium', 'medium', 'flexible', 'Saison de plantation', 22),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Ramasser les fruits', 'weekly', 2, true, 'outdoor', 'medium', 'medium', 'flexible', 'Si arbres fruitiers', 23),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Traiter les plantes', 'monthly', 2, true, 'outdoor', 'short', 'light', 'matin', 'Anti-pucerons, engrais', 24),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Rentrer les plantes fragiles', 'yearly', 2, true, 'outdoor', 'short', 'medium', 'flexible', 'Avant les gelées', 25),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Sortir les plantes au printemps', 'yearly', 2, true, 'outdoor', 'short', 'medium', 'flexible', 'Après les dernières gelées', 26),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Ramoner la cheminée', 'yearly', 4, true, 'outdoor', 'long', 'none', 'flexible', 'Ramoneur professionnel', 27),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Vérifier les détecteurs de fumée', 'semiannual', 2, true, 'outdoor', 'very_short', 'none', 'flexible', 'Piles et fonctionnement', 28),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Entretenir le portail', 'yearly', 2, true, 'outdoor', 'short', 'light', 'flexible', 'Graisser, peindre', 29),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Nettoyer le abri de jardin', 'yearly', 3, true, 'outdoor', 'medium', 'medium', 'flexible', 'Ranger et nettoyer', 30),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Installer / ranger les décorations extérieures', 'semiannual', 2, true, 'outdoor', 'medium', 'medium', 'flexible', 'Noël, Halloween, été', 31),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Entretenir la clôture', 'yearly', 3, true, 'outdoor', 'long', 'high', 'flexible', 'Repeindre, réparer', 32),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Nettoyer le barbecue après utilisation', 'weekly', 1, true, 'outdoor', 'short', 'medium', 'soir', 'Grilles, bac, surface', 33),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Vider le composteur', 'monthly', 2, true, 'outdoor', 'short', 'medium', 'flexible', 'Utiliser ou évacuer le compost mûr', 34),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Installer les moustiquaires', 'yearly', 2, true, 'outdoor', 'short', 'light', 'flexible', 'Avant l''été', 35),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Entretenir le robot tondeuse', 'monthly', 2, true, 'outdoor', 'short', 'light', 'flexible', 'Lames, nettoyage, vérification', 36),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Mettre le sel sur les marches (hiver)', 'daily', 1, true, 'outdoor', 'very_short', 'light', 'matin', 'Quand il gèle', 37),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Nettoyer la niche du chien', 'monthly', 2, true, 'outdoor', 'short', 'medium', 'flexible', 'Laver, désinfecter', 38),
(gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'Vérifier l''éclairage extérieur', 'quarterly', 1, true, 'outdoor', 'very_short', 'none', 'soir', 'Ampoules, détecteurs', 39);

-- ─────────────────────────────────────────────────────────────────────────────
-- HYGIÈNE (99999999...) — +20 templates
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Nettoyer le rideau de douche', 'monthly', 2, true, 'hygiene', 'short', 'light', 'flexible', 'Machine ou trempage', 20),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Nettoyer les brosses à dents électriques', 'weekly', 1, true, 'hygiene', 'very_short', 'none', 'flexible', 'Base et têtes', 21),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Nettoyer les accessoires de toilette', 'monthly', 1, true, 'hygiene', 'short', 'light', 'flexible', 'Porte-savon, gobelet, distributeur', 22),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Remplacer les brosses à dents', 'quarterly', 1, true, 'hygiene', 'very_short', 'none', 'flexible', 'Tous les 3 mois', 23),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Vérifier / remplacer les filtres à eau', 'quarterly', 2, true, 'hygiene', 'short', 'none', 'flexible', 'Carafe filtrante, robinet', 24),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Nettoyer le porte-brosse WC', 'weekly', 1, true, 'hygiene', 'very_short', 'light', 'flexible', 'Désinfecter', 25),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Laver les gants de toilette', 'weekly', 1, true, 'hygiene', 'very_short', 'light', 'flexible', 'Machine à 60°', 26),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Nettoyer le sèche-cheveux', 'monthly', 1, true, 'hygiene', 'very_short', 'none', 'flexible', 'Filtre à poussière', 27),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Détartrer la douche', 'monthly', 2, true, 'hygiene', 'short', 'medium', 'flexible', 'Vinaigre blanc, parois, pomme', 28),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Nettoyer le bidet', 'weekly', 1, true, 'hygiene', 'very_short', 'light', 'flexible', 'Si équipé', 29),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Changer la douchette WC', 'yearly', 1, true, 'hygiene', 'very_short', 'none', 'flexible', 'Hygiène et usure', 30),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Nettoyer et désinfecter la baignoire bébé', 'weekly', 2, true, 'hygiene', 'short', 'light', 'flexible', 'Si bébé au foyer', 31),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Remplacer le tapis de bain', 'semiannual', 1, true, 'hygiene', 'very_short', 'none', 'flexible', 'Usure et hygiène', 32),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Vérifier les produits de premiers secours', 'semiannual', 2, true, 'hygiene', 'short', 'none', 'flexible', 'Dates, stocks', 33),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Nettoyer les toilettes en profondeur', 'monthly', 2, true, 'hygiene', 'medium', 'medium', 'flexible', 'Détartrage complet', 34),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Aérer la salle de bain', 'daily', 1, true, 'hygiene', 'very_short', 'none', 'matin', 'Éviter moisissures', 35),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Vérifier les joints de salle de bain', 'quarterly', 2, true, 'hygiene', 'short', 'none', 'flexible', 'Moisissures, étanchéité', 36),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Ranger les produits de beauté', 'monthly', 1, true, 'hygiene', 'short', 'none', 'flexible', 'Trier, jeter les périmés', 37),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Nettoyer la machine à raser', 'weekly', 1, true, 'hygiene', 'very_short', 'none', 'flexible', 'Rincer, brosser', 38),
(gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'Changer le filtre du purificateur d''air', 'quarterly', 2, true, 'hygiene', 'very_short', 'none', 'flexible', 'Si équipé', 39);

-- ─────────────────────────────────────────────────────────────────────────────
-- ANIMAUX (aaaaaaaa...) — +15 templates
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Promener le chien le matin', 'daily', 2, true, 'pets', 'short', 'medium', 'matin', 'Balade matinale', 20),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Promener le chien le soir', 'daily', 2, true, 'pets', 'short', 'medium', 'soir', 'Balade du soir', 21),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Brosser le chien', 'weekly', 2, true, 'pets', 'short', 'light', 'flexible', 'Selon la race', 22),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Donner le médicament animal', 'daily', 2, true, 'pets', 'very_short', 'none', 'matin', 'Si traitement en cours', 23),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nettoyer les gamelles', 'daily', 1, true, 'pets', 'very_short', 'light', 'soir', 'Eau et croquettes', 24),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Changer l''eau de l''aquarium', 'biweekly', 3, true, 'pets', 'medium', 'light', 'flexible', '30% de l''eau', 25),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nourrir les poissons', 'daily', 1, true, 'pets', 'very_short', 'none', 'matin', 'Dosage précis', 26),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nettoyer la cage (lapin, hamster)', 'weekly', 2, true, 'pets', 'short', 'light', 'flexible', 'Litière, eau, nourriture', 27),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Emmener au toiletteur', 'quarterly', 3, true, 'pets', 'long', 'none', 'flexible', 'RDV, transport', 28),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Faire vacciner l''animal', 'yearly', 4, true, 'pets', 'long', 'none', 'flexible', 'RDV vétérinaire, carnet', 29),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Couper les griffes', 'monthly', 2, true, 'pets', 'very_short', 'none', 'flexible', 'Chat ou chien', 30),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Laver le chien', 'monthly', 3, true, 'pets', 'medium', 'medium', 'flexible', 'Bain ou douche', 31),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Ramasser les crottes dans le jardin', 'daily', 1, true, 'pets', 'very_short', 'light', 'matin', 'Si jardin', 32),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Renouveler l''identification animal', 'yearly', 3, true, 'pets', 'short', 'none', 'flexible', 'Puce, tatouage, I-CAD', 33),
(gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Faire garder l''animal (vacances)', 'yearly', 4, true, 'pets', 'short', 'none', 'flexible', 'Pension, famille, voisin', 34);

-- ─────────────────────────────────────────────────────────────────────────────
-- VOITURE (bbbbbbbb...) — +15 templates
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vérifier les niveaux (huile, liquide refroid.)', 'monthly', 2, true, 'vehicle', 'very_short', 'none', 'flexible', 'Capot ouvert, jauges', 20),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vérifier les essuie-glaces', 'semiannual', 1, true, 'vehicle', 'very_short', 'none', 'flexible', 'Remplacer si usés', 21),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vérifier les phares', 'monthly', 1, true, 'vehicle', 'very_short', 'none', 'soir', 'Tous les feux', 22),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Passer au car wash', 'monthly', 1, true, 'vehicle', 'short', 'none', 'flexible', 'Station de lavage auto', 23),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Aspirer l''intérieur de la voiture', 'monthly', 2, true, 'vehicle', 'short', 'light', 'flexible', 'Tapis, sièges, coffre', 24),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Nettoyer le tableau de bord', 'monthly', 1, true, 'vehicle', 'very_short', 'none', 'flexible', 'Lingettes, dépoussiérage', 25),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Renouveler l''assurance auto', 'yearly', 5, true, 'vehicle', 'medium', 'none', 'flexible', 'Comparer, souscrire', 26),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Payer le stationnement / vignette', 'yearly', 2, true, 'vehicle', 'short', 'none', 'flexible', 'Crit''Air, résident', 27),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Recharger la voiture électrique', 'weekly', 1, true, 'vehicle', 'very_short', 'none', 'soir', 'Borne domicile ou publique', 28),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vérifier le kit de sécurité', 'yearly', 2, true, 'vehicle', 'short', 'none', 'flexible', 'Triangle, gilet, trousse', 29),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Mettre à jour le GPS', 'yearly', 1, true, 'vehicle', 'short', 'none', 'flexible', 'Cartes, logiciel', 30),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vérifier le siège auto enfant', 'semiannual', 3, true, 'vehicle', 'short', 'none', 'flexible', 'Fixation, taille, date limite', 31),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Ranger le coffre', 'monthly', 1, true, 'vehicle', 'short', 'light', 'flexible', 'Retirer le superflu', 32),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vérifier la roue de secours', 'yearly', 2, true, 'vehicle', 'very_short', 'none', 'flexible', 'Pression, cric, clé', 33),
(gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Mettre à jour la carte grise', 'yearly', 4, true, 'vehicle', 'short', 'none', 'flexible', 'ANTS en ligne', 34);

-- ─────────────────────────────────────────────────────────────────────────────
-- GESTION FOYER (cccccccc...) — +25 templates
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Faire le point budget mensuel', 'monthly', 4, true, 'household_management', 'medium', 'none', 'flexible', 'Revenus, dépenses, épargne', 20),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Préparer les anniversaires du mois', 'monthly', 3, true, 'household_management', 'short', 'none', 'flexible', 'Cadeaux, cartes, organisation', 21),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Organiser un week-end en famille', 'monthly', 4, true, 'household_management', 'medium', 'none', 'flexible', 'Sortie, activité, pique-nique', 22),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Planifier les repas de la semaine', 'weekly', 4, true, 'household_management', 'short', 'none', 'flexible', 'Menu + liste courses', 23),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Coordonner les emplois du temps', 'weekly', 4, true, 'household_management', 'short', 'none', 'flexible', 'Qui fait quoi, quand', 24),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gérer les invitations reçues', 'monthly', 3, true, 'household_management', 'short', 'none', 'flexible', 'Répondre, organiser, cadeaux', 25),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Organiser le repas de Noël', 'yearly', 7, true, 'household_management', 'very_long', 'light', 'flexible', 'Menu, invités, déco, cadeaux', 26),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Organiser Pâques', 'yearly', 4, true, 'household_management', 'medium', 'light', 'flexible', 'Chasse aux œufs, brunch', 27),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Faire le point couple', 'monthly', 4, true, 'household_management', 'short', 'none', 'soir', 'Finances, organisation, projets', 28),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Programmer les rappels / alarmes', 'weekly', 2, true, 'household_management', 'very_short', 'none', 'flexible', 'Téléphone, agenda', 29),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gérer les clés du foyer', 'yearly', 2, true, 'household_management', 'short', 'none', 'flexible', 'Doubles, trousseau, cachette', 30),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gérer les mots de passe famille', 'quarterly', 3, true, 'household_management', 'short', 'none', 'flexible', 'Wifi, streaming, comptes', 31),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Sauvegarder les photos / vidéos', 'monthly', 3, true, 'household_management', 'short', 'none', 'flexible', 'Cloud, disque dur externe', 32),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Commander des photos / albums', 'yearly', 3, true, 'household_management', 'medium', 'none', 'flexible', 'Livre photo, tirages', 33),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gérer les travaux de la maison', 'yearly', 6, true, 'household_management', 'long', 'none', 'flexible', 'Devis, planning, suivi', 34),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Appeler le plombier / électricien', 'quarterly', 4, true, 'household_management', 'short', 'none', 'flexible', 'Dépannage ou entretien', 35),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Bricoler / petites réparations', 'monthly', 3, true, 'household_management', 'medium', 'medium', 'flexible', 'Ampoule, joint, vis, étagère', 36),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Changer les piles (télécommandes, jouets)', 'quarterly', 1, true, 'household_management', 'very_short', 'none', 'flexible', 'Vérifier et remplacer', 37),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Purger les radiateurs', 'yearly', 2, true, 'household_management', 'short', 'light', 'flexible', 'Avant la saison de chauffe', 38),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Vérifier la chaudière', 'yearly', 4, true, 'household_management', 'long', 'none', 'flexible', 'Entretien annuel obligatoire', 39),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Tester les alarmes / sécurité', 'quarterly', 2, true, 'household_management', 'short', 'none', 'flexible', 'Détecteurs, alarme, caméra', 40),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Préparer la maison pour l''hiver', 'yearly', 4, true, 'household_management', 'long', 'medium', 'flexible', 'Isolation, chauffage, antigel', 41),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Préparer la maison pour l''été', 'yearly', 3, true, 'household_management', 'medium', 'light', 'flexible', 'Ventilateurs, moustiquaires, stores', 42),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gérer la colocation Airbnb', 'monthly', 5, true, 'household_management', 'medium', 'none', 'flexible', 'Si location saisonnière', 43),
(gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Mettre à jour le carnet d''adresses', 'yearly', 2, true, 'household_management', 'short', 'none', 'flexible', 'Numéros, adresses, emails', 44);

-- ─────────────────────────────────────────────────────────────────────────────
-- TRANSPORT (dddddddd...) — +15 templates
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO task_templates (id, category_id, name, default_frequency, default_mental_load_score, is_system, scoring_category, default_duration, default_physical, typical_time, description, sort_order) VALUES
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Amener les enfants à l''école', 'daily', 3, true, 'transport', 'short', 'light', 'matin', 'Trajet aller matin', 10),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Récupérer les enfants à l''école', 'daily', 3, true, 'transport', 'short', 'light', 'soir', 'Trajet retour', 11),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Amener au sport', 'weekly', 3, true, 'transport', 'medium', 'none', 'soir', 'Foot, danse, judo...', 12),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Amener au cours de musique', 'weekly', 3, true, 'transport', 'medium', 'none', 'soir', 'Piano, guitare, conservatoire', 13),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Organiser le covoiturage', 'weekly', 3, true, 'transport', 'short', 'none', 'flexible', 'Planning parents', 14),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Accompagner chez le médecin', 'quarterly', 3, true, 'transport', 'medium', 'none', 'flexible', 'Adulte ou enfant', 15),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Accompagner chez le dentiste', 'semiannual', 3, true, 'transport', 'medium', 'none', 'flexible', 'RDV + transport', 16),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Amener chez les grands-parents', 'monthly', 2, true, 'transport', 'medium', 'none', 'flexible', 'Visite famille', 17),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Amener à un anniversaire', 'monthly', 2, true, 'transport', 'short', 'none', 'flexible', 'Copain / copine', 18),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Récupérer à un anniversaire', 'monthly', 2, true, 'transport', 'short', 'none', 'soir', 'Heure de fin souvent tardive', 19),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Déposer un colis à la poste', 'monthly', 2, true, 'transport', 'short', 'light', 'flexible', 'Retour, envoi', 20),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Aller chercher un colis au relais', 'weekly', 1, true, 'transport', 'short', 'light', 'flexible', 'Point relais, consigne', 21),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Accompagner au centre aéré', 'weekly', 2, true, 'transport', 'short', 'none', 'matin', 'Pendant les vacances', 22),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Gérer le pass Navigo / transport', 'monthly', 2, true, 'transport', 'very_short', 'none', 'flexible', 'Rechargement, abonnement', 23),
(gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Amener l''animal chez le véto', 'semiannual', 3, true, 'transport', 'medium', 'none', 'flexible', 'Transport + attente', 24);

-- ─────────────────────────────────────────────────────────────────────────────
-- VÉRIFICATION FINALE
-- ─────────────────────────────────────────────────────────────────────────────
SELECT tc.name AS categorie, COUNT(tt.id) AS nb_templates
FROM task_templates tt
JOIN task_categories tc ON tc.id = tt.category_id
GROUP BY tc.name, tc.sort_order
ORDER BY tc.sort_order;
