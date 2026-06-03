import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { branchesApi } from '../lib/api'
import { useState } from 'react'
import { PageHeader, Badge, EmptyState } from '../components/Shared'
import { Plus, X, Loader2, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface BranchForm {
  name: string; address: string; phone: string; isActive: boolean
}
const empty: BranchForm = { name: '', address: '', phone: '', isActive: true }

export default function BranchesPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<any>(null)
  const [form,      setForm]      = useState<BranchForm>(empty)

  const { data: branches, isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn:  branchesApi.list,
  })

  const createMut = useMutation({
    mutationFn: branchesApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); closeModal(); toast.success('Branch created') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => branchesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); closeModal(); toast.success('Branch updated') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const openCreate = () => { setEditing(null); setForm(empty); setShowModal(true) }
  const openEdit   = (b: any) => {
    setEditing(b)
    setForm({ name: b.name, address: b.address ?? '', phone: b.phone ?? '', isActive: b.isActive })
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditing(null) }

  const submit = () => {
    if (!form.name.trim()) return toast.error('Name required')
    if (editing) updateMut.mutate({ id: editing.id, data: form })
    else         createMut.mutate(form)
  }

  const f = (k: keyof BranchForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(v => ({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const busy = createMut.isPending || updateMut.isPending

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Branches" subtitle="Manage store locations"
        action={<button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-gold text-bg text-sm font-semibold rounded-lg hover:bg-gold/90"><Plus size={14} />Add Branch</button>}
      />

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-gold" /></div>
        ) : branches?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((b: any) => (
              <div key={b.id} className="bg-surface border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-base font-semibold text-fg">{b.name}</p>
                    <Badge color={b.isActive ? 'green' : 'muted'} >{b.isActive ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <button onClick={() => openEdit(b)} className="text-muted hover:text-gold"><Edit2 size={15} /></button>
                </div>
                <div className="space-y-1.5 text-xs text-muted">
                  {b.address && <p>📍 {b.address}</p>}
                  {b.phone   && <p>📞 {b.phone}</p>}
                  <p className="font-mono text-surface2 text-[10px]">ID: {b.id.slice(-12)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No branches configured" />
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-fg">{editing ? 'Edit Branch' : 'Add Branch'}</h2>
              <button onClick={closeModal} className="text-muted hover:text-fg"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted mb-1">Branch Name *</label>
                <input value={form.name} onChange={f('name')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Address</label>
                <input value={form.address} onChange={f('address')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Phone</label>
                <input value={form.phone} onChange={f('phone')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
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
