import type { Trade } from '@/types'

export type ParsedTrade = Omit<Trade, 'id' | 'user_id' | 'account_id' | 'created_at'>

function parseDate(raw: string): string | null {
  if (!raw) return null
  const d = new Date(raw.trim())
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function parseNum(raw: string | undefined): number | null {
  if (!raw) return null
  const n = parseFloat(raw.replace(/[$,\s]/g, ''))
  return isNaN(n) ? null : n
}

// NinjaTrader execution report CSV
// Columns: Instrument, Account, Strategy, Market pos., Qty, Entry price, Exit price,
//          Entry time, Exit time, Profit, Cum. profit, Commission, MAE, MFE, ETD
function parseNinjaTrader(rows: string[][]): ParsedTrade[] {
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const idx = (name: string) => header.findIndex((h) => h.includes(name))

  const symbolIdx = idx('instrument')
  const dirIdx = idx('market pos')
  const qtyIdx = idx('qty')
  const entryPriceIdx = idx('entry price')
  const exitPriceIdx = idx('exit price')
  const entryTimeIdx = idx('entry time')
  const exitTimeIdx = idx('exit time')
  const profitIdx = idx('profit')
  const commIdx = idx('commission')

  return rows.slice(1).filter((r) => r[symbolIdx]).map((r) => {
    const gross = parseNum(r[profitIdx])
    const commission = parseNum(r[commIdx]) ?? 0
    const net_pnl = gross != null ? gross - commission : null

    return {
      symbol: r[symbolIdx]?.trim() ?? '',
      direction: r[dirIdx]?.trim().toLowerCase().startsWith('long') ? 'long' : 'short',
      entry_price: parseNum(r[entryPriceIdx]),
      exit_price: parseNum(r[exitPriceIdx]),
      quantity: parseNum(r[qtyIdx]),
      entry_time: parseDate(r[entryTimeIdx]),
      exit_time: parseDate(r[exitTimeIdx]),
      pnl: gross,
      commission,
      net_pnl,
      setup_tag: null,
      session_tag: null,
      notes: null,
      screenshot_url: null,
      imported_from: 'csv',
    }
  })
}

// Tradovate activity statement CSV
// Columns: id, orderId, contractName, tradeTime, action, qty, price, commission,
//          realized P&L, ...
function parseTradovate(rows: string[][]): ParsedTrade[] {
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const idx = (name: string) => header.findIndex((h) => h.includes(name))

  const symbolIdx = idx('contractname')
  const timeIdx = idx('tradetime')
  const actionIdx = idx('action')
  const qtyIdx = idx('qty')
  const priceIdx = idx('price')
  const commIdx = idx('commission')
  const pnlIdx = idx('realized p')

  // Tradovate exports individual fills; we group by pairing buys/sells
  const fills = rows.slice(1).filter((r) => r[symbolIdx] && r[priceIdx])

  // Simple pairing: treat each row as a closed trade if it has realized P&L
  return fills
    .filter((r) => parseNum(r[pnlIdx]) != null)
    .map((r) => {
      const action = r[actionIdx]?.trim().toLowerCase() ?? ''
      const gross = parseNum(r[pnlIdx])
      const commission = parseNum(r[commIdx]) ?? 0
      const net_pnl = gross != null ? gross - commission : null

      return {
        symbol: r[symbolIdx]?.trim() ?? '',
        direction: action === 'buy' ? 'long' : 'short',
        entry_price: null,
        exit_price: parseNum(r[priceIdx]),
        quantity: parseNum(r[qtyIdx]),
        entry_time: null,
        exit_time: parseDate(r[timeIdx]),
        pnl: gross,
        commission,
        net_pnl,
        setup_tag: null,
        session_tag: null,
        notes: null,
        screenshot_url: null,
        imported_from: 'csv',
      }
    })
}

export function detectBroker(header: string[]): 'ninjatrader' | 'tradovate' | 'unknown' {
  const h = header.map((s) => s.toLowerCase().trim()).join(',')
  if (h.includes('market pos') || h.includes('entry price')) return 'ninjatrader'
  if (h.includes('contractname') || h.includes('tradetime')) return 'tradovate'
  return 'unknown'
}

export function parseCSV(text: string): { broker: string; trades: ParsedTrade[] } {
  const lines = text.trim().split('\n')
  const rows = lines.map((line) =>
    line.split(',').map((cell) => cell.replace(/^"|"$/g, '').trim())
  )

  if (rows.length < 2) return { broker: 'unknown', trades: [] }

  const broker = detectBroker(rows[0])
  let trades: ParsedTrade[] = []

  if (broker === 'ninjatrader') trades = parseNinjaTrader(rows)
  else if (broker === 'tradovate') trades = parseTradovate(rows)

  return { broker, trades }
}
