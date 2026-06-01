-- ================================================================
-- ZENA Intelligence System — Database Migration
-- Jalankan di Supabase Dashboard → SQL Editor
-- ================================================================

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  message      TEXT        NOT NULL,
  is_read      BOOLEAN     NOT NULL DEFAULT FALSE,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Insights table
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_text TEXT        NOT NULL,
  week_start   DATE        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent Logs table
CREATE TABLE IF NOT EXISTS public.agent_logs (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name   TEXT        NOT NULL,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action       TEXT        NOT NULL,
  result       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS notifications_user_id_idx   ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx    ON public.notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS ai_insights_user_id_idx     ON public.ai_insights(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_logs_user_agent_idx   ON public.agent_logs(user_id, agent_name, created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_logs     ENABLE ROW LEVEL SECURITY;

-- RLS Policies: notifications
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- RLS Policies: ai_insights
CREATE POLICY "ai_insights_select_own" ON public.ai_insights
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- RLS Policies: agent_logs
CREATE POLICY "agent_logs_select_own" ON public.agent_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Enable Realtime for live notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ================================================================
-- CATATAN CRON JOBS (Setup manual di Supabase Dashboard):
-- Dashboard → Edge Functions → schedule
--
-- Weekly Insight: cron "0 2 * * 6"   (Sabtu 09:00 WIB = 02:00 UTC)
--   → POST /functions/v1/weekly-insight
--
-- Daily Summary:  cron "0 14 * * *"  (21:00 WIB = 14:00 UTC)
--   → POST /functions/v1/daily-summary
-- ================================================================
