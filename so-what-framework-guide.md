# "So What?" Insights Framework — Build Guide

## Purpose

This guide walks through the framework for the CaterTrax insights engine and gives you one complete, working end-to-end example — the Revenue Pace Anomaly insight — that you can implement and test against your seeded Supabase data before scaling the pattern to other insight types.

---

## Framework overview

### The four-part insight structure

Every insight, regardless of whether it's rule-based or AI-generated, conforms to the same shape:

| Element | Purpose | Example |
|---|---|---|
| **Observation** | What the data factually shows. No interpretation. | "April revenue through day 19 is $31,200 vs. typical pace of $40,000 by this date." |
| **Interpretation** | Why it matters. Connects the observation to the operator's job. | "Two top-10 accounts haven't placed their typical April orders, accounting for ~90% of the gap." |
| **Recommendation** | A specific, achievable next action. | "Reach out to Athletics and Provost before month-end. A single $4–5k order from each would recover budget." |
| **Evidence** | The underlying numbers supporting the claim, displayed as labeled key-value pairs. | `{ "April revenue to date": "$31,200", "Budget": "$54,000", ... }` |

This structure matters because it builds trust through transparency. Operators can audit any insight by reading the evidence. If the numbers don't match what they know from the ground, they'll dismiss it — and that feedback signal tells the system to adjust.

### The three generation tiers

**Tier 1 — Rule-based (deterministic).** Pure SQL + threshold logic. No AI involved. Fast, predictable, debuggable. Examples: revenue pace anomaly, food cost drift, dormant accounts, fulfillment quality drops. These insights are right 95%+ of the time because they're just asking "did this metric cross this threshold?"

**Tier 2 — AI-interpreted.** Rule-based data gathering feeds into Claude, which generates the natural-language observation/interpretation/recommendation text. The underlying facts are deterministic; the narrative is AI-generated. This gives you consistent reliability with more human-readable output. Most "AI-powered" dashboard features in market today are actually Tier 2.

**Tier 3 — AI-discovered.** Claude analyzes raw data (or summary statistics) and surfaces patterns the operator didn't ask about. Higher value, higher risk. Requires careful prompt engineering and validation. Save for later phases.

**Start with Tier 1 exclusively.** Prove the UX, the data plumbing, the feedback loop, and the evidence display — all with deterministic insights. Once that's solid and operators trust the panel, introduce Tier 2. Tier 3 comes last and only after the first two are well-tuned.

### The generation cycle

Insights run on a schedule, not on-demand. For the prototype, nightly is appropriate. The cycle:

1. Scheduled trigger fires (Supabase `pg_cron` at 2am daily)
2. Edge Function loops through each registered insight generator
3. Each generator runs its SQL, evaluates thresholds, and decides whether to emit an insight
4. Emitted insights are written to the `insights` table with `active=true` and an `expires_at` timestamp
5. When operators load the panel, the UI queries active, non-expired, non-dismissed insights
6. Old insights auto-expire (typically after 7 days) unless the condition still triggers — in which case a new insight is emitted

The "don't emit if one is already active for this insight_type" rule prevents duplicate spam. The "auto-expire after 7 days" rule keeps the panel from accumulating stale items if the generator stops firing.

### The feedback loop

When an operator acts on an insight, the action writes to `insight_feedback`:

- **Accepted** (clicked the action button): strongest positive signal. Prioritize this insight type for this user in future generations.
- **Saved**: moderate positive signal. They want to revisit it, but haven't acted yet.
- **Snoozed**: neutral. Suppress for N days, then re-surface if still valid.
- **Dismissed**: negative signal. De-prioritize this insight type for this user; after 3 dismissals of the same type, suppress it entirely until conditions materially change.

Over time, this creates a per-operator personalization layer without any explicit configuration.

---

## Architecture

### File structure for the insights engine

```
supabase/functions/
├── generate-insights/           # Main orchestrator, runs on cron
│   └── index.ts
├── _shared/
│   ├── insightTypes.ts          # TypeScript types for insights
│   ├── insightWriter.ts         # Helper to write insights to DB
│   └── evidenceBuilder.ts       # Helper to format evidence
└── insights/
    ├── revenuePaceAnomaly.ts    # One file per insight type
    ├── foodCostDrift.ts
    ├── dormantAccountRisk.ts
    └── ...

src/components/insights/
├── SoWhatButton.tsx             # Floating button with count badge
├── SoWhatPanel.tsx              # Side panel container
├── InsightCard.tsx              # Single insight card (collapsible)
├── EvidenceGrid.tsx             # The key-value evidence display
└── InsightActions.tsx           # Accept/Save/Snooze/Dismiss buttons
```

