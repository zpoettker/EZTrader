'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import StatCard from '@/components/ui/StatCard'
import EquityCurve from '@/components/charts/EquityCurve'
import type { Trade, AnalyticsSummary } from '@/types'

function fmt(v: number, prefix = '$') {
  const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${v < 0 ? '-' : ''}${prefix}${abs}`
}

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

export default function DashboardPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()

      let query = supabase
        .from('trades')
        .select('*')
        .order('entry_time', { ascending: true })

      if (range !== 'all') {
        const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - days)
        query = query.gte('entry_time', cutoff.toISOString())
      }

      const { data } = await query
      const fetchedTrades = data ?? []
      setTrades(fetchedTrades)

      if (fetchedTrades.length > 0) {
        const res = await fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fetchedTrades),
        })
        if (res.ok) setSummary(await res.json())
      } else {
        setSummary(null)
      }

      setLoading(false)
    }

    load()
  }, [range])

  // Build equity curve data (daily cumulative net P&L)
  const equityData = (() => {
    if (!trades.length) return []
    const byDate: Record<string, number> = {}
    for (const t of trades) {
      if (!t.entry_time || t.net_pnl == null) continue
      const date = t.entry_time.slice(0, 10)
      byDate[date] = (byDate[date] ?? 0) + (t.net_pnl ?? 0)
    }
    let cum = 0
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, pnl]) => {
        cum += pnl
        return {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          cumPnl: Math.round(cum * 100) / 100,
        }
      })
  })()

  const rangeButtons: { label: string; value: typeof range }[] = [
    { label: '7D', value: '7d' },
    { label: '30D', value: '30d' },
    { label: '90D', value: '90d' },
    { label: 'All', value: 'all' },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Dashboard
        </h1>
        <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          {rangeButtons.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setRange(value)}
              className="px-3 py-1 rounded text-xs font-medium transition-colors"
              style={{
                background: range === value ? 'var(--color-bg-hover)' : 'transparent',
                color: range === value ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl h-24 animate-pulse" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }} />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
          <StatCard
            label="Net P&L"
            value={fmt(summary.net_pnl)}
            positive={summary.net_pnl > 0}
            negative={summary.net_pnl < 0}
            subtext={`Gross: ${fmt(summary.gross_pnl)}`}
          />
          <StatCard
            label="Win Rate"
            value={fmtPct(summary.win_rate)}
            subtext={`${summary.wins}W / ${summary.losses}L`}
          />
          <StatCard
            label="Total Trades"
            value={summary.total_trades.toLocaleString()}
            subtext={`Avg win: ${fmt(summary.avg_win)}`}
          />
          <StatCard
            label="Profit Factor"
            value={isFinite(summary.profit_factor) ? summary.profit_factor.toFixed(2) : '∞'}
            positive={summary.profit_factor >= 1.5}
            negative={summary.profit_factor < 1}
            subtext={`Expectancy: ${fmt(summary.expectancy)}`}
          />
        </div>
      ) : (
        <div
          className="rounded-xl p-8 mb-6 text-center text-sm"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          No trades for this period.{' '}
          <a href="/import" style={{ color: 'var(--color-accent-blue)' }}>Import trades</a> to get started.
        </div>
      )}

      {/* Equity Curve */}
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <p className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Equity Curve
        </p>
        <EquityCurve data={equityData} />
      </div>

      {/* Secondary stats */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 mt-4">
          <StatCard
            label="Max Drawdown"
            value={fmt(summary.max_drawdown)}
            negative={summary.max_drawdown > 0}
          />
          <StatCard
            label="Avg Win"
            value={fmt(summary.avg_win)}
            positive={summary.avg_win > 0}
          />
          <StatCard
            label="Avg Loss"
            value={fmt(summary.avg_loss)}
            negative={summary.avg_loss < 0}
          />
        </div>
      )}
    </div>
  )
}
