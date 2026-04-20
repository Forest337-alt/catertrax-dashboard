import type {
  InsightGenerator,
  GeneratedInsight,
  GeneratorContext,
} from '../_shared/insightTypes.ts'
import { runQuery, fmtPct, fmt$ } from '../_shared/insightTypes.ts'

export const foodCostDrift: InsightGenerator = {
  type: 'food_cost_drift',
  description: 'Detects when trailing 30-day food cost % materially exceeds the 12-month baseline',

  async generate(ctx: GeneratorContext): Promise<GeneratedInsight[]> {
    const { supabase, siteId, now } = ctx

    const todayStr       = now.toISOString().slice(0, 10)
    const thirtyDaysAgo  = new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 10)
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      .toISOString().slice(0, 10)

    // Step 1 — Trailing 30-day food cost %
    const [recentRow] = await runQuery<{ food_cost_pct: string; total_revenue: string }>(supabase, `
      SELECT
        CASE WHEN SUM(oi.line_total) > 0
          THEN ROUND(
            SUM(oi.line_total * (mi.cost / NULLIF(mi.base_price, 0))) / SUM(oi.line_total) * 100,
            2
          )
          ELSE NULL
        END AS food_cost_pct,
        SUM(oi.line_total) AS total_revenue
      FROM order_items oi
      JOIN orders o      ON o.id  = oi.order_id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.site_id = '${siteId}'
        AND o.status  = 'completed'
        AND o.order_date >= '${thirtyDaysAgo}'
        AND o.order_date <= '${todayStr}'
        AND mi.cost IS NOT NULL
        AND mi.base_price > 0
    `)

    const recentPct    = recentRow?.food_cost_pct != null ? Number(recentRow.food_cost_pct) : null
    const recentRevenue = Number(recentRow?.total_revenue ?? 0)

    if (recentPct === null || recentRevenue === 0) return [] // No data

    // Step 2 — 12-month baseline food cost %
    const [baselineRow] = await runQuery<{ food_cost_pct: string }>(supabase, `
      SELECT
        CASE WHEN SUM(oi.line_total) > 0
          THEN ROUND(
            SUM(oi.line_total * (mi.cost / NULLIF(mi.base_price, 0))) / SUM(oi.line_total) * 100,
            2
          )
          ELSE NULL
        END AS food_cost_pct
      FROM order_items oi
      JOIN orders o      ON o.id  = oi.order_id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.site_id = '${siteId}'
        AND o.status  = 'completed'
        AND o.order_date >= '${twelveMonthsAgo}'
        AND o.order_date <  '${thirtyDaysAgo}'
        AND mi.cost IS NOT NULL
        AND mi.base_price > 0
    `)

    const baselinePct = baselineRow?.food_cost_pct != null ? Number(baselineRow.food_cost_pct) : null
    if (baselinePct === null) return [] // No baseline

    const drift = recentPct - baselinePct
    const THRESHOLD = 1.0 // 1 percentage point above baseline

    if (drift < THRESHOLD) return [] // Within normal range

    // Step 3 — Top 3 items contributing most to the drift
    const driftItems = await runQuery<{ name: string; category: string; recent_pct: string; baseline_pct: string; line_total: string }>(supabase, `
      WITH recent AS (
        SELECT
          mi.id,
          mi.name,
          mi.category,
          SUM(oi.line_total) AS revenue,
          CASE WHEN SUM(oi.line_total) > 0
            THEN SUM(oi.line_total * (mi.cost / NULLIF(mi.base_price, 0))) / SUM(oi.line_total) * 100
            ELSE NULL
          END AS cost_pct
        FROM order_items oi
        JOIN orders o      ON o.id  = oi.order_id
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE o.site_id = '${siteId}'
          AND o.status  = 'completed'
          AND o.order_date >= '${thirtyDaysAgo}'
          AND mi.cost IS NOT NULL AND mi.base_price > 0
        GROUP BY mi.id, mi.name, mi.category
      ),
      baseline AS (
        SELECT
          mi.id,
          CASE WHEN SUM(oi.line_total) > 0
            THEN SUM(oi.line_total * (mi.cost / NULLIF(mi.base_price, 0))) / SUM(oi.line_total) * 100
            ELSE NULL
          END AS cost_pct
        FROM order_items oi
        JOIN orders o      ON o.id  = oi.order_id
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE o.site_id = '${siteId}'
          AND o.status  = 'completed'
          AND o.order_date >= '${twelveMonthsAgo}'
          AND o.order_date <  '${thirtyDaysAgo}'
          AND mi.cost IS NOT NULL AND mi.base_price > 0
        GROUP BY mi.id
      )
      SELECT
        r.name,
        r.category,
        ROUND(r.cost_pct::NUMERIC, 1)                     AS recent_pct,
        ROUND(COALESCE(b.cost_pct, r.cost_pct)::NUMERIC, 1) AS baseline_pct,
        ROUND(r.revenue::NUMERIC, 0)                      AS line_total
      FROM recent r
      LEFT JOIN baseline b ON b.id = r.id
      WHERE r.cost_pct IS NOT NULL
        AND r.cost_pct > COALESCE(b.cost_pct, r.cost_pct)
      ORDER BY (r.cost_pct - COALESCE(b.cost_pct, r.cost_pct)) * r.revenue DESC
      LIMIT 3
    `)

    // Step 4 — Estimate margin impact
    const annualizedRevenue = recentRevenue * (365 / 30)
    const driftImpact = annualizedRevenue * (drift / 100)

    const itemsStr = driftItems.length > 0
      ? driftItems.map((i) => i.name).join(', ')
      : 'several items'

    const observation = `Trailing 30-day food cost is ${fmtPct(recentPct)} vs. 12-month baseline of ${fmtPct(baselinePct)} — a drift of +${fmtPct(drift, 2)}. At this month's revenue run rate, the drift represents approximately ${fmt$(driftImpact)} in annualized margin impact.`

    const interpretation = driftItems.length > 0
      ? `The drift is concentrated in ${driftItems.length === 1 ? 'one item' : `${driftItems.length} items`}: ${itemsStr}. These items show a higher recent cost ratio than their historical baseline, which may reflect supplier price increases or portion changes.`
      : `The drift appears broad-based across items rather than concentrated in a few, which typically points to a supplier cost increase or seasonal ingredient pricing rather than a specific operational issue.`

    const recommendation = `Review supplier pricing and portion specs on ${itemsStr}. A 0.5-point recovery would add back approximately ${fmt$(annualizedRevenue * 0.005)} in annualized margin.`

    const evidence: Array<{ label: string; value: string }> = [
      { label: '30-day food cost %',   value: fmtPct(recentPct) },
      { label: '12-month baseline',    value: fmtPct(baselinePct) },
      { label: 'Drift',               value: `+${fmtPct(drift, 2)}` },
      { label: 'Est. margin impact',  value: `${fmt$(driftImpact)} annualized` },
    ]
    if (driftItems.length > 0) {
      evidence.push({ label: 'Items contributing most', value: driftItems.map((i) => i.name).join(', ') })
    }

    const priority: 'high' | 'medium' | 'low' =
      drift > 3 ? 'high' : drift > 2 ? 'medium' : 'low'

    const expiresAt = new Date(now.getTime() + 7 * 86400_000)

    return [{
      insight_type: 'food_cost_drift',
      priority,
      confidence: 'High',
      category: 'Food Cost',
      headline: `Food cost drifted +${fmtPct(drift, 1)} above 12-month baseline`,
      observation,
      interpretation,
      recommendation,
      evidence,
      action_label: 'Review supplier pricing',
      expires_at: expiresAt,
    }]
  },
}
