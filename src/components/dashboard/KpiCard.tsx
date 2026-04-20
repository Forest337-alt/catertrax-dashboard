import { Skeleton } from '../common/Skeleton'
import type { ValueType } from '../../types'

function formatKpi(value: number | null, type: ValueType): string {
  if (value === null) return '—'

  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        notation: value >= 100_000 ? 'compact' : 'standard',
      }).format(value)
    case 'percent':
      return `${value.toFixed(1)}%`
    case 'numeric':
      return new Intl.NumberFormat('en-US').format(value)
    default:
      return String(value)
  }
}

interface Props {
  label: string
  value: number | null
  type: ValueType
  loading: boolean
  icon?: string
  trend?: number | null
  trendLabel?: string
}

export default function KpiCard({ label, value, type, loading, icon, trend, trendLabel }: Props) {
  const hasTrend = trend !== null && trend !== undefined

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
      {loading ? (
        <>
          <Skeleton className="h-4 w-4 rounded-full mb-1" />
          <Skeleton className="h-9 w-28 mt-1" />
          <Skeleton className="h-4 w-36 mt-2" />
          <Skeleton className="h-4 w-24 mt-1" />
        </>
      ) : (
        <>
          {icon && <span className="text-xl leading-none mb-1">{icon}</span>}
          <p className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight">
            {formatKpi(value, type)}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          {hasTrend && (
            <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${trend >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
              <span>{trend >= 0 ? '↑' : '↓'}</span>
              <span>{Math.abs(trend).toFixed(1)}%</span>
              {trendLabel && (
                <span className="text-gray-400 font-normal">{trendLabel}</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
