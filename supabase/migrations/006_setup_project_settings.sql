-- Setup project settings untuk cron jobs
-- IMPORTANT: Ganti <YOUR_PROJECT_REF> dengan project ID kamu

-- Set Supabase project URL
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://<YOUR_PROJECT_REF>.supabase.co';

-- Set service role key (ambil dari Supabase Dashboard > Settings > API)
-- IMPORTANT: Ganti <YOUR_SERVICE_ROLE_KEY> dengan service role key kamu
ALTER DATABASE postgres SET app.settings.service_role_key = '<YOUR_SERVICE_ROLE_KEY>';

-- Verify settings
SELECT name, setting
FROM pg_settings
WHERE name LIKE 'app.settings.%';

COMMENT ON DATABASE postgres IS 'Project settings configured for ZENA cron jobs';
