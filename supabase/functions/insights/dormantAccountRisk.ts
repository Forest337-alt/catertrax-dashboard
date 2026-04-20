import type {
  InsightGenerator,
  GeneratedInsight,
  GeneratorContext,
} from '../_shared/insightTypes.ts'
import { runQuery, fmt$ } from '../_shared/insightTypes.ts'

export const dormantAccountRisk: InsightGenerator = {
  type: 'dormant_account_risk',
  description: 'Identifies high-value accounts that have gone silent for 75+ days',

  async generate(ctx: GeneratorContext): Promise<GeneratedInsight[]> {
    const { supabase, siteId, now } = ctx

    const todayStr       = now.toISOString().slice(0, 10)
    const cutoffDate     = new Date(now.getTime() - 75 * 86400_000).toISOString().slice(0, 10)
    const oneYearAgo     = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      .toISOString().slice(0, 10)

    // Accounts with 3+ orders in the prior year, but none in the last 75 days
    const dormantRows = await runQuery<{
      name: string
      last_order_date: string
      prior_year_orders: string
      lifetime_revenue: string
      days_silent: string
    }>(supabase, `
      WITH activity AS (
        SELECT
          account_id,
          COUNT(*) FILTER (WHERE order_date >= '${oneYearAgo}') AS prior_year_orders,
          MAX(order_date) AS last_order_date,
          SUM(total) AS lifetime_revenue
        FROM orders
        WHERE site_id = '${siteId}'
          AND status  = 'completed'
        GROUP BY account_id
      )
      SELECT
        a.name,
        act.last_order_date,
        act.prior_year_orders,
        ROUND(act.lifetime_revenue, 0) AS lifetime_revenue,
        ('${todayStr}'::DATE - act.last_order_date)::INT AS days_silent
      FROM activity act
      JOIN accounts a ON a.id = act.account_id
      WHERE act.prior_year_orders >= 3
        AND act.last_order_date < '${cutoffDate}'
      ORDER BY act.lifetime_revenue DESC
      LIMIT 10
    `)

    if (dormantRows.length === 0) return [] // No dormant accounts

    const totalLifetimeRevenue = dormantRows.reduce(
      (s, r) => s + Number(r.lifetime_revenue), 0
    )
    const top3 = dormantRows.slice(0, 3)
    const top3Names = top3.map((r) => r.name)

    // Priority scales with exposed revenue
    const priority: 'high' | 'medium' | 'low' =
      totalLifetimeRevenue > 50_000 ? 'high' :
      totalLifetimeRevenue > 20_000 ? 'medium' : 'low'

    const count = dormantRows.length
    const namesStr = top3Names.length === 1
      ? top3Names[0]
      : top3Names.slice(0, -1).join(', ') + ' and ' + top3Names.at(-1)

    const longestSilent = dormantRows[0]
    const mostDays = Number(longestSilent.days_silent)

    const observation = `${count} account${count > 1 ? 's' : ''} that ordered ${count > 1 ? 'regularly' : '3+ times'} in the past year ${count > 1 ? 'have' : 'has'} placed no orders in 75+ days. The longest gap is ${mostDays} days (${longestSilent.name}). Combined lifetime revenue: ${fmt$(totalLifetimeRevenue)}.`

    const interpretation = `${count > 1 ? 'These accounts are' : 'This account is'} past the typical re-order window based on historical patterns. High-value accounts that go quiet for 75+ days frequently churn without a proactive touchpoint — especially if a competitor has been in contact.`

    const recommendation = `Prioritize outreach to ${namesStr}${count > 3 ? ` and ${count - 3} other${count - 3 > 1 ? 's' : ''}` : ''}. A brief check-in to understand upcoming event needs — and surfacing any relevant new menu items — has strong recovery rates at this stage.`

    const evidence: Array<{ label: string; value: string }> = [
      { label: 'Dormant accounts',        value: String(count) },
      { label: 'Lifetime revenue at risk', value: fmt$(totalLifetimeRevenue) },
      { label: 'Longest silence',          value: `${mostDays} days` },
      { label: 'Top account',              value: longestSilent.name },
    ]
    if (top3.length > 1) {
      evidence.push({ label: 'Last order (top account)', value: longestSilent.last_order_date })
    }

    const expiresAt = new Date(now.getTime() + 7 * 86400_000)

    return [{
      insight_type: 'dormant_account_risk',
      priority,
      confidence: 'High',
      category: 'Account Health',
      headline: `${count} high-value account${count > 1 ? 's' : ''} silent for 75+ days`,
      observation,
      interpretation,
      recommendation,
      evidence,
      action_label: 'See outreach list',
      expires_at: expiresAt,
    }]
  },
}
