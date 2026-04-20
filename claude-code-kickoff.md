# CaterTrax Operator Dashboard Builder — Project Brief

## What we're building

A web application that lets single-site catering operators build custom KPI dashboards through natural-language conversation with an AI assistant. Users land on a gallery of suggested views (pre-built dashboards covering Orders & Revenue, Program Adoption, Menu Mix, and Financials). They can open any suggested view, or chat with the AI to build their own views from scratch. Views can be saved, composed into custom multi-view dashboards, exported to PDF, and scheduled as email digests. Users can click on any chart element to drill down.

Sample data represents "CaterTrax Demo Site #1" — a fictional university dining services catering operation with roughly 18 months of synthetic order history.

## Tech stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Charts**: Recharts
- **Backend**: Supabase (Postgres + Edge Functions + Auth)
- **AI**: Anthropic Claude API (claude-sonnet-4-5 for SQL generation and chat)
- **Hosting**: Google Cloud Run (containerized)
- **Email**: Resend (for scheduled digests)
- **PDF export**: html2canvas + jspdf

## Core architecture decisions

### SQL generation approach
The AI generates actual Postgres SQL against the Supabase schema. This requires:
- A dedicated **read-only Postgres role** (`dashboard_readonly`) with SELECT-only permissions on `public` schema tables, explicitly denied on `auth`, `storage`, and system schemas
- **Query validator** running server-side before execution: blocks `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `GRANT`, `TRUNCATE`, and any reference to `pg_*`, `information_schema`, or `auth.*`
- **Query timeout**: 5 seconds (`statement_timeout`)
- **Row limit**: 10,000 rows max per query (enforced by appending `LIMIT 10000` if not present, and rejecting if the result exceeds)
- **Query logging**: every generated query + user prompt + result status written to a `query_log` table for debugging

### Chart specification layer
Even though SQL is generated, charts still need a spec. The AI returns a JSON object:
```json
{
  "title": "Revenue by Month",
  "description": "Monthly revenue trend for FY26",
  "sql": "SELECT ...",
  "chart_type": "line|bar|stacked_bar|pie|kpi_card|table|heatmap|scatter|area",
  "x_axis": { "field": "month", "label": "Month", "type": "temporal" },
  "y_axis": { "field": "revenue", "label": "Revenue ($)", "type": "currency" },
  "series": [{ "field": "revenue", "label": "Revenue", "color": "#1e40af" }],
  "filters_applied": [{ "field": "date", "value": "last_12_months" }],
  "drill_down_hint": "Clicking a month will filter to that month's orders"
}
```

### Session management
Single shared demo login — no real auth. On first visit, user enters a display name (e.g., "Mike Thompson"). This generates a `session_user_id` (UUID) stored in localStorage. All saved views scope to that session_user_id. A "Switch User" button in the header lets them change identity. Supabase access uses the anon key.

## Project structure

```
catertrax-dashboard/
├── src/
│   ├── components/
│   │   ├── dashboard/           # Chart renderers, KPI cards, tables
│   │   ├── chat/                # Chat panel, message bubbles, input
│   │   ├── gallery/             # Suggested views grid
│   │   ├── saved/               # Saved views, custom dashboards
│   │   ├── common/              # Buttons, modals, layout
│   │   └── export/              # PDF export, email digest config
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client
│   │   ├── claude.ts            # Claude API wrapper
│   │   ├── sqlValidator.ts      # SQL safety validator
│   │   ├── chartSpec.ts         # Chart spec types + renderer
│   │   └── session.ts           # Session user management
│   ├── prompts/
│   │   ├── system.ts            # Main system prompt with schema
│   │   └── examples.ts          # Few-shot query examples
│   ├── pages/
│   │   ├── Gallery.tsx          # Landing page with suggested views
│   │   ├── ViewBuilder.tsx      # Single view + chat
│   │   ├── Dashboard.tsx        # Multi-view composed dashboard
│   │   └── SavedViews.tsx       # User's saved views library
│   └── types/
├── supabase/
│   ├── migrations/              # Schema migrations
│   ├── seed/                    # Synthetic data generation
│   └── functions/               # Edge functions (email digests, SQL execution)
├── Dockerfile
├── cloudbuild.yaml
└── README.md
```

## Database schema

```sql
-- Core operational tables
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  site_type TEXT, -- 'higher_ed', 'healthcare', 'corporate', 'senior_living'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id),
  name TEXT NOT NULL,
  account_type TEXT, -- 'academic_dept', 'administrative', 'student_org', 'external'
  first_order_date DATE,
  lifecycle_stage TEXT, -- 'new', 'growing', 'established', 'at_risk', 'dormant'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id),
  name TEXT NOT NULL,
  category TEXT, -- 'hot_entree', 'sandwich_platter', 'breakfast', 'salad_bowl', etc.
  base_price NUMERIC(10,2),
  cost NUMERIC(10,2),
  margin_pct NUMERIC(5,2) GENERATED ALWAYS AS (((base_price - cost) / NULLIF(base_price,0)) * 100) STORED,
  is_vegetarian BOOLEAN DEFAULT false,
  is_vegan BOOLEAN DEFAULT false,
  is_gluten_free BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id),
  account_id UUID REFERENCES accounts(id),
  order_number TEXT UNIQUE NOT NULL,
  order_date DATE NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  order_type TEXT, -- 'drop_off', 'pickup', 'delivery', 'full_service'
  channel TEXT, -- 'web_portal', 'mobile_app', 'phone_email', 'repeat_template'
  status TEXT, -- 'completed', 'cancelled', 'modified'
  guest_count INT,
  subtotal NUMERIC(10,2),
  addons_total NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2),
  fulfilled_on_time BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  quantity INT NOT NULL,
  unit_price NUMERIC(10,2),
  line_total NUMERIC(10,2),
  dietary_modifications TEXT[]
);

