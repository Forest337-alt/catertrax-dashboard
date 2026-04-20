import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ChartSpec } from '../../types'
import { formatValue } from '../../lib/chartSpec'
import { ChartSkeleton } from '../common/Skeleton'

// Brand navy ramp — darkest to lightest
const PALETTE = ['#234A73', '#2d5a80', '#376d8e', '#4582A9', '#5B9EC9', '#76a4c4', '#a3c2d9']

// Derive XAxis + chart margin props to prevent label crowding and SVG clipping.
// Returns xAxis props to spread on <XAxis> and margin to merge into the chart's margin prop.
// With textAnchor="end", rotated labels extend LEFT of their tick — the extra left margin
// shifts the first bar rightward so its label doesn't clip outside the SVG boundary.
function xAxisConfig(dataLength: number, axisType?: string) {
  const isCategorical = axisType !== 'temporal' && axisType !== 'numeric'
  if (isCategorical && dataLength > 8) {
    return {
      xAxis:   { angle: -45, textAnchor: 'end' as const, height: 90, interval: 0, tick: { fontSize: 10 } },
      cMargin: { left: 80 },
    }
  }
  if (isCategorical && dataLength > 4) {
    return {
      xAxis:   { angle: -35, textAnchor: 'end' as const, height: 75, interval: 0, tick: { fontSize: 11 } },
      cMargin: { left: 60 },
    }
  }
  if (dataLength > 5) {
    // Temporal / numeric with enough points to crowd — gentle tilt
    return {
      xAxis:   { angle: -20, textAnchor: 'end' as const, height: 50, interval: 0, tick: { fontSize: 11 } },
      cMargin: { left: 10 },
    }
  }
  return {
    xAxis:   { tick: { fontSize: 12 } },
    cMargin: {},
  }
}

interface Props {
  spec: ChartSpec
  data: Record<string, unknown>[]
  loading?: boolean
  onDrillDown?: (row: Record<string, unknown>) => void
}

