import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customersApi } from '../lib/api'
import { useState } from 'react'
import { PageHeader, Badge, EmptyState, fmt, fmtDate } from '../components/Shared'
import { Search, Plus, X, Loader2, ChevronRight, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

const TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']
const TIER_COLORS: Record<string, string> = {
  BRONZE: 'muted', SILVER: 'muted', GOLD: 'gold', PLATINUM: 'green',
}

interface CustomerForm {
  name: string; phone: string; email: string; address: string; loyaltyTier: string; notes: string
}

const empty: CustomerForm = { name: '', phone: '', email: '', address: '', loyaltyTier: 'BRONZE', notes: '' }

export default function CustomersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)
  const [selected, setSelected] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<any>(null)
  const [form, setForm]           = useState<CustomerForm>(empty)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, page],
    queryFn:  () => customersApi.list({ search: search || undefined, page, limit: 25 }),
  })

  const { data: detail } = useQuery({
    queryKey: ['customer', selected?.id],
    queryFn:  () => customersApi.get(selected.id),
    enabled:  !!selected?.id,
  })

  const customers = data?.data ?? []
  const meta      = data?.meta ?? {}

  const createMut = useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); closeModal(); toast.success('Customer created') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => customersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); qc.invalidateQueries({ queryKey: ['customer'] }); closeModal(); toast.success('Customer updated') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const openCreate = () => { setEditing(null); setForm(empty); setShowModal(true) }
  const openEdit   = (c: any) => {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '', loyaltyTier: c.loyaltyTier ?? 'BRONZE', notes: c.notes ?? '' })
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditing(null) }

  const submit = () => {
    if (!form.name.trim()) return toast.error('Name is required')
    if (editing) updateMut.mutate({ id: editing.id, data: form })
    else         createMut.mutate(form)
  }

  const f = (k: keyof CustomerForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(v => ({ ...v, [k]: e.target.value }))

  const busy = createMut.isPending || updateMut.isPending

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Customers" subtitle={`${meta.total ?? 0} customers`}
        action={<button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-gold text-bg text-sm font-semibold rounded-lg hover:bg-gold/90"><Plus size={14} />Add Customer</button>}
      />

      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search customers…"
            className="bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-fg w-56 focus:outline-none focus:border-gold/60" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-gold" /></div>
          ) : customers.length ? (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Phone</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Tier</th>
                  <th className="text-right px-4 py-3 text-xs text-muted font-medium">Points</th>
                  <th className="text-right px-4 py-3 text-xs text-muted font-medium">Lifetime</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers.map((c: any) => (
                  <tr key={c.id} onClick={() => setSelected(c)}
                    className={`cursor-pointer hover:bg-surface2/40 ${selected?.id === c.id ? 'bg-surface2/60' : ''}`}>
                    <td className="px-4 py-3 text-sm text-fg font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-xs text-muted">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted truncate max-w-[160px]">{c.email ?? '—'}</td>
                    <td className="px-4 py-3"><Badge color={TIER_COLORS[c.loyaltyTier ?? 'BRONZE']}>{c.loyaltyTier ?? 'BRONZE'}</Badge></td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-gold">{c.loyaltyPoints ?? 0}</td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-fg">{fmt(c.lifetimeValue ?? 0)}</td>
                    <td className="px-4 py-3 text-xs text-muted">{fmtDate(c.createdAt)}</td>
                    <td className="px-4 py-3 text-muted"><ChevronRight size={14} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="No customers found" />
          )}

          {meta.lastPage > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border text-sm text-muted">
              <span>Page {page} of {meta.lastPage}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-surface2">Prev</button>
                <button disabled={page === meta.lastPage} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-surface2">Next</button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 border-l border-border overflow-auto bg-surface p-4 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-fg">Customer Detail</h3>
              <div className="flex gap-2">
                <button onClick={() => openEdit(detail ?? selected)} className="text-muted hover:text-gold"><Edit2 size={14} /></button>
                <button onClick={() => setSelected(null)} className="text-muted hover:text-fg">×</button>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div><p className="text-xs text-muted">Name</p><p className="text-fg font-medium">{selected.name}</p></div>
              {selected.phone && <div><p className="text-xs text-muted">Phone</p><p className="text-fg">{selected.phone}</p></div>}
              {selected.email && <div><p className="text-xs text-muted">Email</p><p className="text-fg truncate">{selected.email}</p></div>}
              {selected.address && <div><p className="text-xs text-muted">Address</p><p className="text-fg text-xs">{selected.address}</p></div>}
              <div><p className="text-xs text-muted">Loyalty Tier</p><Badge color={TIER_COLORS[selected.loyaltyTier ?? 'BRONZE']}>{selected.loyaltyTier ?? 'BRONZE'}</Badge></div>
              <div><p className="text-xs text-muted">Points</p><p className="text-gold font-mono">{selected.loyaltyPoints ?? 0}</p></div>
              <div><p className="text-xs text-muted">Lifetime Value</p><p className="text-gold font-mono">{fmt(selected.lifetimeValue ?? 0)}</p></div>
              {detail?.orders && (
                <div>
                  <p className="text-xs text-muted mb-2">Recent Orders ({detail.orders.length})</p>
                  <div className="space-y-1">
                    {detail.orders.slice(0, 5).map((o: any) => (
                      <div key={o.id} className="flex justify-between text-xs">
                        <span className="text-muted font-mono">#{o.id.slice(-6)}</span>
                        <span className="font-mono text-gold">{fmt(o.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selected.notes && <div><p className="text-xs text-muted">Notes</p><p className="text-fg text-xs">{selected.notes}</p></div>}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-fg">{editing ? 'Edit Customer' : 'Add Customer'}</h2>
              <button onClick={closeModal} className="text-muted hover:text-fg"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {([['name','Name *','text'],['phone','Phone','text'],['email','Email','email'],['address','Address','text']] as const).map(([k, label, type]) => (
                <div key={k}>
                  <label className="block text-xs text-muted mb-1">{label}</label>
                  <input type={type} value={form[k as keyof CustomerForm]} onChange={f(k as keyof CustomerForm)}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-muted mb-1">Loyalty Tier</label>
                <select value={form.loyaltyTier} onChange={f('loyaltyTier')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none">
                  {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Notes</label>
                <textarea value={form.notes} onChange={f('notes')} rows={2}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={closeModal} className="flex-1 py-2 border border-border rounded-lg text-sm text-muted hover:text-fg">Cancel</button>
              <button onClick={submit} disabled={busy}
                className="flex-1 py-2 bg-gold text-bg rounded-lg text-sm font-semibold hover:bg-gold/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {busy && <Loader2 size={14} className="animate-spin" />}
                {editing ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
