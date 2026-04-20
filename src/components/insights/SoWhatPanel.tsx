import type { Insight, InsightFeedbackAction } from '../../types'
import InsightCard from './InsightCard'

interface Props {
  insights: Insight[]
  loading: boolean
  onAction: (insightId: string, action: InsightFeedbackAction) => void
  onClose: () => void
}

export default function SoWhatPanel({ insights, loading, onAction, onClose }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Insights</h2>
            {!loading && (
              <p className="text-xs text-gray-400 mt-0.5">
                {insights.length === 0
                  ? 'No active insights right now'
                  : `${insights.length} active insight${insights.length !== 1 ? 's' : ''}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1.5 rounded hover:bg-gray-100 transition-colors"
            aria-label="Close insights panel"
          >
            ✕
          </button>
        </div>

        {/* Insight list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <PanelSkeleton />
          ) : insights.length === 0 ? (
            <EmptyState />
          ) : (
            insights.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onAction={onAction}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <p className="text-xs text-gray-400">
            Insights are generated nightly. Dismissed insights won't reappear.
          </p>
        </div>
      </div>
    </>
  )
}

function PanelSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex gap-2 mb-2">
            <div className="h-4 w-12 bg-gray-200 rounded-full" />
            <div className="h-4 w-20 bg-gray-100 rounded-full" />
          </div>
          <div className="h-4 w-4/5 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400">
      <p className="text-sm font-medium text-gray-500">All metrics look healthy</p>
      <p className="text-xs mt-1">Check back after the next nightly generation cycle.</p>
    </div>
  )
}
