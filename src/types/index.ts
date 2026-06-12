export interface Account {
  id: string
  user_id: string
  name: string
  broker: string | null
  account_type: 'live' | 'demo' | 'prop' | null
  starting_balance: number | null
  created_at: string
}

export interface Trade {
  id: string
  user_id: string
  account_id: string
  symbol: string
  direction: 'long' | 'short'
  entry_price: number | null
  exit_price: number | null
  quantity: number | null
  entry_time: string | null
  exit_time: string | null
  pnl: number | null
  commission: number
  net_pnl: number | null
  setup_tag: string | null
  session_tag: string | null
  notes: string | null
  screenshot_url: string | null
  imported_from: string | null
  created_at: string
}

export interface DailySummary {
  id: string
  user_id: string
  account_id: string
  date: string
  total_trades: number
  wins: number
  losses: number
  gross_pnl: number
  net_pnl: number
}

export interface AnalyticsSummary {
  total_trades: number
  wins: number
  losses: number
  win_rate: number
  gross_pnl: number
  net_pnl: number
  profit_factor: number
  avg_win: number
  avg_loss: number
  expectancy: number
  max_drawdown: number
}

export interface TradeFilters {
  dateFrom?: string
  dateTo?: string
  symbol?: string
  direction?: 'long' | 'short' | ''
  accountId?: string
}
