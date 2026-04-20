import { useState, useEffect } from 'react'
import ChartRenderer from './ChartRenderer'
import type { ChartSpec } from '../../types'
import { executeQuery } from '../../lib/supabase'

interface Props {
  title: string
  sql: string
  spec: ChartSpec
}

export default function MiniChart({ title, sql, spec }: Props) {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      try {
        const rows = await executeQuery(sql)
        if (!cancelled) setData(rows)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load chart')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [sql])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      {error ? (
        <div className="flex items-center justify-center h-48 text-sm text-red-500">{error}</div>
      ) : (
        <ChartRenderer spec={spec} data={data} loading={loading} />
      )}
    </div>
  )
}
