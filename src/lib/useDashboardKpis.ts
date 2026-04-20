import { useState, useEffect } from 'react'
import { executeQuery } from './supabase'

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

export function useDashboardKpis() {
  const [kpis, setKpis] = useState<DashboardKpis>({
    revenue: null, orderCount: null, onTimeRate: null, aov: null,
    revenueTrend: null, orderCountTrend: null, onTimeRateTrend: null, aovTrend: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!SITE_ID) {
      setError('VITE_DEMO_SITE_ID not configured')
      setLoading(false)
      return
    }

    async function fetchKpis() {
      try {
        const [
          revenueRows, countRows, onTimeRows, aovRows,
          prevRevenueRows, prevCountRows, prevOnTimeRows, prevAovRows,
        ] = await Promise.all([
          // ── Current period ────────────────────────────────────────────────────
          executeQuery<{ revenue: string }>(
            `SELECT ROUND(SUM(total), 0) AS revenue
             FROM orders
             WHERE site_id = '${SITE_ID}'
               AND status = 'completed'
               AND DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE)`
          ),
          executeQuery<{ order_count: string }>(
            `SELECT COUNT(*) AS order_count
             FROM orders
             WHERE site_id = '${SITE_ID}'
               AND status = 'completed'
               AND DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE)`
          ),
          executeQuery<{ on_time_rate: string }>(
            `SELECT ROUND(AVG(CASE WHEN fulfilled_on_time THEN 1.0 ELSE 0.0 END) * 100, 1) AS on_time_rate
             FROM orders
             WHERE site_id = '${SITE_ID}'
               AND status = 'completed'
               AND order_date >= CURRENT_DATE - INTERVAL '30 days'`
          ),
          executeQuery<{ aov: string }>(
            `SELECT ROUND(AVG(total), 0) AS aov
             FROM orders
             WHERE site_id = '${SITE_ID}'
               AND status = 'completed'
               AND order_date >= CURRENT_DATE - INTERVAL '30 days'`
          ),
          // ── Prior period (same day-of-month range, one month back) ────────────
          executeQuery<{ revenue: string }>(
            `SELECT ROUND(SUM(total), 0) AS revenue
             FROM orders
             WHERE site_id = '${SITE_ID}'
               AND status = 'completed'
               AND order_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
               AND order_date <  DATE_TRUNC('month', CURRENT_DATE)
               AND EXTRACT(DAY FROM order_date) <= EXTRACT(DAY FROM CURRENT_DATE)`
          ),
          executeQuery<{ order_count: string }>(
            `SELECT COUNT(*) AS order_count
             FROM orders
             WHERE site_id = '${SITE_ID}'
               AND status = 'completed'
               AND order_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
               AND order_date <  DATE_TRUNC('month', CURRENT_DATE)
               AND EXTRACT(DAY FROM order_date) <= EXTRACT(DAY FROM CURRENT_DATE)`
          ),
          // ── Prior 30-day window (days 60-31 ago) ──────────────────────────────
          executeQuery<{ on_time_rate: string }>(
            `SELECT ROUND(AVG(CASE WHEN fulfilled_on_time THEN 1.0 ELSE 0.0 END) * 100, 1) AS on_time_rate
             FROM orders
             WHERE site_id = '${SITE_ID}'
               AND status = 'completed'
               AND order_date >= CURRENT_DATE - INTERVAL '60 days'
               AND order_date <  CURRENT_DATE - INTERVAL '30 days'`
          ),
          executeQuery<{ aov: string }>(
            `SELECT ROUND(AVG(total), 0) AS aov
             FROM orders
             WHERE site_id = '${SITE_ID}'
               AND status = 'completed'
               AND order_date >= CURRENT_DATE - INTERVAL '60 days'
               AND order_date <  CURRENT_DATE - INTERVAL '30 days'`
          ),
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
  }, [])

  return { kpis, loading, error }
}
