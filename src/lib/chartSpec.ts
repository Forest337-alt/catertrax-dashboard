import type { ChartSpec } from '../types'

export function isChartSpec(value: unknown): value is ChartSpec {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.title === 'string' &&
    typeof v.sql === 'string' &&
    typeof v.chart_type === 'string'
  )
}

export function parseChartSpecResponse(raw: string): ChartSpec | { clarifying_question: string } {
  // Strip markdown code fences if present
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  const parsed: unknown = JSON.parse(cleaned)

  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'clarifying_question' in parsed
  ) {
    return parsed as { clarifying_question: string }
  }

  if (!isChartSpec(parsed)) {
    throw new Error('Response is not a valid ChartSpec')
  }

  return parsed
}

/**
 * Format a raw value for display based on the value type hint.
 */
export function formatValue(value: unknown, type?: string): string {
  if (value === null || value === undefined) return '—'

  const num = Number(value)

  if (type === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num)
  }

  if (type === 'percent') {
    return `${num.toFixed(1)}%`
  }

  if (type === 'numeric' && !isNaN(num)) {
    return new Intl.NumberFormat('en-US').format(num)
  }

  if (typeof value === 'string') {
    // Try to parse and format dates like "2025-01" or "2025-01-15"
    if (/^\d{4}-\d{2}(-\d{2})?$/.test(value)) {
      try {
        const d = new Date(value + (value.length === 7 ? '-01' : ''))
        return d.toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
          ...(value.length > 7 ? { day: 'numeric' } : {}),
        })
      } catch {
        return value
      }
    }
  }

  return String(value)
}
