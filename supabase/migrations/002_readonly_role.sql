-- ─── Read-only role for dashboard queries ─────────────────────────────────────
-- Run this after 001_schema.sql.
-- In Supabase, execute via the SQL editor as the superuser (postgres role).

-- Create the role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dashboard_readonly') THEN
    CREATE ROLE dashboard_readonly NOLOGIN;
  END IF;
END;
$$;

-- Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO dashboard_readonly;

-- Grant SELECT on operational tables ONLY
GRANT SELECT ON
  sites,
  accounts,
  menu_items,
  orders,
  order_items,
  budget
TO dashboard_readonly;

-- Explicitly deny access to app/auth tables
REVOKE ALL ON session_users    FROM dashboard_readonly;
REVOKE ALL ON saved_views      FROM dashboard_readonly;
REVOKE ALL ON custom_dashboards FROM dashboard_readonly;
REVOKE ALL ON email_digests    FROM dashboard_readonly;
REVOKE ALL ON query_log        FROM dashboard_readonly;

-- Ensure no access to auth, storage, or system schemas
REVOKE ALL ON SCHEMA auth     FROM dashboard_readonly;
REVOKE ALL ON SCHEMA storage  FROM dashboard_readonly;
