/**
 * Few-shot examples included in the system prompt for SQL generation.
 * These demonstrate correct output format for common query patterns.
 * Source: few-shot-examples.md
 */

export const FEW_SHOT_EXAMPLES = [
  // 1. Simple KPI card
  {
    role: 'user' as const,
    content: "What's my total revenue this month? Site ID: 00000000-0000-0000-0000-000000000001",
  },
  {
    role: 'assistant' as const,
    content: JSON.stringify({
      title: 'Month-to-Date Revenue',
      description: 'Total completed order revenue for the current calendar month.',
      sql: `SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE site_id = '00000000-0000-0000-0000-000000000001' AND status = 'completed' AND order_date >= date_trunc('month', CURRENT_DATE) AND order_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' LIMIT 10000;`,
      chart_type: 'kpi_card',
      x_axis: null,
      y_axis: { field: 'revenue', label: 'Revenue', type: 'currency' },
      series: [{ field: 'revenue', label: 'Revenue', color: '#234A73' }],
      filters_applied: [
        { field: 'status', value: 'completed' },
        { field: 'order_date', value: 'current_month' },
      ],
      drill_down_hint: 'Clicking the card will show the underlying orders for this month.',
      follow_up_suggestions: [
        'Compare to last month',
        'Break this down by week',
        'Show me which accounts drove this revenue',
      ],
    }),
  },

  // 2. Time series with year-over-year comparison
  {
    role: 'user' as const,
    content: 'Show me monthly revenue for the last 12 months with prior year overlay. Site ID: 00000000-0000-0000-0000-000000000001',
  },
  {
    role: 'assistant' as const,
    content: JSON.stringify({
      title: 'Monthly Revenue: Current vs. Prior Year',
      description: 'Monthly completed revenue for the trailing 12 months, overlaid with the same months from the prior year.',
      sql: `WITH months AS (SELECT generate_series(date_trunc('month', CURRENT_DATE) - INTERVAL '11 months', date_trunc('month', CURRENT_DATE), INTERVAL '1 month')::DATE AS month_start), current_rev AS (SELECT date_trunc('month', order_date)::DATE AS month_start, SUM(total) AS revenue FROM orders WHERE site_id = '00000000-0000-0000-0000-000000000001' AND status = 'completed' AND order_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months' AND order_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' GROUP BY 1), prior_rev AS (SELECT date_trunc('month', order_date)::DATE + INTERVAL '12 months' AS month_start, SUM(total) AS revenue FROM orders WHERE site_id = '00000000-0000-0000-0000-000000000001' AND status = 'completed' AND order_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '23 months' AND order_date < date_trunc('month', CURRENT_DATE) - INTERVAL '11 months' GROUP BY 1) SELECT to_char(m.month_start, 'Mon YYYY') AS month, COALESCE(c.revenue, 0) AS current_year, COALESCE(p.revenue, 0) AS prior_year FROM months m LEFT JOIN current_rev c ON c.month_start = m.month_start LEFT JOIN prior_rev p ON p.month_start::DATE = m.month_start ORDER BY m.month_start LIMIT 10000;`,
      chart_type: 'line',
      x_axis: { field: 'month', label: 'Month', type: 'categorical' },
      y_axis: { field: 'current_year', label: 'Revenue ($)', type: 'currency' },
      series: [
        { field: 'current_year', label: 'Current Year', color: '#234A73' },
        { field: 'prior_year', label: 'Prior Year', color: '#76a4c4' },
      ],
      filters_applied: [
        { field: 'status', value: 'completed' },
        { field: 'order_date', value: 'trailing_12_months' },
      ],
      drill_down_hint: "Clicking a month will filter the view to just that month's orders.",
      follow_up_suggestions: [
        'Show this as a bar chart instead',
        'Add budget as a third line',
        'Break down by order type',
      ],
    }),
  },

  // 3. Ranked table (top N)
  {
    role: 'user' as const,
    content: 'Top 10 accounts by revenue this year, with order count and average order value. Site ID: 00000000-0000-0000-0000-000000000001',
  },
  {
    role: 'assistant' as const,
    content: JSON.stringify({
      title: 'Top 10 Accounts by Revenue (YTD)',
      description: 'Highest-revenue accounts year-to-date with order volume and average order value.',
      sql: `SELECT a.name AS account, COUNT(o.id) AS orders, SUM(o.total) AS revenue, AVG(o.total) AS avg_order_value FROM orders o JOIN accounts a ON a.id = o.account_id WHERE o.site_id = '00000000-0000-0000-0000-000000000001' AND o.status = 'completed' AND o.order_date >= date_trunc('year', CURRENT_DATE) GROUP BY a.name ORDER BY revenue DESC LIMIT 10;`,
      chart_type: 'table',
      x_axis: null,
      y_axis: null,
      series: [
        { field: 'account', label: 'Account', color: null },
        { field: 'orders', label: 'Orders', color: null },
        { field: 'revenue', label: 'Revenue', color: null },
        { field: 'avg_order_value', label: 'Avg Order Value', color: null },
      ],
      filters_applied: [
        { field: 'status', value: 'completed' },
        { field: 'order_date', value: 'year_to_date' },
        { field: 'limit', value: 'top_10' },
      ],
      drill_down_hint: 'Clicking an account row will filter all subsequent views to that account.',
      follow_up_suggestions: [
        'Show me the bottom 10 instead',
        'Compare these accounts to last year',
        'What did each account order most?',
      ],
    }),
  },

  // 4. Two-dimensional heatmap
  {
    role: 'user' as const,
    content: 'Order volume by day of week and daypart. Site ID: 00000000-0000-0000-0000-000000000001',
  },
  {
    role: 'assistant' as const,
    content: JSON.stringify({
      title: 'Order Volume by Day & Daypart',
      description: 'Number of orders grouped by day of week and time-of-day period, for the trailing 90 days.',
      sql: `SELECT CASE EXTRACT(DOW FROM event_date) WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon' WHEN 2 THEN 'Tue' WHEN 3 THEN 'Wed' WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri' WHEN 6 THEN 'Sat' END AS day_of_week, CASE WHEN event_time >= '06:00' AND event_time < '10:00' THEN 'Breakfast (6–10a)' WHEN event_time >= '10:00' AND event_time < '14:00' THEN 'Lunch (10a–2p)' WHEN event_time >= '14:00' AND event_time < '17:00' THEN 'Afternoon (2–5p)' WHEN event_time >= '17:00' AND event_time < '21:00' THEN 'Dinner (5–9p)' ELSE 'Other' END AS daypart, COUNT(*) AS order_count FROM orders WHERE site_id = '00000000-0000-0000-0000-000000000001' AND status = 'completed' AND event_date >= CURRENT_DATE - INTERVAL '90 days' AND event_time IS NOT NULL GROUP BY day_of_week, daypart, EXTRACT(DOW FROM event_date) ORDER BY EXTRACT(DOW FROM event_date), daypart LIMIT 10000;`,
      chart_type: 'heatmap',
      x_axis: { field: 'day_of_week', label: 'Day of Week', type: 'categorical' },
      y_axis: { field: 'daypart', label: 'Daypart', type: 'categorical' },
      series: [{ field: 'order_count', label: 'Orders', color: '#234A73' }],
      filters_applied: [
        { field: 'status', value: 'completed' },
        { field: 'event_date', value: 'trailing_90_days' },
      ],
      drill_down_hint: 'Clicking a cell will filter to orders for that day/daypart combination.',
      follow_up_suggestions: [
        'Show this by revenue instead of count',
        'Filter to just full-service events',
        'Compare weekday vs weekend patterns',
      ],
    }),
  },

  // 5. Part-to-whole with category breakdown
  {
    role: 'user' as const,
    content: "What's the revenue breakdown by menu category this quarter? Site ID: 00000000-0000-0000-0000-000000000001",
  },
  {
    role: 'assistant' as const,
    content: JSON.stringify({
      title: 'Revenue by Menu Category — Current Quarter',
      description: 'Percentage and dollar contribution of each menu category to total revenue for the current quarter.',
      sql: `SELECT mi.category AS category, SUM(oi.line_total) AS revenue, ROUND(100.0 * SUM(oi.line_total) / NULLIF(SUM(SUM(oi.line_total)) OVER (), 0), 1) AS pct_of_total FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE o.site_id = '00000000-0000-0000-0000-000000000001' AND o.status = 'completed' AND o.order_date >= date_trunc('quarter', CURRENT_DATE) GROUP BY mi.category ORDER BY revenue DESC LIMIT 10000;`,
      chart_type: 'pie',
      x_axis: { field: 'category', label: 'Category', type: 'categorical' },
      y_axis: { field: 'revenue', label: 'Revenue', type: 'currency' },
      series: [{ field: 'revenue', label: 'Revenue', color: '#234A73' }],
      filters_applied: [
        { field: 'status', value: 'completed' },
        { field: 'order_date', value: 'quarter_to_date' },
      ],
      drill_down_hint: 'Clicking a slice will show the top items within that category.',
      follow_up_suggestions: [
        'Show this as a stacked bar over time',
        'Compare to last quarter',
        'Break down by margin instead of revenue',
      ],
    }),
  },

  // 6. Ambiguous request requiring clarification
  {
    role: 'user' as const,
    content: 'How are we doing? Site ID: 00000000-0000-0000-0000-000000000001',
  },
  {
    role: 'assistant' as const,
    content: JSON.stringify({
      clarifying_question:
        'Happy to pull that together — could you tell me which angle you\'re most interested in? I can show: (1) overall revenue performance against budget, (2) order volume and growth trends, (3) customer account activity, or (4) menu and product performance. Any of those, or something else entirely?',
    }),
  },

  // 7. Budget attainment with conditional coloring
  {
    role: 'user' as const,
    content: 'Show me budget attainment by month for the last 6 months, and flag any months where we missed budget. Site ID: 00000000-0000-0000-0000-000000000001',
  },
  {
    role: 'assistant' as const,
    content: JSON.stringify({
      title: 'Budget Attainment — Last 6 Months',
      description: 'Monthly actual revenue vs. budgeted revenue with variance percentage. Red bars indicate months where actual fell below budget.',
      sql: `WITH months AS (SELECT generate_series(date_trunc('month', CURRENT_DATE) - INTERVAL '5 months', date_trunc('month', CURRENT_DATE), INTERVAL '1 month')::DATE AS month_start), actuals AS (SELECT date_trunc('month', order_date)::DATE AS month_start, SUM(total) AS actual_revenue FROM orders WHERE site_id = '00000000-0000-0000-0000-000000000001' AND status = 'completed' AND order_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months' GROUP BY 1) SELECT to_char(m.month_start, 'Mon YYYY') AS month, COALESCE(a.actual_revenue, 0) AS actual, COALESCE(b.budgeted_revenue, 0) AS budget, CASE WHEN COALESCE(b.budgeted_revenue, 0) = 0 THEN NULL ELSE ROUND(100.0 * (COALESCE(a.actual_revenue, 0) - b.budgeted_revenue) / b.budgeted_revenue, 1) END AS variance_pct, CASE WHEN COALESCE(a.actual_revenue, 0) < COALESCE(b.budgeted_revenue, 0) THEN true ELSE false END AS missed_budget FROM months m LEFT JOIN actuals a ON a.month_start = m.month_start LEFT JOIN budget b ON b.period_month = m.month_start AND b.site_id = '00000000-0000-0000-0000-000000000001' ORDER BY m.month_start LIMIT 10000;`,
      chart_type: 'bar',
      x_axis: { field: 'month', label: 'Month', type: 'categorical' },
      y_axis: { field: 'actual', label: 'Revenue ($)', type: 'currency' },
      series: [
        { field: 'actual', label: 'Actual', color: '#234A73', conditional_color: { field: 'missed_budget', true_color: '#dc2626' } },
        { field: 'budget', label: 'Budget', color: '#76a4c4', style: 'dashed' },
      ],
      filters_applied: [
        { field: 'status', value: 'completed' },
        { field: 'order_date', value: 'trailing_6_months' },
      ],
      drill_down_hint: 'Clicking a month will show the underlying orders and variance breakdown.',
      follow_up_suggestions: [
        'Show variance in dollars instead of percent',
        'Extend to a full year',
        'What categories drove the miss in months that fell short?',
      ],
    }),
  },

  // 8. Two-variable scatter (menu engineering)
  {
    role: 'user' as const,
    content: 'Build a menu engineering matrix — popularity vs. margin for every item. Site ID: 00000000-0000-0000-0000-000000000001',
  },
  {
    role: 'assistant' as const,
    content: JSON.stringify({
      title: 'Menu Engineering Matrix',
      description: 'Each menu item plotted by popularity (order count) versus margin percentage. Bubble size represents total revenue. Use this to identify stars (high popularity + high margin), puzzles (high margin but low popularity), and underperformers.',
      sql: `SELECT mi.name AS item, mi.category AS category, COUNT(DISTINCT oi.order_id) AS order_count, ROUND(AVG(mi.margin_pct), 1) AS margin_pct, SUM(oi.line_total) AS revenue FROM menu_items mi JOIN order_items oi ON oi.menu_item_id = mi.id JOIN orders o ON o.id = oi.order_id WHERE mi.site_id = '00000000-0000-0000-0000-000000000001' AND o.status = 'completed' AND o.order_date >= CURRENT_DATE - INTERVAL '12 months' AND mi.active = true GROUP BY mi.name, mi.category HAVING COUNT(DISTINCT oi.order_id) > 0 ORDER BY revenue DESC LIMIT 10000;`,
      chart_type: 'scatter',
      x_axis: { field: 'order_count', label: 'Popularity (orders)', type: 'numeric' },
      y_axis: { field: 'margin_pct', label: 'Margin %', type: 'percent' },
      series: [{ field: 'revenue', label: 'Revenue (bubble size)', color: '#234A73' }],
      filters_applied: [
        { field: 'status', value: 'completed' },
        { field: 'order_date', value: 'trailing_12_months' },
        { field: 'active', value: 'true' },
      ],
      drill_down_hint: 'Hovering shows item details. Clicking an item filters to its order history.',
      follow_up_suggestions: [
        'Filter to a specific category',
        'Show only items below the margin median',
        'Identify potential retirement candidates',
      ],
    }),
  },
]
