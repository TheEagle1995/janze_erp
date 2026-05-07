import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customersApi } from '../api/customers'
import { fmt }          from '../utils/format'
import { useT }         from '../i18n'
import toast            from 'react-hot-toast'
import clsx             from 'clsx'
import dayjs            from 'dayjs'
import {
  Search, Plus, Star, Phone, Mail, MapPin, X, Pencil,
  Crown, Users, ShoppingBag, TrendingUp, Calendar,
} from 'lucide-react'

// ── Segment config ────────────────────────────────────────────────────────────
const SEGMENT_CONFIG = {
  VIP:      { color: 'text-gold bg-gold-dim border-gold/30',    icon: Crown,      label: 'VIP' },
  REGULAR:  { color: 'text-jade bg-jade/10 border-jade/30',     icon: Users,      label: 'Regular' },
  INACTIVE: { color: 'text-muted bg-surface2 border-border',    icon: Users,      label: 'Inactive' },
}

// ── Customer Modal ─────────────────────────────────────────────────────────────
function CustomerModal({ customer, onClose }: { customer: any | null; onClose: () => void }) {
  const qc     = useQueryClient()
  const t      = useT()
  const isEdit = !!customer

  const [form, setForm] = useState({
    name:         customer?.name         ?? '',
    phone:        customer?.phone        ?? '',
    email:        customer?.email        ?? '',
    address:      customer?.address      ?? '',
    birthday:     customer?.birthday ? dayjs(customer.birthday).format('YYYY-MM-DD') : '',
    loyaltyPoints:customer?.loyaltyPoints ?? 0,
    discountPct:  customer?.discountPct  ?? 0,
    segment:      customer?.segment      ?? 'REGULAR',
    notes:        customer?.notes        ?? '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: (d: any) => isEdit ? customersApi.update(customer.id, d) : customersApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success(isEdit ? t.notifications.updated : t.notifications.created)
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? t.errors.saveFailed),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim())  return toast.error(t.errors.required)
    if (!form.phone.trim()) return toast.error(t.errors.required)
    save.mutate({
      name:          form.name.trim(),
      phone:         form.phone.trim(),
      email:         form.email.trim() || null,
      address:       form.address.trim() || null,
      birthday:      form.birthday || null,
      loyaltyPoints: Number(form.loyaltyPoints),
      discountPct:   Number(form.discountPct),
      segment:       form.segment,
      notes:         form.notes.trim() || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold">{isEdit ? t.customers.editCustomer : t.customers.addCustomer}</h2>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="label">{t.common.name} *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Full name" className="input w-full" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t.customers.phone} *</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="+998 90 …" className="input w-full" required />
            </div>
            <div>
              <label className="label">{t.customers.email}</label>
              <input value={form.email} onChange={e => set('email', e.target.value)}
                type="email" placeholder="email@…" className="input w-full" />
            </div>
          </div>
          <div>
            <label className="label">{t.customers.address}</label>
            <input value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="Street, city…" className="input w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t.customers.birthday}</label>
              <input value={form.birthday} onChange={e => set('birthday', e.target.value)}
                type="date" className="input w-full" />
            </div>
            <div>
              <label className="label">{t.customers.segment}</label>
              <select value={form.segment} onChange={e => set('segment', e.target.value)} className="input w-full">
                <option value="REGULAR">{t.customers.regular}</option>
                <option value="VIP">{t.customers.vip}</option>
                <option value="INACTIVE">{t.customers.inactive}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t.customers.loyaltyPts}</label>
              <input value={form.loyaltyPoints} onChange={e => set('loyaltyPoints', e.target.value)}
                type="number" min="0" className="input w-full font-mono" />
            </div>
            <div>
              <label className="label">{t.customers.discount}</label>
              <input value={form.discountPct} onChange={e => set('discountPct', e.target.value)}
                type="number" min="0" max="100" step="0.5" className="input w-full font-mono" />
            </div>
          </div>
          <div>
            <label className="label">{t.customers.notes}</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} className="input w-full resize-none" placeholder="Internal notes…" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t.common.cancel}</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 disabled:opacity-50">
              {save.isPending ? t.common.loading : isEdit ? t.common.save : t.customers.addCustomer}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Customer detail panel ─────────────────────────────────────────────────────
