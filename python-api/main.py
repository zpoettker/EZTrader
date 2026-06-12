from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import math

app = FastAPI(title="EZTrader Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class Trade(BaseModel):
    id: Optional[str] = None
    user_id: Optional[str] = None
    account_id: Optional[str] = None
    symbol: str
    direction: str
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    quantity: Optional[float] = None
    entry_time: Optional[str] = None
    exit_time: Optional[str] = None
    pnl: Optional[float] = None
    commission: float = 0
    net_pnl: Optional[float] = None
    setup_tag: Optional[str] = None
    session_tag: Optional[str] = None
    notes: Optional[str] = None
    screenshot_url: Optional[str] = None
    imported_from: Optional[str] = None
    created_at: Optional[str] = None


class AnalyticsSummary(BaseModel):
    total_trades: int
    wins: int
    losses: int
    win_rate: float
    gross_pnl: float
    net_pnl: float
    profit_factor: float
    avg_win: float
    avg_loss: float
    expectancy: float
    max_drawdown: float


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analytics/summary", response_model=AnalyticsSummary)
def analytics_summary(trades: list[Trade]) -> AnalyticsSummary:
    closed = [t for t in trades if t.net_pnl is not None]

    wins = [t for t in closed if (t.net_pnl or 0) > 0]
    losses = [t for t in closed if (t.net_pnl or 0) <= 0]

    gross_pnl = sum(t.pnl or 0 for t in closed)
    net_pnl = sum(t.net_pnl or 0 for t in closed)

    total_win_amount = sum(t.net_pnl or 0 for t in wins)
    total_loss_amount = abs(sum(t.net_pnl or 0 for t in losses))

    avg_win = total_win_amount / len(wins) if wins else 0.0
    avg_loss = sum(t.net_pnl or 0 for t in losses) / len(losses) if losses else 0.0

    profit_factor = (
        total_win_amount / total_loss_amount
        if total_loss_amount > 0
        else (math.inf if total_win_amount > 0 else 0.0)
    )
    if math.isinf(profit_factor):
        profit_factor = 999.0

    win_rate = len(wins) / len(closed) if closed else 0.0
    expectancy = win_rate * avg_win + (1 - win_rate) * avg_loss

    # Max drawdown from equity curve
    peak = 0.0
    cum = 0.0
    max_drawdown = 0.0
    for t in closed:
        cum += t.net_pnl or 0
        if cum > peak:
            peak = cum
        dd = peak - cum
        if dd > max_drawdown:
            max_drawdown = dd

    return AnalyticsSummary(
        total_trades=len(closed),
        wins=len(wins),
        losses=len(losses),
        win_rate=round(win_rate, 4),
        gross_pnl=round(gross_pnl, 2),
        net_pnl=round(net_pnl, 2),
        profit_factor=round(profit_factor, 4),
        avg_win=round(avg_win, 2),
        avg_loss=round(avg_loss, 2),
        expectancy=round(expectancy, 2),
        max_drawdown=round(max_drawdown, 2),
    )
