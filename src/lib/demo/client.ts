import type { Trade } from '@/types'
import { DEMO_USER_ID, DEMO_USER_EMAIL } from './index'
import { generateDemoTrades, DEMO_ACCOUNTS } from './data'

type Row = Record<string, unknown>

// In-memory tables. Mutations (import) last until the page is reloaded.
const tables: Record<string, Row[]> = {
  trades: generateDemoTrades() as unknown as Row[],
  accounts: DEMO_ACCOUNTS as unknown as Row[],
}

type Result = { data: Row[] | null; count: number | null; error: null }

/**
 * Minimal stand-in for the Supabase PostgREST query builder — just the operators
 * the app actually uses. It's a thenable, so `await supabase.from(...).select(...)`
 * resolves like the real client.
 */
class QueryBuilder implements PromiseLike<Result> {
  private filters: ((r: Row) => boolean)[] = []
  private orderBy: { col: string; asc: boolean }[] = []
  private rangeBounds: [number, number] | null = null
  private wantCount = false
  private mutation: { kind: 'update'; values: Row } | { kind: 'delete' } | null = null

  constructor(private rows: Row[]) {}

  select(_cols?: string, opts?: { count?: 'exact' | 'planned' | 'estimated' }) {
    if (opts?.count) this.wantCount = true
    return this
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy.push({ col, asc: opts?.ascending ?? true })
    return this
  }

  range(from: number, to: number) {
    this.rangeBounds = [from, to]
    return this
  }

  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val)
    return this
  }

  gte(col: string, val: unknown) {
    this.filters.push((r) => String(r[col] ?? '') >= String(val))
    return this
  }

  gt(col: string, val: unknown) {
    this.filters.push((r) => String(r[col] ?? '') > String(val))
    return this
  }

  lte(col: string, val: unknown) {
    this.filters.push((r) => String(r[col] ?? '') <= String(val))
    return this
  }

  lt(col: string, val: unknown) {
    this.filters.push((r) => String(r[col] ?? '') < String(val))
    return this
  }

  ilike(col: string, pattern: string) {
    const rx = new RegExp(
      '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$',
      'i',
    )
    this.filters.push((r) => rx.test(String(r[col] ?? '')))
    return this
  }

  async insert(rows: Row | Row[]) {
    const toAdd = (Array.isArray(rows) ? rows : [rows]).map((r, i) => ({
      id: `20000000-0000-4000-8000-${String(Date.now() + i).slice(-12)}`,
      created_at: new Date().toISOString(),
      ...r,
    }))
    this.rows.push(...toAdd)
    return { data: toAdd, error: null }
  }

  async upsert(rows: Row | Row[]) {
    const list = Array.isArray(rows) ? rows : [rows]
    for (const r of list) {
      const existing = this.rows.find((x) => x.id === r.id)
      if (existing) Object.assign(existing, r)
      else this.rows.push(r)
    }
    return { data: list, error: null }
  }

  update(values: Row) {
    this.mutation = { kind: 'update', values }
    return this
  }

  delete() {
    this.mutation = { kind: 'delete' }
    return this
  }

  private run(): Result {
    if (this.mutation) {
      const matched = this.rows.filter((r) => this.filters.every((f) => f(r)))
      if (this.mutation.kind === 'update') {
        for (const r of matched) Object.assign(r, this.mutation.values)
      } else {
        for (const r of matched) this.rows.splice(this.rows.indexOf(r), 1)
      }
      return { data: matched, count: null, error: null }
    }

    let out = this.rows.filter((r) => this.filters.every((f) => f(r)))
    for (const { col, asc } of [...this.orderBy].reverse()) {
      out = [...out].sort((a, b) => {
        const av = a[col] as string | number
        const bv = b[col] as string | number
        if (av === bv) return 0
        return (av < bv ? -1 : 1) * (asc ? 1 : -1)
      })
    }
    const count = this.wantCount ? out.length : null
    if (this.rangeBounds) out = out.slice(this.rangeBounds[0], this.rangeBounds[1] + 1)
    return { data: out, count, error: null }
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected)
  }
}

const authError = (message: string) => ({
  data: { user: null, session: null },
  error: { message, name: 'AuthApiError', status: 400 },
})

export function createDemoClient() {
  const demoUser = {
    id: DEMO_USER_ID,
    email: DEMO_USER_EMAIL,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2025-05-01T00:00:00.000Z',
  }

  const client = {
    from(table: string) {
      return new QueryBuilder(tables[table] ?? [])
    },
    auth: {
      async getUser() {
        return { data: { user: demoUser }, error: null }
      },
      async getSession() {
        return { data: { session: { user: demoUser } }, error: null }
      },
      async signInWithPassword() {
        return authError('Demo mode — authentication is disabled. You are always signed in as the demo user.')
      },
      async signUp() {
        return authError('Demo mode — sign-up is disabled.')
      },
      async updateUser() {
        return authError('Demo mode — account changes are disabled.')
      },
      async signOut() {
        return { error: null }
      },
      onAuthStateChange() {
        return { data: { subscription: { id: 'demo', callback: () => {}, unsubscribe: () => {} } } }
      },
    },
  }

  return client as unknown as ReturnType<typeof import('@supabase/ssr').createBrowserClient>
}

export type { Trade }
