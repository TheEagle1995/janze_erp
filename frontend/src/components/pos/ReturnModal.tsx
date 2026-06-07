/**
 * ReturnModal.tsx — Janze ERP
 *
 * Qaytarish (return/refund) oynasi.
 *
 * Flow:
 *  1. Kassir chek raqamini yozadi (yoki history dan order keladi)
 *  2. Order yuklanadi — mahsulotlar ko'rinadi
 *  3. "To'liq qaytarish" tugmasi → ordersApi.refund()
 *  4. Backend: status = REFUNDED, inventory tiklandi, loyalty ayrildi
 *  5. Muvaffaqiyat → receipt print imkoniyati
 */

import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery }       from '@tanstack/react-query'
import { ordersApi }                   from '../../lib/api'
import { fmt }                         from '../../utils/format'
import toast                           from 'react-hot-toast'
import clsx                            from 'clsx'
import dayjs                           from 'dayjs'
import {
  X, Search, RefreshCw, CheckCircle2,
  RotateCcw, Package, AlertTriangle, Printer,
} from 'lucide-react'

interface ReturnModalProps {
  /** Pre-fill with a specific order (from POS history row) */
  initialOrder?: any
  onClose:       () => void
  onSuccess?:    (refundedOrder: any) => void
}

export function ReturnModal({ initialOrder, onClose, onSuccess }: ReturnModalProps) {
  const [orderNum,  setOrderNum]  = useState(initialOrder?.orderNumber ?? '')
  const [searched,  setSearched]  = useState(!!initialOrder)
  const [order,     setOrder]     = useState<any>(initialOrder ?? null)
  const [done,      setDone]      = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!initialOrder) setTimeout(() => inputRef.current?.focus(), 80)
  }, [initialOrder])

  // Search by order number
  const { isFetching, refetch } = useQuery({
    queryKey:  ['return-order', orderNum],
    queryFn:   () => ordersApi.list({ orderNumber: orderNum, limit: 1, page: 1, includeItems: 'true' }),
    enabled:   false,
    select:    (d: any) => (d?.data ?? [])[0] ?? null,
  })

  const handleSearch = async () => {
    if (!orderNum.trim()) return
    setSearched(true)
    const result = await refetch()
    const found  = result.data ?? null
    setOrder(found)
    if (!found) toast.error(`Chek topilmadi: ${orderNum}`)
  }

  // Refund mutation
  const refundMut = useMutation({
    mutationFn: () => ordersApi.refund(order.id),
    onSuccess:  (data) => {
      setDone(true)
      toast.success(`✅ ${order.orderNumber} — to'liq qaytarildi`)
      onSuccess?.(data)
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Qaytarish xatosi'),
  })

  const canRefund = order?.status === 'COMPLETED'

  // ── Success screen ───────────────────────────────────────
  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-surface border border-border rounded-2xl shadow-2xl p-8 w-[420px] text-center space-y-4">
          <CheckCircle2 size={56} className="text-jade mx-auto" />
          <h2 className="text-xl font-bold">Qaytarildi!</h2>
          <p className="text-sm text-muted">
            <span className="font-mono font-semibold text-fg">{order?.orderNumber}</span> —
            barcha mahsulotlar ombarga qaytarildi
          </p>
          <p className="text-2xl font-bold font-mono text-rose">
            −{fmt.currency(Number(order?.total))}
          </p>
          {order?.customer && (
            <p className="text-xs text-muted">
              Mijoz loyalty ballari ayrildi
            </p>
          )}
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => {
                const win = window.open('', '_blank', 'width=340,height=500,toolbar=0')
                if (!win) return
                win.document.write(returnReceiptHtml(order))
                win.document.close()
                setTimeout(() => { win.print(); setTimeout(() => win.close(), 600) }, 400)
              }}
              className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm hover:border-gold/50 transition-colors"
            >
              <Printer size={15} /> Chek bosish
            </button>
            <button onClick={onClose} className="btn-primary px-6">
              Yopish
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main modal ───────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-2xl shadow-2xl w-[480px] max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <RotateCcw size={18} className="text-rose" />
            <h2 className="font-bold text-sm">Qaytarish (Return / Refund)</h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Search */}
          {!initialOrder && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted uppercase tracking-wide">
                Chek raqami
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    ref={inputRef}
                    value={orderNum}
                    onChange={e => { setOrderNum(e.target.value); setSearched(false) }}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="ORD-0001 yoki barcode..."
                    className="input pl-8 w-full font-mono"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={isFetching || !orderNum.trim()}
                  className="btn-primary px-4 flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isFetching ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
                  Qidirish
                </button>
              </div>
            </div>
          )}

          {/* Not found */}
          {searched && !order && !isFetching && (
            <div className="flex items-center gap-2 text-rose text-sm bg-rose/5 border border-rose/20 rounded-xl px-4 py-3">
              <AlertTriangle size={15} />
              Chek topilmadi
            </div>
          )}

          {/* Order details */}
          {order && (
            <div className="space-y-3">
              {/* Order header */}
              <div className="bg-surface2 rounded-xl p-4 space-y-2 border border-border">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm">{order.orderNumber}</span>
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded-lg font-medium',
                    order.status === 'COMPLETED' ? 'text-jade bg-jade/10' :
                    order.status === 'REFUNDED'  ? 'text-muted bg-surface' :
                    order.status === 'VOID'      ? 'text-rose bg-rose/10' : 'text-muted'
                  )}>
                    {order.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted">
                  <span>Sana: <span className="text-fg">{dayjs(order.createdAt).format('DD.MM.YYYY HH:mm')}</span></span>
                  <span>Jami: <span className="font-mono font-bold text-gold">{fmt.currency(Number(order.total))}</span></span>
                  {order.customer && <span>Mijoz: <span className="text-fg">{order.customer.name}</span></span>}
                  {order.branch   && <span>Filial: <span className="text-fg">{order.branch.name}</span></span>}
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Mahsulotlar</div>
                {(order.items ?? []).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface2 border border-border/40">
                    <Package size={13} className="text-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {item.variant?.product?.name ?? item.productName ?? '—'}
                        {item.variant?.size ? ` (${item.variant.size})` : ''}
                      </div>
                      <div className="text-xs text-muted">
                        {item.quantity} × {fmt.compact(Number(item.unitPrice))}
                      </div>
                    </div>
                    <div className="text-sm font-mono font-bold text-fg">
                      {fmt.compact(Number(item.lineTotal ?? (item.unitPrice * item.quantity)))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Status warning */}
              {!canRefund && (
                <div className="flex items-center gap-2 text-sm bg-surface2 border border-border rounded-xl px-4 py-3">
                  <AlertTriangle size={15} className="text-yellow-400 flex-shrink-0" />
                  <span className="text-muted">
                    Bu chekni qaytarib bo'lmaydi —
                    faqat <span className="text-fg font-medium">COMPLETED</span> statusidagi cheklar qaytariladi
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {order && canRefund && (
          <div className="p-5 border-t border-border flex-shrink-0 space-y-3">
            <div className="bg-rose/5 border border-rose/20 rounded-xl px-4 py-3 text-sm text-rose flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                Barcha <strong>{(order.items ?? []).length}</strong> mahsulot ombora qaytariladi.
                Inventory va loyalty ballari avtomatik tiklanadi.
              </span>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm text-muted hover:text-fg transition-colors">
                Bekor qilish
              </button>
              <button
                onClick={() => refundMut.mutate()}
                disabled={refundMut.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose text-white rounded-xl text-sm font-semibold hover:bg-rose/90 transition-colors disabled:opacity-60"
              >
                {refundMut.isPending
                  ? <><RefreshCw size={14} className="animate-spin" /> Qaytarilmoqda...</>
                  : <><RotateCcw size={14} /> To'liq qaytarish ({fmt.compact(Number(order.total))})</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Return receipt HTML ───────────────────────────────────────────────────────
function returnReceiptHtml(order: any): string {
  const fmt2 = (n: number) => n.toLocaleString('uz-UZ') + " so'm"
  const items = (order?.items ?? []).map((i: any) => {
    const name = i.variant?.product?.name ?? i.productName ?? '—'
    const size = i.variant?.size ? ` (${i.variant.size})` : ''
    return `<div class="row"><span>${i.quantity}× ${name}${size}</span><span>${fmt2(Number(i.lineTotal ?? i.unitPrice * i.quantity))}</span></div>`
  }).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>QAYTARISH - ${order?.orderNumber}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:11px;width:80mm;padding:3mm 4mm;color:#000}
  .center{text-align:center}.bold{font-weight:bold}.large{font-size:15px}
  .sep{border-top:1px dashed #000;margin:4px 0}
  .row{display:flex;justify-content:space-between;margin:2px 0}
  .rose{color:#c00}
  @media print{@page{margin:0;size:80mm auto}body{width:80mm}}
</style></head><body>
<div class="center bold large">QAYTARISH CHEKI</div>
<div class="center">RETURN / REFUND</div>
<div class="sep"></div>
<div class="row"><span>Chek:</span><span class="bold">${order?.orderNumber}</span></div>
<div class="row"><span>Sana:</span><span>${dayjs().format('DD.MM.YYYY HH:mm')}</span></div>
<div class="sep"></div>
${items}
<div class="sep"></div>
<div class="row bold rose"><span>QAYTARILDI:</span><span>-${fmt2(Number(order?.total))}</span></div>
<div class="sep"></div>
<div class="center">Tovar qabul qilindi</div>
<br/><br/>
</body></html>`
}
