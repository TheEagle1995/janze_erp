import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { financeApi, branchesApi, usersApi } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { fmt } from '../utils/format'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import clsx from 'clsx'
import {
  Clock, Play, Square, CheckCircle2, AlertTriangle,
  Banknote, CreditCard, Smartphone, TrendingDown,
  RefreshCw, X, ChevronDown, Printer, History,
  ShieldAlert, Users, Building2,
} from 'lucide-react'

dayjs.extend(duration)

// ── Types ────────────────────────────────────────────────────────────────────
interface Shift {
  id:              string
  branchId:        string
  cashierId:       string
  branchName?:     string
  cashierName?:    string
  shiftDate:       string
  shiftStart:      string
  shiftEnd?:       string
  status:          'OPEN' | 'BALANCED' | 'DISCREPANCY'
  openingCash:     number
  expectedCash:    number
  countedCash?:    number
  difference?:     number
  discrepancyNote?:string
  liveStats?: {
    orderCount:       number
    totalRevenue:     number
    cashSales:        number
    cardSales:        number
    transferSales:    number
    debtSales:        number
  }
}

const STATUS_CONFIG = {
  OPEN:        { label: 'Faol',      color: 'text-jade   bg-jade/10   border-jade/30'   },
  BALANCED:    { label: 'Balanslangan', color: 'text-blue-400 bg-blue-900/20 border-blue-700/30' },
  DISCREPANCY: { label: 'Farq bor',  color: 'text-rose   bg-rose/10   border-rose/30'   },
}

const PAY_ICONS: Record<string, any> = {
  CASH:     Banknote,
  CARD:     CreditCard,
  TRANSFER: Smartphone,
  DEBT:     TrendingDown,
}
const PAY_LABELS: Record<string, string> = {
  CASH: 'Naqd', CARD: 'Karta', TRANSFER: "O'tkazma", DEBT: 'Qarz',
}

