-- =============================================================================
-- MIGRATION V2 : Colonnes pour les 10 features
-- Tâche fixe/variable, notifications auto/manuel, coût optionnel
-- =============================================================================

-- Tâche fixe (toujours assignée à la même personne) vs variable (rotation possible)
ALTER TABLE household_tasks
  ADD COLUMN IF NOT EXISTS is_fixed_assignment boolean DEFAULT false;

-- Notifications activées par défaut, désactivables pour les tâches évidentes
ALTER TABLE household_tasks
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT true;

-- Coût optionnel de la tâche (en euros, pour FairShare Budget light)
ALTER TABLE household_tasks
  ADD COLUMN IF NOT EXISTS estimated_cost numeric(10,2) DEFAULT NULL;

SELECT 'Migration V2 terminée' AS statut;
