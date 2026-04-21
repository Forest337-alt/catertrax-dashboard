import React, { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { format, differenceInCalendarDays } from 'date-fns'
import AppShell from '../components/common/AppShell'
import { supabase, executeQuery } from '../lib/supabase'
import { Skeleton } from '../components/common/Skeleton'
import KpiCard from '../components/dashboard/KpiCard'
import MiniChart from '../components/dashboard/MiniChart'
import ChartRenderer from '../components/dashboard/ChartRenderer'
import DateRangeSelector from '../components/dashboard/DateRangeSelector'
import type { DateRangeValue } from '../components/dashboard/DateRangeSelector'
import { STANDARD_PRESETS, calcComparisonRange } from '../components/dashboard/DateRangeSelector/presetResolver'
import { useDashboardKpis } from '../lib/useDashboardKpis'
import type { DashboardKpis } from '../lib/useDashboardKpis'
import { generateView } from '../lib/claude'
import { useSession } from '../lib/session'
import type { SavedView, ChartSpec, ChatMessage, ValueType } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const SITE_ID = import.meta.env.VITE_DEMO_SITE_ID as string

const CATEGORY_LABELS: Record<string, string> = {
  orders_revenue:  'Orders & Revenue',
  adoption_growth: 'Program Adoption & Growth',
  menu_mix:        'Menu & Product Mix',
  financial:       'Financial & Forecasting',
}

const CATEGORY_ORDER = ['orders_revenue', 'adoption_growth', 'menu_mix', 'financial']

const LEGACY_TAG_MAP: Record<string, string> = {
  revenue:   'orders_revenue',
  adoption:  'adoption_growth',
  menu:      'menu_mix',
  financials: 'financial',
}

const CHART_ICONS: Record<string, string> = {
  line: '📈', area: '📉', bar: '📊', stacked_bar: '📊',
  pie: '🥧', kpi_card: '🎯', table: '📋', heatmap: '🔥', scatter: '⚬',
}

// ─── Date range helpers ────────────────────────────────────────────────────────

/** Initialise DateRangeValue for last-30-days with prior-period comparison. */
function makeDefaultDateRange(): DateRangeValue {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const p = STANDARD_PRESETS.find((p) => p.id === 'last_30')!
  const [start, end] = p.resolve({
    now: new Date(), timezone: tz,
    fiscalYearStartMonth: 1, weekStartsOn: 0, excludeToday: true,
  })
  const comp = calcComparisonRange(start, end, 'prior_period')!
  return {
    preset: 'last_30', start, end, comparison: 'prior_period',
    excludeToday: true, timezone: tz,
    compStart: comp[0], compEnd: comp[1],
  }
}

/** Format a Date to 'yyyy-MM-dd' for SQL injection. */
const toSql = (d: Date) => format(d, 'yyyy-MM-dd')

/** Human-readable label for the date range in pane headers. */
function formatRangeLabel(start: Date, end: Date): string {
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
}

/** Generate dynamic Revenue Trend SQL — groups by day/month/quarter based on range span. */
function buildRevenueTrendSql(start: Date, end: Date): { sql: string; label: string; xLabel: string } {
  const s = toSql(start)
  const e = toSql(end)
  const days = differenceInCalendarDays(end, start) + 1

  if (days <= 35) {
    return {
      label: 'Revenue by Day',
      xLabel: 'Date',
      sql: `SELECT TO_CHAR(d.day, 'MM/DD') AS month,
                   COALESCE(ROUND(SUM(o.total), 0), 0) AS revenue
             FROM generate_series('${s}'::date, '${e}'::date, INTERVAL '1 day') AS d(day)
             LEFT JOIN orders o
               ON o.order_date::date = d.day
               AND o.site_id = '${SITE_ID}'
               AND o.status = 'completed'
             GROUP BY d.day ORDER BY d.day LIMIT 500`,
    }
  }
  if (days <= 400) {
    return {
      label: 'Revenue by Month',
      xLabel: 'Month',
      sql: `SELECT TO_CHAR(m.month, 'YYYY-MM') AS month,
                   COALESCE(ROUND(SUM(o.total), 0), 0) AS revenue
             FROM generate_series(
               DATE_TRUNC('month', '${s}'::date),
               DATE_TRUNC('month', '${e}'::date),
               INTERVAL '1 month'
             ) AS m(month)
             LEFT JOIN orders o
               ON DATE_TRUNC('month', o.order_date) = m.month
               AND o.site_id = '${SITE_ID}'
               AND o.status = 'completed'
             GROUP BY m.month ORDER BY m.month LIMIT 500`,
    }
  }
  return {
    label: 'Revenue by Quarter',
    xLabel: 'Quarter',
    sql: `SELECT TO_CHAR(DATE_TRUNC('quarter', o.order_date), 'YYYY "Q"Q') AS month,
                 ROUND(SUM(o.total), 0) AS revenue
           FROM orders o
           WHERE o.site_id = '${SITE_ID}' AND o.status = 'completed'
             AND o.order_date >= '${s}'::date AND o.order_date <= '${e}'::date
           GROUP BY DATE_TRUNC('quarter', o.order_date) ORDER BY 1 LIMIT 500`,
  }
}

/** Generate dynamic Top Accounts SQL for the selected date range. */
function buildTopAccountsSql(start: Date, end: Date): string {
  return `SELECT a.name AS account, ROUND(SUM(o.total), 0) AS revenue
          FROM orders o
          JOIN accounts a ON a.id = o.account_id
          WHERE o.site_id = '${SITE_ID}' AND o.status = 'completed'
            AND o.order_date >= '${toSql(start)}'::date
            AND o.order_date <= '${toSql(end)}'::date
          GROUP BY a.name ORDER BY revenue DESC LIMIT 5`
}

// ─── Chart specs (static structure, SQL is generated dynamically) ─────────────

function buildRevenueTrendSpec(label: string, xLabel: string): ChartSpec {
  return {
    title: label, description: '',
    sql: '', chart_type: 'area',
    x_axis: { field: 'month', label: xLabel, type: 'temporal' },
    y_axis: { field: 'revenue', label: 'Revenue', type: 'currency' },
    series: [{ field: 'revenue', label: 'Revenue', color: '#234A73' }],
  }
}

const TOP_ACCOUNTS_SPEC: ChartSpec = {
  title: 'Top 5 Accounts', description: '',
  sql: '', chart_type: 'bar',
  x_axis: { field: 'account', label: 'Account', type: 'categorical' },
  y_axis: { field: 'revenue', label: 'Revenue', type: 'currency' },
  series: [{ field: 'revenue', label: 'Revenue', color: '#4582A9' }],
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Gallery() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useSession()

  // Date range — drives Overview pane KPIs and mini charts
  const [dateRange, setDateRange] = useState<DateRangeValue>(makeDefaultDateRange)

  const { kpis, loading: kpisLoading } = useDashboardKpis(dateRange)

  // Suggested views
  const [views, setViews] = useState<SavedView[]>([])
  const [viewsLoading, setViewsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedKpiTabId, setSelectedKpiTabId] = useState<string | null>(null)

  // AI state
  const [aiBarInput, setAiBarInput] = useState('')
  const [aiSpec, setAiSpec] = useState<ChartSpec | null>(null)
  const [aiData, setAiData] = useState<Record<string, unknown>[]>([])
  const [aiDataLoading, setAiDataLoading] = useState(false)
  const [aiHistory, setAiHistory] = useState<ChatMessage[]>([])
  const [aiThinking, setAiThinking] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Reset to overview when logo is clicked (location.state.reset signal)
  useEffect(() => {
    if ((location.state as { reset?: number } | null)?.reset) {
      setSelectedId(null)
      setSelectedKpiTabId(null)
      setAiSpec(null)
      setAiHistory([])
      setAiError(null)
    }
  }, [(location.state as { reset?: number } | null)?.reset])

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Collapsed sidebar sections (tag → true means collapsed)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  function toggleSection(tag: string) {
    setCollapsedSections((prev) => ({ ...prev, [tag]: !prev[tag] }))
  }

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('saved_views')
        .select('*')
        .eq('is_suggested', true)
        .order('created_at', { ascending: true })
      setViews((data ?? []) as SavedView[])
      setViewsLoading(false)
    }
    load()
  }, [])

  const grouped = views.reduce<Record<string, SavedView[]>>((acc, view) => {
    const rawTag = view.chart_spec.meta?.tab
      ?? (view.description ?? '').match(/\[(\w+)\]/)?.[1]
      ?? 'other'
    const tag = LEGACY_TAG_MAP[rawTag] ?? rawTag
    ;(acc[tag] ??= []).push(view)
    return acc
  }, {})

  const sortedCategories = CATEGORY_ORDER.filter((k) => grouped[k]).concat(
    Object.keys(grouped).filter((k) => !CATEGORY_ORDER.includes(k))
  )

  const selectedView = views.find((v) => v.id === selectedId) ?? null

  function handleSelectView(id: string) {
    setSelectedId(id)
    setSelectedKpiTabId(null)
    setAiSpec(null)
    setAiData([])
    setAiHistory([])
    setAiError(null)
    setSidebarOpen(false)
  }

  function handleSelectKpiTab(tabId: string) {
    setSelectedKpiTabId(tabId)
    setSelectedId(null)
    setAiSpec(null)
    setAiData([])
    setAiHistory([])
    setAiError(null)
    setSidebarOpen(false)
  }

  async function handleAiSubmit(userInput: string) {
    if (!userInput.trim() || aiThinking || !user) return
    setSelectedId(null)
    setSelectedKpiTabId(null)
    setSidebarOpen(false)
    setAiThinking(true)
    setAiError(null)

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userInput,
      timestamp: new Date(),
    }
    setAiHistory((h) => [...h, userMsg])

    const result = await generateView(userInput, aiHistory, user.id, SITE_ID)

    if ('spec' in result) {
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Here's "${result.spec.title}" — ${result.spec.description}`,
        chart_spec: result.spec,
        timestamp: new Date(),
      }
      setAiHistory((h) => [...h, aiMsg])
      setAiSpec(result.spec)
      setAiDataLoading(true)
      try {
        const rows = await executeQuery(result.spec.sql, user.id)
        setAiData(rows)
      } catch (e) {
        setAiError(e instanceof Error ? e.message : 'Query failed')
      } finally {
        setAiDataLoading(false)
      }
    } else {
      const msg = result.clarifying_question || result.error
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: msg,
        timestamp: new Date(),
      }
      setAiHistory((h) => [...h, aiMsg])
      setAiError(msg)
    }

    setAiThinking(false)
  }

  function handleAiReset() {
    setAiSpec(null)
    setAiData([])
    setAiHistory([])
    setAiError(null)
    setSelectedKpiTabId(null)
  }

  function openSaveModal() {
    setSaveError(null)
    setShowSaveModal(true)
  }

  async function handleAiSave(name: string) {
    if (!aiSpec || !user) return
    setIsSaving(true)
    setSaveError(null)
    const { data: row, error } = await supabase
      .from('saved_views')
      .insert({
        session_user_id: user.id,
        name,
        description: aiSpec.description,
        chart_spec: aiSpec,
        sql_query: aiSpec.sql,
        is_suggested: false,
      })
      .select('id')
      .single()
    setIsSaving(false)
    if (error) {
      setSaveError(error.message)
    } else {
      setShowSaveModal(false)
      navigate(`/view/${(row as { id: string }).id}`)
    }
  }

  // ── Current pane label (for mobile breadcrumb) ────────────────────────────
  const currentTitle = selectedView?.name
    ?? (selectedKpiTabId
      ? `${CATEGORY_LABELS[selectedKpiTabId] ?? selectedKpiTabId} — Key Metrics`
      : aiSpec
        ? aiSpec.title
        : 'Dashboard Overview')

  return (
    <AppShell className="flex overflow-hidden">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed top-14 left-0 right-0 bottom-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Left sidebar ── */}
      <aside className={[
        'fixed top-14 left-0 bottom-0 z-40 w-72',
        'flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden',
        'transition-transform duration-200 ease-in-out',
        'md:static md:w-60 md:transform-none md:z-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}>
        <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Suggested Views</p>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {viewsLoading ? (
            <SidebarSkeleton />
          ) : (
            sortedCategories.map((tag) => {
              const tabViews = grouped[tag] ?? []
              const kpiViews = tabViews.filter((v) => v.chart_spec.chart_type === 'kpi_card')
              const chartViews = tabViews.filter((v) => v.chart_spec.chart_type !== 'kpi_card')
              const kpiSelected = selectedKpiTabId === tag
              return (
                <div key={tag} className="mb-1">
                  <button
                    onClick={() => toggleSection(tag)}
                    className="w-full flex items-center gap-1 px-4 py-1.5 text-left hover:bg-gray-100 transition-colors group"
                  >
                    <ChevronDown className={[
                      'w-3 h-3 text-gray-400 flex-shrink-0 transition-transform duration-150',
                      collapsedSections[tag] ? '-rotate-90' : '',
                    ].join(' ')} />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {CATEGORY_LABELS[tag] ?? tag}
                    </span>
                  </button>

                  {!collapsedSections[tag] && (
                    <>
                      {kpiViews.length > 0 && (
                        <button
                          onClick={() => handleSelectKpiTab(tag)}
                          className={[
                            'w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors',
                            kpiSelected
                              ? 'bg-primary-800 text-white'
                              : 'text-gray-700 hover:bg-gray-100',
                          ].join(' ')}
                        >
                          <span className="flex-shrink-0 text-base leading-none">⊞</span>
                          <span className="truncate font-semibold">Key Metrics</span>
                          <span className={[
                            'ml-auto flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full',
                            kpiSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500',
                          ].join(' ')}>
                            {kpiViews.length}
                          </span>
                        </button>
                      )}

                      {chartViews.map((view) => (
                        <button
                          key={view.id}
                          onClick={() => handleSelectView(view.id)}
                          className={[
                            'w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors',
                            selectedId === view.id
                              ? 'bg-primary-800 text-white'
                              : 'text-gray-700 hover:bg-gray-100',
                          ].join(' ')}
                        >
                          <span className="flex-shrink-0 text-base leading-none">
                            {CHART_ICONS[view.chart_spec.chart_type] ?? '📊'}
                          </span>
                          <span className="truncate">{view.name}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )
            })
          )}
        </nav>

      </aside>

      {/* ── Right pane ── */}
      <div className="flex-1 overflow-y-auto bg-white min-w-0">

        {/* ── Sticky top bar ── */}
        <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-100 min-h-[52px]">
          {/* Mobile: hamburger button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-1.5 -ml-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Open views menu"
          >
            <span className="text-xl leading-none">☰</span>
          </button>

          {/* Mobile: current view title */}
          <span className="md:hidden flex-1 text-sm font-semibold text-gray-800 truncate">
            {currentTitle}
          </span>

          {/* Desktop: AI prompt input — takes available space */}
          <form
            className="hidden md:flex flex-1 items-center gap-2 min-w-0"
            onSubmit={(e) => { e.preventDefault(); handleAiSubmit(aiBarInput); setAiBarInput('') }}
          >
            <input
              type="text"
              value={aiBarInput}
              onChange={(e) => setAiBarInput(e.target.value)}
              placeholder='Ask AI: "Show me top accounts by revenue this quarter…"'
              disabled={aiThinking}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-800 focus:border-transparent disabled:opacity-60 bg-gray-50 min-w-0"
            />
            <button
              type="submit"
              disabled={!aiBarInput.trim() || aiThinking}
              className="flex-shrink-0 bg-primary-800 text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {aiThinking ? 'Building…' : 'Build →'}
            </button>
          </form>

          {/* Date range selector — always visible */}
          <DateRangeSelector
            value={dateRange}
            onChange={setDateRange}
            showComparison
            showExcludeToday
            className="flex-shrink-0"
          />
        </div>

        {/* ── Pane content ── */}
        {selectedView ? (
          <ViewDetailPane
            key={selectedView.id}
            view={selectedView}
            dateRange={dateRange}
          />
        ) : selectedKpiTabId ? (
          <KeyMetricsDashboardPane
            key={selectedKpiTabId}
            tabId={selectedKpiTabId}
            label={CATEGORY_LABELS[selectedKpiTabId] ?? selectedKpiTabId}
            views={(grouped[selectedKpiTabId] ?? []).filter((v) => v.chart_spec.chart_type === 'kpi_card')}
            dateRange={dateRange}
          />
        ) : aiSpec ? (
          <AiResultPane
            spec={aiSpec}
            data={aiData}
            dataLoading={aiDataLoading}
            history={aiHistory}
            onSubmit={handleAiSubmit}
            thinking={aiThinking}
            error={aiError}
            onReset={handleAiReset}
            onSave={openSaveModal}
          />
        ) : (
          <OverviewPane
            kpis={kpis}
            kpisLoading={kpisLoading}
            dateRange={dateRange}
          />
        )}
      </div>

      {showSaveModal && aiSpec && (
        <SaveViewModal
          defaultName={aiSpec.title}
          isSaving={isSaving}
          error={saveError}
          onConfirm={handleAiSave}
          onClose={() => setShowSaveModal(false)}
        />
      )}

    </AppShell>
  )
}

// ─── Date range badge (shared by non-overview panes) ─────────────────────────

function DateRangeBadge({ start, end }: { start: Date; end: Date }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-primary-800 bg-primary-50 border border-primary-200 px-2.5 py-1 rounded-full">
      <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      {formatRangeLabel(start, end)}
    </span>
  )
}

// ─── Overview pane ────────────────────────────────────────────────────────────

function OverviewPane({
  kpis,
  kpisLoading,
  dateRange,
}: {
  kpis: DashboardKpis
  kpisLoading: boolean
  dateRange: DateRangeValue
}) {
  // Derive comparison label for KPI trend text
  const compLabel =
    dateRange.comparison === 'prior_year' ? 'vs prior year' :
    dateRange.comparison === 'prior_period' ? 'vs prior period' :
    'vs prior period'

  // Dynamic mini-chart SQL based on selected date range
  const { sql: trendSql, label: trendLabel, xLabel } = buildRevenueTrendSql(dateRange.start, dateRange.end)
  const topAccountsSql = buildTopAccountsSql(dateRange.start, dateRange.end)
  const trendSpec = buildRevenueTrendSpec(trendLabel, xLabel)

  return (
    <div className="px-4 pt-4 pb-20 sm:px-8 sm:pt-8 sm:pb-24 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="mt-1 text-gray-500">
          Live metrics for CaterTrax Demo Site #1 — select a view from the left to explore.
        </p>
      </div>

      {/* KPI cards — driven by the selected date range */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Revenue"        value={kpis.revenue}    type="currency" loading={kpisLoading} trend={kpis.revenueTrend}    trendLabel={compLabel} />
        <KpiCard label="Orders"         value={kpis.orderCount} type="numeric"  loading={kpisLoading} trend={kpis.orderCountTrend} trendLabel={compLabel} />
        <KpiCard label="On-time rate"   value={kpis.onTimeRate} type="percent"  loading={kpisLoading} trend={kpis.onTimeRateTrend} trendLabel={compLabel} />
        <KpiCard label="Avg order value" value={kpis.aov}       type="currency" loading={kpisLoading} trend={kpis.aovTrend}        trendLabel={compLabel} />
      </div>

      {/* Mini charts — driven by the selected date range */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <MiniChart
          key={`trend-${toSql(dateRange.start)}-${toSql(dateRange.end)}`}
          title={trendLabel}
          sql={trendSql}
          spec={trendSpec}
        />
        <MiniChart
          key={`accounts-${toSql(dateRange.start)}-${toSql(dateRange.end)}`}
          title="Top 5 Accounts by Revenue"
          sql={topAccountsSql}
          spec={TOP_ACCOUNTS_SPEC}
        />
      </div>

    </div>
  )
}

// ─── AI result pane ───────────────────────────────────────────────────────────

function AiResultPane({
  spec,
  data,
  dataLoading,
  history,
  onSubmit,
  thinking,
  error,
  onReset,
  onSave,
}: {
  spec: ChartSpec
  data: Record<string, unknown>[]
  dataLoading: boolean
  history: ChatMessage[]
  onSubmit: (text: string) => void
  thinking: boolean
  error: string | null
  onReset: () => void
  onSave: () => void
}) {
  const [input, setInput] = useState('')
  const lastUserMsg = [...history].reverse().find((m) => m.role === 'user')

  function handleSubmit() {
    if (!input.trim()) return
    onSubmit(input)
    setInput('')
  }

  return (
    <div className="px-4 pt-4 pb-20 sm:px-8 sm:pt-8 sm:pb-24 max-w-5xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-3">
        <div className="min-w-0">
          <button
            onClick={onReset}
            className="text-xs text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1 transition-colors"
          >
            ← Back to overview
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
              {spec.chart_type.replace('_', ' ')}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{spec.title}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{spec.description}</p>
          {lastUserMsg && (
            <p className="mt-1 text-xs text-gray-400">From: "{lastUserMsg.content}"</p>
          )}
        </div>
        <button
          onClick={onSave}
          className="flex-shrink-0 bg-primary-800 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Save view
        </button>
      </div>

      {/* Chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <ChartRenderer spec={spec} data={data} loading={dataLoading} />
      </div>

      {/* Follow-up */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <p className="text-sm font-medium text-gray-700 mb-3">Refine or ask a follow-up</p>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            placeholder='e.g. "Break this down by account type"'
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-800 focus:border-transparent disabled:opacity-60"
            disabled={thinking}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || thinking}
            className="flex-shrink-0 bg-primary-800 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {thinking ? '…' : 'Send'}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {spec.follow_up_suggestions && spec.follow_up_suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {spec.follow_up_suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => setInput(s)}
                className="text-xs text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:border-primary-300 hover:text-primary-800 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-gray-400">
          Want the full conversation experience?{' '}
          <Link to="/view/new" className="text-primary-800 hover:underline">
            Open AI Builder →
          </Link>
        </p>
      </div>
    </div>
  )
}

// ─── View detail pane ─────────────────────────────────────────────────────────

function ViewDetailPane({ view, dateRange }: { view: SavedView; dateRange: DateRangeValue }) {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    executeQuery(view.sql_query)
      .then((rows) => { if (!cancelled) { setData(rows); setLoading(false) } })
      .catch((err) => { if (!cancelled) { setError(err instanceof Error ? err.message : 'Query failed'); setLoading(false) } })
    return () => { cancelled = true }
  }, [view.sql_query])

  return (
    <div className="px-4 pt-4 pb-20 sm:px-8 sm:pt-8 sm:pb-24 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
              {view.chart_spec.chart_type.replace('_', ' ')}
            </span>
            <DateRangeBadge start={dateRange.start} end={dateRange.end} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 truncate">{view.name}</h1>
          <p className="mt-1 text-gray-500 text-sm">{view.chart_spec.description}</p>
        </div>
        <Link
          to={`/view/${view.id}`}
          className="flex-shrink-0 text-sm font-medium text-primary-800 border border-primary-200 px-4 py-2 rounded-lg hover:bg-primary-50 transition-colors whitespace-nowrap"
        >
          Open in builder →
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <ChartRenderer spec={view.chart_spec} data={data} loading={loading} />
        </div>
      )}
    </div>
  )
}

// ─── Save view modal ──────────────────────────────────────────────────────────

function SaveViewModal({
  defaultName,
  isSaving,
  error,
  onConfirm,
  onClose,
}: {
  defaultName: string
  isSaving: boolean
  error: string | null
  onConfirm: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(defaultName)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || isSaving) return
    onConfirm(name.trim())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Save this view</h2>
        <p className="text-sm text-gray-500 mb-5">
          Give it a name and it will appear in your saved views.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">View name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-800 focus:border-transparent"
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          />

          {error && (
            <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="text-sm font-medium text-gray-600 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSaving}
              className="text-sm font-semibold text-white bg-primary-800 px-5 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving…' : 'Save view'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Key metrics dashboard pane ───────────────────────────────────────────────

const METRIC_ACCENTS = ['#234A73', '#4582A9', '#5B9EC9', '#76a4c4']

function formatMetricValue(value: number | null, type: string): string {
  if (value === null || isNaN(Number(value))) return '—'
  const num = Number(value)
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD',
        minimumFractionDigits: 0, maximumFractionDigits: 0,
        notation: Math.abs(num) >= 100_000 ? 'compact' : 'standard',
      }).format(num)
    case 'percent':
      return `${num.toFixed(1)}%`
    default:
      return new Intl.NumberFormat('en-US', {
        notation: Math.abs(num) >= 10_000 ? 'compact' : 'standard',
      }).format(num)
  }
}

type MetricState = {
  view: SavedView
  value: number | null
  priorValue: number | null
  loading: boolean
  error: string | null
}

function KeyMetricsDashboardPane({ tabId, label, views, dateRange }: {
  tabId: string
  label: string
  views: SavedView[]
  dateRange: DateRangeValue
}) {
  const [metrics, setMetrics] = useState<MetricState[]>(
    views.map((v) => ({ view: v, value: null, priorValue: null, loading: true, error: null }))
  )

  useEffect(() => {
    if (views.length === 0) return
    setMetrics(views.map((v) => ({ view: v, value: null, priorValue: null, loading: true, error: null })))

    views.forEach((view, i) => {
      executeQuery(view.sql_query)
        .then((rows) => {
          const row = (rows[0] ?? {}) as Record<string, unknown>
          const primaryField = view.chart_spec.y_axis?.field ?? ''
          const value = row[primaryField] != null ? Number(row[primaryField]) : null
          const priorKey = Object.keys(row).find((k) => k.startsWith('prior_'))
          const priorValue = priorKey && row[priorKey] != null ? Number(row[priorKey]) : null
          setMetrics((prev) => prev.map((m, idx) =>
            idx === i ? { ...m, value, priorValue, loading: false } : m
          ))
        })
        .catch((err) => {
          setMetrics((prev) => prev.map((m, idx) =>
            idx === i
              ? { ...m, error: err instanceof Error ? err.message : 'Query failed', loading: false }
              : m
          ))
        })
    })
  }, [tabId]) // eslint-disable-line react-hooks/exhaustive-deps

  const TAB_DESCRIPTIONS: Record<string, string> = {
    orders_revenue:  'Top-line performance — revenue, volume, AOV, and fulfillment at a glance.',
    adoption_growth: 'Program health — active accounts, new acquisition, and repeat behaviour.',
    menu_mix:        'Menu vitals — catalog size, revenue concentration, and average margin.',
    financial:       'Financial pulse — revenue, budget attainment, margin, and food cost.',
  }

  const gridCols =
    views.length <= 2 ? 'grid-cols-2' :
    views.length === 3 ? 'grid-cols-2 md:grid-cols-3' :
    'grid-cols-2 lg:grid-cols-4'

  return (
    <div className="px-4 pt-4 pb-20 sm:px-8 sm:pt-8 sm:pb-24 max-w-5xl">
      {/* Header */}
      <div className="mb-7">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
          <DateRangeBadge start={dateRange.start} end={dateRange.end} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Key Metrics</h1>
        <p className="mt-1 text-sm text-gray-500">{TAB_DESCRIPTIONS[tabId] ?? 'Summary metrics for this category.'}</p>
      </div>

      {/* Metric grid */}
      <div className={`grid ${gridCols} gap-4`}>
        {metrics.map(({ view, value, priorValue, loading, error }, i) => {
          const type = (view.chart_spec.y_axis?.type ?? 'numeric') as ValueType
          const accent = METRIC_ACCENTS[i % METRIC_ACCENTS.length]

          let trend: number | null = null
          if (value !== null && priorValue !== null && priorValue !== 0) {
            trend = ((value - priorValue) / priorValue) * 100
          }

          return (
            <div key={view.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="h-1.5" style={{ backgroundColor: accent }} />

              <div className="p-5">
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-9 w-3/4 mt-1" />
                    <Skeleton className="h-5 w-24 mt-2 rounded-full" />
                  </div>
                ) : error ? (
                  <p className="text-xs text-red-500 mt-1">{error}</p>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 leading-tight">
                      {view.name}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight mb-3">
                      {formatMetricValue(value, type)}
                    </p>
                    {trend !== null ? (
                      <span className={[
                        'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full',
                        trend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600',
                      ].join(' ')}>
                        {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
                        <span className="font-normal text-gray-400 ml-0.5">vs prior year</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs text-gray-400 px-2.5 py-1 rounded-full bg-gray-50">
                        No prior-year data
                      </span>
                    )}
                    <p className="mt-3 text-xs text-gray-400 leading-relaxed">
                      {view.chart_spec.description}
                    </p>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Select an individual view from the sidebar to explore charts and tables for this category.
      </p>
    </div>
  )
}

// ─── Sidebar skeleton ─────────────────────────────────────────────────────────

function SidebarSkeleton() {
  return (
    <div className="px-4 py-3 space-y-4">
      {[4, 3, 2].map((count, gi) => (
        <div key={gi}>
          <Skeleton className="h-3 w-24 mb-2" />
          {Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full mb-1 rounded-none" />
          ))}
        </div>
      ))}
    </div>
  )
}
