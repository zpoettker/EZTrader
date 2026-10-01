'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Trade } from '@/types'

const PAGE_SIZE = 25

function formatPnl(v: number | null) {
  if (v == null) return '—'
  const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${v < 0 ? '-' : '+'}$${abs}`
}

function pnlColor(v: number | null) {
  if (v == null) return 'var(--color-text-muted)'
  return v >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
}

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [symbolFilter, setSymbolFilter] = useState('')
  const [directionFilter, setDirectionFilter] = useState<'' | 'long' | 'short'>('')

  const fetchTrades = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('trades')
      .select('*', { count: 'exact' })
      .order('entry_time', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (dateFrom) query = query.gte('entry_time', `${dateFrom}T00:00:00`)
    if (dateTo) query = query.lte('entry_time', `${dateTo}T23:59:59`)
    if (symbolFilter) query = query.ilike('symbol', `%${symbolFilter}%`)
    if (directionFilter) query = query.eq('direction', directionFilter)

    const { data, count } = await query
    setTrades(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, dateFrom, dateTo, symbolFilter, directionFilter])

  useEffect(() => {
    fetchTrades()
  }, [fetchTrades])

  function applyFilters() {
    setPage(0)
    fetchTrades()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Trade Log
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {total.toLocaleString()} total trades
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        className="rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Filters</span>
        </div>

        <FilterField label="From">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          />
        </FilterField>

        <FilterField label="To">
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          />
        </FilterField>

        <FilterField label="Symbol">
          <input
            type="text"
            placeholder="e.g. MNQ"
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-xs outline-none w-24"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          />
        </FilterField>

        <FilterField label="Direction">
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value as '' | 'long' | 'short')}
            className="px-2.5 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            <option value="">All</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </FilterField>

        <button
          onClick={applyFilters}
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: 'var(--color-button)', color: '#fff' }}
        >
          Apply
        </button>

        <button
          onClick={() => {
            setDateFrom('')
            setDateTo('')
            setSymbolFilter('')
            setDirectionFilter('')
            setPage(0)
          }}
          className="px-3 py-1.5 rounded-lg text-xs"
          style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
        >
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                {['Date', 'Symbol', 'Direction', 'Entry', 'Exit', 'Qty', 'Gross P&L', 'Comm', 'Net P&L', 'Setup'].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left font-medium whitespace-nowrap"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    Loading…
                  </td>
                </tr>
              ) : trades.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    No trades found
                  </td>
                </tr>
              ) : trades.map((t) => (
                <tr
                  key={t.id}
                  style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                >
                  <td className="px-4 py-2.5 font-mono whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                    {t.entry_time ? new Date(t.entry_time).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {t.symbol}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-medium"
                      style={{
                        background: t.direction === 'long' ? 'var(--color-profit-muted)' : 'var(--color-loss-muted)',
                        color: t.direction === 'long' ? 'var(--color-profit)' : 'var(--color-loss)',
                      }}
                    >
                      {t.direction}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {t.entry_price ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {t.exit_price ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {t.quantity ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-medium" style={{ color: pnlColor(t.pnl) }}>
                    {formatPnl(t.pnl)}
                  </td>
                  <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    ${(t.commission ?? 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-medium" style={{ color: pnlColor(t.net_pnl) }}>
                    {formatPnl(t.net_pnl)}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--color-text-muted)' }}>
                    {t.setup_tag ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: 'var(--color-bg-secondary)', borderTop: '1px solid var(--color-border)' }}
          >
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded disabled:opacity-30"
                style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded disabled:opacity-30"
                style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      {children}
    </div>
  )
}
