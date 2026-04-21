import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { executeQuery } from './supabase'
import type { DateRangeValue } from '../components/dashboard/DateRangeSelector/types'

const SITE_ID = import.meta.env.VITE_DEMO_SITE_ID as string

export interface DashboardKpis {
  revenue: number | null
  orderCount: number | null
  onTimeRate: number | null
  aov: number | null
  revenueTrend: number | null
  orderCountTrend: number | null
  onTimeRateTrend: number | null
  aovTrend: number | null
}

function computeTrend(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null || prior === 0) return null
  return ((current - prior) / prior) * 100
}

/** Build a SQL date filter clause for the given ISO date strings. */
function dateClause(startStr: string, endStr: string): string {
  return `AND order_date >= '${startStr}'::date AND order_date <= '${endStr}'::date`
}

export function useDashboardKpis(dateRange?: DateRangeValue) {
  const [kpis, setKpis] = useState<DashboardKpis>({
    revenue: null, orderCount: null, onTimeRate: null, aov: null,
    revenueTrend: null, orderCountTrend: null, onTimeRateTrend: null, aovTrend: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cache key drives refetch when date range changes
  const startStr  = dateRange?.start      ? format(dateRange.start,      'yyyy-MM-dd') : null
  const endStr    = dateRange?.end        ? format(dateRange.end,        'yyyy-MM-dd') : null
  const cStartStr = dateRange?.compStart  ? format(dateRange.compStart,  'yyyy-MM-dd') : null
  const cEndStr   = dateRange?.compEnd    ? format(dateRange.compEnd,    'yyyy-MM-dd') : null

  useEffect(() => {
    if (!SITE_ID) {
      setError('VITE_DEMO_SITE_ID not configured')
      setLoading(false)
      return
    }

    setLoading(true)

    async function fetchKpis() {
      try {
        // ── Date filter for current period ──────────────────────────────────────
        const primaryFilter = startStr && endStr
          ? dateClause(startStr, endStr)
          : `AND DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE)`

        // ── Date filter for comparison period ───────────────────────────────────
        const compFilter = cStartStr && cEndStr
          ? dateClause(cStartStr, cEndStr)
          : startStr && endStr
            // No comparison period set: shift the primary period back by same length
            ? null
            : `AND order_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
               AND order_date <  DATE_TRUNC('month', CURRENT_DATE)
               AND EXTRACT(DAY FROM order_date) <= EXTRACT(DAY FROM CURRENT_DATE)`

        const [
          revenueRows, countRows, onTimeRows, aovRows,
          prevRevenueRows, prevCountRows, prevOnTimeRows, prevAovRows,
        ] = await Promise.all([
          // ── Current period ────────────────────────────────────────────────────
          executeQuery<{ revenue: string }>(
            `SELECT ROUND(SUM(total), 0) AS revenue
             FROM orders
             WHERE site_id = '${SITE_ID}' AND status = 'completed'
             ${primaryFilter}`
          ),
          executeQuery<{ order_count: string }>(
            `SELECT COUNT(*) AS order_count
             FROM orders
             WHERE site_id = '${SITE_ID}' AND status = 'completed'
             ${primaryFilter}`
          ),
          executeQuery<{ on_time_rate: string }>(
            `SELECT ROUND(AVG(CASE WHEN fulfilled_on_time THEN 1.0 ELSE 0.0 END) * 100, 1) AS on_time_rate
             FROM orders
             WHERE site_id = '${SITE_ID}' AND status = 'completed'
             ${primaryFilter}`
          ),
          executeQuery<{ aov: string }>(
            `SELECT ROUND(AVG(total), 0) AS aov
             FROM orders
             WHERE site_id = '${SITE_ID}' AND status = 'completed'
             ${primaryFilter}`
          ),

          // ── Comparison period ─────────────────────────────────────────────────
          compFilter ? executeQuery<{ revenue: string }>(
            `SELECT ROUND(SUM(total), 0) AS revenue
             FROM orders
             WHERE site_id = '${SITE_ID}' AND status = 'completed'
             ${compFilter}`
          ) : Promise.resolve([]),

          compFilter ? executeQuery<{ order_count: string }>(
            `SELECT COUNT(*) AS order_count
             FROM orders
             WHERE site_id = '${SITE_ID}' AND status = 'completed'
             ${compFilter}`
          ) : Promise.resolve([]),

          compFilter ? executeQuery<{ on_time_rate: string }>(
            `SELECT ROUND(AVG(CASE WHEN fulfilled_on_time THEN 1.0 ELSE 0.0 END) * 100, 1) AS on_time_rate
             FROM orders
             WHERE site_id = '${SITE_ID}' AND status = 'completed'
             ${compFilter}`
          ) : Promise.resolve([]),

          compFilter ? executeQuery<{ aov: string }>(
            `SELECT ROUND(AVG(total), 0) AS aov
             FROM orders
             WHERE site_id = '${SITE_ID}' AND status = 'completed'
             ${compFilter}`
          ) : Promise.resolve([]),
        ])

        const revenue    = revenueRows[0]?.revenue      != null ? Number(revenueRows[0].revenue)          : null
        const orderCount = countRows[0]?.order_count    != null ? Number(countRows[0].order_count)        : null
        const onTimeRate = onTimeRows[0]?.on_time_rate  != null ? Number(onTimeRows[0].on_time_rate)      : null
        const aov        = aovRows[0]?.aov              != null ? Number(aovRows[0].aov)                  : null

        const prevRevenue    = prevRevenueRows[0]?.revenue     != null ? Number(prevRevenueRows[0].revenue)     : null
        const prevOrderCount = prevCountRows[0]?.order_count   != null ? Number(prevCountRows[0].order_count)   : null
        const prevOnTimeRate = prevOnTimeRows[0]?.on_time_rate != null ? Number(prevOnTimeRows[0].on_time_rate) : null
        const prevAov        = prevAovRows[0]?.aov             != null ? Number(prevAovRows[0].aov)             : null

        setKpis({
          revenue, orderCount, onTimeRate, aov,
          revenueTrend:    computeTrend(revenue,    prevRevenue),
          orderCountTrend: computeTrend(orderCount, prevOrderCount),
          onTimeRateTrend: computeTrend(onTimeRate, prevOnTimeRate),
          aovTrend:        computeTrend(aov,        prevAov),
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load KPIs')
      } finally {
        setLoading(false)
      }
    }

    fetchKpis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startStr, endStr, cStartStr, cEndStr])

  return { kpis, loading, error }
}
