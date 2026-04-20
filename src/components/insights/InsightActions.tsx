import type { InsightFeedbackAction } from '../../types'

interface Props {
  actionLabel: string | null
  onAction: (action: InsightFeedbackAction) => void
}

export default function InsightActions({ actionLabel, onAction }: Props) {
  return (
    <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-gray-100">
      {actionLabel && (
        <button
          onClick={() => onAction('accepted')}
          className="text-xs font-semibold text-white bg-primary-800 px-3 py-1.5 rounded-lg hover:bg-primary-700 transition-colors"
        >
          {actionLabel}
        </button>
      )}
      <button
        onClick={() => onAction('saved')}
        className="text-xs font-medium text-primary-800 border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
      >
        Save for later
      </button>
      <button
        onClick={() => onAction('snoozed')}
        className="text-xs font-medium text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Snooze 7d
      </button>
      <button
        onClick={() => onAction('dismissed')}
        className="text-xs font-medium text-gray-400 px-3 py-1.5 rounded-lg hover:text-gray-600 transition-colors"
      >
        Dismiss
      </button>
    </div>
  )
}
