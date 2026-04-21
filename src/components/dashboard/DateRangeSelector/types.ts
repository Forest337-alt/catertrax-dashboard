// ─── DateRangeSelector — shared types ─────────────────────────────────────────

export type Comparison = 'none' | 'prior_year' | 'prior_period'

export type PresetGroup = 'recent' | 'period_to_date' | 'completed' | 'segment' | 'custom'

export type Segment = 'standard' | 'higher_ed'

export interface ResolveOpts {
  now: Date
  timezone: string
  fiscalYearStartMonth: number  // 1–12
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6
  excludeToday: boolean
}

export interface Preset {
  id: string
  label: string
  group: PresetGroup
  /** Returns [inclusive start, inclusive end] in wall-clock time for the timezone */
  resolve: (opts: ResolveOpts) => [Date, Date]
  /** Whether this preset can produce ranges that include today */
  canExcludeToday?: boolean
}

export interface DateRangeValue {
  preset: string       // preset id or 'custom'
  start: Date
  end: Date
  comparison: Comparison
  excludeToday: boolean
  timezone: string
  /** Derived comparison range (populated by the component) */
  compStart?: Date
  compEnd?: Date
}

export interface DateRangeSelectorProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  /** IANA timezone string, e.g. 'America/New_York'. Defaults to browser local. */
  timezone?: string
  /** Fiscal year start month, 1–12. Default 1 (January). */
  fiscalYearStartMonth?: number
  segment?: Segment
  /** Day the week starts on. 0 = Sunday, 1 = Monday. Default 0. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  showComparison?: boolean
  showExcludeToday?: boolean
  className?: string
}
