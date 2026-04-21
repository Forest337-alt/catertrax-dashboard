// ─── MiniCalendar — lightweight range-picker calendar ────────────────────────
import { useState } from 'react'
import {
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  addDays, addMonths, subMonths,
  isSameDay, isSameMonth,
  isWithinInterval, isAfter, isBefore,
  format,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  start: Date | null
  end: Date | null
  /** Called when the user finishes picking (both dates selected). */
  onChange: (start: Date, end: Date) => void
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  minDate?: Date
  maxDate?: Date
}

export default function MiniCalendar({
  start,
  end,
  onChange,
  weekStartsOn = 0,
  minDate,
  maxDate,
}: Props) {
  const [viewMonth, setViewMonth] = useState<Date>(start ?? new Date())
  const [hovered, setHovered] = useState<Date | null>(null)
  // picking: null = waiting for first click, 'start' = first picked, need end
  const [picking, setPicking] = useState<'start' | null>(null)

  const weeks = buildWeeks(viewMonth, weekStartsOn)
  const dayLabels = buildDayLabels(weekStartsOn)

  function handleDayClick(day: Date) {
    if (minDate && isBefore(day, minDate)) return
    if (maxDate && isAfter(day, maxDate)) return

    if (picking === null) {
      // first click: set start, wait for end
      setPicking('start')
    } else {
      // second click: finalise range
      const [s, e] = isAfter(day, start!)
        ? [start!, day]
        : [day, start!]
      onChange(s, e)
      setPicking(null)
      setHovered(null)
    }
  }

  function isRangeDay(day: Date): boolean {
    const effectiveEnd = picking === 'start' ? (hovered ?? null) : end
    if (!start || !effectiveEnd) return false
    const [s, e] = isAfter(effectiveEnd, start)
      ? [start, effectiveEnd]
      : [effectiveEnd, start]
    return isWithinInterval(day, { start: s, end: e })
  }

  function isStartDay(day: Date): boolean {
    if (picking === 'start' && hovered && start) {
      const [s] = isAfter(hovered, start) ? [start, hovered] : [hovered, start]
      return isSameDay(day, s)
    }
    return !!start && isSameDay(day, start)
  }

  function isEndDay(day: Date): boolean {
    if (picking === 'start' && hovered && start) {
      const [, e] = isAfter(hovered, start) ? [start, hovered] : [hovered, start]
      return isSameDay(day, e)
    }
    return !!end && !picking && isSameDay(day, end)
  }

  return (
    <div className="select-none text-sm">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          className="p-1 rounded hover:bg-gray-100 text-gray-600 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-semibold text-gray-800">
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="p-1 rounded hover:bg-gray-100 text-gray-600 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {dayLabels.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((day, di) => {
            const outside = !isSameMonth(day, viewMonth)
            const disabled =
              outside ||
              (minDate ? isBefore(day, minDate) : false) ||
              (maxDate ? isAfter(day, maxDate) : false)
            const inRange = !disabled && isRangeDay(day)
            const isStart = !disabled && isStartDay(day)
            const isEnd = !disabled && isEndDay(day)
            const isToday = isSameDay(day, new Date())

            return (
              <button
                key={di}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && handleDayClick(day)}
                onMouseEnter={() => picking === 'start' && !disabled && setHovered(day)}
                onMouseLeave={() => picking === 'start' && setHovered(null)}
                className={[
                  'relative h-8 flex items-center justify-center text-xs transition-colors',
                  disabled ? 'text-gray-300 cursor-default' : 'cursor-pointer',
                  inRange && !isStart && !isEnd ? 'bg-primary-100 text-primary-800' : '',
                  isStart || isEnd
                    ? 'bg-primary-800 text-white font-semibold rounded-full z-10'
                    : !disabled && !inRange
                    ? 'hover:bg-gray-100 rounded-full text-gray-700'
                    : '',
                  isToday && !isStart && !isEnd ? 'font-bold' : '',
                ].join(' ')}
              >
                {day.getDate()}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────

function buildWeeks(month: Date, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6): Date[][] {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const gridStart = startOfWeek(monthStart, { weekStartsOn })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn })

  const weeks: Date[][] = []
  let current = gridStart
  while (!isAfter(current, gridEnd)) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(current)
      current = addDays(current, 1)
    }
    weeks.push(week)
  }
  return weeks
}

function buildDayLabels(weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6): string[] {
  const labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  return [...labels.slice(weekStartsOn), ...labels.slice(0, weekStartsOn)]
}
