-- AI response cache — aynı parametrelerle tekrar Gemini çağrısını önler.
-- Maliyet düşürür (çift tıklama, hızlı tekrar istekler cache'ten döner) + hız artırır.

CREATE TABLE IF NOT EXISTS ai_response_cache (
  cache_key   text        PRIMARY KEY,        -- hash(user + params + wardrobe signature)
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind        text        NOT NULL,           -- 'outfit' | 'event' | ...
  response    jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_user ON ai_response_cache (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_created ON ai_response_cache (created_at);

ALTER TABLE ai_response_cache ENABLE ROW LEVEL SECURITY;
-- Sadece service_role (edge function) erişir; client doğrudan erişmez.
-- (Hiç policy yok = RLS açık ama yetki yok → sadece service_role bypass eder.)

-- Eski cache temizliği (24 saatten eski kayıtları sil — cron veya manuel)
CREATE OR REPLACE FUNCTION purge_stale_ai_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM ai_response_cache WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

REVOKE ALL ON FUNCTION purge_stale_ai_cache() FROM public;
GRANT EXECUTE ON FUNCTION purge_stale_ai_cache() TO service_role;
