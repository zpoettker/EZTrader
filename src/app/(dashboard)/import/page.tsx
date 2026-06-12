'use client'

import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { parseCSV, type ParsedTrade } from '@/lib/csv-parsers'

type ImportState = 'idle' | 'preview' | 'importing' | 'done' | 'error'

function formatPnl(v: number | null) {
  if (v == null) return '—'
  const formatted = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${v < 0 ? '-' : '+'}$${formatted}`
}

export default function ImportPage() {
  const [state, setState] = useState<ImportState>('idle')
  const [trades, setTrades] = useState<ParsedTrade[]>([])
  const [broker, setBroker] = useState('')
  const [error, setError] = useState('')
  const [importedCount, setImportedCount] = useState(0)
  const [accountId, setAccountId] = useState('')
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadAccounts() {
    const supabase = createClient()
    const { data } = await supabase.from('accounts').select('id, name').order('name')
    setAccounts(data ?? [])
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')

    const text = await file.text()
    const result = parseCSV(text)

    if (result.broker === 'unknown') {
      setError('Could not detect broker format. Supported: NinjaTrader, Tradovate.')
      return
    }
    if (result.trades.length === 0) {
      setError('No trades found in this file.')
      return
    }

    setTrades(result.trades)
    setBroker(result.broker)
    setState('preview')
    await loadAccounts()
  }

  function reset() {
    setState('idle')
    setTrades([])
    setBroker('')
    setError('')
    setAccountId('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleImport() {
    if (!accountId) {
      setError('Select an account before importing.')
      return
    }
    setState('importing')
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated.')
      setState('preview')
      return
    }

    const rows = trades.map((t) => ({ ...t, user_id: user.id, account_id: accountId }))

    // Insert in batches of 100
    let count = 0
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100)
      const { error: insertError } = await supabase.from('trades').insert(batch)
      if (insertError) {
        setError(`Import failed: ${insertError.message}`)
        setState('error')
        return
      }
      count += batch.length
    }

    setImportedCount(count)
    setState('done')
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Import Trades
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Upload a CSV export from NinjaTrader or Tradovate
        </p>
      </div>

      {/* Upload zone */}
      {state === 'idle' && (
        <div
          className="rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors"
          style={{
            background: 'var(--color-bg-card)',
            border: '2px dashed var(--color-border)',
          }}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={32} style={{ color: 'var(--color-text-muted)' }} />
          <p className="mt-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Click to upload CSV
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            NinjaTrader execution report or Tradovate activity statement
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      )}

      {error && (
        <div
          className="mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
          style={{ background: 'var(--color-loss-muted)', color: 'var(--color-loss)' }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Preview */}
      {(state === 'preview' || state === 'importing') && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span
                className="text-xs px-2 py-1 rounded font-mono uppercase"
                style={{ background: 'var(--color-bg-hover)', color: 'var(--color-accent-blue)' }}
              >
                {broker}
              </span>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {trades.length} trades detected
              </span>
            </div>
            <button onClick={reset} style={{ color: 'var(--color-text-muted)' }}>
              <X size={18} />
            </button>
          </div>

          {/* Account selector */}
          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Import to account:
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="">Select account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {accounts.length === 0 && (
              <span className="text-xs" style={{ color: 'var(--color-loss)' }}>
                No accounts found — create one in Settings first
              </span>
            )}
          </div>

          {/* Preview table */}
          <div
            className="rounded-xl overflow-hidden mb-4"
            style={{ border: '1px solid var(--color-border)' }}
          >
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                    {['Symbol', 'Direction', 'Entry Time', 'Exit Time', 'Qty', 'Entry', 'Exit', 'Gross P&L', 'Comm', 'Net P&L'].map((col) => (
                      <th
                        key={col}
                        className="px-4 py-2.5 text-left font-medium whitespace-nowrap"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.slice(0, 50).map((t, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                    >
                      <td className="px-4 py-2 font-mono" style={{ color: 'var(--color-text-primary)' }}>{t.symbol}</td>
                      <td className="px-4 py-2">
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
                      <td className="px-4 py-2 font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                        {t.entry_time ? new Date(t.entry_time).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2 font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                        {t.exit_time ? new Date(t.exit_time).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2 font-mono" style={{ color: 'var(--color-text-secondary)' }}>{t.quantity ?? '—'}</td>
                      <td className="px-4 py-2 font-mono" style={{ color: 'var(--color-text-secondary)' }}>{t.entry_price ?? '—'}</td>
                      <td className="px-4 py-2 font-mono" style={{ color: 'var(--color-text-secondary)' }}>{t.exit_price ?? '—'}</td>
                      <td className="px-4 py-2 font-mono font-medium" style={{ color: (t.pnl ?? 0) >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                        {formatPnl(t.pnl)}
                      </td>
                      <td className="px-4 py-2 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                        ${t.commission.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 font-mono font-medium" style={{ color: (t.net_pnl ?? 0) >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                        {formatPnl(t.net_pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {trades.length > 50 && (
              <div
                className="px-4 py-2 text-xs text-center"
                style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)' }}
              >
                Showing first 50 of {trades.length} trades
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleImport}
              disabled={state === 'importing' || !accountId}
              className="px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              style={{ background: 'var(--color-accent-blue)', color: '#fff' }}
            >
              {state === 'importing' ? 'Importing…' : `Import ${trades.length} Trades`}
            </button>
            <button
              onClick={reset}
              disabled={state === 'importing'}
              className="px-5 py-2 rounded-lg text-sm"
              style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {state === 'done' && (
        <div
          className="rounded-xl p-8 flex flex-col items-center gap-3"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <CheckCircle size={36} style={{ color: 'var(--color-profit)' }} />
          <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {importedCount} trades imported
          </p>
          <div className="flex gap-3 mt-2">
            <a
              href="/trades"
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--color-accent-blue)', color: '#fff' }}
            >
              View Trade Log
            </a>
            <button
              onClick={reset}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
