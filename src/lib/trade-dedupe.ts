import type { createClient } from '@/lib/supabase/client'

type Client = ReturnType<typeof createClient>

type TradeIdentity = {
  symbol: string
  direction: string
  entry_time: string | null
  exit_time: string | null
  quantity: number | null
  entry_price: number | null
  exit_price: number | null
}

const KEY_COLUMNS = 'symbol, direction, entry_time, exit_time, quantity, entry_price, exit_price'

// Identifies a trade by what happened in the market, not by fees, so changing
// a fee setting doesn't make an already-imported trade look new.
export function tradeKey(t: TradeIdentity): string {
  const time = (v: string | null) => (v ? String(new Date(v).getTime()) : '')
  const num = (v: number | null) => (v == null ? '' : String(Math.round(Number(v) * 10000) / 10000))
  return [
    t.symbol.trim().toUpperCase(),
    t.direction,
    time(t.entry_time),
    time(t.exit_time),
    num(t.quantity),
    num(t.entry_price),
    num(t.exit_price),
  ].join('|')
}

export async function fetchExistingKeys(supabase: Client, accountId: string): Promise<Set<string>> {
  const PAGE = 1000
  const keys = new Set<string>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('trades')
      .select(KEY_COLUMNS)
      .eq('account_id', accountId)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    for (const t of (data ?? []) as TradeIdentity[]) keys.add(tradeKey(t))
    if (!data || data.length < PAGE) break
  }
  return keys
}
