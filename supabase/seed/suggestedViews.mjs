/**
 * 32 suggested views for the CaterTrax Gallery, organized into 4 tabs.
 *
 * Colors adapted to brand palette:
 *   #1e40af → #234A73  (primary blue)
 *   #6b7280 → #76a4c4  (muted/secondary)
 *   #059669 → #4582A9  (teal → steel blue)
 *   #7c3aed → #5B9EC9  (accent)
 *   #d97706 / #dc2626 kept as-is (semantic warning/cost colors)
 *
 * Exception: Monthly P&L (4.6) keeps #dc2626 food cost and #d97706 labor
 * because they carry semantic meaning (red = expensive, amber = significant cost).
 *
 * Usage: buildSuggestedViews(siteId) → array of 32 insert objects
 */

export function buildSuggestedViews(siteId) {
  const s = siteId // shorthand

  return [

    // ═══════════════════════════════════════════════════════════════════════════
    // TAB 1 — Orders & Revenue
    // ═══════════════════════════════════════════════════════════════════════════

    // 1.1 — Total Revenue (YTD)
    {
      name: 'Total Revenue (YTD)',
      description: 'Year-to-date completed revenue with prior-year comparison.',
      sql_query: `SELECT
  COALESCE(SUM(total), 0) AS ytd_revenue,
  COALESCE(SUM(total) FILTER (WHERE order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
                                AND order_date < date_trunc('year', CURRENT_DATE)), 0) AS prior_ytd_revenue
FROM orders
WHERE site_id = '${s}'
  AND status = 'completed'
  AND order_date >= date_trunc('year', CURRENT_DATE)
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'orders_revenue', position: 1, suggested: true },
        title: 'Total Revenue (YTD)',
        description: 'Year-to-date completed revenue with prior-year comparison.',
        sql: `SELECT
  COALESCE(SUM(total), 0) AS ytd_revenue,
  COALESCE(SUM(total) FILTER (WHERE order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
                                AND order_date < date_trunc('year', CURRENT_DATE)), 0) AS prior_ytd_revenue
FROM orders
WHERE site_id = '${s}'
  AND status = 'completed'
  AND order_date >= date_trunc('year', CURRENT_DATE)
LIMIT 10000`,
        chart_type: 'kpi_card',
        y_axis: { field: 'ytd_revenue', label: 'YTD Revenue', type: 'currency' },
        series: [{ field: 'ytd_revenue', label: 'Revenue', color: '#234A73' }],
        drill_down_hint: 'Clicking shows the revenue trend broken down by month.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 1.2 — Total Orders (YTD)
    {
      name: 'Total Orders (YTD)',
      description: 'Year-to-date order count with prior-year comparison.',
      sql_query: `SELECT
  COUNT(*) AS ytd_orders,
  COUNT(*) FILTER (WHERE order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
                     AND order_date < date_trunc('year', CURRENT_DATE)) AS prior_ytd_orders
FROM orders
WHERE site_id = '${s}'
  AND status = 'completed'
  AND order_date >= date_trunc('year', CURRENT_DATE)
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'orders_revenue', position: 2, suggested: true },
        title: 'Total Orders (YTD)',
        description: 'Year-to-date order count with prior-year comparison.',
        sql: `SELECT
  COUNT(*) AS ytd_orders,
  COUNT(*) FILTER (WHERE order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
                     AND order_date < date_trunc('year', CURRENT_DATE)) AS prior_ytd_orders
FROM orders
WHERE site_id = '${s}'
  AND status = 'completed'
  AND order_date >= date_trunc('year', CURRENT_DATE)
LIMIT 10000`,
        chart_type: 'kpi_card',
        y_axis: { field: 'ytd_orders', label: 'YTD Orders', type: 'numeric' },
        series: [{ field: 'ytd_orders', label: 'Orders', color: '#234A73' }],
        drill_down_hint: 'Clicking shows orders by month.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 1.3 — Average Order Value
    {
      name: 'Average Order Value',
      description: 'YTD average order value with prior-year comparison.',
      sql_query: `SELECT
  COALESCE(AVG(total), 0) AS ytd_aov,
  COALESCE(
    (SELECT AVG(total) FROM orders
     WHERE site_id = '${s}' AND status = 'completed'
       AND order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
       AND order_date < date_trunc('year', CURRENT_DATE)), 0
  ) AS prior_ytd_aov
FROM orders
WHERE site_id = '${s}'
  AND status = 'completed'
  AND order_date >= date_trunc('year', CURRENT_DATE)
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'orders_revenue', position: 3, suggested: true },
        title: 'Average Order Value',
        description: 'YTD average order value with prior-year comparison.',
        sql: `SELECT
  COALESCE(AVG(total), 0) AS ytd_aov,
  COALESCE(
    (SELECT AVG(total) FROM orders
     WHERE site_id = '${s}' AND status = 'completed'
       AND order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
       AND order_date < date_trunc('year', CURRENT_DATE)), 0
  ) AS prior_ytd_aov
FROM orders
WHERE site_id = '${s}'
  AND status = 'completed'
  AND order_date >= date_trunc('year', CURRENT_DATE)
LIMIT 10000`,
        chart_type: 'kpi_card',
        y_axis: { field: 'ytd_aov', label: 'Avg Order Value', type: 'currency' },
        series: [{ field: 'ytd_aov', label: 'AOV', color: '#234A73' }],
        drill_down_hint: 'Clicking shows AOV trend over time.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 1.4 — Fulfillment Rate
    {
      name: 'Fulfillment Rate',
      description: 'Percentage of placed orders successfully completed.',
      sql_query: `SELECT
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0), 1) AS fulfillment_rate,
  ROUND(100.0 *
    COUNT(*) FILTER (WHERE status = 'completed'
                       AND order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
                       AND order_date < date_trunc('year', CURRENT_DATE))
    / NULLIF(
        COUNT(*) FILTER (WHERE order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
                           AND order_date < date_trunc('year', CURRENT_DATE)), 0), 1) AS prior_fulfillment_rate
FROM orders
WHERE site_id = '${s}'
  AND order_date >= date_trunc('year', CURRENT_DATE)
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'orders_revenue', position: 4, suggested: true },
        title: 'Fulfillment Rate',
        description: 'Percentage of placed orders successfully completed.',
        sql: `SELECT
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0), 1) AS fulfillment_rate,
  ROUND(100.0 *
    COUNT(*) FILTER (WHERE status = 'completed'
                       AND order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
                       AND order_date < date_trunc('year', CURRENT_DATE))
    / NULLIF(
        COUNT(*) FILTER (WHERE order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
                           AND order_date < date_trunc('year', CURRENT_DATE)), 0), 1) AS prior_fulfillment_rate
FROM orders
WHERE site_id = '${s}'
  AND order_date >= date_trunc('year', CURRENT_DATE)
LIMIT 10000`,
        chart_type: 'kpi_card',
        y_axis: { field: 'fulfillment_rate', label: 'Fulfillment Rate', type: 'percent' },
        series: [{ field: 'fulfillment_rate', label: 'Rate', color: '#4582A9' }],
        drill_down_hint: 'Clicking shows fulfillment trend and cancellation reasons.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 1.5 — Monthly Revenue Trend (Current vs. Prior Year)
    {
      name: 'Monthly Revenue Trend',
      description: 'Completed revenue by month, current year vs. prior year.',
      sql_query: `WITH months AS (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
    date_trunc('month', CURRENT_DATE),
    INTERVAL '1 month'
  )::DATE AS month_start
),
current_rev AS (
  SELECT date_trunc('month', order_date)::DATE AS month_start, SUM(total) AS revenue
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
    AND order_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
  GROUP BY 1
),
prior_rev AS (
  SELECT (date_trunc('month', order_date) + INTERVAL '12 months')::DATE AS month_start, SUM(total) AS revenue
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '23 months'
    AND order_date < date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
  GROUP BY 1
)
SELECT
  to_char(m.month_start, 'Mon YYYY') AS month,
  COALESCE(c.revenue, 0) AS current_year,
  COALESCE(p.revenue, 0) AS prior_year
FROM months m
LEFT JOIN current_rev c ON c.month_start = m.month_start
LEFT JOIN prior_rev p ON p.month_start = m.month_start
ORDER BY m.month_start
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'orders_revenue', position: 5, suggested: true },
        title: 'Monthly Revenue Trend',
        description: 'Completed revenue by month, current year vs. prior year.',
        sql: `WITH months AS (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
    date_trunc('month', CURRENT_DATE),
    INTERVAL '1 month'
  )::DATE AS month_start
),
current_rev AS (
  SELECT date_trunc('month', order_date)::DATE AS month_start, SUM(total) AS revenue
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
    AND order_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
  GROUP BY 1
),
prior_rev AS (
  SELECT (date_trunc('month', order_date) + INTERVAL '12 months')::DATE AS month_start, SUM(total) AS revenue
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '23 months'
    AND order_date < date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
  GROUP BY 1
)
SELECT
  to_char(m.month_start, 'Mon YYYY') AS month,
  COALESCE(c.revenue, 0) AS current_year,
  COALESCE(p.revenue, 0) AS prior_year
