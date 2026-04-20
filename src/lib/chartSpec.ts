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

/**
 * Shorten a categorical axis label using common English abbreviations,
 * then hard-truncate at MAX_LABEL chars if still too long.
 */
const ABBREVS: Array<[RegExp, string]> = [
  [/\bUniversit(?:y|ies)\b/gi,   'Univ.'],
  [/\bDepartment\b/gi,            'Dept.'],
  [/\bDivision\b/gi,              'Div.'],
  [/\bAssociation\b/gi,           'Assoc.'],
  [/\bInstitute\b/gi,             'Inst.'],
  [/\bInternational\b/gi,         "Int'l"],
  [/\bNational\b/gi,              'Natl.'],
  [/\bCorporation\b/gi,           'Corp.'],
  [/\bCompany\b/gi,               'Co.'],
  [/\bGovernment\b/gi,            'Govt.'],
  [/\bAdministration\b/gi,        'Admin.'],
  [/\bManagement\b/gi,            'Mgmt.'],
  [/\bTechnolog(?:y|ies)\b/gi,    'Tech.'],
  [/\bServices\b/gi,              'Svcs.'],
  [/\bFoundation\b/gi,            'Fdn.'],
  [/\bCentr(?:e|er)\b/gi,         'Ctr.'],
  [/\bMedical\b/gi,               'Med.'],
  [/\bResearch\b/gi,              'Res.'],
  [/\bEngineering\b/gi,           'Eng.'],
  [/\bPsycholog(?:y|ical)\b/gi,   'Psych.'],
  [/\bSciences?\b/gi,             'Sci.'],
  [/\bCommunications?\b/gi,       'Comm.'],
  [/\bOperations\b/gi,            'Ops.'],
  [/\bHospital\b/gi,              'Hosp.'],
  [/\bPublic\b/gi,                'Pub.'],
]

const MAX_LABEL = 20

export function abbreviateLabel(label: string): string {
  let s = label
  for (const [pattern, replacement] of ABBREVS) {
    s = s.replace(pattern, replacement)
  }
  if (s.length > MAX_LABEL) {
    s = s.slice(0, MAX_LABEL - 1).trimEnd() + '…'
  }
  return s
}
