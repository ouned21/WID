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
('equipment', 'four', 'Nettoyer la vitre du four', 'cleaning', 'monthly', 'short', 'light', 2, 0, 'Produit dégraissant', 2),
('equipment', 'plaque_cuisson', 'Nettoyer les plaques de cuisson', 'cleaning', 'weekly', 'short', 'light', 2, 0, 'Après chaque utilisation intensive', 1),
('equipment', 'hotte', 'Nettoyer les filtres de la hotte', 'cleaning', 'quarterly', 'short', 'light', 3, 0, 'Dégraisser ou remplacer', 1),
('equipment', 'refrigerateur', 'Nettoyer le réfrigérateur', 'cleaning', 'monthly', 'medium', 'medium', 4, 0, 'Intérieur, tiroirs, joints', 1),
('equipment', 'refrigerateur', 'Dégivrer le congélateur', 'cleaning', 'semiannual', 'long', 'medium', 4, 0, 'Si givre > 5mm', 3),
('equipment', 'lave_vaisselle', 'Vider le lave-vaisselle', 'cleaning', 'daily', 'short', 'light', 2, 0, 'Ranger la vaisselle propre', 1),
('equipment', 'lave_vaisselle', 'Nettoyer le filtre du lave-vaisselle', 'cleaning', 'monthly', 'short', 'light', 2, 0, 'Retirer et rincer le filtre', 2),
('equipment', 'lave_vaisselle', 'Ajouter du sel régénérant', 'cleaning', 'monthly', 'very_short', 'none', 1, 0, 'Anti-calcaire', 3),
('equipment', 'lave_vaisselle', 'Lancer un cycle de nettoyage à vide', 'cleaning', 'monthly', 'very_short', 'none', 1, 0, 'Vinaigre blanc à haute température', 4),
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
('equipment', 'seche_linge', 'Vider le filtre du sèche-linge', 'laundry', 'weekly', 'very_short', 'none', 1, 0, 'Après chaque cycle', 1),
('equipment', 'seche_linge', 'Vider le bac à eau du sèche-linge', 'laundry', 'weekly', 'very_short', 'none', 1, 0, 'Condensation', 2),
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
('equipment', 'jardin', 'Ramasser les feuilles mortes', 'outdoor', 'weekly', 'medium', 'medium', 2, 0, 'En automne', 5),
('equipment', 'piscine', 'Vérifier le pH de la piscine', 'outdoor', 'weekly', 'very_short', 'none', 2, 0, 'Bandelettes test', 1),
('equipment', 'piscine', 'Passer l''épuisette', 'outdoor', 'daily', 'short', 'light', 1, 0, 'Feuilles et insectes', 2),
('equipment', 'piscine', 'Nettoyer le filtre de la piscine', 'outdoor', 'biweekly', 'short', 'light', 2, 0, 'Contre-lavage ou nettoyage', 3),
('equipment', 'piscine', 'Hiverner / déshiverner la piscine', 'outdoor', 'semiannual', 'long', 'medium', 5, 0, 'Produits, bâche, robot', 4),
('equipment', 'terrasse', 'Nettoyer la terrasse', 'outdoor', 'monthly', 'medium', 'medium', 2, 0, 'Balai, karcher, anti-mousse', 1),
('equipment', 'barbecue', 'Nettoyer le barbecue', 'cleaning', 'monthly', 'short', 'medium', 2, 0, 'Grilles, bac à graisse', 1),
('equipment', 'composteur', 'Retourner le compost', 'outdoor', 'biweekly', 'short', 'medium', 2, 0, 'Aération', 1),

-- === VOITURE ===
('equipment', 'voiture', 'Faire le plein / recharger', 'vehicle', 'weekly', 'short', 'none', 2, 0, 'Essence ou électrique', 1),
('equipment', 'voiture', 'Laver la voiture', 'vehicle', 'monthly', 'short', 'light', 2, 0, 'Intérieur et extérieur', 2),
('equipment', 'voiture', 'Vérifier la pression des pneus', 'vehicle', 'monthly', 'very_short', 'none', 2, 0, 'Station service', 3),
('equipment', 'voiture', 'Vidange / entretien', 'vehicle', 'semiannual', 'long', 'none', 5, 0, 'RDV garage', 4),
('equipment', 'voiture', 'Contrôle technique', 'vehicle', 'yearly', 'long', 'none', 6, 0, 'Obligatoire', 5),
('equipment', 'voiture', 'Changement pneus hiver/été', 'vehicle', 'semiannual', 'medium', 'none', 4, 0, 'Novembre et mars', 6),
('equipment', 'voiture', 'Nettoyer l''intérieur', 'vehicle', 'monthly', 'short', 'light', 2, 0, 'Aspirateur, lingettes', 7),

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
