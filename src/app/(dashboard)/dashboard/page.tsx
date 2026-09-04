'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import StatCard from '@/components/ui/StatCard'
import EquityCurve from '@/components/charts/EquityCurve'
import MonthlyCalendar from '@/components/calendar/MonthlyCalendar'
import type { Trade, AnalyticsSummary } from '@/types'

function fmt(v: number, prefix = '$') {
  const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${v < 0 ? '-' : ''}${prefix}${abs}`
}

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

// Average reward-to-risk: mean win size vs. mean loss size over the range.
function fmtRR(avgWin: number, avgLoss: number) {
  const risk = Math.abs(avgLoss)
  if (risk === 0) return avgWin > 0 ? '∞:1' : '—'
  return `${(avgWin / risk).toFixed(1)}:1`
}

type Range = '7d' | '30d' | '90d' | 'all' | 'custom'

function fmtShort(iso: string) {
  const [, m, d] = iso.split('-')
  return `${+m}/${+d}`
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DashboardPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('30d')

  // Custom range: `customFrom`/`customTo` are the applied values that drive the
  // query; `draftFrom`/`draftTo` are what's being edited in the dropdown.
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const customRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showCustom) return
    function onClick(e: MouseEvent) {
      if (customRef.current && !customRef.current.contains(e.target as Node)) {
        setShowCustom(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showCustom])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()

      let query = supabase
        .from('trades')
        .select('*')
        .order('entry_time', { ascending: true })

      if (range === 'custom') {
        if (customFrom) query = query.gte('entry_time', `${customFrom}T00:00:00`)
        if (customTo) query = query.lte('entry_time', `${customTo}T23:59:59`)
      } else if (range !== 'all') {
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
  }, [range, customFrom, customTo])

  function applyCustom() {
    if (!draftFrom || !draftTo) return
    const from = draftFrom <= draftTo ? draftFrom : draftTo
    const to = draftFrom <= draftTo ? draftTo : draftFrom
    setCustomFrom(from)
    setCustomTo(to)
    setRange('custom')
    setShowCustom(false)
  }

  function openCustom() {
    setDraftFrom(customFrom)
    setDraftTo(customTo)
    setShowCustom((s) => !s)
  }

  // Point the top widgets at the month the calendar is currently showing.
  function syncToMonth(monthStart: Date, monthEnd: Date) {
    const from = toYmd(monthStart)
    const to = toYmd(monthEnd)
    setCustomFrom(from)
    setCustomTo(to)
    setDraftFrom(from)
    setDraftTo(to)
    setRange('custom')
    setShowCustom(false)
  }

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
        <div ref={customRef} className="relative">
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
            <button
              onClick={openCustom}
              className="px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1"
              style={{
                background: range === 'custom' || showCustom ? 'var(--color-bg-hover)' : 'transparent',
                color: range === 'custom' || showCustom ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              }}
            >
              {range === 'custom' && customFrom && customTo
                ? `${fmtShort(customFrom)} – ${fmtShort(customTo)}`
                : 'Custom'}
              <ChevronDown size={12} />
            </button>
          </div>

          {showCustom && (
            <div
              className="absolute right-0 top-full mt-2 z-20 rounded-lg p-4 w-72"
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              }}
            >
              <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Custom range
              </p>
              <div className="flex flex-col gap-3">
                <label className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  From
                  <input
                    type="date"
                    value={draftFrom}
                    max={draftTo || undefined}
                    onChange={(e) => setDraftFrom(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg text-xs outline-none"
                    style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', colorScheme: 'dark' }}
                  />
                </label>
                <label className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  To
                  <input
                    type="date"
                    value={draftTo}
                    min={draftFrom || undefined}
                    onChange={(e) => setDraftTo(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg text-xs outline-none"
                    style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', colorScheme: 'dark' }}
                  />
                </label>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={applyCustom}
                    disabled={!draftFrom || !draftTo}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                    style={{ background: 'var(--color-accent-blue)', color: '#fff' }}
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setShowCustom(false)}
                    className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
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
            label="Avg R:R"
            value={fmtRR(summary.avg_win, summary.avg_loss)}
            positive={Math.abs(summary.avg_loss) > 0 && summary.avg_win / Math.abs(summary.avg_loss) >= 2}
            negative={Math.abs(summary.avg_loss) > 0 && summary.avg_win / Math.abs(summary.avg_loss) < 1}
            subtext={`${summary.wins}W / ${summary.losses}L`}
          />
          <StatCard
            label="Total Trades"
            value={summary.total_trades.toLocaleString()}
            subtext={`Avg win: ${fmt(summary.avg_win)}`}
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
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mt-4">
          <StatCard
            label="Profit Factor"
            value={isFinite(summary.profit_factor) ? summary.profit_factor.toFixed(2) : '∞'}
            positive={summary.profit_factor >= 1.5}
            negative={summary.profit_factor < 1}
            subtext={`Expectancy: ${fmt(summary.expectancy)}`}
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
          <StatCard
            label="Max Drawdown"
            value={fmt(summary.max_drawdown)}
            negative={summary.max_drawdown > 0}
          />
        </div>
      )}

      {/* Monthly P&L calendar */}
      <MonthlyCalendar onSync={syncToMonth} />
    </div>
  )
}
