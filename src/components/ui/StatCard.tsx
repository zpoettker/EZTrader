interface StatCardProps {
  label: string
  value: string
  subtext?: string
  positive?: boolean
  negative?: boolean
}

export default function StatCard({ label, value, subtext, positive, negative }: StatCardProps) {
  const valueColor = positive
    ? 'var(--color-profit)'
    : negative
    ? 'var(--color-loss)'
    : 'var(--color-text-primary)'

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p className="text-2xl font-bold font-mono" style={{ color: valueColor }}>
        {value}
      </p>
      {subtext && (
        <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {subtext}
        </p>
      )}
    </div>
  )
}
