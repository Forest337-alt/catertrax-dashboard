import { useState } from 'react'
import type { Insight, InsightFeedbackAction } from '../../types'
import EvidenceGrid from './EvidenceGrid'
import InsightActions from './InsightActions'

const BORDER_COLOR: Record<string, string> = {
  high:   'border-l-danger-500',
  medium: 'border-l-warning-600',
  low:    'border-l-secondary-500',
}

const BADGE_STYLE: Record<string, string> = {
  high:   'bg-red-50 text-danger-600',
  medium: 'bg-amber-50 text-warning-600',
  low:    'bg-blue-50 text-secondary-500',
}

interface Props {
  insight: Insight
  onAction: (insightId: string, action: InsightFeedbackAction) => void
}

export default function InsightCard({ insight, onAction }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`border-l-4 ${BORDER_COLOR[insight.priority] ?? 'border-l-gray-300'} bg-white rounded-r-xl border border-l-0 border-gray-200`}
    >
      {/* Header — always visible */}
      <button
        className="w-full text-left px-4 py-3"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${BADGE_STYLE[insight.priority] ?? ''}`}
              >
                {insight.priority}
              </span>
              <span className="text-xs text-gray-400">{insight.category}</span>
            </div>
            <p className="text-sm font-semibold text-gray-900 leading-snug">
              {insight.headline}
            </p>
          </div>
          <span className="flex-shrink-0 text-xs text-gray-400 mt-1">
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <InsightSection label="Observation"     text={insight.observation} />
          <InsightSection label="Interpretation"  text={insight.interpretation} />
          <InsightSection label="Recommendation"  text={insight.recommendation} />
          <EvidenceGrid evidence={insight.evidence} />
          <InsightActions
            actionLabel={insight.action_label}
            onAction={(action) => onAction(insight.id, action)}
          />
        </div>
      )}
    </div>
  )
}

function InsightSection({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
    </div>
  )
}