CREATE TABLE budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id),
  period_month DATE NOT NULL, -- first day of the month
  budgeted_revenue NUMERIC(10,2),
  budgeted_food_cost_pct NUMERIC(5,2),
  budgeted_labor_pct NUMERIC(5,2),
  UNIQUE(site_id, period_month)
);

-- App tables (separate from analytical data)
CREATE TABLE session_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_user_id UUID REFERENCES session_users(id),
  name TEXT NOT NULL,
  description TEXT,
  chart_spec JSONB NOT NULL,
  sql_query TEXT NOT NULL,
  is_suggested BOOLEAN DEFAULT false, -- true for the pre-built views
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE custom_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_user_id UUID REFERENCES session_users(id),
  name TEXT NOT NULL,
  description TEXT,
  layout JSONB NOT NULL, -- array of { view_id, position: {x,y,w,h} }
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE email_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_user_id UUID REFERENCES session_users(id),
  dashboard_id UUID REFERENCES custom_dashboards(id),
  recipient_email TEXT NOT NULL,
  schedule_cron TEXT NOT NULL, -- e.g., '0 8 * * 1' for Mondays 8am
  last_sent_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true
);

CREATE TABLE query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_user_id UUID REFERENCES session_users(id),
  user_prompt TEXT NOT NULL,
  generated_sql TEXT,
  chart_spec JSONB,
  status TEXT, -- 'success', 'validation_failed', 'execution_failed', 'timeout'
  error_message TEXT,
  row_count INT,
  execution_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Read-only role
