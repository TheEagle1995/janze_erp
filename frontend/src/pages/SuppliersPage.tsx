import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { suppliersApi } from '../lib/api'
import { useState } from 'react'
import { PageHeader, Badge, EmptyState, fmt, fmtDate } from '../components/Shared'
import { Search, Plus, X, Loader2, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface SupForm {
  name: string; contactName: string; phone: string; email: string; address: string; notes: string; isActive: boolean
}
const empty: SupForm = { name: '', contactName: '', phone: '', email: '', address: '', notes: '', isActive: true }

export default function SuppliersPage() {
  const qc = useQueryClient()
  const [search,    setSearch]    = useState('')
  const [page,      setPage]      = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<any>(null)
  const [form,      setForm]      = useState<SupForm>(empty)
  const [selected,  setSelected]  = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', search, page],
    queryFn:  () => suppliersApi.list({ search: search || undefined, page, limit: 25 }),
  })

  const suppliers = data?.data ?? []
  const meta      = data?.meta ?? {}

  const createMut = useMutation({
    mutationFn: suppliersApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); closeModal(); toast.success('Supplier added') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => suppliersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); closeModal(); toast.success('Supplier updated') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const openCreate = () => { setEditing(null); setForm(empty); setShowModal(true) }
  const openEdit   = (s: any) => {
    setEditing(s)
    setForm({ name: s.name, contactName: s.contactName ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', notes: s.notes ?? '', isActive: s.isActive })
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditing(null) }

  const submit = () => {
    if (!form.name.trim()) return toast.error('Name required')
    if (editing) updateMut.mutate({ id: editing.id, data: form })
    else         createMut.mutate(form)
  }

  const f = (k: keyof SupForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(v => ({ ...v, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const busy = createMut.isPending || updateMut.isPending

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Suppliers" subtitle={`${meta.total ?? 0} suppliers`}
        action={<button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-gold text-bg text-sm font-semibold rounded-lg hover:bg-gold/90"><Plus size={14} />Add Supplier</button>}
      />

      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search suppliers…"
            className="bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-fg w-52 focus:outline-none focus:border-gold/60" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-gold" /></div>
          ) : suppliers.length ? (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Contact</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Phone</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Email</th>
                  <th className="text-right px-4 py-3 text-xs text-muted font-medium">Balance</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {suppliers.map((s: any) => (
                  <tr key={s.id} onClick={() => setSelected(s)}
                    className={`cursor-pointer hover:bg-surface2/40 ${selected?.id === s.id ? 'bg-surface2/60' : ''}`}>
                    <td className="px-4 py-3 text-sm text-fg font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-xs text-muted">{s.contactName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted">{s.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted truncate max-w-[150px]">{s.email ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-xs font-mono">
                      <span className={(s.balance ?? 0) < 0 ? 'text-rose' : 'text-jade'}>{fmt(Math.abs(s.balance ?? 0))}</span>
                    </td>
                    <td className="px-4 py-3"><Badge color={s.isActive ? 'green' : 'muted'}>{s.isActive ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="px-4 py-3">
                      <button onClick={e => { e.stopPropagation(); openEdit(s) }} className="text-muted hover:text-gold"><Edit2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="No suppliers found" />
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

        {/* Detail */}
        {selected && (
          <div className="w-64 border-l border-border overflow-auto bg-surface p-4 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-fg">Supplier Detail</h3>
              <div className="flex gap-2">
                <button onClick={() => openEdit(selected)} className="text-muted hover:text-gold"><Edit2 size={14} /></button>
                <button onClick={() => setSelected(null)} className="text-muted hover:text-fg">×</button>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div><p className="text-xs text-muted">Name</p><p className="text-fg font-medium">{selected.name}</p></div>
              {selected.contactName && <div><p className="text-xs text-muted">Contact</p><p className="text-fg">{selected.contactName}</p></div>}
              {selected.phone  && <div><p className="text-xs text-muted">Phone</p><p className="text-fg">{selected.phone}</p></div>}
              {selected.email  && <div><p className="text-xs text-muted">Email</p><p className="text-fg text-xs truncate">{selected.email}</p></div>}
              {selected.address && <div><p className="text-xs text-muted">Address</p><p className="text-fg text-xs">{selected.address}</p></div>}
              <div><p className="text-xs text-muted">Balance</p><p className={`font-mono ${(selected.balance ?? 0) < 0 ? 'text-rose' : 'text-jade'}`}>{fmt(selected.balance ?? 0)}</p></div>
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
              <h2 className="text-base font-semibold text-fg">{editing ? 'Edit Supplier' : 'Add Supplier'}</h2>
              <button onClick={closeModal} className="text-muted hover:text-fg"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {([['name','Name *'],['contactName','Contact Name'],['phone','Phone'],['email','Email'],['address','Address']] as const).map(([k, label]) => (
                <div key={k}>
                  <label className="block text-xs text-muted mb-1">{label}</label>
                  <input value={form[k as keyof SupForm] as string} onChange={f(k as keyof SupForm)}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-muted mb-1">Notes</label>
                <textarea value={form.notes} onChange={f('notes')} rows={2}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60 resize-none" />
              </div>
              {editing && (
                <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={f('isActive')} className="accent-gold" />
                  Active
                </label>
              )}
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
