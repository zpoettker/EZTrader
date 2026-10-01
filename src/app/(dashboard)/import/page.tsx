'use client'

import { useState, useRef, useMemo } from 'react'
import { Upload, CheckCircle, AlertCircle, X, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { parseCSV, productFromContract, type ParsedTrade } from '@/lib/csv-parsers'
import { loadFees, saveFees } from '@/lib/fees'
import { tradeKey, fetchExistingKeys } from '@/lib/trade-dedupe'

type ImportState = 'idle' | 'preview' | 'importing' | 'done' | 'error'

function formatPnl(v: number | null) {
  if (v == null) return '—'
  const formatted = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${v < 0 ? '-' : '+'}$${formatted}`
}

export default function ImportPage() {
  const [state, setState] = useState<ImportState>('idle')
  const [parsedTrades, setTrades] = useState<ParsedTrade[]>([])
  const [fees, setFees] = useState<Record<string, string>>({})
  const [broker, setBroker] = useState('')
  const [error, setError] = useState('')
  const [importedCount, setImportedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [existingKeys, setExistingKeys] = useState<Set<string> | null>(null)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
  const [newAccountName, setNewAccountName] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Tradovate exports have no fees, so they're entered per product and applied here
  const feesApply = broker === 'tradovate'
  const products = useMemo(
    () => [...new Set(parsedTrades.map((t) => productFromContract(t.symbol)))].sort(),
    [parsedTrades],
  )
  const trades = useMemo(() => {
    if (!feesApply) return parsedTrades
    return parsedTrades.map((t) => {
      const fee = parseFloat(fees[productFromContract(t.symbol)] ?? '') || 0
      const commission = Math.round(fee * (t.quantity ?? 0) * 100) / 100
      const net_pnl = t.pnl != null ? Math.round((t.pnl - commission) * 100) / 100 : null
      return { ...t, commission, net_pnl }
    })
  }, [parsedTrades, fees, feesApply])
  // A trade is a duplicate if the account already has it, or it appears earlier in this file
  const duplicateFlags = useMemo(() => {
    const seen = new Set(existingKeys ?? [])
    return trades.map((t) => {
      const key = tradeKey(t)
      if (seen.has(key)) return true
      seen.add(key)
      return false
    })
  }, [trades, existingKeys])
  const newTrades = useMemo(() => trades.filter((_, i) => !duplicateFlags[i]), [trades, duplicateFlags])
  const duplicateCount = trades.length - newTrades.length

  const totals = useMemo(
    () => trades.reduce(
      (acc, t) => ({
        gross: acc.gross + (t.pnl ?? 0),
        fees: acc.fees + t.commission,
        net: acc.net + (t.net_pnl ?? 0),
      }),
      { gross: 0, fees: 0, net: 0 },
    ),
    [trades],
  )

  function updateFee(product: string, value: string) {
    const next = { ...fees, [product]: value }
    setFees(next)
    saveFees(next)
  }

  async function loadAccounts(): Promise<{ id: string; name: string }[]> {
    const supabase = createClient()
    const { data } = await supabase.from('accounts').select('id, name').order('name')
    setAccounts(data ?? [])
    return data ?? []
  }

  async function selectAccount(id: string) {
    setAccountId(id)
    setExistingKeys(null)
    if (!id) return

    setCheckingDuplicates(true)
    try {
      setExistingKeys(await fetchExistingKeys(createClient(), id))
    } catch (e) {
      setError(`Could not check for duplicates: ${(e as Error).message}`)
    }
    setCheckingDuplicates(false)
  }

  async function handleCreateAccount() {
    const name = newAccountName.trim()
    if (!name) return
    setCreatingAccount(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated.')
      setCreatingAccount(false)
      return
    }

    const { error: insertError } = await supabase
      .from('accounts')
      .insert({ user_id: user.id, name, broker: broker || null })
    if (insertError) {
      setError(`Could not create account: ${insertError.message}`)
      setCreatingAccount(false)
      return
    }

    const list = await loadAccounts()
    const created = list.find((a) => a.name === name)
    if (created) await selectAccount(created.id)
    setNewAccountName('')
    setCreatingAccount(false)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')

    const text = await file.text()
    if (!text.trim() || text.trim() === 'undefined') {
      setError('This file is empty. The broker export may have failed, so try downloading it again.')
      return
    }
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
    setFees(loadFees())
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
    setExistingKeys(null)
    setNewAccountName('')
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

    // Re-check against the database in case trades were added since the account was selected
    let keys: Set<string>
    try {
      keys = await fetchExistingKeys(supabase, accountId)
    } catch (e) {
      setError(`Could not check for duplicates: ${(e as Error).message}`)
      setState('preview')
      return
    }
    const toInsert = trades.filter((t) => {
      const key = tradeKey(t)
      if (keys.has(key)) return false
      keys.add(key)
      return true
    })

    const rows = toInsert.map((t) => ({ ...t, user_id: user.id, account_id: accountId }))

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
    setSkippedCount(trades.length - toInsert.length)
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
            NinjaTrader execution report or Tradovate Orders export
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
                {accountId && existingKeys && (
                  <>
                    {' · '}
                    <span style={{ color: 'var(--color-text-primary)' }}>{newTrades.length} new</span>
                    {duplicateCount > 0 && ` · ${duplicateCount} already imported`}
                  </>
                )}
                {checkingDuplicates && ' · checking for duplicates…'}
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
              onChange={(e) => selectAccount(e.target.value)}
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
          </div>

          {/* New account */}
          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {accounts.length === 0 ? 'Create an account:' : 'Or create new:'}
            </label>
            <input
              type="text"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateAccount()
              }}
              placeholder="e.g. Tradovate Eval 50K"
              className="px-3 py-1.5 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
            <button
              onClick={handleCreateAccount}
              disabled={creatingAccount || !newAccountName.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
              style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            >
              <Plus size={14} />
              {creatingAccount ? 'Creating…' : 'Create'}
            </button>
          </div>

          {/* Fees */}
          {feesApply && (
            <div
              className="mb-4 rounded-xl p-4"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Fees per contract (round trip)
              </p>
              <p className="mt-0.5 mb-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Tradovate exports don&apos;t include fees. Enter what your broker or prop firm charges to open
                and close one contract. Saved fees can also be managed in Settings.
              </p>
              <div className="flex flex-wrap gap-4">
                {products.map((product) => (
                  <label key={product} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <span className="font-mono">{product}</span>
                    <span>$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={fees[product] ?? ''}
                      onChange={(e) => updateFee(product, e.target.value)}
                      placeholder="0.00"
                      className="w-24 px-2 py-1 rounded-lg text-sm font-mono outline-none"
                      style={{
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                  </label>
                ))}
              </div>
              <p className="mt-3 text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                Gross {formatPnl(Math.round(totals.gross * 100) / 100)} · Fees ${totals.fees.toFixed(2)} · Net{' '}
                <span style={{ color: totals.net >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                  {formatPnl(Math.round(totals.net * 100) / 100)}
                </span>
              </p>
            </div>
          )}

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
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        opacity: duplicateFlags[i] ? 0.4 : 1,
                      }}
                      title={duplicateFlags[i] ? 'Already imported, will be skipped' : undefined}
                    >
                      <td className="px-4 py-2 font-mono whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                        {t.symbol}
                        {duplicateFlags[i] && (
                          <span className="ml-2 text-[10px] uppercase" style={{ color: 'var(--color-text-muted)' }}>
                            duplicate
                          </span>
                        )}
                      </td>
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
              disabled={state === 'importing' || !accountId || !existingKeys || newTrades.length === 0}
              className="px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              style={{ background: 'var(--color-button)', color: '#fff' }}
            >
              {state === 'importing' ? 'Importing…' : newTrades.length === 0 ? 'Nothing new to import' : `Import ${newTrades.length} Trades`}
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
          {skippedCount > 0 && (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Skipped {skippedCount} {skippedCount === 1 ? 'trade' : 'trades'} already in this account
            </p>
          )}
          <div className="flex gap-3 mt-2">
            <a
              href="/trades"
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--color-button)', color: '#fff' }}
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