export default function ChartRenderer({ spec, data, loading, onDrillDown }: Props) {
  if (loading) return <ChartSkeleton />

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <p className="text-sm">No data matches your query.</p>
      </div>
    )
  }

  const xField = spec.x_axis?.field
  const yField = spec.y_axis?.field
  const series = spec.series ?? (yField ? [{ field: yField, label: yField, color: PALETTE[0] }] : [])

  const yFormatter = (v: unknown) => formatValue(v, spec.y_axis?.type)
  const xFormatter = (v: unknown) => formatValue(v, spec.x_axis?.type)

  const handleClick = onDrillDown ? (row: Record<string, unknown>) => onDrillDown(row) : undefined

  const { xAxis: xAxisProps, cMargin } = xAxisConfig(data.length, spec.x_axis?.type)
  const chartMargin = { top: 5, right: 20, bottom: 5, left: 5, ...cMargin }

  switch (spec.chart_type) {
    case 'line':
      return (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={chartMargin} onClick={handleClick ? (e) => e?.activePayload && handleClick(e.activePayload[0].payload as Record<string, unknown>) : undefined}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={xField} tickFormatter={xFormatter} {...xAxisProps} />
            <YAxis tickFormatter={yFormatter} tick={{ fontSize: 12 }} width={80} />
            <Tooltip formatter={(v: unknown, name: string) => [formatValue(v, spec.y_axis?.type), name]} />
            <Legend />
            {series.map((s, i) => (
              <Line key={s.field} type="monotone" dataKey={s.field} name={s.label} stroke={PALETTE[i % PALETTE.length]} dot={false} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )

    case 'area':
      return (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data} margin={chartMargin} onClick={handleClick ? (e) => e?.activePayload && handleClick(e.activePayload[0].payload as Record<string, unknown>) : undefined}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={xField} tickFormatter={xFormatter} {...xAxisProps} />
            <YAxis tickFormatter={yFormatter} tick={{ fontSize: 12 }} width={80} />
            <Tooltip formatter={(v: unknown, name: string) => [formatValue(v, spec.y_axis?.type), name]} />
            <Legend />
            {series.map((s, i) => (
              <Area key={s.field} type="monotone" dataKey={s.field} name={s.label} stroke={PALETTE[i % PALETTE.length]} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.15} strokeWidth={2} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )

    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={chartMargin} onClick={handleClick ? (e) => e?.activePayload && handleClick(e.activePayload[0].payload as Record<string, unknown>) : undefined}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={xField} tickFormatter={xFormatter} {...xAxisProps} />
            <YAxis tickFormatter={yFormatter} tick={{ fontSize: 12 }} width={80} />
            <Tooltip formatter={(v: unknown, name: string) => [formatValue(v, spec.y_axis?.type), name]} />
            <Legend />
            {series.map((s, i) => (
              <Bar key={s.field} dataKey={s.field} name={s.label} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )

    case 'stacked_bar':
      return (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={chartMargin} onClick={handleClick ? (e) => e?.activePayload && handleClick(e.activePayload[0].payload as Record<string, unknown>) : undefined}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={xField} tickFormatter={xFormatter} {...xAxisProps} />
            <YAxis tickFormatter={yFormatter} tick={{ fontSize: 12 }} width={80} />
            <Tooltip formatter={(v: unknown, name: string) => [formatValue(v, spec.y_axis?.type), name]} />
            <Legend />
            {series.map((s, i) => (
              <Bar key={s.field} dataKey={s.field} name={s.label} fill={PALETTE[i % PALETTE.length]} stackId="a" />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )

    case 'pie': {
      const pieField = series[0]?.field ?? yField ?? ''
      return (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={data}
              dataKey={pieField}
              nameKey={xField}
              cx="50%"
              cy="50%"
              outerRadius={120}
              onClick={handleClick ? (entry: Record<string, unknown>) => handleClick(entry) : undefined}
              label={({ name, percent }: { name: string; percent: number }) =>
                `${name} (${(percent * 100).toFixed(1)}%)`
              }
            >
              {data.map((_entry, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: unknown) => formatValue(v, spec.y_axis?.type)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    case 'scatter':
      return (
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={xField} name={spec.x_axis?.label} tickFormatter={xFormatter} {...xAxisProps} />
            <YAxis dataKey={yField} name={spec.y_axis?.label} tickFormatter={yFormatter} tick={{ fontSize: 12 }} width={80} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={data} fill={PALETTE[0]} onClick={handleClick} />
          </ScatterChart>
        </ResponsiveContainer>
      )

    case 'kpi_card': {
      const kpiField = series[0]?.field ?? yField ?? Object.keys(data[0] ?? {})[0] ?? ''
      const value = data[0]?.[kpiField]
      return (
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <p className="text-5xl font-bold text-primary-800">
              {formatValue(value, spec.y_axis?.type ?? series[0]?.field)}
            </p>
            <p className="mt-2 text-gray-500 text-sm">{spec.description}</p>
          </div>
        </div>
      )
    }

    case 'table':
      return <DataTable data={data} spec={spec} onRowClick={handleClick} />

    case 'heatmap':
      return <HeatmapChart data={data} spec={spec} />

    default:
      return <DataTable data={data} spec={spec} onRowClick={handleClick} />
  }
}

// ─── Table renderer ───────────────────────────────────────────────────────────

function DataTable({
  data,
  spec,
  onRowClick,
}: {
  data: Record<string, unknown>[]
  spec: ChartSpec
  onRowClick?: (row: Record<string, unknown>) => void
}) {
  const columns = Object.keys(data[0] ?? {})

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className={`border-b border-gray-100 ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => {
                const valueType =
                  col === spec.y_axis?.field ? spec.y_axis?.type :
                  col === spec.x_axis?.field ? spec.x_axis?.type : undefined
                return (
                  <td key={col} className="px-3 py-2 text-gray-700">
                    {formatValue(row[col], valueType)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Heatmap renderer ─────────────────────────────────────────────────────────

function HeatmapChart({
  data,
  spec,
}: {
  data: Record<string, unknown>[]
  spec: ChartSpec
}) {
  const xField = spec.x_axis?.field ?? ''
  const yField = spec.y_axis?.field ?? ''
  const valueField = spec.series?.[0]?.field ?? ''

  const xValues = [...new Set(data.map((r) => String(r[xField])))]
  const yValues = [...new Set(data.map((r) => String(r[yField])))]
  const allValues = data.map((r) => Number(r[valueField]))
  const maxVal = Math.max(...allValues)

  return (
    <div className="overflow-x-auto p-2">
      <table className="text-xs border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-20" />
            {xValues.map((x) => (
              <th key={x} className="px-2 py-1 text-gray-500 font-medium">{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {yValues.map((y) => (
            <tr key={y}>
              <td className="text-gray-500 font-medium pr-2">{y}</td>
              {xValues.map((x) => {
                const cell = data.find((r) => String(r[xField]) === x && String(r[yField]) === y)
                const val = cell ? Number(cell[valueField]) : 0
                const intensity = maxVal > 0 ? val / maxVal : 0
                return (
                  <td
                    key={x}
                    title={`${x} / ${y}: ${val}`}
                    className="w-16 h-10 rounded text-center font-medium"
                    style={{
                      backgroundColor: `rgba(35, 74, 115, ${Math.max(0.05, intensity)})`,
                      color: intensity > 0.5 ? 'white' : '#234A73',
                    }}
                  >
                    {val || ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