### The insight generator interface

Every generator exports the same shape. This uniformity is what makes the system scalable — to add a new insight type, you write one file conforming to this contract.

```typescript
// supabase/functions/_shared/insightTypes.ts

export type InsightPriority = "high" | "medium" | "low";
export type InsightConfidence = "High" | "Medium" | "Low";

export interface GeneratedInsight {
  insight_type: string;
  priority: InsightPriority;
  confidence: InsightConfidence;
  category: string;
  headline: string;
  observation: string;
  interpretation: string;
  recommendation: string;
  evidence: Array<{ label: string; value: string }>;
  action_label: string;
  expires_at: Date;
}

export interface InsightGenerator {
  // Unique identifier for this generator
  type: string;
  // Human-readable description for logging
  description: string;
  // Called by the orchestrator. Returns 0 or more insights.
  generate(ctx: GeneratorContext): Promise<GeneratedInsight[]>;
}

export interface GeneratorContext {
  supabase: SupabaseClient;        // Service-role client
  siteId: string;                  // Which site to analyze
  now: Date;                       // Injected for testability
}
```

### The orchestrator

```typescript
// supabase/functions/generate-insights/index.ts

import { createClient } from "@supabase/supabase-js";
import { revenuePaceAnomaly } from "../insights/revenuePaceAnomaly.ts";
import { foodCostDrift } from "../insights/foodCostDrift.ts";
import { dormantAccountRisk } from "../insights/dormantAccountRisk.ts";

const GENERATORS = [
  revenuePaceAnomaly,
  foodCostDrift,
  dormantAccountRisk,
];

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch all active sites
  const { data: sites } = await supabase.from("sites").select("id");
  if (!sites) return new Response("No sites", { status: 500 });

  const results = {
    sites_processed: 0,
    generators_run: 0,
    insights_emitted: 0,
    errors: [] as string[],
  };

  for (const site of sites) {
    results.sites_processed++;

    for (const generator of GENERATORS) {
      results.generators_run++;

      try {
        // Check for an existing active insight of this type for this site
        const { data: existing } = await supabase
          .from("insights")
          .select("id")
          .eq("site_id", site.id)
          .eq("insight_type", generator.type)
          .eq("active", true)
          .gt("expires_at", new Date().toISOString())
          .limit(1);

        if (existing && existing.length > 0) {
          // Don't generate duplicates — existing insight is still live
          continue;
        }

        // Run the generator
        const insights = await generator.generate({
          supabase,
          siteId: site.id,
          now: new Date(),
        });

        // Write each insight
        for (const insight of insights) {
          await supabase.from("insights").insert({
            site_id: site.id,
            ...insight,
            evidence: insight.evidence, // JSONB column
            expires_at: insight.expires_at.toISOString(),
            active: true,
          });
          results.insights_emitted++;
        }
      } catch (e) {
        results.errors.push(`${generator.type} on ${site.id}: ${e.message}`);
      }
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
```

### Cron trigger

```sql
-- Run the generate-insights function every day at 2am UTC
SELECT cron.schedule(
  'generate-insights-nightly',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<your-project>.supabase.co/functions/v1/generate-insights',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    )
  );
  $$
);

-- Also run a cleanup job that marks expired insights inactive
SELECT cron.schedule(
  'expire-insights',
  '0 3 * * *',
  $$ UPDATE insights SET active = false WHERE expires_at < now() AND active = true; $$
);
```

---

## Complete example: Revenue Pace Anomaly

This is the highest-value insight to build first because it's the one operators will check daily during the month. It answers "am I on pace to hit my budget?" — and if not, "what's driving the gap?"

### The logic

1. Determine what "typical pace" looks like for the current month based on historical patterns.
2. Compare month-to-date actual revenue against typical pace at the same day-of-month.
3. If actual is >15% below typical pace, emit a high-priority insight.
4. Identify which top-10 accounts haven't placed their typical monthly orders yet, and quantify the gap they represent.
5. Calculate the projected month-end revenue at current pace.

### The calculation approach

The nuance here: "typical pace" isn't just dividing the monthly budget by days in the month. Catering revenue is lumpy — some days have big events, others have none. A better baseline is looking at the average cumulative revenue curve by day-of-month over the prior 12 months.

For the prototype, use a simpler approximation that's still defensible: compare month-to-date revenue against the same day-of-month average from the prior 3 same-named months (e.g., for April Day 19, average the cumulative Day-19 revenue from prior Aprils if available, otherwise prior 3 months). This is the "good enough" heuristic that doesn't require a forecasting model.

### The implementation

