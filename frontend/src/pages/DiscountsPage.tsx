import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { discountsApi } from '../lib/api'
import { useState } from 'react'
import { PageHeader, Badge, EmptyState, fmt, fmtDate } from '../components/Shared'
import { Plus, X, Loader2, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

const TYPES = ['PERCENTAGE', 'FIXED']

interface DiscForm {
  name: string; code: string; type: string; value: string; minOrderAmount: string
  maxUses: string; validFrom: string; validTo: string; isActive: boolean
}
const empty: DiscForm = {
  name: '', code: '', type: 'PERCENTAGE', value: '', minOrderAmount: '',
  maxUses: '', validFrom: '', validTo: '', isActive: true,
}

export default function DiscountsPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<any>(null)
  const [form,      setForm]      = useState<DiscForm>(empty)

  const { data, isLoading } = useQuery({
    queryKey: ['discounts'],
    queryFn:  () => discountsApi.list({ limit: 50 }),
  })

  const discounts = data?.data ?? []

  const createMut = useMutation({
    mutationFn: discountsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['discounts'] }); closeModal(); toast.success('Discount created') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => discountsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['discounts'] }); closeModal(); toast.success('Discount updated') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => discountsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['discounts'] }); toast.success('Deleted') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const openCreate = () => { setEditing(null); setForm(empty); setShowModal(true) }
  const openEdit   = (d: any) => {
    setEditing(d)
    setForm({
      name: d.name, code: d.code ?? '', type: d.type, value: String(d.value),
      minOrderAmount: String(d.minOrderAmount ?? ''), maxUses: String(d.maxUses ?? ''),
      validFrom: d.validFrom ? d.validFrom.slice(0,10) : '',
      validTo:   d.validTo   ? d.validTo.slice(0,10)   : '',
      isActive:  d.isActive,
    })
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditing(null) }

  const submit = () => {
    if (!form.name.trim()) return toast.error('Name required')
    if (!form.value) return toast.error('Value required')
    const payload = {
      ...form,
      value: Number(form.value),
      minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : undefined,
      maxUses:  form.maxUses ? Number(form.maxUses) : undefined,
      validFrom: form.validFrom || undefined,
      validTo:   form.validTo   || undefined,
    }
    if (editing) updateMut.mutate({ id: editing.id, data: payload })
    else         createMut.mutate(payload)
  }

  const f = (k: keyof DiscForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(v => ({ ...v, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const busy = createMut.isPending || updateMut.isPending

  const isActive = (d: any) => {
    if (!d.isActive) return false
    const now = Date.now()
    if (d.validFrom && new Date(d.validFrom).getTime() > now) return false
    if (d.validTo   && new Date(d.validTo).getTime()   < now) return false
    return true
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Discounts" subtitle="Promo codes & discount rules"
        action={<button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-gold text-bg text-sm font-semibold rounded-lg hover:bg-gold/90"><Plus size={14} />Add Discount</button>}
      />

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-gold" /></div>
        ) : discounts.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {discounts.map((d: any) => (
              <div key={d.id} className={`bg-surface border rounded-xl p-4 ${isActive(d) ? 'border-gold/30' : 'border-border'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-fg">{d.name}</p>
                    {d.code && <p className="text-xs font-mono text-gold mt-0.5 bg-gold/10 rounded px-1.5 py-0.5 inline-block">{d.code}</p>}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(d)} className="text-muted hover:text-gold"><Edit2 size={13} /></button>
                    <button onClick={() => deleteMut.mutate(d.id)} className="text-muted hover:text-rose">×</button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-2xl font-bold font-mono text-gold">
                    {d.type === 'PERCENTAGE' ? `${d.value}%` : fmt(d.value)}
                  </span>
                  <Badge color="muted">{d.type}</Badge>
                  <Badge color={isActive(d) ? 'green' : 'muted'}>{isActive(d) ? 'Active' : 'Inactive'}</Badge>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted">
                  {d.minOrderAmount > 0 && <p>Min order: <span className="text-fg font-mono">{fmt(d.minOrderAmount)}</span></p>}
                  {d.maxUses > 0 && <p>Max uses: <span className="text-fg">{d.maxUses}</span> (used: {d.usedCount ?? 0})</p>}
                  {d.validFrom && <p>From: {fmtDate(d.validFrom)}</p>}
                  {d.validTo   && <p>Until: {fmtDate(d.validTo)}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No discounts configured" />
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-fg">{editing ? 'Edit Discount' : 'New Discount'}</h2>
              <button onClick={closeModal} className="text-muted hover:text-fg"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted mb-1">Name *</label>
                <input value={form.name} onChange={f('name')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Promo Code</label>
                <input value={form.code} onChange={f('code')} placeholder="e.g. SUMMER25"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:border-gold/60 uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Type</label>
                  <select value={form.type} onChange={f('type')}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none">
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Value *</label>
                  <input type="number" value={form.value} onChange={f('value')} min={0}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Min Order</label>
                  <input type="number" value={form.minOrderAmount} onChange={f('minOrderAmount')} min={0}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Max Uses</label>
                  <input type="number" value={form.maxUses} onChange={f('maxUses')} min={0}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Valid From</label>
                  <input type="date" value={form.validFrom} onChange={f('validFrom')}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Valid To</label>
                  <input type="date" value={form.validTo} onChange={f('validTo')}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
                </div>
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
