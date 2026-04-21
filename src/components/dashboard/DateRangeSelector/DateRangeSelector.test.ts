// ─── DateRangeSelector — unit tests ──────────────────────────────────────────
//
// Key convention: preset resolver outputs are plain JS Dates whose timestamp
// represents wall-clock time in the target timezone.  e.g., end-of-day in
// America/New_York is "23:59:59 EST" = next UTC day at 04:59:59.
// Always wrap with `new TZDate(d, TZ)` before reading month/day/year so the
// accessor reflects the correct timezone, not UTC.
//
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TZDate } from '@date-fns/tz'
import { differenceInCalendarDays } from 'date-fns'

import {
  STANDARD_PRESETS,
  HIGHER_ED_PRESETS,
  calcComparisonRange,
  fiscalYearStart,
  fiscalQuarterRange,
} from './presetResolver'
import type { ResolveOpts } from './presetResolver'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TZ = 'America/New_York'

/** Noon UTC on a mid-month date — safely avoids timezone midnight crossings */
const FIXED_NOW = new Date('2025-03-15T12:00:00.000Z')

function opts(overrides?: Partial<ResolveOpts>): ResolveOpts {
  return {
    now: FIXED_NOW,
    timezone: TZ,
    fiscalYearStartMonth: 1,
    weekStartsOn: 0,
    excludeToday: false,
    ...overrides,
  }
}

function preset(id: string) {
  const p = STANDARD_PRESETS.find((p) => p.id === id)
  if (!p) throw new Error(`Preset "${id}" not found`)
  return p
}

/** Read a date's month in the target timezone (0-indexed). */
function tzMonth(d: Date) { return new TZDate(d, TZ).getMonth() }
function tzDate(d: Date)  { return new TZDate(d, TZ).getDate() }
function tzYear(d: Date)  { return new TZDate(d, TZ).getFullYear() }

// ── Month-to-date ─────────────────────────────────────────────────────────────

describe('MTD preset', () => {
  it('starts on the 1st of the current month (in timezone)', () => {
    const [start] = preset('mtd').resolve(opts())
    expect(tzDate(start)).toBe(1)
    expect(tzMonth(start)).toBe(2)   // March 2025
  })

  it('start ≤ end', () => {
    const [start, end] = preset('mtd').resolve(opts())
    expect(end.getTime()).toBeGreaterThanOrEqual(start.getTime())
  })

  it('ends on today in timezone (no excludeToday)', () => {
    const [, end] = preset('mtd').resolve(opts())
    expect(tzDate(end)).toBe(15)   // FIXED_NOW = Mar 15
    expect(tzMonth(end)).toBe(2)   // March
  })

  it('ends on yesterday in timezone when excludeToday=true', () => {
    const [, end] = preset('mtd').resolve(opts({ excludeToday: true }))
    expect(tzDate(end)).toBe(14)   // Mar 14 (yesterday from Mar 15)
    expect(tzMonth(end)).toBe(2)
  })

  it('range with excludeToday is strictly shorter than without', () => {
    const [s1, e1] = preset('mtd').resolve(opts({ excludeToday: false }))
    const [s2, e2] = preset('mtd').resolve(opts({ excludeToday: true }))
    // Compare in timezone to avoid UTC day-crossing artefacts
    const len1 = differenceInCalendarDays(new TZDate(e1, TZ), new TZDate(s1, TZ))
    const len2 = differenceInCalendarDays(new TZDate(e2, TZ), new TZDate(s2, TZ))
    expect(len1).toBeGreaterThan(len2)
  })
})

// ── Leap year Feb MTD ─────────────────────────────────────────────────────────

describe('Leap year — last_month', () => {
  it('last_month spans Feb 1–29 when now = noon Mar 15 2024 (leap year)', () => {
    const leapNow = new Date('2024-03-15T12:00:00.000Z')
    const [start, end] = preset('last_month').resolve(opts({ now: leapNow }))
    expect(tzMonth(start)).toBe(1)   // February
    expect(tzDate(start)).toBe(1)
    expect(tzDate(end)).toBe(29)     // Feb 29 in leap year
    expect(tzMonth(end)).toBe(1)
  })

  it('last_month spans Feb 1–28 when now = noon Mar 15 2025 (non-leap year)', () => {
    const [start, end] = preset('last_month').resolve(opts())
    expect(tzMonth(start)).toBe(1)   // February
    expect(tzDate(start)).toBe(1)
    expect(tzDate(end)).toBe(28)     // Feb 28
    expect(tzMonth(end)).toBe(1)
  })
})

// ── Fiscal year to date (April FY start) ──────────────────────────────────────

