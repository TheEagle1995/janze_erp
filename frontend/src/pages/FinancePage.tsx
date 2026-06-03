import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { financeApi, branchesApi } from '../lib/api'
import { useState } from 'react'
import { PageHeader, Badge, EmptyState, fmt, fmtDate } from '../components/Shared'
import { Plus, X, Loader2, Search } from 'lucide-react'
import toast from 'react-hot-toast'

const EXP_CATS = ['RENT','UTILITIES','SALARY','SUPPLIES','MAINTENANCE','MARKETING','TRANSPORT','OTHER']
type Tab = 'expenses' | 'accounts' | 'pl'

interface ExpForm {
  title: string; amount: string; category: string; branchId: string; note: string; date: string
}
const emptyExp: ExpForm = {
  title: '', amount: '', category: 'OTHER', branchId: '', note: '',
  date: new Date().toISOString().slice(0,10),
}

export default function FinancePage() {
  const qc = useQueryClient()
  const [tab,       setTab]      = useState<Tab>('expenses')
  const [page,      setPage]     = useState(1)
  const [search,    setSearch]   = useState('')
  const [branchId,  setBranch]   = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form,      setForm]     = useState<ExpForm>(emptyExp)

  const today    = new Date().toISOString().slice(0,10)
  const monthAgo = new Date(Date.now() - 30*86400000).toISOString().slice(0,10)
  const [dateFrom, setDateFrom] = useState(monthAgo)
  const [dateTo,   setDateTo]   = useState(today)

  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list })

  const { data: expenses, isLoading: expLoading } = useQuery({
    queryKey: ['finance.expenses', search, branchId, dateFrom, dateTo, page],
    queryFn:  () => financeApi.listExpenses({
      search: search || undefined,
      branchId: branchId || undefined,
      dateFrom, dateTo, page, limit: 25,
    }),
    enabled: tab === 'expenses',
  })

  const { data: accounts } = useQuery({
    queryKey: ['finance.accounts'],
    queryFn:  financeApi.listAccounts,
    enabled: tab === 'accounts',
  })

  const { data: plData } = useQuery({
    queryKey: ['finance.pl', dateFrom, dateTo, branchId],
    queryFn:  () => financeApi.pl({ dateFrom, dateTo, branchId: branchId || undefined }),
    enabled: tab === 'pl',
  })

  const createMut = useMutation({
    mutationFn: financeApi.createExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance.expenses'] })
      setShowModal(false)
      setForm(emptyExp)
      toast.success('Expense recorded')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => financeApi.deleteExpense(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['finance.expenses'] }); toast.success('Expense deleted') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const f = (k: keyof ExpForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(v => ({ ...v, [k]: e.target.value }))

  const submit = () => {
    if (!form.title.trim()) return toast.error('Title required')
    if (!form.amount || isNaN(Number(form.amount))) return toast.error('Valid amount required')
    createMut.mutate({ ...form, amount: Number(form.amount) })
  }

  const expItems = expenses?.data ?? []
  const expMeta  = expenses?.meta ?? {}

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Finance" subtitle="Expenses & P&L"
        action={tab === 'expenses'
          ? <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gold text-bg text-sm font-semibold rounded-lg hover:bg-gold/90"><Plus size={14} />Add Expense</button>
          : undefined}
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-3 border-b border-border">
        {(['expenses','accounts','pl'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-gold text-gold' : 'border-transparent text-muted hover:text-fg'
            }`}>
            {t === 'pl' ? 'P&L' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Date + Branch filter */}
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
        {tab === 'expenses' && (
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search expenses…"
              className="bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-fg w-44 focus:outline-none focus:border-gold/60" />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">

        {/* Expenses Tab */}
        {tab === 'expenses' && (
          <div>
            {expLoading ? (
              <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-gold" /></div>
            ) : expItems.length ? (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-bg border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium">Title</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium">Category</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium">Branch</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium">Date</th>
                    <th className="text-right px-4 py-3 text-xs text-muted font-medium">Amount</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {expItems.map((e: any) => (
                    <tr key={e.id} className="hover:bg-surface/50">
                      <td className="px-4 py-3 text-sm text-fg">{e.title}</td>
                      <td className="px-4 py-3"><Badge color="muted">{e.category}</Badge></td>
                      <td className="px-4 py-3 text-xs text-muted">{e.branch?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted">{fmtDate(e.date ?? e.createdAt)}</td>
                      <td className="px-4 py-3 text-right font-mono text-rose">{fmt(e.amount)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteMut.mutate(e.id)}
                          className="text-xs text-muted hover:text-rose">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState message="No expenses found" />
            )}
            {expMeta.lastPage > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-muted mt-4">
                <span>Page {page} of {expMeta.lastPage}</span>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage(p => p-1)} className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-surface2">Prev</button>
                  <button disabled={page === expMeta.lastPage} onClick={() => setPage(p => p+1)} className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-surface2">Next</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Accounts Tab */}
        {tab === 'accounts' && (
          <div className="space-y-3">
            {accounts?.length ? accounts.map((a: any) => (
              <div key={a.id} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-fg">{a.name}</p>
                  <p className="text-xs text-muted mt-0.5">{a.type} · {a.currency ?? 'UZS'}</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-mono font-semibold ${a.balance >= 0 ? 'text-jade' : 'text-rose'}`}>{fmt(a.balance)}</p>
                  <Badge color={a.isActive ? 'green' : 'muted'}>{a.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            )) : <EmptyState message="No accounts configured" />}
          </div>
        )}

        {/* P&L Tab */}
        {tab === 'pl' && plData && (
          <div className="max-w-lg space-y-4">
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-fg">Profit & Loss</h3>
                <p className="text-xs text-muted">{dateFrom} → {dateTo}</p>
              </div>
              <div className="divide-y divide-border">
                {[
                  { label: 'Revenue',          value: plData.revenue,     color: 'text-fg' },
                  { label: 'Cost of Goods',    value: -plData.cogs,       color: 'text-rose', negative: true },
                  { label: 'Gross Profit',     value: plData.grossProfit, color: plData.grossProfit >= 0 ? 'text-jade' : 'text-rose', bold: true },
                  { label: 'Operating Expenses', value: -plData.expenses, color: 'text-rose', negative: true },
                  { label: 'Net Profit',       value: plData.netProfit,   color: plData.netProfit >= 0 ? 'text-jade' : 'text-rose', bold: true },
                ].map(({ label, value, color, bold, negative }) => (
                  <div key={label} className={`flex justify-between px-4 py-3 ${bold ? 'bg-surface2/40' : ''}`}>
                    <span className={`text-sm ${bold ? 'font-semibold text-fg' : 'text-muted'}`}>{label}</span>
                    <span className={`text-sm font-mono ${color} ${bold ? 'font-bold' : ''}`}>
                      {negative && value < 0 ? '-' : ''}{fmt(Math.abs(value ?? 0))}
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-border bg-surface2/20">
                <div className="flex justify-between">
                  <span className="text-xs text-muted">Gross Margin</span>
                  <span className="text-xs font-mono text-fg">{plData.grossMarginPct?.toFixed(1) ?? 0}%</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-muted">Net Margin</span>
                  <span className={`text-xs font-mono ${(plData.netMarginPct ?? 0) >= 0 ? 'text-jade' : 'text-rose'}`}>{plData.netMarginPct?.toFixed(1) ?? 0}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === 'pl' && !plData && (
          <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-gold" /></div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-fg">Record Expense</h2>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-fg"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted mb-1">Title *</label>
                <input value={form.title} onChange={f('title')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Amount *</label>
                  <input type="number" value={form.amount} onChange={f('amount')} min={0}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Date</label>
                  <input type="date" value={form.date} onChange={f('date')}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Category</label>
                <select value={form.category} onChange={f('category')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none">
                  {EXP_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {branches?.length > 1 && (
                <div>
                  <label className="block text-xs text-muted mb-1">Branch</label>
                  <select value={form.branchId} onChange={f('branchId')}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none">
                    <option value="">— select —</option>
                    {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-muted mb-1">Note</label>
                <input value={form.note} onChange={f('note')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-muted hover:text-fg">Cancel</button>
              <button onClick={submit} disabled={createMut.isPending}
                className="flex-1 py-2 bg-gold text-bg rounded-lg text-sm font-semibold hover:bg-gold/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {createMut.isPending && <Loader2 size={14} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
