'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DataPoint {
  date: string
  cumPnl: number
}

interface EquityCurveProps {
  data: DataPoint[]
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const value = payload[0].value
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      <p style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
      <p
        className="font-semibold mt-0.5"
        style={{ color: value >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
      >
        {value >= 0 ? '+' : ''}${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>
    </div>
  )
}

export default function EquityCurve({ data }: EquityCurveProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48" style={{ color: 'var(--color-text-muted)' }}>
        No trade data yet
      </div>
    )
  }

  const isPositive = data[data.length - 1]?.cumPnl >= 0
  const strokeColor = isPositive ? 'var(--color-profit)' : 'var(--color-loss)'

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border-subtle)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${v >= 0 ? '' : '-'}${Math.abs(v).toLocaleString()}`}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="cumPnl"
          stroke={strokeColor}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: strokeColor }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