describe('Fiscal year to date — April start', () => {
  const FY_OPTS = opts({ fiscalYearStartMonth: 4 })

  it('starts on April 1 of the PRIOR year (now = Mar 15 2025, before April)', () => {
    // Mar 2025 < Apr → FY started Apr 2024
    const [start] = preset('fytd').resolve(FY_OPTS)
    expect(tzMonth(start)).toBe(3)   // April
    expect(tzDate(start)).toBe(1)
    expect(tzYear(start)).toBe(2024)
  })

  it('starts on April 1 of the CURRENT year when now is after April', () => {
    const mayNow = new Date('2025-05-15T12:00:00.000Z')
    const [start] = preset('fytd').resolve(opts({ fiscalYearStartMonth: 4, now: mayNow }))
    expect(tzMonth(start)).toBe(3)   // April
    expect(tzYear(start)).toBe(2025)
  })

  it('end is not before start', () => {
    const [start, end] = preset('fytd').resolve(FY_OPTS)
    expect(end.getTime()).toBeGreaterThanOrEqual(start.getTime())
  })
})

// ── Fiscal quarter range ──────────────────────────────────────────────────────

describe('fiscalQuarterRange', () => {
  it('Q1 = Apr–Jun for April FY, date in May', () => {
    const d = new Date('2024-05-10T12:00:00.000Z')
    const [start, end] = fiscalQuarterRange(d, 4, TZ)
    expect(tzMonth(start)).toBe(3)   // April (Q1 start)
    expect(tzDate(start)).toBe(1)
    expect(tzMonth(end)).toBe(5)     // June (Q1 end)
    expect(tzDate(end)).toBe(30)
  })

  it('Q4 = Jan–Mar for April FY, date in February', () => {
    const d = new Date('2025-02-10T12:00:00.000Z')
    const [start, end] = fiscalQuarterRange(d, 4, TZ)
    expect(tzMonth(start)).toBe(0)   // January (Q4 start)
    expect(tzDate(start)).toBe(1)
    expect(tzMonth(end)).toBe(2)     // March (Q4 end)
    expect(tzDate(end)).toBe(31)
  })

  it('Q1 = Jan–Mar for January FY (calendar year)', () => {
    const d = new Date('2025-02-10T12:00:00.000Z')
    const [start, end] = fiscalQuarterRange(d, 1, TZ)
    expect(tzMonth(start)).toBe(0)   // January
    expect(tzMonth(end)).toBe(2)     // March
    expect(tzDate(end)).toBe(31)
  })
})

// ── excludeToday ──────────────────────────────────────────────────────────────

describe('excludeToday flag', () => {
  it('last_7 end is today (no exclude)', () => {
    const [, end] = preset('last_7').resolve(opts({ excludeToday: false }))
    expect(tzDate(end)).toBe(15)    // Mar 15 = FIXED_NOW date in TZ
    expect(tzMonth(end)).toBe(2)
  })

  it('last_7 end is yesterday when excludeToday=true', () => {
    const [, end] = preset('last_7').resolve(opts({ excludeToday: true }))
    expect(tzDate(end)).toBe(14)    // Mar 14
    expect(tzMonth(end)).toBe(2)
  })

  it('last_7 end shifts back by 1 day when excludeToday=true (same length, shifted window)', () => {
    // "last_7" is a sliding window — excludeToday shifts both start & end back 1 day.
    // The range length stays the same (7 days); only the end date changes.
    const [, e1] = preset('last_7').resolve(opts({ excludeToday: false }))
    const [, e2] = preset('last_7').resolve(opts({ excludeToday: true }))
    const endDay1 = new TZDate(e1, TZ).getDate()   // Mar 15
    const endDay2 = new TZDate(e2, TZ).getDate()   // Mar 14
    expect(endDay2).toBe(endDay1 - 1)
  })

  it('yesterday preset is unchanged by excludeToday', () => {
    const [, e1] = preset('yesterday').resolve(opts({ excludeToday: false }))
    const [, e2] = preset('yesterday').resolve(opts({ excludeToday: true }))
    expect(tzDate(e1)).toBe(tzDate(e2))
    expect(tzMonth(e1)).toBe(tzMonth(e2))
  })
})

// ── Comparison ranges ─────────────────────────────────────────────────────────

describe('calcComparisonRange', () => {
  // Noon UTC on known dates — safe from timezone midnight issues
  const start = new Date('2025-01-15T12:00:00.000Z')
  const end   = new Date('2025-01-31T12:00:00.000Z')

  it('prior_year shifts year back by 1, preserves month and day', () => {
    const [cs, ce] = calcComparisonRange(start, end, 'prior_year')!
    // These dates are noon UTC so timezone doesn't matter
    expect(cs.getUTCFullYear()).toBe(2024)
    expect(cs.getUTCMonth()).toBe(0)    // January
    expect(cs.getUTCDate()).toBe(15)
    expect(ce.getUTCFullYear()).toBe(2024)
    expect(ce.getUTCDate()).toBe(31)
  })

  it('prior_period shifts back by range length', () => {
    const [cs] = calcComparisonRange(start, end, 'prior_period')!
    // 17 days before Jan 15 = Dec 29
    expect(cs.getUTCFullYear()).toBe(2024)
    expect(cs.getUTCMonth()).toBe(11)   // December
    expect(cs.getUTCDate()).toBe(29)
  })

  it('none returns null', () => {
    expect(calcComparisonRange(start, end, 'none')).toBeNull()
  })

  it('prior_year handles leap day (Feb 29 → Feb 28 in non-leap year)', () => {
    const leapDay   = new Date('2024-02-29T12:00:00.000Z')
    const leapDayE  = new Date('2024-02-29T20:00:00.000Z')
    const [cs] = calcComparisonRange(leapDay, leapDayE, 'prior_year')!
    expect(cs.getUTCFullYear()).toBe(2023)
    expect(cs.getUTCMonth()).toBe(1)    // February
    expect(cs.getUTCDate()).toBeLessThanOrEqual(28)
  })

  it('comparison start is earlier than primary start', () => {
    const [cs] = calcComparisonRange(start, end, 'prior_period')!
    expect(cs.getTime()).toBeLessThan(start.getTime())
  })
})

