export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // Always graphite, regardless of the saved theme: it matches the login background image.
    <div
      data-theme="graphite"
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
    >
      {children}
    </div>
  )
}
