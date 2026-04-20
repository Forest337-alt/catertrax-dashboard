/**
 * Few-shot examples included in the system prompt for SQL generation.
 * These demonstrate correct output format for common query patterns.
 */

export const FEW_SHOT_EXAMPLES = [
  // 1. Simple KPI
  {
    role: 'user' as const,
    content: "What's my total revenue this month? Site ID: 00000000-0000-0000-0000-000000000001",
  },
  {
    role: 'assistant' as const,
    content: JSON.stringify({
      title: 'Revenue This Month',
      description: 'Total completed-order revenue for the current calendar month.',
      sql: `SELECT
  SUM(o.total) AS revenue
FROM orders o
WHERE o.site_id = '00000000-0000-0000-0000-000000000001'
  AND o.status = 'completed'
  AND DATE_TRUNC('month', o.event_date) = DATE_TRUNC('month', CURRENT_DATE)
LIMIT 1`,
      chart_type: 'kpi_card',
      series: [{ field: 'revenue', label: 'Revenue', color: '#234A73' }],
      filters_applied: [{ field: 'period', value: 'current month' }],
      follow_up_suggestions: [
        'Compare to last month',
        'Break this down by account',
        'Show month-over-month trend',
      ],
    }),
  },

  // 2. Time series
  {
    role: 'user' as const,
    content: 'Show me revenue trend for the last 12 months. Site ID: 00000000-0000-0000-0000-000000000001',
  },
  {
    role: 'assistant' as const,
    content: JSON.stringify({
      title: 'Monthly Revenue — Last 12 Months',
      description: 'Total completed-order revenue grouped by month over the trailing 12 months.',
      sql: `SELECT
  DATE_TRUNC('month', o.event_date)::DATE AS month,
  SUM(o.total)                            AS revenue
FROM orders o
WHERE o.site_id = '00000000-0000-0000-0000-000000000001'
  AND o.status = 'completed'
  AND o.event_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
GROUP BY 1
ORDER BY 1
LIMIT 12`,
      chart_type: 'area',
      x_axis: { field: 'month', label: 'Month', type: 'temporal' },
      y_axis: { field: 'revenue', label: 'Revenue ($)', type: 'currency' },
      series: [{ field: 'revenue', label: 'Revenue', color: '#234A73' }],
      filters_applied: [{ field: 'period', value: 'last 12 months' }],
      drill_down_hint: 'Click a month to see that month\'s orders in detail',
      follow_up_suggestions: [
        'Add budget vs actual overlay',
        'Break down by order type',
        'Compare to prior year',
      ],
    }),
  },

  // 3. Filtered breakdown / ranked list
  {
    role: 'user' as const,
    content: 'Show me top 10 accounts by revenue in Q1 2026. Site ID: 00000000-0000-0000-0000-000000000001',
  },
  {
    role: 'assistant' as const,
    content: JSON.stringify({
      title: 'Top 10 Accounts by Revenue — Q1 2026',
      description: 'The ten accounts with the highest total order revenue in Q1 2026 (Jan–Mar).',
      sql: `SELECT
  a.name                    AS account,
  a.account_type,
  SUM(o.total)              AS revenue,
  COUNT(o.id)               AS order_count
FROM orders o
JOIN accounts a ON a.id = o.account_id
WHERE o.site_id = '00000000-0000-0000-0000-000000000001'
  AND o.status = 'completed'
  AND o.event_date BETWEEN '2026-01-01' AND '2026-03-31'
GROUP BY a.id, a.name, a.account_type
ORDER BY revenue DESC
LIMIT 10`,
      chart_type: 'bar',
      x_axis: { field: 'account', label: 'Account', type: 'categorical' },
      y_axis: { field: 'revenue', label: 'Revenue ($)', type: 'currency' },
      series: [{ field: 'revenue', label: 'Revenue', color: '#234A73' }],
      filters_applied: [{ field: 'period', value: 'Q1 2026' }],
      drill_down_hint: 'Click an account bar to see its orders',
      follow_up_suggestions: [
        'Show all accounts as a table',
        'Compare Q1 to Q4 2025',
        'Show order count alongside revenue',
      ],
    }),
  },

  // 4. Multi-dimensional heatmap
  {
    role: 'user' as const,
    content: 'Show order volume by day of week and time of day. Site ID: 00000000-0000-0000-0000-000000000001',
  },
  {
    role: 'assistant' as const,
    content: JSON.stringify({
      title: 'Order Volume by Day of Week & Daypart',
      description: 'Heatmap showing when orders are placed across days and time of day, revealing peak demand patterns.',
      sql: `WITH daypart AS (
  SELECT
    TO_CHAR(event_date, 'Dy') AS day_of_week,
    EXTRACT(DOW FROM event_date)::INT AS dow_num,
    CASE
      WHEN event_time < '10:00' THEN 'Morning'
      WHEN event_time < '13:00' THEN 'Midday'
      WHEN event_time < '17:00' THEN 'Afternoon'
      ELSE 'Evening'
    END AS daypart,
    id
  FROM orders
  WHERE site_id = '00000000-0000-0000-0000-000000000001'
    AND status = 'completed'
)
SELECT
  day_of_week,
  dow_num,
  daypart,
  COUNT(*) AS order_count
FROM daypart
GROUP BY day_of_week, dow_num, daypart
ORDER BY dow_num, daypart
LIMIT 100`,
      chart_type: 'heatmap',
      x_axis: { field: 'day_of_week', label: 'Day', type: 'categorical' },
      y_axis: { field: 'daypart', label: 'Time of Day', type: 'categorical' },
      series: [{ field: 'order_count', label: 'Orders', color: '#234A73' }],
      filters_applied: [{ field: 'status', value: 'completed' }],
      follow_up_suggestions: [
        'Filter to a specific month',
        'Show revenue instead of order count',
        'Break out by order type',
      ],
    }),
  },

  // 5. Year-over-year comparison
  {
    role: 'user' as const,
    content: 'Compare revenue this year vs last year by menu category. Site ID: 00000000-0000-0000-0000-000000000001',
  },
  {
    role: 'assistant' as const,
    content: JSON.stringify({
      title: 'Revenue by Category — This Year vs Last Year',
      description: 'Grouped bar chart comparing YTD category revenue for 2026 vs the same period in 2025.',
      sql: `WITH ytd AS (
  SELECT
    mi.category,
    EXTRACT(YEAR FROM o.event_date)::INT AS year,
    SUM(oi.line_total) AS revenue
  FROM order_items oi
  JOIN orders o      ON o.id = oi.order_id
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.site_id = '00000000-0000-0000-0000-000000000001'
    AND o.status = 'completed'
    AND EXTRACT(YEAR FROM o.event_date) IN (
          EXTRACT(YEAR FROM CURRENT_DATE),
          EXTRACT(YEAR FROM CURRENT_DATE) - 1
        )
    AND (EXTRACT(MONTH FROM o.event_date), EXTRACT(DAY FROM o.event_date))
        <= (EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(DAY FROM CURRENT_DATE))
  GROUP BY mi.category, year
)
SELECT
  category,
  MAX(CASE WHEN year = EXTRACT(YEAR FROM CURRENT_DATE) - 1 THEN revenue END)     AS prior_year,
  MAX(CASE WHEN year = EXTRACT(YEAR FROM CURRENT_DATE)     THEN revenue END)     AS current_year
FROM ytd
GROUP BY category
ORDER BY current_year DESC NULLS LAST
LIMIT 20`,
      chart_type: 'stacked_bar',
      x_axis: { field: 'category', label: 'Menu Category', type: 'categorical' },
      y_axis: { field: 'revenue', label: 'Revenue ($)', type: 'currency' },
      series: [
        { field: 'current_year', label: 'This Year', color: '#234A73' },
        { field: 'prior_year', label: 'Last Year', color: '#76a4c4' },
      ],
      filters_applied: [{ field: 'period', value: 'Year-to-date comparison' }],
      follow_up_suggestions: [
        'Show as a table with % change',
        'Drill into a specific category',
        'Filter to one quarter',
      ],
    }),
  },
]
