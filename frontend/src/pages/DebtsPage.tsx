import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { debtsApi, customersApi, suppliersApi } from '../lib/api'
import { useState } from 'react'
import { PageHeader, Badge, EmptyState, fmt, fmtDate } from '../components/Shared'
import { Plus, X, Loader2, Search, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

type DebtDir = 'RECEIVABLE' | 'PAYABLE'
type DebtStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE'

const STATUS_COLORS: Record<string, string> = { OPEN: 'gold', PARTIAL: 'gold', PAID: 'green', OVERDUE: 'red' }

interface DebtForm {
  direction: DebtDir; customerId: string; supplierId: string; amount: string; description: string; dueDate: string
}
const empty: DebtForm = { direction: 'RECEIVABLE', customerId: '', supplierId: '', amount: '', description: '', dueDate: '' }

export default function DebtsPage() {
  const qc = useQueryClient()
  const [search,    setSearch]    = useState('')
  const [status,    setStatus]    = useState('')
  const [direction, setDirection] = useState('')
  const [page,      setPage]      = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [selected,  setSelected]  = useState<any>(null)
  const [form,      setForm]      = useState<DebtForm>(empty)
  const [payAmount, setPayAmount] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['debts', search, status, direction, page],
    queryFn:  () => debtsApi.list({
      search: search || undefined,
      status: status || undefined,
      direction: direction || undefined,
      page, limit: 25,
    }),
  })

  const { data: customers } = useQuery({
    queryKey: ['customers.all'],
    queryFn:  () => customersApi.list({ limit: 200 }),
  })
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers.all'],
    queryFn:  () => suppliersApi.list({ limit: 200 }),
  })

  const debts = data?.data ?? []
  const meta  = data?.meta ?? {}

  const createMut = useMutation({
    mutationFn: debtsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debts'] }); setShowModal(false); setForm(empty); toast.success('Debt recorded') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const payMut = useMutation({
    mutationFn: ({ id, amount }: any) => debtsApi.pay(id, { amount: Number(amount) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts'] })
      setShowPayModal(false)
      setPayAmount('')
      toast.success('Payment recorded')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const submit = () => {
    if (!form.amount) return toast.error('Amount required')
    if (form.direction === 'RECEIVABLE' && !form.customerId) return toast.error('Customer required')
    if (form.direction === 'PAYABLE'    && !form.supplierId) return toast.error('Supplier required')
    createMut.mutate({ ...form, amount: Number(form.amount) })
  }

  const f = (k: keyof DebtForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(v => ({ ...v, [k]: e.target.value }))

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Debts" subtitle="Receivables & payables"
        action={<button onClick={() => { setForm(empty); setShowModal(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-gold text-bg text-sm font-semibold rounded-lg hover:bg-gold/90"><Plus size={14} />Add Debt</button>}
      />

      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search…"
            className="bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-fg w-44 focus:outline-none focus:border-gold/60" />
        </div>
        <select value={direction} onChange={e => { setDirection(e.target.value); setPage(1) }}
          className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none">
          <option value="">All directions</option>
          <option value="RECEIVABLE">Receivable</option>
          <option value="PAYABLE">Payable</option>
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="PARTIAL">Partial</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-gold" /></div>
        ) : debts.length ? (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Party</th>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Direction</th>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Description</th>
                <th className="text-right px-4 py-3 text-xs text-muted font-medium">Amount</th>
                <th className="text-right px-4 py-3 text-xs text-muted font-medium">Paid</th>
                <th className="text-right px-4 py-3 text-xs text-muted font-medium">Remaining</th>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Due</th>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {debts.map((d: any) => {
                const party = d.customer?.name ?? d.supplier?.name ?? '—'
                const remaining = d.amount - (d.paidAmount ?? 0)
                return (
                  <tr key={d.id} className="hover:bg-surface2/30">
                    <td className="px-4 py-3 text-sm text-fg">{party}</td>
                    <td className="px-4 py-3"><Badge color={d.direction === 'RECEIVABLE' ? 'jade' : 'rose'}>{d.direction}</Badge></td>
                    <td className="px-4 py-3 text-xs text-muted max-w-[160px] truncate">{d.description ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-fg">{fmt(d.amount)}</td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-jade">{fmt(d.paidAmount ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-rose">{fmt(remaining)}</td>
                    <td className="px-4 py-3 text-xs text-muted">{d.dueDate ? fmtDate(d.dueDate) : '—'}</td>
                    <td className="px-4 py-3"><Badge color={STATUS_COLORS[d.status]}>{d.status}</Badge></td>
                    <td className="px-4 py-3">
                      {d.status !== 'PAID' && (
                        <button onClick={() => { setSelected(d); setPayAmount(String(remaining)); setShowPayModal(true) }}
                          className="text-muted hover:text-jade flex items-center gap-1 text-xs">
                          <CheckCircle size={12} /> Pay
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No debts found" />
        )}
        {meta.lastPage > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border text-sm text-muted">
            <span>Page {page} of {meta.lastPage}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p-1)} className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-surface2">Prev</button>
              <button disabled={page === meta.lastPage} onClick={() => setPage(p => p+1)} className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-surface2">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Add Debt Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-fg">Record Debt</h2>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-fg"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted mb-1">Direction</label>
                <div className="flex gap-2">
                  {(['RECEIVABLE','PAYABLE'] as DebtDir[]).map(d => (
                    <button key={d} onClick={() => setForm(v => ({ ...v, direction: d }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                        form.direction === d ? 'bg-gold text-bg' : 'bg-bg border border-border text-muted hover:text-fg'
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              {form.direction === 'RECEIVABLE' ? (
                <div>
                  <label className="block text-xs text-muted mb-1">Customer *</label>
                  <select value={form.customerId} onChange={f('customerId')}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none">
                    <option value="">— select —</option>
                    {customers?.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-muted mb-1">Supplier *</label>
                  <select value={form.supplierId} onChange={f('supplierId')}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none">
                    <option value="">— select —</option>
                    {suppliers?.data?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Amount *</label>
                  <input type="number" value={form.amount} onChange={f('amount')} min={0}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Due Date</label>
                  <input type="date" value={form.dueDate} onChange={f('dueDate')}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Description</label>
                <input value={form.description} onChange={f('description')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-muted hover:text-fg">Cancel</button>
              <button onClick={submit} disabled={createMut.isPending}
                className="flex-1 py-2 bg-gold text-bg rounded-lg text-sm font-semibold hover:bg-gold/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {createMut.isPending && <Loader2 size={14} className="animate-spin" />}
                Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayModal && selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-fg">Record Payment</h2>
              <button onClick={() => setShowPayModal(false)} className="text-muted hover:text-fg"><X size={18} /></button>
            </div>
            <div className="bg-surface2 rounded-lg p-3 mb-4 text-sm">
              <p className="text-fg">{selected.customer?.name ?? selected.supplier?.name}</p>
              <p className="text-xs text-muted mt-0.5">Remaining: <span className="text-rose font-mono">{fmt(selected.amount - (selected.paidAmount ?? 0))}</span></p>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Amount to pay</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} min={0}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPayModal(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-muted hover:text-fg">Cancel</button>
              <button onClick={() => payMut.mutate({ id: selected.id, amount: payAmount })} disabled={payMut.isPending}
                className="flex-1 py-2 bg-jade text-bg rounded-lg text-sm font-semibold hover:bg-jade/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {payMut.isPending && <Loader2 size={14} className="animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
