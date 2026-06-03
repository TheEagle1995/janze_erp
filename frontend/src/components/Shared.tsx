// Shared utility components

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin text-gold">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
        fill="none" strokeDasharray="31.4" strokeDashoffset="15" strokeLinecap="round" />
    </svg>
  )
}

export function PageHeader({
  title, subtitle, action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-6 py-5 border-b border-border">
      <div>
        <h1 className="text-xl font-display font-bold text-fg">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function KpiCard({
  label, value, change, sub, icon: Icon, accent = 'bg-gold/10 text-gold',
}: {
  label: string
  value: string
  change?: number
  sub?: string
  icon?: React.ElementType
  accent?: string
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-mono font-bold text-fg mt-1">{value}</p>
          {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
        </div>
        {Icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
      {change !== undefined && (
        <div className={`text-xs mt-2 font-medium ${change >= 0 ? 'text-jade' : 'text-rose'}`}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% vs prev
        </div>
      )}
    </div>
  )
}

export function Badge({
  children, color = 'default',
}: {
  children: React.ReactNode
  color?: string
}) {
  const colors: Record<string, string> = {
    green:   'bg-jade/10 text-jade',
    jade:    'bg-jade/10 text-jade',
    red:     'bg-rose/10 text-rose',
    rose:    'bg-rose/10 text-rose',
    gold:    'bg-gold/10 text-gold',
    muted:   'bg-surface2 text-muted',
    default: 'bg-surface2 text-fg',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${colors[color] ?? colors.default}`}>
      {children}
    </span>
  )
}

export function EmptyState({ message = 'No data' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted">
      <div className="w-12 h-12 rounded-full bg-surface2 flex items-center justify-center mb-3">
        <span className="text-2xl">📭</span>
      </div>
      <p className="text-sm">{message}</p>
    </div>
  )
}

export function fmt(n: number | string, currency = 'UZS') {
  const num = Number(n ?? 0)
  return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency, maximumFractionDigits: 0 }).format(num)
}

export function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(d: string | Date) {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
