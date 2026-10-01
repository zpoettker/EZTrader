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

// Dollar value of a 1.0 price move, keyed by Tradovate product code
const POINT_VALUES: Record<string, number> = {
  ES: 50, MES: 5, NQ: 20, MNQ: 2, YM: 5, MYM: 0.5, RTY: 50, M2K: 5,
  CL: 1000, MCL: 100, QM: 500, NG: 10000, QG: 2500,
  GC: 100, MGC: 10, SI: 5000, SIL: 1000, HG: 25000, MHG: 2500,
  ZB: 1000, ZN: 1000, ZF: 1000, ZT: 2000, UB: 1000,
  '6E': 125000, M6E: 12500, '6J': 12500000, '6B': 62500, '6A': 100000, '6C': 100000,
  BTC: 5, MBT: 0.1, ETH: 50, MET: 0.1,
}

// Strip the month/year code from a contract name, e.g. MNQU6 -> MNQ
export function productFromContract(contract: string): string {
  return contract.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '')
}

interface Fill {
  contract: string
  product: string
  side: 1 | -1
  qty: number
  price: number
  time: string
  orderId: string
}

interface OpenTrade {
  contract: string
  product: string
  direction: 'long' | 'short'
  position: number // signed open quantity
  lots: { qty: number; price: number }[] // FIFO entry lots
  entryQty: number
  entryNotional: number
  exitQty: number
  exitNotional: number
  points: number // realized price points x contracts
  entryTime: string
  exitTime: string
}

const round2 = (n: number) => Math.round(n * 100) / 100

// Pair individual fills into flat-to-flat round trips per contract. Scale-ins
// and partial exits stay in one trade; a reversal closes the trade and opens a
// new one with the remaining quantity.
function pairFills(fills: Fill[]): ParsedTrade[] {
  const sorted = [...fills].sort(
    (a, b) => a.time.localeCompare(b.time) || a.orderId.localeCompare(b.orderId)
  )
  const open = new Map<string, OpenTrade>()
  const trades: ParsedTrade[] = []

  function openTrade(f: Fill, qty: number): OpenTrade {
    return {
      contract: f.contract,
      product: f.product,
      direction: f.side === 1 ? 'long' : 'short',
      position: f.side * qty,
      lots: [{ qty, price: f.price }],
      entryQty: qty,
      entryNotional: qty * f.price,
      exitQty: 0,
      exitNotional: 0,
      points: 0,
      entryTime: f.time,
      exitTime: f.time,
    }
  }

  function closeTrade(t: OpenTrade) {
    const pointValue = POINT_VALUES[t.product]
    const pnl = pointValue != null ? round2(t.points * pointValue) : null
    trades.push({
      symbol: t.contract,
      direction: t.direction,
      entry_price: round2(t.entryNotional / t.entryQty),
      exit_price: round2(t.exitNotional / t.exitQty),
      quantity: t.entryQty,
      entry_time: parseDate(t.entryTime),
      exit_time: parseDate(t.exitTime),
      pnl,
      commission: 0,
      net_pnl: pnl,
      setup_tag: null,
      session_tag: null,
      notes: null,
      screenshot_url: null,
      imported_from: 'tradovate',
    })
  }

  for (const f of sorted) {
    const t = open.get(f.contract)

    if (!t) {
      open.set(f.contract, openTrade(f, f.qty))
      continue
    }

    const sameSide = Math.sign(t.position) === f.side
    if (sameSide) {
      t.position += f.side * f.qty
      t.lots.push({ qty: f.qty, price: f.price })
      t.entryQty += f.qty
      t.entryNotional += f.qty * f.price
      continue
    }

    // Closing fill: match against entry lots FIFO
    const dir = t.direction === 'long' ? 1 : -1
    let remaining = f.qty
    while (remaining > 0 && t.lots.length > 0) {
      const lot = t.lots[0]
      const q = Math.min(remaining, lot.qty)
      t.points += (f.price - lot.price) * q * dir
      t.exitQty += q
      t.exitNotional += q * f.price
      lot.qty -= q
      remaining -= q
      t.position -= dir * q
      if (lot.qty === 0) t.lots.shift()
    }
    t.exitTime = f.time

    if (t.lots.length === 0) {
      closeTrade(t)
      open.delete(f.contract)
      if (remaining > 0) open.set(f.contract, openTrade(f, remaining))
    }
  }

  // Positions still open at the end of the file are left out
  return trades
}

