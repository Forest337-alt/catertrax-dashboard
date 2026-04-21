// ─── DateRangeSelector ────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react'
import { format, isSameDay, startOfDay, endOfDay } from 'date-fns'
import { CalendarDays, ChevronDown, RotateCcw, X } from 'lucide-react'
import clsx from 'clsx'

import type { DateRangeSelectorProps, DateRangeValue, Comparison, PresetGroup } from './types'
import { getPresets, calcComparisonRange } from './presetResolver'
import { pushToUrl, readFromUrl } from './urlPersistence'
import MiniCalendar from './MiniCalendar'

// ── Group metadata ─────────────────────────────────────────────────────────────

const GROUP_LABELS: Record<PresetGroup, string> = {
  recent:          'Recent',
  period_to_date:  'Period to date',
  completed:       'Completed',
  segment:         'Academic calendar',
  custom:          'Custom',
}

const COMPARISON_OPTIONS: Array<{ value: Comparison; label: string }> = [
  { value: 'none',         label: 'No comparison' },
  { value: 'prior_period', label: 'Prior period' },
  { value: 'prior_year',   label: 'Prior year' },
]

// ── Utility ────────────────────────────────────────────────────────────────────

function formatRange(start: Date, end: Date): string {
  if (isSameDay(start, end)) return format(start, 'MMM d, yyyy')
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DateRangeSelector({
  value,
  onChange,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  fiscalYearStartMonth = 1,
  segment = 'standard',
  weekStartsOn = 0,
  showComparison = true,
  showExcludeToday = true,
  className,
}: DateRangeSelectorProps) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const presets = getPresets(segment)

  // ── Restore from URL on mount ───────────────────────────────────────────────
  useEffect(() => {
    const fromUrl = readFromUrl()
    if (fromUrl && fromUrl.preset && fromUrl.start && fromUrl.end) {
      const compRange = calcComparisonRange(fromUrl.start, fromUrl.end, fromUrl.comparison ?? 'none')
      onChange({
        preset: fromUrl.preset ?? 'custom',
        start: fromUrl.start,
        end: fromUrl.end,
        comparison: fromUrl.comparison ?? 'none',
        excludeToday: fromUrl.excludeToday ?? false,
        timezone: fromUrl.timezone ?? timezone,
        ...(compRange ? { compStart: compRange[0], compEnd: compRange[1] } : {}),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Close on outside click ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    function handleDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleDown)
    return () => document.removeEventListener('mousedown', handleDown)
  }, [open])

  // ── Apply a preset ──────────────────────────────────────────────────────────
  const applyPreset = useCallback(
    (presetId: string, overrides?: Partial<DateRangeValue>) => {
      const preset = presets.find((p) => p.id === presetId)
      if (!preset) return

      const opts = {
        now: new Date(),
        timezone,
        fiscalYearStartMonth,
        weekStartsOn,
        excludeToday: overrides?.excludeToday ?? value.excludeToday,
      }

      const [start, end] = presetId === 'custom' && overrides?.start && overrides?.end
        ? [overrides.start, overrides.end]
        : preset.resolve(opts)

      const comparison = overrides?.comparison ?? value.comparison
      const compRange = calcComparisonRange(start, end, comparison)

      const next: DateRangeValue = {
        preset: presetId,
        start,
        end,
        comparison,
        excludeToday: opts.excludeToday,
        timezone,
        ...(compRange ? { compStart: compRange[0], compEnd: compRange[1] } : {}),
      }
      onChange(next)
      pushToUrl(next)
    },
    [presets, timezone, fiscalYearStartMonth, weekStartsOn, value, onChange],
  )

  // ── Update comparison only ──────────────────────────────────────────────────
  function handleComparison(comparison: Comparison) {
    const compRange = calcComparisonRange(value.start, value.end, comparison)
    const next: DateRangeValue = {
      ...value,
      comparison,
      ...(compRange ? { compStart: compRange[0], compEnd: compRange[1] } : { compStart: undefined, compEnd: undefined }),
    }
    onChange(next)
    pushToUrl(next)
  }

  // ── Toggle excludeToday ─────────────────────────────────────────────────────
  function handleExcludeToday(exclude: boolean) {
    applyPreset(value.preset, { excludeToday: exclude })
  }

  // ── Custom calendar range picked ────────────────────────────────────────────
  function handleCustomRange(start: Date, end: Date) {
    applyPreset('custom', { start: startOfDay(start), end: endOfDay(end) })
  }

  // ── Grouped presets for sidebar ─────────────────────────────────────────────
  const groupOrder: PresetGroup[] = [
    'recent', 'period_to_date', 'completed',
    ...(segment === 'higher_ed' ? ['segment' as PresetGroup] : []),
    'custom',
  ]
  const groups = groupOrder.map((g) => ({
    group: g,
    label: GROUP_LABELS[g],
    presets: presets.filter((p) => p.group === g),
  }))

  const activePreset = presets.find((p) => p.id === value.preset)
  const canExclude = activePreset?.canExcludeToday ?? false

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={clsx('relative inline-block', className)}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
          open
            ? 'border-primary-800 bg-primary-50 text-primary-800'
            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50',
        )}
      >
        <CalendarDays className="w-4 h-4 flex-shrink-0" />
        <span className="max-w-[220px] truncate">{formatRange(value.start, value.end)}</span>
        {value.comparison !== 'none' && (
          <span className="text-xs text-primary-600 bg-primary-100 px-1.5 py-0.5 rounded-full">
            vs {value.comparison === 'prior_year' ? 'PY' : 'PP'}
          </span>
        )}
        <ChevronDown className={clsx('w-3.5 h-3.5 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Popover */}
      {open && (
        <div
          ref={popoverRef}
          className="absolute top-full mt-1.5 left-0 z-50 bg-white rounded-xl shadow-xl border border-gray-200 flex"
          style={{ minWidth: 480 }}
        >
          {/* Left: preset list */}
          <div className="w-44 flex-shrink-0 border-r border-gray-100 py-2 overflow-y-auto max-h-[420px]">
            {groups.map(({ group, label, presets: gPresets }) => (
              <div key={group}>
                <p className="px-3 pt-2 pb-0.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {label}
                </p>
                {gPresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (p.id !== 'custom') {
                        applyPreset(p.id)
                        if (p.id !== value.preset) setOpen(p.id === 'custom')
                      } else {
                        // just select it — calendar shown in right pane
                        applyPreset(p.id, { start: value.start, end: value.end })
                      }
                    }}
                    className={clsx(
                      'w-full text-left px-3 py-1.5 text-sm transition-colors',
                      value.preset === p.id
                        ? 'bg-primary-800 text-white font-medium'
                        : 'text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Right: options */}
          <div className="flex-1 p-4 flex flex-col gap-4 min-w-0">
            {/* Calendar (custom mode only) */}
            {value.preset === 'custom' && (
              <MiniCalendar
                start={value.start}
                end={value.end}
                onChange={handleCustomRange}
                weekStartsOn={weekStartsOn}
              />
            )}

            {/* Comparison toggle */}
            {showComparison && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Comparison period
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {COMPARISON_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleComparison(opt.value)}
                      className={clsx(
                        'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                        value.comparison === opt.value
                          ? 'bg-primary-800 text-white border-primary-800'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Comparison range preview */}
                {value.comparison !== 'none' && value.compStart && value.compEnd && (
                  <p className="mt-1.5 text-xs text-gray-400">
                    vs {formatRange(value.compStart, value.compEnd)}
                  </p>
                )}
              </div>
            )}

            {/* Exclude today */}
            {showExcludeToday && canExclude && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.excludeToday}
                  onChange={(e) => handleExcludeToday(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-primary-800 focus:ring-primary-600"
                />
                <span className="text-xs text-gray-600">Exclude today (partial day)</span>
              </label>
            )}

            {/* Selected range summary */}
            <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {formatRange(value.start, value.end)}
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset('last_30')}
                  title="Reset to last 30 days"
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Named re-exports for convenience ──────────────────────────────────────────
export type { DateRangeValue, DateRangeSelectorProps, Comparison } from './types'
export { calcComparisonRange, getPresets } from './presetResolver'
export { pushToUrl, readFromUrl, clearFromUrl } from './urlPersistence'