```typescript
// supabase/functions/insights/revenuePaceAnomaly.ts

import type { InsightGenerator, GeneratedInsight, GeneratorContext } from "../_shared/insightTypes.ts";

export const revenuePaceAnomaly: InsightGenerator = {
  type: "revenue_pace_anomaly",
  description: "Detects when month-to-date revenue is significantly behind typical pace",

  async generate(ctx: GeneratorContext): Promise<GeneratedInsight[]> {
    const { supabase, siteId, now } = ctx;

    // Compute key dates
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const dayOfMonth = now.getDate();
    const daysInMonth = currentMonthEnd.getDate();

    // Step 1: Month-to-date actual
    const { data: mtdData } = await supabase.rpc("run_readonly_query", {
      sql: `
        SELECT COALESCE(SUM(total), 0) AS mtd_revenue
        FROM orders
        WHERE site_id = $1
          AND status = 'completed'
          AND order_date >= $2
          AND order_date <= $3
      `,
      params: [siteId, currentMonthStart.toISOString().slice(0, 10), now.toISOString().slice(0, 10)],
    });

    const mtdRevenue = Number(mtdData?.[0]?.mtd_revenue ?? 0);

    // Step 2: Typical pace — cumulative revenue through same day-of-month over prior 3 months
    const { data: paceData } = await supabase.rpc("run_readonly_query", {
      sql: `
        WITH prior_months AS (
          SELECT
            date_trunc('month', order_date)::DATE AS month_start,
            SUM(CASE WHEN EXTRACT(DAY FROM order_date) <= $2 THEN total ELSE 0 END) AS cumulative_to_day,
            SUM(total) AS full_month
          FROM orders
          WHERE site_id = $1
            AND status = 'completed'
            AND order_date >= $3
            AND order_date < $4
          GROUP BY 1
          ORDER BY 1 DESC
          LIMIT 3
        )
        SELECT
          AVG(cumulative_to_day) AS avg_cumulative_to_day,
          AVG(full_month) AS avg_full_month
        FROM prior_months
      `,
      params: [
        siteId,
        dayOfMonth,
        new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10),
        currentMonthStart.toISOString().slice(0, 10),
      ],
    });

    const typicalCumulative = Number(paceData?.[0]?.avg_cumulative_to_day ?? 0);
    const typicalFullMonth = Number(paceData?.[0]?.avg_full_month ?? 0);

    // If we don't have a baseline, skip
    if (typicalCumulative === 0) return [];

    // Step 3: Evaluate the gap
    const paceGapPct = ((mtdRevenue - typicalCumulative) / typicalCumulative) * 100;
    const THRESHOLD = -15; // 15% below typical

    if (paceGapPct >= THRESHOLD) return []; // Not an anomaly — we're tracking fine or ahead

    // Step 4: Identify top accounts not yet ordering this month
    const { data: laggingAccounts } = await supabase.rpc("run_readonly_query", {
      sql: `
        WITH top_accounts AS (
          SELECT account_id, SUM(total) AS last_quarter_rev
          FROM orders
          WHERE site_id = $1
            AND status = 'completed'
            AND order_date >= $2
            AND order_date < $3
          GROUP BY account_id
          ORDER BY last_quarter_rev DESC
          LIMIT 10
        ),
        mtd_accounts AS (
          SELECT DISTINCT account_id
          FROM orders
          WHERE site_id = $1
            AND status = 'completed'
            AND order_date >= $4
        ),
        avg_monthly AS (
          SELECT o.account_id, AVG(monthly.rev) AS avg_monthly_rev
          FROM orders o
          JOIN (
            SELECT account_id, date_trunc('month', order_date) AS m, SUM(total) AS rev
            FROM orders
            WHERE site_id = $1 AND status = 'completed' AND order_date >= $2 AND order_date < $4
            GROUP BY 1, 2
          ) monthly ON monthly.account_id = o.account_id
          WHERE o.site_id = $1
          GROUP BY o.account_id
        )
        SELECT a.name, am.avg_monthly_rev
        FROM top_accounts ta
        JOIN accounts a ON a.id = ta.account_id
        LEFT JOIN avg_monthly am ON am.account_id = ta.account_id
        WHERE ta.account_id NOT IN (SELECT account_id FROM mtd_accounts)
        ORDER BY am.avg_monthly_rev DESC NULLS LAST
        LIMIT 3
      `,
      params: [
        siteId,
        new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10),
        currentMonthStart.toISOString().slice(0, 10),
        currentMonthStart.toISOString().slice(0, 10),
      ],
    });

    // Step 5: Project month-end at current pace
    const pacingFactor = mtdRevenue / typicalCumulative; // e.g., 0.78 means 78% of typical
    const projectedMonthEnd = typicalFullMonth * pacingFactor;

    // Step 6: Get budget for this month if available
    const { data: budgetData } = await supabase
      .from("budget")
      .select("budgeted_revenue")
      .eq("site_id", siteId)
      .eq("period_month", currentMonthStart.toISOString().slice(0, 10))
      .maybeSingle();

    const budget = Number(budgetData?.budgeted_revenue ?? 0);

    // Step 7: Build the insight
    const monthName = now.toLocaleString("en-US", { month: "long" });
    const laggingNames = (laggingAccounts ?? []).map((a: any) => a.name);
    const laggingNamesStr = laggingNames.length > 0
      ? laggingNames.slice(0, 2).join(" and ")
      : "several typical top accounts";
    const laggingLifetimeGap = (laggingAccounts ?? [])
      .reduce((sum: number, a: any) => sum + Number(a.avg_monthly_rev ?? 0), 0);

    const priority = paceGapPct < -30 ? "high" : paceGapPct < -20 ? "medium" : "low";

    const observation = `${monthName} revenue through day ${dayOfMonth} is $${mtdRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} vs. typical pace of $${typicalCumulative.toLocaleString(undefined, { maximumFractionDigits: 0 })} by this date — a ${Math.abs(paceGapPct).toFixed(1)}% shortfall. At current pace, ${monthName} will close near $${projectedMonthEnd.toLocaleString(undefined, { maximumFractionDigits: 0 })}${budget > 0 ? ` vs. budget of $${budget.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ""}.`;

    const interpretation = laggingNames.length > 0
      ? `${laggingNames.length} of your top 10 accounts (${laggingNamesStr}${laggingNames.length > 2 ? ", and one other" : ""}) haven't placed their typical ${monthName} orders yet. Combined, they average $${laggingLifetimeGap.toLocaleString(undefined, { maximumFractionDigits: 0 })}/month — which accounts for much of the gap vs. typical pace.`
      : `The shortfall isn't concentrated in a few accounts — it's broad-based, which suggests a calendar-driven effect (holidays, academic schedule, etc.) rather than account-specific risk.`;

    const recommendation = laggingNames.length > 0
      ? `Reach out to ${laggingNamesStr} before month-end to confirm their ordering plans. If they're planning standard activity but have delayed, surface any upcoming events. A single order of typical size from each would recover most of the gap.`
      : `Review upcoming events and known seasonal factors for ${monthName}. If the pace doesn't recover in the final ${daysInMonth - dayOfMonth} days, consider promotional outreach to mid-tier accounts.`;

    const evidence = [
      { label: `${monthName} revenue to date`, value: `$${mtdRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
      { label: "Typical pace by this date", value: `$${typicalCumulative.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
      { label: "Gap vs. typical", value: `${paceGapPct.toFixed(1)}%` },
      { label: "Projected month-end", value: `$${projectedMonthEnd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
    ];

    if (budget > 0) {
      evidence.push({ label: `${monthName} budget`, value: `$${budget.toLocaleString(undefined, { maximumFractionDigits: 0 })}` });
    }

    if (laggingAccounts && laggingAccounts.length > 0) {
      evidence.push({ label: "Top accounts not yet ordering", value: String(laggingAccounts.length) });
    }

    // Expires at end of month, since the insight becomes moot after that
    const expiresAt = new Date(currentMonthEnd);
    expiresAt.setHours(23, 59, 59);

    return [{
      insight_type: "revenue_pace_anomaly",
      priority,
      confidence: "High",
      category: "Revenue Pace",
      headline: `${monthName} revenue tracking ${Math.abs(paceGapPct).toFixed(0)}% below typical pace`,
      observation,
      interpretation,
      recommendation,
      evidence,
      action_label: "Draft outreach to lagging accounts",
      expires_at: expiresAt,
    }];
  },
};
```

### The safe SQL helper function

The generator uses a `run_readonly_query` RPC. This is a Postgres function that runs arbitrary read-only SQL using the `dashboard_readonly` role — the same pattern you'll use for the chat-generated SQL in Phase 3. Set it up once and reuse it:

```sql
CREATE OR REPLACE FUNCTION run_readonly_query(sql TEXT, params JSONB DEFAULT '[]')
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET role = 'dashboard_readonly'
AS $$
DECLARE
  result JSONB;
BEGIN
  -- For the prototype, keep this simple. In production, add:
  --   * SQL injection protections (reject if contains DDL keywords)
  --   * Statement timeout (SET LOCAL statement_timeout = '5s')
  --   * Parameter binding (this version uses string interpolation for simplicity)
  FOR result IN EXECUTE sql LOOP
    RETURN NEXT result;
  END LOOP;
END;
$$;
```

Note: the example generator uses `supabase.rpc("run_readonly_query", ...)` for illustrative consistency, but you can also just use `supabase.from("orders").select(...)` with query builders for rule-based generators. The RPC approach is more valuable when you're running complex CTEs that are awkward in the query builder. Pick whichever pattern is cleaner for each generator.

---

## Testing the insight

Once the generator is wired up, test it end-to-end:

**1. Manual trigger the Edge Function:**

```bash
supabase functions invoke generate-insights
```

**2. Query the insights table:**

```sql
SELECT insight_type, priority, headline, observation
FROM insights
WHERE insight_type = 'revenue_pace_anomaly' AND active = true
ORDER BY generated_at DESC;
```

**3. Validate the math manually:**

Pick the MTD revenue number and run the same query against `orders` directly. Compare to what the insight reports. If they don't match, the generator has a bug.

**4. Test the threshold behavior:**

Temporarily raise the threshold to 0% (so it always fires), manually run the generator, and confirm an insight is created. Lower it back to -15% and confirm it doesn't fire on a healthy month.

**5. Test the "don't duplicate" logic:**

Run the generator twice in a row. The second run should skip because an active insight already exists.

---

## Extending the pattern to other insight types

Once the Revenue Pace Anomaly generator is working end-to-end, the same pattern applies to the other Tier 1 insights. Here's the skeleton for each:

### Food Cost Drift

- **Query 1**: trailing 30-day food cost % (sum of `order_items.line_total * (menu_items.cost / menu_items.base_price)` divided by sum of `order_items.line_total`)
- **Query 2**: trailing 12-month baseline food cost %
- **Threshold**: emit when 30-day exceeds 12-month baseline by >1 percentage point
- **Evidence enrichment**: identify top 3 items contributing most to the drift (items whose recent cost ratio diverged most from their historical)
- **Recommendation**: "Review supplier pricing and portion specs on [items]. A 0.5-point improvement would add ~$X in annualized margin."

### Dormant Account Risk

- **Query 1**: accounts with no orders in 75+ days that had 3+ orders in the prior year, ordered by lifetime revenue
- **Threshold**: emit if any such accounts exist (priority based on count and lifetime revenue exposed)
- **Evidence enrichment**: count of dormant accounts, total lifetime revenue exposed, top 3 accounts by lifetime value with last-order date
- **Recommendation**: "Prioritized outreach list below. At your historical win-back rate of ~20%, targeted outreach could recover $X in the next quarter."

### Fulfillment Quality Drift

- **Query 1**: trailing 30-day `fulfilled_on_time` rate
- **Query 2**: trailing 12-month baseline rate
- **Threshold**: emit when 30-day rate drops more than 2 points below baseline
- **Evidence enrichment**: slice by day-of-week and order_type to find the concentration
- **Recommendation**: "Fulfillment slippage often precedes complaints. Review [specific day/order-type] operations."

Each of these follows the same shape: gather data, evaluate against threshold, build observation/interpretation/recommendation, emit insight. The uniformity is what makes the system maintainable.

---

## Success criteria for Phase 6

Before moving to Phase 7 (AI-generated insights), validate:

1. The insights table populates correctly with the 3 Tier 1 generators running nightly
2. The side panel UI displays insights in the expected structure (observation → interpretation → recommendation → evidence)
3. Accept/dismiss/snooze actions persist to `insight_feedback`
4. Dismissed insights don't reappear (until a materially new condition triggers)
5. The expiry logic works — insights auto-expire when the condition no longer applies
6. At least one non-trivial test case runs successfully end-to-end: you should be able to temporarily manipulate the seed data (e.g., delete recent orders to trigger the revenue pace anomaly) and see the insight appear in the panel within one generation cycle

---

## The kickoff prompt for Claude Code

When you're ready to build this, paste this into Claude Code:

> Read PROJECT.md and SO_WHAT_FRAMEWORK.md. Execute Phase 6 from PROJECT.md, using SO_WHAT_FRAMEWORK.md as the detailed build guide for the insights engine. Start by implementing the Revenue Pace Anomaly generator end-to-end — including the database tables, the `run_readonly_query` RPC, the Edge Function orchestrator, and the UI components to display it. Once that single insight type is working against the seeded data, we'll add the other two Tier 1 generators (Food Cost Drift and Dormant Account Risk) using the same pattern.

That gives Claude Code enough to work with without overwhelming it. The pattern-first approach (one insight working end-to-end before adding more) is critical — it surfaces architectural issues early, when they're cheap to fix.
