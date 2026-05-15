-- Supabase Dashboard > Database > Extensions > pg_cron aktif et
-- Sonra bu SQL'i Supabase SQL Editor'da calistir

SELECT cron.schedule(
  'price-check-job',
  '0 9,21 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM app_settings WHERE key = 'supabase_url') || '/functions/v1/price-check',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE key = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Veya dogrudan URL ile:
-- SELECT cron.schedule(
--   'price-check-job',
--   '0 9,21 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/price-check',
--     headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- Cron job'u gormek icin:
-- SELECT * FROM cron.job;

-- Iptal etmek icin:
-- SELECT cron.unschedule('price-check-job');
