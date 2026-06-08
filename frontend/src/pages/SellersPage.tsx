import { useState, useMemo, useEffect } from 'react'
import { usersApi, branchesApi, analyticsApi } from '../lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '../i18n'
import toast from 'react-hot-toast'
import {
  Plus, Pencil, X, User, ShieldCheck, Eye, EyeOff,
  Trophy, TrendingUp, BarChart2, Target,
  Crown, Medal, Star, Users, RefreshCw,
  ChevronUp, ChevronDown, Minus,
} from 'lucide-react'
import clsx from 'clsx'
import { fmt } from '../utils/format'
import dayjs from 'dayjs'

// ── Constants ────────────────────────────────────────────────────────────────
const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER']

type Tab = 'sellers' | 'kpi'

const PERIODS: { key: string; label: string; days: number }[] = [
  { key: 'today',   label: 'Bugun',   days: 0  },
  { key: 'week',    label: 'Hafta',   days: 7  },
  { key: 'month',   label: 'Oy',      days: 30 },
  { key: 'quarter', label: 'Kvartal', days: 90 },
]

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'text-red-400 bg-red-900/20 border-red-900/40',
  ADMIN:       'text-orange-400 bg-orange-900/20 border-orange-900/40',
  MANAGER:     'text-blue-400 bg-blue-900/20 border-blue-900/40',
  CASHIER:     'text-jade bg-jade/10 border-jade/30',
}

const RANK_STYLE = [
  { label: '🥇', barColor: 'bg-yellow-400', cardCls: 'border-yellow-700/40 bg-yellow-900/5'  },
  { label: '🥈', barColor: 'bg-slate-400',  cardCls: 'border-slate-600/30'                  },
  { label: '🥉', barColor: 'bg-orange-400', cardCls: 'border-orange-700/30'                 },
]

const TARGETS_KEY = 'seller_targets_v1'
function loadTargets(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(TARGETS_KEY) ?? '{}') } catch { return {} }
}
function saveTargets(t: Record<string, number>) {
  localStorage.setItem(TARGETS_KEY, JSON.stringify(t))
}

