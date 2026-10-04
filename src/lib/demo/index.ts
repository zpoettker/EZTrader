// Demo mode: run the app against a local in-memory fixture instead of Supabase.
// Enabled when NEXT_PUBLIC_DEMO_MODE === 'true', automatically when no Supabase
// URL is configured (so a fresh clone doesn't crash on a missing env), or per
// browser session after signing in with demo / demo (sets DEMO_COOKIE).
export const DEMO_COOKIE = 'eztrader-demo'

export function isDemoMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return true
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (!url.startsWith('http')) return true
  return hasDemoCookie()
}

function hasDemoCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split('; ').includes(`${DEMO_COOKIE}=1`)
}

export function isDemoCredentials(email: string, password: string): boolean {
  return email.trim().toLowerCase() === 'demo' && password === 'demo'
}

// Session cookie (no Max-Age), so the demo ends when the browser closes.
export function startDemoSession() {
  document.cookie = `${DEMO_COOKIE}=1; path=/; SameSite=Lax`
}

export function endDemoSession() {
  document.cookie = `${DEMO_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`
}

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'
export const DEMO_USER_EMAIL = 'demo@eztrader.local'
