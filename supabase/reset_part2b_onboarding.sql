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
