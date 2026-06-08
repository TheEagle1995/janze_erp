import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http as api, customersApi } from '../lib/api'
import { useT } from '../i18n'
import toast from 'react-hot-toast'
import { fmt } from '../utils/format'
import {
  Plus, Pencil, X, Tag, Gift, Percent, Users,
  Calendar, ChevronRight, BadgePercent, Star, Trash2,
  Send, Bot, CheckCircle2, AlertCircle, Crown,
  MessageSquare, Copy, Phone, Zap, Filter, RefreshCw,
} from 'lucide-react'
import dayjs from 'dayjs'
import clsx from 'clsx'

// ── API helpers ────────────────────────────────────────────────────────────────
const discountsApi = {
  list:   ()              => api.get('/discounts').then(r => r.data),
  create: (d: any)        => api.post('/discounts', d).then(r => r.data),
  update: (id: string, d: any) => api.put(`/discounts/${id}`, d).then(r => r.data),
  remove: (id: string)    => api.delete(`/discounts/${id}`).then(r => r.data),
}

// ── Discount types ─────────────────────────────────────────────────────────────
const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED'] as const
type DiscountType = typeof DISCOUNT_TYPES[number]

// ── Discount Modal ─────────────────────────────────────────────────────────────
function DiscountModal({ discount, onClose }: { discount: any | null; onClose: () => void }) {
  const qc     = useQueryClient()
  const t = useT()
  const isEdit = !!discount

  const [form, setForm] = useState({
    name:        discount?.name        ?? '',
    code:        discount?.code        ?? '',
    type:        (discount?.type       ?? 'PERCENTAGE') as DiscountType,
    value:       discount?.value       ?? '',
    minOrder:    discount?.minOrder    ?? '',
    maxUses:     discount?.maxUses     ?? '',
    startsAt:    discount?.startsAt    ? discount.startsAt.slice(0, 10) : '',
    endsAt:      discount?.endsAt      ? discount.endsAt.slice(0, 10)   : '',
    isActive:    discount?.isActive    ?? true,
    description: discount?.description ?? '',
  })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    set('code', code)
  }

  const save = useMutation({
    mutationFn: (d: any) => isEdit ? discountsApi.update(discount.id, d) : discountsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discounts'] })
      toast.success(isEdit ? 'Discount updated!' : 'Discount created!')
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim())  return toast.error('Name is required')
    if (!form.value)        return toast.error('Discount value is required')
    if (form.type === 'PERCENTAGE' && Number(form.value) > 100)
      return toast.error('Percentage cannot exceed 100')

    save.mutate({
      name:        form.name.trim(),
      code:        form.code.trim().toUpperCase() || null,
      type:        form.type,
      value:       Number(form.value),
      minOrder:    form.minOrder  ? Number(form.minOrder)  : null,
      maxUses:     form.maxUses   ? Number(form.maxUses)   : null,
      startsAt:    form.startsAt  ? new Date(form.startsAt).toISOString() : null,
      endsAt:      form.endsAt    ? new Date(form.endsAt).toISOString()   : null,
      isActive:    form.isActive,
      description: form.description.trim() || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-surface z-10">
          <h2 className="text-lg font-bold">{isEdit ? 'Edit Discount' : 'New Discount'}</h2>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Summer Sale" className="input w-full" required />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Optional description for staff…"
              rows={2} className="input w-full resize-none" />
          </div>

          {/* Code */}
          <div>
            <label className="label">Promo Code</label>
            <div className="flex gap-2">
              <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="e.g. SUMMER20" className="input flex-1 font-mono tracking-widest uppercase" maxLength={20} />
              <button type="button" onClick={generateCode}
                className="btn-secondary text-xs px-3 whitespace-nowrap">Auto</button>
            </div>
            <p className="text-xs text-muted mt-1">Leave blank if no code is needed (auto-applied).</p>
          </div>

          {/* Type + Value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type *</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className="input w-full">
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount</option>
              </select>
            </div>
            <div>
              <label className="label">
                Value * {form.type === 'PERCENTAGE' ? '(%)' : '(UZS)'}
              </label>
              <input value={form.value} onChange={e => set('value', e.target.value)}
                type="number" min="0" max={form.type === 'PERCENTAGE' ? 100 : undefined}
                step="any" placeholder={form.type === 'PERCENTAGE' ? '10' : '50000'}
                className="input w-full" required />
            </div>
          </div>

          {/* Min order + Max uses */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Min Order (UZS)</label>
              <input value={form.minOrder} onChange={e => set('minOrder', e.target.value)}
                type="number" min="0" placeholder="Optional" className="input w-full" />
            </div>
            <div>
              <label className="label">Max Uses</label>
              <input value={form.maxUses} onChange={e => set('maxUses', e.target.value)}
                type="number" min="1" placeholder="Unlimited" className="input w-full" />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Starts At</label>
              <input value={form.startsAt} onChange={e => set('startsAt', e.target.value)}
                type="date" className="input w-full" />
            </div>
            <div>
              <label className="label">Ends At</label>
              <input value={form.endsAt} onChange={e => set('endsAt', e.target.value)}
                type="date" className="input w-full" />
            </div>
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
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 disabled:opacity-50">
              {save.isPending ? 'Saving…' : isEdit ? 'Save' : 'Create Discount'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: {
  icon:  React.ReactNode
  label: string
  value: string | number
  sub?:  string
  color: string
}) {
  return (
    <div className="card flex items-center gap-4">
      <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
    </div>
  )
}

// ── Telegram Campaign Panel ────────────────────────────────────────────────────
function CampaignsTab() {
  const [message,  setMessage]  = useState('')
  const [segment,  setSegment]  = useState('ALL')
  const [lastResult, setLastResult] = useState<any>(null)

  const { data: subData } = useQuery({
    queryKey: ['telegram-subscribers'],
    queryFn:  () => api.get('/notifications/subscribers').then(r => r.data),
    retry:    false,
    staleTime: 30_000,
  })

  const send = useMutation({
    mutationFn: (dto: any) => api.post('/notifications/campaign', dto).then(r => r.data),
    onSuccess: (data) => {
      setLastResult(data)
      if (data.sent > 0) {
        toast.success(`Campaign sent to ${data.sent} subscriber(s)`)
        setMessage('')
      } else {
        toast.error('No messages sent — check Telegram setup')
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to send'),
  })

  const SEGS = ['ALL', 'VIP', 'REGULAR', 'INACTIVE']

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Composer */}
      <div className="lg:col-span-2 card space-y-4">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-blue-400" />
          <h3 className="font-semibold text-sm">Telegram Campaign Broadcaster</h3>
        </div>

        <div>
          <label className="label">Target Segment</label>
          <div className="flex gap-1 flex-wrap">
            {SEGS.map(s => (
              <button key={s} onClick={() => setSegment(s)}
                className={clsx('px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                  segment === s
                    ? 'bg-gold-dim border-gold/50 text-gold'
                    : 'border-border bg-surface2 text-muted hover:text-fg')}>
                {s === 'ALL' ? '📢 All Subscribers' : s === 'VIP' ? '👑 VIP' : s === 'REGULAR' ? '👤 Regular' : '💤 Inactive'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label m-0">Message *</label>
            <span className="text-xs text-muted">Supports *bold*, _italic_</span>
          </div>
          {/* Templates */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {TEMPLATES.map(tpl => (
              <button
                key={tpl.label}
                onClick={() => setMessage(tpl.text)}
                className="text-xs px-2 py-1 rounded-lg border border-border bg-surface2 text-muted hover:text-gold hover:border-gold/40 transition-colors"
              >
                {tpl.label}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={5}
            placeholder="Write your promotional message here…
Example: 🎉 Special 20% OFF today only! Use code SALE20 at checkout."
            className="input w-full resize-none font-mono text-sm"
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted">{message.length} chars</span>
            <span className="text-xs text-muted">Supports Telegram Markdown</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setMessage('')} className="btn-secondary text-sm px-4">Clear</button>
          <button
            onClick={() => send.mutate({ message, segment })}
            disabled={!message.trim() || send.isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <Send size={14} />
            {send.isPending ? 'Sending…' : `Send to ${subData?.total ?? '?'} Subscriber(s)`}
          </button>
        </div>

        {/* Last send result */}
        {lastResult && (
          <div className={clsx(
            'rounded-xl border p-3 text-sm',
            lastResult.sent > 0 ? 'border-jade/30 bg-jade/5' : 'border-rose/30 bg-rose/5'
          )}>
            <div className="flex items-center gap-2 font-medium">
              {lastResult.sent > 0
                ? <><CheckCircle2 size={14} className="text-jade" /> {lastResult.sent} delivered</>
                : <><AlertCircle  size={14} className="text-rose" /> Nothing delivered</>
              }
              {lastResult.failed > 0 && <span className="text-rose text-xs ml-2">{lastResult.failed} failed</span>}
            </div>
            {lastResult.errors?.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-muted">
                {lastResult.errors.slice(0, 5).map((e: string, i: number) => <li key={i}>• {e}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Sidebar — Subscribers */}
      <div className="space-y-3">
        <div className="card">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Bot size={14} className="text-blue-400" /> Telegram Subscribers
          </h3>
          {!subData ? (
            <p className="text-xs text-muted">Connect Telegram bot to see subscribers</p>
          ) : (
            <>
              <p className="text-3xl font-bold text-blue-400 mb-1">{subData.total}</p>
              <p className="text-xs text-muted mb-3">Active bot admins</p>
              <div className="space-y-1">
                {(subData.byRole ?? []).map((r: any) => (
                  <div key={r.role} className="flex justify-between text-xs">
                    <span className="text-muted capitalize">{r.role.toLowerCase()}</span>
                    <span className="font-mono font-semibold">{r._count.id}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card text-xs text-muted space-y-1.5">
          <p className="font-medium text-fg text-sm">Setup Instructions</p>
          <p>1. Configure <code className="bg-surface2 px-1 rounded">TELEGRAM_BOT_TOKEN</code> in <code className="bg-surface2 px-1 rounded">backend/.env</code></p>
          <p>2. Start the Telegram bot (<code className="bg-surface2 px-1 rounded">telegram-bot/</code>)</p>
          <p>3. Admins send <code className="bg-surface2 px-1 rounded">/start</code> to the bot to register</p>
          <p>4. Registered admins appear as subscribers above</p>
        </div>
      </div>
    </div>
  )
}

// ── Loyalty Tab ────────────────────────────────────────────────────────────────
function LoyaltyTab() {
  const { data } = useQuery({
    queryKey: ['customers', '', '', 1],
    queryFn:  () => customersApi.list({ limit: 200 }),
  })
  const customers = (data as any)?.data ?? []

  const totalPoints   = customers.reduce((s: number, c: any) => s + c.loyaltyPoints, 0)
  const vipCount      = customers.filter((c: any) => c.segment === 'VIP').length
  const withPoints    = customers.filter((c: any) => c.loyaltyPoints > 0)
  const topByPoints   = [...customers].sort((a: any, b: any) => b.loyaltyPoints - a.loyaltyPoints).slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card flex items-center gap-3">
          <Star size={18} className="text-gold" />
          <div><p className="text-xs text-muted">Total Points Issued</p><p className="font-bold font-mono">{totalPoints.toLocaleString()}</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <Crown size={18} className="text-gold" />
          <div><p className="text-xs text-muted">VIP Customers</p><p className="font-bold text-gold">{vipCount}</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <Users size={18} className="text-jade" />
          <div><p className="text-xs text-muted">Members with Points</p><p className="font-bold text-jade">{withPoints.length}</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <Gift size={18} className="text-purple-400" />
          <div><p className="text-xs text-muted">Avg. Points</p>
            <p className="font-bold">{customers.length ? Math.round(totalPoints / customers.length) : 0}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Star size={14} className="text-gold" /> Top Loyalty Members
        </h3>
        <div className="space-y-2">
          {topByPoints.map((c: any, i: number) => (
            <div key={c.id} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
              <span className="text-xs text-muted w-4 font-mono">{i + 1}</span>
              <div className="w-7 h-7 rounded-full bg-gold-dim border border-gold/30 flex items-center justify-center text-gold text-xs font-bold">
                {c.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-xs text-muted">{c.phone} · {c.segment}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-mono font-bold text-gold">{c.loyaltyPoints.toLocaleString()} pts</div>
                <div className="text-xs text-muted">{fmt.compact(Number(c.totalSpent))} spent</div>
              </div>
            </div>
          ))}
          {!topByPoints.length && <p className="text-xs text-muted text-center py-4">No loyalty members yet</p>}
        </div>
      </div>
    </div>
  )
}

// ── Campaign Templates ────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    label: '🎉 Maxsus taklif',
    text:  'Salom {name}! Bugun bizda maxsus 20% chegirma! Faqat bugun. Kel va tejab qol 🛍️',
  },
  {
    label: '🏆 Loyalty mukofot',
    text:  'Salom {name}! Sizda {points} ta bonus bal bor 🌟 Keyingi xaridingizda chegirma oling!',
  },
  {
    label: '💤 Qaytib keling',
    text:  'Salom {name}! Sizi sog\'inib qoldik 😊 Bir muddat ko\'rishmadiik. Yangi mahsulotlar keldi — keling!',
  },
  {
    label: '🎂 Tug\'ilgan kun',
    text:  'Salom {name}! Tug\'ilgan kuningiz bilan tabriklaymiz! 🎂 Sovg\'a sifatida 15% chegirma — bugun va ertaga.',
  },
  {
    label: '📦 Yangi mahsulot',
    text:  'Salom {name}! Yangi mahsulotlar keldi! Do\'konimizga tashrif buyuring 👗✨',
  },
  {
    label: '🏪 Mavsumiy aksiya',
    text:  'Salom {name}! Mavsumiy chegirmalar boshlandi! Ko\'plab mahsulotlarga 10-30% chegirma. Kel!',
  },
]

// ── Customer Campaign Tab ─────────────────────────────────────────────────────
function CustomerCampaignTab() {
  const [segment,   setSegment]   = useState<'ALL' | 'VIP' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [message,   setMessage]   = useState('')
  const [sent,      setSent]      = useState<Set<string>>(new Set())
  const [showList,  setShowList]  = useState(false)

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['customers-campaign', segment],
    queryFn:  () => customersApi.list({
      limit:   200,
      segment: segment === 'ALL' ? undefined : segment,
    }),
  })

  const customers = useMemo(() => {
    const all = (data as any)?.data ?? []
    if (segment === 'INACTIVE') {
      const cutoff = dayjs().subtract(30, 'day')
      return all.filter((c: any) => {
        const last = c.lastPurchaseAt ?? c.updatedAt
        return !last || dayjs(last).isBefore(cutoff)
      })
    }
    return all
  }, [data, segment])

  const withPhone = customers.filter((c: any) => c.phone)

  const buildMessage = (c: any) =>
    message
      .replace(/\{name\}/g,   c.name  ?? 'Hurmatli mijoz')
      .replace(/\{points\}/g, String(c.loyaltyPoints ?? 0))
      .replace(/\{phone\}/g,  c.phone ?? '')

  const buildWaUrl = (c: any) => {
    const phone = (c.phone ?? '').replace(/\D/g, '')
    const norm  = phone.startsWith('998') ? phone : phone ? `998${phone}` : ''
    if (!norm) return null
    return `https://wa.me/${norm}?text=${encodeURIComponent(buildMessage(c))}`
  }

  const copyAll = () => {
    const text = withPhone
      .map((c: any) => `${c.name ?? '—'}: ${buildMessage(c)}`)
      .join('\n\n---\n\n')
    navigator.clipboard.writeText(text)
    toast.success(`${withPhone.length} ta xabar nusxalandi`)
  }

  const SEGS: { key: typeof segment; label: string; desc: string }[] = [
    { key: 'ALL',      label: '📢 Hammasi',   desc: 'Barcha mijozlar' },
    { key: 'VIP',      label: '👑 VIP',       desc: 'VIP segment'     },
    { key: 'ACTIVE',   label: '✅ Aktiv',     desc: 'Oxirgi 30 kunda xarid qilgan' },
    { key: 'INACTIVE', label: '💤 Nofaol',   desc: '30+ kun xarid yo\'q' },
  ]

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Composer */}
      <div className="lg:col-span-2 space-y-4">
        {/* Segment */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gold" />
            <h3 className="font-semibold text-sm">Segment tanlash</h3>
            <button onClick={() => refetch()} className="ml-auto text-muted hover:text-fg">
              <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SEGS.map(s => (
              <button
                key={s.key}
                onClick={() => setSegment(s.key)}
                className={clsx(
                  'flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all',
                  segment === s.key
                    ? 'border-gold bg-gold-dim text-gold'
                    : 'border-border text-muted hover:border-gold/40 hover:text-fg'
                )}
              >
                <span className="text-base">{s.label.slice(0, 2)}</span>
                <span>{s.label.slice(3)}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">{SEGS.find(s => s.key === segment)?.desc}</span>
            <div className="flex items-center gap-3 font-medium">
              <span className="text-fg">{customers.length} mijoz</span>
              <span className="text-jade">{withPhone.length} ta telefon bor</span>
            </div>
          </div>
        </div>

        {/* Message composer */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={15} className="text-jade" />
            <h3 className="font-semibold text-sm">Xabar yozish</h3>
            <span className="text-xs text-muted ml-auto">Foydalaning: {'{name}'} {'{points}'}</span>
          </div>

          {/* Templates */}
          <div>
            <p className="text-xs text-muted mb-1.5">Tezkor shablonlar:</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map(tpl => (
                <button
                  key={tpl.label}
                  onClick={() => setMessage(tpl.text)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-border bg-surface2 text-muted hover:text-gold hover:border-gold/40 transition-colors"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            placeholder="Xabar yozing yoki yuqoridagi shablondan tanlang...&#10;{name} — mijoz ismi, {points} — bonus ballar"
            className="input w-full resize-none text-sm"
          />
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{message.length} belgi</span>
            <span>{'{name}'} va {'{points}'} avtomatik almashtiriladi</span>
          </div>
        </div>

        {/* Send list */}
        {message.trim() && withPhone.length > 0 && (
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Phone size={14} className="text-jade" />
                {withPhone.length} ta mijozga yuborish
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={copyAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg text-muted hover:text-fg hover:border-gold/40 transition-colors"
                >
                  <Copy size={11} /> Hammasini nusxala
                </button>
                <button
                  onClick={() => setShowList(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gold/40 bg-gold-dim text-gold rounded-lg hover:bg-gold/20 transition-colors"
                >
                  <Phone size={11} /> {showList ? 'Yopish' : 'Ro\'yxatni ko\'rish'}
                </button>
              </div>
            </div>

            {/* Progress */}
            {sent.size > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <div className="flex-1 bg-surface2 rounded-full h-1.5">
                  <div className="bg-jade h-1.5 rounded-full transition-all" style={{ width: `${(sent.size / withPhone.length) * 100}%` }} />
                </div>
                <span className="text-jade font-medium">{sent.size}/{withPhone.length} yuborildi</span>
              </div>
            )}

            {showList && (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {withPhone.map((c: any) => {
                  const waUrl   = buildWaUrl(c)
                  const isSent  = sent.has(c.id)
                  return (
                    <div key={c.id} className={clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-lg border transition-all',
                      isSent ? 'border-jade/30 bg-jade/5' : 'border-border bg-surface2'
                    )}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{c.name ?? '—'}</span>
                          {c.loyaltyPoints > 0 && (
                            <span className="text-[10px] text-gold bg-gold/10 px-1.5 rounded-full">
                              ⭐{c.loyaltyPoints}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted font-mono">{c.phone}</span>
                      </div>
                      {isSent ? (
                        <CheckCircle2 size={16} className="text-jade flex-shrink-0" />
                      ) : waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setSent(prev => new Set([...prev, c.id]))}
                          className="flex items-center gap-1.5 px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-medium transition-colors flex-shrink-0"
                        >
                          <Send size={11} /> WA
                        </a>
                      ) : (
                        <span className="text-xs text-muted">Raqam yo'q</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-3">
        {/* Stats */}
        <div className="card space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Zap size={14} className="text-gold" /> Kampaniya statistikasi
          </h3>
          {[
            { label: 'Tanlangan segment', val: customers.length + ' ta' },
            { label: 'Telefon bor', val: withPhone.length + ' ta' },
            { label: 'Yuborildi', val: sent.size + ' ta', color: 'text-jade' },
            { label: 'Qoldi', val: (withPhone.length - sent.size) + ' ta', color: 'text-amber-400' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <span className="text-muted text-xs">{item.label}</span>
              <span className={clsx('font-bold font-mono text-sm', item.color ?? 'text-fg')}>{item.val}</span>
            </div>
          ))}
          {sent.size > 0 && (
            <button onClick={() => setSent(new Set())}
              className="w-full text-xs text-muted hover:text-rose border border-border hover:border-rose/40 rounded-lg py-1.5 transition-colors mt-1">
              Hisoblagichni tiklash
            </button>
          )}
        </div>

        {/* Tips */}
        <div className="card text-xs text-muted space-y-2">
          <p className="font-medium text-fg text-sm">💡 Maslahat</p>
          <p>• <strong className="text-fg">{'{name}'}</strong> — mijoz ismi bilan almashadi</p>
          <p>• <strong className="text-fg">{'{points}'}</strong> — loyalty ballar</p>
          <p>• WhatsApp tugmasi bosilsa — belgilanadi</p>
          <p>• "Hammasini nusxala" — barcha xabarlarni clipboard ga oladi</p>
          <p className="text-jade">✅ Yuborilgan mijozlar yashil rangda</p>
        </div>
      </div>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
type Tab = 'discounts' | 'loyalty' | 'campaigns' | 'customer-campaigns'

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MarketingPage() {
  const t = useT()
  const [tab, setTab]          = useState<Tab>('discounts')
  const [modal, setModal]      = useState(false)
  const [editing, setEditing]  = useState<any>(null)
  const qc = useQueryClient()

  const { data: discounts = [], isLoading } = useQuery<any[]>({
    queryKey: ['discounts'],
    queryFn:  discountsApi.list,
    // If API doesn't exist yet, show empty gracefully
    retry: false,
  })

  const remove = useMutation({
    mutationFn: discountsApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['discounts'] }); toast.success('Deleted') },
    onError: () => toast.error('Delete failed'),
  })

  const openCreate = () => { setEditing(null); setModal(true) }
  const openEdit   = (d: any) => { setEditing(d); setModal(true) }

  const activeDiscounts = discounts.filter((d: any) => d.isActive)

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'discounts',          label: 'Discounts & Codes', icon: <BadgePercent size={15} /> },
    { id: 'campaigns',          label: 'Telegram',          icon: <Tag size={15} />          },
    { id: 'customer-campaigns', label: 'WhatsApp Kampaniya', icon: <MessageSquare size={15} /> },
    { id: 'loyalty',            label: 'Loyalty',           icon: <Star size={15} />         },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t.marketing.title}</h1>
          <p className="text-sm text-muted mt-0.5">Promotions, discounts & customer loyalty</p>
        </div>
        {tab === 'discounts' && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> New Discount
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<BadgePercent size={20} className="text-purple-400" />}
          label="Active Discounts" value={activeDiscounts.length}
          color="bg-purple-900/20 border border-purple-900/40" />
        <StatCard icon={<Percent size={20} className="text-blue-400" />}
          label="Total Discounts" value={discounts.length}
          color="bg-blue-900/20 border border-blue-900/40" />
        <StatCard icon={<Users size={20} className="text-jade" />}
          label="Total Customers" value={discounts ? '—' : '—'}
          sub="View Loyalty tab"
          color="bg-jade/10 border border-jade/30" />
        <StatCard icon={<Gift size={20} className="text-gold" />}
          label="Campaigns Sent" value="Telegram"
          sub="View Campaigns tab"
          color="bg-gold-dim border border-gold/30" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface2 rounded-xl p-1 w-fit">
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === tb.id ? 'bg-surface text-white shadow' : 'text-muted hover:text-white')}>
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      {/* Discounts Tab */}
      {tab === 'discounts' && (
        <>
          {isLoading ? (
            <div className="text-center py-16 text-muted">{t.common.loading}</div>
          ) : discounts.length === 0 ? (
            <div className="text-center py-16 text-muted card">
              <BadgePercent size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No discounts yet</p>
              <p className="text-sm mt-1">Create your first discount or promo code</p>
              <button onClick={openCreate} className="btn-primary mt-4 inline-flex items-center gap-2">
                <Plus size={14} /> New Discount
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {discounts.map((d: any) => (
                <div key={d.id} className="card hover:border-gold/20 transition-colors group flex items-center gap-4">
                  {/* Icon */}
                  <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    d.type === 'PERCENTAGE'
                      ? 'bg-purple-900/20 border border-purple-900/40 text-purple-400'
                      : 'bg-gold-dim border border-gold/30 text-gold')}>
                    {d.type === 'PERCENTAGE' ? <Percent size={18} /> : <Tag size={18} />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{d.name}</span>
                      {d.code && (
                        <span className="text-xs font-mono bg-surface2 border border-border px-2 py-0.5 rounded text-gold tracking-wider">
                          {d.code}
                        </span>
                      )}
                      <span className={clsx('text-xs ml-1', d.isActive ? 'text-jade' : 'text-rose')}>
                        ● {d.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted">
                      <span>
                        {d.type === 'PERCENTAGE' ? `${d.value}% off` : `${Number(d.value).toLocaleString()} UZS off`}
                      </span>
                      {d.minOrder && <span>Min: {Number(d.minOrder).toLocaleString()} UZS</span>}
                      {d.maxUses  && <span>Max uses: {d.maxUses}</span>}
                      {d.endsAt   && (
                        <span className="flex items-center gap-1">
                          <Calendar size={10} /> Ends {new Date(d.endsAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(d)}
                      className="p-1.5 rounded-lg hover:bg-surface2 text-muted hover:text-white">
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${d.name}"?`)) remove.mutate(d.id)
                      }}
                      className="p-1.5 rounded-lg hover:bg-rose/10 text-muted hover:text-rose">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Campaigns Tab */}
      {tab === 'campaigns' && <CampaignsTab />}

      {/* Customer Campaigns Tab */}
      {tab === 'customer-campaigns' && <CustomerCampaignTab />}

      {/* Loyalty Tab */}
      {tab === 'loyalty' && <LoyaltyTab />}

      {/* Modal */}
      {modal && (
        <DiscountModal
          discount={editing}
          onClose={() => { setModal(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
