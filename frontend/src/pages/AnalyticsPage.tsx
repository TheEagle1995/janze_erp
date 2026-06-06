import { useQuery } from '@tanstack/react-query'
import { analyticsApi, branchesApi } from '../lib/api'
import { useState } from 'react'
import { PageHeader, fmt } from '../components/Shared'
import { TrendingUp, DollarSign, ShoppingBag, BarChart3, Loader2 } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'

const COLORS = ['#d4a85a', '#56c4a8', '#e05c6a', '#7c85b3', '#a8d4a8']

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <h2 className="text-sm font-semibold text-fg mb-4">{title}</h2>
      {children}
    </div>
  )
}

export default function AnalyticsPage() {
  const today   = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const weekAgo  = new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10)

  const [dateFrom, setDateFrom] = useState(monthAgo)
  const [dateTo,   setDateTo]   = useState(today)
  const [branchId, setBranch]   = useState('')

  const params = { dateFrom, dateTo, branchId: branchId || undefined }

  const { data: salesChart, isLoading: chartLoading } = useQuery({
    queryKey: ['analytics.salesChart', dateFrom, dateTo, branchId],
    queryFn:  () => analyticsApi.salesChart({ ...params, groupBy: 'day' }),
  })

  const { data: topProducts } = useQuery({
    queryKey: ['analytics.topProducts', dateFrom, dateTo, branchId],
    queryFn:  () => analyticsApi.topProducts({ ...params, limit: 10 }),
  })

  const { data: payMethods } = useQuery({
    queryKey: ['analytics.paymentMethods', dateFrom, dateTo, branchId],
    queryFn:  () => analyticsApi.paymentMethods(params),
  })

  const { data: byBranch } = useQuery({
    queryKey: ['analytics.byBranch', dateFrom, dateTo],
    queryFn:  () => analyticsApi.byBranch({ dateFrom, dateTo }),
  })

  const { data: byEmployee } = useQuery({
    queryKey: ['analytics.byEmployee', dateFrom, dateTo, branchId],
    queryFn:  () => analyticsApi.byEmployee({ ...params, limit: 8 }),
  })

  const { data: slowMovers } = useQuery({
    queryKey: ['analytics.slowMovers', branchId],
    queryFn:  () => analyticsApi.slowMovers({ branchId: branchId || undefined, limit: 10 }),
  })

  const { data: plData } = useQuery({
    queryKey: ['analytics.pl', dateFrom, dateTo, branchId],
    queryFn:  () => analyticsApi.pl(params),
  })

  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list })

  const revenue  = salesChart?.reduce((s: number, d: any) => s + (d.revenue ?? 0), 0) ?? 0
  const orders   = salesChart?.reduce((s: number, d: any) => s + (d.orders  ?? 0), 0) ?? 0
  const profit   = plData?.grossProfit ?? 0

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Analytics" subtitle="Business insights" />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border">
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none" />
        <span className="text-muted text-sm">→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none" />
        {branches?.length > 1 && (
          <select value={branchId} onChange={e => setBranch(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none">
            <option value="">All branches</option>
            {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Revenue',  value: fmt(revenue),        icon: DollarSign,  c: 'text-gold' },
            { label: 'Total Orders',   value: String(orders),      icon: ShoppingBag, c: 'text-jade' },
            { label: 'Gross Profit',   value: fmt(profit),         icon: TrendingUp,  c: 'text-gold' },
          ].map(({ label, value, icon: Icon, c }) => (
            <div key={label} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
              <div className={`p-2 rounded-lg bg-surface2 ${c}`}><Icon size={18} /></div>
              <div>
                <p className="text-xs text-muted">{label}</p>
                <p className={`text-lg font-mono font-semibold ${c}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Sales Chart */}
        <Section title="Revenue Over Time">
          {chartLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={24} className="animate-spin text-gold" />
            </div>
          ) : salesChart?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={salesChart}>
                <defs>
                  <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#d4a85a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#d4a85a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6e7692' }} />
                <YAxis tickFormatter={(v: number) => (v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 11, fill: '#6e7692' }} />
                <Tooltip
                  contentStyle={{ background: '#141722', border: '1px solid #2e3141', borderRadius: 8 }}
                  labelStyle={{ color: '#e8e8e0', fontSize: 12 }}
                  formatter={(v: any) => [fmt(v), 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#d4a85a" fill="url(#grad2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-sm text-muted py-8">No data for selected period</p>
          )}
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Products */}
          <Section title="Top Products by Revenue">
            {topProducts?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topProducts.slice(0, 8)} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => (v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 10, fill: '#6e7692' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6e7692' }} width={90} />
                  <Tooltip
                    contentStyle={{ background: '#141722', border: '1px solid #2e3141', borderRadius: 8 }}
                    formatter={(v: any) => [fmt(v), 'Revenue']}
                  />
                  <Bar dataKey="total_revenue" fill="#d4a85a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted text-center py-8">No data</p>}
          </Section>

          {/* Payment Methods */}
          <Section title="Payment Methods">
            {payMethods?.length ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={payMethods} dataKey="total" nameKey="method" cx="50%" cy="50%" outerRadius={65} strokeWidth={0}>
                      {payMethods.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#141722', border: '1px solid #2e3141', borderRadius: 8 }}
                      formatter={(v: any) => [fmt(v), 'Revenue']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {payMethods.map((m: any, i: number) => (
                    <div key={m.method} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-muted flex-1">{m.method}</span>
                      <span className="text-xs font-mono text-fg">{fmt(m.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="text-sm text-muted text-center py-8">No data</p>}
          </Section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* By Branch */}
          {byBranch?.length > 0 && (
            <Section title="Revenue by Branch">
              <div className="space-y-2">
                {byBranch.map((b: any) => {
                  const pct = byBranch[0]?.revenue > 0 ? Math.round(b.revenue / byBranch[0].revenue * 100) : 0
                  return (
                    <div key={b.branchId}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-fg">{b.branchName}</span>
                        <span className="font-mono text-gold">{fmt(b.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-surface2 rounded-full">
                        <div className="h-full bg-gold rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* By Employee */}
          <Section title="Sales by Employee">
            {byEmployee?.length ? (
              <div className="space-y-2">
                {byEmployee.map((e: any, i: number) => (
                  <div key={e.cashierId} className="flex items-center gap-3">
                    <span className="text-xs text-muted w-4 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-fg truncate">{e.cashierName}</p>
                      <p className="text-xs text-muted">{e.orders} orders</p>
                    </div>
                    <span className="text-xs font-mono text-gold">{fmt(e.revenue)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted text-center py-8">No data</p>}
          </Section>
        </div>

        {/* P&L Summary */}
        {plData && (
          <Section title="Profit & Loss Summary">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Revenue',      value: plData.revenue,      color: 'text-gold' },
                { label: 'COGS',         value: plData.cogs,         color: 'text-rose' },
                { label: 'Gross Profit', value: plData.grossProfit,  color: 'text-jade' },
                { label: 'Expenses',     value: plData.expenses,     color: 'text-rose' },
                { label: 'Net Profit',   value: plData.netProfit,    color: plData.netProfit >= 0 ? 'text-jade' : 'text-rose' },
                { label: 'Margin %',     value: `${plData.marginPct?.toFixed(1) ?? 0}%`, color: 'text-muted' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-surface2 rounded-lg p-3">
                  <p className="text-xs text-muted">{label}</p>
                  <p className={`text-sm font-mono font-semibold ${color}`}>
                    {typeof value === 'string' ? value : fmt(value ?? 0)}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Slow Movers */}
        {slowMovers?.length > 0 && (
          <Section title="Slow Moving Items (30+ days no sale)">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs text-muted font-medium">Product</th>
                    <th className="text-left py-2 px-3 text-xs text-muted font-medium">SKU</th>
                    <th className="text-right py-2 px-3 text-xs text-muted font-medium">Stock</th>
                    <th className="text-right py-2 px-3 text-xs text-muted font-medium">Last Sold</th>
                    <th className="text-right py-2 px-3 text-xs text-muted font-medium">Stock Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {slowMovers.map((item: any) => (
                    <tr key={item.variantId}>
                      <td className="py-2 px-3 text-xs text-fg">{item.productName}</td>
                      <td className="py-2 px-3 text-xs text-muted font-mono">{item.sku}</td>
                      <td className="py-2 px-3 text-xs text-right text-fg">{item.stock}</td>
                      <td className="py-2 px-3 text-xs text-right text-muted">
                        {item.lastSoldAt ? new Date(item.lastSoldAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-2 px-3 text-xs text-right font-mono text-rose">{fmt(item.stockValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
