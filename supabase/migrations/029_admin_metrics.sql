-- Admin metrics — beta/launch izleme için hafif görünümler.
-- Supabase SQL Editor'de SELECT * FROM admin_metrics; ile bakılır.
-- Custom dashboard gerektirmez; founder tek sorguyla sağlığı görür.

CREATE OR REPLACE VIEW admin_metrics AS
SELECT
  (SELECT count(*) FROM profiles) AS total_users,
  (SELECT count(*) FROM profiles WHERE created_at > now() - interval '7 days') AS new_users_7d,
  (SELECT count(*) FROM profiles WHERE created_at > now() - interval '1 day') AS new_users_1d,
  (SELECT count(*) FROM profiles WHERE subscription_tier = 'premium') AS premium_users,
  (SELECT count(DISTINCT user_id) FROM wardrobe_items WHERE is_active) AS users_with_items,
  (SELECT count(*) FROM wardrobe_items WHERE is_active) AS total_items,
  (SELECT count(*) FROM outfits) AS total_outfits,
  (SELECT count(*) FROM outfit_diary) AS total_diary_entries,
  (SELECT count(DISTINCT user_id) FROM usage_counters WHERE metric = 'daily_ai_vision' AND period_key = to_char(now(), 'YYYY-MM-DD')) AS active_ai_users_today,
  (SELECT coalesce(sum(count), 0) FROM usage_counters WHERE metric = 'daily_ai_vision' AND period_key = to_char(now(), 'YYYY-MM-DD')) AS ai_vision_calls_today;

-- Aktivasyon hunisi: kaç kullanıcı 5+ parça ekledi (kuzey yıldızı)
CREATE OR REPLACE VIEW admin_activation AS
SELECT
  (SELECT count(*) FROM profiles) AS total_users,
  (SELECT count(*) FROM (
    SELECT user_id FROM wardrobe_items WHERE is_active GROUP BY user_id HAVING count(*) >= 5
  ) t) AS activated_users_5plus,
  (SELECT count(*) FROM (
    SELECT user_id FROM wardrobe_items WHERE is_active GROUP BY user_id HAVING count(*) >= 1
  ) t) AS users_with_1plus_item;

-- Bu view'lar sadece service_role / dashboard owner tarafından okunur (RLS profiles üstünde zaten var).
-- Supabase Studio'da owner olarak çalıştırılır.
