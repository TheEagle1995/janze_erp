import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { branchesApi } from '../api/branches'
import { useT }        from '../i18n'
import toast from 'react-hot-toast'
import { Plus, Pencil, X, Building2, MapPin, Phone, CheckCircle, XCircle } from 'lucide-react'
import clsx from 'clsx'

// ── Modal ─────────────────────────────────────────────────────────────────────
function BranchModal({ branch, onClose }: { branch: any | null; onClose: () => void }) {
  const qc     = useQueryClient()
  const t      = useT()
  const isEdit = !!branch

  const [form, setForm] = useState({
    name:     branch?.name     ?? '',
    brand:    branch?.brand    ?? 'AVERO',
    address:  branch?.address  ?? '',
    phone:    branch?.phone    ?? '',
    isActive: branch?.isActive ?? true,
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: (d: any) => isEdit ? branchesApi.update(branch.id, d) : branchesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] })
      toast.success(isEdit ? t.notifications.updated : t.notifications.created)
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? t.errors.saveFailed),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error(t.errors.required)
    save.mutate({
      name:     form.name.trim(),
      brand:    form.brand,
      address:  form.address.trim() || null,
      phone:    form.phone.trim()   || null,
      isActive: form.isActive,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold text-fg">
            {isEdit ? t.branches.editBranch : t.branches.addBranch}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-fg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          <div>
            <label className="label">{t.branches.name} *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Main Store" className="input w-full" required />
          </div>

          <div>
            <label className="label">{t.products.brand} *</label>
            <div className="grid grid-cols-2 gap-2">
              {['AVERO', 'JANZE'].map(b => (
                <button
                  key={b} type="button"
                  onClick={() => set('brand', b)}
                  className={clsx(
                    'py-2.5 rounded-xl border text-sm font-semibold transition-all',
                    form.brand === b
                      ? b === 'AVERO'
                        ? 'border-gold bg-gold-dim text-gold'
                        : 'border-purple-500 bg-purple-900/20 text-purple-400'
                      : 'border-border bg-surface2 text-muted hover:border-border/80'
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">{t.branches.address}</label>
            <input value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="e.g. 15 Amir Temur St, Tashkent" className="input w-full" />
          </div>

          <div>
            <label className="label">{t.branches.phone}</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)}
              placeholder="+998 90 123 45 67" className="input w-full" />
          </div>

          {isEdit && (
            <div className="flex items-center gap-3">
              <label className="label mb-0">{t.branches.active}</label>
              <button type="button" onClick={() => set('isActive', !form.isActive)}
                className={clsx('w-10 h-5 rounded-full transition-colors relative',
                  form.isActive ? 'bg-jade' : 'bg-surface2 border border-border')}>
                <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  form.isActive ? 'translate-x-5' : 'translate-x-0.5')} />
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t.common.cancel}</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 disabled:opacity-50">
              {save.isPending ? t.common.loading : isEdit ? t.common.save : t.branches.addBranch}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BranchesPage() {
  const t                      = useT()
  const [modal, setModal]      = useState(false)
  const [editing, setEditing]  = useState<any>(null)

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn:  () => branchesApi.list(),
  })

  const openCreate = () => { setEditing(null); setModal(true) }
  const openEdit   = (b: any) => { setEditing(b); setModal(true) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-fg">{t.branches.title}</h1>
          <p className="text-sm text-muted mt-0.5">{(branches as any[]).length} {t.branches.title.toLowerCase()}</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> {t.branches.addBranch}
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted">{t.common.loading}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(branches as any[]).map((b: any) => (
            <div key={b.id} className="card hover:border-gold/20 transition-colors group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold-dim border border-gold/30 flex items-center justify-center text-gold">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-fg">{b.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium',
                        b.brand === 'AVERO' ? 'bg-gold-dim text-gold' : 'bg-purple-900/30 text-purple-400'
                      )}>{b.brand}</span>
                      <div className={clsx('text-xs flex items-center gap-1', b.isActive ? 'text-jade' : 'text-rose')}>
                        {b.isActive
                          ? <><CheckCircle size={10} /> {t.branches.active}</>
                          : <><XCircle    size={10} /> {t.branches.inactive}</>}
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={() => openEdit(b)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-surface2 text-muted hover:text-fg transition-all">
                  <Pencil size={14} />
                </button>
              </div>
              <div className="mt-3 space-y-1.5">
                {b.address && (
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <MapPin size={11} className="shrink-0" /><span className="truncate">{b.address}</span>
                  </div>
                )}
                {b.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Phone size={11} className="shrink-0" /><span>{b.phone}</span>
                  </div>
                )}
                {!b.address && !b.phone && (
                  <p className="text-xs text-muted/50 italic">{t.branches.noContact}</p>
                )}
              </div>
            </div>
          ))}
          {!(branches as any[]).length && (
            <div className="col-span-3 text-center py-16 text-muted">
              <Building2 size={48} className="mx-auto mb-3 opacity-30" />
              <p>{t.branches.noBranches}</p>
              <button onClick={openCreate} className="btn-primary mt-4 inline-flex items-center gap-2">
                <Plus size={14} /> {t.branches.addBranch}
              </button>
            </div>
          )}
        </div>
      )}

      {modal && <BranchModal branch={editing} onClose={() => { setModal(false); setEditing(null) }} />}
    </div>
  )
}
