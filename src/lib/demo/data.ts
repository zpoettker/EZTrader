import type { Account, Trade } from '@/types'
import { DEMO_USER_ID } from './index'

// Deterministic PRNG so the fixture is stable across reloads.
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(42)
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]
const between = (min: number, max: number) => min + rand() * (max - min)

// Futures contracts: [symbol, tick size, $ per point, typical price]
const CONTRACTS: [string, number, number, number][] = [
  ['MNQ', 0.25, 2, 20500],
  ['MES', 0.25, 5, 5600],
  ['NQ', 0.25, 20, 20500],
  ['ES', 0.25, 50, 5600],
  ['MGC', 0.1, 10, 2400],
]

const SETUPS = ['Breakout', 'Reversal', 'Trend Pullback', 'Range Fade', 'VWAP Bounce', 'Opening Drive']
const SESSIONS = ['London', 'NY AM', 'NY PM']

export const DEMO_ACCOUNTS: Account[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    user_id: DEMO_USER_ID,
    name: 'Topstep 50K',
    broker: 'Tradovate',
    account_type: 'prop',
    starting_balance: 50000,
    created_at: '2025-05-01T00:00:00.000Z',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    user_id: DEMO_USER_ID,
    name: 'Personal Live',
    broker: 'NinjaTrader',
    account_type: 'live',
    starting_balance: 15000,
    created_at: '2025-05-01T00:00:00.000Z',
  },
]

function makeTrade(i: number, daysAgo: number): Trade {
  const [symbol, tick, perPoint, basePrice] = pick(CONTRACTS)
  const direction: Trade['direction'] = rand() > 0.5 ? 'long' : 'short'
  const quantity = pick([1, 1, 1, 2, 2, 3])

  // Slight positive edge: ~54% winners, winners a bit bigger than losers.
  const isWin = rand() < 0.54
  const pointsMoved = isWin ? between(4, 40) : -between(3, 26)
  const dirMult = direction === 'long' ? 1 : -1

  const entry_price = Math.round((basePrice + between(-basePrice * 0.01, basePrice * 0.01)) / tick) * tick
  const exit_price = Math.round((entry_price + pointsMoved * dirMult) / tick) * tick

  const pnl = Math.round(pointsMoved * perPoint * quantity * 100) / 100
  const commission = Math.round(quantity * 2 * 1.24 * 100) / 100 // round-trip
  const net_pnl = Math.round((pnl - commission) * 100) / 100

  const entry = new Date()
  entry.setDate(entry.getDate() - daysAgo)
  entry.setHours(9 + Math.floor(rand() * 6), Math.floor(rand() * 60), 0, 0)
  const exit = new Date(entry.getTime() + between(2, 90) * 60_000)

  return {
    id: `20000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    user_id: DEMO_USER_ID,
    account_id: DEMO_ACCOUNTS[rand() > 0.35 ? 0 : 1].id,
    symbol,
    direction,
    entry_price,
    exit_price,
    quantity,
    entry_time: entry.toISOString(),
    exit_time: exit.toISOString(),
    pnl,
    commission,
    net_pnl,
    setup_tag: pick(SETUPS),
    session_tag: pick(SESSIONS),
    notes: null,
    screenshot_url: null,
    imported_from: 'demo',
    created_at: entry.toISOString(),
  }
}

export function generateDemoTrades(): Trade[] {
  const trades: Trade[] = []
  let i = 0
  // ~90 days of history, 0-4 trades per day, skip weekends.
  for (let daysAgo = 90; daysAgo >= 0; daysAgo--) {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    const dow = d.getDay()
    if (dow === 0 || dow === 6) continue
    const count = Math.floor(rand() * 5)
    for (let n = 0; n < count; n++) trades.push(makeTrade(i++, daysAgo))
  }
  return trades
}
