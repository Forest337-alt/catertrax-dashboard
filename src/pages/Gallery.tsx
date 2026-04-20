import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/common/AppShell'
import { supabase, executeQuery } from '../lib/supabase'
import { Skeleton } from '../components/common/Skeleton'
import KpiCard from '../components/dashboard/KpiCard'
import MiniChart from '../components/dashboard/MiniChart'
import ChartRenderer from '../components/dashboard/ChartRenderer'
import { useDashboardKpis } from '../lib/useDashboardKpis'
import type { DashboardKpis } from '../lib/useDashboardKpis'
import { generateView } from '../lib/claude'
import { useSession } from '../lib/session'
import type { SavedView, ChartSpec, ChatMessage } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const SITE_ID = import.meta.env.VITE_DEMO_SITE_ID as string

const CATEGORY_LABELS: Record<string, string> = {
  revenue: 'Orders & Revenue',
  adoption: 'Program Adoption',
  menu: 'Menu Mix',
  financials: 'Financials',
}

const CATEGORY_ORDER = ['revenue', 'adoption', 'menu', 'financials']

const CHART_ICONS: Record<string, string> = {
  line: '📈', area: '📉', bar: '📊', stacked_bar: '📊',
  pie: '🥧', kpi_card: '🎯', table: '📋', heatmap: '🔥', scatter: '⚬',
}

const REVENUE_TREND_SPEC: ChartSpec = {
  title: 'Revenue Trend', description: 'Monthly revenue for the last 6 months',
  sql: '', chart_type: 'area',
  x_axis: { field: 'month', label: 'Month', type: 'temporal' },
  y_axis: { field: 'revenue', label: 'Revenue', type: 'currency' },
  series: [{ field: 'revenue', label: 'Revenue', color: '#234A73' }],
}

const TOP_ACCOUNTS_SPEC: ChartSpec = {
  title: 'Top 5 Accounts', description: 'Top accounts by total revenue (all time)',
  sql: '', chart_type: 'bar',
  x_axis: { field: 'account', label: 'Account', type: 'categorical' },
  y_axis: { field: 'revenue', label: 'Revenue', type: 'currency' },
  series: [{ field: 'revenue', label: 'Revenue', color: '#4582A9' }],
}

const REVENUE_TREND_SQL = `SELECT TO_CHAR(DATE_TRUNC('month', order_date), 'YYYY-MM') AS month, ROUND(SUM(total), 0) AS revenue FROM orders WHERE site_id = '${SITE_ID}' AND status = 'completed' AND order_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months' GROUP BY 1 ORDER BY 1`

const TOP_ACCOUNTS_SQL = `SELECT a.name AS account, ROUND(SUM(o.total), 0) AS revenue FROM orders o JOIN accounts a ON a.id = o.account_id WHERE o.site_id = '${SITE_ID}' AND o.status = 'completed' GROUP BY a.name ORDER BY revenue DESC LIMIT 5`

