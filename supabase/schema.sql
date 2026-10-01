-- EZTrader database schema
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  broker text,
  account_type text check (account_type in ('live', 'demo', 'prop')),
  starting_balance numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  symbol text not null,
  direction text not null check (direction in ('long', 'short')),
  entry_price numeric,
  exit_price numeric,
  quantity numeric,
  entry_time timestamptz,
  exit_time timestamptz,
  pnl numeric,
  commission numeric not null default 0,
  net_pnl numeric,
  setup_tag text,
  session_tag text,
  notes text,
  screenshot_url text,
  imported_from text,
  created_at timestamptz not null default now()
);

create index if not exists accounts_user_id_idx on public.accounts (user_id);
create index if not exists trades_user_exit_time_idx on public.trades (user_id, exit_time);
create index if not exists trades_account_id_idx on public.trades (account_id);

-- Row level security: each user can only see and change their own rows
alter table public.accounts enable row level security;
alter table public.trades enable row level security;

drop policy if exists "Users manage own accounts" on public.accounts;
create policy "Users manage own accounts" on public.accounts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users manage own trades" on public.trades;
create policy "Users manage own trades" on public.trades
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = auth.uid()
    )
  );

-- Make the new tables visible to the API immediately
notify pgrst, 'reload schema';
