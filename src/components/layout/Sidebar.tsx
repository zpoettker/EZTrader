'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, TableProperties, Upload, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trades', label: 'Trade Log', icon: TableProperties },
  { href: '/import', label: 'Import', icon: Upload },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className="flex flex-col w-56 h-screen fixed left-0 top-0 z-10"
      style={{
        background: 'var(--color-bg-secondary)',
        borderRight: '1px solid var(--color-border-subtle)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center h-14 px-5"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <span className="text-base font-bold tracking-wide" style={{ color: 'var(--color-text-primary)' }}>
          EZ<span style={{ color: 'var(--color-accent-blue)' }}>Trader</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: active ? 'var(--color-bg-hover)' : 'transparent',
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
