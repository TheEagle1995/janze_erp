import { useQuery }       from '@tanstack/react-query'
import { analyticsApi, ordersApi, inventoryApi } from '../lib/api'
import { useAuthStore }   from '../store/authStore'
import { useT }           from '../i18n'
import { fmt }            from '../utils/format'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, ShoppingCart, Users, DollarSign,
  BarChart2, Package, AlertTriangle, Clock, Percent,
  RefreshCw, ArrowUpRight, ArrowDownRight, ShoppingBag,
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

// ── custom tooltip ────────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-muted mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-fg font-mono font-semibold">
            {p.value > 1000 ? fmt.compact(p.value) : p.value}
          </span>
          <span className="text-muted">{p.name}</span>
        </div>
      ))}
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, change, icon: Icon, accent, mono = true }: {
  label: string; value: string; sub?: string; change?: number
  icon: any; accent: string; mono?: boolean
}) {
  return (
    <div className="card group hover:border-border/60 transition-all">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-muted font-medium leading-tight">{label}</span>
        <div className={clsx('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', accent)}>
          <Icon size={14} />
        </div>
      </div>
      <div className={clsx('text-2xl font-bold', mono && 'font-mono')}>{value}</div>
      {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
      {change !== undefined && (
        <div className={clsx('flex items-center gap-1 text-xs mt-1.5 font-medium',
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

// ── greeting ──────────────────────────────────────────────────────────────────
function greeting(name?: string) {
  const h = new Date().getHours()
  const g = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return name ? `${g}, ${name.split(' ')[0]}!` : `${g}!`
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

  // Recent orders (live feed) — Orders section only, not POS transactions
  // includeItems=true so we can show what products were sold in each row
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
  const payPie   = (payData as any[]).map((p, i) => ({
    name:  PAY_LABEL[p.method] ?? p.method,
    value: p.pct,
    amount: p.amount,
    color: PAY_COLOR[p.method] ?? PIE_COLORS[i % PIE_COLORS.length],
  }))
  const recentOrders: any[] = (recentRaw as any)?.data ?? []
  const hourlyData = (hourly as any[])

  const maxHourRevenue = Math.max(...hourlyData.map((h: any) => h.revenue), 1)
  const peakHour = hourlyData.reduce((best: any, h: any) => h.revenue > (best?.revenue ?? 0) ? h : best, null as any)

  const revenue    = kpis?.revenue?.value  ?? 0
  const orders     = kpis?.orders?.value   ?? 0
  const avgOrder   = kpis?.avgOrder?.value ?? 0
  const itemsSold  = (kpis as any)?.itemsSold  ?? 0
  const grossProfit = Number(pl?.grossProfit ?? 0)
  const margin      = Number(pl?.grossMargin ?? 0)
  const discounts   = Number(pl?.discountTotal ?? 0)

  const lastUpdated = dataUpdatedAt ? dayjs(dataUpdatedAt).format('HH:mm:ss') : '—'

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-fg">{greeting(user?.name)}</h1>
          <p className="text-sm text-muted">{dayjs().format('dddd, MMMM D, YYYY')}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted bg-surface2 border border-border rounded-lg px-3 py-1.5">
          <RefreshCw size={11} className="text-jade animate-spin" style={{ animationDuration: '3s' }} />
          Live · updated {lastUpdated}
        </div>
      </div>

      {/* ── KPI row 1 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label={t.dashboard.revenueToday}  value={fmt.compact(revenue)}
          change={kpis?.revenue?.change}
          sub={fmt.currency(revenue)}
          icon={DollarSign} accent="bg-gold-dim text-gold" />
        <KpiCard label="Items Sold Today"  value={String(itemsSold)}
          change={kpis?.orders?.change}
          sub={`${orders} sale${orders !== 1 ? 's' : ''} · avg ${fmt.compact(avgOrder)}`}
          icon={ShoppingBag} accent="bg-jade/10 text-jade" mono={false} />
        <KpiCard label={t.dashboard.grossProfit}   value={fmt.compact(grossProfit)}
          sub={`${margin}% margin`}
          icon={TrendingUp} accent="bg-blue-900/20 text-blue-400" />
        <KpiCard label={t.dashboard.newCustomers}  value={String(kpis?.newCustomers ?? 0)}
          sub="registered today"
          icon={Users} accent="bg-purple-900/20 text-purple-400" mono={false} />
      </div>

      {/* ── KPI row 2 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label={t.dashboard.avgBasket}     value={fmt.compact(avgOrder)}
          icon={BarChart2} accent="bg-indigo-900/20 text-indigo-400" />
        <KpiCard label="Discounts Given"          value={fmt.compact(discounts)}
          sub={`${revenue > 0 ? ((discounts/revenue)*100).toFixed(1) : 0}% of revenue`}
          icon={Percent} accent="bg-rose/10 text-rose" />
        <KpiCard label="Peak Hour Today"          value={peakHour ? peakHour.label : '—'}
          sub={peakHour ? `${peakHour.count} orders` : 'No sales yet'}
          icon={Clock} accent="bg-amber-900/20 text-amber-400" mono={false} />
        <KpiCard label={t.dashboard.lowStock}      value={String(lowStock.length)}
          sub={lowStock.length > 0 ? 'items need restocking' : 'Stock levels OK'}
          icon={AlertTriangle} accent={lowStock.length > 0 ? 'bg-rose/10 text-rose' : 'bg-jade/10 text-jade'} mono={false} />
      </div>

      {/* ── Revenue chart + Top Products ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">{t.dashboard.revenueMonth}</h3>
            <span className="text-xs text-muted">{dayjs().format('MMMM YYYY')}</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dashRevG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={GOLD} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2330" />
              <XAxis dataKey="period" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false}
                tickFormatter={v => v.slice(8)} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false}
                tickFormatter={v => fmt.compact(v)} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue"
                stroke={GOLD} strokeWidth={2} fill="url(#dashRevG)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold mb-4">{t.dashboard.topProducts}</h3>
          <div className="space-y-3">
            {topData.length === 0 && <p className="text-xs text-muted">{t.dashboard.noData}</p>}
            {topData.map((p: any, i: number) => {
              const max = topData[0]?.total_sold ?? 1
              return (
                <div key={p.id} className="flex items-center gap-2.5">
                  <span className="text-[10px] text-muted w-3 font-mono flex-shrink-0">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{p.name}</div>
                    <div className="mt-1 bg-surface2 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${(p.total_sold/max)*100}%`, background: GOLD }} />
                    </div>
                  </div>
                  <span className="text-[10px] text-muted font-mono flex-shrink-0">{p.total_sold}u</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Hourly heatmap ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Today by Hour</h3>
          {peakHour && (
            <span className="text-xs text-muted">
              Peak: <span className="text-gold font-semibold">{peakHour.label}</span>
              {' '}({fmt.compact(peakHour.revenue)})
            </span>
          )}
        </div>
        {/* Bar heatmap */}
        <div className="flex items-end gap-px h-16">
          {hourlyData.map((h: any) => {
            const pct   = maxHourRevenue > 0 ? h.revenue / maxHourRevenue : 0
            const isPeak = h.revenue === maxHourRevenue && h.revenue > 0
            const isNow  = h.hour === new Date().getHours()
            return (
              <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                <div className="absolute bottom-full mb-7 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                  <div className="bg-surface border border-border rounded-lg px-2 py-1 text-[10px] whitespace-nowrap shadow-lg">
                    <div className="font-semibold text-fg">{h.label}</div>
                    <div className="text-muted">{h.count} orders · {fmt.compact(h.revenue)}</div>
                  </div>
                </div>
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height:     Math.max(pct * 56, h.revenue > 0 ? 3 : 1),
                    background: isPeak ? GOLD : isNow ? '#818cf8' : h.revenue > 0 ? '#3ecf8e66' : '#1f2330',
                  }}
                />
                {(h.hour % 4 === 0) && (
                  <span className="text-[8px] text-muted">{h.label.slice(0,2)}</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-muted">
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-jade/40 inline-block"/> Sales</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-400 inline-block"/> Current hour</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{background:GOLD}}/>Peak</div>
        </div>
      </div>

      {/* ── Low-stock alert banner ── */}
      {lowStock.length > 0 && (
        <div className="card border-rose/30 bg-rose/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-rose" />
              <span className="text-sm font-semibold text-rose">{t.dashboard.lowStock}</span>
              <span className="text-xs bg-rose/20 text-rose px-2 py-0.5 rounded-full font-medium">
                {lowStock.length} item{lowStock.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lowStock.slice(0, 6).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-2.5 bg-surface2 rounded-xl px-3 py-2">
                <Package size={13} className="text-rose flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">
                    {item.variant?.product?.name ?? item.name ?? 'Unknown'}
                  </div>
                  <div className="text-[10px] text-muted">{item.branch?.name ?? ''}</div>
                </div>
                <span className={clsx('text-xs font-bold font-mono flex-shrink-0',
                  item.quantity === 0 ? 'text-rose' : 'text-yellow-400')}>
                  {item.quantity ?? 0}
                </span>
              </div>
            ))}
          </div>
          {lowStock.length > 6 && (
            <p className="text-[10px] text-muted mt-2">+{lowStock.length - 6} more items</p>
          )}
        </div>
      )}

      {/* ── Recent orders + Payment methods ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Recent sales feed — shows products sold, not just order metadata */}
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Recent Sales</h3>
            <div className="flex items-center gap-1 text-[10px] text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-jade animate-pulse" />
              live
            </div>
          </div>
          <div className="space-y-2">
            {recentOrders.length === 0 && (
              <p className="text-xs text-muted py-4 text-center">{t.dashboard.noData}</p>
            )}
            {recentOrders.map((o: any) => {
              // Build a readable summary of what was actually sold
              const soldItems: any[] = o.items ?? []
              const productSummary = soldItems.length > 0
                ? soldItems
                    .slice(0, 3)
                    .map((it: any) => `${it.variant?.product?.name ?? 'Product'} ×${it.quantity}`)
                    .join(', ') + (soldItems.length > 3 ? ` +${soldItems.length - 3} more` : '')
                : `${o._count?.items ?? 0} item${(o._count?.items ?? 0) !== 1 ? 's' : ''}`

              return (
                <div key={o.id} className="flex items-start gap-3 px-2 py-2.5 rounded-xl hover:bg-surface2 transition-colors">
                  {/* Icon */}
                  <div className="w-7 h-7 rounded-lg bg-jade/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ShoppingBag size={12} className="text-jade" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Products sold — the main info */}
                    <div className="text-xs font-medium text-fg truncate">{productSummary}</div>
                    {/* Metadata on second line */}
                    <div className="text-[10px] text-muted mt-0.5 flex items-center gap-1.5">
                      <span>{o.customer?.name ?? 'Walk-in'}</span>
                      <span>·</span>
                      <span className="font-mono">{o.orderNumber}</span>
                      <span>·</span>
                      <span>{dayjs(o.createdAt).format('HH:mm')}</span>
                      <span className={clsx('ml-1 px-1 py-0 rounded text-[9px] font-medium', STATUS_COLOR[o.status] ?? 'text-muted bg-surface2')}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm font-bold font-mono text-gold flex-shrink-0">{fmt.compact(o.total)}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Payment methods */}
        <div className="card lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4">{t.dashboard.paymentMethods}</h3>
          {payPie.length === 0 ? (
            <div className="text-xs text-muted text-center py-8">{t.dashboard.noData}</div>
          ) : (
            <div className="flex flex-col gap-3">
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={payPie} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={58} paddingAngle={2}>
                    {payPie.map((e: any, i: number) => (
                      <Cell key={i} fill={e.color ?? PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#161921', border: '1px solid #1f2330', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any, name: any, p: any) => [`${v}% · ${fmt.compact(p.payload.amount)}`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {payPie.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      <span className="text-muted">{p.name}</span>
                    </div>
                    <div className="font-mono font-semibold">
                      {p.value}% <span className="text-muted font-normal">({fmt.compact(p.amount)})</span>
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