function CustomerDetail({ customer, onEdit }: { customer: any; onEdit: () => void }) {
  const t = useT()
  const { data: history } = useQuery({
    queryKey: ['customer-history', customer.id],
    queryFn:  () => customersApi.history(customer.id, { limit: 10 }),
  })

  const seg    = SEGMENT_CONFIG[customer.segment as keyof typeof SEGMENT_CONFIG] ?? SEGMENT_CONFIG.REGULAR
  const SegIcon = seg.icon

  const rows = [
    [t.customers.phone,      customer.phone,                       <Phone size={12} key="p" />],
    [t.customers.email,      customer.email ?? '—',                <Mail  size={12} key="e" />],
    [t.customers.address,    customer.address ?? '—',              <MapPin size={12} key="a" />],
    [t.customers.birthday,   customer.birthday ? dayjs(customer.birthday).format('DD MMM YYYY') : '—', <Calendar size={12} key="b" />],
    [t.customers.loyaltyPts, `${customer.loyaltyPoints} pts`,      <Star size={12} key="s" />],
    [t.customers.discount,   `${customer.discountPct}%`,           null],
    [t.customers.totalSpent, fmt.currency(customer.totalSpent),    null],
    [t.customers.totalOrders,String(customer.totalOrders),         null],
  ] as const

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={clsx('text-xs border px-2 py-0.5 rounded flex items-center gap-1', seg.color)}>
                <SegIcon size={10} /> {t.customers[customer.segment?.toLowerCase() as 'vip' | 'regular' | 'inactive'] ?? customer.segment}
              </span>
            </div>
            <h3 className="font-semibold">{customer.name}</h3>
            <p className="text-xs text-muted">{t.customers.since} {dayjs(customer.createdAt).format('MMM YYYY')}</p>
          </div>
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-surface2 text-muted hover:text-white transition-colors">
            <Pencil size={14} />
          </button>
        </div>
        <div className="space-y-2">
          {rows.map(([label, val, icon]) => (
            <div key={String(label)} className="flex justify-between items-center text-sm">
              <span className="text-muted flex items-center gap-1">{icon}{label}</span>
              <span className="font-medium text-right text-xs max-w-[160px] truncate">{val}</span>
            </div>
          ))}
        </div>
        {customer.notes && (
          <div className="mt-3 p-2 bg-surface2 rounded-lg text-xs text-muted">{customer.notes}</div>
        )}
      </div>

      <div className="card">
        <h3 className="font-semibold text-sm mb-3">{t.customers.recentOrders}</h3>
        <div className="space-y-2">
          {((history as any)?.data ?? []).slice(0, 6).map((o: any) => (
            <div key={o.id} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
              <div>
                <div className="text-xs font-mono text-muted">{o.orderNumber}</div>
                <div className="text-xs text-muted">{fmt.date(o.createdAt)}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-semibold">{fmt.compact(Number(o.total))}</div>
                <div className="text-xs text-jade">{o.status}</div>
              </div>
            </div>
          ))}
          {!(history as any)?.data?.length && <p className="text-xs text-muted">{t.customers.noOrders}</p>}
        </div>
      </div>
    </div>
  )
}

