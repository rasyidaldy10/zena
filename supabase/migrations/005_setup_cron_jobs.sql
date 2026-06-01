-- Setup Cron Jobs untuk ZENA Intelligence System
-- Jalankan sekali di Supabase SQL Editor, selesai!

-- Enable pg_cron extension (kalau belum)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Helper function: HTTP POST ke edge function
CREATE OR REPLACE FUNCTION trigger_edge_function(function_name TEXT)
RETURNS void AS $$
DECLARE
  project_url TEXT;
  service_key TEXT;
BEGIN
  -- Ambil project URL dan service key dari settings
  project_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);

  -- Trigger edge function via HTTP POST
  PERFORM net.http_post(
    url := project_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Stock Price Updater: Senin-Jumat jam 16:30 WIB (09:30 UTC)
SELECT cron.schedule(
  'stock-price-updater-daily',
  '30 9 * * 1-5', -- Senin-Jumat 09:30 UTC = 16:30 WIB
  $$SELECT trigger_edge_function('stock-price-updater')$$
);

-- 2. Weekly Insight: Sabtu jam 09:00 WIB (02:00 UTC)
SELECT cron.schedule(
  'weekly-insight-saturday',
  '0 2 * * 6', -- Sabtu 02:00 UTC = 09:00 WIB
  $$SELECT trigger_edge_function('weekly-insight')$$
);

-- 3. Daily Summary: Setiap hari jam 21:00 WIB (14:00 UTC)
SELECT cron.schedule(
  'daily-summary-evening',
  '0 14 * * *', -- Setiap hari 14:00 UTC = 21:00 WIB
  $$SELECT trigger_edge_function('daily-summary')$$
);

-- 4. Gmail Parser: Setiap 30 menit (optional, bisa dimatikan kalau pakai webhook)
-- Uncomment kalau mau aktifin:
-- SELECT cron.schedule(
--   'gmail-parser-every-30min',
--   '*/30 * * * *',
--   $$SELECT trigger_edge_function('gmail-parser')$$
-- );

-- Lihat semua cron jobs yang aktif
SELECT
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
ORDER BY jobname;

-- Log hasil: Akan muncul di tabel cron.job_run_details
COMMENT ON FUNCTION trigger_edge_function IS 'Helper untuk trigger Supabase Edge Functions via HTTP POST';
