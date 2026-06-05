import { useState }  from 'react'
import { inventoryApi, branchesApi } from '../lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore }  from '../store/authStore'
import { useT }          from '../i18n'
import { fmt }           from '../utils/format'
import toast             from 'react-hot-toast'
import dayjs             from 'dayjs'
import {
  AlertTriangle, Package, X, Plus, Minus,
  ArrowRightLeft, History, DollarSign, ChevronLeft, ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'

// ── Movement type config ──────────────────────────────────────────────────────
const MOVE_COLOR: Record<string, string> = {
  SALE:        'text-rose      bg-rose/10      border-rose/30',
  PURCHASE:    'text-jade      bg-jade/10      border-jade/30',
  TRANSFER:    'text-blue-400  bg-blue-900/20  border-blue-900/40',
  ADJUSTMENT:  'text-amber-400 bg-amber-900/20 border-amber-900/40',
  RETURN:      'text-purple-400 bg-purple-900/20 border-purple-900/40',
  WRITE_OFF:   'text-muted     bg-surface2     border-border',
}

// ── Stock Adjustment Modal ────────────────────────────────────────────────────
function AdjustModal({ item, onClose }: { item: any; onClose: () => void }) {
  const t  = useT()
  const qc = useQueryClient()
  const [qty,    setQty]    = useState('0')
  const [reason, setReason] = useState('')

  const adjust = useMutation({
    mutationFn: ({ quantity, note }: { quantity: number; note: string | null }) =>
      inventoryApi.adjust({ variantId: item.variantId, branchId: item.branchId, quantity, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['low-stock'] })
      qc.invalidateQueries({ queryKey: ['inv-movements'] })
      toast.success(t.notifications.saved)
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? t.errors.saveFailed),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = parseInt(qty)
    if (isNaN(n) || n === 0) return toast.error(t.inventory.enterQty)
    adjust.mutate({ quantity: n, note: reason.trim() || null })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-bold text-fg text-sm">{t.inventory.adjustStock}</h2>
            <p className="text-xs text-muted mt-0.5">{item.variant?.product?.name} · {[item.variant?.size, item.variant?.color].filter(Boolean).join(' / ')}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-center py-2">
            <div className="text-xs text-muted mb-1">{t.inventory.currentStock}</div>
            <div className="text-3xl font-bold font-mono text-fg">{item.quantity}</div>
          </div>
          <div>
            <label className="label">{t.inventory.adjustment} (+ add / - remove)</label>
            <div className="flex gap-2 items-center">
              <button type="button" onClick={() => setQty(v => String(Number(v) - 1))}
                className="w-9 h-9 rounded-lg bg-surface2 border border-border flex items-center justify-center hover:bg-border transition-colors">
                <Minus size={14} />
              </button>
              <input value={qty} onChange={e => setQty(e.target.value)} type="number"
                className="input text-center font-mono flex-1" />
              <button type="button" onClick={() => setQty(v => String(Number(v) + 1))}
                className="w-9 h-9 rounded-lg bg-surface2 border border-border flex items-center justify-center hover:bg-border transition-colors">
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div>
            <label className="label">{t.inventory.reason}</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="input">
              <option value="">{t.common.select}</option>
              <option value="received">{t.inventory.received}</option>
              <option value="returned">{t.inventory.returned}</option>
              <option value="damaged">{t.inventory.damaged}</option>
              <option value="correction">{t.inventory.manualCorrect}</option>
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t.common.cancel}</button>
            <button type="submit" disabled={adjust.isPending} className="btn-primary flex-1 disabled:opacity-50">
              {adjust.isPending ? t.common.loading : t.inventory.adjustStock}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Stock Transfer Modal ──────────────────────────────────────────────────────
function TransferModal({ item, onClose }: { item: any; onClose: () => void }) {
  const t  = useT()
  const qc = useQueryClient()

  const [qty,        setQty]    = useState('1')
  const [toBranchId, setTo]     = useState('')

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ['branches'],
    queryFn:  () => branchesApi.list(),
  })

  const transfer = useMutation({
    mutationFn: (d: any) => inventoryApi.transfer(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['inv-movements'] })
      toast.success(t.inventory.transferSuccess)
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? t.inventory.failedTransfer),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!toBranchId) return toast.error(t.inventory.selectBranch)
    const q = parseInt(qty)
    if (!q || q <= 0) return toast.error(t.inventory.validQty)
    if (q > item.quantity) return toast.error(`${t.inventory.available}: ${item.quantity}`)
    transfer.mutate({
      variantId:    item.variantId,
      fromBranchId: item.branchId,
      toBranchId,
      quantity:     q,
    })
  }

  const otherBranches = (branches as any[]).filter(b => b.id !== item.branchId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-bold text-sm flex items-center gap-2">
              <ArrowRightLeft size={15} className="text-blue-400" /> {t.inventory.transferStock}
            </h2>
            <p className="text-xs text-muted mt-0.5">{item.variant?.product?.name}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="bg-surface2 rounded-xl p-3 text-sm">
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>{t.inventory.from}</span>
              <span>{t.inventory.available}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">{item.branch?.name ?? t.inventory.currentBranch}</span>
              <span className="font-mono font-bold text-jade">{item.quantity}</span>
            </div>
          </div>

          <div>
            <label className="label">{t.inventory.destBranch} *</label>
            <select value={toBranchId} onChange={e => setTo(e.target.value)} className="input w-full">
              <option value="">— {t.common.select} —</option>
              {otherBranches.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {otherBranches.length === 0 && (
              <p className="text-xs text-amber-400 mt-1">{t.inventory.noOtherBranch}</p>
            )}
          </div>

          <div>
            <label className="label">{t.inventory.qtyToTransfer} *</label>
            <div className="flex gap-2 items-center">
              <button type="button" onClick={() => setQty(v => String(Math.max(1, Number(v) - 1)))}
                className="w-9 h-9 rounded-lg bg-surface2 border border-border flex items-center justify-center hover:bg-border">
                <Minus size={14} />
              </button>
              <input value={qty} onChange={e => setQty(e.target.value)} type="number" min="1"
                max={item.quantity} className="input text-center font-mono flex-1" />
              <button type="button" onClick={() => setQty(v => String(Math.min(item.quantity, Number(v) + 1)))}
                className="w-9 h-9 rounded-lg bg-surface2 border border-border flex items-center justify-center hover:bg-border">
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t.common.cancel}</button>
            <button type="submit" disabled={transfer.isPending || otherBranches.length === 0}
              className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2">
              <ArrowRightLeft size={13} />
              {transfer.isPending ? t.inventory.transferring : t.inventory.transferBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type Tab = 'stock' | 'movements' | 'valuation'

export default function InventoryPage() {
  const t        = useT()
  const branchId = useAuthStore(s => s.user?.branchId)
  const [tab,        setTab]        = useState<Tab>('stock')
  const [adjustItem, setAdjustItem] = useState<any>(null)
  const [transferItem, setTransfer] = useState<any>(null)
  const [movPage,    setMovPage]    = useState(1)
  const [movType,    setMovType]    = useState('ALL')

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock', branchId],
    queryFn:  () => inventoryApi.lowStock(branchId),
  })

  const { data: inv, isLoading } = useQuery({
    queryKey: ['inventory', branchId],
    queryFn:  () => inventoryApi.list({ branchId, limit: 200 }),
    select:   (d: any) => d.data,
  })

  const { data: movData } = useQuery({
    queryKey: ['inv-movements', branchId, movType, movPage],
    queryFn:  () => inventoryApi.movements({
      branchId,
      type:  movType === 'ALL' ? undefined : movType,
      page:  movPage,
      limit: 30,
    }),
    enabled: tab === 'movements',
  })

  const movements  = (movData as any)?.data ?? []
  const movMeta    = (movData as any)?.meta ?? {}
  const invItems   = (inv ?? []) as any[]

  // ── Valuation ─────────────────────────────────────────────────
  const totalCostValue = invItems.reduce((sum, i) =>
    sum + i.quantity * Number(i.variant?.product?.costPrice ?? 0), 0)
  const totalSellValue = invItems.reduce((sum, i) =>
    sum + i.quantity * Number(i.variant?.product?.sellPrice ?? 0), 0)
  const totalUnits     = invItems.reduce((sum, i) => sum + i.quantity, 0)

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'stock',     label: t.inventory.stockTab,  icon: Package    },
    { id: 'movements', label: t.inventory.historyTab, icon: History   },
    { id: 'valuation', label: t.inventory.valuation,  icon: DollarSign },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-fg">{t.inventory.title}</h1>
        <span className="text-sm text-muted">{invItems.length} {t.inventory.title.toLowerCase()} items</span>
      </div>

      {/* Low stock alerts */}
      {(lowStock as any[])?.length > 0 && (
        <div className="bg-rose/10 border border-rose/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-rose mb-3 font-semibold text-sm">
            <AlertTriangle size={16} />
            {(lowStock as any[]).length} {t.inventory.lowStock} {(lowStock as any[]).length === 1 ? 'Alert' : 'Alerts'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(lowStock as any[]).map((item: any) => (
              <button key={item.id} onClick={() => setAdjustItem(item)}
                className={clsx('rounded-lg p-3 text-sm text-left hover:scale-[1.01] transition-transform',
                  item.severity === 'critical' ? 'bg-rose/10 border border-rose/30' : 'bg-surface2 border border-border')}>
                <div className="font-medium text-fg truncate">{item.variant?.product?.name}</div>
                <div className="text-xs text-muted">{[item.variant?.size, item.variant?.color].filter(Boolean).join(' / ')}</div>
                <div className={clsx('text-xs mt-1.5 font-bold', item.severity === 'critical' ? 'text-rose' : 'text-amber-400')}>
                  {item.quantity} left · {t.inventory.threshold}: {item.lowStockThreshold}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface2 rounded-xl p-1 border border-border w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === id ? 'bg-surface text-white shadow' : 'text-muted hover:text-white')}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Stock ── */}
      {tab === 'stock' && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface2">
                  {[t.orders.colProduct, t.products.sku, t.products.size, t.products.color, t.common.branch, t.inventory.currentStock, t.inventory.reserved, t.inventory.available, t.inventory.threshold, ''].map((h, i) => (
                    <th key={i} className="text-left px-4 py-3 text-xs font-medium text-muted whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={10} className="text-center py-8 text-muted">{t.common.loading}</td></tr>
                ) : invItems.map((item: any) => {
                  const avail = item.quantity - item.reservedQty
                  return (
                    <tr key={item.id} className="border-b border-border hover:bg-surface2/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-fg">{item.variant?.product?.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{item.variant?.sku}</td>
                      <td className="px-4 py-3 text-muted">{item.variant?.size ?? '—'}</td>
                      <td className="px-4 py-3 text-muted">{item.variant?.color ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted">{item.branch?.name ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-fg">{item.quantity}</td>
                      <td className="px-4 py-3 font-mono text-muted">{item.reservedQty}</td>
                      <td className="px-4 py-3">
                        <span className={clsx('font-mono font-bold text-sm', avail <= 0 ? 'text-rose' : avail <= item.lowStockThreshold ? 'text-amber-400' : 'text-jade')}>
                          {avail}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-muted">{item.lowStockThreshold}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => setAdjustItem(item)}
                            className="text-xs text-muted hover:text-gold transition-colors px-2 py-1 rounded hover:bg-surface2">
                            {t.inventory.adjustStock}
                          </button>
                          <button onClick={() => setTransfer(item)}
                            className="text-xs text-muted hover:text-blue-400 transition-colors px-2 py-1 rounded hover:bg-surface2 flex items-center gap-1">
                            <ArrowRightLeft size={11} /> {t.inventory.transferBtn}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!isLoading && !invItems.length && (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-muted">
                      <Package size={40} className="mx-auto mb-3 opacity-30" />
                      <p>{t.common.noData}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Movement History ── */}
      {tab === 'movements' && (
        <div className="space-y-3">
          {/* Type filter */}
          <div className="flex gap-1 bg-surface2 rounded-xl p-1 border border-border w-fit">
            {['ALL', 'SALE', 'PURCHASE', 'TRANSFER', 'ADJUSTMENT', 'RETURN'].map(type => (
              <button key={type} onClick={() => { setMovType(type); setMovPage(1) }}
                className={clsx('px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                  movType === type ? 'bg-surface text-white shadow' : 'text-muted hover:text-white')}>
                {type === 'ALL' ? t.common.all : type.charAt(0) + type.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface2">
                    {[t.common.date, t.orders.colProduct, t.inventory.type, t.orders.colQty, t.inventory.fromBranch, t.inventory.toBranch, t.inventory.note, t.inventory.by].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-muted">
                        <History size={36} className="mx-auto mb-3 opacity-30" />
                        <p>{t.inventory.noMovements}</p>
                      </td>
                    </tr>
                  ) : movements.map((m: any) => (
                    <tr key={m.id} className="border-b border-border last:border-0 hover:bg-surface2/50 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                        {dayjs(m.createdAt).format('DD MMM HH:mm')}
                      </td>
                      <td className="px-4 py-3 font-medium">{m.variant?.product?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={clsx('text-xs border px-2 py-0.5 rounded-full', MOVE_COLOR[m.type] ?? MOVE_COLOR.ADJUSTMENT)}>
                          {m.type}
                        </span>
                      </td>
                      <td className={clsx('px-4 py-3 font-mono font-bold', m.quantity > 0 ? 'text-jade' : 'text-rose')}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{m.fromBranchId ? '—' : '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted">{m.toBranchId ? '—' : '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted max-w-[140px] truncate">{m.note ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted">{m.user?.name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {movMeta.total > 30 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted text-xs">{movMeta.total} {t.inventory.totalMovements}</span>
              <div className="flex gap-2">
                <button onClick={() => setMovPage(p => Math.max(1, p - 1))} disabled={movPage === 1}
                  className="p-1.5 rounded-lg border border-border hover:bg-surface2 disabled:opacity-40">
                  <ChevronLeft size={14} />
                </button>
                <span className="px-3 py-1 text-xs text-muted">{t.common.page} {movPage}</span>
                <button onClick={() => setMovPage(p => p + 1)}
                  disabled={movPage * 30 >= movMeta.total}
                  className="p-1.5 rounded-lg border border-border hover:bg-surface2 disabled:opacity-40">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Valuation ── */}
      {tab === 'valuation' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center">
              <p className="text-xs text-muted mb-1">{t.inventory.totalUnits}</p>
              <p className="text-2xl font-bold font-mono">{totalUnits.toLocaleString()}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-muted mb-1">{t.inventory.costValue}</p>
              <p className="text-2xl font-bold font-mono text-amber-400">{fmt.compact(totalCostValue)}</p>
              <p className="text-xs text-muted mt-0.5">{t.inventory.atCostPrice}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-muted mb-1">{t.inventory.retailValue}</p>
              <p className="text-2xl font-bold font-mono text-jade">{fmt.compact(totalSellValue)}</p>
              <p className="text-xs text-muted mt-0.5">{t.inventory.atSellPrice}</p>
            </div>
          </div>

          {/* Potential profit banner */}
          <div className="card bg-jade/5 border-jade/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t.inventory.potentialProfit}</span>
              <span className="text-xl font-bold font-mono text-jade">
                {fmt.compact(totalSellValue - totalCostValue)}
              </span>
            </div>
            <div className="w-full bg-surface2 rounded-full h-2 mt-3">
              <div className="bg-jade h-2 rounded-full"
                style={{ width: totalSellValue > 0 ? `${Math.min(100, ((totalSellValue - totalCostValue) / totalSellValue) * 100)}%` : '0%' }} />
            </div>
            <p className="text-xs text-muted mt-1">
              {totalSellValue > 0
                ? `${(((totalSellValue - totalCostValue) / totalSellValue) * 100).toFixed(1)}% ${t.inventory.margin}`
                : t.inventory.noData}
            </p>
          </div>

          {/* Per-product valuation table */}
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface2">
                    {[t.orders.colProduct, t.products.sku, t.common.branch, t.orders.colQty, t.inventory.costPrice, t.inventory.sellPrice, t.inventory.costValue, t.inventory.sellValue, t.inventory.margin].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invItems
                    .sort((a, b) => (b.quantity * Number(b.variant?.product?.costPrice ?? 0)) -
                                    (a.quantity * Number(a.variant?.product?.costPrice ?? 0)))
                    .map((item: any) => {
                      const cost   = Number(item.variant?.product?.costPrice ?? 0)
                      const sell   = Number(item.variant?.product?.sellPrice ?? 0)
                      const costVal = item.quantity * cost
                      const sellVal = item.quantity * sell
                      const margin  = sell > 0 ? ((sell - cost) / sell * 100) : 0
                      return (
                        <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface2/50">
                          <td className="px-4 py-3 font-medium">{item.variant?.product?.name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted">{item.variant?.sku}</td>
                          <td className="px-4 py-3 text-xs text-muted">{item.branch?.name ?? '—'}</td>
                          <td className="px-4 py-3 font-mono">{item.quantity}</td>
                          <td className="px-4 py-3 font-mono text-xs">{fmt.compact(cost)}</td>
                          <td className="px-4 py-3 font-mono text-xs">{fmt.compact(sell)}</td>
                          <td className="px-4 py-3 font-mono text-amber-400">{fmt.compact(costVal)}</td>
                          <td className="px-4 py-3 font-mono text-jade">{fmt.compact(sellVal)}</td>
                          <td className="px-4 py-3">
                            <span className={clsx('text-xs font-mono', margin >= 30 ? 'text-jade' : margin >= 10 ? 'text-amber-400' : 'text-rose')}>
                              {margin.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {adjustItem  && <AdjustModal  item={adjustItem}   onClose={() => setAdjustItem(null)} />}
      {transferItem && <TransferModal item={transferItem} onClose={() => setTransfer(null)} />}
    </div>
  )
}