FROM months m
LEFT JOIN current_rev c ON c.month_start = m.month_start
LEFT JOIN prior_rev p ON p.month_start = m.month_start
ORDER BY m.month_start
LIMIT 10000`,
        chart_type: 'line',
        x_axis: { field: 'month', label: 'Month', type: 'temporal' },
        y_axis: { field: 'current_year', label: 'Revenue', type: 'currency' },
        series: [
          { field: 'current_year', label: 'Current Year', color: '#234A73' },
          { field: 'prior_year', label: 'Prior Year', color: '#76a4c4' },
        ],
        drill_down_hint: 'Click a month to see that month\'s orders, categories, and accounts.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 1.6 — Order Volume by Day & Daypart (Heatmap)
    {
      name: 'Order Volume — Day & Daypart',
      description: 'Trailing 90-day order patterns by day of week and time period.',
      sql_query: `SELECT
  CASE EXTRACT(DOW FROM event_date)
    WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon' WHEN 2 THEN 'Tue' WHEN 3 THEN 'Wed'
    WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri' WHEN 6 THEN 'Sat'
  END AS day_of_week,
  CASE
    WHEN event_time >= '06:00' AND event_time < '10:00' THEN 'Breakfast (6-10a)'
    WHEN event_time >= '10:00' AND event_time < '14:00' THEN 'Lunch (10a-2p)'
    WHEN event_time >= '14:00' AND event_time < '17:00' THEN 'Afternoon (2-5p)'
    WHEN event_time >= '17:00' AND event_time < '21:00' THEN 'Dinner (5-9p)'
    ELSE 'Other'
  END AS daypart,
  EXTRACT(DOW FROM event_date) AS dow_sort,
  COUNT(*) AS order_count
FROM orders
WHERE site_id = '${s}'
  AND status = 'completed'
  AND event_date >= CURRENT_DATE - INTERVAL '90 days'
  AND event_time IS NOT NULL
GROUP BY day_of_week, daypart, dow_sort
ORDER BY dow_sort, daypart
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'orders_revenue', position: 6, suggested: true },
        title: 'Order Volume — Day & Daypart',
        description: 'Trailing 90-day order patterns by day of week and time period.',
        sql: `SELECT
  CASE EXTRACT(DOW FROM event_date)
    WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon' WHEN 2 THEN 'Tue' WHEN 3 THEN 'Wed'
    WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri' WHEN 6 THEN 'Sat'
  END AS day_of_week,
  CASE
    WHEN event_time >= '06:00' AND event_time < '10:00' THEN 'Breakfast (6-10a)'
    WHEN event_time >= '10:00' AND event_time < '14:00' THEN 'Lunch (10a-2p)'
    WHEN event_time >= '14:00' AND event_time < '17:00' THEN 'Afternoon (2-5p)'
    WHEN event_time >= '17:00' AND event_time < '21:00' THEN 'Dinner (5-9p)'
    ELSE 'Other'
  END AS daypart,
  EXTRACT(DOW FROM event_date) AS dow_sort,
  COUNT(*) AS order_count
FROM orders
WHERE site_id = '${s}'
  AND status = 'completed'
  AND event_date >= CURRENT_DATE - INTERVAL '90 days'
  AND event_time IS NOT NULL
GROUP BY day_of_week, daypart, dow_sort
ORDER BY dow_sort, daypart
LIMIT 10000`,
        chart_type: 'heatmap',
        x_axis: { field: 'day_of_week', label: 'Day of Week', type: 'categorical' },
        y_axis: { field: 'daypart', label: 'Daypart', type: 'categorical' },
        series: [{ field: 'order_count', label: 'Orders', color: '#234A73' }],
        drill_down_hint: 'Click a cell to see orders for that day/time combination.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 1.7 — Order Type Mix
    {
      name: 'Order Type Mix',
      description: 'YTD distribution of orders by service type.',
      sql_query: `SELECT
  CASE order_type
    WHEN 'drop_off' THEN 'Drop-Off'
    WHEN 'full_service' THEN 'Full-Service'
    WHEN 'pickup' THEN 'Pickup'
    WHEN 'delivery' THEN 'Delivery'
    ELSE order_type
  END AS order_type_label,
  COUNT(*) AS order_count,
  SUM(total) AS revenue,
  ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
FROM orders
WHERE site_id = '${s}'
  AND status = 'completed'
  AND order_date >= date_trunc('year', CURRENT_DATE)
GROUP BY order_type
ORDER BY order_count DESC
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'orders_revenue', position: 7, suggested: true },
        title: 'Order Type Mix',
        description: 'YTD distribution of orders by service type.',
        sql: `SELECT
  CASE order_type
    WHEN 'drop_off' THEN 'Drop-Off'
    WHEN 'full_service' THEN 'Full-Service'
    WHEN 'pickup' THEN 'Pickup'
    WHEN 'delivery' THEN 'Delivery'
    ELSE order_type
  END AS order_type_label,
  COUNT(*) AS order_count,
  SUM(total) AS revenue,
  ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
FROM orders
WHERE site_id = '${s}'
  AND status = 'completed'
  AND order_date >= date_trunc('year', CURRENT_DATE)
GROUP BY order_type
ORDER BY order_count DESC
LIMIT 10000`,
        chart_type: 'pie',
        x_axis: { field: 'order_type_label', label: 'Order Type', type: 'categorical' },
        y_axis: { field: 'order_count', label: 'Orders', type: 'numeric' },
        series: [{ field: 'order_count', label: 'Orders', color: '#234A73' }],
        drill_down_hint: 'Click a slice to filter the tab to that order type.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 1.8 — Top 10 Accounts by Revenue (table)
    {
      name: 'Top 10 Accounts by Revenue',
      description: 'Highest-revenue accounts YTD with order volume, AOV, and year-over-year trend.',
      sql_query: `WITH current_period AS (
  SELECT account_id, COUNT(*) AS orders, SUM(total) AS revenue, AVG(total) AS aov
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('year', CURRENT_DATE)
  GROUP BY account_id
),
prior_period AS (
  SELECT account_id, SUM(total) AS prior_revenue
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
    AND order_date < date_trunc('year', CURRENT_DATE)
  GROUP BY account_id
)
SELECT
  a.name AS account,
  c.orders,
  c.revenue,
  c.aov AS avg_order_value,
  CASE
    WHEN COALESCE(p.prior_revenue, 0) = 0 THEN 'new'
    WHEN c.revenue > p.prior_revenue * 1.05 THEN 'up'
    WHEN c.revenue < p.prior_revenue * 0.95 THEN 'down'
    ELSE 'flat'
  END AS trend
FROM current_period c
JOIN accounts a ON a.id = c.account_id
LEFT JOIN prior_period p ON p.account_id = c.account_id
ORDER BY c.revenue DESC
LIMIT 10`,
      chart_spec: {
        meta: { tab: 'orders_revenue', position: 8, suggested: true },
        title: 'Top 10 Accounts by Revenue',
        description: 'Highest-revenue accounts YTD with order volume, AOV, and year-over-year trend.',
        sql: `WITH current_period AS (
  SELECT account_id, COUNT(*) AS orders, SUM(total) AS revenue, AVG(total) AS aov
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('year', CURRENT_DATE)
  GROUP BY account_id
),
prior_period AS (
  SELECT account_id, SUM(total) AS prior_revenue
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
    AND order_date < date_trunc('year', CURRENT_DATE)
  GROUP BY account_id
)
SELECT
  a.name AS account,
  c.orders,
  c.revenue,
  c.aov AS avg_order_value,
  CASE
    WHEN COALESCE(p.prior_revenue, 0) = 0 THEN 'new'
    WHEN c.revenue > p.prior_revenue * 1.05 THEN 'up'
    WHEN c.revenue < p.prior_revenue * 0.95 THEN 'down'
    ELSE 'flat'
  END AS trend
FROM current_period c
JOIN accounts a ON a.id = c.account_id
LEFT JOIN prior_period p ON p.account_id = c.account_id
ORDER BY c.revenue DESC
LIMIT 10`,
        chart_type: 'table',
        series: [
          { field: 'account', label: 'Account' },
          { field: 'orders', label: 'Orders' },
          { field: 'revenue', label: 'Revenue', type: 'currency' },
          { field: 'avg_order_value', label: 'AOV', type: 'currency' },
          { field: 'trend', label: 'Trend', type: 'trend_indicator' },
        ],
        drill_down_hint: 'Click an account to filter the tab to that account\'s activity.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // TAB 2 — Program Adoption & Growth
    // ═══════════════════════════════════════════════════════════════════════════

    // 2.1 — Active Accounts
    {
      name: 'Active Accounts',
      description: 'Accounts with at least one order in the last 90 days.',
      sql_query: `SELECT
  COUNT(DISTINCT account_id) AS active_accounts,
  (SELECT COUNT(DISTINCT account_id)
   FROM orders
   WHERE site_id = '${s}' AND status = 'completed'
     AND order_date >= CURRENT_DATE - INTERVAL '455 days'
     AND order_date < CURRENT_DATE - INTERVAL '365 days'
  ) AS prior_active_accounts
FROM orders
WHERE site_id = '${s}' AND status = 'completed'
  AND order_date >= CURRENT_DATE - INTERVAL '90 days'
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'adoption_growth', position: 1, suggested: true },
        title: 'Active Accounts',
        description: 'Accounts with at least one order in the last 90 days.',
        sql: `SELECT
  COUNT(DISTINCT account_id) AS active_accounts,
  (SELECT COUNT(DISTINCT account_id)
   FROM orders
   WHERE site_id = '${s}' AND status = 'completed'
     AND order_date >= CURRENT_DATE - INTERVAL '455 days'
     AND order_date < CURRENT_DATE - INTERVAL '365 days'
  ) AS prior_active_accounts
FROM orders
WHERE site_id = '${s}' AND status = 'completed'
  AND order_date >= CURRENT_DATE - INTERVAL '90 days'
LIMIT 10000`,
        chart_type: 'kpi_card',
        y_axis: { field: 'active_accounts', label: 'Active Accounts', type: 'numeric' },
        series: [{ field: 'active_accounts', label: 'Active', color: '#234A73' }],
        drill_down_hint: 'Click to see all active accounts ranked by recency.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 2.2 — New Accounts (YTD)
    {
      name: 'New Accounts (YTD)',
      description: 'Accounts placing their first order this year.',
      sql_query: `SELECT
  COUNT(*) AS new_accounts_ytd,
  (SELECT COUNT(*) FROM accounts
   WHERE site_id = '${s}'
     AND first_order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
     AND first_order_date < date_trunc('year', CURRENT_DATE)
  ) AS prior_new_accounts_ytd
FROM accounts
WHERE site_id = '${s}'
  AND first_order_date >= date_trunc('year', CURRENT_DATE)
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'adoption_growth', position: 2, suggested: true },
        title: 'New Accounts (YTD)',
        description: 'Accounts placing their first order this year.',
        sql: `SELECT
  COUNT(*) AS new_accounts_ytd,
  (SELECT COUNT(*) FROM accounts
   WHERE site_id = '${s}'
     AND first_order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
     AND first_order_date < date_trunc('year', CURRENT_DATE)
  ) AS prior_new_accounts_ytd
FROM accounts
WHERE site_id = '${s}'
  AND first_order_date >= date_trunc('year', CURRENT_DATE)
LIMIT 10000`,
        chart_type: 'kpi_card',
        y_axis: { field: 'new_accounts_ytd', label: 'New Accounts', type: 'numeric' },
        series: [{ field: 'new_accounts_ytd', label: 'New', color: '#4582A9' }],
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 2.3 — Repeat Order Rate
    {
      name: 'Repeat Order Rate',
      description: 'Percentage of active accounts placing more than one order YTD.',
      sql_query: `WITH account_order_counts AS (
  SELECT account_id, COUNT(*) AS orders
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('year', CURRENT_DATE)
  GROUP BY account_id
)
SELECT
  ROUND(100.0 * COUNT(*) FILTER (WHERE orders > 1) / NULLIF(COUNT(*), 0), 1) AS repeat_rate
FROM account_order_counts
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'adoption_growth', position: 3, suggested: true },
        title: 'Repeat Order Rate',
        description: 'Percentage of active accounts placing more than one order YTD.',
        sql: `WITH account_order_counts AS (
  SELECT account_id, COUNT(*) AS orders
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('year', CURRENT_DATE)
  GROUP BY account_id
)
SELECT
  ROUND(100.0 * COUNT(*) FILTER (WHERE orders > 1) / NULLIF(COUNT(*), 0), 1) AS repeat_rate
FROM account_order_counts
LIMIT 10000`,
        chart_type: 'kpi_card',
        y_axis: { field: 'repeat_rate', label: 'Repeat Rate', type: 'percent' },
        series: [{ field: 'repeat_rate', label: 'Rate', color: '#4582A9' }],
        drill_down_hint: 'Click to see one-time vs. repeat account breakdown.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 2.4 — Active Account Growth Trend
    {
      name: 'Active Account Growth Trend',
      description: 'Active account count by month (90-day rolling) with new-account overlay.',
      sql_query: `WITH months AS (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
    date_trunc('month', CURRENT_DATE),
    INTERVAL '1 month'
  )::DATE AS month_start
)
SELECT
  to_char(m.month_start, 'Mon YYYY') AS month,
  (SELECT COUNT(DISTINCT account_id)
   FROM orders
   WHERE site_id = '${s}' AND status = 'completed'
     AND order_date >= m.month_start - INTERVAL '90 days'
     AND order_date < m.month_start + INTERVAL '1 month') AS active_accounts,
  (SELECT COUNT(*) FROM accounts
   WHERE site_id = '${s}'
     AND first_order_date >= m.month_start
     AND first_order_date < m.month_start + INTERVAL '1 month') AS new_accounts
FROM months m
ORDER BY m.month_start
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'adoption_growth', position: 4, suggested: true },
        title: 'Active Account Growth Trend',
        description: 'Active account count by month (90-day rolling) with new-account overlay.',
        sql: `WITH months AS (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
    date_trunc('month', CURRENT_DATE),
    INTERVAL '1 month'
  )::DATE AS month_start
)
SELECT
  to_char(m.month_start, 'Mon YYYY') AS month,
  (SELECT COUNT(DISTINCT account_id)
   FROM orders
   WHERE site_id = '${s}' AND status = 'completed'
     AND order_date >= m.month_start - INTERVAL '90 days'
     AND order_date < m.month_start + INTERVAL '1 month') AS active_accounts,
  (SELECT COUNT(*) FROM accounts
   WHERE site_id = '${s}'
     AND first_order_date >= m.month_start
     AND first_order_date < m.month_start + INTERVAL '1 month') AS new_accounts
