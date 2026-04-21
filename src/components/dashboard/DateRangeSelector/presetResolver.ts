// ─── Preset date-range resolver (DST-safe via @date-fns/tz) ───────────────────
import { TZDate } from '@date-fns/tz'
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  startOfYear, endOfYear,
  subDays, subWeeks, subMonths, subQuarters, subYears,
  addYears, addMonths,
  differenceInCalendarDays,
} from 'date-fns'
import type { Preset, ResolveOpts, Comparison } from './types'

// ── helpers ───────────────────────────────────────────────────────────────────

/** Return a TZDate representing `now` in the given timezone. */
function tzDate(now: Date, timezone: string): TZDate {
  return new TZDate(now, timezone)
}

/** Convert a TZDate (or any Date) to a plain JS Date with the same timestamp. */
function toDate(d: Date): Date {
  return new Date(d.getTime())
}

/**
 * Cap the end of a range to end-of-yesterday if excludeToday=true
 * and the calculated end would fall on or after midnight today in the timezone.
 */
function capEnd(end: Date, opts: ResolveOpts): Date {
  if (!opts.excludeToday) return end
  const todayStart = startOfDay(tzDate(opts.now, opts.timezone))
  if (end.getTime() >= todayStart.getTime()) {
    return toDate(endOfDay(subDays(todayStart, 1)))
  }
  return end
}

// ── fiscal year helpers ───────────────────────────────────────────────────────

/** Returns the start of the current fiscal year in the given timezone. */
export function fiscalYearStart(d: Date, startMonth: number, timezone: string): Date {
  const tz = tzDate(d, timezone)
  const month = tz.getMonth() + 1  // 1-indexed
  let year = tz.getFullYear()
  if (startMonth > 1 && month < startMonth) year -= 1
  return toDate(startOfDay(new TZDate(year, startMonth - 1, 1, 0, 0, 0, 0, timezone)))
}

/** Returns the end of the current fiscal year in the given timezone. */
export function fiscalYearEnd(d: Date, startMonth: number, timezone: string): Date {
  const fyStart = fiscalYearStart(d, startMonth, timezone)
  const nextFyStart = addYears(fyStart, 1)
  return toDate(endOfDay(subDays(nextFyStart, 1)))
}

/** Returns fiscal quarter number (1–4) for a given date and FY start month. */
export function fiscalQuarter(d: Date, startMonth: number, timezone: string): number {
  const tz = tzDate(d, timezone)
  const month = tz.getMonth() + 1  // 1-indexed
  const offset = (month - startMonth + 12) % 12  // months since FY start
  return Math.floor(offset / 3) + 1
}

/** Returns [start, end] of the fiscal quarter containing d. */
export function fiscalQuarterRange(d: Date, startMonth: number, timezone: string): [Date, Date] {
  const fyS = fiscalYearStart(d, startMonth, timezone)
  const q = fiscalQuarter(d, startMonth, timezone) - 1  // 0-indexed
  const qStart = addMonths(fyS, q * 3)
  const qEnd = toDate(endOfDay(subDays(addMonths(qStart, 3), 1)))
  return [toDate(startOfDay(qStart)), qEnd]
}

// ── academic calendar helpers (higher_ed segment) ─────────────────────────────

/** Semester boundary dates.
 *  Fall:   Aug 20 – Dec 20
 *  Spring: Jan 10 – May 15
 *  Summer: May 20 – Aug 15
 */
export function semesterRange(
  semester: 'fall' | 'spring' | 'summer',
  year: number,
  timezone: string,
): [Date, Date] {
  if (semester === 'fall') {
    return [
      toDate(startOfDay(new TZDate(year, 7, 20, 0, 0, 0, 0, timezone))),
      toDate(endOfDay(new TZDate(year, 11, 20, 0, 0, 0, 0, timezone))),
    ]
  }
  if (semester === 'spring') {
    return [
      toDate(startOfDay(new TZDate(year, 0, 10, 0, 0, 0, 0, timezone))),
      toDate(endOfDay(new TZDate(year, 4, 15, 0, 0, 0, 0, timezone))),
    ]
  }
  // summer
  return [
    toDate(startOfDay(new TZDate(year, 4, 20, 0, 0, 0, 0, timezone))),
    toDate(endOfDay(new TZDate(year, 7, 15, 0, 0, 0, 0, timezone))),
  ]
}

// ── preset definitions ────────────────────────────────────────────────────────

