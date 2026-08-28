import { createBrowserClient } from '@supabase/ssr'
import { isDemoMode } from '@/lib/demo'
import { createDemoClient } from '@/lib/demo/client'

export function createClient() {
  if (isDemoMode()) {
    return createDemoClient()
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
