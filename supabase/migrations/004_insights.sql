-- ─── Insights tables ──────────────────────────────────────────────────────────

CREATE TABLE insights (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID        NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  insight_type    TEXT        NOT NULL,
  priority        TEXT        NOT NULL CHECK (priority IN ('high','medium','low')),
  confidence      TEXT        NOT NULL CHECK (confidence IN ('High','Medium','Low')),
  category        TEXT        NOT NULL,
  headline        TEXT        NOT NULL,
  observation     TEXT        NOT NULL,
  interpretation  TEXT        NOT NULL,
  recommendation  TEXT        NOT NULL,
  evidence        JSONB       NOT NULL DEFAULT '[]',
  action_label    TEXT,
  active          BOOLEAN     NOT NULL DEFAULT true,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE insight_feedback (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id       UUID        NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
  session_user_id  UUID        NOT NULL REFERENCES session_users(id) ON DELETE CASCADE,
  action           TEXT        NOT NULL CHECK (action IN ('accepted','saved','snoozed','dismissed')),
  snoozed_until    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_insights_site_active    ON insights (site_id, active, expires_at);
CREATE INDEX idx_insights_type           ON insights (site_id, insight_type) WHERE active = true;
CREATE INDEX idx_insight_feedback_user   ON insight_feedback (session_user_id);
CREATE INDEX idx_insight_feedback_insight ON insight_feedback (insight_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE insights          ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_feedback  ENABLE ROW LEVEL SECURITY;

-- Anyone can read active, non-expired insights
CREATE POLICY "anon read active insights" ON insights
  FOR SELECT TO anon
  USING (active = true AND expires_at > now());

-- Service role can do everything (bypasses RLS)
-- insight_feedback: anon can insert and read all rows (no auth — single-tenant demo)
CREATE POLICY "anon manage feedback" ON insight_feedback
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- ─── Grant readonly role access to insights ───────────────────────────────────

GRANT SELECT ON insights         TO dashboard_readonly;
GRANT SELECT ON insight_feedback TO dashboard_readonly;

-- ─── run_insight_query helper (generators only) ───────────────────────────────
-- Called from the generate-insights Edge Function (service role).
-- Runs the provided SQL as dashboard_readonly with a 10s timeout.
-- Returns all rows as a JSONB array.

CREATE OR REPLACE FUNCTION run_insight_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
DECLARE
  result JSONB;
BEGIN
  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(row_to_json(t)), %L::jsonb) FROM (%s) t',
    '[]',
    query_text
  ) INTO result;
  RETURN result;
END;
$$;

-- Only service_role may call this function
REVOKE ALL ON FUNCTION run_insight_query(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION run_insight_query(TEXT) TO service_role;

-- ─── Nightly cron (set up after enabling pg_cron + pg_net extensions) ─────────
-- Replace <your-project-ref> with your Supabase project reference ID.
-- Run these statements in the Supabase SQL editor once extensions are enabled.

-- SELECT cron.schedule(
--   'generate-insights-nightly',
--   '0 2 * * *',
--   $$
--   SELECT net.http_post(
--     url    := 'https://<your-project-ref>.supabase.co/functions/v1/generate-insights',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
--       'Content-Type',  'application/json'
--     )
--   );
--   $$
-- );

-- SELECT cron.schedule(
--   'expire-insights',
--   '0 3 * * *',
--   $$ UPDATE insights SET active = false WHERE expires_at < now() AND active = true; $$
-- );
