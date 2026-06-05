import { useState }       from 'react'
import { analyticsApi, branchesApi } from '../lib/api'
import { useQuery }       from '@tanstack/react-query'
import { useAuthStore }   from '../store/authStore'
import { fmt }            from '../utils/format'
import { useT }           from '../i18n'
import clsx               from 'clsx'
import dayjs              from 'dayjs'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  ComposedChart, Line,
} from 'recharts'
import {
  TrendingUp, TrendingDown, BarChart2, DollarSign,
  Package, Download, Calendar, Building2, UserCheck,
  AlertTriangle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'

// ── palette ───────────────────────────────────────────────────────────────────
const GOLD   = '#c8912a'; const JADE  = '#3ecf8e'; const ROSE  = '#f43f5e'
const BLUE   = '#60a5fa'; const PURPLE= '#a78bfa'
const PIE_COLORS = [GOLD, JADE, BLUE, PURPLE, ROSE, '#fb923c', '#34d399']
const PAY_COLOR: Record<string,string> = {
  CASH: GOLD, CARD: BLUE, TRANSFER: JADE, DEBT: ROSE, LOYALTY: PURPLE,
}
const PAY_LABEL: Record<string,string> = {
  CASH:'Cash', CARD:'Card', TRANSFER:'Transfer', DEBT:'On Credit', LOYALTY:'Loyalty',
}

// ── period ────────────────────────────────────────────────────────────────────
type Period = 'today' | '7d' | '30d' | '3m' | 'custom'
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today'    },
  { key: '7d',    label: '7 Days'   },
  { key: '30d',   label: '30 Days'  },
  { key: '3m',    label: '3 Months' },
  { key: 'custom',label: 'Custom'   },
]
function periodDates(p: Period, customFrom: string, customTo: string) {
  const to = dayjs().format('YYYY-MM-DD')
  switch (p) {
    case 'today':  return { from: to, to, groupBy: 'hour' }
    case '7d':     return { from: dayjs().subtract(6,'day').format('YYYY-MM-DD'), to, groupBy: 'day' }
    case '30d':    return { from: dayjs().subtract(29,'day').format('YYYY-MM-DD'), to, groupBy: 'day' }
    case '3m':     return { from: dayjs().subtract(89,'day').format('YYYY-MM-DD'), to, groupBy: 'week' }
    case 'custom': return { from: customFrom, to: customTo, groupBy: 'day' }
  }
}

// ── tabs ──────────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'pnl' | 'products' | 'employees' | 'branches' | 'slow'

// ── helpers ───────────────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-muted mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-fg font-mono font-semibold">
            {typeof p.value === 'number' && p.value > 999 ? fmt.compact(p.value) : p.value}
          </span>
          <span className="text-muted">{p.name}</span>
        </div>
      ))}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-fg">{children}</h3>
}