const EXAMPLE_PROMPTS = [
  'Revenue by month this year',
  'Top 10 accounts by order count',
  'Order volume by channel type',
  'Most popular menu items this quarter',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Gallery() {
  const navigate = useNavigate()
  const { user } = useSession()
  const { kpis, loading: kpisLoading } = useDashboardKpis()

  // Suggested views
  const [views, setViews] = useState<SavedView[]>([])
  const [viewsLoading, setViewsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // AI state
  const [aiSpec, setAiSpec] = useState<ChartSpec | null>(null)
  const [aiData, setAiData] = useState<Record<string, unknown>[]>([])
  const [aiDataLoading, setAiDataLoading] = useState(false)
  const [aiHistory, setAiHistory] = useState<ChatMessage[]>([])
  const [aiThinking, setAiThinking] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

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
    const tag = (view.description ?? '').match(/\[(\w+)\]/)?.[1] ?? 'other'
    ;(acc[tag] ??= []).push(view)
    return acc
  }, {})

  const sortedCategories = CATEGORY_ORDER.filter((k) => grouped[k]).concat(
    Object.keys(grouped).filter((k) => !CATEGORY_ORDER.includes(k))
  )

  const selectedView = views.find((v) => v.id === selectedId) ?? null

  function handleSelectView(id: string) {
    setSelectedId(id)
    setAiSpec(null)
    setAiData([])
    setAiHistory([])
    setAiError(null)
  }

  async function handleAiSubmit(userInput: string) {
    if (!userInput.trim() || aiThinking || !user) return
    setSelectedId(null)
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

  return (
    <AppShell className="flex overflow-hidden">

      {/* ── Left sidebar ── */}
      <aside className="w-60 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Suggested Views</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {viewsLoading ? (
            <SidebarSkeleton />
          ) : (
            sortedCategories.map((tag) => (
              <div key={tag} className="mb-3">
                <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {CATEGORY_LABELS[tag] ?? tag}
                </p>
                {(grouped[tag] ?? []).map((view) => (
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
              </div>
            ))
          )}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <Link
            to="/view/new"
            className="block w-full text-center bg-primary-800 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            AI Builder →
          </Link>
        </div>
      </aside>

      {/* ── Right pane ── */}
      <div className="flex-1 overflow-y-auto bg-white">
        {selectedView ? (
          <ViewDetailPane key={selectedView.id} view={selectedView} />
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
            onSubmit={handleAiSubmit}
            thinking={aiThinking}
            error={aiError}
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

// ─── Overview pane ────────────────────────────────────────────────────────────

function OverviewPane({
  kpis,
  kpisLoading,
  onSubmit,
  thinking,
  error,
}: {
  kpis: DashboardKpis
  kpisLoading: boolean
  onSubmit: (text: string) => void
  thinking: boolean
  error: string | null
}) {
  const [input, setInput] = useState('')

  function handleSubmit() {
    if (!input.trim()) return
    onSubmit(input)
    setInput('')
  }

  return (
    <div className="px-8 pt-8 pb-24 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="mt-1 text-gray-500">
          Live metrics for CaterTrax Demo Site #1 — select a view from the left to explore.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Revenue this month"        value={kpis.revenue}    type="currency" loading={kpisLoading} trend={kpis.revenueTrend}    trendLabel="vs same period last mo." />
        <KpiCard label="Orders this month"         value={kpis.orderCount} type="numeric"  loading={kpisLoading} trend={kpis.orderCountTrend} trendLabel="vs same period last mo." />
        <KpiCard label="On-time fulfillment (30d)" value={kpis.onTimeRate} type="percent"  loading={kpisLoading} trend={kpis.onTimeRateTrend} trendLabel="vs prior 30d" />
        <KpiCard label="Avg order value (30d)"     value={kpis.aov}        type="currency" loading={kpisLoading} trend={kpis.aovTrend}        trendLabel="vs prior 30d" />
      </div>

      {/* Mini charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <MiniChart title="Revenue Trend — last 6 months" sql={REVENUE_TREND_SQL} spec={REVENUE_TREND_SPEC} />
        <MiniChart title="Top 5 Accounts by Revenue"     sql={TOP_ACCOUNTS_SQL}  spec={TOP_ACCOUNTS_SPEC} />
      </div>

      {/* AI prompt */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-base font-bold text-gray-900">Ask AI to build a custom view</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Describe any insight in plain English and get a chart instantly.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            placeholder='e.g. "Show me top 10 accounts by revenue this quarter"'
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-800 focus:border-transparent disabled:opacity-60"
            disabled={thinking}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || thinking}
            className="flex-shrink-0 bg-primary-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {thinking ? 'Building…' : 'Build →'}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs text-gray-400">Try:</span>
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => setInput(p)}
              className="text-xs text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:border-primary-300 hover:text-primary-800 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
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
    <div className="px-8 pt-8 pb-24 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
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

function ViewDetailPane({ view }: { view: SavedView }) {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    executeQuery(view.sql_query)
      .then((rows) => { if (!cancelled) { setData(rows); setLoading(false) } })
      .catch((err) => { if (!cancelled) { setError(err instanceof Error ? err.message : 'Query failed'); setLoading(false) } })
    return () => { cancelled = true }
  }, [view.sql_query])

  return (
    <div className="px-8 pt-8 pb-24 max-w-5xl">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
              {view.chart_spec.chart_type.replace('_', ' ')}
            </span>
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