FROM months m
ORDER BY m.month_start
LIMIT 10000`,
        chart_type: 'area',
        x_axis: { field: 'month', label: 'Month', type: 'temporal' },
        y_axis: { field: 'active_accounts', label: 'Accounts', type: 'numeric' },
        series: [
          { field: 'active_accounts', label: 'Active Accounts', color: '#234A73' },
          { field: 'new_accounts', label: 'New Accounts', color: '#4582A9' },
        ],
        drill_down_hint: 'Click a month to see accounts that became active or new that month.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 2.5 — Order Frequency Distribution
    {
      name: 'Order Frequency Distribution',
      description: 'Accounts grouped by number of orders placed YTD.',
      sql_query: `WITH account_order_counts AS (
  SELECT account_id, COUNT(*) AS orders
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('year', CURRENT_DATE)
  GROUP BY account_id
),
bucketed AS (
  SELECT
    CASE
      WHEN orders = 1 THEN '1x'
      WHEN orders BETWEEN 2 AND 3 THEN '2-3x'
      WHEN orders BETWEEN 4 AND 6 THEN '4-6x'
      WHEN orders BETWEEN 7 AND 12 THEN '7-12x'
      ELSE '13+x'
    END AS bucket,
    CASE
      WHEN orders = 1 THEN 1
      WHEN orders BETWEEN 2 AND 3 THEN 2
      WHEN orders BETWEEN 4 AND 6 THEN 3
      WHEN orders BETWEEN 7 AND 12 THEN 4
      ELSE 5
    END AS sort_order
  FROM account_order_counts
)
SELECT bucket, COUNT(*) AS accounts, sort_order
FROM bucketed
GROUP BY bucket, sort_order
ORDER BY sort_order
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'adoption_growth', position: 5, suggested: true },
        title: 'Order Frequency Distribution',
        description: 'Accounts grouped by number of orders placed YTD.',
        sql: `WITH account_order_counts AS (
  SELECT account_id, COUNT(*) AS orders
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('year', CURRENT_DATE)
  GROUP BY account_id
),
bucketed AS (
  SELECT
    CASE
      WHEN orders = 1 THEN '1x'
      WHEN orders BETWEEN 2 AND 3 THEN '2-3x'
      WHEN orders BETWEEN 4 AND 6 THEN '4-6x'
      WHEN orders BETWEEN 7 AND 12 THEN '7-12x'
      ELSE '13+x'
    END AS bucket,
    CASE
      WHEN orders = 1 THEN 1
      WHEN orders BETWEEN 2 AND 3 THEN 2
      WHEN orders BETWEEN 4 AND 6 THEN 3
      WHEN orders BETWEEN 7 AND 12 THEN 4
      ELSE 5
    END AS sort_order
  FROM account_order_counts
)
SELECT bucket, COUNT(*) AS accounts, sort_order
FROM bucketed
GROUP BY bucket, sort_order
ORDER BY sort_order
LIMIT 10000`,
        chart_type: 'bar',
        x_axis: { field: 'bucket', label: 'Orders per Year', type: 'categorical' },
        y_axis: { field: 'accounts', label: 'Accounts', type: 'numeric' },
        series: [{ field: 'accounts', label: 'Accounts', color: '#234A73' }],
        drill_down_hint: 'Click a bucket to see accounts in that frequency tier.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 2.6 — Ordering Channel Adoption
    {
      name: 'Ordering Channel Adoption',
      description: 'How customers place orders — digital vs. manual channels.',
      sql_query: `SELECT
  CASE channel
    WHEN 'web_portal' THEN 'Web Portal'
    WHEN 'mobile_app' THEN 'Mobile App'
    WHEN 'phone_email' THEN 'Phone/Email'
    WHEN 'repeat_template' THEN 'Repeat/Template'
    ELSE channel
  END AS channel_label,
  COUNT(*) AS orders,
  ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
FROM orders
WHERE site_id = '${s}' AND status = 'completed'
  AND order_date >= date_trunc('year', CURRENT_DATE)
GROUP BY channel
ORDER BY orders DESC
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'adoption_growth', position: 6, suggested: true },
        title: 'Ordering Channel Adoption',
        description: 'How customers place orders — digital vs. manual channels.',
        sql: `SELECT
  CASE channel
    WHEN 'web_portal' THEN 'Web Portal'
    WHEN 'mobile_app' THEN 'Mobile App'
    WHEN 'phone_email' THEN 'Phone/Email'
    WHEN 'repeat_template' THEN 'Repeat/Template'
    ELSE channel
  END AS channel_label,
  COUNT(*) AS orders,
  ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
FROM orders
WHERE site_id = '${s}' AND status = 'completed'
  AND order_date >= date_trunc('year', CURRENT_DATE)
GROUP BY channel
ORDER BY orders DESC
LIMIT 10000`,
        chart_type: 'bar',
        x_axis: { field: 'channel_label', label: 'Channel', type: 'categorical' },
        y_axis: { field: 'pct', label: 'Share of Orders', type: 'percent' },
        series: [{ field: 'pct', label: '% of Orders', color: '#234A73' }],
        drill_down_hint: 'Click a channel to see its trend over time.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 2.7 — Fastest Growing Accounts
    {
      name: 'Fastest Growing Accounts',
      description: 'Accounts with largest revenue increase in the trailing 90 days vs. the prior 90 days.',
      sql_query: `WITH current_period AS (
  SELECT account_id, COUNT(*) AS current_orders, SUM(total) AS current_rev
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY account_id
),
prior_period AS (
  SELECT account_id, COUNT(*) AS prior_orders, SUM(total) AS prior_rev
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= CURRENT_DATE - INTERVAL '180 days'
    AND order_date < CURRENT_DATE - INTERVAL '90 days'
  GROUP BY account_id
)
SELECT
  a.name AS account,
  COALESCE(p.prior_orders, 0) AS prior_orders,
  c.current_orders,
  COALESCE(p.prior_rev, 0) AS prior_revenue,
  c.current_rev AS current_revenue,
  CASE
    WHEN COALESCE(p.prior_rev, 0) = 0 THEN NULL
    ELSE ROUND(100.0 * (c.current_rev - p.prior_rev) / p.prior_rev, 0)
  END AS growth_pct
FROM current_period c
JOIN accounts a ON a.id = c.account_id
LEFT JOIN prior_period p ON p.account_id = c.account_id
WHERE c.current_rev > COALESCE(p.prior_rev, 0)
ORDER BY
  CASE WHEN COALESCE(p.prior_rev, 0) = 0 THEN c.current_rev
       ELSE (c.current_rev - p.prior_rev) END DESC
LIMIT 10`,
      chart_spec: {
        meta: { tab: 'adoption_growth', position: 7, suggested: true },
        title: 'Fastest Growing Accounts',
        description: 'Accounts with largest revenue increase in the trailing 90 days vs. the prior 90 days.',
        sql: `WITH current_period AS (
  SELECT account_id, COUNT(*) AS current_orders, SUM(total) AS current_rev
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY account_id
),
prior_period AS (
  SELECT account_id, COUNT(*) AS prior_orders, SUM(total) AS prior_rev
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= CURRENT_DATE - INTERVAL '180 days'
    AND order_date < CURRENT_DATE - INTERVAL '90 days'
  GROUP BY account_id
)
SELECT
  a.name AS account,
  COALESCE(p.prior_orders, 0) AS prior_orders,
  c.current_orders,
  COALESCE(p.prior_rev, 0) AS prior_revenue,
  c.current_rev AS current_revenue,
  CASE
    WHEN COALESCE(p.prior_rev, 0) = 0 THEN NULL
    ELSE ROUND(100.0 * (c.current_rev - p.prior_rev) / p.prior_rev, 0)
  END AS growth_pct
FROM current_period c
JOIN accounts a ON a.id = c.account_id
LEFT JOIN prior_period p ON p.account_id = c.account_id
WHERE c.current_rev > COALESCE(p.prior_rev, 0)
ORDER BY
  CASE WHEN COALESCE(p.prior_rev, 0) = 0 THEN c.current_rev
       ELSE (c.current_rev - p.prior_rev) END DESC
LIMIT 10`,
        chart_type: 'table',
        series: [
          { field: 'account', label: 'Account' },
          { field: 'prior_orders', label: 'Prior Orders' },
          { field: 'current_orders', label: 'Current Orders' },
          { field: 'current_revenue', label: 'Current Revenue', type: 'currency' },
          { field: 'growth_pct', label: 'Growth', type: 'percent' },
        ],
        drill_down_hint: 'Click an account to see its full order history.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 2.8 — Dormant Accounts — Win-Back Targets
    {
      name: 'Dormant Account Win-Back Targets',
      description: 'Previously active accounts (3+ orders) with no activity in 90+ days, ranked by lifetime revenue.',
      sql_query: `WITH lifetime AS (
  SELECT
    account_id,
    COUNT(*) AS lifetime_orders,
    SUM(total) AS lifetime_revenue,
    MAX(order_date) AS last_order_date
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
  GROUP BY account_id
)
SELECT
  a.name AS account,
  to_char(l.last_order_date, 'Mon YYYY') AS last_order,
  l.lifetime_orders,
  l.lifetime_revenue
FROM lifetime l
JOIN accounts a ON a.id = l.account_id
WHERE l.last_order_date < CURRENT_DATE - INTERVAL '90 days'
  AND l.lifetime_orders >= 3
ORDER BY l.lifetime_revenue DESC
LIMIT 10`,
      chart_spec: {
        meta: { tab: 'adoption_growth', position: 8, suggested: true },
        title: 'Dormant Account Win-Back Targets',
        description: 'Previously active accounts (3+ orders) with no activity in 90+ days, ranked by lifetime revenue.',
        sql: `WITH lifetime AS (
  SELECT
    account_id,
    COUNT(*) AS lifetime_orders,
    SUM(total) AS lifetime_revenue,
    MAX(order_date) AS last_order_date
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
  GROUP BY account_id
)
SELECT
  a.name AS account,
  to_char(l.last_order_date, 'Mon YYYY') AS last_order,
  l.lifetime_orders,
  l.lifetime_revenue
FROM lifetime l
JOIN accounts a ON a.id = l.account_id
WHERE l.last_order_date < CURRENT_DATE - INTERVAL '90 days'
  AND l.lifetime_orders >= 3
ORDER BY l.lifetime_revenue DESC
LIMIT 10`,
        chart_type: 'table',
        series: [
          { field: 'account', label: 'Account' },
          { field: 'last_order', label: 'Last Order' },
          { field: 'lifetime_orders', label: 'Lifetime Orders' },
          { field: 'lifetime_revenue', label: 'Lifetime Revenue', type: 'currency' },
        ],
        drill_down_hint: 'Click an account to see its full history and last-order details.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // TAB 3 — Menu & Product Mix
    // ═══════════════════════════════════════════════════════════════════════════

    // 3.1 — Active Menu Items
    {
      name: 'Active Menu Items',
      description: 'Total active items in the current catalog.',
      sql_query: `SELECT COUNT(*) AS active_items
FROM menu_items
WHERE site_id = '${s}' AND active = true
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'menu_mix', position: 1, suggested: true },
        title: 'Active Menu Items',
        description: 'Total active items in the current catalog.',
        sql: `SELECT COUNT(*) AS active_items
FROM menu_items
WHERE site_id = '${s}' AND active = true
LIMIT 10000`,
        chart_type: 'kpi_card',
        y_axis: { field: 'active_items', label: 'Active Items', type: 'numeric' },
        series: [{ field: 'active_items', label: 'Items', color: '#234A73' }],
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 3.2 — Top 10 Item Concentration
    {
      name: 'Top 10 Item Concentration',
      description: 'Percentage of revenue generated by the top 10 menu items.',
      sql_query: `WITH item_revenue AS (
  SELECT mi.id, SUM(oi.line_total) AS revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('year', CURRENT_DATE)
  GROUP BY mi.id
),
ranked AS (
  SELECT revenue, ROW_NUMBER() OVER (ORDER BY revenue DESC) AS rnk
  FROM item_revenue
)
SELECT
  ROUND(100.0 * SUM(revenue) FILTER (WHERE rnk <= 10) / NULLIF(SUM(revenue), 0), 1) AS top_10_concentration_pct
FROM ranked
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'menu_mix', position: 2, suggested: true },
        title: 'Top 10 Item Concentration',
        description: 'Percentage of revenue generated by the top 10 menu items.',
        sql: `WITH item_revenue AS (
  SELECT mi.id, SUM(oi.line_total) AS revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('year', CURRENT_DATE)
  GROUP BY mi.id
),
ranked AS (
  SELECT revenue, ROW_NUMBER() OVER (ORDER BY revenue DESC) AS rnk
  FROM item_revenue
)
SELECT
  ROUND(100.0 * SUM(revenue) FILTER (WHERE rnk <= 10) / NULLIF(SUM(revenue), 0), 1) AS top_10_concentration_pct
FROM ranked
LIMIT 10000`,
        chart_type: 'kpi_card',
        y_axis: { field: 'top_10_concentration_pct', label: 'Concentration', type: 'percent' },
        series: [{ field: 'top_10_concentration_pct', label: '%', color: '#5B9EC9' }],
        drill_down_hint: 'Click to see the top 10 items and their revenue contribution.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 3.3 — Average Item Margin
    {
      name: 'Average Item Margin',
      description: 'Revenue-weighted average margin across items sold YTD.',
      sql_query: `SELECT
  ROUND(AVG(mi.margin_pct), 1) AS avg_margin_pct
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN menu_items mi ON mi.id = oi.menu_item_id
WHERE o.site_id = '${s}' AND o.status = 'completed'
  AND o.order_date >= date_trunc('year', CURRENT_DATE)
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'menu_mix', position: 3, suggested: true },
        title: 'Average Item Margin',
        description: 'Revenue-weighted average margin across items sold YTD.',
        sql: `SELECT
  ROUND(AVG(mi.margin_pct), 1) AS avg_margin_pct
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN menu_items mi ON mi.id = oi.menu_item_id
WHERE o.site_id = '${s}' AND o.status = 'completed'
  AND o.order_date >= date_trunc('year', CURRENT_DATE)
LIMIT 10000`,
        chart_type: 'kpi_card',
        y_axis: { field: 'avg_margin_pct', label: 'Avg Margin', type: 'percent' },
        series: [{ field: 'avg_margin_pct', label: '%', color: '#4582A9' }],
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 3.4 — Revenue by Category (table)
    {
      name: 'Revenue by Category',
      description: 'Menu category performance with order count, revenue share, margin, and YoY trend.',
      sql_query: `WITH current_period AS (
  SELECT
    mi.category,
    COUNT(DISTINCT o.id) AS orders,
    SUM(oi.line_total) AS revenue,
    AVG(mi.margin_pct) AS avg_margin
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('year', CURRENT_DATE)
  GROUP BY mi.category
),
prior_period AS (
  SELECT mi.category, SUM(oi.line_total) AS prior_revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
    AND o.order_date < date_trunc('year', CURRENT_DATE)
  GROUP BY mi.category
)
SELECT
  INITCAP(REPLACE(c.category, '_', ' ')) AS category,
  c.orders,
  c.revenue,
  ROUND(100.0 * c.revenue / NULLIF(SUM(c.revenue) OVER (), 0), 1) AS pct_of_total,
  ROUND(c.avg_margin, 1) AS margin_pct,
  CASE
    WHEN COALESCE(p.prior_revenue, 0) = 0 THEN 'new'
    WHEN c.revenue > p.prior_revenue * 1.05 THEN 'up'
    WHEN c.revenue < p.prior_revenue * 0.95 THEN 'down'
    ELSE 'flat'
  END AS trend
FROM current_period c
LEFT JOIN prior_period p ON p.category = c.category
ORDER BY c.revenue DESC
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'menu_mix', position: 4, suggested: true },
        title: 'Revenue by Category',
        description: 'Menu category performance with order count, revenue share, margin, and YoY trend.',
        sql: `WITH current_period AS (
  SELECT
    mi.category,
    COUNT(DISTINCT o.id) AS orders,
    SUM(oi.line_total) AS revenue,
    AVG(mi.margin_pct) AS avg_margin
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('year', CURRENT_DATE)
  GROUP BY mi.category
),
prior_period AS (
  SELECT mi.category, SUM(oi.line_total) AS prior_revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
    AND o.order_date < date_trunc('year', CURRENT_DATE)
  GROUP BY mi.category
)
SELECT
  INITCAP(REPLACE(c.category, '_', ' ')) AS category,
  c.orders,
  c.revenue,
  ROUND(100.0 * c.revenue / NULLIF(SUM(c.revenue) OVER (), 0), 1) AS pct_of_total,
  ROUND(c.avg_margin, 1) AS margin_pct,
  CASE
    WHEN COALESCE(p.prior_revenue, 0) = 0 THEN 'new'
    WHEN c.revenue > p.prior_revenue * 1.05 THEN 'up'
    WHEN c.revenue < p.prior_revenue * 0.95 THEN 'down'
    ELSE 'flat'
  END AS trend
FROM current_period c
LEFT JOIN prior_period p ON p.category = c.category
ORDER BY c.revenue DESC
LIMIT 10000`,
        chart_type: 'table',
        series: [
          { field: 'category', label: 'Category' },
          { field: 'orders', label: 'Orders' },
          { field: 'revenue', label: 'Revenue', type: 'currency' },
          { field: 'pct_of_total', label: '% of Total', type: 'percent' },
          { field: 'margin_pct', label: 'Margin', type: 'percent' },
          { field: 'trend', label: 'Trend', type: 'trend_indicator' },
        ],
        drill_down_hint: 'Click a category to see its top items and recent trend.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 3.5 — Menu Engineering Matrix (scatter)
    {
      name: 'Menu Engineering Matrix',
      description: 'Items plotted by popularity (orders) vs. margin %, sized by revenue. Upper-right quadrant = Stars.',
      sql_query: `SELECT
  mi.name AS item,
  mi.category,
  COUNT(DISTINCT oi.order_id) AS popularity,
  ROUND(AVG(mi.margin_pct), 1) AS margin_pct,
  SUM(oi.line_total) AS revenue
FROM menu_items mi
JOIN order_items oi ON oi.menu_item_id = mi.id
JOIN orders o ON o.id = oi.order_id
WHERE mi.site_id = '${s}'
  AND o.status = 'completed'
  AND o.order_date >= CURRENT_DATE - INTERVAL '12 months'
  AND mi.active = true
GROUP BY mi.id, mi.name, mi.category
HAVING COUNT(DISTINCT oi.order_id) > 0
ORDER BY revenue DESC
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'menu_mix', position: 5, suggested: true },
        title: 'Menu Engineering Matrix',
        description: 'Items plotted by popularity (orders) vs. margin %, sized by revenue. Upper-right quadrant = Stars.',
        sql: `SELECT
  mi.name AS item,
  mi.category,
  COUNT(DISTINCT oi.order_id) AS popularity,
  ROUND(AVG(mi.margin_pct), 1) AS margin_pct,
  SUM(oi.line_total) AS revenue
FROM menu_items mi
JOIN order_items oi ON oi.menu_item_id = mi.id
JOIN orders o ON o.id = oi.order_id
WHERE mi.site_id = '${s}'
  AND o.status = 'completed'
  AND o.order_date >= CURRENT_DATE - INTERVAL '12 months'
  AND mi.active = true
GROUP BY mi.id, mi.name, mi.category
HAVING COUNT(DISTINCT oi.order_id) > 0
ORDER BY revenue DESC
LIMIT 10000`,
        chart_type: 'scatter',
        x_axis: { field: 'popularity', label: 'Popularity (orders)', type: 'numeric' },
        y_axis: { field: 'margin_pct', label: 'Margin %', type: 'percent' },
        series: [{ field: 'revenue', label: 'Revenue (bubble size)', color: '#234A73' }],
        drill_down_hint: 'Hover for item details; click to see that item\'s order history.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 3.6 — Top 10 Menu Items (table)
    {
      name: 'Top 10 Menu Items',
      description: 'Individual item performance ranked by revenue YTD.',
      sql_query: `WITH current_period AS (
  SELECT
    mi.id,
    mi.name,
    mi.category,
    COUNT(DISTINCT oi.order_id) AS orders,
    SUM(oi.line_total) AS revenue,
    AVG(oi.unit_price) AS avg_unit_price
  FROM menu_items mi
  JOIN order_items oi ON oi.menu_item_id = mi.id
  JOIN orders o ON o.id = oi.order_id
  WHERE mi.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('year', CURRENT_DATE)
  GROUP BY mi.id, mi.name, mi.category
),
prior_period AS (
  SELECT mi.id, SUM(oi.line_total) AS prior_revenue
  FROM menu_items mi
  JOIN order_items oi ON oi.menu_item_id = mi.id
  JOIN orders o ON o.id = oi.order_id
  WHERE mi.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
    AND o.order_date < date_trunc('year', CURRENT_DATE)
  GROUP BY mi.id
)
SELECT
  c.name AS item,
  INITCAP(REPLACE(c.category, '_', ' ')) AS category,
  c.orders,
  c.revenue,
  c.avg_unit_price,
  CASE
    WHEN COALESCE(p.prior_revenue, 0) = 0 THEN NULL
    ELSE ROUND(100.0 * (c.revenue - p.prior_revenue) / p.prior_revenue, 0)
  END AS yoy_pct
FROM current_period c
LEFT JOIN prior_period p ON p.id = c.id
ORDER BY c.revenue DESC
LIMIT 10`,
      chart_spec: {
        meta: { tab: 'menu_mix', position: 6, suggested: true },
        title: 'Top 10 Menu Items',
        description: 'Individual item performance ranked by revenue YTD.',
        sql: `WITH current_period AS (
  SELECT
    mi.id,
    mi.name,
    mi.category,
    COUNT(DISTINCT oi.order_id) AS orders,
    SUM(oi.line_total) AS revenue,
    AVG(oi.unit_price) AS avg_unit_price
  FROM menu_items mi
  JOIN order_items oi ON oi.menu_item_id = mi.id
  JOIN orders o ON o.id = oi.order_id
  WHERE mi.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('year', CURRENT_DATE)
  GROUP BY mi.id, mi.name, mi.category
),
prior_period AS (
  SELECT mi.id, SUM(oi.line_total) AS prior_revenue
  FROM menu_items mi
  JOIN order_items oi ON oi.menu_item_id = mi.id
  JOIN orders o ON o.id = oi.order_id
  WHERE mi.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
    AND o.order_date < date_trunc('year', CURRENT_DATE)
  GROUP BY mi.id
)
SELECT
  c.name AS item,
  INITCAP(REPLACE(c.category, '_', ' ')) AS category,
  c.orders,
  c.revenue,
  c.avg_unit_price,
  CASE
    WHEN COALESCE(p.prior_revenue, 0) = 0 THEN NULL
    ELSE ROUND(100.0 * (c.revenue - p.prior_revenue) / p.prior_revenue, 0)
  END AS yoy_pct
FROM current_period c
LEFT JOIN prior_period p ON p.id = c.id
ORDER BY c.revenue DESC
LIMIT 10`,
        chart_type: 'table',
        series: [
          { field: 'item', label: 'Item' },
          { field: 'category', label: 'Category' },
          { field: 'orders', label: 'Orders' },
          { field: 'revenue', label: 'Revenue', type: 'currency' },
          { field: 'avg_unit_price', label: 'Avg Price', type: 'currency' },
          { field: 'yoy_pct', label: 'YoY', type: 'percent' },
        ],
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 3.7 — Category Revenue Trend
    {
      name: 'Category Revenue Trend — Top 4',
      description: 'Monthly revenue by top categories showing seasonality and momentum.',
      sql_query: `WITH months AS (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
    date_trunc('month', CURRENT_DATE),
    INTERVAL '1 month'
  )::DATE AS month_start
),
category_rev AS (
  SELECT
    date_trunc('month', o.order_date)::DATE AS month_start,
    mi.category,
    SUM(oi.line_total) AS revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
    AND mi.category IN ('hot_entree', 'sandwich_platter', 'breakfast', 'salad_bowl')
  GROUP BY 1, 2
)
SELECT
  to_char(m.month_start, 'Mon YYYY') AS month,
  COALESCE(SUM(cr.revenue) FILTER (WHERE cr.category = 'hot_entree'), 0) AS hot_entree,
  COALESCE(SUM(cr.revenue) FILTER (WHERE cr.category = 'sandwich_platter'), 0) AS sandwich_platter,
  COALESCE(SUM(cr.revenue) FILTER (WHERE cr.category = 'breakfast'), 0) AS breakfast,
  COALESCE(SUM(cr.revenue) FILTER (WHERE cr.category = 'salad_bowl'), 0) AS salad_bowl
FROM months m
LEFT JOIN category_rev cr ON cr.month_start = m.month_start
GROUP BY m.month_start
ORDER BY m.month_start
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'menu_mix', position: 7, suggested: true },
        title: 'Category Revenue Trend — Top 4 Categories',
        description: 'Monthly revenue by top categories showing seasonality and momentum.',
        sql: `WITH months AS (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
    date_trunc('month', CURRENT_DATE),
    INTERVAL '1 month'
  )::DATE AS month_start
),
category_rev AS (
  SELECT
    date_trunc('month', o.order_date)::DATE AS month_start,
    mi.category,
    SUM(oi.line_total) AS revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
    AND mi.category IN ('hot_entree', 'sandwich_platter', 'breakfast', 'salad_bowl')
  GROUP BY 1, 2
)
SELECT
  to_char(m.month_start, 'Mon YYYY') AS month,
  COALESCE(SUM(cr.revenue) FILTER (WHERE cr.category = 'hot_entree'), 0) AS hot_entree,
  COALESCE(SUM(cr.revenue) FILTER (WHERE cr.category = 'sandwich_platter'), 0) AS sandwich_platter,
  COALESCE(SUM(cr.revenue) FILTER (WHERE cr.category = 'breakfast'), 0) AS breakfast,
  COALESCE(SUM(cr.revenue) FILTER (WHERE cr.category = 'salad_bowl'), 0) AS salad_bowl
FROM months m
LEFT JOIN category_rev cr ON cr.month_start = m.month_start
GROUP BY m.month_start
ORDER BY m.month_start
LIMIT 10000`,
        chart_type: 'line',
        x_axis: { field: 'month', label: 'Month', type: 'temporal' },
        y_axis: { field: 'hot_entree', label: 'Revenue', type: 'currency' },
        series: [
          { field: 'hot_entree', label: 'Hot Entrées', color: '#234A73' },
          { field: 'sandwich_platter', label: 'Sandwich/Wrap', color: '#4582A9' },
          { field: 'breakfast', label: 'Breakfast', color: '#5B9EC9' },
          { field: 'salad_bowl', label: 'Salad & Bowl', color: '#d97706' },
        ],
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 3.8 — Dietary Accommodation Mix
    {
      name: 'Dietary Accommodation Mix',
      description: 'Orders by dietary modification category (YTD).',
      sql_query: `WITH modified_orders AS (
  SELECT
    o.id AS order_id,
    CASE
      WHEN EXISTS (SELECT 1 FROM unnest(oi.dietary_modifications) m WHERE m ILIKE '%vegan%') THEN 'Vegan'
      WHEN EXISTS (SELECT 1 FROM unnest(oi.dietary_modifications) m WHERE m ILIKE '%gluten%') THEN 'Gluten-Free'
      WHEN EXISTS (SELECT 1 FROM unnest(oi.dietary_modifications) m WHERE m ILIKE '%vegetarian%') THEN 'Vegetarian'
      WHEN oi.dietary_modifications IS NOT NULL AND array_length(oi.dietary_modifications, 1) > 0 THEN 'Other Dietary'
      ELSE 'Standard'
    END AS dietary_category
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('year', CURRENT_DATE)
)
SELECT
  dietary_category,
  COUNT(DISTINCT order_id) AS orders,
  ROUND(100.0 * COUNT(DISTINCT order_id) / NULLIF(SUM(COUNT(DISTINCT order_id)) OVER (), 0), 1) AS pct
FROM modified_orders
GROUP BY dietary_category
ORDER BY orders DESC
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'menu_mix', position: 8, suggested: true },
        title: 'Dietary Accommodation Mix',
        description: 'Orders by dietary modification category (YTD).',
        sql: `WITH modified_orders AS (
  SELECT
    o.id AS order_id,
    CASE
      WHEN EXISTS (SELECT 1 FROM unnest(oi.dietary_modifications) m WHERE m ILIKE '%vegan%') THEN 'Vegan'
      WHEN EXISTS (SELECT 1 FROM unnest(oi.dietary_modifications) m WHERE m ILIKE '%gluten%') THEN 'Gluten-Free'
      WHEN EXISTS (SELECT 1 FROM unnest(oi.dietary_modifications) m WHERE m ILIKE '%vegetarian%') THEN 'Vegetarian'
      WHEN oi.dietary_modifications IS NOT NULL AND array_length(oi.dietary_modifications, 1) > 0 THEN 'Other Dietary'
      ELSE 'Standard'
    END AS dietary_category
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('year', CURRENT_DATE)
)
SELECT
  dietary_category,
  COUNT(DISTINCT order_id) AS orders,
  ROUND(100.0 * COUNT(DISTINCT order_id) / NULLIF(SUM(COUNT(DISTINCT order_id)) OVER (), 0), 1) AS pct
FROM modified_orders
GROUP BY dietary_category
ORDER BY orders DESC
LIMIT 10000`,
        chart_type: 'pie',
        x_axis: { field: 'dietary_category', label: 'Dietary Category', type: 'categorical' },
        y_axis: { field: 'pct', label: '% of Orders', type: 'percent' },
        series: [{ field: 'pct', label: 'Share', color: '#234A73' }],
      },
      is_suggested: true,
      session_user_id: null,
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // TAB 4 — Financial & Forecasting
    // ═══════════════════════════════════════════════════════════════════════════

    // 4.1 — YTD Revenue (deliberate duplicate of 1.1 scoped to financial tab)
    {
      name: 'YTD Revenue',
      description: 'Year-to-date completed revenue with prior-year comparison.',
      sql_query: `SELECT
  COALESCE(SUM(total), 0) AS ytd_revenue,
  COALESCE(SUM(total) FILTER (WHERE order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
                                AND order_date < date_trunc('year', CURRENT_DATE)), 0) AS prior_ytd_revenue
FROM orders
WHERE site_id = '${s}'
  AND status = 'completed'
  AND order_date >= date_trunc('year', CURRENT_DATE)
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'financial', position: 1, suggested: true },
        title: 'YTD Revenue',
        description: 'Year-to-date completed revenue with prior-year comparison.',
        sql: `SELECT
  COALESCE(SUM(total), 0) AS ytd_revenue,
  COALESCE(SUM(total) FILTER (WHERE order_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
                                AND order_date < date_trunc('year', CURRENT_DATE)), 0) AS prior_ytd_revenue
FROM orders
WHERE site_id = '${s}'
  AND status = 'completed'
  AND order_date >= date_trunc('year', CURRENT_DATE)
LIMIT 10000`,
        chart_type: 'kpi_card',
        y_axis: { field: 'ytd_revenue', label: 'YTD Revenue', type: 'currency' },
        series: [{ field: 'ytd_revenue', label: 'Revenue', color: '#234A73' }],
        drill_down_hint: 'Clicking shows the revenue trend broken down by month.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 4.2 — Budget Attainment
    {
      name: 'Budget Attainment',
      description: 'YTD actual revenue as percentage of YTD budget.',
      sql_query: `WITH ytd_actual AS (
  SELECT COALESCE(SUM(total), 0) AS actual
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('year', CURRENT_DATE)
),
ytd_budget AS (
  SELECT COALESCE(SUM(budgeted_revenue), 0) AS budget
  FROM budget
  WHERE site_id = '${s}'
    AND period_month >= date_trunc('year', CURRENT_DATE)
    AND period_month <= date_trunc('month', CURRENT_DATE)
)
SELECT
  a.actual,
  b.budget,
  CASE WHEN b.budget = 0 THEN NULL
       ELSE ROUND(100.0 * a.actual / b.budget, 1) END AS attainment_pct
FROM ytd_actual a, ytd_budget b
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'financial', position: 2, suggested: true },
        title: 'Budget Attainment',
        description: 'YTD actual revenue as percentage of YTD budget.',
        sql: `WITH ytd_actual AS (
  SELECT COALESCE(SUM(total), 0) AS actual
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('year', CURRENT_DATE)
),
ytd_budget AS (
  SELECT COALESCE(SUM(budgeted_revenue), 0) AS budget
  FROM budget
  WHERE site_id = '${s}'
    AND period_month >= date_trunc('year', CURRENT_DATE)
    AND period_month <= date_trunc('month', CURRENT_DATE)
)
SELECT
  a.actual,
  b.budget,
  CASE WHEN b.budget = 0 THEN NULL
       ELSE ROUND(100.0 * a.actual / b.budget, 1) END AS attainment_pct
FROM ytd_actual a, ytd_budget b
LIMIT 10000`,
        chart_type: 'kpi_card',
        y_axis: { field: 'attainment_pct', label: 'Attainment', type: 'percent' },
        series: [{ field: 'attainment_pct', label: '%', color: '#4582A9' }],
        drill_down_hint: 'Click to see the full budget vs. actual trend.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 4.3 — Net Margin
    {
      name: 'Net Margin',
      description: 'Revenue minus estimated food cost, labor (18%), and overhead (12%).',
      sql_query: `WITH ytd AS (
  SELECT
    SUM(o.total) AS revenue,
    SUM(oi.quantity * mi.cost) AS food_cost
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('year', CURRENT_DATE)
)
SELECT
  revenue,
  food_cost,
  (revenue - food_cost - (revenue * 0.18) - (revenue * 0.12)) AS net_margin,
  ROUND(100.0 * (revenue - food_cost - (revenue * 0.18) - (revenue * 0.12)) / NULLIF(revenue, 0), 1) AS net_margin_pct
FROM ytd
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'financial', position: 3, suggested: true },
        title: 'Net Margin',
        description: 'Revenue minus estimated food cost, labor (18%), and overhead (12%).',
        sql: `WITH ytd AS (
  SELECT
    SUM(o.total) AS revenue,
    SUM(oi.quantity * mi.cost) AS food_cost
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('year', CURRENT_DATE)
)
SELECT
  revenue,
  food_cost,
  (revenue - food_cost - (revenue * 0.18) - (revenue * 0.12)) AS net_margin,
  ROUND(100.0 * (revenue - food_cost - (revenue * 0.18) - (revenue * 0.12)) / NULLIF(revenue, 0), 1) AS net_margin_pct
FROM ytd
LIMIT 10000`,
        chart_type: 'kpi_card',
        y_axis: { field: 'net_margin_pct', label: 'Net Margin', type: 'percent' },
        series: [{ field: 'net_margin_pct', label: '%', color: '#4582A9' }],
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 4.4 — Food Cost %
    {
      name: 'Food Cost %',
      description: 'YTD food cost as percentage of revenue, with budget comparison.',
      sql_query: `WITH ytd AS (
  SELECT
    SUM(o.total) AS revenue,
    SUM(oi.quantity * mi.cost) AS food_cost
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('year', CURRENT_DATE)
)
SELECT
  ROUND(100.0 * food_cost / NULLIF(revenue, 0), 1) AS food_cost_pct,
  (SELECT AVG(budgeted_food_cost_pct) FROM budget
   WHERE site_id = '${s}'
     AND period_month >= date_trunc('year', CURRENT_DATE)) AS budget_food_cost_pct
FROM ytd
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'financial', position: 4, suggested: true },
        title: 'Food Cost %',
        description: 'YTD food cost as percentage of revenue, with budget comparison.',
        sql: `WITH ytd AS (
  SELECT
    SUM(o.total) AS revenue,
    SUM(oi.quantity * mi.cost) AS food_cost
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('year', CURRENT_DATE)
)
SELECT
  ROUND(100.0 * food_cost / NULLIF(revenue, 0), 1) AS food_cost_pct,
  (SELECT AVG(budgeted_food_cost_pct) FROM budget
   WHERE site_id = '${s}'
     AND period_month >= date_trunc('year', CURRENT_DATE)) AS budget_food_cost_pct
FROM ytd
LIMIT 10000`,
        chart_type: 'kpi_card',
        y_axis: { field: 'food_cost_pct', label: 'Food Cost', type: 'percent' },
        series: [{ field: 'food_cost_pct', label: '%', color: '#d97706' }],
        drill_down_hint: 'Click to see food cost by category and month.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 4.5 — Budget vs. Actual vs. Forecast
    {
      name: 'Budget vs. Actual vs. Forecast',
      description: 'Monthly revenue performance against budget with rolling forecast for future months.',
      sql_query: `WITH months AS (
  SELECT generate_series(
    date_trunc('year', CURRENT_DATE),
    date_trunc('year', CURRENT_DATE) + INTERVAL '11 months',
    INTERVAL '1 month'
  )::DATE AS month_start
),
actuals AS (
  SELECT date_trunc('month', order_date)::DATE AS month_start, SUM(total) AS actual
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('year', CURRENT_DATE)
  GROUP BY 1
),
forecast AS (
  SELECT
    (date_trunc('month', order_date) + INTERVAL '12 months')::DATE AS month_start,
    AVG(monthly_total) AS forecast
  FROM (
    SELECT
      date_trunc('month', order_date) AS order_date,
      SUM(total) AS monthly_total
    FROM orders
    WHERE site_id = '${s}' AND status = 'completed'
      AND order_date >= date_trunc('year', CURRENT_DATE) - INTERVAL '1 year'
      AND order_date < date_trunc('year', CURRENT_DATE)
    GROUP BY 1
  ) prior
  GROUP BY 1
)
SELECT
  to_char(m.month_start, 'Mon YYYY') AS month,
  COALESCE(b.budgeted_revenue, 0) AS budget,
  CASE WHEN m.month_start <= date_trunc('month', CURRENT_DATE) THEN COALESCE(a.actual, 0) ELSE NULL END AS actual,
  CASE WHEN m.month_start > date_trunc('month', CURRENT_DATE) THEN COALESCE(f.forecast, 0) ELSE NULL END AS forecast
FROM months m
LEFT JOIN budget b ON b.period_month = m.month_start AND b.site_id = '${s}'
LEFT JOIN actuals a ON a.month_start = m.month_start
LEFT JOIN forecast f ON f.month_start = m.month_start
ORDER BY m.month_start
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'financial', position: 5, suggested: true },
        title: 'Budget vs. Actual vs. Forecast',
        description: 'Monthly revenue performance against budget with rolling forecast for future months.',
        sql: `WITH months AS (
  SELECT generate_series(
    date_trunc('year', CURRENT_DATE),
    date_trunc('year', CURRENT_DATE) + INTERVAL '11 months',
    INTERVAL '1 month'
  )::DATE AS month_start
),
actuals AS (
  SELECT date_trunc('month', order_date)::DATE AS month_start, SUM(total) AS actual
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('year', CURRENT_DATE)
  GROUP BY 1
),
forecast AS (
  SELECT
    (date_trunc('month', order_date) + INTERVAL '12 months')::DATE AS month_start,
    AVG(monthly_total) AS forecast
  FROM (
    SELECT
      date_trunc('month', order_date) AS order_date,
      SUM(total) AS monthly_total
    FROM orders
    WHERE site_id = '${s}' AND status = 'completed'
      AND order_date >= date_trunc('year', CURRENT_DATE) - INTERVAL '1 year'
      AND order_date < date_trunc('year', CURRENT_DATE)
    GROUP BY 1
  ) prior
  GROUP BY 1
)
SELECT
  to_char(m.month_start, 'Mon YYYY') AS month,
  COALESCE(b.budgeted_revenue, 0) AS budget,
  CASE WHEN m.month_start <= date_trunc('month', CURRENT_DATE) THEN COALESCE(a.actual, 0) ELSE NULL END AS actual,
  CASE WHEN m.month_start > date_trunc('month', CURRENT_DATE) THEN COALESCE(f.forecast, 0) ELSE NULL END AS forecast
FROM months m
LEFT JOIN budget b ON b.period_month = m.month_start AND b.site_id = '${s}'
LEFT JOIN actuals a ON a.month_start = m.month_start
LEFT JOIN forecast f ON f.month_start = m.month_start
ORDER BY m.month_start
LIMIT 10000`,
        chart_type: 'line',
        x_axis: { field: 'month', label: 'Month', type: 'temporal' },
        y_axis: { field: 'actual', label: 'Revenue', type: 'currency' },
        series: [
          { field: 'budget', label: 'Budget', color: '#76a4c4' },
          { field: 'actual', label: 'Actual', color: '#234A73' },
          { field: 'forecast', label: 'Forecast', color: '#5B9EC9' },
        ],
        drill_down_hint: 'Click a month to see the variance breakdown.',
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 4.6 — Monthly P&L (exception: keeps semantic cost colors)
    {
      name: 'Monthly P&L',
      description: 'Revenue with stacked cost layers and net margin, by month.',
      sql_query: `WITH months AS (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
    date_trunc('month', CURRENT_DATE),
    INTERVAL '1 month'
  )::DATE AS month_start
),
monthly AS (
  SELECT
    date_trunc('month', o.order_date)::DATE AS month_start,
    SUM(o.total) AS revenue,
    SUM(oi.quantity * mi.cost) AS food_cost
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
  GROUP BY 1
)
SELECT
  to_char(m.month_start, 'Mon YYYY') AS month,
  COALESCE(mo.revenue, 0) AS revenue,
  COALESCE(mo.food_cost, 0) AS food_cost,
  ROUND(COALESCE(mo.revenue, 0) * 0.18, 2) AS labor,
  ROUND(COALESCE(mo.revenue, 0) * 0.12, 2) AS other_costs,
  ROUND(COALESCE(mo.revenue, 0) - COALESCE(mo.food_cost, 0) - (COALESCE(mo.revenue, 0) * 0.30), 2) AS net_margin