function exportCSV(data: any[], filename: string) {
  if (!data.length) return
  const keys = Object.keys(data[0])
  const rows = [keys.join(','), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const a    = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = filename; a.click()
}

function KpiCard({ label, value, sub, change, icon: Icon, color }: {
  label: string; value: string; sub?: string; change?: number; icon: any; color: string
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-muted font-medium">{label}</span>
        <div className={clsx('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
          <Icon size={14} />
        </div>
      </div>
      <div className="text-xl font-bold font-mono">{value}</div>
      {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
      {change !== undefined && change !== 0 && (
        <div className={clsx('flex items-center gap-1 text-xs mt-1.5',
          change > 0 ? 'text-jade' : 'text-rose')}>
          {change > 0 ? <ArrowUpRight size={11}/> : <ArrowDownRight size={11}/>}
          {Math.abs(change).toFixed(1)}% vs prev period
        </div>
      )}
    </div>
  )
}

// ── P&L row ───────────────────────────────────────────────────────────────────
function PLRow({ label, value, sub, highlight, indent }:
  { label: string; value: number; sub?: string; highlight?: string; indent?: boolean }) {
  return (
    <div className={clsx('flex items-center justify-between py-2.5 border-b border-border/50 last:border-0',
      indent && 'pl-4')}>
      <div>
        <span className={clsx('text-sm', indent ? 'text-muted' : 'text-fg font-medium')}>{label}</span>
        {sub && <span className="text-xs text-muted ml-2">{sub}</span>}
      </div>
      <span className={clsx('font-mono font-bold text-sm', highlight ?? (indent ? 'text-muted' : 'text-fg'))}>
        {fmt.compact(value)}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const t              = useT()
  const userBranchId   = useAuthStore(s => s.user?.branchId)
  const role           = useAuthStore(s => s.user?.role)
  const isSuperAdmin   = role === 'SUPER_ADMIN' || role === 'ADMIN'

  const [tab,          setTab]       = useState<Tab>('overview')
  const [period,       setPeriod]    = useState<Period>('30d')
  const [customFrom,   setFrom]      = useState(dayjs().subtract(29,'day').format('YYYY-MM-DD'))
  const [customTo,     setTo]        = useState(dayjs().format('YYYY-MM-DD'))
  const [filterBranch, setFilterBranch] = useState<string>('')

  const { from, to, groupBy } = periodDates(period, customFrom, customTo)

  // For super admins, allow per-branch filtering; regular users are locked to their branch
  const branchId = isSuperAdmin ? (filterBranch || undefined) : (userBranchId || undefined)

  // Fetch branch list for the filter (admin only)
  const { data: branchList = [] } = useQuery({
    queryKey: ['branches-list'],
    queryFn:  () => branchesApi.list(),
    enabled:  isSuperAdmin,
    staleTime: 60_000,
  })

  // ── data fetching ────────────────────────────────────────────────────────────
  const { data: chart = [] } = useQuery({
    queryKey: ['an-chart', branchId, from, to, groupBy],
    queryFn:  () => analyticsApi.salesChart({ branchId, dateFrom: from, dateTo: to, groupBy }),
    retry: false,
  })
  const { data: plData } = useQuery({
    queryKey: ['an-pl', branchId, from, to],
    queryFn:  () => analyticsApi.profitLoss({ branchId, dateFrom: from, dateTo: to }),
    retry: false,
  })
  const { data: topProds = [] } = useQuery({
    queryKey: ['an-top', branchId, from, to],
    queryFn:  () => analyticsApi.topProducts({ branchId, dateFrom: from, dateTo: to, limit: 15 }),
    retry: false,
  })
  const { data: payMethods = [] } = useQuery({
    queryKey: ['an-pay', branchId, from, to],
    queryFn:  () => analyticsApi.paymentMethods({ branchId, dateFrom: from, dateTo: to }),
    retry: false,
  })
  const { data: employees = [] } = useQuery({
    queryKey: ['an-emp', branchId, from, to],
    queryFn:  () => analyticsApi.byEmployee({ branchId, dateFrom: from, dateTo: to }),
    retry: false, enabled: tab === 'employees',
  })
  const { data: branches = [] } = useQuery({
    queryKey: ['an-br', from, to],
    queryFn:  () => analyticsApi.byBranch({ dateFrom: from, dateTo: to }),
    retry: false, enabled: tab === 'branches' && isSuperAdmin,
  })
  const { data: slowMovers = [] } = useQuery({
    queryKey: ['an-slow', branchId],
    queryFn:  () => analyticsApi.slowMovers({ branchId, days: 30 }),
    retry: false, enabled: tab === 'slow',
  })
  // Weekday stats: always span ≥7 days so every day column has potential data
  const sevenDaysAgo = dayjs().subtract(6, 'day').format('YYYY-MM-DD')
  const wdayFrom = from < sevenDaysAgo ? from : sevenDaysAgo
  const { data: weekdayRaw = [] } = useQuery({
    queryKey: ['an-wday', branchId, wdayFrom, to],
    queryFn:  () => analyticsApi.weekdayStats({ branchId, dateFrom: wdayFrom, dateTo: to }),
    retry: false, enabled: tab === 'overview',
  })
  const { data: hourlyRaw = [] } = useQuery({
    queryKey: ['an-hourly', branchId, from],
    queryFn:  () => analyticsApi.hourlyStats({ branchId, date: from }),
    retry: false, enabled: tab === 'overview' && period === 'today',
  })

  // ── derived ──────────────────────────────────────────────────────────────────
  const chartData   = chart as any[]
  const topData     = topProds as any[]
  const payData     = payMethods as any[]
  const empData     = employees as any[]
  const branchData  = branches as any[]
  const slowData    = slowMovers as any[]
  const weekData    = weekdayRaw as any[]
  const hourData    = hourlyRaw as any[]
  const pl          = plData as any

  const payPie = payData.map((p: any, i: number) => ({
    name:  PAY_LABEL[p.method] ?? p.method,
    value: p.pct,
    amount: p.amount,
    color: PAY_COLOR[p.method] ?? PIE_COLORS[i % PIE_COLORS.length],
  }))

  const grossRevenue  = Number(pl?.grossRevenue  ?? 0)
  const netRevenue    = Number(pl?.netRevenue     ?? 0)
  const discountTotal = Number(pl?.discountTotal  ?? 0)
  const costOfGoods   = Number(pl?.costOfGoods    ?? 0)
  const grossProfit   = Number(pl?.grossProfit    ?? 0)
  const grossMargin   = Number(pl?.grossMargin    ?? 0)
  const orderCount    = Number(pl?.orderCount     ?? 0)
  const avgOrder      = orderCount > 0 ? netRevenue / orderCount : 0

  const TABS: { id: Tab; label: string; icon: any; adminOnly?: boolean }[] = [
    { id: 'overview',  label: 'Overview',    icon: BarChart2  },
    { id: 'pnl',       label: 'P&L',         icon: DollarSign },
    { id: 'products',  label: 'Products',    icon: Package    },
    { id: 'employees', label: 'Employees',   icon: UserCheck  },
    { id: 'branches',  label: 'Branches',    icon: Building2, adminOnly: true },
    { id: 'slow',      label: 'Slow Movers', icon: AlertTriangle },
  ]

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t.analytics.title}</h1>
          <p className="text-sm text-muted">{from} → {to}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Branch filter (admins only) */}
          {isSuperAdmin && (branchList as any[]).length > 0 && (
            <select
              value={filterBranch}
              onChange={e => setFilterBranch(e.target.value)}
              className="input text-xs py-1.5 px-3 h-auto min-w-[140px]">
              <option value="">All Branches</option>
              {(branchList as any[]).map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          {/* Period selector */}
          <div className="flex gap-1 bg-surface2 rounded-xl p-1 border border-border">
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                  period === p.key ? 'bg-gold text-bg shadow' : 'text-muted hover:text-fg')}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={() => exportCSV(chartData, `analytics-${from}-${to}.csv`)}
            className="flex items-center gap-1.5 btn-secondary text-xs px-3 py-2">
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* Custom date range */}
      {period === 'custom' && (
        <div className="flex items-center gap-3 bg-surface2 rounded-xl p-3 border border-border w-fit">
          <Calendar size={14} className="text-muted" />
          <span className="text-xs text-muted">From</span>
          <input type="date" value={customFrom} onChange={e => setFrom(e.target.value)} className="input text-xs py-1 px-2 h-auto" />
          <span className="text-xs text-muted">To</span>
          <input type="date" value={customTo}   onChange={e => setTo(e.target.value)}   className="input text-xs py-1 px-2 h-auto" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface2 rounded-xl p-1 border border-border w-fit flex-wrap">
        {TABS.filter(tb => !tb.adminOnly || isSuperAdmin).map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
              tab === tb.id ? 'bg-surface text-fg shadow' : 'text-muted hover:text-fg')}>
            <tb.icon size={13} /> {tb.label}
          </button>
        ))}
      </div>

      {/* ══════════════════ OVERVIEW ══════════════════ */}
      {tab === 'overview' && (
        <div className="space-y-5">

          {/* KPI cards (driven by profitLoss endpoint — always correct) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Net Revenue"    value={fmt.compact(netRevenue)}
              sub={`${orderCount} orders`}
              icon={DollarSign} color="bg-gold-dim text-gold" />
            <KpiCard label={t.analytics.grossProfit} value={fmt.compact(grossProfit)}
              sub={`${grossMargin}% margin`}
              icon={TrendingUp} color="bg-jade/10 text-jade" />
            <KpiCard label="Avg Order Value" value={fmt.compact(avgOrder)}
              icon={BarChart2} color="bg-blue-900/20 text-blue-400" />
            <KpiCard label="Discounts"      value={fmt.compact(discountTotal)}
              sub={`${grossRevenue > 0 ? ((discountTotal/grossRevenue)*100).toFixed(1) : 0}% of gross`}
              icon={TrendingDown} color="bg-rose/10 text-rose" />
          </div>

          {/* Revenue trend chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>{t.analytics.salesTrend}</SectionTitle>
              <div className="flex items-center gap-3 text-[11px] text-muted">
                <div className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gold inline-block"/>Revenue</div>
                <div className="flex items-center gap-1"><span className="w-3 h-0.5 bg-jade inline-block"/>Orders</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revG2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={GOLD} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={GOLD} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2330"/>
                <XAxis dataKey="period" tick={{ fill:'#6b7280', fontSize:10 }} tickLine={false}/>
                <YAxis yAxisId="rev" tick={{ fill:'#6b7280', fontSize:10 }} tickLine={false}
                  tickFormatter={v => fmt.compact(v)}/>
                <YAxis yAxisId="cnt" orientation="right" tick={{ fill:'#6b7280', fontSize:10 }} tickLine={false}/>
                <Tooltip content={<ChartTip/>}/>
                <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue"
                  stroke={GOLD} strokeWidth={2} fill="url(#revG2)" dot={false}/>
                <Line yAxisId="cnt" type="monotone" dataKey="count" name="Orders"
                  stroke={JADE} strokeWidth={1.5} dot={false} strokeDasharray="4 2"/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Hourly heatmap — only for today */}
          {period === 'today' && hourData.length > 0 && (
            <div className="card">
              <SectionTitle>Hourly Breakdown — Today</SectionTitle>
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={hourData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2330" vertical={false}/>
                    <XAxis dataKey="label" tick={{ fill:'#6b7280', fontSize:9 }} tickLine={false}
                      interval={1}/>
                    <YAxis tick={{ fill:'#6b7280', fontSize:9 }} tickLine={false}
                      tickFormatter={v => fmt.compact(v)}/>
                    <Tooltip content={<ChartTip/>}/>
                    <Bar dataKey="revenue" name="Revenue" fill={GOLD} radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Weekday pattern + Payment methods */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Weekday chart */}
            <div className="card">
              <SectionTitle>Sales by Day of Week</SectionTitle>
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={weekData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2330" vertical={false}/>
                    <XAxis dataKey="day" tick={{ fill:'#9ca3af', fontSize:11 }} tickLine={false}/>
                    <YAxis tick={{ fill:'#6b7280', fontSize:10 }} tickLine={false}
                      tickFormatter={v => fmt.compact(v)}/>
                    <Tooltip content={<ChartTip/>}/>
                    <Bar dataKey="revenue" name="Revenue" fill={BLUE} radius={[4,4,0,0]}>
                      {weekData.map((_: any, i: number) => (
                        <Cell key={i} fill={i === new Date().getDay() ? GOLD : BLUE}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payment methods */}
            <div className="card">
              <SectionTitle>{t.dashboard.paymentMethods}</SectionTitle>
              {payPie.length === 0 ? (
                <p className="text-xs text-muted py-8 text-center">{t.analytics.noData}</p>
              ) : (
                <div className="flex items-center gap-4 mt-3">
                  <ResponsiveContainer width="45%" height={150}>
                    <PieChart>
                      <Pie data={payPie} dataKey="value" cx="50%" cy="50%"
                        innerRadius={38} outerRadius={62} paddingAngle={2}>
                        {payPie.map((e: any, i: number) => (
                          <Cell key={i} fill={e.color ?? PIE_COLORS[i%PIE_COLORS.length]}/>
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTip/>}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {payPie.map((p: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: p.color }}/>
                          <span className="text-muted">{p.name}</span>
                        </div>
                        <div className="font-mono font-bold">
                          {p.value}% <span className="text-muted font-normal">({fmt.compact(p.amount)})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top products mini */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>{t.analytics.topSelling}</SectionTitle>
              <button onClick={() => setTab('products')} className="text-xs text-gold hover:underline">
                View all →
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {topData.slice(0,6).map((p: any, i: number) => {
                const maxRev = topData[0]?.total_revenue ?? 1
                return (
                  <div key={p.id ?? i} className="flex items-center gap-2.5 p-2 rounded-xl bg-surface2">
                    <span className="text-xs text-muted font-mono w-4 flex-shrink-0">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{p.name}</div>
                      <div className="mt-1 bg-surface rounded-full h-1 overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${(Number(p.total_revenue)/maxRev)*100}%`,
                          background: i === 0 ? GOLD : JADE,
                        }}/>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-mono text-gold">{fmt.compact(Number(p.total_revenue))}</div>
                      <div className="text-[10px] text-muted">{p.total_sold}u</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ P&L TAB ══════════════════ */}
      {tab === 'pnl' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Gross Revenue"  value={fmt.compact(grossRevenue)}
              sub={`${orderCount} orders`} icon={DollarSign} color="bg-gold-dim text-gold"/>
            <KpiCard label="Net Revenue"    value={fmt.compact(netRevenue)}
              sub={`after ${fmt.compact(discountTotal)} discounts`} icon={TrendingDown} color="bg-blue-900/20 text-blue-400"/>
            <KpiCard label="Cost of Goods"  value={fmt.compact(costOfGoods)}
              icon={Package} color="bg-rose/10 text-rose"/>
            <KpiCard label="Gross Profit"   value={fmt.compact(grossProfit)}
              sub={`${grossMargin}% margin`} icon={TrendingUp} color="bg-jade/10 text-jade"/>
          </div>

          {/* P&L statement */}
          <div className="card">
            <SectionTitle>Profit & Loss Statement</SectionTitle>
            <p className="text-xs text-muted mb-4">{from} → {to}</p>
            <div className="space-y-0">
              <PLRow label="Gross Revenue"     value={grossRevenue}  highlight="text-gold"/>
              <PLRow label="Discounts Given"   value={-discountTotal} highlight="text-rose" indent/>
              <PLRow label="Net Revenue"       value={netRevenue}    highlight="text-blue-400"/>
              <PLRow label="Cost of Goods Sold" value={-costOfGoods} highlight="text-rose" indent/>
              <PLRow label="Gross Profit"      value={grossProfit}
                highlight={grossProfit >= 0 ? 'text-jade' : 'text-rose'}
                sub={`margin: ${grossMargin}%`}/>
            </div>
            {/* Visual margin bar */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-xs text-muted mb-1.5">
                <span>Gross margin</span>
                <span className="font-bold text-jade">{grossMargin}%</span>
              </div>
              <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(grossMargin, 100)}%`,
                    background: grossMargin >= 30 ? JADE : grossMargin >= 15 ? GOLD : ROSE }}/>
              </div>
              <div className="flex justify-between text-[10px] text-muted mt-1">
                <span>0%</span><span>30% target</span><span>100%</span>
              </div>
            </div>
          </div>

          {/* Revenue trend for P&L period */}
          <div className="card">
            <SectionTitle>Revenue Trend</SectionTitle>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="plRevG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={GOLD} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={GOLD} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2330"/>
                  <XAxis dataKey="period" tick={{ fill:'#6b7280', fontSize:10 }} tickLine={false}/>
                  <YAxis tick={{ fill:'#6b7280', fontSize:10 }} tickLine={false}
                    tickFormatter={v => fmt.compact(v)}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Area type="monotone" dataKey="revenue" name="Revenue"
                    stroke={GOLD} strokeWidth={2} fill="url(#plRevG)" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ PRODUCTS TAB ══════════════════ */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionTitle>{t.analytics.topSelling}</SectionTitle>
            <button onClick={() => exportCSV(topData, 'top-products.csv')}
              className="btn-secondary text-xs flex items-center gap-1 px-3 py-1.5">
              <Download size={11}/> CSV
            </button>
          </div>

          {topData.length > 0 && (
            <div className="card">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topData.slice(0,10)} layout="vertical" margin={{ left: 10, right: 70 }}>
                  <XAxis type="number" tick={{ fill:'#6b7280', fontSize:10 }}
                    tickFormatter={v => fmt.compact(v)}/>
                  <YAxis type="category" dataKey="name" tick={{ fill:'#9ca3af', fontSize:10 }} width={130}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Bar dataKey="total_revenue" name="Revenue" fill={GOLD} radius={[0,4,4,0]}>
                    {topData.slice(0,10).map((_: any, i: number) => (
                      <Cell key={i} fill={i === 0 ? GOLD : i < 3 ? '#b87c20' : '#6b4e14'}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface2">
                    {['#','Product','Brand','Units Sold','Revenue','Share'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const total = topData.reduce((s: number, p: any) => s + Number(p.total_revenue ?? 0), 0)
                    return topData.map((p: any, i: number) => (
                      <tr key={p.id ?? i} className="border-b border-border last:border-0 hover:bg-surface2/50 transition-colors">
                        <td className="px-4 py-3 text-muted text-xs font-mono">{i+1}</td>
                        <td className="px-4 py-3 font-semibold">{p.name}</td>
                        <td className="px-4 py-3">
                          <span className={clsx('text-xs px-2 py-0.5 rounded',
                            p.brand === 'AVERO' ? 'bg-gold-dim text-gold' : 'bg-purple-900/20 text-purple-400')}>
                            {p.brand}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono">{p.total_sold}</td>
                        <td className="px-4 py-3 font-mono text-gold">{fmt.compact(Number(p.total_revenue ?? 0))}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-surface2 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full rounded-full bg-gold"
                                style={{ width: total > 0 ? `${(Number(p.total_revenue)/total*100).toFixed(0)}%` : '0%' }}/>
                            </div>
                            <span className="text-[10px] text-muted font-mono">
                              {total > 0 ? `${(Number(p.total_revenue)/total*100).toFixed(1)}%` : '—'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  })()}
                  {!topData.length && (
                    <tr><td colSpan={6} className="text-center py-10 text-muted">{t.analytics.noData}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ EMPLOYEES TAB ══════════════════ */}
      {tab === 'employees' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionTitle>{t.analytics.topEmployees}</SectionTitle>
            <button onClick={() => exportCSV(empData, 'employees.csv')}
              className="btn-secondary text-xs flex items-center gap-1 px-3 py-1.5">
              <Download size={11}/> CSV
            </button>
          </div>

          {empData.length > 0 && (
            <div className="card">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={empData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2330"/>
                  <XAxis dataKey="cashierName" tick={{ fill:'#9ca3af', fontSize:10 }} tickLine={false}/>
                  <YAxis tick={{ fill:'#6b7280', fontSize:10 }} tickLine={false}
                    tickFormatter={v => fmt.compact(v)}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Bar dataKey="totalRevenue" name="Revenue" fill={JADE} radius={[4,4,0,0]}>
                    {empData.map((_: any, i: number) => (
                      <Cell key={i} fill={i === 0 ? JADE : i < 3 ? '#2ea870' : '#1a6644'}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface2">
                    {['#','Employee','Orders','Revenue','Avg Order','Share'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const total = empData.reduce((s: number, e: any) => s + e.totalRevenue, 0)
                    return empData.map((e: any, i: number) => (
                      <tr key={e.cashierId} className="border-b border-border last:border-0 hover:bg-surface2/50">
                        <td className="px-4 py-3 text-muted text-xs font-mono">{i+1}</td>
                        <td className="px-4 py-3 font-semibold">{e.cashierName}</td>
                        <td className="px-4 py-3 font-mono">{e.orderCount}</td>
                        <td className="px-4 py-3 font-mono text-jade">{fmt.compact(e.totalRevenue)}</td>
                        <td className="px-4 py-3 font-mono text-muted">{fmt.compact(e.avgOrderValue)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-surface2 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full rounded-full bg-jade"
                                style={{ width: total > 0 ? `${(e.totalRevenue/total*100).toFixed(0)}%` : '0%' }}/>
                            </div>
                            <span className="text-[10px] text-muted font-mono">
                              {total > 0 ? `${(e.totalRevenue/total*100).toFixed(1)}%` : '—'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  })()}
                  {!empData.length && (
                    <tr><td colSpan={6} className="text-center py-10 text-muted">{t.analytics.noData}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ BRANCHES TAB ══════════════════ */}
      {tab === 'branches' && isSuperAdmin && (
        <div className="space-y-4">
          <SectionTitle>Branch Performance Comparison</SectionTitle>

          {branchData.length > 0 && (
            <div className="card">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={branchData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2330"/>
                  <XAxis dataKey="branchName" tick={{ fill:'#9ca3af', fontSize:10 }} tickLine={false}/>
                  <YAxis tick={{ fill:'#6b7280', fontSize:10 }} tickLine={false}
                    tickFormatter={v => fmt.compact(v)}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Bar dataKey="revenue" name="Revenue" fill={GOLD} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface2">
                    {['#','Branch','Brand','Orders','Revenue','Share'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const total = branchData.reduce((s: number, b: any) => s + b.revenue, 0)
                    return branchData.map((b: any, i: number) => (
                      <tr key={b.branchId} className="border-b border-border last:border-0 hover:bg-surface2/50">
                        <td className="px-4 py-3 text-muted text-xs font-mono">{i+1}</td>
                        <td className="px-4 py-3 font-semibold">{b.branchName}</td>
                        <td className="px-4 py-3">
                          <span className={clsx('text-xs px-2 py-0.5 rounded',
                            b.brand === 'AVERO' ? 'bg-gold-dim text-gold' : 'bg-purple-900/20 text-purple-400')}>
                            {b.brand}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono">{b.orderCount}</td>
                        <td className="px-4 py-3 font-mono text-gold">{fmt.compact(b.revenue)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-surface2 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full rounded-full bg-gold"
                                style={{ width: total > 0 ? `${(b.revenue/total*100).toFixed(0)}%` : '0%' }}/>
                            </div>
                            <span className="text-[10px] text-muted font-mono">
                              {total > 0 ? `${(b.revenue/total*100).toFixed(1)}%` : '—'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  })()}
                  {!branchData.length && (
                    <tr><td colSpan={6} className="text-center py-10 text-muted">No data for this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ SLOW MOVERS TAB ══════════════════ */}
      {tab === 'slow' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle>Slow-Moving Stock</SectionTitle>
              <p className="text-xs text-muted mt-0.5">Items with inventory but no sales in the last 30 days</p>
            </div>
            <button onClick={() => exportCSV(
              slowData.map((s: any) => ({
                product: s.variant?.product?.name,
                sku:     s.variant?.sku,
                branch:  s.branch?.name,
                qty:     s.quantity,
              })), 'slow-movers.csv')}
              className="btn-secondary text-xs flex items-center gap-1 px-3 py-1.5">
              <Download size={11}/> CSV
            </button>
          </div>

          {slowData.length === 0 ? (
            <div className="card text-center py-12">
              <Package size={40} className="mx-auto mb-3 text-jade opacity-60"/>
              <p className="font-semibold text-jade">All clear!</p>
              <p className="text-xs text-muted mt-1">No slow-moving items in the last 30 days</p>
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="px-4 py-3 border-b border-border bg-yellow-500/5 flex items-center gap-2">
                <AlertTriangle size={13} className="text-yellow-400"/>
                <span className="text-xs text-yellow-400 font-medium">
                  {slowData.length} item{slowData.length !== 1 ? 's' : ''} not sold in 30+ days
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface2">
                      {['Product','SKU','Branch','Qty in Stock','Action'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slowData.map((s: any, i: number) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-surface2/50">
                        <td className="px-4 py-3 font-semibold">{s.variant?.product?.name ?? '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">{s.variant?.sku ?? '—'}</td>
                        <td className="px-4 py-3 text-muted">{s.branch?.name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={clsx('font-mono font-semibold',
                            s.quantity > 10 ? 'text-yellow-400' : s.quantity > 0 ? 'text-rose' : 'text-muted')}>
                            {s.quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] text-muted bg-surface2 px-2 py-0.5 rounded">
                            Consider discount
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