/** Standard presets available to all segments. */
export const STANDARD_PRESETS: Preset[] = [
  // ── Recent ──────────────────────────────────────────────────────────────────
  {
    id: 'last_7',
    label: 'Last 7 days',
    group: 'recent',
    canExcludeToday: true,
    resolve: (opts) => {
      const t = tzDate(opts.now, opts.timezone)
      const end = capEnd(toDate(endOfDay(t)), opts)
      const base = opts.excludeToday ? subDays(t, 1) : t
      return [toDate(startOfDay(subDays(base, 6))), end]
    },
  },
  {
    id: 'last_14',
    label: 'Last 14 days',
    group: 'recent',
    canExcludeToday: true,
    resolve: (opts) => {
      const t = tzDate(opts.now, opts.timezone)
      const end = capEnd(toDate(endOfDay(t)), opts)
      const base = opts.excludeToday ? subDays(t, 1) : t
      return [toDate(startOfDay(subDays(base, 13))), end]
    },
  },
  {
    id: 'last_30',
    label: 'Last 30 days',
    group: 'recent',
    canExcludeToday: true,
    resolve: (opts) => {
      const t = tzDate(opts.now, opts.timezone)
      const end = capEnd(toDate(endOfDay(t)), opts)
      const base = opts.excludeToday ? subDays(t, 1) : t
      return [toDate(startOfDay(subDays(base, 29))), end]
    },
  },
  {
    id: 'last_90',
    label: 'Last 90 days',
    group: 'recent',
    canExcludeToday: true,
    resolve: (opts) => {
      const t = tzDate(opts.now, opts.timezone)
      const end = capEnd(toDate(endOfDay(t)), opts)
      const base = opts.excludeToday ? subDays(t, 1) : t
      return [toDate(startOfDay(subDays(base, 89))), end]
    },
  },
  {
    id: 'last_365',
    label: 'Last 365 days',
    group: 'recent',
    canExcludeToday: true,
    resolve: (opts) => {
      const t = tzDate(opts.now, opts.timezone)
      const end = capEnd(toDate(endOfDay(t)), opts)
      const base = opts.excludeToday ? subDays(t, 1) : t
      return [toDate(startOfDay(subDays(base, 364))), end]
    },
  },

  // ── Period to date ───────────────────────────────────────────────────────────
  {
    id: 'today',
    label: 'Today',
    group: 'period_to_date',
    resolve: ({ now, timezone }) => {
      const t = tzDate(now, timezone)
      return [toDate(startOfDay(t)), toDate(endOfDay(t))]
    },
  },
  {
    id: 'wtd',
    label: 'This week',
    group: 'period_to_date',
    canExcludeToday: true,
    resolve: (opts) => {
      const t = tzDate(opts.now, opts.timezone)
      const start = startOfWeek(t, { weekStartsOn: opts.weekStartsOn })
      const end = capEnd(toDate(endOfDay(t)), opts)
      return [toDate(startOfDay(start)), end]
    },
  },
  {
    id: 'mtd',
    label: 'Month to date',
    group: 'period_to_date',
    canExcludeToday: true,
    resolve: (opts) => {
      const t = tzDate(opts.now, opts.timezone)
      const start = startOfMonth(t)
      const end = capEnd(toDate(endOfDay(t)), opts)
      return [toDate(startOfDay(start)), end]
    },
  },
  {
    id: 'qtd',
    label: 'Quarter to date',
    group: 'period_to_date',
    canExcludeToday: true,
    resolve: (opts) => {
      const t = tzDate(opts.now, opts.timezone)
      const start = startOfQuarter(t)
      const end = capEnd(toDate(endOfDay(t)), opts)
      return [toDate(startOfDay(start)), end]
    },
  },
  {
    id: 'ytd',
    label: 'Year to date',
    group: 'period_to_date',
    canExcludeToday: true,
    resolve: (opts) => {
      const t = tzDate(opts.now, opts.timezone)
      const start = startOfYear(t)
      const end = capEnd(toDate(endOfDay(t)), opts)
      return [toDate(startOfDay(start)), end]
    },
  },
  {
    id: 'fytd',
    label: 'Fiscal year to date',
    group: 'period_to_date',
    canExcludeToday: true,
    resolve: (opts) => {
      const t = tzDate(opts.now, opts.timezone)
      const start = fiscalYearStart(t, opts.fiscalYearStartMonth, opts.timezone)
      const end = capEnd(toDate(endOfDay(t)), opts)
      return [start, end]
    },
  },

  // ── Completed ────────────────────────────────────────────────────────────────
  {
    id: 'yesterday',
    label: 'Yesterday',
    group: 'completed',
    resolve: ({ now, timezone }) => {
      const yesterday = subDays(tzDate(now, timezone), 1)
      return [toDate(startOfDay(yesterday)), toDate(endOfDay(yesterday))]
    },
  },
  {
    id: 'last_week',
    label: 'Last week',
    group: 'completed',
    resolve: ({ now, timezone, weekStartsOn }) => {
      const lastWeek = subWeeks(tzDate(now, timezone), 1)
      return [
        toDate(startOfDay(startOfWeek(lastWeek, { weekStartsOn }))),
        toDate(endOfDay(endOfWeek(lastWeek, { weekStartsOn }))),
      ]
    },
  },
  {
    id: 'last_month',
    label: 'Last month',
    group: 'completed',
    resolve: ({ now, timezone }) => {
      const lastMonth = subMonths(tzDate(now, timezone), 1)
      return [toDate(startOfDay(startOfMonth(lastMonth))), toDate(endOfDay(endOfMonth(lastMonth)))]
    },
  },
  {
    id: 'last_quarter',
    label: 'Last quarter',
    group: 'completed',
    resolve: ({ now, timezone }) => {
      const lastQ = subQuarters(tzDate(now, timezone), 1)
      return [toDate(startOfDay(startOfQuarter(lastQ))), toDate(endOfDay(endOfQuarter(lastQ)))]
    },
  },
  {
    id: 'last_fiscal_quarter',
    label: 'Last fiscal quarter',
    group: 'completed',
    resolve: ({ now, timezone, fiscalYearStartMonth }) => {
      const t = tzDate(now, timezone)
      const q = fiscalQuarter(t, fiscalYearStartMonth, timezone)
      const fyS = fiscalYearStart(t, fiscalYearStartMonth, timezone)
      const currentQStart = addMonths(fyS, (q - 1) * 3)
      const prevQStart = subMonths(currentQStart, 3)
      const prevQEnd = toDate(endOfDay(subDays(currentQStart, 1)))
      return [toDate(startOfDay(prevQStart)), prevQEnd]
    },
  },
  {
    id: 'last_year',
    label: 'Last year',
    group: 'completed',
    resolve: ({ now, timezone }) => {
      const lastYear = subYears(tzDate(now, timezone), 1)
      return [toDate(startOfDay(startOfYear(lastYear))), toDate(endOfDay(endOfYear(lastYear)))]
    },
  },
  {
    id: 'last_fiscal_year',
    label: 'Last fiscal year',
    group: 'completed',
    resolve: ({ now, timezone, fiscalYearStartMonth }) => {
      const t = tzDate(now, timezone)
      const fyS = fiscalYearStart(t, fiscalYearStartMonth, timezone)
      const prevFyStart = subYears(fyS, 1)
      const prevFyEnd = toDate(endOfDay(subDays(fyS, 1)))
      return [toDate(startOfDay(prevFyStart)), prevFyEnd]
    },
  },
  {
    id: 'custom',
    label: 'Custom range',
    group: 'custom',
    resolve: ({ now, timezone }) => {
      const t = tzDate(now, timezone)
      return [toDate(startOfDay(t)), toDate(endOfDay(t))]
    },
  },
]

