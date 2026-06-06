import { useQuery } from '@tanstack/react-query'
import { analyticsApi, ordersApi, branchesApi } from '../lib/api'
import { useState } from 'react'
import { PageHeader, KpiCard, EmptyState, fmt, fmtDateTime } from '../components/Shared'
import {
  TrendingUp, ShoppingBag, Users, DollarSign, Package,
  ArrowUpRight, BarChart3,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useAuthStore } from '../store/authStore'

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week',  label: 'This Week' },
  { value: 'month', label: 'This Month' },
]

export default function DashboardPage() {
  const [period, setPeriod]     = useState('today')
  const [branchId, setBranchId] = useState<string>('')
  const { user }                = useAuthStore()

  const branch = branchId || user?.branchId || undefined

  // Auto-refresh every 30 seconds so dashboard stays current after POS sales
  const REFRESH_MS = 30_000

  const { data: kpis, isLoading: kpiLoading } = useQuery({
    queryKey:       ['analytics.dashboard', period, branch],
    queryFn:        () => analyticsApi.dashboard({ period, branchId: branch }),
    refetchInterval: REFRESH_MS,
    staleTime:      0,
  })

  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

  const { data: chartData } = useQuery({
    queryKey:       ['analytics.salesChart', weekAgo, today, branch],
    queryFn:        () => analyticsApi.salesChart({ dateFrom: weekAgo, dateTo: today, groupBy: 'day', branchId: branch }),
    refetchInterval: REFRESH_MS,
    staleTime:      0,
  })

  // Show ALL recent sales (both POS and Orders module)
  const { data: recentOrders } = useQuery({
    queryKey:       ['orders.recent', branch],
    queryFn:        () => ordersApi.list({ limit: 8, page: 1, sortBy: 'createdAt', sortDir: 'desc', includeItems: 'true', branchId: branch }),
    refetchInterval: REFRESH_MS,
    staleTime:      0,
  })

  const { data: topProducts } = useQuery({
    queryKey:       ['analytics.topProducts', weekAgo, today, branch],
    queryFn:        () => analyticsApi.topProducts({ dateFrom: weekAgo, dateTo: today, limit: 5, branchId: branch }),
    refetchInterval: REFRESH_MS,
    staleTime:      0,
  })

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn:  branchesApi.list,
  })

  const revenue  = kpis?.revenue?.value ?? 0
  const orders   = kpis?.orders?.value ?? 0
  const newCust  = kpis?.newCustomers ?? 0
  const itemsSold= kpis?.itemsSold ?? 0
  const avgOrder = kpis?.avgOrder?.value ?? 0

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Dashboard"
        subtitle="Business overview"
        action={
          <div className="flex items-center gap-2">
            {branches?.length > 1 && (
              <select value={branchId} onChange={e => setBranchId(e.target.value)}
                className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-fg focus:outline-none">
                <option value="">All branches</option>
                {branches?.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <div className="flex rounded-lg border border-border overflow-hidden">
              {PERIODS.map(p => (
                <button key={p.value} onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    period === p.value ? 'bg-gold/15 text-gold' : 'text-muted hover:text-fg'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Revenue"
            value={fmt(revenue)}
            change={kpis?.revenue?.change}
            icon={DollarSign}
            accent="bg-gold/10 text-gold"
          />
          <KpiCard
            label="Items Sold"
            value={String(itemsSold)}
            change={kpis?.orders?.change}
            sub={`${orders} sale${orders !== 1 ? 's' : ''} · avg ${fmt(avgOrder)}`}
            icon={ShoppingBag}
            accent="bg-jade/10 text-jade"
          />
          <KpiCard
            label="New Customers"
            value={String(newCust)}
            icon={Users}
            accent="bg-gold/10 text-gold"
          />
          <KpiCard
            label="Avg Order"
            value={fmt(avgOrder)}
            icon={TrendingUp}
            accent="bg-jade/10 text-jade"
          />
        </div>

        {/* Chart + Top Products */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sales Chart */}
          <div className="lg:col-span-2 bg-surface rounded-xl border border-border p-4">
            <h2 className="text-sm font-semibold text-fg mb-4">Revenue (7 days)</h2>
            {chartData?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"   stopColor="#d4a85a" stopOpacity={0.3} />
                      <stop offset="95%"  stopColor="#d4a85a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6e7692' }} />
                  <YAxis tickFormatter={v => (v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 11, fill: '#6e7692' }} />
                  <Tooltip
                    contentStyle={{ background: '#141722', border: '1px solid #2e3141', borderRadius: 8 }}
                    labelStyle={{ color: '#e8e8e0', fontSize: 12 }}
                    formatter={(v: any) => [fmt(v), 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#d4a85a" fill="url(#grad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No sales data for this period" />
            )}
          </div>

          {/* Top Products */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h2 className="text-sm font-semibold text-fg mb-4 flex items-center gap-1.5">
              <BarChart3 size={14} className="text-gold" /> Top Products
            </h2>
            {topProducts?.length ? (
              <div className="space-y-3">
                {topProducts.map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="text-xs text-muted w-4 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-fg truncate">{p.name}</p>
                      <p className="text-xs text-muted">{p.total_sold} sold</p>
                    </div>
                    <span className="text-xs font-mono text-gold">{fmt(p.total_revenue)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No sales yet" />
            )}
          </div>
        </div>

        {/* Recent Sales */}
        <div className="bg-surface rounded-xl border border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-fg">Recent Sales</h2>
            <a href="/orders" className="text-xs text-gold hover:text-gold/80 flex items-center gap-1">
              View all <ArrowUpRight size={12} />
            </a>
          </div>
          <div className="divide-y divide-border">
            {recentOrders?.data?.length ? recentOrders.data.map((o: any) => {
              const items: any[] = o.items ?? []
              const summary = items.length > 0
                ? items.slice(0, 2).map((it: any) => `${it.variant?.product?.name ?? 'Item'} ×${it.quantity}`).join(', ')
                  + (items.length > 2 ? ` +${items.length - 2} more` : '')
                : `${o._count?.items ?? 0} items`
              return (
                <div key={o.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg truncate">{summary}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {o.customer?.name ?? 'Walk-in'} · {fmtDateTime(o.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-mono text-gold">{fmt(o.total)}</p>
                    <p className="text-xs text-muted">{o.cashier?.name ?? ''}</p>
                  </div>
                </div>
              )
            }) : (
              <EmptyState message="No orders yet" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
