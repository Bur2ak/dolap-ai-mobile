-- pgvector similarity search RPC function
-- Returns wardrobe items for the authenticated user ordered by cosine similarity to a query embedding.

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