FROM months m
LEFT JOIN monthly mo ON mo.month_start = m.month_start
ORDER BY m.month_start
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'financial', position: 6, suggested: true },
        title: 'Monthly P&L',
        description: 'Revenue with stacked cost layers and net margin, by month.',
        sql: `WITH months AS (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
    date_trunc('month', CURRENT_DATE),
    INTERVAL '1 month'
  )::DATE AS month_start
),
monthly AS (
  SELECT
    date_trunc('month', o.order_date)::DATE AS month_start,
    SUM(o.total) AS revenue,
    SUM(oi.quantity * mi.cost) AS food_cost
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.site_id = '${s}' AND o.status = 'completed'
    AND o.order_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
  GROUP BY 1
)
SELECT
  to_char(m.month_start, 'Mon YYYY') AS month,
  COALESCE(mo.revenue, 0) AS revenue,
  COALESCE(mo.food_cost, 0) AS food_cost,
  ROUND(COALESCE(mo.revenue, 0) * 0.18, 2) AS labor,
  ROUND(COALESCE(mo.revenue, 0) * 0.12, 2) AS other_costs,
  ROUND(COALESCE(mo.revenue, 0) - COALESCE(mo.food_cost, 0) - (COALESCE(mo.revenue, 0) * 0.30), 2) AS net_margin
FROM months m
LEFT JOIN monthly mo ON mo.month_start = m.month_start
ORDER BY m.month_start
LIMIT 10000`,
        chart_type: 'stacked_bar',
        x_axis: { field: 'month', label: 'Month', type: 'temporal' },
        y_axis: { field: 'revenue', label: 'Amount', type: 'currency' },
        series: [
          { field: 'food_cost', label: 'Food Cost', color: '#dc2626' },
          { field: 'labor', label: 'Labor', color: '#d97706' },
          { field: 'other_costs', label: 'Other', color: '#76a4c4' },
          { field: 'net_margin', label: 'Net Margin', color: '#4582A9' },
        ],
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 4.7 — Quarterly Performance Summary
    {
      name: 'Quarterly Performance Summary',
      description: 'Revenue, budget, and variance by quarter.',
      sql_query: `WITH quarters AS (
  SELECT
    date_trunc('quarter', d)::DATE AS quarter_start
  FROM generate_series(
    date_trunc('quarter', CURRENT_DATE - INTERVAL '1 year'),
    date_trunc('quarter', CURRENT_DATE),
    INTERVAL '3 months'
  ) d
),
quarterly_actual AS (
  SELECT
    date_trunc('quarter', order_date)::DATE AS quarter_start,
    SUM(total) AS revenue
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('quarter', CURRENT_DATE - INTERVAL '1 year')
  GROUP BY 1
),
quarterly_budget AS (
  SELECT
    date_trunc('quarter', period_month)::DATE AS quarter_start,
    SUM(budgeted_revenue) AS budget
  FROM budget
  WHERE site_id = '${s}'
    AND period_month >= date_trunc('quarter', CURRENT_DATE - INTERVAL '1 year')
  GROUP BY 1
)
SELECT
  to_char(q.quarter_start, '"Q"Q YYYY') AS quarter,
  COALESCE(qa.revenue, 0) AS revenue,
  COALESCE(qb.budget, 0) AS budget,
  COALESCE(qa.revenue, 0) - COALESCE(qb.budget, 0) AS variance,
  CASE WHEN COALESCE(qb.budget, 0) = 0 THEN NULL
       ELSE ROUND(100.0 * (COALESCE(qa.revenue, 0) - qb.budget) / qb.budget, 1)
  END AS pct_variance
FROM quarters q
LEFT JOIN quarterly_actual qa ON qa.quarter_start = q.quarter_start
LEFT JOIN quarterly_budget qb ON qb.quarter_start = q.quarter_start
ORDER BY q.quarter_start
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'financial', position: 7, suggested: true },
        title: 'Quarterly Performance Summary',
        description: 'Revenue, budget, and variance by quarter.',
        sql: `WITH quarters AS (
  SELECT
    date_trunc('quarter', d)::DATE AS quarter_start
  FROM generate_series(
    date_trunc('quarter', CURRENT_DATE - INTERVAL '1 year'),
    date_trunc('quarter', CURRENT_DATE),
    INTERVAL '3 months'
  ) d
),
quarterly_actual AS (
  SELECT
    date_trunc('quarter', order_date)::DATE AS quarter_start,
    SUM(total) AS revenue
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('quarter', CURRENT_DATE - INTERVAL '1 year')
  GROUP BY 1
),
quarterly_budget AS (
  SELECT
    date_trunc('quarter', period_month)::DATE AS quarter_start,
    SUM(budgeted_revenue) AS budget
  FROM budget
  WHERE site_id = '${s}'
    AND period_month >= date_trunc('quarter', CURRENT_DATE - INTERVAL '1 year')
  GROUP BY 1
)
SELECT
  to_char(q.quarter_start, '"Q"Q YYYY') AS quarter,
  COALESCE(qa.revenue, 0) AS revenue,
  COALESCE(qb.budget, 0) AS budget,
  COALESCE(qa.revenue, 0) - COALESCE(qb.budget, 0) AS variance,
  CASE WHEN COALESCE(qb.budget, 0) = 0 THEN NULL
       ELSE ROUND(100.0 * (COALESCE(qa.revenue, 0) - qb.budget) / qb.budget, 1)
  END AS pct_variance
FROM quarters q
LEFT JOIN quarterly_actual qa ON qa.quarter_start = q.quarter_start
LEFT JOIN quarterly_budget qb ON qb.quarter_start = q.quarter_start
ORDER BY q.quarter_start
LIMIT 10000`,
        chart_type: 'table',
        series: [
          { field: 'quarter', label: 'Quarter' },
          { field: 'revenue', label: 'Revenue', type: 'currency' },
          { field: 'budget', label: 'Budget', type: 'currency' },
          { field: 'variance', label: 'Variance', type: 'currency' },
          { field: 'pct_variance', label: '% Var', type: 'percent' },
        ],
      },
      is_suggested: true,
      session_user_id: null,
    },

    // 4.8 — Annual Revenue Progress
    {
      name: 'Annual Revenue Progress',
      description: 'YTD revenue as percentage of annual budget target.',
      sql_query: `WITH ytd AS (
  SELECT COALESCE(SUM(total), 0) AS revenue
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('year', CURRENT_DATE)
),
annual_budget AS (
  SELECT COALESCE(SUM(budgeted_revenue), 0) AS budget
  FROM budget
  WHERE site_id = '${s}'
    AND period_month >= date_trunc('year', CURRENT_DATE)
    AND period_month < date_trunc('year', CURRENT_DATE) + INTERVAL '1 year'
)
SELECT
  y.revenue AS ytd_revenue,
  b.budget AS annual_target,
  CASE WHEN b.budget = 0 THEN NULL
       ELSE ROUND(100.0 * y.revenue / b.budget, 1) END AS pct_to_target
FROM ytd y, annual_budget b
LIMIT 10000`,
      chart_spec: {
        meta: { tab: 'financial', position: 8, suggested: true },
        title: 'Annual Revenue Progress',
        description: 'YTD revenue as percentage of annual budget target.',
        sql: `WITH ytd AS (
  SELECT COALESCE(SUM(total), 0) AS revenue
  FROM orders
  WHERE site_id = '${s}' AND status = 'completed'
    AND order_date >= date_trunc('year', CURRENT_DATE)
),
annual_budget AS (
  SELECT COALESCE(SUM(budgeted_revenue), 0) AS budget
  FROM budget
  WHERE site_id = '${s}'
    AND period_month >= date_trunc('year', CURRENT_DATE)
    AND period_month < date_trunc('year', CURRENT_DATE) + INTERVAL '1 year'
)
SELECT
  y.revenue AS ytd_revenue,
  b.budget AS annual_target,
  CASE WHEN b.budget = 0 THEN NULL
       ELSE ROUND(100.0 * y.revenue / b.budget, 1) END AS pct_to_target
FROM ytd y, annual_budget b
LIMIT 10000`,
        chart_type: 'kpi_card',
        y_axis: { field: 'pct_to_target', label: '% to Target', type: 'percent' },
        series: [{ field: 'pct_to_target', label: '% to Target', color: '#234A73' }],
        drill_down_hint: 'Click to see month-by-month pace against annual target.',
      },
      is_suggested: true,
      session_user_id: null,
    },

  ]
}
