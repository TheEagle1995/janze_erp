import { useQuery }       from '@tanstack/react-query'
import { analyticsApi, ordersApi, inventoryApi } from '../lib/api'
import { useAuthStore }   from '../store/authStore'
import { useT }           from '../i18n'
import { fmt }            from '../utils/format'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  TrendingUp, ShoppingCart, Users, DollarSign,
  BarChart2, Package, AlertTriangle, Clock, Percent,
  RefreshCw, ArrowUpRight, ArrowDownRight, ShoppingBag,
  Sparkles,
} from 'lucide-react'
import clsx   from 'clsx'
import dayjs  from 'dayjs'

// ── colours ───────────────────────────────────────────────────────────────────
const GOLD   = '#c8912a'; const JADE   = '#3ecf8e'
const ROSE   = '#f43f5e'; const BLUE   = '#60a5fa'
const PURPLE = '#a78bfa'
const PIE_COLORS = [GOLD, BLUE, JADE, PURPLE, ROSE, '#fb923c']
const PAY_COLOR: Record<string,string> = {
  CASH: GOLD, CARD: BLUE, TRANSFER: JADE, DEBT: ROSE, LOYALTY: PURPLE, TRANSFER_OUT: '#fb923c',
}
const PAY_LABEL: Record<string,string> = {
  CASH: 'Cash', CARD: 'Card', TRANSFER: 'Transfer', DEBT: 'On Credit', LOYALTY: 'Loyalty',
}

const STATUS_COLOR: Record<string,string> = {
  COMPLETED: 'text-jade bg-jade/10',
  PENDING:   'text-yellow-400 bg-yellow-400/10',
  VOID:      'text-rose bg-rose/10',
  REFUNDED:  'text-muted bg-surface2',
}
const STATUS_LABEL: Record<string,string> = {
  COMPLETED:'Completed', PENDING:'Pending', VOID:'Void', REFUNDED:'Refunded',
}

// ── rank medal colours ────────────────────────────────────────────────────────
const RANK_STYLES = [
  { bg: 'bg-amber-400/15', text: 'text-amber-400', bar: '#f59e0b' },
  { bg: 'bg-slate-400/10', text: 'text-slate-400', bar: '#94a3b8' },
  { bg: 'bg-orange-700/15', text: 'text-orange-600', bar: '#b45309' },
]

// ── custom tooltip ────────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-xl px-3.5 py-2.5 shadow-2xl text-xs">
      <p className="text-muted mb-1.5 font-medium">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-fg font-mono font-bold">
            {p.value > 1000 ? fmt.compact(p.value) : p.value}
          </span>
          <span className="text-muted">{p.name}</span>
        </div>
      ))}
    </div>
  )
}

