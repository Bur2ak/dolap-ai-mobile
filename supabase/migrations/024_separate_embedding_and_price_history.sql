-- ============================================================
-- Migration 024: Separate embedding and price_history tables
-- ============================================================

-- 1. wardrobe_embeddings: move embedding out of wardrobe_items
--    embedding vector(512) = 2KB/row — unnecessary on every wardrobe fetch
CREATE TABLE IF NOT EXISTS wardrobe_embeddings (
  item_id   uuid PRIMARY KEY REFERENCES wardrobe_items(id) ON DELETE CASCADE,
  embedding vector(512) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill from existing rows
INSERT INTO wardrobe_embeddings (item_id, embedding)
SELECT id, embedding
FROM wardrobe_items
WHERE embedding IS NOT NULL
ON CONFLICT (item_id) DO NOTHING;

-- RLS: only the item owner can read their embeddings
ALTER TABLE wardrobe_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "embedding_owner_access" ON wardrobe_embeddings
FOR ALL
USING (
  item_id IN (
    SELECT id FROM wardrobe_items WHERE user_id = auth.uid()
  )
);

-- IVFFlat index on the new table (more focused, better performance)
CREATE INDEX IF NOT EXISTS idx_wardrobe_embeddings_vector
  ON wardrobe_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Remove embedding from wardrobe_items (frees ~2KB/row in main table)
ALTER TABLE wardrobe_items DROP COLUMN IF EXISTS embedding;

-- Update find_similar_wardrobe_items to join the new table
DROP FUNCTION IF EXISTS find_similar_wardrobe_items(vector, int);

CREATE OR REPLACE FUNCTION find_similar_wardrobe_items(
  query_embedding vector(512),
  match_count     int DEFAULT 8
)
RETURNS SETOF wardrobe_items
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wi.*
  FROM wardrobe_items wi
  JOIN wardrobe_embeddings we ON we.item_id = wi.id
  WHERE
    wi.user_id = auth.uid()
    AND wi.is_active = TRUE
  ORDER BY we.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION find_similar_wardrobe_items(vector, int) TO authenticated;

-- ============================================================
-- 2. price_history_entries: unbounded JSONB array → proper table
-- ============================================================
CREATE TABLE IF NOT EXISTS price_history_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id uuid NOT NULL REFERENCES price_tracking(id) ON DELETE CASCADE,
  price       numeric NOT NULL,
  checked_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_history_tracking_id
  ON price_history_entries (tracking_id, checked_at DESC);

-- Backfill existing JSONB history
INSERT INTO price_history_entries (tracking_id, price, checked_at)
SELECT
  id AS tracking_id,
  (entry->>'price')::numeric AS price,
  COALESCE((entry->>'date')::timestamptz, created_at) AS checked_at
FROM price_tracking,
     jsonb_array_elements(
       CASE jsonb_typeof(price_history)
         WHEN 'array' THEN price_history
         ELSE '[]'::jsonb
       END
     ) AS entry
WHERE entry->>'price' IS NOT NULL
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE price_history_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_history_owner" ON price_history_entries
FOR ALL
USING (
  tracking_id IN (
    SELECT id FROM price_tracking WHERE user_id = auth.uid()
  )
);

-- Keep price_history column for now (backward compat) but stop writing to it
-- A future migration can drop it once the app is fully on the new table.
-- Add a comment to mark it as deprecated:
COMMENT ON COLUMN price_tracking.price_history IS 'DEPRECATED: use price_history_entries table instead. Will be dropped in migration 025.';

-- Trim existing price_history JSONB to last 30 entries to reclaim space
UPDATE price_tracking
SET price_history = (
  SELECT jsonb_agg(entry ORDER BY (entry->>'date') DESC)
  FROM (
    SELECT entry
    FROM jsonb_array_elements(
      CASE jsonb_typeof(price_history)
        WHEN 'array' THEN price_history
        ELSE '[]'::jsonb
      END
    ) AS entry
    LIMIT 30
  ) sub
)
WHERE jsonb_array_length(
  CASE jsonb_typeof(price_history)
    WHEN 'array' THEN price_history
    ELSE '[]'::jsonb
  END
) > 30;
