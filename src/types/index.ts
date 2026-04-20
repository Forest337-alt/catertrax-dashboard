// ─── Chart specification ─────────────────────────────────────────────────────

export type ChartType =
  | 'line'
  | 'bar'
  | 'stacked_bar'
  | 'pie'
  | 'kpi_card'
  | 'table'
  | 'heatmap'
  | 'scatter'
  | 'area'

export type AxisType = 'temporal' | 'categorical' | 'numeric'
export type ValueType = 'currency' | 'numeric' | 'percent' | 'text'

export interface AxisSpec {
  field: string
  label: string
  type: AxisType | ValueType
}

export interface SeriesSpec {
  field: string
  label: string
  color?: string
}

export interface FilterApplied {
  field: string
  value: string
}

export interface ChartSpec {
  title: string
  description: string
  sql: string
  chart_type: ChartType
  x_axis?: AxisSpec
  y_axis?: AxisSpec
  series?: SeriesSpec[]
  filters_applied?: FilterApplied[]
  drill_down_hint?: string
  follow_up_suggestions?: string[]
}

// ─── Session / user ──────────────────────────────────────────────────────────

export interface SessionUser {
  id: string
  display_name: string
}

// ─── Saved views ─────────────────────────────────────────────────────────────

export interface SavedView {
  id: string
  session_user_id: string
  name: string
  description: string | null
  chart_spec: ChartSpec
  sql_query: string
  is_suggested: boolean
  created_at: string
  updated_at: string
}

// ─── Custom dashboards ───────────────────────────────────────────────────────

export interface DashboardLayoutItem {
  view_id: string
  position: { x: number; y: number; w: number; h: number }
}

export interface CustomDashboard {
  id: string
  session_user_id: string
  name: string
  description: string | null
  layout: DashboardLayoutItem[]
  created_at: string
  updated_at: string
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  chart_spec?: ChartSpec
  error?: string
  timestamp: Date
}

// ─── Query log ───────────────────────────────────────────────────────────────

export interface QueryLog {
  id: string
  session_user_id: string | null
  user_prompt: string
  generated_sql: string | null
  chart_spec: ChartSpec | null
  status: 'success' | 'validation_failed' | 'execution_failed' | 'timeout'
  error_message: string | null
  row_count: number | null
  execution_ms: number | null
  created_at: string
}

// ─── Email digest ─────────────────────────────────────────────────────────────

export interface EmailDigest {
  id: string
  session_user_id: string
  dashboard_id: string
  recipient_email: string
  schedule_cron: string
  last_sent_at: string | null
  active: boolean
}
