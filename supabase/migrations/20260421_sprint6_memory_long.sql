-- Sprint 6 — Mémoire longue Yova (Mois 2 roadmap)
-- Livrable : "Yova se souvient vraiment"

-- ── 1. Extension pgvector ──────────────────────────────────────────────────
-- À activer aussi dans Supabase Dashboard → Database → Extensions → vector
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. Table conversation_turns ────────────────────────────────────────────
-- Chaque échange journal/chat stocké avec embedding pour recherche sémantique

CREATE TABLE IF NOT EXISTS conversation_turns (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    uuid        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  speaker         text        NOT NULL CHECK (speaker IN ('user', 'agent')),
  content         text        NOT NULL,
  -- Embedding 1536 dims (text-embedding-3-small OpenAI ou future API Anthropic)
  embedding       vector(1536),
  -- Faits extraits de ce tour (cache pour éviter re-extraction)
  extracted_facts jsonb       NOT NULL DEFAULT '[]',
  -- Source (journal, chat libre, check-in)
  source          text        NOT NULL DEFAULT 'journal'
    CHECK (source IN ('journal', 'chat', 'checkin')),
  source_id       uuid,       -- FK vers user_journals.id si source='journal'
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_turns_household_idx
  ON conversation_turns(household_id, created_at DESC);

CREATE INDEX IF NOT EXISTS conversation_turns_embedding_idx
  ON conversation_turns USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

ALTER TABLE conversation_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversation_turns_select"
  ON conversation_turns FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "conversation_turns_insert"
  ON conversation_turns FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM profiles WHERE id = auth.uid()
    )
  );
