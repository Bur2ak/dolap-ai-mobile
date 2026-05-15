-- Hesap silme islerini islemek icin cron job
-- Gunluk gece yarisi calisir

SELECT cron.schedule(
  'account-deletion-job',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-account-deletions',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Iptal etmek icin:
-- SELECT cron.unschedule('account-deletion-job');
