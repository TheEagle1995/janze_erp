import dayjs from 'dayjs'

export const fmt = {
  currency: (n: number, currency = 'UZS') => {
    if (currency === 'UZS') return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + ' UZS'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)
  },
  compact: (n: number) => {
    const sign = n < 0 ? '-' : ''
    const abs  = Math.abs(n)
    if (abs >= 1_000_000_000) return `${sign}${(abs/1_000_000_000).toFixed(1)}B`
    if (abs >= 1_000_000)     return `${sign}${(abs/1_000_000).toFixed(1)}M`
    if (abs >= 1_000)         return `${sign}${(abs/1_000).toFixed(0)}K`
    return String(Math.round(n))
  },
  pct:     (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`,
  date:    (d: string | Date) => dayjs(d).format('DD MMM YYYY'),
  time:    (d: string | Date) => dayjs(d).format('HH:mm'),
  dateTime:(d: string | Date) => dayjs(d).format('DD MMM YYYY, HH:mm'),
}
