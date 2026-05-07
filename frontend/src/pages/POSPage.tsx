import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi }  from '../api/products'
import { ordersApi }    from '../api/orders'
import { customersApi } from '../api/customers'
import { debtsApi }     from '../api/debts'
import { useCartStore, type CartItem } from '../stores/cartStore'
import { useAuthStore } from '../stores/authStore'
import { fmt }          from '../utils/format'
import { useT }         from '../i18n'
import toast            from 'react-hot-toast'
import dayjs            from 'dayjs'
import {
  Search, Plus, Minus, Trash2, Barcode,
  User, CreditCard, Banknote, CheckCircle2, Printer, Camera, X,
  Pencil, Check, ArrowRightLeft, AlertTriangle, Calendar,
  Smartphone, TrendingDown, Zap, UserPlus, History, ShoppingBag,
} from 'lucide-react'
import clsx from 'clsx'
import type { ProductVariant } from '../types'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type PayMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'DEBT'

interface PaymentRow {
  method: PayMethod
  amount: string
}

const PAY_ICONS: Record<PayMethod, any> = {
  CASH:     Banknote,
  CARD:     CreditCard,
  TRANSFER: Smartphone,
  DEBT:     TrendingDown,
}

// Receipt-only labels (English, non-translatable — for thermal printer)
const PAY_LABELS_RECEIPT: Record<PayMethod, string> = {
  CASH:     'Cash',
  CARD:     'Card',
  TRANSFER: 'Transfer',
  DEBT:     'Debt / Credit',
}