// ── Live timer ────────────────────────────────────────────────────────────────
function useShiftTimer(startTime?: string) {
  const [elapsed, setElapsed] = useState('')
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!startTime) return
    const update = () => {
      const secs = dayjs().diff(dayjs(startTime), 'second')
      const h = Math.floor(secs / 3600)
      const m = Math.floor((secs % 3600) / 60)
      const s = secs % 60
      setElapsed(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`)
    }
    update()
    ref.current = setInterval(update, 1000)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [startTime])

  return elapsed
}

// ── Open Shift Modal ─────────────────────────────────────────────────────────
function OpenShiftModal({ onClose }: { onClose: () => void }) {
  const qc   = useQueryClient()
  const user = useAuthStore(s => s.user)

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn:  () => branchesApi.list(),
  })
  const { data: cashiers = [] } = useQuery({
    queryKey: ['sellers'],
    queryFn:  () => usersApi.list({ roles: 'CASHIER,MANAGER,ADMIN,SUPER_ADMIN' }),
  })

  const [branchId,   setBranchId]   = useState((user as any)?.branchId ?? '')
  const [cashierId,  setCashierId]  = useState(user?.id ?? '')
  const [openingCash,setOpeningCash]= useState('')

  const open = useMutation({
    mutationFn: () => financeApi.openShift({
      branchId,
      cashierId,
      openingCash: Number(openingCash.replace(/\s/g, '') || 0),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift'] })
      toast.success('Smena ochildi! ✅')
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Xatolik'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Play size={16} className="text-jade" /> Smena ochish
          </h2>
          <button onClick={onClose} className="text-muted hover:text-fg"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="label">Filial *</label>
            <select value={branchId} onChange={e => setBranchId(e.target.value)} className="input w-full">
              <option value="">— Tanlang —</option>
              {(branches as any[]).map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Kassir *</label>
            <select value={cashierId} onChange={e => setCashierId(e.target.value)} className="input w-full">
              <option value="">— Tanlang —</option>
              {(cashiers as any[]).map((u: any) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Boshlang'ich naqd pul (UZS)</label>
            <input
              value={openingCash}
              onChange={e => setOpeningCash(e.target.value)}
              placeholder="0"
              className="input w-full font-mono text-lg"
              type="number"
              min="0"
            />
            <p className="text-xs text-muted mt-1">Kassadagi mavjud naqd pul miqdori</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Bekor</button>
            <button
              onClick={() => open.mutate()}
              disabled={!branchId || !cashierId || open.isPending}
              className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Play size={14} />
              {open.isPending ? 'Ochilmoqda…' : 'Smenani ochish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Close Shift Modal ─────────────────────────────────────────────────────────
function CloseShiftModal({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const qc = useQueryClient()
  const [countedCash,      setCountedCash]      = useState('')
  const [discrepancyNote,  setDiscrepancyNote]  = useState('')

  const counted  = Number(countedCash.replace(/\s/g, '') || 0)
  const expected = shift.expectedCash || shift.openingCash + (shift.liveStats?.cashSales ?? 0)
  const diff     = counted - expected
  const isOver   = diff > 0
  const isShort  = diff < 0
  const balanced = Math.abs(diff) <= 5000

  const close = useMutation({
    mutationFn: () => financeApi.closeShift(shift.id, {
      countedCash:     counted,
      discrepancyNote: discrepancyNote || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift'] })
      qc.invalidateQueries({ queryKey: ['shift-history'] })
      toast.success('Smena yopildi!')
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Xatolik'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Square size={16} className="text-rose" /> Smena yopish
          </h2>
          <button onClick={onClose} className="text-muted hover:text-fg"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Expected summary */}
          <div className="bg-surface2 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Boshlang'ich naqd</span>
              <span className="font-mono">{fmt.currency(shift.openingCash)} UZS</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">+ Naqd sotuvlar</span>
              <span className="font-mono text-jade">+{fmt.currency(shift.liveStats?.cashSales ?? 0)} UZS</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between font-semibold">
              <span>Kutilgan naqd</span>
              <span className="font-mono text-gold">{fmt.currency(expected)} UZS</span>
            </div>
          </div>

          {/* Counted cash input */}
          <div>
            <label className="label">Hisoblangan naqd pul (UZS) *</label>
            <input
              autoFocus
              value={countedCash}
              onChange={e => setCountedCash(e.target.value)}
              placeholder="0"
              className="input w-full font-mono text-xl"
              type="number"
              min="0"
            />
          </div>

          {/* Difference indicator */}
          {counted > 0 && (
            <div className={clsx(
              'rounded-xl p-3 flex items-center justify-between',
              balanced  ? 'bg-jade/10 border border-jade/30'
              : isShort ? 'bg-rose/10  border border-rose/30'
              :           'bg-gold/10  border border-gold/30',
            )}>
              <div className="flex items-center gap-2">
                {balanced
                  ? <CheckCircle2 size={16} className="text-jade" />
                  : <AlertTriangle size={16} className={isShort ? 'text-rose' : 'text-gold'} />
                }
                <span className="text-sm font-medium">
                  {balanced ? 'Balanslangan ✅'
                   : isShort ? 'Kamomad ⚠️'
                   :           'Ortiqcha ⚠️'}
                </span>
              </div>
              <span className={clsx(
                'font-mono font-bold',
                balanced ? 'text-jade' : isShort ? 'text-rose' : 'text-gold',
              )}>
                {diff >= 0 ? '+' : ''}{fmt.currency(Math.abs(diff))} UZS
              </span>
            </div>
          )}

          {/* Discrepancy note */}
          {counted > 0 && !balanced && (
            <div>
              <label className="label">Izoh (majburiy emas)</label>
              <textarea
                value={discrepancyNote}
                onChange={e => setDiscrepancyNote(e.target.value)}
                placeholder="Sabab yoki tushuntirish…"
                rows={2}
                className="input w-full resize-none"
              />
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1">Bekor</button>
            <button
              onClick={() => close.mutate()}
              disabled={!countedCash || close.isPending}
              className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2 bg-rose hover:bg-rose/90"
            >
              <Square size={14} />
              {close.isPending ? 'Yopilmoqda…' : 'Smenani yopish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Z-Report ──────────────────────────────────────────────────────────────────
function ZReport({ shift }: { shift: Shift }) {
  const handlePrint = () => window.print()

  const duration = shift.shiftEnd
    ? dayjs(shift.shiftEnd).diff(dayjs(shift.shiftStart), 'minute')
    : null

  return (
    <div className="card border-gold/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          <Printer size={16} className="text-gold" /> Z-Hisobot
        </h3>
        <button onClick={handlePrint}
          className="text-xs flex items-center gap-1 text-muted hover:text-gold transition-colors">
          <Printer size={12} /> Chop etish
        </button>
      </div>

      <div className="space-y-1 text-sm font-mono">
        <div className="text-center py-2 border-b border-dashed border-border mb-3">
          <div className="font-bold text-base">{shift.branchName ?? 'Filial'}</div>
          <div className="text-muted text-xs">Z-HISOBOT</div>
          <div className="text-xs">{dayjs(shift.shiftDate).format('DD.MM.YYYY')}</div>
        </div>

        <div className="flex justify-between"><span className="text-muted">Kassir:</span><span>{shift.cashierName}</span></div>
        <div className="flex justify-between"><span className="text-muted">Smena boshlandi:</span><span>{dayjs(shift.shiftStart).format('HH:mm')}</span></div>
        {shift.shiftEnd && (
          <div className="flex justify-between"><span className="text-muted">Smena tugadi:</span><span>{dayjs(shift.shiftEnd).format('HH:mm')}</span></div>
        )}
        {duration !== null && (
          <div className="flex justify-between"><span className="text-muted">Davomiyligi:</span><span>{Math.floor(duration/60)}h {duration%60}m</span></div>
        )}

        <div className="border-t border-dashed border-border my-2 pt-2">
          <div className="flex justify-between font-bold"><span>Boshlang'ich naqd:</span><span>{fmt.currency(shift.openingCash)}</span></div>
          <div className="flex justify-between text-jade"><span>+ Naqd sotuvlar:</span><span>+{fmt.currency(shift.liveStats?.cashSales ?? (shift.expectedCash - shift.openingCash))}</span></div>
          <div className="flex justify-between text-gold font-bold border-t border-dashed border-border mt-1 pt-1">
            <span>KUTILGAN:</span><span>{fmt.currency(shift.expectedCash)}</span>
          </div>
          <div className="flex justify-between"><span>Hisoblangan:</span><span>{fmt.currency(shift.countedCash ?? 0)}</span></div>
          <div className={clsx('flex justify-between font-bold',
            (shift.difference ?? 0) === 0 ? 'text-jade' : (shift.difference ?? 0) > 0 ? 'text-gold' : 'text-rose')}>
            <span>Farq:</span>
            <span>{(shift.difference ?? 0) >= 0 ? '+' : ''}{fmt.currency(shift.difference ?? 0)}</span>
          </div>
        </div>

        <div className="flex justify-between font-bold border-t border-dashed border-border pt-2">
          <span>Jami sotuv:</span>
          <span>{fmt.currency(shift.liveStats?.totalRevenue ?? 0)}</span>
        </div>

        <div className="text-center mt-3 text-muted text-xs border-t border-dashed border-border pt-2">
          AVERO × Janze ERP
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SmenaPage() {
  const user = useAuthStore(s => s.user)
  const [openModal,  setOpenModal]  = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [tab,        setTab]        = useState<'active' | 'history'>('active')
  const [historyDays, setHistoryDays] = useState(7)

  const branchId  = (user as any)?.branchId
  const cashierId = user?.id

  const { data: shift, isLoading, refetch } = useQuery<Shift | null>({
    queryKey:      ['shift', branchId, cashierId],
    queryFn:       () => financeApi.currentShift(branchId, cashierId),
    refetchInterval: 30_000,
    retry:         false,
  })

  const { data: history = [], isLoading: histLoading } = useQuery<Shift[]>({
    queryKey: ['shift-history', branchId, historyDays],
    queryFn:  () => financeApi.shiftHistory(branchId, historyDays),
    enabled:  tab === 'history',
  })

  const elapsed = useShiftTimer(shift?.shiftStart)

  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes((user as any)?.role ?? '')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Smena boshqaruvi</h1>
          <p className="text-sm text-muted mt-0.5">Kassir smenasini ochish va yopish</p>
        </div>
        <button onClick={() => refetch()}
          className="p-2 rounded-xl text-muted hover:text-fg hover:bg-surface2 transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        {([
          { key: 'active',  label: 'Joriy smena', icon: Clock   },
          { key: 'history', label: 'Tarix',        icon: History },
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

      {/* ══ ACTIVE SHIFT TAB ══ */}
      {tab === 'active' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-20 text-muted">
              <RefreshCw size={24} className="mx-auto mb-3 animate-spin opacity-40" />
              <p>Yuklanmoqda…</p>
            </div>
          ) : shift ? (
            /* ── Active shift ── */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Main shift card */}
              <div className="lg:col-span-2 space-y-4">
                <div className="card border-jade/30 bg-jade/5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-jade animate-pulse" />
                        <span className="text-jade text-sm font-medium">Smena faol</span>
                      </div>
                      <div className="font-mono text-4xl font-bold text-gold tracking-wider">
                        {elapsed}
                      </div>
                      <div className="text-sm text-muted mt-1">
                        {dayjs(shift.shiftStart).format('DD.MM.YYYY, HH:mm')} dan boshlab
                      </div>
                    </div>
                    <button
                      onClick={() => setCloseModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose/10 border border-rose/30
                        text-rose hover:bg-rose/20 transition-colors font-medium text-sm"
                    >
                      <Square size={14} /> Smenani yopish
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-jade/20">
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 size={14} className="text-muted" />
                      <span className="text-muted">Filial:</span>
                      <span className="font-medium">{shift.branchName ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users size={14} className="text-muted" />
                      <span className="text-muted">Kassir:</span>
                      <span className="font-medium">{shift.cashierName ?? '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Live stats grid */}
                {shift.liveStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Buyurtmalar', value: String(shift.liveStats.orderCount), sub: 'ta' },
                      { label: 'Jami sotuv',  value: fmt.compact(shift.liveStats.totalRevenue), sub: 'UZS', color: 'text-gold' },
                      { label: 'Boshlang\'ich', value: fmt.compact(shift.openingCash), sub: 'UZS' },
                      { label: 'Naqd sotuvlar', value: fmt.compact(shift.liveStats.cashSales), sub: 'UZS', color: 'text-jade' },
                    ].map(({ label, value, sub, color }) => (
                      <div key={label} className="card py-3 px-4">
                        <div className="text-xs text-muted uppercase tracking-wide mb-1">{label}</div>
                        <div className={clsx('text-xl font-bold font-mono', color)}>{value}</div>
                        <div className="text-xs text-muted">{sub}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Payment breakdown */}
                {shift.liveStats && (
                  <div className="card">
                    <div className="text-sm font-medium mb-3">To'lov usullari bo'yicha</div>
                    <div className="space-y-2">
                      {(['CASH','CARD','TRANSFER','DEBT'] as const).map(method => {
                        const amount = (shift.liveStats as any)?.[`${method.toLowerCase()}Sales`] ?? 0
                        if (amount === 0) return null
                        const total  = shift.liveStats!.totalRevenue || 1
                        const pct    = Math.round((amount / total) * 100)
                        const Icon   = PAY_ICONS[method]
                        return (
                          <div key={method}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="flex items-center gap-1.5 text-muted">
                                <Icon size={12} /> {PAY_LABELS[method]}
                              </span>
                              <span className="font-mono font-medium">{fmt.currency(amount)} UZS</span>
                            </div>
                            <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                              <div className="h-full bg-gold/60 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Z-Report sidebar */}
              <div>
                <ZReport shift={shift} />
              </div>
            </div>

          ) : (
            /* ── No active shift ── */
            <div className="card text-center py-16">
              <div className="w-20 h-20 rounded-full bg-surface2 border border-border flex items-center
                justify-center mx-auto mb-4">
                <Clock size={36} className="text-muted opacity-50" />
              </div>
              <h3 className="text-lg font-bold mb-1">Faol smena yo'q</h3>
              <p className="text-sm text-muted mb-6">
                Kassir ishlashni boshlash uchun smenani oching.<br />
                Smena davomida barcha sotuvlar hisobga olinadi.
              </p>
              <button
                onClick={() => setOpenModal(true)}
                className="btn-primary inline-flex items-center gap-2 text-base px-6 py-2.5"
              >
                <Play size={16} /> Smenani ochish
              </button>

              {isAdmin && (
                <p className="text-xs text-muted mt-4 flex items-center justify-center gap-1">
                  <ShieldAlert size={11} />
                  Admin sifatida istalgan kassir uchun smena ocha olasiz
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ HISTORY TAB ══ */}
      {tab === 'history' && (
        <div className="space-y-4">
          {/* Period filter */}
          <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
            {[
              { days: 1,  label: 'Bugun'  },
              { days: 7,  label: '7 kun'  },
              { days: 30, label: '30 kun' },
            ].map(p => (
              <button key={p.days} onClick={() => setHistoryDays(p.days)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  historyDays === p.days ? 'bg-gold text-black' : 'text-muted hover:text-fg')}>
                {p.label}
              </button>
            ))}
          </div>

          {histLoading ? (
            <div className="text-center py-16 text-muted">Yuklanmoqda…</div>
          ) : (history as Shift[]).length === 0 ? (
            <div className="text-center py-16 text-muted">
              <History size={48} className="mx-auto mb-3 opacity-30" />
              <p>Tanlangan davrda smena tarixi yo'q</p>
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Sana','Kassir','Filial','Ochildi','Yopildi','Boshlang\'ich','Kutilgan','Hisoblangan','Farq','Holat'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(history as Shift[]).map((s: Shift) => {
                      const cfg    = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.OPEN
                      const diff   = s.difference ?? 0
                      const durMin = s.shiftEnd
                        ? dayjs(s.shiftEnd).diff(dayjs(s.shiftStart), 'minute')
                        : null
                      return (
                        <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface2/50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            {dayjs(s.shiftDate).format('DD.MM.YY')}
                          </td>
                          <td className="px-4 py-3">{s.cashierName ?? '—'}</td>
                          <td className="px-4 py-3 text-muted">{s.branchName ?? '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs">{dayjs(s.shiftStart).format('HH:mm')}</td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {s.shiftEnd ? dayjs(s.shiftEnd).format('HH:mm') : (
                              <span className="text-jade">Faol</span>
                            )}
                            {durMin !== null && (
                              <span className="text-muted ml-1 text-xs">({Math.floor(durMin/60)}h{durMin%60}m)</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-right">{fmt.compact(s.openingCash)}</td>
                          <td className="px-4 py-3 font-mono text-right">{fmt.compact(s.expectedCash)}</td>
                          <td className="px-4 py-3 font-mono text-right">
                            {s.countedCash != null ? fmt.compact(s.countedCash) : '—'}
                          </td>
                          <td className={clsx('px-4 py-3 font-mono text-right font-medium',
                            diff === 0 ? 'text-muted' : diff > 0 ? 'text-gold' : 'text-rose')}>
                            {s.countedCash != null
                              ? `${diff >= 0 ? '+' : ''}${fmt.compact(diff)}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={clsx('text-xs px-2 py-0.5 rounded border font-medium', cfg.color)}>
                              {cfg.label}
                            </span>
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

      {/* Modals */}
      {openModal  && <OpenShiftModal  onClose={() => setOpenModal(false)} />}
      {closeModal && shift && <CloseShiftModal shift={shift} onClose={() => setCloseModal(false)} />}
    </div>
  )
}
