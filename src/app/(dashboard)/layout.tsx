'use client'

import { useSyncExternalStore } from 'react'
import Sidebar from '@/components/layout/Sidebar'

const STORAGE_KEY = 'sidebar-collapsed'

// Tiny external store so the collapsed state persists across reloads (via
// localStorage) without a setState-in-effect or a hydration mismatch.
let listeners: (() => void)[] = []
const sidebarStore = {
  getSnapshot() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  },
  getServerSnapshot() {
    return false
  },
  subscribe(cb: () => void) {
    listeners.push(cb)
    return () => {
      listeners = listeners.filter((l) => l !== cb)
    }
  },
  toggle() {
    const next = !sidebarStore.getSnapshot()
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // ignore
    }
    listeners.forEach((l) => l())
  },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(
    sidebarStore.subscribe,
    sidebarStore.getSnapshot,
    sidebarStore.getServerSnapshot,
  )

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Sidebar collapsed={collapsed} onToggle={sidebarStore.toggle} />
      <main
        className={`flex-1 min-h-screen transition-[margin] duration-200 ${collapsed ? 'ml-16' : 'ml-56'}`}
      >
        {children}
      </main>
    </div>
  )
}
