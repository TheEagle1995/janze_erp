/**
 * Shared UI components used across pages.
 * PageHeader, Badge, EmptyState, fmt, fmtDate
 */
import dayjs from 'dayjs'

// ── fmt: simple currency formatter (used as fmt(number) in pages) ──────────
export const fmt = (n: number | string | null | undefined, currency = 'UZS') => {
  const num = Number(n ?? 0)
  if (currency === 'UZS') return new Intl.NumberFormat('uz-UZ').format(Math.round(num)) + ' UZS'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num)
}

// ── fmtDate: date formatter ────────────────────────────────────────────────
export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '—'
  return dayjs(d).format('DD MMM YYYY')
}

// ── Badge ──────────────────────────────────────────────────────────────────
type BadgeColor = 'green' | 'red' | 'gold' | 'muted' | 'blue' | 'rose' | 'jade'

const BADGE_STYLES: Record<BadgeColor, string> = {
  green: 'bg-jade/10 text-jade border-jade/20',
  red:   'bg-rose/10 text-rose border-rose/20',
  rose:  'bg-rose/10 text-rose border-rose/20',
  gold:  'bg-gold/10 text-gold border-gold/20',
  blue:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  jade:  'bg-jade/10 text-jade border-jade/20',
  muted: 'bg-surface2 text-muted border-border',
}

export function Badge({
  color = 'muted',
  children,
  className = '',
}: {
  color?: BadgeColor
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${BADGE_STYLES[color] ?? BADGE_STYLES.muted} ${className}`}>
      {children}
    </span>
  )
}

// ── PageHeader ─────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
      <div>
        <h1 className="text-lg font-semibold text-fg">{title}</h1>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

// ── EmptyState ─────────────────────────────────────────────────────────────
export function EmptyState({
  message = 'No data found',
  icon,
}: {
  message?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted gap-3">
      {icon && <div className="opacity-30 text-4xl">{icon}</div>}
      <p className="text-sm">{message}</p>
    </div>
  )
}
