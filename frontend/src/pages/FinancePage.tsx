import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../api/finance'
import { useAuthStore } from '../stores/authStore'
import { fmt }          from '../utils/format'
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import dayjs from 'dayjs'
import clsx from 'clsx'

const TABS = ['P&L', 'Cash Flow', 'Expenses', 'Journals'] as const
type Tab = typeof TABS[number]

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>('P&L')
  const branchId = useAuthStore(s => s.user?.branchId)
  const dateFrom = dayjs().startOf('month').format('YYYY-MM-DD')
  const dateTo   = dayjs().format('YYYY-MM-DD')

  const { data: pl }     = useQuery({ queryKey: ['pl', branchId, dateFrom],      queryFn: () => financeApi.profitLoss({ branchId, dateFrom, dateTo }), enabled: tab === 'P&L' })
  const { data: trend }  = useQuery({ queryKey: ['pl-trend', branchId],           queryFn: () => financeApi.plTrend({ branchId }), enabled: tab === 'P&L' })
  const { data: cf }     = useQuery({ queryKey: ['cashflow', branchId, dateFrom], queryFn: () => financeApi.cashFlow({ branchId, dateFrom, dateTo }), enabled: tab === 'Cash Flow' })
  const { data: expenses }= useQuery({ queryKey: ['expenses', branchId],          queryFn: () => financeApi.listExpenses({ branchId, limit: 20 }), enabled: tab === 'Expenses' })
  const { data: journals }= useQuery({ queryKey: ['journals', branchId],          queryFn: () => financeApi.journals({ branchId, limit: 20 }), enabled: tab === 'Journals' })

  const expList  = (expenses as any)?.data ?? []
  const jourList = (journals as any)?.data ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Finance</h1>

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface2 border border-border rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === t ? 'bg-gold text-bg' : 'text-muted hover:text-white'
            )}>{t}
          </button>
        ))}
      </div>

      {/* P&L Tab */}
      {tab === 'P&L' && pl && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Net Revenue',     value: (pl as any).netRevenue,     color: 'text-white' },
              { label: 'Gross Profit',    value: (pl as any).grossProfit,    color: 'text-jade' },
              { label: 'Operating Costs', value: (pl as any).operatingExpenses, color: 'text-rose' },
              { label: 'Net Profit',      value: (pl as any).netProfit,      color: (pl as any).netProfit >= 0 ? 'text-jade' : 'text-rose' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card">
                <div className="text-xs text-muted mb-1">{label}</div>
                <div className={clsx('text-lg font-bold font-mono', color)}>{fmt.compact(value ?? 0)}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-semibold mb-1">Gross Margin</h3>
              <div className="text-3xl font-bold text-gold">{((pl as any).grossMarginPct ?? 0).toFixed(1)}%</div>
              <div className="mt-2 bg-surface2 rounded-full h-2"><div className="h-full bg-gold rounded-full" style={{ width: `${(pl as any).grossMarginPct}%` }} /></div>
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Monthly Trend</h3>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={(trend as any[]) ?? []}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c8912a" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#c8912a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2330" />
                  <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: '#161921', border: '1px solid #1f2330', borderRadius: 8 }} formatter={(v: any) => [fmt.compact(v), 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="#c8912a" strokeWidth={2} fill="url(#g)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Cash Flow Tab */}
      {tab === 'Cash Flow' && cf && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Inflow',  value: (cf as any).inflow,    color: 'text-jade' },
            { label: 'Total Outflow', value: (cf as any).outflow,   color: 'text-rose' },
            { label: 'Net Change',    value: (cf as any).netChange, color: (cf as any).netChange >= 0 ? 'text-jade' : 'text-rose' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card">
              <div className="text-xs text-muted mb-1">{label}</div>
              <div className={clsx('text-2xl font-bold font-mono', color)}>{fmt.compact(value ?? 0)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Expenses Tab */}
      {tab === 'Expenses' && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface2">
                {['#', 'Description', 'Category', 'Amount', 'Date', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expList.map((e: any) => (
                <tr key={e.id} className="border-b border-border hover:bg-surface2/50">
                  <td className="px-4 py-3 font-mono text-xs text-muted">{e.expenseNumber}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate">{e.description}</td>
                  <td className="px-4 py-3 text-muted">{e.category}</td>
                  <td className="px-4 py-3 font-mono">{fmt.compact(e.amount ?? 0)}</td>
                  <td className="px-4 py-3 text-muted text-xs">{fmt.date(e.expenseDate)}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-xs font-semibold', ({ PAID: 'text-jade', PENDING: 'text-amber-400', REJECTED: 'text-rose' } as Record<string, string>)[e.status] ?? 'text-muted')}>{e.status}</span>
                  </td>
                </tr>
              ))}
              {!expList.length && <tr><td colSpan={6} className="text-center py-8 text-muted">No expenses</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Journals Tab */}
      {tab === 'Journals' && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface2">
                {['Entry#', 'Date', 'Description', 'Source', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jourList.map((j: any) => (
                <tr key={j.id} className="border-b border-border hover:bg-surface2/50">
                  <td className="px-4 py-3 font-mono text-xs">{j.entryNumber}</td>
                  <td className="px-4 py-3 text-xs text-muted">{fmt.date(j.date)}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate">{j.description}</td>
                  <td className="px-4 py-3 text-xs text-muted">{j.source}</td>
                  <td className="px-4 py-3"><span className={clsx('text-xs font-semibold', ({ POSTED: 'text-jade', DRAFT: 'text-amber-400', VOIDED: 'text-muted' } as Record<string, string>)[j.status] ?? 'text-muted')}>{j.status}</span></td>
                </tr>
              ))}
              {!jourList.length && <tr><td colSpan={5} className="text-center py-8 text-muted">No journal entries</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
