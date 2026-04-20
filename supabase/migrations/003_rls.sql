-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Allow anonymous access for the demo (no real auth).
-- Operational tables are read-only for all.

ALTER TABLE sites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget        ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views   ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_log     ENABLE ROW LEVEL SECURITY;

-- Operational tables: anon can read (demo only)
CREATE POLICY "anon read sites"       ON sites        FOR SELECT USING (true);
CREATE POLICY "anon read accounts"    ON accounts     FOR SELECT USING (true);
CREATE POLICY "anon read menu_items"  ON menu_items   FOR SELECT USING (true);
CREATE POLICY "anon read orders"      ON orders       FOR SELECT USING (true);
CREATE POLICY "anon read order_items" ON order_items  FOR SELECT USING (true);
CREATE POLICY "anon read budget"      ON budget       FOR SELECT USING (true);

-- session_users: anon can insert (create new user) and read all
CREATE POLICY "anon insert session_users" ON session_users FOR INSERT WITH CHECK (true);
CREATE POLICY "anon read session_users"   ON session_users FOR SELECT USING (true);
CREATE POLICY "anon update session_users" ON session_users FOR UPDATE USING (true);

-- saved_views: anon can CRUD
CREATE POLICY "anon read saved_views"   ON saved_views FOR SELECT USING (true);
CREATE POLICY "anon insert saved_views" ON saved_views FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update saved_views" ON saved_views FOR UPDATE USING (true);
CREATE POLICY "anon delete saved_views" ON saved_views FOR DELETE USING (true);

-- custom_dashboards: anon can CRUD
CREATE POLICY "anon read custom_dashboards"   ON custom_dashboards FOR SELECT USING (true);
CREATE POLICY "anon insert custom_dashboards" ON custom_dashboards FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update custom_dashboards" ON custom_dashboards FOR UPDATE USING (true);
CREATE POLICY "anon delete custom_dashboards" ON custom_dashboards FOR DELETE USING (true);

-- email_digests: anon can CRUD
CREATE POLICY "anon read email_digests"   ON email_digests FOR SELECT USING (true);
CREATE POLICY "anon insert email_digests" ON email_digests FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update email_digests" ON email_digests FOR UPDATE USING (true);
CREATE POLICY "anon delete email_digests" ON email_digests FOR DELETE USING (true);

-- query_log: service role writes, anon reads own logs
CREATE POLICY "anon read query_log" ON query_log FOR SELECT USING (true);
CREATE POLICY "anon insert query_log" ON query_log FOR INSERT WITH CHECK (true);
