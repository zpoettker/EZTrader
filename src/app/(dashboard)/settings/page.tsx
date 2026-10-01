'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Eraser, Check, X, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { loadFees, saveFees, type FeeMap } from '@/lib/fees'
import { productFromContract } from '@/lib/csv-parsers'
import { THEMES, DEFAULT_THEME, currentTheme, setTheme, type Theme } from '@/lib/theme'
import type { Account, Trade } from '@/types'

type AccountRow = Account & { tradeCount: number }

type AccountForm = {
  name: string
  broker: string
  account_type: '' | 'live' | 'demo' | 'prop'
  starting_balance: string
}

const EMPTY_FORM: AccountForm = { name: '', broker: '', account_type: '', starting_balance: '' }

const COMMON_PRODUCTS = ['MNQ', 'NQ', 'MES', 'ES', 'MYM', 'YM', 'M2K', 'RTY', 'MGC', 'GC', 'MCL', 'CL']

const inputStyle = {
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
}

const cardStyle = {
  background: 'var(--color-bg-card)',
  border: '1px solid var(--color-border)',
}

function formatMoney(v: number | null) {
  if (v == null) return '—'
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function toPayload(form: AccountForm) {
  const balance = parseFloat(form.starting_balance)
  return {
    name: form.name.trim(),
    broker: form.broker.trim() || null,
    account_type: form.account_type || null,
    starting_balance: isNaN(balance) ? null : balance,
  }
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-6 mb-6" style={cardStyle}>
      <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        {title}
      </h2>
      <p className="mt-0.5 mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {description}
      </p>
      {children}
    </section>
  )
}

