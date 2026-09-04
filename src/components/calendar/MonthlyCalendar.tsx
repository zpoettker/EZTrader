'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, StickyNote } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Trade } from '@/types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function money(v: number, pad = false) {
  const abs = Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: pad ? 2 : 0,
    maximumFractionDigits: 2,
  })
  return `${v < 0 ? '-' : ''}$${abs}`
}

interface DayStat {
  pnl: number
  trades: number
  wins: number
}

interface MonthlyCalendarProps {
  /** Set the dashboard's top widgets to the month currently shown here. */
  onSync?: (monthStart: Date, monthEnd: Date) => void
}

export default function MonthlyCalendar({ onSync }: MonthlyCalendarProps) {
  const [view, setView] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const start = new Date(view.getFullYear(), view.getMonth(), 1)
      const end = new Date(view.getFullYear(), view.getMonth() + 1, 1)

      const { data } = await supabase
        .from('trades')
        .select('*')
        .gte('entry_time', start.toISOString())
        .lt('entry_time', end.toISOString())
        .order('entry_time', { ascending: true })

      if (!cancelled) {
        setTrades(data ?? [])
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [view])

  const { dayStats, weeks, weekSummaries, monthPnl, tradingDays } = useMemo(() => {
    const stats: Record<string, DayStat> = {}
    for (const t of trades) {
      if (!t.entry_time) continue
      const key = ymd(new Date(t.entry_time))
      const s = (stats[key] ??= { pnl: 0, trades: 0, wins: 0 })
      s.pnl += t.net_pnl ?? 0
      s.trades += 1
      if ((t.net_pnl ?? 0) > 0) s.wins += 1
    }

    const year = view.getFullYear()
    const month = view.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstWeekday = new Date(year, month, 1).getDay()

    const cells: (number | null)[] = []
    for (let i = 0; i < firstWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)

    const weeks: (number | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

    const weekSummaries = weeks.map((week) => {
      let pnl = 0
      let days = 0
      for (const d of week) {
        if (d == null) continue
        const s = stats[ymd(new Date(year, month, d))]
        if (s) {
          pnl += s.pnl
          days += 1
        }
      }
      return { pnl, days }
    })

    const monthPnl = Object.values(stats).reduce((s, d) => s + d.pnl, 0)
    const tradingDays = Object.keys(stats).length

    return { dayStats: stats, weeks, weekSummaries, monthPnl, tradingDays }
  }, [trades, view])

  const monthLabel = view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayKey = ymd(new Date())

  const goToday = () => {
    const d = new Date()
    setView(new Date(d.getFullYear(), d.getMonth(), 1))
  }
  const shift = (delta: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1))

  const navBtn = {
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
  }
  const pill = (bg: string, color: string) => ({
    background: bg,
    color,
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
  })

  return (
    <div
      className="rounded-xl p-5 mt-4"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="p-1.5 rounded-lg" style={navBtn} aria-label="Previous month">
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={goToday}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={navBtn}
          >
            TODAY
          </button>
          <button onClick={() => shift(1)} className="p-1.5 rounded-lg" style={navBtn} aria-label="Next month">
            <ChevronRight size={14} />
          </button>
          <span className="ml-2 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {monthLabel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onSync && (
            <button
              onClick={() =>
                onSync(
                  new Date(view.getFullYear(), view.getMonth(), 1),
                  new Date(view.getFullYear(), view.getMonth() + 1, 0),
                )
              }
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={navBtn}
            >
              SYNC
            </button>
          )}
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Monthly stats:
          </span>
          <span
            style={pill(
              monthPnl > 0 ? 'var(--color-profit-muted)' : monthPnl < 0 ? 'var(--color-loss-muted)' : 'var(--color-bg-hover)',
              monthPnl > 0 ? 'var(--color-profit)' : monthPnl < 0 ? 'var(--color-loss)' : 'var(--color-text-secondary)',
            )}
          >
            {money(monthPnl, true)}
          </span>
          <span style={pill('var(--color-bg-hover)', 'var(--color-text-secondary)')}>
            {tradingDays} day{tradingDays === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="flex gap-3" style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 120ms' }}>
        {/* Calendar grid */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium py-2 rounded"
                style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)' }}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weeks.flat().map((day, i) => {
              if (day == null) {
                return (
                  <div
                    key={i}
                    className="rounded-lg min-h-[92px]"
                    style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-subtle)' }}
                  />
                )
              }

              const key = ymd(new Date(view.getFullYear(), view.getMonth(), day))
              const s = dayStats[key]
              const positive = s && s.pnl > 0
              const negative = s && s.pnl < 0
              const isToday = key === todayKey

              return (
                <div
                  key={i}
                  className="rounded-lg min-h-[92px] p-2 flex flex-col"
                  style={{
                    background: positive
                      ? 'rgba(34, 197, 94, 0.13)'
                      : negative
                      ? 'rgba(239, 68, 68, 0.11)'
                      : 'var(--color-bg-secondary)',
                    border: `1px solid ${
                      positive ? 'var(--color-profit)' : negative ? 'var(--color-loss)' : 'var(--color-border-subtle)'
                    }`,
                  }}
                >
                  <div className="flex items-start justify-between">
                    {s ? <StickyNote size={12} style={{ color: 'var(--color-text-muted)' }} /> : <span />}
                    <span className="flex items-center gap-1">
                      {isToday && (
                        <span
                          aria-label="Today"
                          style={{
                            width: 0,
                            height: 0,
                            borderTop: '4px solid transparent',
                            borderBottom: '4px solid transparent',
                            borderLeft: '5px solid var(--color-loss)',
                          }}
                        />
                      )}
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                        {day}
                      </span>
                    </span>
                  </div>

                  {s && (
                    <div className="mt-auto">
                      <p
                        className="text-sm font-bold font-mono leading-tight"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {money(s.pnl)}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {s.trades} trade{s.trades === 1 ? '' : 's'}
                      </p>
                      <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                        {Math.round((s.wins / s.trades) * 100)}% WR
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Weekly summary column */}
        <div className="hidden lg:flex flex-col gap-1 w-36 shrink-0">
          {/* spacer to align with weekday header row */}
          <div className="py-2 mb-1 text-xs invisible">.</div>
          {weekSummaries.map((w, i) => (
            <div
              key={i}
              className="min-h-[92px] rounded-lg p-3 flex flex-col justify-center"
              style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)' }}
            >
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Week {i + 1}
              </p>
              <p
                className="text-base font-bold font-mono my-1"
                style={{
                  color:
                    w.pnl > 0
                      ? 'var(--color-profit)'
                      : w.pnl < 0
                      ? 'var(--color-loss)'
                      : 'var(--color-text-secondary)',
                }}
              >
                {money(w.pnl, true)}
              </p>
              <span
                className="self-start"
                style={pill('var(--color-bg-hover)', 'var(--color-text-muted)')}
              >
                {w.days} day{w.days === 1 ? '' : 's'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