// ── Seller Modal ──────────────────────────────────────────────────────────────
function SellerModal({
  seller, branches, onClose,
}: { seller: any | null; branches: any[]; onClose: () => void }) {
  const qc     = useQueryClient()
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
      toast.success(isEdit ? 'Seller yangilandi!' : "Seller qo'shildi!")
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Xatolik'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim())             return toast.error('Ism majburiy')
    if (!isEdit && !form.email.trim()) return toast.error('Email majburiy')
    if (!isEdit && !form.password)     return toast.error('Parol majburiy')
    if (!form.branchId)                return toast.error('Filial tanlang')
    const payload: any = {
      name: form.name.trim(), role: form.role,
      branchId: form.branchId, isActive: form.isActive,
    }
    if (!isEdit) { payload.email = form.email.trim(); payload.password = form.password }
    if (form.pin) payload.pin = form.pin
    save.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold">{isEdit ? 'Selerni tahrirlash' : 'Yangi seller'}</h2>
          <button onClick={onClose} className="text-muted hover:text-fg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Ism *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Ali Karimov" className="input w-full" required />
          </div>
          {!isEdit && (
            <div>
              <label className="label">Email *</label>
              <input value={form.email} onChange={e => set('email', e.target.value)}
                type="email" placeholder="ali@store.com" className="input w-full" required />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Rol *</label>
              <select value={form.role} onChange={e => set('role', e.target.value)} className="input w-full">
                {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Filial *</label>
              <select value={form.branchId} onChange={e => set('branchId', e.target.value)} className="input w-full">
                <option value="">— Tanlang —</option>
                {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          {!isEdit && (
            <div>
              <label className="label">Parol *</label>
              <div className="relative">
                <input value={form.password} onChange={e => set('password', e.target.value)}
                  type={showPass ? 'text' : 'password'} placeholder="Kamida 8 belgi" className="input w-full pr-10" />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="label">PIN <span className="text-muted text-xs">(4–6 raqam)</span></label>
            <input value={form.pin} onChange={e => set('pin', e.target.value)}
              type="password" maxLength={6} placeholder="1234" className="input w-full font-mono tracking-widest" />
          </div>
          {isEdit && (
            <div className="flex items-center gap-3">
              <label className="label mb-0">Faol</label>
              <button type="button" onClick={() => set('isActive', !form.isActive)}
                className={clsx('w-10 h-5 rounded-full transition-colors relative',
                  form.isActive ? 'bg-jade' : 'bg-surface2 border border-border')}>
                <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  form.isActive ? 'translate-x-5' : 'translate-x-0.5')} />
              </button>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Bekor</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 disabled:opacity-50">
              {save.isPending ? '…' : isEdit ? 'Saqlash' : "Qo'shish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Inline target input ───────────────────────────────────────────────────────
function TargetInput({
  sellerId, sellerName, current, onChange,
}: { sellerId: string; sellerName: string; current: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false)
  const [val,  setVal]  = useState(String(current || ''))

  const apply = () => {
    const n = Number(val.replace(/\s/g, ''))
    if (!isNaN(n) && n >= 0) onChange(n)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setVal(String(current || '')); setOpen(v => !v) }}
        className={clsx(
          'text-xs px-2 py-0.5 rounded border transition-colors flex items-center gap-1',
          current
            ? 'text-gold border-gold/30 bg-gold/5 hover:bg-gold/10'
            : 'text-muted border-border hover:border-gold/30 hover:text-gold',
        )}
      >
        <Target size={10} />
        {current ? fmt.compact(current) : 'Plan'}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-20 bg-surface2 border border-border rounded-xl p-3 shadow-xl w-52">
          <div className="text-xs font-medium text-muted mb-2">{sellerName} — plan (UZS)</div>
          <input
            autoFocus value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') setOpen(false) }}
            placeholder="5000000"
            className="input w-full text-sm font-mono mb-2"
          />
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary text-xs flex-1 py-1">Bekor</button>
            <button onClick={apply} className="btn-primary text-xs flex-1 py-1">Saqlash</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiRow({
  rank, seller, totalRevenue, target, onTargetChange,
}: { rank: number; seller: any; totalRevenue: number; target: number; onTargetChange: (v: number) => void }) {
  const share   = totalRevenue > 0 ? (seller.revenue / totalRevenue) * 100 : 0
  const planPct = target > 0 ? Math.min((seller.revenue / target) * 100, 200) : null
  const rs      = RANK_STYLE[rank]

  return (
    <div className={clsx('card p-4 transition-all', rs?.cardCls)}>
      {/* top row */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0">
          {rs ? rs.label : `#${rank + 1}`}
        </div>
        <div className="w-9 h-9 rounded-full bg-gold-dim border border-gold/30 flex items-center
          justify-center text-gold font-bold text-sm shrink-0">
          {seller.name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{seller.name}</div>
          <div className="text-xs text-muted">{seller.role?.replace('_', ' ')}</div>
        </div>
        <TargetInput
          sellerId={seller.id} sellerName={seller.name}
          current={target} onChange={onTargetChange}
        />
      </div>

      {/* Revenue share bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>Sotuv ulushi</span>
          <span className="font-mono text-fg">{share.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all', rs?.barColor ?? 'bg-gold/50')}
            style={{ width: `${Math.min(share, 100)}%` }}
          />
        </div>
      </div>

      {/* Plan vs actual bar */}
      {planPct !== null && (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>Plan: {fmt.compact(target)} UZS</span>
            <span className={clsx('font-mono font-medium',
              planPct >= 100 ? 'text-jade' : planPct >= 70 ? 'text-gold' : 'text-rose')}>
              {planPct.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all',
                planPct >= 100 ? 'bg-jade' : planPct >= 70 ? 'bg-gold' : 'bg-rose')}
              style={{ width: `${Math.min(planPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
        <div className="text-center">
          <div className="text-xs text-muted mb-0.5">Sotuv</div>
          <div className="font-bold text-sm font-mono">{fmt.compact(seller.revenue)}</div>
        </div>
        <div className="text-center border-x border-border">
          <div className="text-xs text-muted mb-0.5">Buyurtma</div>
          <div className="font-bold text-sm">{seller.orders}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted mb-0.5">O'rtacha</div>
          <div className="font-bold text-sm font-mono">{fmt.compact(seller.avgBasket)}</div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SellersPage() {
  const [tab,     setTab]     = useState<Tab>('sellers')
  const [modal,   setModal]   = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [period,  setPeriod]  = useState('month')
  const [targets, setTargets] = useState<Record<string, number>>(loadTargets)
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  useEffect(() => { saveTargets(targets) }, [targets])

  const setTarget = (id: string, val: number) =>
    setTargets(prev => ({ ...prev, [id]: val }))

  // ── Queries ───────────────────────────────────────────────
  const { data: sellers = [], isLoading } = useQuery({
    queryKey: ['sellers'],
    queryFn:  () => usersApi.list(),
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn:  () => branchesApi.list(),
  })

  const kpiParams = useMemo(() => {
    const end  = dayjs().format('YYYY-MM-DD')
    const days = PERIODS.find(p => p.key === period)?.days ?? 30
    const start = days === 0
      ? end
      : dayjs().subtract(days, 'day').format('YYYY-MM-DD')
    return { dateFrom: start, dateTo: end }
  }, [period])

  const { data: kpiRaw, isLoading: kpiLoading, refetch: refetchKpi } = useQuery({
    queryKey: ['sellers-kpi', kpiParams],
    queryFn:  () => analyticsApi.byEmployee(kpiParams),
    enabled:  tab === 'kpi',
    retry:    false,
    staleTime: 60_000,
  })

  // ── Process KPI list ──────────────────────────────────────
  const kpiList = useMemo(() => {
    const raw = Array.isArray(kpiRaw) ? kpiRaw : (kpiRaw as any)?.data ?? []
    const userMap: Record<string, any> = {}
    ;(sellers as any[]).forEach((s: any) => { userMap[s.id] = s })

    return raw
      .map((e: any) => {
        const uid  = e.userId ?? e.id ?? e.cashierId ?? e.employeeId
        const user = userMap[uid] ?? {}
        return {
          id:        uid,
          name:      e.name ?? e.cashierName ?? user.name ?? '—',
          role:      user.role ?? e.role ?? 'CASHIER',
          revenue:   Number(e.total    ?? e.revenue    ?? 0),
          orders:    Number(e.orders   ?? e.orderCount ?? 0),
          avgBasket: Number(e.avgOrder ?? e.avgBasket  ?? 0),
          items:     Number(e.itemsSold ?? e.items     ?? 0),
        }
      })
      .filter((e: any) => e.revenue > 0 || e.orders > 0)
      .sort((a: any, b: any) =>
        sortDir === 'desc' ? b.revenue - a.revenue : a.revenue - b.revenue)
  }, [kpiRaw, sellers, sortDir])

  const totalRevenue = kpiList.reduce((s: number, e: any) => s + e.revenue, 0)
  const totalOrders  = kpiList.reduce((s: number, e: any) => s + e.orders,  0)
  const avgBasketAll = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const topSeller    = kpiList[0]

  const withTarget = kpiList.filter((e: any) => (targets[e.id] ?? 0) > 0)
  const hitTarget  = withTarget.filter((e: any) => e.revenue >= (targets[e.id] ?? 0))

  const branchName = (id: string) =>
    (branches as any[]).find((b: any) => b.id === id)?.name ?? '—'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Sellerlar</h1>
          <p className="text-sm text-muted mt-0.5">{(sellers as any[]).length} ta xodim</p>
        </div>
        <button onClick={() => { setEditing(null); setModal(true) }}
          className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Yangi seller
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        {([
          { key: 'sellers', label: 'Sellerlar', icon: Users      },
          { key: 'kpi',     label: 'KPI',        icon: TrendingUp },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === key ? 'bg-gold text-black shadow-sm' : 'text-muted hover:text-fg',
            )}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ══ SELLERS TAB ══ */}
      {tab === 'sellers' && (
        isLoading
          ? <div className="text-center py-16 text-muted">Yuklanmoqda…</div>
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(sellers as any[]).map((s: any) => (
                <div key={s.id} className="card hover:border-gold/20 transition-colors group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gold-dim border border-gold/30
                        flex items-center justify-center text-gold font-bold">
                        {s.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{s.name}</div>
                        <div className="text-xs text-muted">{s.email}</div>
                      </div>
                    </div>
                    <button onClick={() => { setEditing(s); setModal(true) }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-surface2
                        text-muted hover:text-fg transition-all">
                      <Pencil size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className={clsx('text-xs px-2 py-0.5 rounded border font-medium',
                      ROLE_COLORS[s.role] ?? 'text-muted border-border')}>
                      <ShieldCheck size={10} className="inline mr-1" />
                      {s.role?.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-muted flex items-center gap-1">
                      <User size={10} /> {branchName(s.branchId)}
                    </span>
                    <span className={clsx('text-xs ml-auto', s.isActive ? 'text-jade' : 'text-rose')}>
                      ● {s.isActive ? 'Faol' : 'Nofaol'}
                    </span>
                  </div>
                </div>
              ))}
              {!(sellers as any[]).length && (
                <div className="col-span-3 text-center py-16 text-muted">
                  <User size={48} className="mx-auto mb-3 opacity-30" />
                  <p>Hali seller yo'q</p>
                  <button onClick={() => { setEditing(null); setModal(true) }}
                    className="btn-primary mt-4 inline-flex items-center gap-2">
                    <Plus size={14} /> Yangi seller
                  </button>
                </div>
              )}
            </div>
          )
      )}

      {/* ══ KPI TAB ══ */}
      {tab === 'kpi' && (
        <div className="space-y-4">

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 bg-surface border border-border rounded-xl p-1">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    period === p.key ? 'bg-gold text-black' : 'text-muted hover:text-fg')}>
                  {p.label}
                </button>
              ))}
            </div>

            <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-fg border border-border
                rounded-lg px-3 py-1.5 transition-colors">
              {sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              {sortDir === 'desc' ? 'Yuqoridan past' : 'Pastdan yuqori'}
            </button>

            <button onClick={() => refetchKpi()} title="Yangilash"
              className="ml-auto p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface2 transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Summary KPI cards */}
          {!kpiLoading && kpiList.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Jami sotuv',   value: fmt.compact(totalRevenue),  sub: 'UZS', color: 'text-gold' },
                { label: 'Buyurtmalar',  value: String(totalOrders),         sub: 'ta'                      },
                { label: "O'rtacha chek",value: fmt.compact(avgBasketAll),   sub: 'UZS'                     },
                { label: 'Top seller',   value: topSeller?.name ?? '—',      sub: topSeller ? fmt.compact(topSeller.revenue) + ' UZS' : '' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="card py-3 px-4">
                  <div className="text-xs text-muted uppercase tracking-wide mb-1">{label}</div>
                  <div className={clsx('text-xl font-bold font-mono truncate', color)}>{value}</div>
                  <div className="text-xs text-muted mt-0.5">{sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* Plan completion banner */}
          {withTarget.length > 0 && (
            <div className="card py-3 px-4 flex items-center gap-4 flex-wrap border-gold/20">
              <Target size={16} className="text-gold shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Plan bajarish holati</div>
                <div className="text-xs text-muted">
                  {withTarget.length} ta sellerdan {hitTarget.length} tasi planini bajardi
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-jade text-sm font-bold">{hitTarget.length}</span>
                <span className="text-muted text-xs">/ {withTarget.length}</span>
                <div className="w-24 h-2 bg-surface2 rounded-full overflow-hidden">
                  <div className="h-full bg-jade rounded-full"
                    style={{ width: `${(hitTarget.length / withTarget.length) * 100}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {kpiLoading && (
            <div className="text-center py-16 text-muted">
              <RefreshCw size={24} className="mx-auto mb-3 animate-spin opacity-40" />
              <p>KPI ma'lumotlari yuklanmoqda…</p>
            </div>
          )}

          {/* Empty */}
          {!kpiLoading && kpiList.length === 0 && (
            <div className="text-center py-16 text-muted">
              <BarChart2 size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Tanlangan davr uchun ma'lumot yo'q</p>
              <p className="text-xs mt-1">Boshqa davr tanlang yoki sotuv amalga oshirilganligini tekshiring</p>
            </div>
          )}

          {/* Leaderboard cards */}
          {!kpiLoading && kpiList.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Trophy size={16} className="text-gold" />
                Seller reytingi
                <span className="text-xs text-muted font-normal ml-1">
                  · "Plan" tugmasini bosib har bir seller uchun oylik maqsad belgilang
                </span>
              </div>
              {kpiList.map((seller: any, i: number) => (
                <KpiRow
                  key={seller.id ?? i}
                  rank={i}
                  seller={seller}
                  totalRevenue={totalRevenue}
                  target={targets[seller.id] ?? 0}
                  onTargetChange={v => setTarget(seller.id, v)}
                />
              ))}
            </div>
          )}

          {/* Comparison table */}
          {!kpiLoading && kpiList.length > 1 && (
            <div className="card overflow-hidden p-0">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <BarChart2 size={14} className="text-gold" />
                <span className="text-sm font-medium">Solishtirma jadval</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['#','Seller','Sotuv','Buyurtma',"O'rtacha",'Plan','%'].map(h => (
                        <th key={h} className={clsx(
                          'px-4 py-2 text-xs text-muted uppercase tracking-wide',
                          h === '#' || h === 'Seller' ? 'text-left' : 'text-right',
                        )}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {kpiList.map((e: any, i: number) => {
                      const tgt     = targets[e.id] ?? 0
                      const planPct = tgt > 0 ? (e.revenue / tgt) * 100 : null
                      return (
                        <tr key={e.id ?? i} className="border-b border-border last:border-0 hover:bg-surface2/50">
                          <td className="px-4 py-2.5 text-muted text-xs">
                            {i < 3 ? RANK_STYLE[i].label : `#${i + 1}`}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{e.name}</div>
                            <div className="text-xs text-muted">{e.role?.replace('_', ' ')}</div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-medium">
                            {fmt.compact(e.revenue)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted">{e.orders}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-muted">
                            {fmt.compact(e.avgBasket)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted text-xs">
                            {tgt ? fmt.compact(tgt) : <Minus size={12} className="ml-auto" />}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {planPct !== null ? (
                              <span className={clsx('text-xs font-bold',
                                planPct >= 100 ? 'text-jade' : planPct >= 70 ? 'text-gold' : 'text-rose')}>
                                {planPct.toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-muted text-xs">—</span>
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
      )}

      {/* Modal */}
      {modal && (
        <SellerModal
          seller={editing}
          branches={branches as any[]}
          onClose={() => { setModal(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
