import { NextRequest, NextResponse } from 'next/server'
import type { Trade } from '@/types'

export async function POST(request: NextRequest) {
  const trades: Trade[] = await request.json()
  const pythonUrl = process.env.PYTHON_API_URL ?? 'http://localhost:8000'

  try {
    const res = await fetch(`${pythonUrl}/analytics/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trades),
    })

    if (!res.ok) {
      throw new Error(`Python API error: ${res.status}`)
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    // Fallback: compute locally if Python service is unavailable
    return NextResponse.json(computeSummaryLocally(trades))
  }
}

function computeSummaryLocally(trades: Trade[]) {
  const closed = trades.filter((t) => t.net_pnl != null)
  const wins = closed.filter((t) => (t.net_pnl ?? 0) > 0)
  const losses = closed.filter((t) => (t.net_pnl ?? 0) <= 0)

  const gross_pnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const net_pnl = closed.reduce((s, t) => s + (t.net_pnl ?? 0), 0)
  const avg_win = wins.length ? wins.reduce((s, t) => s + (t.net_pnl ?? 0), 0) / wins.length : 0
  const avg_loss = losses.length ? losses.reduce((s, t) => s + (t.net_pnl ?? 0), 0) / losses.length : 0

  const totalWins = wins.reduce((s, t) => s + (t.net_pnl ?? 0), 0)
  const totalLosses = Math.abs(losses.reduce((s, t) => s + (t.net_pnl ?? 0), 0))
  const profit_factor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0

  // Max drawdown from cumulative P&L
  let peak = 0
  let cum = 0
  let max_drawdown = 0
  for (const t of closed) {
    cum += t.net_pnl ?? 0
    if (cum > peak) peak = cum
    const dd = peak - cum
    if (dd > max_drawdown) max_drawdown = dd
  }

  const win_rate = closed.length > 0 ? wins.length / closed.length : 0
  const expectancy = win_rate * avg_win + (1 - win_rate) * avg_loss

  return {
    total_trades: closed.length,
    wins: wins.length,
    losses: losses.length,
    win_rate,
    gross_pnl,
    net_pnl,
    profit_factor,
    avg_win,
    avg_loss,
    expectancy,
    max_drawdown,
  }
}
