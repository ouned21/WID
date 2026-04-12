-- =============================================================================
-- RESET DES DONNÉES pour repartir propre (test avec Barbara)
-- Ne supprime PAS : comptes, foyer, catégories, templates
-- SUPPRIME : tâches, complétions, échanges
-- =============================================================================

-- 1. Supprimer les échanges
DELETE FROM task_exchanges;

-- 2. Supprimer les complétions
DELETE FROM task_completions;

-- 3. Supprimer les tâches
DELETE FROM household_tasks;

-- 4. Vérification
SELECT 'Tâches' as table_name, count(*) as remaining FROM household_tasks
UNION ALL
SELECT 'Complétions', count(*) FROM task_completions
UNION ALL
SELECT 'Échanges', count(*) FROM task_exchanges;
