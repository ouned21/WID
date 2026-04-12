-- Migration : Ajouter user_score pour le score ajustable par l'utilisateur
-- Le user_score (0-10) est le score que l'utilisateur choisit via le slider.
-- Le global_score (2-36) reste le score calculé par l'algorithme.
-- Pour l'affichage individuel → user_score
-- Pour les comparaisons entre membres → global_score (algo)

ALTER TABLE household_tasks
ADD COLUMN IF NOT EXISTS user_score smallint DEFAULT NULL;

-- Contrainte : user_score doit être entre 0 et 10
ALTER TABLE household_tasks
ADD CONSTRAINT household_tasks_user_score_check
CHECK (user_score IS NULL OR (user_score >= 0 AND user_score <= 10));
