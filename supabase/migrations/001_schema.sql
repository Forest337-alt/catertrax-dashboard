-- ─── Core operational tables ────────────────────────────────────────────────

CREATE TABLE sites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  location    TEXT,
  site_type   TEXT        CHECK (site_type IN ('higher_ed','healthcare','corporate','senior_living')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE accounts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          UUID        REFERENCES sites(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  account_type     TEXT        CHECK (account_type IN ('academic_dept','administrative','student_org','external')),
  first_order_date DATE,
  lifecycle_stage  TEXT        CHECK (lifecycle_stage IN ('new','growing','established','at_risk','dormant')),
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE menu_items (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        UUID           REFERENCES sites(id) ON DELETE CASCADE,
  name           TEXT           NOT NULL,
  category       TEXT           CHECK (category IN ('hot_entree','sandwich_platter','breakfast','salad_bowl','beverage','dessert_bakery','appetizer','boxed_meal')),
  base_price     NUMERIC(10,2),
  cost           NUMERIC(10,2),
  margin_pct     NUMERIC(5,2)   GENERATED ALWAYS AS (
                   CASE WHEN base_price > 0 THEN ((base_price - cost) / base_price) * 100 ELSE NULL END
                 ) STORED,
  is_vegetarian  BOOLEAN        DEFAULT false,
  is_vegan       BOOLEAN        DEFAULT false,
  is_gluten_free BOOLEAN        DEFAULT false,
  active         BOOLEAN        DEFAULT true,
  created_at     TIMESTAMPTZ    DEFAULT now()
);

CREATE TABLE orders (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID           REFERENCES sites(id) ON DELETE CASCADE,
  account_id        UUID           REFERENCES accounts(id),
  order_number      TEXT           UNIQUE NOT NULL,
  order_date        DATE           NOT NULL,
  event_date        DATE           NOT NULL,
  event_time        TIME,
  order_type        TEXT           CHECK (order_type IN ('drop_off','pickup','delivery','full_service')),
  channel           TEXT           CHECK (channel IN ('web_portal','mobile_app','phone_email','repeat_template')),
  status            TEXT           CHECK (status IN ('completed','cancelled','modified')),
  guest_count       INT,
  subtotal          NUMERIC(10,2),
  addons_total      NUMERIC(10,2) DEFAULT 0,
  total             NUMERIC(10,2),
  fulfilled_on_time BOOLEAN,
  created_at        TIMESTAMPTZ    DEFAULT now()
);

CREATE TABLE order_items (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID           REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id          UUID           REFERENCES menu_items(id),
  quantity              INT            NOT NULL,
  unit_price            NUMERIC(10,2),
  line_total            NUMERIC(10,2),
  dietary_modifications TEXT[]
);

CREATE TABLE budget (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id               UUID           REFERENCES sites(id) ON DELETE CASCADE,
  period_month          DATE           NOT NULL,   -- first day of month
  budgeted_revenue      NUMERIC(10,2),
  budgeted_food_cost_pct NUMERIC(5,2),
  budgeted_labor_pct    NUMERIC(5,2),
  UNIQUE (site_id, period_month)
);

-- ─── App tables ───────────────────────────────────────────────────────────────

CREATE TABLE session_users (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT        NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE saved_views (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_user_id  UUID        REFERENCES session_users(id) ON DELETE SET NULL,
  name             TEXT        NOT NULL,
  description      TEXT,
  chart_spec       JSONB       NOT NULL,
  sql_query        TEXT        NOT NULL,
  is_suggested     BOOLEAN     DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE custom_dashboards (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_user_id  UUID        REFERENCES session_users(id) ON DELETE SET NULL,
  name             TEXT        NOT NULL,
  description      TEXT,
  layout           JSONB       NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE email_digests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_user_id  UUID        REFERENCES session_users(id) ON DELETE SET NULL,
  dashboard_id     UUID        REFERENCES custom_dashboards(id) ON DELETE CASCADE,
  recipient_email  TEXT        NOT NULL,
  schedule_cron    TEXT        NOT NULL,
  last_sent_at     TIMESTAMPTZ,
  active           BOOLEAN     DEFAULT true
);

CREATE TABLE query_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_user_id  UUID        REFERENCES session_users(id) ON DELETE SET NULL,
  user_prompt      TEXT        NOT NULL,
  generated_sql    TEXT,
  chart_spec       JSONB,
  status           TEXT        CHECK (status IN ('success','validation_failed','execution_failed','timeout')),
  error_message    TEXT,
  row_count        INT,
  execution_ms     INT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_orders_site_event_date  ON orders (site_id, event_date);
CREATE INDEX idx_orders_site_status      ON orders (site_id, status);
CREATE INDEX idx_order_items_order       ON order_items (order_id);
CREATE INDEX idx_order_items_menu        ON order_items (menu_item_id);
CREATE INDEX idx_accounts_site           ON accounts (site_id);
CREATE INDEX idx_saved_views_suggested   ON saved_views (is_suggested) WHERE is_suggested = true;
CREATE INDEX idx_saved_views_user        ON saved_views (session_user_id);
CREATE INDEX idx_query_log_created       ON query_log (created_at DESC);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_saved_views_updated_at
  BEFORE UPDATE ON saved_views
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_custom_dashboards_updated_at
  BEFORE UPDATE ON custom_dashboards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
