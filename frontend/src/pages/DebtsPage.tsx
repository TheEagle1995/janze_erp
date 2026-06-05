import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { debtsApi } from '../lib/api'
import { fmt }      from '../utils/format'
import { useT }     from '../i18n'
import toast        from 'react-hot-toast'
import clsx         from 'clsx'
import dayjs        from 'dayjs'
import {
  Plus, X, Pencil, Trash2, CreditCard, Clock,
  CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Search,
  DollarSign, TrendingDown, ReceiptText,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  PAID:    'text-jade bg-jade/10 border-jade/20',
  UNPAID:  'text-rose bg-rose/10 border-rose/20',
  PARTIAL: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  OVERDUE: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
}

function statusBadge(s: string, label: string) {
  return (
    <span className={clsx('text-xs px-2 py-0.5 rounded border font-medium', STATUS_COLORS[s] ?? 'text-muted border-border')}>
      {label}
    </span>
  )
}

// ── Debt Modal ─────────────────────────────────────────────────────────────────
function DebtModal({ debt, onClose }: { debt: any | null; onClose: () => void }) {
  const qc     = useQueryClient()
  const t      = useT()
  const isEdit = !!debt

  const [form, setForm] = useState({
    customerName: debt?.customerName ?? '',
    phone:        debt?.phone        ?? '',
    amount:       debt?.amount       ?? '',
    currency:     debt?.currency     ?? 'UZS',
    dueDate:      debt?.dueDate ? dayjs(debt.dueDate).format('YYYY-MM-DD') : '',
    description:  debt?.description  ?? '',
    notes:        debt?.notes        ?? '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: (d: any) => isEdit ? debtsApi.update(debt.id, d) : debtsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts'] })
      qc.invalidateQueries({ queryKey: ['debts-summary'] })
      toast.success(isEdit ? t.notifications.updated : t.notifications.created)
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? t.errors.saveFailed),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customerName.trim()) return toast.error(t.errors.required)
    if (!form.amount)              return toast.error(t.errors.required)
    save.mutate({
      customerName: form.customerName.trim(),
      phone:        form.phone.trim() || null,
      amount:       Number(form.amount),
      currency:     form.currency,
      dueDate:      form.dueDate || null,
      description:  form.description.trim() || null,
      notes:        form.notes.trim() || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold">{isEdit ? t.debts.editDebt : t.debts.addDebt}</h2>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">{t.debts.customer} *</label>
              <input value={form.customerName} onChange={e => set('customerName', e.target.value)}
                placeholder="Full name" className="input w-full" required />
            </div>
            <div>
              <label className="label">{t.common.phone}</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="+998 90 …" className="input w-full" />
            </div>
            <div>
              <label className="label">{t.debts.currency}</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input w-full">
                <option value="UZS">UZS</option>
                <option value="USD">USD</option>
                <option value="RUB">RUB</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">{t.debts.amount} *</label>
              <input value={form.amount} onChange={e => set('amount', e.target.value)}
                type="number" min="0" step="any" placeholder="0" className="input w-full font-mono" required />
            </div>
            <div className="col-span-2">
              <label className="label">{t.debts.dueDate}</label>
              <input value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
                type="date" className="input w-full" />
            </div>
            <div className="col-span-2">
              <label className="label">{t.debts.description}</label>
              <input value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Reason for debt…" className="input w-full" />
            </div>
            <div className="col-span-2">
              <label className="label">{t.debts.notes}</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                rows={2} className="input w-full resize-none" placeholder="Internal notes…" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t.common.cancel}</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 disabled:opacity-50">
              {save.isPending ? t.common.loading : isEdit ? t.common.save : t.debts.addDebt}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ debt, onClose }: { debt: any; onClose: () => void }) {
  const qc  = useQueryClient()
  const t   = useT()
  const remaining = Number(debt.amount) - Number(debt.paid)

  const [form, setForm] = useState({ amount: '', method: 'CASH', paidAt: dayjs().format('YYYY-MM-DD'), notes: '' })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const pay = useMutation({
    mutationFn: (d: any) => debtsApi.addPayment(debt.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts'] })
      qc.invalidateQueries({ queryKey: ['debts-summary'] })
      toast.success(t.notifications.paymentAdded)
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? t.errors.saveFailed),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(form.amount)
    if (!amt || amt <= 0)   return toast.error('Enter a valid amount')
    if (amt > remaining)    return toast.error(`Max: ${fmt.currency(remaining)}`)
    pay.mutate({ amount: amt, method: form.method, paidAt: form.paidAt, notes: form.notes || null })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold">{t.debts.recordPayment}</h2>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="bg-surface2 rounded-xl p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">{t.debts.customer}</span>
              <span className="font-medium">{debt.customerName}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted">{t.debts.remaining}</span>
              <span className="font-mono font-bold text-rose">{fmt.currency(remaining)}</span>
            </div>
          </div>
          <div>
            <label className="label">{t.debts.paymentAmount} *</label>
            <div className="flex gap-2">
              <input value={form.amount} onChange={e => set('amount', e.target.value)}
                type="number" min="1" max={remaining} step="any" placeholder="0"
                className="input flex-1 font-mono" autoFocus required />
              <button type="button" onClick={() => set('amount', String(remaining))}
                className="btn-secondary text-xs px-3 whitespace-nowrap">Max</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t.debts.paymentMethod}</label>
              <select value={form.method} onChange={e => set('method', e.target.value)} className="input w-full">
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="TRANSFER">Transfer</option>
              </select>
            </div>
            <div>
              <label className="label">{t.debts.paymentDate}</label>
              <input value={form.paidAt} onChange={e => set('paidAt', e.target.value)}
                type="date" className="input w-full" />
            </div>
          </div>
          <div>
            <label className="label">{t.common.notes}</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Optional note…" className="input w-full" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t.common.cancel}</button>
            <button type="submit" disabled={pay.isPending} className="btn-primary flex-1 disabled:opacity-50">
              {pay.isPending ? t.common.loading : t.debts.addPayment}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Debt Row (expandable) ─────────────────────────────────────────────────────
function DebtRow({ debt, onEdit, onPay, onDelete }: {
  debt: any; onEdit: () => void; onPay: () => void; onDelete: () => void
}) {
  const t         = useT()
  const [open, setOpen] = useState(false)
  const remaining = Number(debt.amount) - Number(debt.paid)
  const pct       = Number(debt.amount) > 0 ? (Number(debt.paid) / Number(debt.amount)) * 100 : 0
  const daysOver  = debt.dueDate && dayjs().isAfter(dayjs(debt.dueDate)) && debt.status !== 'PAID'
    ? dayjs().diff(dayjs(debt.dueDate), 'day') : 0

  const statusLabel: Record<string, string> = {
    PAID:    t.debts.paid,
    UNPAID:  t.debts.unpaid,
    PARTIAL: t.debts.partial,
    OVERDUE: t.debts.overdue,
  }

  return (
    <div className={clsx('card transition-colors', debt.status === 'OVERDUE' && 'border-orange-500/20')}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm',
          debt.status === 'PAID'    ? 'bg-jade/10 text-jade' :
          debt.status === 'OVERDUE' ? 'bg-orange-400/10 text-orange-400' :
          debt.status === 'PARTIAL' ? 'bg-yellow-400/10 text-yellow-400' :
                                      'bg-rose/10 text-rose')}>
          {debt.status === 'PAID' ? <CheckCircle size={18} /> : <TrendingDown size={18} />}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{debt.customerName}</span>
            {statusBadge(debt.status, statusLabel[debt.status] ?? debt.status)}
            {daysOver > 0 && (
              <span className="text-xs text-orange-400 flex items-center gap-0.5">
                <AlertTriangle size={10} /> {daysOver} {t.debts.daysOverdue}
              </span>
            )}
          </div>
          {debt.phone && <div className="text-xs text-muted mt-0.5">{debt.phone}</div>}
          {debt.description && <div className="text-xs text-muted mt-0.5 truncate">{debt.description}</div>}

          {/* Progress bar */}
          {debt.status !== 'UNPAID' && (
            <div className="mt-2 bg-surface2 rounded-full h-1.5 overflow-hidden max-w-xs">
              <div className="h-full bg-jade transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          )}
        </div>

        {/* Amounts */}
        <div className="text-right shrink-0">
          <div className="text-sm font-bold font-mono">{fmt.compact(Number(debt.amount))} {debt.currency}</div>
          {debt.status !== 'UNPAID' && debt.status !== 'PAID' && (
            <div className="text-xs text-rose font-mono">-{fmt.compact(remaining)} left</div>
          )}
          {debt.dueDate && debt.status !== 'PAID' && (
            <div className="text-xs text-muted mt-0.5">{dayjs(debt.dueDate).format('DD MMM YYYY')}</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {debt.status !== 'PAID' && (
            <button onClick={onPay} title={t.debts.recordPayment}
              className="p-1.5 rounded-lg hover:bg-jade/10 text-muted hover:text-jade transition-colors">
              <CreditCard size={14} />
            </button>
          )}
          <button onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-surface2 text-muted hover:text-white transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-rose/10 text-muted hover:text-rose transition-colors">
            <Trash2 size={14} />
          </button>
          {debt.payments?.length > 0 && (
            <button onClick={() => setOpen(o => !o)}
              className="p-1.5 rounded-lg hover:bg-surface2 text-muted transition-colors">
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Payment history */}
      {open && debt.payments?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <p className="text-xs text-muted font-medium">{t.debts.paymentHistory}</p>
          {debt.payments.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-muted" />
                <span className="text-muted text-xs">{dayjs(p.paidAt).format('DD MMM YYYY')}</span>
                <span className="text-xs bg-surface2 border border-border px-1.5 rounded">{p.method}</span>
              </div>
              <span className="font-mono text-jade text-sm">+{fmt.compact(Number(p.amount))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="card flex items-center gap-3">
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>{icon}</div>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="font-bold font-mono">{value}</p>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DebtPage() {
  const t                           = useT()
  const qc                          = useQueryClient()
  const [search, setSearch]         = useState('')
  const [statusFilter, setFilter]   = useState('ALL')
  const [modal, setModal]           = useState<'create' | 'edit' | 'pay' | null>(null)
  const [selected, setSelected]     = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['debts', search, statusFilter],
    queryFn:  () => debtsApi.list({ search: search || undefined, status: statusFilter === 'ALL' ? undefined : statusFilter, limit: 50 }),
  })

  const { data: summary } = useQuery<any>({
    queryKey: ['debts-summary'],
    queryFn:  () => debtsApi.summary(),
    retry: false,
  })

  const remove = useMutation({
    mutationFn: debtsApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debts'] }); toast.success(t.notifications.deleted) },
    onError:   () => toast.error(t.errors.deleteFailed),
  })

  const debts = (data as any)?.data ?? []

  const FILTERS = [
    { key: 'ALL',     label: t.debts.filterAll },
    { key: 'UNPAID',  label: t.debts.filterUnpaid },
    { key: 'PARTIAL', label: t.debts.filterPartial },
    { key: 'PAID',    label: t.debts.filterPaid },
    { key: 'OVERDUE', label: t.debts.filterOverdue },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t.debts.title}</h1>
          <p className="text-sm text-muted mt-0.5">{t.debts.subtitle}</p>
        </div>
        <button onClick={() => { setSelected(null); setModal('create') }} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> {t.debts.addDebt}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<ReceiptText size={18} className="text-gold" />}
          label={t.debts.totalDebt}
          value={fmt.compact(summary?.totalRemaining ?? 0) + ' UZS'}
          color="bg-gold-dim border border-gold/20" />
        <StatCard icon={<AlertTriangle size={18} className="text-orange-400" />}
          label={t.debts.overdueDebt}
          value={fmt.compact(summary?.overdueAmount ?? 0) + ' UZS'}
          color="bg-orange-400/10 border border-orange-400/20" />
        <StatCard icon={<CheckCircle size={18} className="text-jade" />}
          label={t.debts.paidDebt}
          value={fmt.compact(summary?.totalPaid ?? 0) + ' UZS'}
          color="bg-jade/10 border border-jade/30" />
        <StatCard icon={<DollarSign size={18} className="text-yellow-400" />}
          label={t.debts.partialDebt}
          value={fmt.compact(summary?.partialAmount ?? 0) + ' UZS'}
          color="bg-yellow-400/10 border border-yellow-400/20" />
      </div>

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t.debts.searchDebts} className="input pl-9" />
        </div>
        <div className="flex gap-1 bg-surface2 rounded-xl p-1 border border-border">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={clsx('px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                statusFilter === f.key ? 'bg-surface text-white shadow' : 'text-muted hover:text-white')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-16 text-muted">{t.common.loading}</div>
      ) : debts.length === 0 ? (
        <div className="text-center py-16 text-muted card">
          <TrendingDown size={48} className="mx-auto mb-3 opacity-30" />
          <p>{t.debts.noDebts}</p>
          <button onClick={() => { setSelected(null); setModal('create') }} className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus size={14} /> {t.debts.addDebt}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {debts.map((d: any) => (
            <DebtRow key={d.id} debt={d}
              onEdit={() => { setSelected(d); setModal('edit') }}
              onPay={() => { setSelected(d); setModal('pay') }}
              onDelete={() => confirm(`Delete debt for ${d.customerName}?`) && remove.mutate(d.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {(modal === 'create' || modal === 'edit') && (
        <DebtModal debt={modal === 'edit' ? selected : null}
          onClose={() => { setModal(null); setSelected(null) }} />
      )}
      {modal === 'pay' && selected && (
        <PaymentModal debt={selected} onClose={() => { setModal(null); setSelected(null) }} />
      )}
    </div>
  )
}
