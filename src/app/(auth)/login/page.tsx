'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isDemoCredentials, startDemoSession } from '@/lib/demo'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (isDemoCredentials(email, password)) {
      startDemoSession()
      router.push('/dashboard')
      router.refresh()
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  function handleDemo() {
    setLoading(true)
    startDemoSession()
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <>
      {/* The background image is always dark, so text outside the card uses fixed light colors rather than theme tokens. */}
      <div
        aria-hidden
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/background.png)' }}
      />
      <div
        aria-hidden
        className="fixed inset-0"
        style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.9) 100%)' }}
      />

      <div className="relative w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#f4f4f5' }}>
            EZTrader
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#d4d4d8' }}>
            Sign in to your trading journal
          </p>
        </div>

        <div
          className="rounded-xl p-6"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Email
              </label>
              <input
                id="email"
                type="text"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
                style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
                style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            {error && (
              <p className="text-xs" style={{ color: 'var(--color-loss)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              style={{
                background: 'var(--color-button)',
                color: '#fff',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <button
          type="button"
          onClick={handleDemo}
          disabled={loading}
          className="mt-4 w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 bg-white/10 hover:bg-white/20 backdrop-blur-sm"
          style={{
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#f4f4f5',
          }}
        >
          Explore the demo →
        </button>
        <p className="mt-1.5 text-center text-xs" style={{ color: '#a1a1aa' }}>
          No sign-up needed — loaded with sample trades
        </p>

        <p className="mt-6 text-center text-sm" style={{ color: '#a1a1aa' }}>
          No account?{' '}
          <Link href="/signup" style={{ color: '#60a5fa' }}>
            Sign up
          </Link>
        </p>
      </div>
    </>
  )
}
