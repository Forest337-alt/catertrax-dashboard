import type { InsightEvidence } from '../../types'

export default function EvidenceGrid({ evidence }: { evidence: InsightEvidence[] }) {
  if (!evidence.length) return null
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      {evidence.map((item, i) => (
        <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
          <p className="text-sm font-semibold text-gray-800 tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  )
}