// ── fiscalYearStart ───────────────────────────────────────────────────────────

describe('fiscalYearStart', () => {
  it('returns Jan 1 for calendar-year FY (start month = 1)', () => {
    const d = new Date('2025-06-15T12:00:00.000Z')
    const fy = fiscalYearStart(d, 1, TZ)
    expect(tzMonth(fy)).toBe(0)   // January
    expect(tzDate(fy)).toBe(1)
    expect(tzYear(fy)).toBe(2025)
  })

  it('rolls to prior year for Oct FY when now is before October', () => {
    const d = new Date('2025-09-15T12:00:00.000Z')  // September
    const fy = fiscalYearStart(d, 10, TZ)
    expect(tzYear(fy)).toBe(2024)   // Previous year
    expect(tzMonth(fy)).toBe(9)     // October
    expect(tzDate(fy)).toBe(1)
  })

  it('stays in current year for Oct FY when now is in November', () => {
    const d = new Date('2025-11-15T12:00:00.000Z')
    const fy = fiscalYearStart(d, 10, TZ)
    expect(tzYear(fy)).toBe(2025)
    expect(tzMonth(fy)).toBe(9)     // October
  })
})

// ── Higher-ed presets ─────────────────────────────────────────────────────────

describe('HIGHER_ED_PRESETS', () => {
  it('fall_semester starts Aug 20', () => {
    const p = HIGHER_ED_PRESETS.find((p) => p.id === 'fall_semester')!
    const [start] = p.resolve(opts())
    expect(tzMonth(start)).toBe(7)   // August
    expect(tzDate(start)).toBe(20)
  })

  it('spring_semester starts Jan 10', () => {
    const p = HIGHER_ED_PRESETS.find((p) => p.id === 'spring_semester')!
    const [start] = p.resolve(opts())
    expect(tzMonth(start)).toBe(0)   // January
    expect(tzDate(start)).toBe(10)
  })

  it('summer_session starts May 20', () => {
    const p = HIGHER_ED_PRESETS.find((p) => p.id === 'summer_session')!
    const [start] = p.resolve(opts())
    expect(tzMonth(start)).toBe(4)   // May
    expect(tzDate(start)).toBe(20)
  })

  it('academic_year spans Aug(prior year) to May', () => {
    const p = HIGHER_ED_PRESETS.find((p) => p.id === 'academic_year')!
    const [start, end] = p.resolve(opts())
    expect(tzMonth(start)).toBe(7)   // August
    expect(tzMonth(end)).toBe(4)     // May
    expect(tzYear(start)).toBe(tzYear(end) - 1)
  })
})

// ── URL persistence (mocked window) ──────────────────────────────────────────

describe('URL persistence', () => {
  let mockSearch = ''
  let mockReplaceState: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockSearch = ''
    mockReplaceState = vi.fn()

    vi.stubGlobal('window', {
      location: {
        get search() { return mockSearch },
        pathname: '/',
        hash: '',
      },
      history: {
        state: null,
        replaceState: mockReplaceState,
      },
    })

    // Capture the URL written by replaceState so readFromUrl can read it back
    mockReplaceState.mockImplementation((_state: unknown, _title: unknown, url: string) => {
      const q = url.indexOf('?')
      mockSearch = q >= 0 ? url.slice(q) : ''
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pushToUrl and readFromUrl round-trip correctly', async () => {
    const { pushToUrl, readFromUrl } = await import('./urlPersistence')

    const value = {
      preset: 'last_30',
      start: new Date('2025-02-14T12:00:00.000Z'),
      end:   new Date('2025-03-14T12:00:00.000Z'),
      comparison: 'prior_year' as const,
      excludeToday: true,
      timezone: 'America/Chicago',
    }

    pushToUrl(value)
    expect(mockReplaceState).toHaveBeenCalledOnce()

    const result = readFromUrl()
    expect(result).not.toBeNull()
    expect(result?.preset).toBe('last_30')
    expect(result?.comparison).toBe('prior_year')
    expect(result?.excludeToday).toBe(true)
    expect(result?.timezone).toBe('America/Chicago')
    expect(result?.start?.getTime()).toBe(value.start.getTime())
    expect(result?.end?.getTime()).toBe(value.end.getTime())
  })

  it('readFromUrl returns null when no params are present', async () => {
    const { readFromUrl } = await import('./urlPersistence')
    mockSearch = ''
    expect(readFromUrl()).toBeNull()
  })
})
