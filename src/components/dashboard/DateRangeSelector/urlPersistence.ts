// ─── URL persistence for DateRangeSelector ────────────────────────────────────
import type { DateRangeValue, Comparison } from './types'

const PARAM_PRESET    = 'dr_preset'
const PARAM_START     = 'dr_start'
const PARAM_END       = 'dr_end'
const PARAM_COMP      = 'dr_comp'
const PARAM_EXCL      = 'dr_excl'
const PARAM_TZ        = 'dr_tz'

/** Serialize a DateRangeValue into URL search params and push to history. */
export function pushToUrl(value: DateRangeValue): void {
  const params = new URLSearchParams(window.location.search)

  params.set(PARAM_PRESET, value.preset)
  params.set(PARAM_START, value.start.toISOString())
  params.set(PARAM_END, value.end.toISOString())
  params.set(PARAM_COMP, value.comparison)
  params.set(PARAM_EXCL, value.excludeToday ? '1' : '0')
  params.set(PARAM_TZ, value.timezone)

  const newUrl =
    window.location.pathname +
    (params.toString() ? '?' + params.toString() : '') +
    window.location.hash

  window.history.replaceState(window.history.state, '', newUrl)
}

/** Parse DateRangeValue fields from the current URL search params. */
export function readFromUrl(): Partial<DateRangeValue> | null {
  const params = new URLSearchParams(window.location.search)

  const preset = params.get(PARAM_PRESET)
  const startStr = params.get(PARAM_START)
  const endStr = params.get(PARAM_END)
  const comparison = params.get(PARAM_COMP) as Comparison | null
  const exclStr = params.get(PARAM_EXCL)
  const timezone = params.get(PARAM_TZ)

  if (!preset || !startStr || !endStr) return null

  const start = new Date(startStr)
  const end = new Date(endStr)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null

  return {
    preset,
    start,
    end,
    comparison: comparison ?? 'none',
    excludeToday: exclStr === '1',
    timezone: timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

/** Remove all DateRangeSelector params from the URL. */
export function clearFromUrl(): void {
  const params = new URLSearchParams(window.location.search)
  ;[PARAM_PRESET, PARAM_START, PARAM_END, PARAM_COMP, PARAM_EXCL, PARAM_TZ].forEach((k) =>
    params.delete(k),
  )
  const newUrl =
    window.location.pathname +
    (params.toString() ? '?' + params.toString() : '') +
    window.location.hash
  window.history.replaceState(window.history.state, '', newUrl)
}