// Tradovate "Orders" export
// Columns: orderId, Account, Order ID, B/S, Contract, Product, ..., avgPrice,
//          filledQty, Fill Time, ..., Status, ...
function parseTradovateOrders(rows: string[][]): ParsedTrade[] {
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const col = (name: string) => header.indexOf(name)

  const idIdx = col('orderid')
  const sideIdx = col('b/s')
  const contractIdx = col('contract')
  const productIdx = col('product')
  const priceIdx = col('avgprice')
  const qtyIdx = col('filledqty')
  const timeIdx = col('fill time')
  const statusIdx = col('status')

  const fills: Fill[] = []
  for (const r of rows.slice(1)) {
    if (r[statusIdx]?.trim().toLowerCase() !== 'filled') continue
    const price = parseNum(r[priceIdx])
    const qty = parseNum(r[qtyIdx])
    const contract = r[contractIdx]?.trim()
    if (price == null || !qty || !contract || !r[timeIdx]) continue

    fills.push({
      contract,
      product: r[productIdx]?.trim() || productFromContract(contract),
      side: r[sideIdx]?.trim().toLowerCase() === 'buy' ? 1 : -1,
      qty,
      price,
      time: toSortableTime(r[timeIdx]),
      orderId: r[idIdx] ?? '',
    })
  }

  return pairFills(fills)
}

// Tradovate times look like "07/23/2026 08:56:33"; reorder so string sort is chronological
function toSortableTime(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return raw.trim()
  const [, mo, d, y, h, mi, sec = '00'] = m
  const p = (v: string) => v.padStart(2, '0')
  return `${y}-${p(mo)}-${p(d)}T${p(h)}:${mi}:${p(sec)}`
}

// Tradovate activity statement CSV (older export with one row per fill and realized P&L)
// Columns: id, orderId, contractName, tradeTime, action, qty, price, commission,
//          realized P&L, ...
function parseTradovateActivity(rows: string[][]): ParsedTrade[] {
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const idx = (name: string) => header.findIndex((h) => h.includes(name))

  const symbolIdx = idx('contractname')
  const timeIdx = idx('tradetime')
  const actionIdx = idx('action')
  const qtyIdx = idx('qty')
  const priceIdx = idx('price')
  const commIdx = idx('commission')
  const pnlIdx = idx('realized p')

  const fills = rows.slice(1).filter((r) => r[symbolIdx] && r[priceIdx])

  // Each row with realized P&L is treated as a closed trade
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

type BrokerFormat = 'ninjatrader' | 'tradovate-orders' | 'tradovate-activity' | 'unknown'

function detectFormat(header: string[]): BrokerFormat {
  const cols = header.map((s) => s.toLowerCase().trim())
  const h = cols.join(',')
  if (h.includes('market pos') || h.includes('entry price')) return 'ninjatrader'
  if (cols.includes('b/s') && cols.includes('fill time') && cols.includes('avgprice')) return 'tradovate-orders'
  if (h.includes('contractname') || h.includes('tradetime')) return 'tradovate-activity'
  return 'unknown'
}

export function detectBroker(header: string[]): 'ninjatrader' | 'tradovate' | 'unknown' {
  const format = detectFormat(header)
  return format.startsWith('tradovate') ? 'tradovate' : (format as 'ninjatrader' | 'unknown')
}

// Split CSV text into rows, honoring quoted fields that contain commas
function splitCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell.trim())
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  row.push(cell.trim())
  if (row.some((c) => c !== '')) rows.push(row)
  return rows
}

export function parseCSV(text: string): { broker: string; trades: ParsedTrade[] } {
  const rows = splitCSV(text.replace(/^\uFEFF/, ''))

  if (rows.length < 2) return { broker: 'unknown', trades: [] }

  const format = detectFormat(rows[0])
  let trades: ParsedTrade[] = []

  if (format === 'ninjatrader') trades = parseNinjaTrader(rows)
  else if (format === 'tradovate-orders') trades = parseTradovateOrders(rows)
  else if (format === 'tradovate-activity') trades = parseTradovateActivity(rows)

  return { broker: detectBroker(rows[0]), trades }
}
