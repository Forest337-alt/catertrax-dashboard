import type React from 'react'
import clsx from 'clsx'

interface Props {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className }: Props) {
  return (
    <div className={clsx('animate-pulse bg-gray-200 rounded', className)} />
  )
}

export function ChartSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="mt-6 space-y-3">
        {[80, 60, 90, 70, 85, 55, 75].map((w, i) => (
          <div key={i} className="flex items-end gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton style={{ width: `${w}%`, height: '32px' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