/** higher_ed segment-specific presets. */
export const HIGHER_ED_PRESETS: Preset[] = [
  {
    id: 'fall_semester',
    label: 'Fall semester',
    group: 'segment',
    resolve: ({ now, timezone }) => {
      const year = tzDate(now, timezone).getFullYear()
      return semesterRange('fall', year, timezone)
    },
  },
  {
    id: 'spring_semester',
    label: 'Spring semester',
    group: 'segment',
    resolve: ({ now, timezone }) => {
      const year = tzDate(now, timezone).getFullYear()
      return semesterRange('spring', year, timezone)
    },
  },
  {
    id: 'summer_session',
    label: 'Summer session',
    group: 'segment',
    resolve: ({ now, timezone }) => {
      const year = tzDate(now, timezone).getFullYear()
      return semesterRange('summer', year, timezone)
    },
  },
  {
    id: 'academic_year',
    label: 'Academic year',
    group: 'segment',
    resolve: ({ now, timezone }) => {
      const year = tzDate(now, timezone).getFullYear()
      return [
        toDate(startOfDay(new TZDate(year - 1, 7, 20, 0, 0, 0, 0, timezone))),
        toDate(endOfDay(new TZDate(year, 4, 15, 0, 0, 0, 0, timezone))),
      ]
    },
  },
  {
    id: 'last_academic_year',
    label: 'Last academic year',
    group: 'segment',
    resolve: ({ now, timezone }) => {
      const year = tzDate(now, timezone).getFullYear()
      return [
        toDate(startOfDay(new TZDate(year - 2, 7, 20, 0, 0, 0, 0, timezone))),
        toDate(endOfDay(new TZDate(year - 1, 4, 15, 0, 0, 0, 0, timezone))),
      ]
    },
  },
]

export function getPresets(segment: 'standard' | 'higher_ed' = 'standard'): Preset[] {
  const base = STANDARD_PRESETS
  if (segment === 'higher_ed') {
    const customIdx = base.findIndex((p) => p.id === 'custom')
    return [
      ...base.slice(0, customIdx),
      ...HIGHER_ED_PRESETS,
      ...base.slice(customIdx),
    ]
  }
  return base
}

// ── comparison range calculator ───────────────────────────────────────────────

export function calcComparisonRange(
  start: Date,
  end: Date,
  comparison: Comparison,
): [Date, Date] | null {
  if (comparison === 'none') return null
  if (comparison === 'prior_year') {
    return [subYears(start, 1), subYears(end, 1)]
  }
  // prior_period: shift back by the same number of days
  const days = differenceInCalendarDays(end, start) + 1
  return [subDays(start, days), subDays(end, days)]
}

export type { ResolveOpts }