// ── premium KPI card ──────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, change, icon: Icon, accentColor, accentClass, mono = true }: {
  label: string; value: string; sub?: string; change?: number
  icon: any; accentColor: string; accentClass: string; mono?: boolean
}) {
  return (
    <div className="card group hover:border-border/60 transition-all duration-200 relative overflow-hidden pt-5">
      {/* coloured top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl"
        style={{ background: `linear-gradient(90deg, ${accentColor}cc, ${accentColor}22)` }}
      />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] text-muted font-semibold uppercase tracking-wider leading-tight">{label}</span>
        <div className={clsx(
          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm',
          accentClass,
        )}>
          <Icon size={15} />
        </div>
      </div>
      <div className={clsx('text-3xl font-bold tracking-tight', mono && 'font-mono')}>{value}</div>
      {sub && <div className="text-[11px] text-muted mt-1 leading-tight">{sub}</div>}
      {change !== undefined && (
        <div className={clsx('flex items-center gap-1 text-[11px] mt-2 font-semibold',
          change > 0 ? 'text-jade' : change < 0 ? 'text-rose' : 'text-muted')}>
          {change > 0
            ? <ArrowUpRight size={12} />
            : change < 0 ? <ArrowDownRight size={12} /> : null}
          {change !== 0 ? `${Math.abs(change).toFixed(1)}% vs yesterday` : 'No change'}
        </div>
      )}
    </div>
  )
}

// ── section heading ───────────────────────────────────────────────────────────
function SectionHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-display text-base font-semibold text-fg tracking-tight">{title}</h3>
      {right}
    </div>
  )
}

// ── greeting ──────────────────────────────────────────────────────────────────
function greeting(name?: string) {
  const h = new Date().getHours()
  const g = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return name ? `${g}, ${name.split(' ')[0]}` : g
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const t        = useT()
  const user     = useAuthStore(s => s.user)
  const branchId = user?.branchId
  const today    = dayjs().format('YYYY-MM-DD')
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD')

  // KPIs for today
  const { data: kpis, dataUpdatedAt } = useQuery({
    queryKey:  ['dashboard-kpis', branchId],
    queryFn:   () => analyticsApi.dashboard({ branchId, period: 'today' }),
    refetchInterval: 30_000,
  })

  // Today's P&L (gross profit)
  const { data: pl } = useQuery({
    queryKey: ['dash-pl', branchId, today],
    queryFn:  () => analyticsApi.profitLoss({ branchId, dateFrom: today, dateTo: today }),
    refetchInterval: 60_000,
  })

  // Monthly revenue chart
  const { data: chartRaw = [] } = useQuery({
    queryKey: ['dash-chart', branchId, monthStart],
    queryFn:  () => analyticsApi.salesChart({ branchId, dateFrom: monthStart, dateTo: today, groupBy: 'day' }),
  })

  // Today's hourly breakdown
  const { data: hourly = [] } = useQuery({
    queryKey: ['dash-hourly', branchId, today],
    queryFn:  () => analyticsApi.hourlyStats({ branchId, date: today }),
    refetchInterval: 30_000,
  })

  // Top products this month
  const { data: topProds = [] } = useQuery({
    queryKey: ['dash-top', branchId, monthStart],
    queryFn:  () => analyticsApi.topProducts({ branchId, dateFrom: monthStart, dateTo: today, limit: 6 }),
  })

  // Payment methods today
  const { data: payData = [] } = useQuery({
    queryKey: ['dash-pay', branchId, today],
    queryFn:  () => analyticsApi.paymentMethods({ branchId, dateFrom: today, dateTo: today }),
    refetchInterval: 30_000,
  })

  // Recent orders (live feed)
  const { data: recentRaw } = useQuery({
    queryKey: ['dash-recent', branchId],
    queryFn:  () => ordersApi.list({ branchId, source: 'ORDER', limit: 8, page: 1, sortBy: 'createdAt', sortDir: 'desc', includeItems: 'true' }),
    refetchInterval: 20_000,
  })

  // Low-stock alerts
  const { data: lowStockRaw = [] } = useQuery({
    queryKey: ['dash-lowstock', branchId],
    queryFn:  () => inventoryApi.lowStock(branchId),
    refetchInterval: 60_000,
  })

  const chart     = chartRaw as any[]
  const topData   = topProds as any[]
  const lowStock  = lowStockRaw as any[]
  const payPie    = (payData as any[]).map((p, i) => ({
    name:   PAY_LABEL[p.method] ?? p.method,
    value:  p.pct,
    amount: p.amount,
    color:  PAY_COLOR[p.method] ?? PIE_COLORS[i % PIE_COLORS.length],
  }))
  const recentOrders: any[] = (recentRaw as any)?.data ?? []
  const hourlyData = (hourly as any[])

  const maxHourRevenue = Math.max(...hourlyData.map((h: any) => h.revenue), 1)
  const peakHour = hourlyData.reduce((best: any, h: any) => h.revenue > (best?.revenue ?? 0) ? h : best, null as any)

  const revenue     = kpis?.revenue?.value  ?? 0
  const orders      = kpis?.orders?.value   ?? 0
  const avgOrder    = kpis?.avgOrder?.value ?? 0
  const itemsSold   = (kpis as any)?.itemsSold  ?? 0
  const grossProfit = Number(pl?.grossProfit ?? 0)
  const margin      = Number(pl?.grossMargin ?? 0)
  const discounts   = Number(pl?.discountTotal ?? 0)

  const lastUpdated = dataUpdatedAt ? dayjs(dataUpdatedAt).format('HH:mm:ss') : '—'

  // Total payment amount for progress bars
  const payTotal = payPie.reduce((s: number, p: any) => s + (p.amount ?? 0), 0)

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-gold" />
            <h1 className="font-display text-2xl font-bold text-fg tracking-tight">
              {greeting(user?.name)}
              <span className="text-gold">.</span>
            </h1>
          </div>
          <p className="text-sm text-muted mt-0.5 ml-6">{dayjs().format('dddd, MMMM D, YYYY')}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted bg-surface border border-border rounded-xl px-3.5 py-2">
          <RefreshCw size={11} className="text-jade" style={{ animation: 'spin 3s linear infinite' }} />
          <span>Live</span>
          <span className="w-px h-3 bg-border mx-0.5" />
          <span>Updated {lastUpdated}</span>
        </div>
      </div>

      {/* ── KPI row 1 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label={t.dashboard.revenueToday}
          value={fmt.compact(revenue)}
          change={kpis?.revenue?.change}
          sub={fmt.currency(revenue)}
          icon={DollarSign}
          accentColor={GOLD}
          accentClass="bg-amber-400/15 text-amber-400"
        />
        <KpiCard
          label="Items Sold Today"
          value={String(itemsSold)}
          change={kpis?.orders?.change}
          sub={`${orders} sale${orders !== 1 ? 's' : ''} · avg ${fmt.compact(avgOrder)}`}
          icon={ShoppingBag}
          accentColor={JADE}
          accentClass="bg-jade/10 text-jade"
          mono={false}
        />
        <KpiCard
          label={t.dashboard.grossProfit}
          value={fmt.compact(grossProfit)}
          sub={`${margin}% margin`}
          icon={TrendingUp}
          accentColor={BLUE}
          accentClass="bg-blue-400/10 text-blue-400"
        />
        <KpiCard
          label={t.dashboard.newCustomers}
          value={String(kpis?.newCustomers ?? 0)}
          sub="registered today"
          icon={Users}
          accentColor={PURPLE}
          accentClass="bg-purple-400/10 text-purple-400"
          mono={false}
        />
      </div>

      {/* ── KPI row 2 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label={t.dashboard.avgBasket}
          value={fmt.compact(avgOrder)}
          icon={BarChart2}
          accentColor="#818cf8"
          accentClass="bg-indigo-400/10 text-indigo-400"
        />
        <KpiCard
          label="Discounts Given"
          value={fmt.compact(discounts)}
          sub={`${revenue > 0 ? ((discounts / revenue) * 100).toFixed(1) : 0}% of revenue`}
          icon={Percent}
          accentColor={ROSE}
          accentClass="bg-rose/10 text-rose"
        />
        <KpiCard
          label="Peak Hour Today"
          value={peakHour ? peakHour.label : '—'}
          sub={peakHour ? `${peakHour.count} orders` : 'No sales yet'}
          icon={Clock}
          accentColor="#fb923c"
          accentClass="bg-orange-400/10 text-orange-400"
          mono={false}
        />
        <KpiCard
          label={t.dashboard.lowStock}
          value={String(lowStock.length)}
          sub={lowStock.length > 0 ? 'items need restocking' : 'Stock levels OK'}
          icon={AlertTriangle}
          accentColor={lowStock.length > 0 ? ROSE : JADE}
          accentClass={lowStock.length > 0 ? 'bg-rose/10 text-rose' : 'bg-jade/10 text-jade'}
          mono={false}
        />
      </div>

      {/* ── Revenue chart + Top Products ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Revenue area chart */}
        <div className="card lg:col-span-2">
          <SectionHead
            title={t.dashboard.revenueMonth}
            right={
              <span className="text-xs text-muted font-medium px-2.5 py-1 bg-surface2 rounded-lg border border-border">
                {dayjs().format('MMMM YYYY')}
              </span>
            }
          />
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={chart} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dashRevG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor={GOLD} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dashOrdG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor={JADE} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={JADE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border)/0.7)" vertical={false} />
              <XAxis dataKey="period" tick={{ fill: 'rgb(var(--color-muted))', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => v.slice(8)} />
              <YAxis tick={{ fill: 'rgb(var(--color-muted))', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => fmt.compact(v)} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue"
                stroke={GOLD} strokeWidth={2.5} fill="url(#dashRevG)" dot={false} />
              <Area type="monotone" dataKey="orderCount" name="Orders"
                stroke={JADE} strokeWidth={1.5} fill="url(#dashOrdG)" dot={false} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
          {/* mini legend */}
          <div className="flex items-center gap-4 mt-2 text-[10px] text-muted">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 rounded-full inline-block" style={{ background: GOLD }} />
              Revenue
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 rounded-full inline-block border-dashed" style={{ background: JADE }} />
              Orders
            </div>
          </div>
        </div>

        {/* Top products */}
        <div className="card">
          <SectionHead title={t.dashboard.topProducts} />
          <div className="space-y-3.5">
            {topData.length === 0 && (
              <p className="text-xs text-muted py-4 text-center">{t.dashboard.noData}</p>
            )}
            {topData.map((p: any, i: number) => {
              const max = topData[0]?.total_sold ?? 1
              const rankStyle = RANK_STYLES[i] ?? { bg: 'bg-surface2', text: 'text-muted', bar: '#3ecf8e44' }
              return (
                <div key={p.id} className="flex items-center gap-3">
                  {/* rank badge */}
                  <div className={clsx('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold', rankStyle.bg, rankStyle.text)}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold truncate">{p.name}</span>
                      <span className="text-[10px] text-muted font-mono ml-2 flex-shrink-0">{p.total_sold}u</span>
                    </div>
                    <div className="bg-surface2 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(p.total_sold / max) * 100}%`,
                          background: `linear-gradient(90deg, ${rankStyle.bar}, ${rankStyle.bar}88)`,
                        }}
                      />
                    </div>
                    {p.total_revenue !== undefined && (
                      <div className="text-[10px] text-muted mt-0.5 font-mono">{fmt.compact(p.total_revenue)}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Hourly heatmap ── */}
      <div className="card">
        <SectionHead
          title="Today by Hour"
          right={
            peakHour ? (
              <span className="text-xs text-muted flex items-center gap-1.5">
                Peak
                <span className="text-gold font-bold font-mono">{peakHour.label}</span>
                <span className="text-muted">·</span>
                <span className="text-fg font-mono font-semibold">{fmt.compact(peakHour.revenue)}</span>
              </span>
            ) : null
          }
        />
        {/* Bar chart */}
        <div className="flex items-end gap-[3px]" style={{ height: 72 }}>
          {hourlyData.map((h: any) => {
            const pct    = maxHourRevenue > 0 ? h.revenue / maxHourRevenue : 0
            const isPeak = h.revenue === maxHourRevenue && h.revenue > 0
            const isNow  = h.hour === new Date().getHours()
            const barH   = Math.max(pct * 60, h.revenue > 0 ? 4 : 2)

            let barBg: string
            if (isPeak)        barBg = `linear-gradient(180deg, ${GOLD}, ${GOLD}88)`
            else if (isNow)    barBg = 'linear-gradient(180deg, #818cf8, #818cf866)'
            else if (h.revenue > 0) barBg = `linear-gradient(180deg, ${JADE}99, ${JADE}33)`
            else               barBg = 'rgb(var(--color-surface2))'

            return (
              <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                {/* hover tooltip */}
                <div className="absolute bottom-full mb-8 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                  <div className="bg-surface border border-border rounded-xl px-3 py-2 text-[10px] whitespace-nowrap shadow-2xl">
                    <div className="font-bold text-fg font-display">{h.label}</div>
                    <div className="text-muted mt-0.5">{h.count} orders</div>
                    <div className="text-gold font-mono font-semibold">{fmt.compact(h.revenue)}</div>
                  </div>
                  <div className="w-px h-2 bg-border" />
                </div>
                <div
                  className="w-full rounded-t-sm transition-all duration-300"
                  style={{ height: barH, background: barBg, alignSelf: 'flex-end' }}
                />
                {h.hour % 4 === 0 && (
                  <span className="text-[9px] text-muted font-mono leading-none">{String(h.hour).padStart(2, '0')}</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-5 mt-3 text-[10px] text-muted">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: `${JADE}99` }} />
            Sales
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-400/70 inline-block" />
            Current
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: GOLD }} />
            Peak
          </div>
        </div>
      </div>

      {/* ── Low-stock alert banner ── */}
      {lowStock.length > 0 && (
        <div className="card border-rose/25 bg-rose/5 relative overflow-hidden">
          {/* subtle left accent */}
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-rose/60 rounded-l-xl" />
          <div className="flex items-center justify-between mb-3 pl-2">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={15} className="text-rose" />
              <span className="font-display text-sm font-semibold text-rose">{t.dashboard.lowStock}</span>
              <span className="text-[11px] bg-rose/20 text-rose px-2.5 py-0.5 rounded-full font-bold">
                {lowStock.length}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-2">
            {lowStock.slice(0, 6).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 bg-surface2/60 border border-border/50 rounded-xl px-3 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-rose/10 flex items-center justify-center flex-shrink-0">
                  <Package size={13} className="text-rose" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">
                    {item.variant?.product?.name ?? item.name ?? 'Unknown'}
                  </div>
                  <div className="text-[10px] text-muted mt-0.5">{item.branch?.name ?? ''}</div>
                </div>
                <div className={clsx(
                  'text-sm font-bold font-mono flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                  item.quantity === 0 ? 'bg-rose/15 text-rose' : 'bg-yellow-400/10 text-yellow-400',
                )}>
                  {item.quantity ?? 0}
                </div>
              </div>
            ))}
          </div>
          {lowStock.length > 6 && (
            <p className="text-[10px] text-muted mt-2.5 pl-2">+{lowStock.length - 6} more items need attention</p>
          )}
        </div>
      )}

      {/* ── Recent orders + Payment methods ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Recent sales feed */}
        <div className="card lg:col-span-3">
          <SectionHead
            title="Recent Sales"
            right={
              <div className="flex items-center gap-1.5 text-[11px] text-jade font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-jade" style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
                Live feed
              </div>
            }
          />
          <div className="space-y-1">
            {recentOrders.length === 0 && (
              <p className="text-xs text-muted py-6 text-center">{t.dashboard.noData}</p>
            )}
            {recentOrders.map((o: any) => {
              const soldItems: any[] = o.items ?? []
              const productSummary = soldItems.length > 0
                ? soldItems
                    .slice(0, 3)
                    .map((it: any) => `${it.variant?.product?.name ?? 'Product'} ×${it.quantity}`)
                    .join(', ') + (soldItems.length > 3 ? ` +${soldItems.length - 3}` : '')
                : `${o._count?.items ?? 0} item${(o._count?.items ?? 0) !== 1 ? 's' : ''}`

              // Customer avatar initials
              const cname = o.customer?.name ?? 'W'
              const initials = cname === 'W' ? '?' : cname.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
              const avatarColors = ['bg-gold/20 text-gold', 'bg-jade/15 text-jade', 'bg-blue-400/15 text-blue-400', 'bg-purple-400/15 text-purple-400']
              const avatarColor = avatarColors[o.id?.charCodeAt?.(0) % avatarColors.length ?? 0]

              return (
                <div key={o.id} className="flex items-start gap-3 px-2.5 py-2.5 rounded-xl hover:bg-surface2/70 transition-colors group">
                  {/* Avatar */}
                  <div className={clsx('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-bold', avatarColor)}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-fg truncate leading-snug">{productSummary}</div>
                    <div className="text-[10px] text-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium">{o.customer?.name ?? 'Walk-in'}</span>
                      <span className="text-border">·</span>
                      <span className="font-mono opacity-70">{o.orderNumber}</span>
                      <span className="text-border">·</span>
                      <span>{dayjs(o.createdAt).format('HH:mm')}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-sm font-bold font-mono text-gold">{fmt.compact(o.total)}</span>
                    <span className={clsx('px-1.5 py-px rounded-md text-[9px] font-bold uppercase tracking-wide', STATUS_COLOR[o.status] ?? 'text-muted bg-surface2')}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Payment methods */}
        <div className="card lg:col-span-2">
          <SectionHead title={t.dashboard.paymentMethods} />
          {payPie.length === 0 ? (
            <div className="text-xs text-muted text-center py-10">{t.dashboard.noData}</div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Donut with center total */}
              <div className="relative">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={payPie} dataKey="value" cx="50%" cy="50%"
                      innerRadius={42} outerRadius={62} paddingAngle={3}
                      strokeWidth={0}
                    >
                      {payPie.map((e: any, i: number) => (
                        <Cell key={i} fill={e.color ?? PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border))', borderRadius: 12, fontSize: 11 }}
                      formatter={(v: any, name: any, p: any) => [`${v}% · ${fmt.compact(p.payload.amount)}`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-[10px] text-muted font-medium">Total</div>
                  <div className="text-sm font-bold font-mono text-gold">{fmt.compact(payTotal)}</div>
                </div>
              </div>

              {/* Progress bar breakdown */}
              <div className="space-y-2.5">
                {payPie.map((p: any, i: number) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                        <span className="text-[11px] text-muted font-medium">{p.name}</span>
                      </div>
                      <div className="text-[11px] font-mono font-bold">{p.value}%</div>
                    </div>
                    <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${p.value}%`, background: p.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
