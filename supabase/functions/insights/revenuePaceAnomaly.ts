import type {
  InsightGenerator,
  GeneratedInsight,
  GeneratorContext,
} from '../_shared/insightTypes.ts'
import { runQuery, fmt$, fmtPct } from '../_shared/insightTypes.ts'

export const revenuePaceAnomaly: InsightGenerator = {
  type: 'revenue_pace_anomaly',
  description: 'Detects when month-to-date revenue is significantly behind typical pace',

  async generate(ctx: GeneratorContext): Promise<GeneratedInsight[]> {
    const { supabase, siteId, now } = ctx

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const dayOfMonth = now.getDate()
    const daysInMonth = monthEnd.getDate()

    const monthStartStr = monthStart.toISOString().slice(0, 10)
    const todayStr      = now.toISOString().slice(0, 10)

    // Step 1 — Month-to-date actual revenue
    const [mtdRow] = await runQuery<{ mtd_revenue: string }>(supabase, `
      SELECT COALESCE(SUM(total), 0) AS mtd_revenue
      FROM orders
      WHERE site_id = '${siteId}'
        AND status   = 'completed'
        AND order_date >= '${monthStartStr}'
        AND order_date <= '${todayStr}'
    `)
    const mtdRevenue = Number(mtdRow?.mtd_revenue ?? 0)

    // Step 2 — Typical cumulative pace through same day-of-month across prior 3 months
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      .toISOString().slice(0, 10)

    const [paceRow] = await runQuery<{ avg_cumulative: string; avg_full_month: string }>(supabase, `
      WITH prior_months AS (
        SELECT
          DATE_TRUNC('month', order_date)::DATE AS month_start,
          SUM(CASE WHEN EXTRACT(DAY FROM order_date) <= ${dayOfMonth} THEN total ELSE 0 END) AS cumulative_to_day,
          SUM(total) AS full_month
        FROM orders
        WHERE site_id = '${siteId}'
          AND status = 'completed'
          AND order_date >= '${threeMonthsAgo}'
          AND order_date < '${monthStartStr}'
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 3
      )
      SELECT
        AVG(cumulative_to_day) AS avg_cumulative,
        AVG(full_month)        AS avg_full_month
      FROM prior_months
    `)

    const typicalCumulative = Number(paceRow?.avg_cumulative ?? 0)
    const typicalFullMonth  = Number(paceRow?.avg_full_month ?? 0)

    if (typicalCumulative === 0) return [] // No baseline — skip

    // Step 3 — Evaluate gap
    const paceGapPct = ((mtdRevenue - typicalCumulative) / typicalCumulative) * 100
    const THRESHOLD  = -15 // 15% below typical triggers the insight

    if (paceGapPct >= THRESHOLD) return [] // Tracking fine

    // Step 4 — Identify top accounts not yet ordering this month
    const laggingRows = await runQuery<{ name: string; avg_monthly_rev: string }>(supabase, `
      WITH top_accounts AS (
        SELECT account_id, SUM(total) AS last_quarter_rev
        FROM orders
        WHERE site_id = '${siteId}'
          AND status = 'completed'
          AND order_date >= '${threeMonthsAgo}'
          AND order_date < '${monthStartStr}'
        GROUP BY account_id
        ORDER BY last_quarter_rev DESC
        LIMIT 10
      ),
      mtd_accounts AS (
        SELECT DISTINCT account_id
        FROM orders
        WHERE site_id = '${siteId}'
          AND status = 'completed'
          AND order_date >= '${monthStartStr}'
      ),
      avg_monthly AS (
        SELECT
          account_id,
          AVG(monthly_rev) AS avg_monthly_rev
        FROM (
          SELECT account_id, DATE_TRUNC('month', order_date) AS m, SUM(total) AS monthly_rev
          FROM orders
          WHERE site_id = '${siteId}'
            AND status = 'completed'
            AND order_date >= '${threeMonthsAgo}'
            AND order_date < '${monthStartStr}'
          GROUP BY account_id, m
        ) sub
        GROUP BY account_id
      )
      SELECT a.name, COALESCE(am.avg_monthly_rev, 0) AS avg_monthly_rev
      FROM top_accounts ta
      JOIN accounts a ON a.id = ta.account_id
      LEFT JOIN avg_monthly am ON am.account_id = ta.account_id
      WHERE ta.account_id NOT IN (SELECT account_id FROM mtd_accounts)
      ORDER BY avg_monthly_rev DESC
      LIMIT 3
    `)

    // Step 5 — Budget for the month (if available)
    const { data: budgetData } = await supabase
      .from('budget')
      .select('budgeted_revenue')
      .eq('site_id', siteId)
      .eq('period_month', monthStartStr)
      .maybeSingle()

    const budget = Number(budgetData?.budgeted_revenue ?? 0)

    // Step 6 — Projections and narrative
    const pacingFactor      = mtdRevenue / typicalCumulative
    const projectedMonthEnd = typicalFullMonth * pacingFactor
    const monthName         = now.toLocaleString('en-US', { month: 'long' })

    const laggingNames = laggingRows.map((r) => r.name)
    const laggingGap   = laggingRows.reduce((s, r) => s + Number(r.avg_monthly_rev), 0)

    const namesStr = laggingNames.length === 0
      ? 'several typical top accounts'
      : laggingNames.length === 1
        ? laggingNames[0]
        : laggingNames.slice(0, -1).join(', ') + ' and ' + laggingNames.at(-1)

    const observation = [
      `${monthName} revenue through day ${dayOfMonth} is ${fmt$(mtdRevenue)}`,
      `vs. typical pace of ${fmt$(typicalCumulative)} by this date —`,
      `a ${fmtPct(Math.abs(paceGapPct))} shortfall.`,
      `At current pace, ${monthName} will close near ${fmt$(projectedMonthEnd)}`,
      budget > 0 ? `vs. budget of ${fmt$(budget)}.` : '.',
    ].join(' ')

    const interpretation = laggingRows.length > 0
      ? `${laggingRows.length} of your top 10 accounts (${namesStr}) haven't placed their typical ${monthName} orders yet. Combined, they average ${fmt$(laggingGap)}/month — which accounts for much of the gap vs. typical pace.`
      : `The shortfall isn't concentrated in a few accounts — it appears broad-based, suggesting a calendar or seasonal effect rather than account-specific risk.`

    const recommendation = laggingRows.length > 0
      ? `Reach out to ${namesStr} before month-end to confirm their ordering plans. A single order of typical size from each would recover most of the gap.`
      : `Review upcoming events and known seasonal patterns for ${monthName}. If pace doesn't recover in the final ${daysInMonth - dayOfMonth} days, consider promotional outreach to mid-tier accounts.`

    const evidence: Array<{ label: string; value: string }> = [
      { label: `${monthName} revenue to date`,  value: fmt$(mtdRevenue) },
      { label: 'Typical pace by this date',     value: fmt$(typicalCumulative) },
      { label: 'Gap vs. typical',               value: fmtPct(paceGapPct) },
      { label: 'Projected month-end',           value: fmt$(projectedMonthEnd) },
    ]
    if (budget > 0)
      evidence.push({ label: `${monthName} budget`, value: fmt$(budget) })
    if (laggingRows.length > 0)
      evidence.push({ label: 'Top accounts not yet ordering', value: String(laggingRows.length) })

    const priority: 'high' | 'medium' | 'low' =
      paceGapPct < -30 ? 'high' : paceGapPct < -20 ? 'medium' : 'low'

    const expiresAt = new Date(monthEnd)
    expiresAt.setHours(23, 59, 59)

    return [{
      insight_type: 'revenue_pace_anomaly',
      priority,
      confidence: 'High',
      category: 'Revenue Pace',
      headline: `${monthName} revenue tracking ${Math.abs(paceGapPct).toFixed(0)}% below typical pace`,
      observation,
      interpretation,
      recommendation,
      evidence,
      action_label: 'Draft outreach to lagging accounts',
      expires_at: expiresAt,
    }]
  },
}
