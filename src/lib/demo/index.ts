// Demo mode: run the app against a local in-memory fixture instead of Supabase.
// Enabled when NEXT_PUBLIC_DEMO_MODE === 'true', or automatically when no
// Supabase URL is configured (so a fresh clone doesn't crash on a missing env).
export function isDemoMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return true
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return !url.startsWith('http')
}

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'
export const DEMO_USER_EMAIL = 'demo@eztrader.local'
