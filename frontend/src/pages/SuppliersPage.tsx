import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { suppliersApi } from '../lib/api'
import { fmt }          from '../utils/format'
import toast            from 'react-hot-toast'
import clsx             from 'clsx'
import dayjs            from 'dayjs'
import {
  Plus, X, Pencil, Truck, ShoppingBag, CheckCircle2,
  Clock, AlertCircle, Search, Package, ExternalLink,
  TrendingUp, TrendingDown, BarChart2,
} from 'lucide-react'

// ── Status config ─────────────────────────────────────────────────────────────
const PO_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: 'Pending',  color: 'text-amber-400 bg-amber-900/20 border-amber-900/40',  icon: Clock },
  PARTIAL: { label: 'Partial',  color: 'text-blue-400  bg-blue-900/20  border-blue-900/40',   icon: AlertCircle },
  PAID:    { label: 'Received', color: 'text-jade      bg-jade/10       border-jade/30',       icon: CheckCircle2 },
}

// ── Supplier Modal ─────────────────────────────────────────────────────────────
function SupplierModal({ supplier, onClose }: { supplier: any | null; onClose: () => void }) {
  const qc     = useQueryClient()
  const isEdit = !!supplier

  const [form, setForm] = useState({
    name:        supplier?.name        ?? '',
    contactName: supplier?.contactName ?? '',
    phone:       supplier?.phone       ?? '',
    email:       supplier?.email       ?? '',
    country:     supplier?.country     ?? '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: (d: any) => isEdit ? suppliersApi.update(supplier.id, d) : suppliersApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success(isEdit ? 'Supplier updated!' : 'Supplier created!')
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Save failed'),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Supplier name is required')
    save.mutate({
      name:        form.name.trim(),
      contactName: form.contactName.trim() || null,
      phone:       form.phone.trim()       || null,
      email:       form.email.trim()       || null,
      country:     form.country.trim()     || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold">{isEdit ? 'Edit Supplier' : 'New Supplier'}</h2>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="label">Company Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Fashion Corp Ltd." className="input w-full" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Contact Person</label>
              <input value={form.contactName} onChange={e => set('contactName', e.target.value)}
                placeholder="John Smith" className="input w-full" />
            </div>
            <div>
              <label className="label">Country</label>
              <input value={form.country} onChange={e => set('country', e.target.value)}
                placeholder="e.g. Turkey" className="input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="+998 …" className="input w-full" />
            </div>
            <div>
              <label className="label">Email</label>
              <input value={form.email} onChange={e => set('email', e.target.value)}
                type="email" placeholder="email@example.com" className="input w-full" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 disabled:opacity-50">
              {save.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Purchase Order Modal ──────────────────────────────────────────────────────
function POModal({ supplier, onClose }: { supplier: any; onClose: () => void }) {
  const qc = useQueryClient()

  const [form, setForm] = useState({
    totalAmount:  '',
    expectedDate: '',
    notes:        '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const create = useMutation({
    mutationFn: (d: any) => suppliersApi.createPO(supplier.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Purchase order created!')
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create PO'),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.totalAmount) return toast.error('Total amount is required')
    create.mutate({
      totalAmount:  Number(form.totalAmount),
      expectedDate: form.expectedDate || null,
      notes:        form.notes.trim() || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold">New Purchase Order</h2>
            <p className="text-xs text-muted mt-0.5">{supplier.name}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="label">Total Amount (UZS) *</label>
            <input value={form.totalAmount} onChange={e => set('totalAmount', e.target.value)}
              type="number" min="0" placeholder="e.g. 5000000" className="input w-full font-mono" required />
          </div>
          <div>
            <label className="label">Expected Delivery</label>
            <input value={form.expectedDate} onChange={e => set('expectedDate', e.target.value)}
              type="date" className="input w-full" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} className="input w-full resize-none" placeholder="Optional notes…" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1 disabled:opacity-50">
              {create.isPending ? 'Creating…' : 'Create PO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Supplier Card ─────────────────────────────────────────────────────────────
function SupplierCard({ supplier, onEdit, onNewPO, onClick, active }: {
  supplier: any; onEdit: () => void; onNewPO: () => void; onClick: () => void; active: boolean
}) {
  return (
    <button onClick={onClick}
      className={clsx('w-full card text-left transition-colors hover:border-gold/30 group',
        active ? 'border-gold/50 bg-gold-dim/5' : '')}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface2 border border-border flex items-center justify-center text-gold font-bold text-sm flex-shrink-0">
            {supplier.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{supplier.name}</div>
            {supplier.contactName && (
              <div className="text-xs text-muted truncate">{supplier.contactName}</div>
            )}
            {supplier.country && (
              <div className="text-xs text-muted">{supplier.country}</div>
            )}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onEdit() }}
            className="p-1.5 rounded-lg hover:bg-surface2 text-muted hover:text-white">
            <Pencil size={13} />
          </button>
          <button onClick={e => { e.stopPropagation(); onNewPO() }}
            className="p-1.5 rounded-lg hover:bg-gold-dim text-muted hover:text-gold">
            <Plus size={13} />
          </button>
        </div>
      </div>
      {supplier.phone && (
        <div className="mt-2 text-xs text-muted">{supplier.phone}</div>
      )}
    </button>
  )
}

// ── Insights Panel ────────────────────────────────────────────────────────────
function InsightsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['supplier-insights'],
    queryFn:  suppliersApi.insights,
    retry:    false,
    staleTime: 60_000,
  })

  if (isLoading) return <div className="text-center py-16 text-muted text-sm">Loading insights…</div>
  if (!data)     return <div className="text-center py-16 text-muted card"><BarChart2 size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No data yet</p></div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Trending products */}
      <div className="card">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <TrendingUp size={15} className="text-jade" />
          Trending Products <span className="text-xs text-muted font-normal">(last 30 days)</span>
        </h3>
        {(data.trending ?? []).length === 0 ? (
          <p className="text-xs text-muted">No sales data yet</p>
        ) : (data.trending as any[]).map((p: any, i: number) => (
          <div key={p.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
            <span className="text-xs text-muted w-4 font-mono">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{p.name}</div>
              <div className="text-xs text-muted">{p.brand}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xs font-mono text-jade">{p.sold} sold</div>
              <div className="text-xs text-muted font-mono">{fmt.compact(p.revenue)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Slow-moving products */}
      <div className="card">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <TrendingDown size={15} className="text-rose" />
          Slow-Moving / No Sales
        </h3>
        {(data.slowMovers ?? []).length === 0 ? (
          <p className="text-xs text-muted">All products have recent sales 🎉</p>
        ) : (data.slowMovers as any[]).slice(0, 10).map((p: any) => (
          <div key={p.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
            <div className="w-2 h-2 rounded-full bg-rose/60 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{p.name}</div>
              <div className="text-xs text-muted">{p.brand}</div>
            </div>
            <span className="text-xs text-rose font-mono flex-shrink-0">
              {p.sold === 0 ? 'No sales' : `${p.sold} sold`}
            </span>
          </div>
        ))}
      </div>

      {/* Pending deliveries */}
      <div className="card lg:col-span-2">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Truck size={15} className="text-amber-400" />
          Pending Deliveries
        </h3>
        {(data.pendingPOs ?? []).length === 0 ? (
          <p className="text-xs text-muted">No pending purchase orders</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['PO#', 'Supplier', 'Amount', 'Balance', 'Expected', 'Status'].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.pendingPOs as any[]).map((po: any) => {
                  const balance  = Number(po.totalAmount) - Number(po.paidAmount)
                  const overdue  = po.expectedDate && new Date(po.expectedDate) < new Date()
                  return (
                    <tr key={po.id} className="border-b border-border last:border-0 hover:bg-surface2/40">
                      <td className="px-3 py-2 font-mono text-xs text-gold">{po.orderNumber}</td>
                      <td className="px-3 py-2 font-medium text-sm">{po.supplier?.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{fmt.compact(Number(po.totalAmount))}</td>
                      <td className="px-3 py-2 font-mono text-xs text-rose">{balance > 0 ? fmt.compact(balance) : '—'}</td>
                      <td className={clsx('px-3 py-2 text-xs', overdue ? 'text-rose font-semibold' : 'text-muted')}>
                        {po.expectedDate ? dayjs(po.expectedDate).format('DD MMM YYYY') : '—'}
                        {overdue && ' ⚠ Overdue'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full border',
                          PO_STATUS[po.status]?.color ?? 'text-muted border-border')}>
                          {PO_STATUS[po.status]?.label ?? po.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type Modal = { type: 'supplier'; data: any | null } | { type: 'po'; supplier: any } | null

export default function SuppliersPage() {
  const qc = useQueryClient()
  const [modal,    setModal]    = useState<Modal>(null)
  const [selected, setSelected] = useState<any>(null)
  const [search,   setSearch]   = useState('')
  const [poFilter, setPoFilter] = useState<string>('ALL')
  const [mainTab,  setMainTab]  = useState<'orders' | 'insights'>('orders')

  const { data: suppliers = [], isLoading } = useQuery<any[]>({
    queryKey: ['suppliers'],
    queryFn:  suppliersApi.list,
  })

  const { data: allPOs = [] } = useQuery<any[]>({
    queryKey: ['purchase-orders', selected?.id, poFilter],
    queryFn:  () => suppliersApi.listPOs({
      supplierId: selected?.id,
      status:     poFilter === 'ALL' ? undefined : poFilter,
    }),
    enabled: true,
  })

  const receivePO = useMutation({
    mutationFn: (id: string) => suppliersApi.receivePO(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order marked as received!')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed'),
  })

  const filtered = (suppliers as any[]).filter((s: any) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contactName?.toLowerCase().includes(search.toLowerCase())
  )

  // Stats
  const totalPOs     = allPOs.length
  const pendingPOs   = allPOs.filter((p: any) => p.status === 'PENDING').length
  const totalOwed    = allPOs.filter((p: any) => p.status !== 'PAID')
    .reduce((s: number, p: any) => s + Number(p.totalAmount) - Number(p.paidAmount), 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Suppliers & Purchase Orders</h1>
          <p className="text-sm text-muted mt-0.5">{suppliers.length} suppliers · {totalPOs} orders</p>
        </div>
        <button onClick={() => setModal({ type: 'supplier', data: null })} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> New Supplier
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card flex items-center gap-3">
          <Truck size={18} className="text-gold flex-shrink-0" />
          <div>
            <p className="text-xs text-muted">Suppliers</p>
            <p className="font-bold">{suppliers.length}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <Clock size={18} className="text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-muted">Pending POs</p>
            <p className="font-bold text-amber-400">{pendingPOs}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <ShoppingBag size={18} className="text-rose flex-shrink-0" />
          <div>
            <p className="text-xs text-muted">Total Owed</p>
            <p className="font-bold text-rose font-mono">{fmt.compact(totalOwed)}</p>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-surface2 rounded-xl p-1 w-fit border border-border">
        <button onClick={() => setMainTab('orders')}
          className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5',
            mainTab === 'orders' ? 'bg-surface text-white shadow' : 'text-muted hover:text-white')}>
          <Truck size={13} /> Purchase Orders
        </button>
        <button onClick={() => setMainTab('insights')}
          className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5',
            mainTab === 'insights' ? 'bg-surface text-white shadow' : 'text-muted hover:text-white')}>
          <BarChart2 size={13} /> Product Insights
        </button>
      </div>

      {/* Insights tab */}
      {mainTab === 'insights' && <InsightsPanel />}

      {/* Orders tab */}
      {mainTab === 'orders' && <div className="flex gap-4">
        {/* Left — Supplier list */}
        <div className="w-72 flex-shrink-0 space-y-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search suppliers…" className="input pl-9 w-full text-sm" />
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted card">
              <Truck size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No suppliers yet</p>
              <button onClick={() => setModal({ type: 'supplier', data: null })}
                className="btn-primary mt-3 text-sm inline-flex items-center gap-1">
                <Plus size={13} /> Add Supplier
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((s: any) => (
                <SupplierCard key={s.id} supplier={s} active={selected?.id === s.id}
                  onClick={() => setSelected(s === selected ? null : s)}
                  onEdit={() => setModal({ type: 'supplier', data: s })}
                  onNewPO={() => setModal({ type: 'po', supplier: s })}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right — Purchase Orders */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-surface2 rounded-xl p-1 border border-border">
              {(['ALL', 'PENDING', 'PARTIAL', 'PAID'] as const).map(s => (
                <button key={s} onClick={() => setPoFilter(s)}
                  className={clsx('px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                    poFilter === s ? 'bg-surface text-white shadow' : 'text-muted hover:text-white')}>
                  {s === 'ALL' ? 'All' : PO_STATUS[s]?.label ?? s}
                </button>
              ))}
            </div>
            {selected && (
              <button onClick={() => setModal({ type: 'po', supplier: selected })}
                className="btn-primary text-sm flex items-center gap-1">
                <Plus size={13} /> New PO for {selected.name}
              </button>
            )}
          </div>

          {allPOs.length === 0 ? (
            <div className="card text-center py-16 text-muted">
              <Package size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">
                {selected ? `No purchase orders for ${selected.name}` : 'No purchase orders yet'}
              </p>
              <p className="text-sm mt-1">
                {selected ? 'Click "New PO" to create one' : 'Select a supplier or create a new one'}
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface2">
                      {['PO Number', 'Supplier', 'Total', 'Paid', 'Balance', 'Status', 'Expected', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(allPOs as any[]).map((po: any) => {
                      const cfg     = PO_STATUS[po.status] ?? PO_STATUS.PENDING
                      const StatusIcon = cfg.icon
                      const balance = Number(po.totalAmount) - Number(po.paidAmount)
                      return (
                        <tr key={po.id} className="border-b border-border last:border-0 hover:bg-surface2/50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-gold">{po.orderNumber}</td>
                          <td className="px-4 py-3 font-medium">{po.supplier?.name ?? selected?.name}</td>
                          <td className="px-4 py-3 font-mono">{fmt.compact(Number(po.totalAmount))}</td>
                          <td className="px-4 py-3 font-mono text-jade">{fmt.compact(Number(po.paidAmount))}</td>
                          <td className="px-4 py-3 font-mono text-rose">{balance > 0 ? fmt.compact(balance) : '—'}</td>
                          <td className="px-4 py-3">
                            <span className={clsx('text-xs border px-2 py-0.5 rounded-full flex items-center gap-1 w-fit', cfg.color)}>
                              <StatusIcon size={10} /> {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted text-xs">
                            {po.expectedDate ? dayjs(po.expectedDate).format('DD MMM YYYY') : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {po.status !== 'PAID' && (
                              <button
                                onClick={() => confirm(`Mark PO ${po.orderNumber} as received?`) && receivePO.mutate(po.id)}
                                className="text-xs text-jade hover:text-jade/80 flex items-center gap-1 whitespace-nowrap">
                                <CheckCircle2 size={12} /> Mark Received
                              </button>
                            )}
                            {po.status === 'PAID' && (
                              <span className="text-xs text-muted flex items-center gap-1">
                                <ExternalLink size={12} />
                                {po.receivedDate ? dayjs(po.receivedDate).format('DD MMM') : 'Received'}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>}

      {/* Modals */}
      {modal?.type === 'supplier' && (
        <SupplierModal supplier={modal.data} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'po' && (
        <POModal supplier={modal.supplier} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
