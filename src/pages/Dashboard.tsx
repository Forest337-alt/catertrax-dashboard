import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import AppShell from '../components/common/AppShell'
import ChartRenderer from '../components/dashboard/ChartRenderer'
import { supabase, executeQuery } from '../lib/supabase'
import { ChartSkeleton } from '../components/common/Skeleton'
import type { CustomDashboard, SavedView, ChartSpec } from '../types'

// Phase 4 will replace these with react-grid-layout drag-drop.
// For now: simple responsive grid.

interface PanelState {
  view: SavedView
  data: Record<string, unknown>[]
  loading: boolean
  error: string | null
}

export default function Dashboard() {
  const { id } = useParams()
  const [dashboard, setDashboard] = useState<CustomDashboard | null>(null)
  const [panels, setPanels] = useState<PanelState[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    async function load() {
      const { data: db, error } = await supabase
        .from('custom_dashboards')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !db) {
        setLoading(false)
        return
      }

      const dash = db as CustomDashboard
      setDashboard(dash)

      // Load all views referenced in the layout
      const viewIds = dash.layout.map((l) => l.view_id)
      const { data: viewRows } = await supabase
        .from('saved_views')
        .select('*')
        .in('id', viewIds)

      const views = (viewRows ?? []) as SavedView[]

      // Initialize panels
      const initialPanels: PanelState[] = views.map((v) => ({
        view: v,
        data: [],
        loading: true,
        error: null,
      }))
      setPanels(initialPanels)
      setLoading(false)

      // Fetch data for each panel
      views.forEach(async (view, i) => {
        try {
          const rows = await executeQuery(view.chart_spec.sql)
          setPanels((prev) =>
            prev.map((p, idx) => (idx === i ? { ...p, data: rows, loading: false } : p))
          )
        } catch (err) {
          setPanels((prev) =>
            prev.map((p, idx) =>
              idx === i
                ? { ...p, loading: false, error: err instanceof Error ? err.message : 'Query failed' }
                : p
            )
          )
        }
      })
    }
    load()
  }, [id])

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-screen-xl mx-auto px-4 py-8 grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200">
              <ChartSkeleton />
            </div>
          ))}
        </div>
      </AppShell>
    )
  }

  if (!dashboard) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-gray-400">
          Dashboard not found.
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell className="px-4 sm:px-6 lg:px-8 py-6 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{dashboard.name}</h1>
        {dashboard.description && (
          <p className="text-gray-500 mt-1 text-sm">{dashboard.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {panels.map((panel) => (
          <DashboardPanel key={panel.view.id} panel={panel} />
        ))}
      </div>
    </AppShell>
  )
}

function DashboardPanel({ panel }: { panel: PanelState }) {
  const spec: ChartSpec = panel.view.chart_spec

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 text-sm mb-1">{spec.title}</h3>
      <p className="text-xs text-gray-400 mb-3">{spec.description}</p>
      {panel.error ? (
        <div className="text-xs text-red-500 py-4 text-center">{panel.error}</div>
      ) : (
        <ChartRenderer spec={spec} data={panel.data} loading={panel.loading} />
      )}
    </div>
  )
}
