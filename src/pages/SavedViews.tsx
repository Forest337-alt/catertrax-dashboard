import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/common/AppShell'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { ChartSkeleton } from '../components/common/Skeleton'
import type { SavedView } from '../types'

export default function SavedViews() {
  const { user } = useSession()
  const [views, setViews] = useState<SavedView[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data } = await supabase
        .from('saved_views')
        .select('*')
        .eq('session_user_id', user!.id)
        .eq('is_suggested', false)
        .order('updated_at', { ascending: false })
      setViews((data ?? []) as SavedView[])
      setLoading(false)
    }
    load()
  }, [user])

  async function deleteView(id: string) {
    if (!confirm('Delete this view?')) return
    await supabase.from('saved_views').delete().eq('id', id)
    setViews((v) => v.filter((view) => view.id !== id))
  }

  return (
    <AppShell className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Saved Views</h1>
          <p className="mt-1 text-gray-500">Views you've saved from the AI chat.</p>
        </div>
        <Link
          to="/view/new"
          className="bg-primary-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          + New view
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <ChartSkeleton />
            </div>
          ))}
        </div>
      ) : views.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <span className="text-5xl">📂</span>
          <p className="mt-4 text-lg font-medium">No saved views yet</p>
          <p className="text-sm mt-1">Build a view using the AI chat and save it here.</p>
          <Link
            to="/view/new"
            className="mt-4 inline-block bg-primary-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            Build my first view
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {views.map((view) => (
            <div key={view.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
                  {view.chart_spec.chart_type.replace('_', ' ')}
                </span>
                <button
                  onClick={() => deleteView(view.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors text-sm"
                  title="Delete view"
                >
                  ✕
                </button>
              </div>
              <h3 className="font-semibold text-gray-900">{view.name}</h3>
              <p className="text-sm text-gray-500 mt-1 flex-1 line-clamp-2">
                {view.chart_spec.description}
              </p>
              <div className="mt-4">
                <Link
                  to={`/view/${view.id}`}
                  className="text-sm text-primary-800 font-medium hover:underline"
                >
                  Open view →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  )
}
