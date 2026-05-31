-- Server-side AI kullanım limiti + rate limiting
-- Client-side MMKV bypass'ını kapatır. Edge function'lar service role ile çağırır.

-- 1. Yeni AI metriklerini ekle (mevcut check constraint'i genişlet)
ALTER TABLE usage_counters DROP CONSTRAINT IF EXISTS usage_counters_metric_check;
ALTER TABLE usage_counters ADD CONSTRAINT usage_counters_metric_check
  CHECK (metric IN (
    'daily_outfit_suggestions',
    'monthly_buy_decisions',
    'daily_ai_vision',        -- analyze-clothing + detect-garments + color-dna ortak günlük AI görsel limiti
    'daily_bg_removal',       -- remove-background
    'minute_rate'             -- dakikalık rate limit (kısa pencere)
  ));

-- 2. Atomik check + increment (edge function service role ile çağırır, user_id parametre olarak gelir)
-- Limit aşılırsa count artmaz, allowed=false döner.
CREATE OR REPLACE FUNCTION check_and_increment_usage(
  input_user_id uuid,
  input_metric text,
  input_period_key text,
  input_limit integer
)
RETURNS TABLE(allowed boolean, current_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_count integer;
  new_count integer;
BEGIN
  IF input_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  SELECT count INTO existing_count
  FROM usage_counters
  WHERE user_id = input_user_id AND metric = input_metric AND period_key = input_period_key;

  existing_count := COALESCE(existing_count, 0);

  -- Limit aşıldıysa artırma, reddet
  IF existing_count >= input_limit THEN
    RETURN QUERY SELECT false, existing_count;
    RETURN;
  END IF;

  INSERT INTO usage_counters (user_id, metric, period_key, count, updated_at)
  VALUES (input_user_id, input_metric, input_period_key, 1, now())
  ON CONFLICT (user_id, metric, period_key)
  DO UPDATE SET count = usage_counters.count + 1, updated_at = now()
  RETURNING count INTO new_count;

  RETURN QUERY SELECT true, new_count;
END;
$$;

-- Sadece service_role çağırabilir (edge function). authenticated kullanıcı doğrudan çağıramaz.
REVOKE ALL ON FUNCTION check_and_increment_usage(uuid, text, text, integer) FROM public;
REVOKE ALL ON FUNCTION check_and_increment_usage(uuid, text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION check_and_increment_usage(uuid, text, text, integer) TO service_role;

-- 3. Eski period_key kayıtlarını temizleyen yardımcı (cron ile çağrılabilir, opsiyonel)
CREATE INDEX IF NOT EXISTS idx_usage_counters_updated ON usage_counters (updated_at);
