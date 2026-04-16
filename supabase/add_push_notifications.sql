-- Migration : ajout des colonnes pour les notifications push
-- Sprint : rappel journal du soir

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_subscription jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS evening_journal_reminder boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.push_subscription IS
  'Subscription Web Push (objet PushSubscription sérialisé) — NULL si non souscrit';

COMMENT ON COLUMN profiles.evening_journal_reminder IS
  'true = rappel journal du soir activé (21h)';
