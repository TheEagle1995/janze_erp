import { useState, useMemo } from 'react'
import { useQuery }          from '@tanstack/react-query'
import clsx                  from 'clsx'
import {
  Sparkles, TrendingUp, TrendingDown, AlertTriangle,
  Package, Users, DollarSign, Zap, RefreshCw,
  ChevronRight, Star, ShoppingBag, Clock, BarChart2,
  ArrowUpRight, ArrowDownRight, Lightbulb, Target,
} from 'lucide-react'
import { analyticsApi } from '../lib/api'
import { suppliersApi } from '../lib/api'
import { fmt }          from '../utils/format'

// ─── helpers ──────────────────────────────────────────────────────────────────
function pct(a: number, b: number) {
  if (!b) return 0
  return Math.round(((a - b) / b) * 100)
}

function scoreLabel(score: number) {
  if (score >= 80) return { label: 'Excellent', color: 'text-emerald-400' }
  if (score >= 60) return { label: 'Good',      color: 'text-jade'        }
  if (score >= 40) return { label: 'Average',   color: 'text-gold'        }
  return                   { label: 'Needs Work', color: 'text-red-400'   }
}

// ─── sub-components ───────────────────────────────────────────────────────────
function InsightCard({
  icon: Icon, title, value, sub, trend, color = 'text-gold',
}: {
  icon: any; title: string; value: string; sub?: string
  trend?: number; color?: string
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className={clsx('p-2 rounded-lg bg-surface2', color)}>
          <Icon size={16} />
        </div>
        {trend !== undefined && (
          <span className={clsx('flex items-center gap-1 text-xs font-semibold',
            trend >= 0 ? 'text-emerald-400' : 'text-red-400'
          )}>
            {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-xs text-muted mb-0.5">{title}</p>
        <p className="text-xl font-bold text-fg">{value}</p>
        {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function RecommendationCard({
  priority, title, description, action, impact,
}: {
  priority: 'high' | 'medium' | 'low'
  title: string; description: string; action: string; impact: string
}) {
  const colors = {
    high:   { dot: 'bg-red-400',     badge: 'bg-red-400/10 text-red-400',     label: 'High Priority' },
    medium: { dot: 'bg-gold',        badge: 'bg-gold/10 text-gold',           label: 'Medium' },
    low:    { dot: 'bg-emerald-400', badge: 'bg-emerald-400/10 text-emerald-400', label: 'Low' },
  }
  const c = colors[priority]
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex gap-3">
      <div className={clsx('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', c.dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-fg">{title}</p>
          <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', c.badge)}>
            {c.label}
          </span>
        </div>
        <p className="text-xs text-muted mb-2">{description}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-jade font-medium flex items-center gap-1">
            <ChevronRight size={12} />{action}
          </span>
          <span className="text-xs text-muted">Impact: {impact}</span>
        </div>
      </div>
    </div>
  )
}

function ScoreMeter({ score, label }: { score: number; label: string }) {
  const { label: sl, color } = scoreLabel(score)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={clsx('font-bold', color)}>{sl}</span>
      </div>
      <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500',
            score >= 80 ? 'bg-emerald-400' :
            score >= 60 ? 'bg-jade' :
            score >= 40 ? 'bg-gold' : 'bg-red-400'
          )}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

// ─── AI analysis engine (pure client-side pattern matching) ───────────────────
function analyzeData(dashboard: any, topProducts: any[], slowMovers: any[], byEmployee: any[], paymentMethods: any[]) {
  const recommendations: {
    priority: 'high' | 'medium' | 'low'
    title: string; description: string; action: string; impact: string
    category: string
  }[] = []

  // ── Revenue trend ──
  const revenue    = Number(dashboard?.revenue?.current ?? 0)
  const revPrev    = Number(dashboard?.revenue?.previous ?? 0)
  const revTrend   = pct(revenue, revPrev)

  if (revTrend < -10) {
    recommendations.push({
      priority: 'high',
      category: 'revenue',
      title:    'Revenue Decline Detected',
      description: `Revenue is down ${Math.abs(revTrend)}% vs last period. Consider running a promotional campaign or reviewing your pricing strategy.`,
      action:   'Launch a discount campaign',
      impact:   'High',
    })
  }

  // ── Order count ──
  const orders     = Number(dashboard?.orders?.current ?? 0)
  const ordersPrev = Number(dashboard?.orders?.previous ?? 0)
  const orderTrend = pct(orders, ordersPrev)

  if (orderTrend < -5) {
    recommendations.push({
      priority: 'medium',
      category: 'traffic',
      title:    'Order Volume Dropping',
      description: `Order count fell ${Math.abs(orderTrend)}% this period. Customer acquisition or retention may need attention.`,
      action:   'Review customer loyalty program',
      impact:   'Medium',
    })
  }

  // ── Slow movers ──
  const slowCount = slowMovers?.length ?? 0
  if (slowCount > 0) {
    recommendations.push({
      priority: slowCount > 5 ? 'high' : 'medium',
      category: 'inventory',
      title:    `${slowCount} Slow-Moving Products`,
      description: `These products have had zero sales in 30+ days. They're tying up capital. Consider bundling, discounting, or returning to supplier.`,
      action:   'Create bundle promotions',
      impact:   slowCount > 5 ? 'High' : 'Medium',
    })
  }

  // ── Top product concentration risk ──
  if (topProducts.length > 0) {
    const totalRevFromTop = topProducts.reduce((s: number, p: any) => s + Number(p.revenue ?? p.total ?? 0), 0)
    const topOne = topProducts[0]
    const topOneRev = Number(topOne?.revenue ?? topOne?.total ?? 0)
    const concentration = totalRevFromTop > 0 ? (topOneRev / totalRevFromTop) * 100 : 0
    if (concentration > 50) {
      recommendations.push({
        priority: 'medium',
        category: 'risk',
        title:    'Over-Reliance on One Product',
        description: `"${topOne?.productName ?? topOne?.name ?? 'Top product'}" drives ${Math.round(concentration)}% of your top-product revenue. Diversify to reduce risk.`,
        action:   'Expand complementary product range',
        impact:   'Medium',
      })
    }
  }

  // ── Payment method diversity ──
  if (paymentMethods?.length > 0) {
    const cashOnly = paymentMethods.find((m: any) => m.method === 'CASH')
    const total    = paymentMethods.reduce((s: number, m: any) => s + Number(m._count?.id ?? m.count ?? 0), 0)
    const cashPct  = cashOnly ? (Number(cashOnly._count?.id ?? cashOnly.count ?? 0) / total) * 100 : 0
    if (cashPct > 80) {
      recommendations.push({
        priority: 'low',
        category: 'payments',
        title:    'Low Digital Payment Adoption',
        description: `${Math.round(cashPct)}% of transactions are cash. Encourage card/transfer to reduce handling costs and improve tracking.`,
        action:   'Incentivize digital payments (small discount)',
        impact:   'Low',
      })
    }
  }

  // ── Employee performance ──
  if (byEmployee?.length > 1) {
    const totals = byEmployee.map((e: any) => Number(e.total ?? e.revenue ?? 0))
    const avg    = totals.reduce((s, v) => s + v, 0) / totals.length
    const max    = Math.max(...totals)
    const gapPct = avg > 0 ? ((max - avg) / avg) * 100 : 0
    if (gapPct > 50) {
      const top  = byEmployee.find((e: any) => Number(e.total ?? e.revenue ?? 0) === max)
      recommendations.push({
        priority: 'low',
        category: 'team',
        title:    'Large Performance Gap Between Staff',
        description: `Top performer ${top?.name ?? top?.cashierName ?? 'Staff'} sells ${Math.round(gapPct)}% above average. Consider cross-training or peer coaching.`,
        action:   'Schedule team training session',
        impact:   'Low',
      })
    }
  }

  // ── Positive: great performance ──
  if (revTrend > 15) {
    recommendations.push({
      priority: 'low',
      category: 'growth',
      title:    'Strong Revenue Growth',
      description: `Revenue is up ${revTrend}% vs last period. Great momentum — consider expanding inventory or opening new branches.`,
      action:   'Plan inventory expansion',
      impact:   'High',
    })
  }

  // ── Business health score ──
  let score = 50
  score += Math.min(20, Math.max(-20, revTrend))
  score += Math.min(10, Math.max(-10, orderTrend))
  score -= Math.min(20, slowCount * 2)
  score = Math.min(100, Math.max(0, score))

  return { recommendations, score }
}

// ─── Forecast block ────────────────────────────────────────────────────────────
function ForecastBlock({ revenue, orders }: { revenue: { current: number; previous: number }; orders: { current: number; previous: number } }) {
  const revGrowth   = revenue.previous > 0 ? (revenue.current - revenue.previous) / revenue.previous : 0
  const ordGrowth   = orders.previous > 0  ? (orders.current  - orders.previous)  / orders.previous  : 0
  const forecastRev = Math.round(revenue.current * (1 + revGrowth))
  const forecastOrd = Math.round(orders.current  * (1 + ordGrowth))

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target size={16} className="text-gold" />
        <h3 className="font-semibold text-fg text-sm">Next Period Forecast</h3>
        <span className="text-[10px] text-muted bg-surface2 px-2 py-0.5 rounded-full">Based on trend</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted mb-1">Projected Revenue</p>
          <p className="text-2xl font-bold text-fg">{fmt.currency(forecastRev)}</p>
          <p className={clsx('text-xs mt-0.5 flex items-center gap-1', revGrowth >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {revGrowth >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {revGrowth >= 0 ? '+' : ''}{Math.round(revGrowth * 100)}% vs this period
          </p>
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Projected Orders</p>
          <p className="text-2xl font-bold text-fg">{forecastOrd.toLocaleString()}</p>
          <p className={clsx('text-xs mt-0.5 flex items-center gap-1', ordGrowth >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {ordGrowth >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {ordGrowth >= 0 ? '+' : ''}{Math.round(ordGrowth * 100)}% vs this period
          </p>
        </div>
      </div>
      <p className="text-[10px] text-muted mt-3">
        * Forecast uses simple linear extrapolation of current vs previous period trend.
      </p>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function AIInsightsPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month')

  const params = useMemo(() => {
    const now   = new Date()
    const end   = now.toISOString().split('T')[0]
    let start   = new Date(now)
    if (period === 'week')    start.setDate(now.getDate() - 7)
    if (period === 'month')   start.setMonth(now.getMonth() - 1)
    if (period === 'quarter') start.setMonth(now.getMonth() - 3)
    return { startDate: start.toISOString().split('T')[0], endDate: end }
  }, [period])

  const { data: dashboard,  isLoading: l1, refetch: r1 } = useQuery({ queryKey: ['ai-dashboard',  params], queryFn: () => analyticsApi.dashboard(params)  })
  const { data: topProds,   isLoading: l2, refetch: r2 } = useQuery({ queryKey: ['ai-topProds',   params], queryFn: () => analyticsApi.topProducts(params) })
  const { data: slowMovers, isLoading: l3, refetch: r3 } = useQuery({ queryKey: ['ai-slow',       params], queryFn: () => analyticsApi.slowMovers(params)  })
  const { data: byEmployee, isLoading: l4, refetch: r4 } = useQuery({ queryKey: ['ai-byEmp',      params], queryFn: () => analyticsApi.byEmployee(params)  })
  const { data: payMethods, isLoading: l5, refetch: r5 } = useQuery({ queryKey: ['ai-payMeth',    params], queryFn: () => analyticsApi.paymentMethods(params)})
  const { data: supplierInsights }                        = useQuery({ queryKey: ['ai-supInsights'],        queryFn: () => suppliersApi.insights()           })

  const loading = l1 || l2 || l3 || l4 || l5

  const refetchAll = () => { r1(); r2(); r3(); r4(); r5() }

  const topProducts   = Array.isArray(topProds)   ? topProds   : (topProds?.data   ?? [])
  const slowMoverList = Array.isArray(slowMovers)  ? slowMovers : (slowMovers?.data ?? [])
  const empList       = Array.isArray(byEmployee)  ? byEmployee : (byEmployee?.data ?? [])
  const payList       = Array.isArray(payMethods)  ? payMethods : (payMethods?.data ?? [])

  const rev    = { current: Number(dashboard?.revenue?.current ?? 0), previous: Number(dashboard?.revenue?.previous ?? 0) }
  const orders = { current: Number(dashboard?.orders?.current  ?? 0), previous: Number(dashboard?.orders?.previous  ?? 0) }
  const revTrend = pct(rev.current, rev.previous)
  const ordTrend = pct(orders.current, orders.previous)

  const { recommendations, score } = useMemo(
    () => analyzeData(dashboard, topProducts, slowMoverList, empList, payList),
    [dashboard, topProducts, slowMoverList, empList, payList]
  )

  const trending = supplierInsights?.trending ?? []

  // Group recommendations by priority
  const highRecs   = recommendations.filter(r => r.priority === 'high')
  const otherRecs  = recommendations.filter(r => r.priority !== 'high')

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gold/10 text-gold">
            <Sparkles size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-fg">AI Insights</h1>
            <p className="text-sm text-muted">Smart analysis of your business patterns</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex bg-surface border border-border rounded-lg overflow-hidden text-sm">
            {(['week', 'month', 'quarter'] as const).map(p => (
              <button key={p}
                onClick={() => setPeriod(p)}
                className={clsx('px-3 py-1.5 font-medium transition-colors capitalize',
                  period === p ? 'bg-gold text-black' : 'text-muted hover:text-fg'
                )}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={refetchAll}
            className="p-2 rounded-lg border border-border hover:bg-surface2 text-muted hover:text-fg transition-colors">
            <RefreshCw size={14} className={clsx(loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3 text-muted">
            <Sparkles size={32} className="animate-pulse text-gold" />
            <p className="text-sm">Analyzing your business data…</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InsightCard
              icon={DollarSign} title="Revenue" color="text-gold"
              value={fmt.currency(rev.current)}
              sub={`vs ${fmt.currency(rev.previous)} prev`}
              trend={revTrend}
            />
            <InsightCard
              icon={ShoppingBag} title="Orders" color="text-jade"
              value={orders.current.toLocaleString()}
              sub={`vs ${orders.previous.toLocaleString()} prev`}
              trend={ordTrend}
            />
            <InsightCard
              icon={Package} title="Slow Movers" color="text-amber-400"
              value={slowMoverList.length.toString()}
              sub="products with 0 sales"
            />
            <InsightCard
              icon={TrendingUp} title="Top Products" color="text-emerald-400"
              value={topProducts.length.toString()}
              sub="tracked this period"
            />
          </div>

          {/* Health score + Forecast */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Business health */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={16} className="text-gold" />
                <h3 className="font-semibold text-fg text-sm">Business Health Score</h3>
              </div>

              {/* Big score */}
              <div className="flex items-end gap-3 mb-5">
                <span className="text-5xl font-extrabold text-fg">{score}</span>
                <div className="pb-1">
                  <span className={clsx('text-lg font-bold', scoreLabel(score).color)}>
                    / 100 — {scoreLabel(score).label}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <ScoreMeter score={Math.min(100, Math.max(0, 50 + revTrend))} label="Revenue momentum" />
                <ScoreMeter score={Math.min(100, Math.max(0, 50 + ordTrend))} label="Order volume" />
                <ScoreMeter score={Math.max(0, 100 - slowMoverList.length * 5)} label="Inventory efficiency" />
                <ScoreMeter score={topProducts.length > 0 ? 75 : 30} label="Product performance data" />
              </div>
            </div>

            {/* Forecast */}
            <ForecastBlock revenue={rev} orders={orders} />
          </div>

          {/* Recommendations */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={16} className="text-gold" />
              <h2 className="font-semibold text-fg">AI Recommendations</h2>
              <span className="text-xs bg-gold/10 text-gold px-2 py-0.5 rounded-full font-medium">
                {recommendations.length} insights
              </span>
            </div>

            {recommendations.length === 0 ? (
              <div className="bg-surface border border-border rounded-xl p-8 text-center">
                <Star size={32} className="text-gold mx-auto mb-2" />
                <p className="text-fg font-semibold">Everything looks great!</p>
                <p className="text-sm text-muted mt-1">No critical issues detected this period.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {highRecs.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle size={11} /> Urgent
                    </p>
                    {highRecs.map((r, i) => <RecommendationCard key={i} {...r} />)}
                  </>
                )}
                {otherRecs.length > 0 && (
                  <>
                    {highRecs.length > 0 && (
                      <p className="text-xs font-semibold text-muted uppercase tracking-wider pt-1">
                        Other suggestions
                      </p>
                    )}
                    {otherRecs.map((r, i) => <RecommendationCard key={i} {...r} />)}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Two-column bottom section */}
          <div className="grid md:grid-cols-2 gap-4">

            {/* Top Products */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-emerald-400" />
                <h3 className="font-semibold text-fg text-sm">Top Performing Products</h3>
              </div>
              {topProducts.length === 0 ? (
                <p className="text-sm text-muted">No sales data for this period.</p>
              ) : (
                <div className="space-y-2.5">
                  {topProducts.slice(0, 6).map((p: any, i: number) => {
                    const rev  = Number(p.revenue ?? p.total ?? 0)
                    const qty  = Number(p.quantity ?? p.qty ?? 0)
                    const maxRev = Number(topProducts[0]?.revenue ?? topProducts[0]?.total ?? 1)
                    const barW = maxRev > 0 ? (rev / maxRev) * 100 : 0
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-fg font-medium truncate max-w-[60%]">
                            {i + 1}. {p.productName ?? p.name ?? 'Product'}
                          </span>
                          <span className="text-muted">{fmt.currency(rev)} · {qty} units</span>
                        </div>
                        <div className="h-1 bg-surface2 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400/70 rounded-full" style={{ width: `${barW}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Slow movers */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown size={16} className="text-red-400" />
                <h3 className="font-semibold text-fg text-sm">Slow-Moving Items</h3>
                {slowMoverList.length > 0 && (
                  <span className="text-[10px] bg-red-400/10 text-red-400 px-2 py-0.5 rounded-full font-semibold">
                    {slowMoverList.length} items
                  </span>
                )}
              </div>
              {slowMoverList.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <Star size={14} />
                  <span>No slow movers — all products are selling!</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {slowMoverList.slice(0, 8).map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <div>
                        <p className="text-xs font-medium text-fg">{p.name ?? p.productName ?? 'Product'}</p>
                        <p className="text-[10px] text-muted">{p.brand ?? p.category ?? ''}</p>
                      </div>
                      <span className="text-[10px] bg-red-400/10 text-red-400 px-2 py-0.5 rounded-full">0 sales</span>
                    </div>
                  ))}
                  {slowMoverList.length > 8 && (
                    <p className="text-xs text-muted text-center pt-1">+{slowMoverList.length - 8} more</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Trending from supplier insights */}
          {trending.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={16} className="text-gold" />
                <h3 className="font-semibold text-fg text-sm">Trending Products (Last 30 Days)</h3>
                <span className="text-[10px] text-muted bg-surface2 px-2 py-0.5 rounded-full">From inventory data</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {trending.slice(0, 10).map((p: any, i: number) => (
                  <div key={i} className="bg-surface2 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-gold mb-0.5">#{i + 1}</div>
                    <p className="text-xs font-medium text-fg leading-tight truncate">{p.productName ?? p.name ?? 'Product'}</p>
                    <p className="text-[10px] text-muted mt-1">{p.totalSold ?? p.qty ?? 0} sold</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Employee performance */}
          {empList.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users size={16} className="text-jade" />
                <h3 className="font-semibold text-fg text-sm">Staff Performance</h3>
              </div>
              <div className="space-y-2.5">
                {empList.slice(0, 6).map((e: any, i: number) => {
                  const empRev  = Number(e.total ?? e.revenue ?? 0)
                  const empOrd  = Number(e.orders ?? e.orderCount ?? 0)
                  const maxEmpRev = Number(empList[0]?.total ?? empList[0]?.revenue ?? 1)
                  const barW    = maxEmpRev > 0 ? (empRev / maxEmpRev) * 100 : 0
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-jade/20 text-jade flex items-center justify-center text-[10px] font-bold">
                            {i + 1}
                          </span>
                          <span className="text-fg font-medium">{e.name ?? e.cashierName ?? 'Staff'}</span>
                        </div>
                        <span className="text-muted">{fmt.currency(empRev)} · {empOrd} orders</span>
                      </div>
                      <div className="h-1 bg-surface2 rounded-full overflow-hidden ml-7">
                        <div className="h-full bg-jade/60 rounded-full transition-all duration-500" style={{ width: `${barW}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Payment methods */}
          {payList.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={16} className="text-muted" />
                <h3 className="font-semibold text-fg text-sm">Payment Method Breakdown</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {payList.map((m: any, i: number) => {
                  const count = Number(m._count?.id ?? m.count ?? 0)
                  const total = payList.reduce((s: number, x: any) => s + Number(x._count?.id ?? x.count ?? 0), 0)
                  const share = total > 0 ? Math.round((count / total) * 100) : 0
                  const colors = ['bg-gold/20 text-gold', 'bg-jade/20 text-jade', 'bg-blue-400/20 text-blue-400', 'bg-purple-400/20 text-purple-400']
                  return (
                    <div key={i} className={clsx('flex flex-col items-center rounded-xl p-4 min-w-[100px]', colors[i % colors.length])}>
                      <span className="text-2xl font-extrabold">{share}%</span>
                      <span className="text-xs font-semibold mt-0.5">{m.method}</span>
                      <span className="text-[10px] opacity-70 mt-0.5">{count} txns</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
