import { useState } from 'react'
import { usersApi } from '../lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { branchesApi } from '../lib/api'
import { useT } from '../i18n'
import toast from 'react-hot-toast'
import { Plus, Pencil, X, User, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import clsx from 'clsx'

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER']

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'text-red-400 bg-red-900/20 border-red-900/40',
  ADMIN:       'text-orange-400 bg-orange-900/20 border-orange-900/40',
  MANAGER:     'text-blue-400 bg-blue-900/20 border-blue-900/40',
  CASHIER:     'text-jade bg-jade/10 border-jade/30',
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function SellerModal({
  seller,
  branches,
  onClose,
}: {
  seller:   any | null
  branches: any[]
  onClose:  () => void
}) {
  const qc     = useQueryClient()
  const t = useT()
  const isEdit = !!seller

  const [form, setForm] = useState({
    name:     seller?.name     ?? '',
    email:    seller?.email    ?? '',
    role:     seller?.role     ?? 'CASHIER',
    branchId: seller?.branchId ?? (branches[0]?.id ?? ''),
    password: '',
    pin:      '',
    isActive: seller?.isActive ?? true,
  })
  const [showPass, setShowPass] = useState(false)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: (d: any) => isEdit ? usersApi.update(seller.id, d) : usersApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sellers'] })
      toast.success(isEdit ? 'Seller updated!' : 'Seller created!')
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim())     return toast.error('Name is required')
    if (!isEdit && !form.email.trim()) return toast.error('Email is required')
    if (!isEdit && !form.password)     return toast.error('Password is required')
    if (!form.branchId)                return toast.error('Branch is required')

    const payload: any = {
      name:     form.name.trim(),
      role:     form.role,
      branchId: form.branchId,
      isActive: form.isActive,
    }
    if (!isEdit) {
      payload.email    = form.email.trim()
      payload.password = form.password
    }
    if (form.pin) payload.pin = form.pin
    save.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold">{isEdit ? t.sellers.editSeller : t.sellers.addSeller}</h2>
          <button onClick={onClose} className="text-muted hover:text-fg"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">{t.sellers.name} *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Ali Karimov" className="input w-full" required />
          </div>

          {!isEdit && (
            <div>
              <label className="label">{t.sellers.email} *</label>
              <input value={form.email} onChange={e => set('email', e.target.value)}
                type="email" placeholder="ali@store.com" className="input w-full" required />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t.sellers.role} *</label>
              <select value={form.role} onChange={e => set('role', e.target.value)} className="input w-full">
                {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.sellers.branch} *</label>
              <select value={form.branchId} onChange={e => set('branchId', e.target.value)} className="input w-full">
                <option value="">— Select —</option>
                {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          {!isEdit && (
            <div>
              <label className="label">{t.sellers.password} *</label>
              <div className="relative">
                <input
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  className="input w-full pr-10"
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="label">{t.sellers.pin} <span className="text-muted text-xs">(4–6 digits)</span></label>
            <input value={form.pin} onChange={e => set('pin', e.target.value)}
              type="password" maxLength={6} placeholder="e.g. 1234"
              className="input w-full font-mono tracking-widest" />
          </div>

          {isEdit && (
            <div className="flex items-center gap-3">
              <label className="label mb-0">Active</label>
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
              {save.isPending ? t.common.loading : isEdit ? t.common.save : t.sellers.addSeller}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SellersPage() {
  const t = useT()
  const [modal, setModal]      = useState(false)
  const [editing, setEditing]  = useState<any>(null)

  const { data: sellers = [], isLoading } = useQuery({
    queryKey: ['sellers'],
    queryFn:  () => usersApi.list(),
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn:  () => branchesApi.list(),
  })

  const openCreate = () => { setEditing(null); setModal(true) }
  const openEdit   = (s: any) => { setEditing(s); setModal(true) }

  const branchName = (id: string) =>
    (branches as any[]).find((b: any) => b.id === id)?.name ?? '—'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t.sellers.title}</h1>
          <p className="text-sm text-muted mt-0.5">{(sellers as any[]).length} sellers</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> {t.sellers.addSeller}
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted">{t.common.loading}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(sellers as any[]).map((s: any) => (
            <div key={s.id} className="card hover:border-gold/20 transition-colors group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold-dim border border-gold/30 flex items-center justify-center text-gold font-bold">
                    {s.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{s.name}</div>
                    <div className="text-xs text-muted">{s.email}</div>
                  </div>
                </div>
                <button onClick={() => openEdit(s)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-surface2 text-muted hover:text-fg transition-all">
                  <Pencil size={14} />
                </button>
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={clsx('text-xs px-2 py-0.5 rounded border font-medium', ROLE_COLORS[s.role] ?? 'text-muted border-border')}>
                  <ShieldCheck size={10} className="inline mr-1" />{s.role.replace('_', ' ')}
                </span>
                <span className="text-xs text-muted flex items-center gap-1">
                  <User size={10} /> {branchName(s.branchId)}
                </span>
                <span className={clsx('text-xs ml-auto', s.isActive ? 'text-jade' : 'text-rose')}>
                  ● {s.isActive ? t.common.active : t.common.inactive}
                </span>
              </div>
            </div>
          ))}

          {!(sellers as any[]).length && (
            <div className="col-span-3 text-center py-16 text-muted">
              <User size={48} className="mx-auto mb-3 opacity-30" />
              <p>{t.sellers.noSellers}</p>
              <button onClick={openCreate} className="btn-primary mt-4 inline-flex items-center gap-2">
                <Plus size={14} /> {t.sellers.addSeller}
              </button>
            </div>
          )}
        </div>
      )}

      {modal && (
        <SellerModal seller={editing} branches={branches as any[]} onClose={() => { setModal(false); setEditing(null) }} />
      )}
    </div>
  )
}
