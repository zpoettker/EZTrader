# EZTrader

A futures trading journal that shows how you actually performed over any trading period. Import your trades from NinjaTrader or Tradovate, pick a date range, and get your core stats, equity curve, and a P&L calendar in one view.

**Live app:** [eztrader-tau.vercel.app](https://eztrader-tau.vercel.app). Sign-in is required. To try it without an account, run it locally in [demo mode](#demo-mode).

---

## Screenshots

### Dashboard
![Dashboard](public/Dashboard.png)

### Calendar Widget
![Trade Log](public/calendar-widget.png)

### Trade Log
![Trade Log](public/trade-log.png)


---

## Features

- **Stats by trading period.** Switch between 7D, 30D, 90D, all time, or a custom date range. Clicking a month on the calendar focuses every stat on that month.
- **Core performance metrics.** Net P&L, win rate, average reward-to-risk, profit factor, average win and loss, expectancy, and max drawdown.
- **Equity curve.** Cumulative P&L over the selected range.
- **Monthly P&L calendar.** See your green and red days at a glance.
- **Trade log.** Filter by date, symbol, and direction.
- **CSV import.** Upload a **NinjaTrader** execution report or a **Tradovate** Orders export. The broker is detected from the file's headers. Tradovate fills are paired into round-trip trades, including scale-ins, partial exits, and reversals.
- **Fees per contract.** Tradovate exports don't include fees, so you set a round-trip fee per product (MNQ, NQ, ES, and so on). Fees are applied on import and can be re-applied to trades you've already imported.
- **Duplicate detection.** Importing a file that overlaps earlier imports adds only the new trades to the account and skips the rest.
- **Settings.** Manage trading accounts, fees, and your password. Clear an account's trades to re-import them.
- **Accounts and auth.** Supabase handles email sign-in, and row-level security limits each user to their own data.
- **Demo mode.** Runs on built-in sample data with no database, so anyone can try it instantly.

## Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Charts | Recharts |
| Auth and database | Supabase (Postgres) |
| Analytics service | Python, FastAPI, Pydantic |
| Hosting | Vercel |

## Architecture

```
Browser ──> Next.js (Vercel)
               ├── Supabase ............ auth, accounts, trades
               └── /api/analytics ──> FastAPI service (python-api/)
                        │
                        └── falls back to a TypeScript implementation
                            if the Python service is unavailable
```

The dashboard sends the trades in the selected range to `/api/analytics`, which forwards them to the FastAPI `/analytics/summary` endpoint. If that service can't be reached, the same stats are computed in TypeScript, so the app works with or without the Python backend.

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11+ (optional, for the analytics service)
- A Supabase project (optional, since [demo mode](#demo-mode) runs without one)

### 1. Clone and install
```bash
git clone https://github.com/zpoettker/eztrader.git
cd eztrader
npm install
```

### 2. Configure environment variables
Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional
PYTHON_API_URL=http://localhost:8000
NEXT_PUBLIC_DEMO_MODE=false
```

Both values are under Project Settings → API in Supabase. The anon key is meant to be public; row-level security protects the data. Never use the `service_role` key here.

### 3. Create the database tables
In the Supabase dashboard, open **SQL Editor**, paste in [`supabase/schema.sql`](supabase/schema.sql), and run it. It creates the `accounts` and `trades` tables with row-level security, and it's safe to run again.

Then under **Authentication → URL Configuration**, add `http://localhost:3000/**` to the redirect URLs so sign-up confirmation emails work locally.

### 4. Run the app
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### 5. (Optional) Run the analytics service
```bash
cd python-api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Demo mode
If `NEXT_PUBLIC_SUPABASE_URL` isn't set, or `NEXT_PUBLIC_DEMO_MODE=true`, the app runs on built-in sample data with no sign-in. Changes last until the page is reloaded.

## Deployment

- **Frontend:** Import the repo into Vercel and add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under Settings → Environment Variables. Leave out `NEXT_PUBLIC_DEMO_MODE`, or the deployment will run in demo mode. `NEXT_PUBLIC_` values are built into the app, so redeploy after changing them. Pushes to `main` redeploy automatically.
- **Supabase:** Under Authentication → URL Configuration, set the Site URL to your Vercel domain and add `https://<your-domain>/**` to the redirect URLs so confirmation emails link to the right place.
- **Analytics service (optional):** Deploy `python-api/` to Render or Railway with the start command `uvicorn main:app --host 0.0.0.0 --port $PORT`, then set `PYTHON_API_URL` in Vercel.

## Roadmap

- [ ] Stats by trading session (Asia / London / New York)
- [ ] Setup tag analytics
- [ ] Trade screenshots and notes
- [ ] More broker imports

## Author

**Zachary Poettker**. [GitHub](https://github.com/zpoettker)