// ─────────────────────────────────────────────────────────────
// Camera Barcode Scanner Modal
// ─────────────────────────────────────────────────────────────
function CameraScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void
  onClose:    () => void
}) {
  const t           = useT()
  const videoRef    = useRef<HTMLVideoElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const detectorRef = useRef<any>(null)
  const scanning    = useRef(true)
  const [error, setError] = useState('')
  const [torch, setTorch] = useState(false)

  useEffect(() => {
    let raf: number
    async function startCamera() {
      if (!('BarcodeDetector' in window)) {
        setError('Your browser does not support camera scanning.\nUse Chrome on Android/desktop, or type the barcode manually.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        // @ts-ignore
        detectorRef.current = new window.BarcodeDetector({
          formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','qr_code','itf'],
        })
        const scan = async () => {
          if (!scanning.current || !videoRef.current || !detectorRef.current) return
          try {
            const barcodes = await detectorRef.current.detect(videoRef.current)
            if (barcodes.length > 0) {
              scanning.current = false
              onDetected(barcodes[0].rawValue)
              return
            }
          } catch { /* ignore frame errors */ }
          raf = requestAnimationFrame(scan)
        }
        raf = requestAnimationFrame(scan)
      } catch {
        setError('Camera access denied. Please allow camera permissions and try again.')
      }
    }
    startCamera()
    return () => {
      scanning.current = false
      cancelAnimationFrame(raf)
      streamRef.current?.getTracks().forEach(tr => tr.stop())
    }
  }, [onDetected])

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try { await (track as any).applyConstraints({ advanced: [{ torch: !torch }] }); setTorch(tv => !tv) } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 bg-black/80">
        <span className="text-white font-semibold flex items-center gap-2">
          <Camera size={18} /> {t.pos.pointCamera}
        </span>
        <div className="flex items-center gap-3">
          <button onClick={toggleTorch} className="text-yellow-400 text-sm px-3 py-1 border border-yellow-400/40 rounded-lg">
            {torch ? '🔦 Off' : '🔦 Flash'}
          </button>
          <button onClick={onClose} className="text-white"><X size={22} /></button>
        </div>
      </div>
      <div className="flex-1 relative flex items-center justify-center bg-black">
        {error ? (
          <div className="text-center p-8">
            <p className="text-white text-sm whitespace-pre-line mb-6">{error}</p>
            <button onClick={onClose} className="btn-primary px-6">{t.common.close}</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-40 relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-gold rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-gold rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-gold rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-gold rounded-br-lg" />
                <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-gold/60 animate-pulse" />
              </div>
            </div>
          </>
        )}
      </div>
      <div className="p-4 bg-black/80 text-center text-sm text-gray-400">
        {t.pos.holdSteady}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Receipt printer — 80 mm thermal
// ─────────────────────────────────────────────────────────────
function printReceipt(params: {
  order: any; items: any[]; payments: PaymentRow[]
  cashGiven: number; change: number
  storeName: string; cashierName: string
}) {
  const { order, items, payments, cashGiven, change, storeName, cashierName } = params
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0)
  const total    = subtotal
  const itemRows = items.map(i => {
    const left  = `${i.quantity}x ${(`${i.name}${i.size ? ` (${i.size})` : ''}`).slice(0,26)}`
    const right = fmt.currency(i.lineTotal).padStart(14)
    return `<div class="item-row"><span>${left}</span><span>${right}</span></div>`
  }).join('')
  const payRows = payments.filter(p => Number(p.amount) > 0).map(p =>
    `<div class="row"><span>${PAY_LABELS_RECEIPT[p.method]}</span><span>${fmt.currency(Number(p.amount))}</span></div>`
  ).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt ${order.orderNumber}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:3mm 4mm;color:#000}
    .center{text-align:center}.right{text-align:right}.bold{font-weight:bold}
    .large{font-size:16px}.small{font-size:10px}
    .divider{border-top:1px dashed #000;margin:5px 0}
    .row{display:flex;justify-content:space-between;margin:2px 0}
    .item-row{display:flex;justify-content:space-between;margin:3px 0;font-size:11px}
    .total-row{display:flex;justify-content:space-between;font-weight:bold;font-size:13px}
    @media print{@page{margin:0;size:80mm auto}body{width:80mm}}
  </style></head><body>
  <div class="center bold large">${storeName}</div>
  <div class="center small">Point of Sale Receipt</div>
  <div class="divider"></div>
  <div class="row"><span>Order:</span><span class="bold">${order.orderNumber}</span></div>
  <div class="row"><span>Date:</span><span>${fmt.dateTime(new Date())}</span></div>
  <div class="row"><span>Cashier:</span><span>${cashierName}</span></div>
  <div class="divider"></div>
  ${itemRows}
  <div class="divider"></div>
  <div class="divider"></div>
  <div class="total-row"><span>TOTAL</span><span>${fmt.currency(total)}</span></div>
  <div class="divider"></div>
  ${payRows}
  ${cashGiven > 0 ? `<div class="row bold"><span>Change</span><span>${fmt.currency(change)}</span></div>` : ''}
  <div class="divider"></div>
  <div class="center small">Thank you for your purchase!</div>
  <br><br><br>
  <script>window.onload=function(){window.focus();window.print();setTimeout(function(){window.close()},500)}<\/script>
  </body></html>`
  const win = window.open('', '_blank', 'width=400,height=700,toolbar=0,menubar=0')
  if (!win) { toast.error('Enable popups to print receipts'); return }
  win.document.write(html)
  win.document.close()
}

// ─────────────────────────────────────────────────────────────
// Product card
// ─────────────────────────────────────────────────────────────
function ProductCard({ product, onAdd }: { product: any; onAdd: (v: ProductVariant) => void }) {
  const t         = useT()
  const firstVariant = product.variants?.[0]
  const price   = firstVariant?.priceOverride ?? product.sellPrice
  // Untracked = no inventory records at all → freely sellable
  // Tracked   = has inventory records → in stock only if quantity > 0
  const inStock = product.variants?.some((v: any) =>
    (v.inventory?.length ?? 0) === 0 || v.inventory?.some((i: any) => i.quantity > 0)
  )
  return (
    <button
      onClick={() => firstVariant && onAdd(firstVariant)}
      disabled={!inStock}
      className={clsx(
        'bg-surface2 border border-border rounded-xl p-3 text-left transition-all',
        inStock ? 'hover:border-gold/50 hover:bg-surface2/80 active:scale-95' : 'opacity-40 cursor-not-allowed'
      )}
    >
      <div className="aspect-square bg-surface rounded-lg mb-2 flex items-center justify-center">
        {product.imageUrls?.[0]
          ? <img src={product.imageUrls[0]} alt="" className="w-full h-full object-cover rounded-lg" />
          : <span className="text-3xl">👔</span>
        }
      </div>
      <div className="text-xs font-medium truncate">{product.name}</div>
      <div className="text-sm font-bold text-gold font-mono mt-0.5">{fmt.compact(price)}</div>
      <div className={clsx('text-xs mt-0.5', inStock ? 'text-jade' : 'text-rose')}>
        {inStock ? t.pos.inStock : t.pos.outOfStock}
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Cart item row
// ─────────────────────────────────────────────────────────────
function CartRow({ item, availableStock }: { item: CartItem; availableStock: number }) {
  const { updateQty, removeItem, setUnitPrice } = useCartStore()
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceInput,   setPriceInput]   = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // For flex items: show price input inline always until price is set
  const needsPrice = item.isFlexiblePrice && item.unitPrice === 0
  const [flexInput, setFlexInput] = useState('')
  const flexRef = useRef<HTMLInputElement>(null)

  // Auto-focus flex input when it appears
  useEffect(() => {
    if (needsPrice) setTimeout(() => flexRef.current?.focus(), 50)
  }, [needsPrice])

  const applyFlexPrice = () => {
    const val = Number(flexInput)
    if (val > 0) setUnitPrice(item.variantId, val)
    else flexRef.current?.focus()
  }

  const openPriceEdit = () => {
    setPriceInput(String(item.unitPrice || ''))
    setEditingPrice(true)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 30)
  }

  const applyPriceEdit = () => {
    const val = Number(priceInput)
    if (val > 0) setUnitPrice(item.variantId, val)
    setEditingPrice(false)
  }

  const isCustomPrice  = !item.isFlexiblePrice && item.originalPrice !== item.unitPrice
  // Stock awareness
  const trackedStock   = availableStock   // -1 means untracked (no inventory record)
  const overStock      = trackedStock >= 0 && item.quantity > trackedStock
  const atStockLimit   = trackedStock >= 0 && item.quantity >= trackedStock

  const handleIncrement = () => {
    if (atStockLimit) {
      toast.error(trackedStock === 0
        ? `"${item.name}" is out of stock`
        : `Only ${trackedStock} in stock for "${item.name}"`)
      return
    }
    updateQty(item.variantId, item.quantity + 1)
  }

  return (
    <div className={clsx(
      'py-2.5 border-b border-border last:border-0',
      needsPrice  && 'bg-gold/5 rounded-lg px-2 border border-gold/30 mb-1',
      overStock   && 'bg-rose/5 rounded-lg px-2 border border-rose/30 mb-1',
    )}>
      {/* Product name + qty controls */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate leading-tight">{item.name}</div>
          {(item.size || item.color) && (
            <div className="text-xs text-muted">{[item.size, item.color].filter(Boolean).join(' / ')}</div>
          )}
          {/* Stock badge */}
          {trackedStock >= 0 && (
            <div className={clsx(
              'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5',
              trackedStock === 0       ? 'bg-rose/15 text-rose'
              : overStock              ? 'bg-rose/15 text-rose'
              : trackedStock <= 3      ? 'bg-amber-400/15 text-amber-400'
              : 'bg-surface2 text-muted'
            )}>
              {trackedStock === 0
                ? '⚠ Out of stock'
                : overStock
                  ? `⚠ Only ${trackedStock} available`
                  : `${trackedStock} in stock`}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => updateQty(item.variantId, item.quantity - 1)}
            className="w-6 h-6 rounded bg-surface2 flex items-center justify-center hover:bg-border transition-colors">
            <Minus size={10} />
          </button>
          <span className={clsx('text-sm font-mono w-6 text-center font-semibold', overStock && 'text-rose')}>
            {item.quantity}
          </span>
          <button
            onClick={handleIncrement}
            className={clsx(
              'w-6 h-6 rounded flex items-center justify-center transition-colors',
              atStockLimit
                ? 'bg-surface2 text-muted/40 cursor-not-allowed'
                : 'bg-surface2 hover:bg-border'
            )}>
            <Plus size={10} />
          </button>
        </div>
        <div className="text-right min-w-[64px]">
          {!needsPrice && (
            <div className="text-sm font-mono font-bold text-gold">{fmt.compact(item.lineTotal)}</div>
          )}
          <button onClick={() => removeItem(item.variantId)} className="text-muted hover:text-rose transition-colors mt-0.5">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* FLEX PRICE — prominent inline input, shown until price is entered */}
      {needsPrice && (
        <div className="mt-2 flex items-center gap-2">
          <Zap size={12} className="text-gold flex-shrink-0" />
          <span className="text-xs text-gold font-medium whitespace-nowrap">Enter price:</span>
          <input
            ref={flexRef}
            type="number"
            min="1"
            placeholder="0"
            value={flexInput}
            onChange={e => setFlexInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applyFlexPrice() }}
            className="flex-1 bg-surface border border-gold/50 rounded-lg px-2 py-1 text-sm font-mono font-bold text-fg outline-none focus:border-gold"
          />
          <span className="text-xs text-muted">UZS</span>
          <button
            onClick={applyFlexPrice}
            disabled={!flexInput || Number(flexInput) <= 0}
            className="px-3 py-1 bg-gold text-black text-xs font-bold rounded-lg disabled:opacity-40 hover:bg-gold/80 transition-colors"
          >
            OK
          </button>
        </div>
      )}

      {/* Regular price row (non-flex, price already set) */}
      {!needsPrice && (
        <div className="flex items-center gap-1 mt-0.5">
          {item.isFlexiblePrice && (
            <span className="text-[10px] bg-gold/20 text-gold px-1 rounded flex items-center gap-0.5">
              <Zap size={7} /> Flex
            </span>
          )}
          {isCustomPrice && (
            <span className="text-[10px] text-muted line-through font-mono">{fmt.compact(item.originalPrice)}</span>
          )}
          <span className="text-xs font-mono text-muted">
            {fmt.compact(item.unitPrice)} × {item.quantity}
          </span>
          <button onClick={openPriceEdit} className="text-muted hover:text-gold transition-colors ml-1">
            <Pencil size={9} />
          </button>
        </div>
      )}

      {/* Inline price editor (for already-set prices) */}
      {editingPrice && (
        <div className="mt-1.5 flex items-center gap-1.5 bg-surface2 border border-gold/40 rounded-lg px-2 py-1.5">
          <span className="text-xs text-muted whitespace-nowrap">Price:</span>
          <input
            ref={inputRef}
            value={priceInput}
            onChange={e => setPriceInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applyPriceEdit(); if (e.key === 'Escape') setEditingPrice(false) }}
            type="number" min="0"
            className="flex-1 bg-transparent text-xs font-mono text-fg outline-none w-0 min-w-0"
          />
          <span className="text-xs text-muted">UZS</span>
          <button onClick={applyPriceEdit} className="text-jade hover:text-green-300"><Check size={13} /></button>
          <button onClick={() => setEditingPrice(false)} className="text-muted hover:text-fg"><X size={13} /></button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Split Payment Panel
// ─────────────────────────────────────────────────────────────
function SplitPaymentPanel({
  total,
  payments,
  setPayments,
  debtDueDate,
  setDebtDueDate,
  customerId,
}: {
  total:         number
  payments:      PaymentRow[]
  setPayments:   (p: PaymentRow[]) => void
  debtDueDate:   string
  setDebtDueDate:(d: string) => void
  customerId:    string | null
}) {
  const t = useT()

  const PAY_LABELS: Record<PayMethod, string> = {
    CASH:     t.pos.cash,
    CARD:     t.pos.card,
    TRANSFER: t.pos.transfer,
    DEBT:     t.pos.debtCredit,
  }

  const METHODS: PayMethod[] = ['CASH', 'CARD', 'TRANSFER', 'DEBT']
  const activeMethods = new Set(payments.map(p => p.method))

  const toggleMethod = (m: PayMethod) => {
    if (activeMethods.has(m)) {
      if (payments.length <= 1) return
      setPayments(payments.filter(p => p.method !== m))
    } else {
      setPayments([...payments, { method: m, amount: '' }])
    }
  }

  const setAmount = (method: PayMethod, val: string) => {
    setPayments(payments.map(p => p.method === method ? { ...p, amount: val } : p))
  }

  const paidSoFar = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const remaining  = total - paidSoFar
  const hasDebt    = activeMethods.has('DEBT')

  const quickFill = () => {
    const unfilled = payments.filter(p => !p.amount)
    if (unfilled.length === 1) {
      const rem = total - payments.filter(p => p.amount).reduce((s, p) => s + Number(p.amount), 0)
      if (rem > 0) setAmount(unfilled[0].method, String(Math.round(rem)))
    }
  }

  return (
    <div className="space-y-2">
      {/* Method toggles */}
      <div className="grid grid-cols-4 gap-1">
        {METHODS.map(m => {
          const Icon   = PAY_ICONS[m]
          const active = activeMethods.has(m)
          return (
            <button
              key={m}
              onClick={() => toggleMethod(m)}
              className={clsx(
                'flex flex-col items-center gap-0.5 py-2 rounded-xl border text-xs font-medium transition-all',
                active
                  ? m === 'DEBT'
                    ? 'border-rose bg-rose/10 text-rose'
                    : 'border-gold bg-gold-dim text-gold'
                  : 'border-border bg-surface2 text-muted hover:border-border/80 hover:text-fg'
              )}
            >
              <Icon size={13} />
              <span className="text-[9px] leading-tight text-center">{PAY_LABELS[m].split('/')[0].trim()}</span>
            </button>
          )
        })}
      </div>

      {/* Amount rows */}
      {payments.map((p) => {
        const Icon = PAY_ICONS[p.method]
        return (
          <div key={p.method} className="flex items-center gap-1.5">
            <div className={clsx(
              'w-5 h-5 rounded flex items-center justify-center flex-shrink-0',
              p.method === 'DEBT' ? 'bg-rose/20 text-rose' : 'bg-gold-dim text-gold'
            )}>
              <Icon size={10} />
            </div>
            <span className="text-xs text-muted w-14 flex-shrink-0">{PAY_LABELS[p.method].split('/')[0]}</span>
            <div className="relative flex-1">
              <input
                type="number"
                min="0"
                value={p.amount}
                onChange={e => setAmount(p.method, e.target.value)}
                onFocus={quickFill}
                placeholder="0"
                className={clsx(
                  'input text-xs py-1 px-2 h-auto font-mono',
                  p.method === 'DEBT' && 'border-rose/40 focus:border-rose'
                )}
              />
            </div>
            {payments.length > 1 && (
              <button onClick={() => toggleMethod(p.method)} className="text-muted hover:text-rose transition-colors flex-shrink-0">
                <X size={12} />
              </button>
            )}
          </div>
        )
      })}

      {/* Remaining indicator */}
      <div className={clsx(
        'flex justify-between text-xs px-1 font-medium',
        Math.abs(remaining) < 1 ? 'text-jade' : remaining > 0 ? 'text-rose' : 'text-muted'
      )}>
        <span>{Math.abs(remaining) < 1 ? `✓ ${t.pos.balanced}` : remaining > 0 ? t.pos.remaining : t.pos.overpaid}</span>
        {Math.abs(remaining) >= 1 && (
          <span className="font-mono">{fmt.compact(Math.abs(remaining))}</span>
        )}
      </div>

      {/* Debt due date — shown when DEBT method is active */}
      {hasDebt && (
        <div className={clsx(
          'rounded-xl border p-2.5 space-y-2',
          !customerId ? 'border-rose/40 bg-rose/5' : 'border-border bg-surface2'
        )}>
          {!customerId && (
            <div className="flex items-center gap-1.5 text-rose text-xs">
              <AlertTriangle size={11} />
              <span>{t.pos.selectCustomerForDebt}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar size={12} className="text-muted flex-shrink-0" />
            <span className="text-xs text-muted">{t.debts.dueDate}</span>
            <input
              type="date"
              value={debtDueDate}
              min={dayjs().format('YYYY-MM-DD')}
              onChange={e => setDebtDueDate(e.target.value)}
              className="input text-xs py-0.5 px-1.5 h-auto flex-1"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Quick Create Customer Modal (inline in POS)
// ─────────────────────────────────────────────────────────────
function QuickCustomerModal({
  initialPhone,
  onCreated,
  onClose,
}: {
  initialPhone: string
  onCreated:    (customer: any) => void
  onClose:      () => void
}) {
  const { mutate: create, isPending } = useMutation({
    mutationFn: (d: any) => customersApi.create(d),
    onSuccess:  (data) => { onCreated(data); onClose() },
    onError:    (e: any) => toast.error(e.response?.data?.message ?? 'Could not create customer'),
  })
  const [name,  setName]  = useState('')
  const [phone, setPhone] = useState(initialPhone)
  const [email, setEmail] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim())  return toast.error('Name is required')
    if (!phone.trim()) return toast.error('Phone is required')
    create({ name: name.trim(), phone: phone.trim(), email: email.trim() || null, segment: 'REGULAR', loyaltyPoints: 0, discountPct: 0 })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <UserPlus size={16} className="text-gold" />
            <h3 className="font-bold text-sm">New Customer</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <div>
            <label className="label text-xs">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Full name" className="input w-full text-sm" autoFocus required />
          </div>
          <div>
            <label className="label text-xs">Phone *</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+998 90 …" className="input w-full text-sm" required />
          </div>
          <div>
            <label className="label text-xs">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)}
              type="email" placeholder="Optional" className="input w-full text-sm" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm py-2">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1 text-sm py-2 disabled:opacity-50">
              {isPending ? 'Creating…' : 'Create & Select'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main POS Page
// ─────────────────────────────────────────────────────────────
export default function POSPage() {
  const t = useT()

  const [search, setSearch]             = useState('')
  const [phoneSearch, setPhoneSearch]   = useState('')
  const [success, setSuccess]           = useState<any>(null)
  const [tab, setTab]                   = useState<'products' | 'variants' | 'history'>('products')
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [scannerActive, setScannerActive]     = useState(false)
  const [cameraOpen, setCameraOpen]           = useState(false)
  const [newCustomerOpen, setNewCustomerOpen] = useState(false)

  // Split payment state
  const [payments, setPayments]         = useState<PaymentRow[]>([{ method: 'CASH', amount: '' }])
  const [debtDueDate, setDebtDueDate]   = useState(dayjs().add(30, 'day').format('YYYY-MM-DD'))

  // Barcode scanner
  const barcodeBuffer = useRef('')
  const lastKeyTime   = useRef(0)
  const SCAN_GAP_MS   = 80

  const cart    = useCartStore()
  const addItem = useCartStore(s => s.addItem)
  const user    = useAuthStore(s => s.user)
  const qc      = useQueryClient()
  const taxRate = 0 // VAT removed

  const { data: products } = useQuery({
    queryKey: ['products-pos', search],
    queryFn:  () => productsApi.list({ search: search || undefined, isActive: true, limit: 100 }),
    select:   (d: any) => d.data,
  })

  // Build variantId → available stock map from loaded products
  // -1 = no inventory record (untracked), 0+ = tracked stock
  const stockMap = useMemo(() => {
    const map: Record<string, number> = {}
    ;(products ?? []).forEach((p: any) => {
      p.variants?.forEach((v: any) => {
        const inv = v.inventory?.find((i: any) => i.branchId === user?.branchId)
        map[v.id] = inv ? inv.quantity : -1
      })
    })
    return map
  }, [products, user?.branchId])

  // Fetch customer debt balance when a customer is selected
  const { data: customerDebts } = useQuery({
    queryKey: ['customer-debts', cart.customerId],
    queryFn:  () => debtsApi.list({ customerId: cart.customerId!, status: 'ACTIVE' } as any),
    enabled:  !!cart.customerId,
    select:   (d: any) => (d?.data ?? d) as any[],
    retry:    false,
  })
  const customerDebtTotal = (customerDebts ?? []).reduce((s: number, d: any) => s + Number(d.amount - d.paid), 0)

  // POS sales history — today's POS transactions (independent from Orders section)
  const today = dayjs().format('YYYY-MM-DD')
  const { data: posHistoryRaw } = useQuery({
    queryKey: ['pos-history', user?.branchId, today],
    queryFn:  () => ordersApi.list({
      branchId: user?.branchId,
      source:   'POS',
      dateFrom: today,
      dateTo:   today,
      limit:    50,
      page:     1,
    }),
    enabled: tab === 'history',
    select:  (d: any) => d.data ?? [],
  })
  const posHistory: any[] = posHistoryRaw ?? []
  const posTotalToday = posHistory.reduce((s: number, o: any) => s + Number(o.total), 0)

  const findCustomer = useMutation({
    mutationFn: (phone: string) => customersApi.byPhone(phone),
    onSuccess:  (data) => {
      if (data) {
        cart.setCustomer(data.id, data.name)
        toast.success(`${t.pos.customer}: ${data.name} (${data.loyaltyPoints} pts)`)
      }
    },
    onError: () => { cart.setCustomer(null, null); toast.error(t.errors.notFound) },
  })

  const createDebt = useMutation({
    mutationFn: (dto: any) => debtsApi.create(dto),
  })

  const placeOrder = useMutation({
    mutationFn: (dto: any) => ordersApi.create(dto),
    onSuccess:  async (data) => {
      const debtRow = payments.find(p => p.method === 'DEBT' && Number(p.amount) > 0)
      if (debtRow && cart.customerId) {
        try {
          await createDebt.mutateAsync({
            customerId:   cart.customerId,
            customerName: cart.customerName,
            phone:        phoneSearch || '',
            amount:       Number(debtRow.amount),
            currency:     'UZS',
            dueDate:      debtDueDate,
            branchId:     user?.branchId,
            description:  `Sale ${data.orderNumber}`,
            notes:        `Auto-created from POS sale`,
          })
          toast.success(`${t.pos.debtOf} ${fmt.compact(Number(debtRow.amount))} ${t.pos.created}`)
          qc.invalidateQueries({ queryKey: ['debts'] })
        } catch {
          toast.error('Order saved but debt creation failed — add manually')
        }
      }
      setSuccess({ ...data, payments: effectivePayments })
      cart.clearCart()
      qc.invalidateQueries({ queryKey: ['pos-history'] })   // refresh POS sales history
      toast.success(`${data.orderNumber} — ${t.pos.saleComplete}`)
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? t.errors.saveFailed),
  })

  // ── Add variant to cart ───────────────────────────────────
  // Uses stable `addItem` selector — not `cart` — so the barcode
  // listener useEffect does NOT re-register on every cart change.
  const handleAddVariant = useCallback((variant: any, product: any) => {
    const isFlexible = product.isFlexiblePrice ?? false
    const price = isFlexible ? 0 : (variant.priceOverride ?? product.sellPrice)
    addItem({
      variantId:       variant.id,
      productId:       product.id,
      name:            product.name,
      sku:             variant.sku,
      size:            variant.size,
      color:           variant.color,
      unitPrice:       price,
      unitCost:        product.costPrice,
      quantity:        1,
      discountPct:     0,
      discountFixed:   0,
      isFlexiblePrice: isFlexible,
    } as any)
    setTab('products')
    setSelectedProduct(null)
  }, [addItem])

  const handleProductClick = (product: any) => {
    if (product.variants?.length === 1) handleAddVariant(product.variants[0], product)
    else { setSelectedProduct(product); setTab('variants') }
  }

  // ── Barcode scanner keyboard listener ────────────────────
  useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const now = Date.now()
      if (e.key === 'Enter') {
        const code = barcodeBuffer.current.trim()
        barcodeBuffer.current = ''; lastKeyTime.current = 0
        if (code.length < 3) return
        handleBarcodeCode(code)
        return
      }
      if (now - lastKeyTime.current > SCAN_GAP_MS && barcodeBuffer.current) {
        barcodeBuffer.current = ''
      }
      if (e.key.length === 1) { barcodeBuffer.current += e.key; lastKeyTime.current = now }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleAddVariant])

  const handleBarcodeCode = useCallback(async (code: string) => {
    setScannerActive(true)
    setTimeout(() => setScannerActive(false), 600)
    try {
      const result = await productsApi.barcode(code)
      if (result?.product) {
        handleAddVariant(result, result.product)
        toast.success(`✔ ${result.product.name}`)
      } else if (result?.id) {
        handleAddVariant(result, result.product ?? result)
        toast.success(`✔ ${result.name ?? result.sku}`)
      } else {
        toast.error(`${t.errors.notFound}: ${code}`)
      }
    } catch { toast.error(`${t.errors.notFound}: ${code}`) }
  }, [handleAddVariant])

  // ── Totals ────────────────────────────────────────────────
  const total    = cart.getTotal(taxRate)
  const subtotal = cart.getSubtotal()
  const discount = cart.getDiscountTotal()
  const tax      = cart.getTaxTotal(taxRate)

  // Any flex item that still has no price set
  const unpricedFlex = cart.items.filter(i => i.isFlexiblePrice && i.unitPrice === 0)

  // If exactly one payment method with no amount typed, treat it as paying the full total
  const effectivePayments = (payments.length === 1 && !payments[0].amount && total > 0)
    ? [{ ...payments[0], amount: String(Math.round(total)) }]
    : payments

  // Payment calculations
  const paidTotal  = effectivePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const cashRow    = effectivePayments.find(p => p.method === 'CASH')
  const cashGiven  = Number(cashRow?.amount ?? 0)
  const change     = cashGiven > 0 && paidTotal >= total ? Math.max(0, cashGiven - (total - (paidTotal - cashGiven))) : 0
  const hasDebt    = effectivePayments.some(p => p.method === 'DEBT' && Number(p.amount) > 0)
  const debtAmount = Number(effectivePayments.find(p => p.method === 'DEBT')?.amount ?? 0)
  const isBalanced = total > 0 && Math.abs(total - paidTotal) < 1 && unpricedFlex.length === 0

  // Items where quantity exceeds tracked stock
  const overStockItems = cart.items.filter(i => {
    const s = stockMap[i.variantId]
    return s !== undefined && s >= 0 && i.quantity > s
  })

  // ── Checkout ──────────────────────────────────────────────
  const handleCheckout = () => {
    if (!cart.items.length) return toast.error(t.pos.emptyCart)
    if (unpricedFlex.length > 0) return toast.error(`Enter price for: ${unpricedFlex.map(i => i.name).join(', ')}`)
    if (overStockItems.length > 0) {
      const msg = overStockItems.map(i => {
        const avail = stockMap[i.variantId] ?? 0
        return `"${i.name}" (${avail} available, ${i.quantity} in cart)`
      }).join('; ')
      return toast.error(`Not enough stock: ${msg}`, { duration: 5000 })
    }
    if (!isBalanced) return toast.error(`${t.pos.remaining}: ${fmt.compact(total - paidTotal)}`)
    if (hasDebt && !cart.customerId) return toast.error(t.pos.selectCustomerForDebt)
    if (hasDebt && !debtDueDate) return toast.error(t.debts.dueDate)

    placeOrder.mutate({
      branchId:      user?.branchId,
      customerId:    cart.customerId ?? null,
      source:        'POS',                  // POS sales are separate from Orders section
      items:         cart.items.map(i => ({
        variantId:    i.variantId,
        quantity:     i.quantity,
        unitPrice:    i.unitPrice,
        unitCost:     i.unitCost,
        discountPct:  i.discountPct,
        discountFixed:i.discountFixed,
      })),
      payments:      effectivePayments
        .filter(p => Number(p.amount) > 0)
        .map(p => ({ method: p.method, amount: Number(p.amount) })),
      discountTotal: discount,
    })
  }

  // ── Handle print ──────────────────────────────────────────
  const handlePrint = (order: any) => {
    printReceipt({
      order,
      items:       order.items ?? cart.items,
      payments:    success?.payments ?? payments,
      cashGiven,
      change,
      storeName:   user?.branch?.name ?? 'AVERO Store',
      cashierName: user?.name ?? 'Cashier',
    })
  }

  // Reset payments when cart is cleared
  useEffect(() => {
    if (cart.items.length === 0) {
      setPayments([{ method: 'CASH', amount: '' }])
    }
  }, [cart.items.length])

  // Auto-fill payment amount when total changes and only one payment method is active
  useEffect(() => {
    if (total <= 0) return
    setPayments(prev => {
      if (prev.length === 1) {
        return [{ ...prev[0], amount: String(Math.round(total)) }]
      }
      // For split payments: fill in the remaining gap automatically on whichever has no amount
      const filled   = prev.filter(p => p.amount && Number(p.amount) > 0)
      const unfilled = prev.filter(p => !p.amount || Number(p.amount) === 0)
      if (unfilled.length === 1) {
        const rem = total - filled.reduce((s, p) => s + Number(p.amount), 0)
        if (rem > 0) return prev.map(p => p === unfilled[0] ? { ...p, amount: String(Math.round(rem)) } : p)
      }
      return prev
    })
  }, [total])

  // ── Success screen ────────────────────────────────────────
  if (success) {
    const successPayments: PaymentRow[] = success.payments ?? []
    const hasSuccessDebt = successPayments.some((p: PaymentRow) => p.method === 'DEBT')

    const PAY_LABELS_UI: Record<PayMethod, string> = {
      CASH:     t.pos.cash,
      CARD:     t.pos.card,
      TRANSFER: t.pos.transfer,
      DEBT:     t.pos.debtCredit,
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-4">
        <CheckCircle2 size={64} className="text-jade" />
        <h2 className="text-2xl font-bold">{t.pos.saleComplete}</h2>
        <p className="text-muted">{success.orderNumber}</p>
        <p className="text-3xl font-bold font-mono text-gold">{fmt.currency(Number(success.total))}</p>

        {/* Payment breakdown */}
        <div className="flex gap-3 flex-wrap justify-center">
          {successPayments.filter((p: PaymentRow) => Number(p.amount) > 0).map((p: PaymentRow) => {
            const Icon = PAY_ICONS[p.method]
            return (
              <div key={p.method} className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium',
                p.method === 'DEBT' ? 'bg-rose/10 text-rose border border-rose/30' : 'bg-gold-dim text-gold border border-gold/20'
              )}>
                <Icon size={13} />
                {PAY_LABELS_UI[p.method]}: {fmt.compact(Number(p.amount))}
              </div>
            )
          })}
        </div>

        {change > 0 && <p className="text-jade text-lg font-medium">{t.pos.change}: {fmt.currency(change)}</p>}

        {hasSuccessDebt && (
          <div className="flex items-center gap-2 bg-rose/10 border border-rose/30 rounded-xl px-4 py-2.5 text-sm text-rose">
            <TrendingDown size={15} />
            {t.pos.debtOf} {fmt.compact(debtAmount)} {t.pos.created} {debtDueDate}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => handlePrint(success)}
            className="flex items-center gap-2 px-6 py-3 bg-surface2 border border-border rounded-xl hover:border-gold/50 transition-colors"
          >
            <Printer size={18} /> {t.pos.printReceipt}
          </button>
          <button
            onClick={() => { setSuccess(null); setPayments([{ method: 'CASH', amount: '' }]) }}
            className="btn-primary px-8 py-3"
          >
            {t.pos.newSale}
          </button>
        </div>
      </div>
    )
  }

  // ── Main layout ───────────────────────────────────────────
  return (
    <>
    {cameraOpen && (
      <CameraScanner
        onDetected={(code) => { setCameraOpen(false); handleBarcodeCode(code) }}
        onClose={() => setCameraOpen(false)}
      />
    )}
    {newCustomerOpen && (
      <QuickCustomerModal
        initialPhone={phoneSearch}
        onCreated={(customer) => {
          cart.setCustomer(customer.id, customer.name)
          setPhoneSearch(customer.phone)
          toast.success(`Customer "${customer.name}" created & selected`)
        }}
        onClose={() => setNewCustomerOpen(false)}
      />
    )}
    <div className="flex h-full gap-4" style={{ height: 'calc(100vh - 5rem)' }}>

      {/* LEFT — Products */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex gap-2 mb-4">
          {tab !== 'history' && (
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.pos.searchProducts} className="input pl-9" />
            </div>
          )}
          {tab === 'history' && (
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-surface2 border border-border rounded-xl text-xs text-muted">
              <History size={13} /> Today's POS Sales
              {posHistory.length > 0 && (
                <span className="ml-auto font-mono font-semibold text-gold">{fmt.compact(posTotalToday)}</span>
              )}
            </div>
          )}
          <div
            title={t.pos.scannerReady}
            className={clsx(
              'flex items-center gap-2 px-3 rounded-xl border text-xs font-medium transition-all select-none',
              tab === 'history' ? 'hidden' :
              scannerActive ? 'border-jade bg-jade/20 text-jade animate-pulse' : 'border-border bg-surface2 text-muted'
            )}
          >
            <Barcode size={14} />
            {scannerActive ? t.pos.scanning : t.pos.scannerReady}
          </div>
          {tab !== 'history' && (
            <button
              onClick={() => setCameraOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-surface2 text-muted hover:border-gold/50 hover:text-gold transition-all text-xs font-medium"
            >
              <Camera size={14} /> {t.pos.camera}
            </button>
          )}
          {/* Toggle between products and POS history */}
          <button
            onClick={() => setTab(t2 => t2 === 'history' ? 'products' : 'history')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all whitespace-nowrap',
              tab === 'history'
                ? 'border-gold bg-gold-dim text-gold'
                : 'border-border bg-surface2 text-muted hover:text-fg'
            )}
          >
            {tab === 'history' ? <ShoppingBag size={13} /> : <History size={13} />}
            {tab === 'history' ? 'Products' : "Today's Sales"}
          </button>
        </div>

        {/* Variant selector */}
        {tab === 'variants' && selectedProduct && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => { setTab('products'); setSelectedProduct(null) }} className="text-muted hover:text-fg text-sm">
                ← {t.common.back}
              </button>
              <span className="font-semibold">{selectedProduct.name} — {t.pos.selectVariant}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {selectedProduct.variants?.map((v: any) => {
                const invRecord  = v.inventory?.find((i: any) => i.branchId === user?.branchId)
                const qty        = invRecord?.quantity ?? 0
                // Only disable if a tracked inventory record exists AND quantity is 0 or less
                const isDisabled = !!invRecord && qty <= 0
                const stockLabel = !invRecord ? t.pos.inStock : qty > 0 ? `${qty} ${t.pos.inStock}` : t.pos.outOfStock
                return (
                  <button
                    key={v.id}
                    onClick={() => handleAddVariant(v, selectedProduct)}
                    disabled={isDisabled}
                    className={clsx(
                      'p-3 rounded-xl border text-sm transition-all text-left',
                      !isDisabled ? 'border-border hover:border-gold/50 bg-surface2' : 'border-border opacity-40 cursor-not-allowed bg-surface'
                    )}
                  >
                    <div className="font-medium">{[v.size, v.color].filter(Boolean).join(' / ') || v.sku}</div>
                    <div className={clsx('text-xs mt-1', isDisabled ? 'text-rose' : 'text-muted')}>{stockLabel}</div>
                    <div className="text-xs text-gold font-mono">{fmt.compact(v.priceOverride ?? selectedProduct.sellPrice)}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* POS Sales History — today's POS transactions (separate from Orders section) */}
        {tab === 'history' && (
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {posHistory.length === 0 && (
              <div className="text-center py-16 text-muted text-sm">No POS sales today yet</div>
            )}
            {posHistory.map((o: any) => (
              <div key={o.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface2 border border-border/50 hover:border-border transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-fg truncate">{o.orderNumber}</span>
                    <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium',
                      o.status === 'COMPLETED' ? 'text-jade bg-jade/10' :
                      o.status === 'VOID'      ? 'text-rose bg-rose/10' : 'text-muted bg-surface')}>
                      {o.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted mt-0.5">
                    {o.customer?.name ?? 'Walk-in'}
                    {' · '}{o._count?.items ?? 0} item{(o._count?.items ?? 0) !== 1 ? 's' : ''}
                    {' · '}{dayjs(o.createdAt).format('HH:mm')}
                  </div>
                </div>
                <div className="text-sm font-bold font-mono text-gold">{fmt.compact(Number(o.total))}</div>
              </div>
            ))}
          </div>
        )}

        {/* Product grid */}
        {tab === 'products' && (
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
            {(products ?? []).map((p: any) => (
              <ProductCard key={p.id} product={p} onAdd={() => handleProductClick(p)} />
            ))}
            {!products?.length && (
              <div className="col-span-4 text-center py-16 text-muted">{t.pos.noProducts}</div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT — Cart */}
      <div className="w-80 flex flex-col bg-surface border border-border rounded-xl overflow-hidden flex-shrink-0">

        {/* Cart header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-fg">{t.pos.cart} · {cart.items.length} {t.pos.items}</h2>
            {cart.items.length > 0 && (
              <button onClick={() => cart.clearCart()} className="text-xs text-rose hover:underline">{t.pos.clearCart}</button>
            )}
          </div>

          {/* Customer lookup */}
          <div className="flex gap-1.5">
            <input
              value={phoneSearch}
              onChange={e => setPhoneSearch(e.target.value)}
              placeholder={t.pos.customerPhone}
              className="input text-xs flex-1"
              onKeyDown={e => e.key === 'Enter' && findCustomer.mutate(phoneSearch)}
            />
            <button
              onClick={() => findCustomer.mutate(phoneSearch)}
              title="Search customer by phone"
              className="px-2.5 py-2 bg-surface2 border border-border rounded-lg hover:bg-border transition-colors"
            >
              <User size={13} />
            </button>
            <button
              onClick={() => setNewCustomerOpen(true)}
              title="Create new customer"
              className="px-2.5 py-2 bg-surface2 border border-jade/30 rounded-lg hover:bg-jade/10 hover:border-jade/60 text-jade transition-colors"
            >
              <UserPlus size={13} />
            </button>
          </div>

          {cart.customerName && (
            <div className="mt-2 space-y-1">
              <div className="text-xs text-jade flex items-center gap-1">
                <User size={10} /> {cart.customerName}
                <button onClick={() => { cart.setCustomer(null, null); setPhoneSearch('') }} className="ml-auto text-rose">×</button>
              </div>
              {customerDebtTotal > 0 && (
                <div className="flex items-center gap-1 text-xs text-rose bg-rose/10 rounded-lg px-2 py-1">
                  <TrendingDown size={10} />
                  {t.pos.outstandingDebt}: {fmt.compact(customerDebtTotal)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {cart.items.length === 0
            ? <p className="text-center text-muted text-sm py-8">{t.pos.emptyCart}</p>
            : cart.items.map(item => (
                <CartRow
                  key={item.variantId}
                  item={item}
                  availableStock={stockMap[item.variantId] ?? -1}
                />
              ))
          }
        </div>

        {/* Totals & split payment */}
        <div className="p-4 border-t border-border space-y-3">
          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted">
              <span>{t.common.subtotal}</span>
              <span className="font-mono">{fmt.compact(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-rose">
                <span>{t.common.discount}</span>
                <span className="font-mono">-{fmt.compact(discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-border pt-2">
              <span className="text-fg">{t.common.total}</span>
              <span className="font-mono text-gold">{fmt.compact(total)}</span>
            </div>
          </div>

          {/* Split payment header */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted font-medium uppercase tracking-wider">{t.pos.payment}</span>
            <button
              onClick={() => {
                if (payments.length > 1) {
                  setPayments([{ method: 'CASH', amount: '' }])
                } else {
                  setPayments([{ method: 'CASH', amount: '' }, { method: 'DEBT', amount: '' }])
                }
              }}
              className="flex items-center gap-1 text-xs text-muted hover:text-gold transition-colors"
            >
              <ArrowRightLeft size={10} />
              {payments.length > 1 ? 'Single' : 'Split'}
            </button>
          </div>

          {/* Payment panel */}
          <SplitPaymentPanel
            total={total}
            payments={payments}
            setPayments={setPayments}
            debtDueDate={debtDueDate}
            setDebtDueDate={setDebtDueDate}
            customerId={cart.customerId}
          />

          {/* Checkout button */}
          <button
            onClick={handleCheckout}
            disabled={!cart.items.length || placeOrder.isPending || !isBalanced || overStockItems.length > 0}
            className={clsx(
              'w-full text-sm py-3 rounded-xl font-bold transition-all',
              cart.items.length && isBalanced && overStockItems.length === 0
                ? hasDebt
                  ? 'bg-gradient-to-r from-gold/90 to-rose/80 text-bg hover:opacity-90'
                  : 'btn-primary'
                : 'bg-surface2 text-muted border border-border cursor-not-allowed'
            )}
          >
            {placeOrder.isPending
              ? t.pos.processing
              : !cart.items.length
                ? t.pos.emptyCart
                : overStockItems.length > 0
                  ? `⚠ Not enough stock (${overStockItems.length} item${overStockItems.length > 1 ? 's' : ''})`
                  : unpricedFlex.length > 0
                    ? `⚡ Enter price for ${unpricedFlex.length} item${unpricedFlex.length > 1 ? 's' : ''}`
                    : !isBalanced
                      ? `${fmt.compact(Math.abs(total - paidTotal))} remaining…`
                      : hasDebt
                        ? `${t.pos.charge} + ${t.pos.debtCredit} (${fmt.compact(debtAmount)})`
                        : `${t.pos.charge} ${fmt.compact(total)}`
            }
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
