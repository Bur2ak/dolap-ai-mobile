-- pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- wardrobe_items'a embedding kolonu ekle (yoksa)
ALTER TABLE wardrobe_items
  ADD COLUMN IF NOT EXISTS embedding vector(512);

-- IVFFlat index (benzerlik araması için)
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_embedding
  ON wardrobe_items USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- pgvector similarity search RPC function
CREATE OR REPLACE FUNCTION find_similar_wardrobe_items(
  query_embedding vector(512),
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    wi.id,
    1 - (wi.embedding <=> query_embedding) AS similarity
  FROM wardrobe_items wi
  WHERE
    wi.user_id = auth.uid()
    AND wi.is_active = TRUE
    AND wi.embedding IS NOT NULL
  ORDER BY wi.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION find_similar_wardrobe_items(vector, int) TO authenticated;