function AccountFields({ form, onChange }: { form: AccountForm; onChange: (form: AccountForm) => void }) {
  return (
    <>
      <input
        type="text"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        placeholder="Account name"
        className="px-3 py-1.5 rounded-lg text-sm outline-none w-48"
        style={inputStyle}
      />
      <input
        type="text"
        value={form.broker}
        onChange={(e) => onChange({ ...form, broker: e.target.value })}
        placeholder="Broker / firm"
        className="px-3 py-1.5 rounded-lg text-sm outline-none w-36"
        style={inputStyle}
      />
      <select
        value={form.account_type}
        onChange={(e) => onChange({ ...form, account_type: e.target.value as AccountForm['account_type'] })}
        className="px-3 py-1.5 rounded-lg text-sm outline-none"
        style={inputStyle}
      >
        <option value="">Type…</option>
        <option value="prop">Prop</option>
        <option value="live">Live</option>
        <option value="demo">Demo</option>
      </select>
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={form.starting_balance}
        onChange={(e) => onChange({ ...form, starting_balance: e.target.value })}
        placeholder="Starting balance"
        className="px-3 py-1.5 rounded-lg text-sm font-mono outline-none w-40"
        style={inputStyle}
      />
    </>
  )
}

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [newAccount, setNewAccount] = useState<AccountForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<AccountForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)

  const [fees, setFees] = useState<FeeMap>({})
  const [newProduct, setNewProduct] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function notify(msg: string) {
    setError('')
    setMessage(msg)
  }

  function fail(msg: string) {
    setMessage('')
    setError(msg)
  }

  const fetchAccounts = useCallback(async () => {
    const supabase = createClient()
    const { data, error: fetchError } = await supabase.from('accounts').select('*').order('name')
    if (fetchError) {
      fail(`Could not load accounts: ${fetchError.message}`)
      setLoadingAccounts(false)
      return
    }

    const rows = await Promise.all(
      ((data ?? []) as Account[]).map(async (a) => {
        const { count } = await supabase
          .from('trades')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', a.id)
        return { ...a, tradeCount: count ?? 0 }
      }),
    )
    setAccounts(rows)
    setLoadingAccounts(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load once on mount
    fetchAccounts()
    setFees(loadFees())
    setThemeState(currentTheme())
    const loadEmail = async () => {
      const { data: { user } } = await createClient().auth.getUser()
      setEmail(user?.email ?? '')
    }
    loadEmail()
  }, [fetchAccounts])

  function handleThemeChange(t: Theme) {
    setTheme(t)
    setThemeState(t)
  }

  // Accounts

  async function handleCreateAccount() {
    if (!newAccount.name.trim()) return
    setBusy(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      fail('Not authenticated.')
      setBusy(false)
      return
    }

    const { error: insertError } = await supabase
      .from('accounts')
      .insert({ ...toPayload(newAccount), user_id: user.id })
    if (insertError) {
      fail(`Could not create account: ${insertError.message}`)
    } else {
      notify(`Created "${newAccount.name.trim()}".`)
      setNewAccount(EMPTY_FORM)
      await fetchAccounts()
    }
    setBusy(false)
  }

  function startEdit(a: AccountRow) {
    setEditingId(a.id)
    setEditForm({
      name: a.name,
      broker: a.broker ?? '',
      account_type: a.account_type ?? '',
      starting_balance: a.starting_balance != null ? String(a.starting_balance) : '',
    })
  }

  async function handleSaveEdit() {
    if (!editingId || !editForm.name.trim()) return
    setBusy(true)
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('accounts')
      .update(toPayload(editForm))
      .eq('id', editingId)
    if (updateError) {
      fail(`Could not save account: ${updateError.message}`)
    } else {
      notify('Account saved.')
      setEditingId(null)
      await fetchAccounts()
    }
    setBusy(false)
  }

  async function handleClearTrades(a: AccountRow) {
    if (!confirm(`Delete all ${a.tradeCount} trades in "${a.name}"? The account stays, so you can re-import. This can't be undone.`)) return
    setBusy(true)
    const supabase = createClient()
    const { error: deleteError } = await supabase.from('trades').delete().eq('account_id', a.id)
    if (deleteError) {
      fail(`Could not delete trades: ${deleteError.message}`)
    } else {
      notify(`Deleted ${a.tradeCount} trades from "${a.name}".`)
      await fetchAccounts()
    }
    setBusy(false)
  }

  async function handleDeleteAccount(a: AccountRow) {
    const tradesNote = a.tradeCount > 0 ? ` and its ${a.tradeCount} trades` : ''
    if (!confirm(`Delete "${a.name}"${tradesNote}? This can't be undone.`)) return
    setBusy(true)
    const supabase = createClient()
    // The database cascades this, but deleting trades first also covers demo mode
    const { error: tradesError } = await supabase.from('trades').delete().eq('account_id', a.id)
    const { error: deleteError } = tradesError
      ? { error: tradesError }
      : await supabase.from('accounts').delete().eq('id', a.id)
    if (deleteError) {
      fail(`Could not delete account: ${deleteError.message}`)
    } else {
      notify(`Deleted "${a.name}".`)
      await fetchAccounts()
    }
    setBusy(false)
  }

  // Fees

  function updateFee(product: string, value: string) {
    const next = { ...fees, [product]: value }
    setFees(next)
    saveFees(next)
  }

  function removeFee(product: string) {
    const next = { ...fees }
    delete next[product]
    setFees(next)
    saveFees(next)
  }

  // Recompute commission and net P&L on trades already imported from Tradovate.
  // Other imports (e.g. NinjaTrader) carry their own commission and are left alone.
  async function handleApplyFees() {
    if (!confirm('Recalculate fees and net P&L on all imported Tradovate trades using the fees above?')) return
    setBusy(true)
    const supabase = createClient()

    const PAGE = 1000
    const all: Trade[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error: fetchError } = await supabase
        .from('trades')
        .select('*')
        .eq('imported_from', 'tradovate')
        .order('id')
        .range(from, from + PAGE - 1)
      if (fetchError) {
        fail(`Could not load trades: ${fetchError.message}`)
        setBusy(false)
        return
      }
      all.push(...((data ?? []) as Trade[]))
      if (!data || data.length < PAGE) break
    }

    const changed = all
      .map((t) => {
        const fee = parseFloat(fees[productFromContract(t.symbol)] ?? '') || 0
        const commission = Math.round(fee * (t.quantity ?? 0) * 100) / 100
        const net_pnl = t.pnl != null ? Math.round((t.pnl - commission) * 100) / 100 : null
        return { ...t, commission, net_pnl }
      })
      .filter((t, i) => t.commission !== all[i].commission || t.net_pnl !== all[i].net_pnl)

    for (let i = 0; i < changed.length; i += 500) {
      const { error: upsertError } = await supabase.from('trades').upsert(changed.slice(i, i + 500))
      if (upsertError) {
        fail(`Could not update trades: ${upsertError.message}`)
        setBusy(false)
        return
      }
    }

    notify(
      changed.length > 0
        ? `Updated fees on ${changed.length} of ${all.length} Tradovate trades.`
        : `All ${all.length} Tradovate trades already match these fees.`,
    )
    setBusy(false)
  }

  function addProduct(product: string) {
    const code = product.trim().toUpperCase()
    if (!code || code in fees) return
    updateFee(code, '')
    setNewProduct('')
  }

  // Profile

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      fail('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      fail('Passwords do not match.')
      return
    }
    setBusy(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      fail(updateError.message)
    } else {
      notify('Password updated.')
      setPassword('')
      setConfirmPassword('')
    }
    setBusy(false)
  }

  const feeProducts = Object.keys(fees).sort()
  const suggestedProducts = COMMON_PRODUCTS.filter((p) => !(p in fees))

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Manage your trading accounts, fees, and profile
        </p>
      </div>

      {(error || message) && (
        <div
          className="mb-6 flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
          style={
            error
              ? { background: 'var(--color-loss-muted)', color: 'var(--color-loss)' }
              : { background: 'var(--color-profit-muted)', color: 'var(--color-profit)' }
          }
        >
          {error ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {error || message}
        </div>
      )}

      <Section
        title="Trading accounts"
        description="Each import goes into one account. Clearing an account's trades lets you re-import with corrected fees."
      >
        {loadingAccounts ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>No accounts yet. Add one below.</p>
        ) : (
          <div className="rounded-lg overflow-hidden mb-4" style={{ border: '1px solid var(--color-border)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                    {['Name', 'Broker', 'Type', 'Starting balance', 'Trades', ''].map((col) => (
                      <th
                        key={col}
                        className="px-4 py-2.5 text-left text-xs font-medium whitespace-nowrap"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) =>
                    editingId === a.id ? (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <AccountFields form={editForm} onChange={setEditForm} />
                            <button
                              onClick={handleSaveEdit}
                              disabled={busy || !editForm.name.trim()}
                              className="p-2 rounded-lg disabled:opacity-50"
                              style={{ color: 'var(--color-profit)' }}
                              title="Save"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-2 rounded-lg"
                              style={{ color: 'var(--color-text-muted)' }}
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td className="px-4 py-2.5" style={{ color: 'var(--color-text-primary)' }}>{a.name}</td>
                        <td className="px-4 py-2.5 capitalize" style={{ color: 'var(--color-text-secondary)' }}>{a.broker ?? '—'}</td>
                        <td className="px-4 py-2.5 capitalize" style={{ color: 'var(--color-text-secondary)' }}>{a.account_type ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--color-text-secondary)' }}>{formatMoney(a.starting_balance)}</td>
                        <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--color-text-secondary)' }}>{a.tradeCount}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => startEdit(a)}
                              disabled={busy}
                              className="p-1.5 rounded-lg"
                              style={{ color: 'var(--color-text-muted)' }}
                              title="Edit"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => handleClearTrades(a)}
                              disabled={busy || a.tradeCount === 0}
                              className="p-1.5 rounded-lg disabled:opacity-30"
                              style={{ color: 'var(--color-text-muted)' }}
                              title="Clear trades"
                            >
                              <Eraser size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(a)}
                              disabled={busy}
                              className="p-1.5 rounded-lg"
                              style={{ color: 'var(--color-loss)' }}
                              title="Delete account"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <AccountFields form={newAccount} onChange={setNewAccount} />
          <button
            onClick={handleCreateAccount}
            disabled={busy || !newAccount.name.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--color-button)', color: '#fff' }}
          >
            <Plus size={14} />
            Add account
          </button>
        </div>
      </Section>

      <Section
        title="Fees per contract"
        description="Round-trip cost to open and close one contract, including commission and exchange fees. Tradovate files don't include fees, so these are applied when you import. Changes save automatically in this browser."
      >
        {feeProducts.length > 0 && (
          <div className="flex flex-wrap gap-x-6 gap-y-3 mb-4">
            {feeProducts.map((product) => (
              <div key={product} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="font-mono w-10" style={{ color: 'var(--color-text-primary)' }}>{product}</span>
                <span>$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={fees[product]}
                  onChange={(e) => updateFee(product, e.target.value)}
                  placeholder="0.00"
                  aria-label={`${product} round-trip fee`}
                  className="w-24 px-2 py-1 rounded-lg text-sm font-mono outline-none"
                  style={inputStyle}
                />
                <button
                  onClick={() => removeFee(product)}
                  className="p-1 rounded"
                  style={{ color: 'var(--color-text-muted)' }}
                  title={`Remove ${product}`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newProduct}
            onChange={(e) => setNewProduct(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addProduct(newProduct)
            }}
            placeholder="Product, e.g. MNQ"
            className="px-3 py-1.5 rounded-lg text-sm font-mono outline-none w-40"
            style={inputStyle}
          />
          <button
            onClick={() => addProduct(newProduct)}
            disabled={!newProduct.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
            style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
          >
            <Plus size={14} />
            Add product
          </button>
          {suggestedProducts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 ml-2">
              {suggestedProducts.map((p) => (
                <button
                  key={p}
                  onClick={() => addProduct(p)}
                  className="px-2 py-0.5 rounded text-xs font-mono"
                  style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' }}
                >
                  + {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          className="mt-5 pt-4 flex flex-wrap items-center gap-3"
          style={{ borderTop: '1px solid var(--color-border-subtle)' }}
        >
          <button
            onClick={handleApplyFees}
            disabled={busy}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--color-button)', color: '#fff' }}
          >
            <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
            Apply to existing trades
          </button>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Updates trades you&apos;ve already imported from Tradovate. New imports use these fees automatically.
          </span>
        </div>
      </Section>

      <Section title="Profile" description="Your sign-in details.">
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          Signed in as <span style={{ color: 'var(--color-text-primary)' }}>{email || '—'}</span>
        </p>
        <form onSubmit={handleChangePassword} className="flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            className="px-3 py-1.5 rounded-lg text-sm outline-none w-48"
            style={inputStyle}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            className="px-3 py-1.5 rounded-lg text-sm outline-none w-48"
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={busy || !password}
            className="px-4 py-1.5 rounded-lg text-sm disabled:opacity-50"
            style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
          >
            Change password
          </button>
        </form>
      </Section>

      <Section title="Appearance" description="Color theme for the app. Saved in this browser.">
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Color theme">
          {THEMES.map((t) => {
            const selected = theme === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => handleThemeChange(t.id)}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-left w-64"
                style={{
                  background: 'var(--color-bg-secondary)',
                  border: `1px solid ${selected ? 'var(--color-logo-accent)' : 'var(--color-border)'}`,
                }}
              >
                <span className="flex shrink-0 overflow-hidden rounded-md" style={{ border: '1px solid var(--color-border)' }}>
                  {t.swatch.map((c) => (
                    <span key={c} className="h-8 w-4" style={{ background: c }} />
                  ))}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {t.label}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {t.description}
                  </span>
                </span>
                {selected && <Check size={16} style={{ color: 'var(--color-logo-accent)' }} />}
              </button>
            )
          })}
        </div>
      </Section>
    </div>
  )
}
