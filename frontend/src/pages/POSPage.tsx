import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi, ordersApi, branchesApi, customersApi } from '../lib/api'
import { fmt } from '../components/Shared'
import { Search, Plus, Minus, Trash2, ShoppingCart, X, Check, Loader2, Scan, Printer, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER']

// ─── Thermal Receipt Printing ──────────────────────────────────────────────
function printReceipt(receipt: any, cart: any[], total: number, subtotal: number,
  discountAmt: number, payMethod: string, cashGiven: string, branchName: string,
  customerName?: string) {

  const change = payMethod === 'CASH' && cashGiven ? Number(cashGiven) - total : 0
  const now = new Date()
  const dateStr = now.toLocaleDateString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Receipt #${receipt.id?.slice(-8) ?? ''}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    width: 80mm;
    max-width: 80mm;
    margin: 0 auto;
    padding: 4mm;
    background: #fff;
    color: #000;
  }
  .center { text-align: center; }
  .bold   { font-weight: bold; }
  .big    { font-size: 14px; font-weight: bold; }
  .line   { border-top: 1px dashed #000; margin: 4px 0; }
  .row    { display: flex; justify-content: space-between; gap: 4px; }
  .row .left  { flex: 1; }
  .row .right { text-align: right; white-space: nowrap; }
  .item-name  { font-size: 10px; }
  .total-row  { font-weight: bold; font-size: 13px; }
  .footer { font-size: 9px; color: #444; margin-top: 6px; }
  @media print {
    html, body { width: 80mm; }
    @page { margin: 0; size: 80mm auto; }
  }
</style>
</head>
<body>
  <div class="center bold big">JANZE</div>
  <div class="center" style="font-size:10px;">${branchName}</div>
  <div class="center footer">${dateStr} ${timeStr}</div>
  <div class="line"></div>

  ${customerName ? `<div class="row"><span>Mijoz:</span><span class="right bold">${customerName}</span></div>` : ''}
  <div class="row"><span>Chek #:</span><span class="right">${receipt.id?.slice(-8) ?? '-'}</span></div>
  <div class="row"><span>To'lov:</span><span class="right">${payMethod}</span></div>
  <div class="line"></div>

  ${cart.map(item => `
  <div class="row item-name">
    <span class="left">${item.name}${item.size || item.color ? ' (' + [item.size, item.color].filter(Boolean).join('/') + ')' : ''}</span>
  </div>
  <div class="row">
    <span class="left" style="padding-left:8px;">${fmt(item.price)} × ${item.qty}</span>
    <span class="right bold">${fmt(item.price * item.qty)}</span>
  </div>`).join('')}

  <div class="line"></div>

  <div class="row"><span>Jami:</span><span class="right">${fmt(subtotal)}</span></div>
  ${discountAmt > 0 ? `<div class="row"><span>Chegirma:</span><span class="right">-${fmt(discountAmt)}</span></div>` : ''}
  <div class="row total-row"><span>TO'LOV:</span><span class="right">${fmt(total)}</span></div>
  ${change > 0 ? `<div class="row"><span>Qaytim:</span><span class="right bold">${fmt(change)}</span></div>` : ''}

  <div class="line"></div>
  <div class="center footer">Rahmat! Yana keling!</div>
  <div class="center footer">JANZE ERP v2</div>
  <br/><br/>
</body>
</html>`

  const win = window.open('', '_blank', 'width=320,height=600,toolbar=0,menubar=0,scrollbars=1')
  if (!win) { toast.error('Pop-up bloklangan — brauzer ruxsat bering'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); setTimeout(() => win.close(), 500) }, 400)
}

// ─── Label Printing (58mm barcode label) ──────────────────────────────────
function printLabel(item: { name: string; sku?: string; price: number; size?: string; color?: string }) {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Label</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    width: 58mm;
    padding: 2mm;
    background: #fff;
    color: #000;
    font-size: 10px;
  }
  .name  { font-size: 12px; font-weight: bold; word-break: break-word; }
  .price { font-size: 18px; font-weight: bold; text-align: right; margin: 2px 0; }
  .sku   { font-size: 9px; color: #555; }
  .attr  { font-size: 9px; }
  @media print {
    @page { margin: 0; size: 58mm 40mm; }
  }
</style>
</head>
<body>
  <div class="name">${item.name}</div>
  ${item.size || item.color ? `<div class="attr">${[item.size, item.color].filter(Boolean).join(' · ')}</div>` : ''}
  <div class="price">${fmt(item.price)}</div>
  ${item.sku ? `<div class="sku">SKU: ${item.sku}</div>` : ''}
</body>
</html>`

  const win = window.open('', '_blank', 'width=240,height=200,toolbar=0,menubar=0')
  if (!win) { toast.error('Pop-up bloklangan'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); setTimeout(() => win.close(), 500) }, 300)
}

// ──────────────────────────────────────────────────────────────────────────
export default function POSPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()

  const [search, setSearch]         = useState('')
  const [cart, setCart]             = useState<any[]>([])
  const [customer, setCustomer]     = useState<any>(null)
  const [custSearch, setCustSearch] = useState('')
  const [discount, setDiscount]     = useState(0)
  const [payMethod, setPayMethod]   = useState('CASH')
  const [cashGiven, setCashGiven]   = useState('')
  const [receipt, setReceipt]         = useState<any>(null)
  const [savedCart, setSavedCart]     = useState<any[]>([])
  const [savedTotal, setSavedTotal]   = useState(0)
  const [savedSubtotal, setSavedSubtotal] = useState(0)
  const [savedDiscount, setSavedDiscount] = useState(0)
  const [barcodeInput, setBarcodeInput] = useState('')
  const barcodeRef = useRef<HTMLInputElement>(null)

  const { data: productsData } = useQuery({
    queryKey: ['pos.products', search],
    queryFn:  () => productsApi.list({ search, isActive: 'true', limit: 30, page: 1 }),
    enabled: search.length > 0,
  })

  const { data: custResults } = useQuery({
    queryKey: ['pos.customers', custSearch],
    queryFn:  () => customersApi.list({ search: custSearch, limit: 8 }),
    enabled: custSearch.length >= 2,
  })

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn:  branchesApi.list,
  })

  const [branchId, setBranchId] = useState(user?.branchId ?? '')

  const orderMut = useMutation({
    mutationFn: ordersApi.create,
    onSuccess: (data: any) => {
      // Snapshot BEFORE clearing state
      setSavedCart([...cart])
      setSavedTotal(total)
      setSavedSubtotal(subtotal)
      setSavedDiscount(discountAmt)
      setReceipt(data)
      setCart([])
      setCustomer(null)
      setDiscount(0)
      toast.success('Buyurtma qabul qilindi!')
      qc.invalidateQueries({ queryKey: ['analytics'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['pos.products'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Xatolik yuz berdi'),
  })

  const products    = productsData?.data ?? []
  const subtotal    = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const discountAmt = discount > 0 ? Math.round(subtotal * discount / 100) : 0
  const total       = subtotal - discountAmt

  const addToCart = (product: any, variant: any) => {
    const key = variant.id
    setCart(c => {
      const exists = c.find(i => i.variantId === key)
      if (exists) return c.map(i => i.variantId === key ? { ...i, qty: i.qty + 1 } : i)
      return [...c, {
        variantId: variant.id,
        productId: product.id,
        name:      product.name,
        sku:       variant.sku,
        size:      variant.size,
        color:     variant.color,
        price:     variant.priceOverride ?? product.sellPrice,
        qty:       1,
        costPrice: product.costPrice,
      }]
    })
    setSearch('')
  }

  const scanBarcode = async () => {
    if (!barcodeInput.trim()) return
    try {
      const variant = await productsApi.barcode(barcodeInput.trim())
      addToCart(variant.product, variant)
      setBarcodeInput('')
      barcodeRef.current?.focus()
      toast.success(`Qo'shildi: ${variant.product.name}`)
    } catch {
      toast.error('Mahsulot topilmadi')
      barcodeRef.current?.select()
    }
  }

  const changeQty = (variantId: string, delta: number) => {
    setCart(c => c
      .map(i => i.variantId === variantId ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0)
    )
  }

  const placeOrder = () => {
    if (!cart.length) return toast.error('Savat bo\'sh')
    if (!branchId)    return toast.error('Filialni tanlang')

    orderMut.mutate({
      branchId,
      customerId:    customer?.id ?? null,
      source:        'POS',
      status:        'COMPLETED',
      discountTotal: discountAmt,
      items: cart.map(i => ({
        variantId: i.variantId,
        quantity:  i.qty,
        unitPrice: i.price,
        unitCost:  i.costPrice,
        lineTotal: i.price * i.qty,
      })),
      payments: [{ method: payMethod, amount: total }],
    })
  }

  // branch name for receipt
  const branchName = (branches as any[])?.find((b: any) => b.id === branchId)?.name ?? 'JANZE'

  // ── Receipt Screen ────────────────────────────────────────────────────────
  if (receipt) {
    const cartSnapshot = savedCart
    const finalTotal   = receipt.total ?? savedTotal
    const change = payMethod === 'CASH' && cashGiven && Number(cashGiven) >= finalTotal
      ? Number(cashGiven) - finalTotal
      : 0

    return (
      <div className="h-full flex items-center justify-center bg-bg">
        <div className="bg-surface border border-border rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-jade/10 flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-jade" />
          </div>
          <h2 className="text-xl font-display font-bold text-fg mb-1">Buyurtma qabul qilindi!</h2>
          <p className="text-muted text-sm mb-1">#{receipt.id?.slice(-8)}</p>
          <p className="text-3xl font-mono font-bold text-gold mb-2">{fmt(finalTotal)}</p>
          {change > 0 && (
            <p className="text-sm text-muted mb-4">
              Qaytim: <span className="text-jade font-mono font-bold">{fmt(change)}</span>
            </p>
          )}

          {/* Print actions */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => printReceipt(receipt, cartSnapshot, finalTotal, savedSubtotal, savedDiscount, payMethod, cashGiven, branchName, customer?.name)}
              className="flex-1 flex items-center justify-center gap-2 bg-gold/10 border border-gold/30 text-gold rounded-xl py-2.5 text-sm font-semibold hover:bg-gold/20 transition-colors"
            >
              <Printer size={16} />
              Chek bosib chiqarish
            </button>
            <button
              onClick={() => {
                cartSnapshot.forEach(item => printLabel({
                  name:  item.name,
                  sku:   item.sku,
                  price: item.price,
                  size:  item.size,
                  color: item.color,
                }))
              }}
              className="flex items-center justify-center gap-1 px-3 bg-surface2 border border-border text-muted rounded-xl py-2.5 text-sm hover:text-fg hover:border-gold/30 transition-colors"
              title="Label bosib chiqarish"
            >
              <Tag size={16} />
            </button>
          </div>

          <button
            onClick={() => {
              setReceipt(null); setSavedCart([])
              setSavedTotal(0); setSavedSubtotal(0); setSavedDiscount(0)
              setCashGiven('')
            }}
            className="w-full bg-jade text-bg py-2.5 rounded-xl text-sm font-bold hover:bg-jade/90 transition-colors"
          >
            Yangi sotuv
          </button>
        </div>
      </div>
    )
  }

  // ── Main POS ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex bg-bg">
      {/* Product search panel */}
      <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
        <div className="p-4 border-b border-border space-y-3">
          <h1 className="text-lg font-display font-bold text-fg">Sotuv nuqtasi (POS)</h1>

          {/* Branch selector */}
          {!user?.branchId && (
            <select
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60"
            >
              <option value="">Filial tanlang</option>
              {(branches as any[])?.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}

          {/* Barcode scan */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Scan size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={barcodeRef}
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && scanBarcode()}
                placeholder="Barkod skan yoki yozing…"
                className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-fg placeholder:text-muted/50 focus:outline-none focus:border-gold/60"
              />
            </div>
            <button
              onClick={scanBarcode}
              className="px-3 py-2 bg-surface2 border border-border rounded-lg text-xs text-fg hover:bg-border transition-colors"
            >
              Skan
            </button>
          </div>

          {/* Product search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Mahsulot nomi bo'yicha qidirish…"
              className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-fg placeholder:text-muted/50 focus:outline-none focus:border-gold/60"
            />
          </div>
        </div>

        {/* Product results */}
        <div className="flex-1 overflow-auto p-4">
          {search && products.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {products.map((p: any) =>
                p.variants?.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => addToCart(p, v)}
                    className="bg-surface border border-border rounded-xl p-3 text-left hover:border-gold/40 transition-colors group"
                  >
                    <p className="text-sm font-medium text-fg truncate">{p.name}</p>
                    {(v.size || v.color) && (
                      <p className="text-xs text-muted">{[v.size, v.color].filter(Boolean).join(' · ')}</p>
                    )}
                    <p className="text-sm font-mono text-gold mt-1">{fmt(v.priceOverride ?? p.sellPrice)}</p>
                    {v.sku && <p className="text-xs text-muted/60 mt-0.5 font-mono">{v.sku}</p>}
                  </button>
                ))
              )}
            </div>
          )}
          {search && products.length === 0 && (
            <p className="text-center text-sm text-muted py-8">Mahsulot topilmadi</p>
          )}
          {!search && (
            <div className="flex flex-col items-center justify-center h-full text-muted">
              <ShoppingCart size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Mahsulotni qidiring yoki skan qiling</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-80 flex flex-col bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">Savat ({cart.length})</h2>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs text-muted hover:text-rose transition-colors flex items-center gap-1"
            >
              <Trash2 size={12} />
              Tozalash
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-auto divide-y divide-border">
          {cart.map(item => (
            <div key={item.variantId} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-fg truncate">{item.name}</p>
                {(item.size || item.color) && (
                  <p className="text-xs text-muted">{[item.size, item.color].filter(Boolean).join(' · ')}</p>
                )}
                <p className="text-xs font-mono text-gold">{fmt(item.price)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => changeQty(item.variantId, -1)}
                  className="w-6 h-6 rounded bg-bg border border-border flex items-center justify-center text-muted hover:text-fg transition-colors"
                >
                  <Minus size={10} />
                </button>
                <span className="w-6 text-center text-sm font-medium text-fg">{item.qty}</span>
                <button
                  onClick={() => changeQty(item.variantId, 1)}
                  className="w-6 h-6 rounded bg-bg border border-border flex items-center justify-center text-muted hover:text-fg transition-colors"
                >
                  <Plus size={10} />
                </button>
              </div>
            </div>
          ))}
          {!cart.length && (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <ShoppingCart size={32} className="mb-2 opacity-30" />
              <p className="text-xs">Savat bo'sh</p>
            </div>
          )}
        </div>

        {/* Customer */}
        <div className="px-4 py-3 border-t border-border">
          {customer ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">Mijoz</p>
                <p className="text-sm font-medium text-fg">{customer.name}</p>
              </div>
              <button onClick={() => setCustomer(null)} className="text-muted hover:text-fg transition-colors">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={custSearch}
                onChange={e => setCustSearch(e.target.value)}
                placeholder="Mijoz qo'shish (ixtiyoriy)…"
                className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-xs text-fg placeholder:text-muted/50 focus:outline-none focus:border-gold/60"
              />
              {custResults?.data?.length > 0 && custSearch.length >= 2 && (
                <div className="absolute bottom-full left-0 right-0 bg-surface2 border border-border rounded-lg overflow-hidden shadow-xl z-10 mb-1">
                  {custResults.data.slice(0, 5).map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => { setCustomer(c); setCustSearch('') }}
                      className="w-full text-left px-3 py-2 text-xs text-fg hover:bg-bg transition-colors"
                    >
                      {c.name} · {c.phone ?? ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="px-4 py-3 border-t border-border space-y-2 text-sm">
          <div className="flex justify-between text-muted">
            <span>Jami:</span>
            <span className="font-mono">{fmt(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Chegirma %</span>
            <input
              type="number" min={0} max={100} value={discount}
              onChange={e => setDiscount(Number(e.target.value))}
              className="w-16 bg-bg border border-border rounded px-2 py-0.5 text-xs text-fg text-right focus:outline-none focus:border-gold/60"
            />
          </div>
          {discountAmt > 0 && (
            <div className="flex justify-between text-rose text-xs">
              <span>Chegirma:</span>
              <span className="font-mono">-{fmt(discountAmt)}</span>
            </div>
          )}
          <div className="flex justify-between text-fg font-semibold border-t border-border pt-2">
            <span>TO'LOV:</span>
            <span className="font-mono text-gold text-base">{fmt(total)}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="px-4 py-3 border-t border-border space-y-3">
          <div className="flex gap-1">
            {PAYMENT_METHODS.map(m => (
              <button
                key={m}
                onClick={() => setPayMethod(m)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  payMethod === m
                    ? 'bg-gold text-bg'
                    : 'bg-bg border border-border text-muted hover:text-fg'
                }`}
              >
                {m === 'CASH' ? 'Naqd' : m === 'CARD' ? 'Karta' : 'O\'tkazma'}
              </button>
            ))}
          </div>
          {payMethod === 'CASH' && (
            <input
              type="number"
              value={cashGiven}
              onChange={e => setCashGiven(e.target.value)}
              placeholder="Berilgan summa…"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60"
            />
          )}
          {payMethod === 'CASH' && cashGiven && Number(cashGiven) >= total && (
            <div className="flex justify-between text-jade text-xs font-medium px-1">
              <span>Qaytim:</span>
              <span className="font-mono">{fmt(Number(cashGiven) - total)}</span>
            </div>
          )}
          <button
            onClick={placeOrder}
            disabled={!cart.length || orderMut.isPending}
            className="w-full bg-jade text-bg py-3 rounded-xl text-sm font-bold hover:bg-jade/90 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
          >
            {orderMut.isPending
              ? <Loader2 size={16} className="animate-spin" />
              : <Check size={16} />
            }
            Sotuvni yakunlash
          </button>
        </div>
      </div>
    </div>
  )
}