CREATE ROLE dashboard_readonly NOLOGIN;
GRANT USAGE ON SCHEMA public TO dashboard_readonly;
GRANT SELECT ON sites, accounts, menu_items, orders, order_items, budget TO dashboard_readonly;
```

## Synthetic data requirements

Generate data for CaterTrax Demo Site #1 (higher ed). Characteristics:
- **~18 months of order history** (from November 2024 through April 2026)
- **~84 accounts** with realistic distribution: 40% academic departments, 25% administrative offices, 20% student orgs, 15% external/misc
- **~64 active menu items** across 8 categories matching the dashboard mockups
- **~1,800 orders total** with realistic seasonality: summer dip (Jun-Aug at ~60% of peak), ramp in Sep-Oct, December holiday lull, spring peak Mar-Apr
- **~9,000 order line items**
- **Day-of-week skew**: Tue-Thu are peak, weekends are low (especially Sunday)
- **Order type mix**: ~42% drop-off, ~28% full-service, ~18% pickup, ~12% delivery
- **Channel mix**: ~52% web portal, ~24% mobile, ~16% phone/email, ~8% repeat template
- **Account growth**: new accounts appearing over time, some going dormant
- **Top account concentration**: top 10 accounts should generate ~35% of revenue
- **Budget records**: monthly budget targets that trend upward slightly year-over-year

Write a Node.js seed script using `@faker-js/faker` and a deterministic seed so data is reproducible.

## System prompt for Claude (SQL generation)

```
You are an analytical assistant helping single-site catering operators at CaterTrax build custom dashboard views. You generate Postgres SQL queries against the operational database and specify how results should be visualized.

## Database Schema

[Full schema included here — all tables with columns, types, relationships]

## Enumeration values

order_type: 'drop_off', 'pickup', 'delivery', 'full_service'
channel: 'web_portal', 'mobile_app', 'phone_email', 'repeat_template'
status: 'completed', 'cancelled', 'modified'
lifecycle_stage: 'new', 'growing', 'established', 'at_risk', 'dormant'
menu category: 'hot_entree', 'sandwich_platter', 'breakfast', 'salad_bowl', 'beverage', 'dessert_bakery', 'appetizer', 'boxed_meal'

## SQL constraints — STRICTLY ENFORCED

- SELECT statements ONLY. No INSERT, UPDATE, DELETE, DDL, or function creation.
- Include LIMIT 10000 or smaller in every query.
- Reference only: sites, accounts, menu_items, orders, order_items, budget.
- Never reference auth.*, storage.*, pg_*, or information_schema.
- Always filter by site_id using the provided demo site UUID (passed in user message).
- Completed orders only unless user explicitly asks about cancellations: WHERE status = 'completed'
- Use named CTEs for readability when queries have multiple steps.

## Chart type selection guidance

- Time series → 'line' or 'area'
- Categorical comparison → 'bar'
- Part-to-whole → 'pie' (only when ≤6 categories) or 'stacked_bar'
- Single metric → 'kpi_card'
- Raw records or ranked lists → 'table'
- Day × time patterns → 'heatmap'
- Two-variable relationship → 'scatter'
- Ambiguous → default to 'bar' or 'table'

## Response format

Respond with ONLY a JSON object, no surrounding text:

{
  "title": "Short descriptive title",
  "description": "1–2 sentence explanation",
  "sql": "SELECT ...",
  "chart_type": "line|bar|stacked_bar|pie|kpi_card|table|heatmap|scatter|area",
  "x_axis": { "field": "column_name", "label": "Display Label", "type": "temporal|categorical|numeric" },
  "y_axis": { "field": "column_name", "label": "Display Label", "type": "currency|numeric|percent" },
  "series": [{ "field": "column_name", "label": "Label", "color": "#hex" }],
  "filters_applied": [{ "field": "field_name", "value": "value_description" }],
  "drill_down_hint": "What happens when user clicks an element",
  "follow_up_suggestions": ["Refinement 1", "Refinement 2", "Refinement 3"]
}