// ── Segment filter pills ──────────────────────────────────────────────────────
const SEGS = ['ALL', 'VIP', 'REGULAR', 'INACTIVE'] as const

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const t     = useT()
  const qc    = useQueryClient()
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(1)
  const [segment, setSegment]     = useState<string>('ALL')
  const [selected, setSelected]   = useState<any>(null)
  const [modal, setModal]         = useState<'create' | 'edit' | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, segment, page],
    queryFn:  () => customersApi.list({
      search:  search || undefined,
      segment: segment === 'ALL' ? undefined : segment,
      page, limit: 20,
    }),
  })

  const customers = (data as any)?.data ?? []
  const meta      = (data as any)?.meta ?? {}

  const topBySpend = [...customers].sort((a: any, b: any) => Number(b.totalSpent) - Number(a.totalSpent)).slice(0, 3)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t.customers.title}</h1>
          <p className="text-sm text-muted mt-0.5">{meta.total ?? 0} {t.customers.title.toLowerCase()}</p>
        </div>
        <button onClick={() => { setSelected(null); setModal('create') }} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> {t.customers.addCustomer}
        </button>
      </div>

      <div className="flex gap-4 h-full">
        {/* Left: list */}
        <div className="flex-1 space-y-3 min-w-0">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder={t.customers.searchCustomer} className="input pl-9" />
          </div>

          {/* Segment filter */}
          <div className="flex gap-1 bg-surface2 rounded-xl p-1 border border-border w-fit">
            {SEGS.map(s => (
              <button key={s} onClick={() => { setSegment(s); setPage(1) }}
                className={clsx('px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                  segment === s ? 'bg-surface text-white shadow' : 'text-muted hover:text-white')}>
                {s === 'ALL' ? t.common.all : t.customers[s.toLowerCase() as 'vip' | 'regular' | 'inactive']}
              </button>
            ))}
          </div>

          {/* List */}
          {isLoading ? (
            <div className="text-center py-16 text-muted">{t.common.loading}</div>
          ) : customers.length === 0 ? (
            <div className="text-center py-16 text-muted card">
              <Users size={48} className="mx-auto mb-3 opacity-30" />
              <p>{t.common.noData}</p>
              <button onClick={() => setModal('create')} className="btn-primary mt-4 inline-flex items-center gap-2">
                <Plus size={14} /> {t.customers.addCustomer}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {customers.map((c: any) => {
                const seg    = SEGMENT_CONFIG[c.segment as keyof typeof SEGMENT_CONFIG] ?? SEGMENT_CONFIG.REGULAR
                const SegIcon = seg.icon
                return (
                  <button key={c.id} onClick={() => setSelected(c)}
                    className={clsx('w-full card text-left transition-colors hover:border-gold/30 group',
                      selected?.id === c.id ? 'border-gold/50' : '')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-surface2 border border-border flex items-center justify-center text-sm font-bold">
                          {c.name[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-2">
                            {c.name}
                            <span className={clsx('text-xs border px-1.5 py-px rounded hidden group-hover:inline-flex items-center gap-0.5', seg.color)}>
                              <SegIcon size={9} /> {c.segment}
                            </span>
                          </div>
                          <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
                            <Phone size={9} /> {c.phone}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-gold text-xs">
                          <Star size={10} /> {c.loyaltyPoints} pts
                        </div>
                        <div className="text-xs text-muted mt-0.5">{fmt.compact(Number(c.totalSpent))}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {meta.lastPage > 1 && (
            <div className="flex justify-center gap-2 pt-1">
              {Array.from({ length: meta.lastPage }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={clsx('w-8 h-8 rounded-lg text-xs transition-colors',
                    p === page ? 'bg-gold text-bg font-bold' : 'bg-surface2 text-muted hover:bg-border')}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: detail / top customers */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {selected ? (
            <CustomerDetail customer={selected}
              onEdit={() => setModal('edit')} />
          ) : (
            <>
              <div className="card">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp size={14} className="text-gold" /> {t.customers.topCustomers}
                </h3>
                {topBySpend.length === 0 ? (
                  <p className="text-xs text-muted">{t.common.noData}</p>
                ) : topBySpend.map((c: any, i: number) => (
                  <div key={c.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0 cursor-pointer hover:opacity-80"
                    onClick={() => setSelected(c)}>
                    <span className="text-xs text-muted w-4 font-mono">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted">{c.totalOrders} orders</div>
                    </div>
                    <span className="text-xs font-mono text-gold">{fmt.compact(Number(c.totalSpent))}</span>
                  </div>
                ))}
              </div>

              <div className="card">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <ShoppingBag size={14} className="text-jade" /> {t.customers.mostFrequent}
                </h3>
                {[...customers].sort((a: any, b: any) => b.totalOrders - a.totalOrders).slice(0, 3).map((c: any, i: number) => (
                  <div key={c.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0 cursor-pointer hover:opacity-80"
                    onClick={() => setSelected(c)}>
                    <span className="text-xs text-muted w-4 font-mono">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                    </div>
                    <span className="text-xs font-mono text-jade">{c.totalOrders}×</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <CustomerModal customer={modal === 'edit' ? selected : null}
          onClose={() => setModal(null)} />
      )}
    </div>
  )
}