If the user's request is ambiguous, ask a clarifying question instead:
{ "clarifying_question": "Did you mean X or Y?" }
```

## Few-shot examples to include in prompt

Include 5 examples in the system prompt covering:
1. Simple KPI ("what's my total revenue this month")
2. Time series ("revenue trend for the last year")
3. Filtered breakdown ("top 10 accounts by revenue in Q1")
4. Multi-dimensional ("order volume by day of week and daypart")
5. Comparison ("compare this year vs last year by category")

## Build phases

### Phase 1 — Foundation
1. Initialize Vite + React + TypeScript project with Tailwind
2. Set up Supabase project, create migrations, apply schema
3. Write and run seed script to generate Demo Site #1 data
4. Create read-only role and grant permissions
5. Build basic Supabase client wrapper and session management
6. Build a minimal page that renders ONE chart from a hardcoded SQL query against real data
7. Verify query validator blocks unsafe queries (write test cases)

Deliverable: `npm run dev` shows a working chart pulling live data from Supabase.

### Phase 2 — Suggested views library
1. Build gallery page with cards for each suggested view
2. Port all four dashboard tabs (Orders & Revenue, Adoption, Menu, Financial) as hardcoded `saved_views` records with `is_suggested=true`
3. Build the chart spec renderer that handles all 8 chart types
4. Each suggested view has a chart spec + SQL query stored in DB
5. Build the ViewBuilder page layout: chart canvas + metadata + action buttons

Deliverable: Fully browsable dashboard on real data, no AI yet.

### Phase 3 — Chat + AI view generation
1. Build chat panel UI (right sidebar on ViewBuilder page)
2. Integrate Claude API via Supabase Edge Function (keeps API key server-side)
3. Implement SQL validator as a separate function
4. Implement query executor (validator → execute → return rows)
5. Wire chat: user message → Claude → chart spec JSON → validate SQL → execute → render
6. Add conversation history so follow-ups work ("change to bar chart," "filter to October")
7. Add error handling: malformed JSON, SQL errors, timeouts, validation failures
8. Log everything to query_log

Deliverable: User can type a natural language request and get a working chart.

### Phase 4 — Save/load + power features
1. Add save button on ViewBuilder → writes to saved_views
2. Build SavedViews page (grid of user's saved views)
3. Implement drill-down: make every chart clickable, re-query with added filter
4. Build multi-view dashboard composer (drag-drop grid layout, react-grid-layout)
5. Implement PDF export (html2canvas + jspdf on any view or dashboard)
6. Build email digest config UI + Supabase Edge Function with pg_cron trigger + Resend integration

Deliverable: Full power features working end-to-end.

### Phase 5 — Google Cloud deployment
1. Write Dockerfile (multi-stage: node build → nginx serve)
2. Write cloudbuild.yaml for Cloud Build
3. Deploy to Cloud Run with appropriate memory/CPU
4. Configure custom domain with Cloud Run domain mapping
5. Set up environment variables via Secret Manager (Supabase URL, anon key, Claude API key, Resend key)
6. Configure Cloud Run to allow unauthenticated invocations (for demo access)
7. Set up Cloud Logging for query_log monitoring

Deliverable: Live URL accessible to Mike's team.

## Important conventions

- **Colors**: use the palette from the mockups — primary #1e40af, secondary #059669, accent #7c3aed, warning #d97706, danger #dc2626. Store in Tailwind config.
- **Typography**: system sans-serif stack, same as mockups
- **Formatting**: currency as `$1,234`, percentages as `42.1%`, dates as `Apr 19, 2026`
- **Empty states**: every chart should handle 0-row responses gracefully with a "No data matches your query" message
- **Loading states**: skeleton loaders on charts during query execution
- **Mobile**: responsive but desktop-first (this is a business tool)

## Success criteria for the prototype

1. A new user can land on the app, pick their name, and immediately browse four rich suggested views on real synthetic data.
2. They can open any view, ask "change this to show only the Provost's office," and get a valid refined chart within 5 seconds.
3. They can save that view with a custom name and find it again in their library.
4. They can compose 3–4 saved views into a single dashboard and drill down by clicking chart elements.
5. They can export any view or dashboard to PDF.
6. They can schedule a weekly email digest of a dashboard.
7. All of this runs on Cloud Run against live Supabase data.

## Getting started

Start with Phase 1. After completing each phase, commit, push, and describe what was built before proceeding. Ask clarifying questions whenever a design decision isn't fully specified here — especially around UX patterns where there's more than one reasonable option.

Codebase conventions:
- Component files: PascalCase (`ChartRenderer.tsx`)
- Utility files: camelCase (`sqlValidator.ts`)
- TypeScript strict mode on
- Format with Prettier (default config)
- Lint with ESLint (react + typescript recommended)

Let's build.
