import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi, ordersApi, branchesApi, customersApi } from '../lib/api'
import { fmt } from '../components/Shared'
import { Search, Plus, Minus, Trash2, ShoppingCart, X, Check, Loader2, Scan } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER']

export default function POSPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()

  const [search, setSearch]     = useState('')
  const [cart, setCart]         = useState<any[]>([])
  const [customer, setCustomer] = useState<any>(null)
  const [custSearch, setCustSearch] = useState('')
  const [discount, setDiscount] = useState(0)
  const [payMethod, setPayMethod] = useState('CASH')
  const [cashGiven, setCashGiven] = useState('')
  const [receipt, setReceipt]   = useState<any>(null)
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
      setReceipt(data)
      setCart([])
      setCustomer(null)
      setDiscount(0)
      setCashGiven('')
      toast.success('Order placed!')
      // Invalidate all caches so Dashboard, Inventory, Orders pages reflect the new sale immediately
      qc.invalidateQueries({ queryKey: ['analytics'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['pos.products'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to place order'),
  })

  const products  = productsData?.data ?? []
  const subtotal  = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const discountAmt = discount > 0 ? Math.round(subtotal * discount / 100) : 0
  const total     = subtotal - discountAmt

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
      toast.success(`Added: ${variant.product.name}`)
    } catch {
      toast.error('Product not found for this barcode')
    }
  }

  const changeQty = (variantId: string, delta: number) => {
    setCart(c => c
      .map(i => i.variantId === variantId ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0)
    )
  }

  const placeOrder = () => {
    if (!cart.length) return toast.error('Cart is empty')
    if (!branchId) return toast.error('Select a branch')

    orderMut.mutate({
      branchId,
      customerId: customer?.id ?? null,
      source:     'POS',
      status:     'COMPLETED',
      discountTotal: discountAmt,
      items: cart.map(i => ({
        variantId: i.variantId,
        quantity:  i.qty,
        unitPrice: i.price,
        unitCost:  i.costPrice,
        lineTotal: i.price * i.qty,
      })),
      payments: [{
        method: payMethod,
        amount: total,
      }],
    })
  }

  if (receipt) {
    return (
      <div className="h-full flex items-center justify-center bg-bg">
        <div className="bg-surface border border-border rounded-2xl p-8 w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-jade/10 flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-jade" />
          </div>
          <h2 className="text-xl font-display font-bold text-fg mb-1">Order Complete!</h2>
          <p className="text-muted text-sm mb-4">#{receipt.id?.slice(-8)}</p>
          <p className="text-3xl font-mono font-bold text-gold mb-6">{fmt(receipt.total)}</p>
          {payMethod === 'CASH' && cashGiven && (
            <p className="text-sm text-muted mb-4">
              Change: <span className="text-jade font-mono">{fmt(Number(cashGiven) - total)}</span>
            </p>
          )}
          <button onClick={() => setReceipt(null)}
            className="w-full bg-gold text-bg py-2.5 rounded-lg text-sm font-semibold hover:bg-gold/90">
            New Sale
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex bg-bg">
      {/* Product search panel */}
      <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
        <div className="p-4 border-b border-border space-y-3">
          <h1 className="text-lg font-display font-bold text-fg">Point of Sale</h1>
          {/* Branch selector */}
          {!user?.branchId && (
            <select value={branchId} onChange={e => setBranchId(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none">
              <option value="">Select branch</option>
              {branches?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {/* Barcode scan */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Scan size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input ref={barcodeRef} value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && scanBarcode()}
                placeholder="Scan barcode or type…"
                className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-fg placeholder:text-muted/50 focus:outline-none focus:border-gold/60" />
            </div>
            <button onClick={scanBarcode} className="px-3 py-2 bg-surface2 border border-border rounded-lg text-xs text-fg hover:bg-border">
              Scan
            </button>
          </div>
          {/* Product search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search product name…"
              className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-fg placeholder:text-muted/50 focus:outline-none focus:border-gold/60" />
          </div>
        </div>

        {/* Product results */}
        <div className="flex-1 overflow-auto p-4">
          {search && products.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {products.map((p: any) =>
                p.variants?.map((v: any) => (
                  <button key={v.id} onClick={() => addToCart(p, v)}
                    className="bg-surface border border-border rounded-xl p-3 text-left hover:border-gold/40 transition-colors">
                    <p className="text-sm font-medium text-fg truncate">{p.name}</p>
                    {(v.size || v.color) && (
                      <p className="text-xs text-muted">{[v.size, v.color].filter(Boolean).join(' · ')}</p>
                    )}
                    <p className="text-sm font-mono text-gold mt-1">{fmt(v.priceOverride ?? p.sellPrice)}</p>
                  </button>
                ))
              )}
            </div>
          )}
          {search && products.length === 0 && (
            <p className="text-center text-sm text-muted py-8">No products found</p>
          )}
          {!search && (
            <div className="flex flex-col items-center justify-center h-full text-muted">
              <ShoppingCart size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Search or scan to add products</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-80 flex flex-col bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-fg">Cart ({cart.length})</h2>
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
                <button onClick={() => changeQty(item.variantId, -1)} className="w-6 h-6 rounded bg-bg border border-border flex items-center justify-center text-muted hover:text-fg">
                  <Minus size={10} />
                </button>
                <span className="w-6 text-center text-sm text-fg">{item.qty}</span>
                <button onClick={() => changeQty(item.variantId, 1)} className="w-6 h-6 rounded bg-bg border border-border flex items-center justify-center text-muted hover:text-fg">
                  <Plus size={10} />
                </button>
              </div>
            </div>
          ))}
          {!cart.length && (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <ShoppingCart size={32} className="mb-2 opacity-30" />
              <p className="text-xs">Cart is empty</p>
            </div>
          )}
        </div>

        {/* Customer */}
        <div className="px-4 py-3 border-t border-border">
          {customer ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">Customer</p>
                <p className="text-sm text-fg">{customer.name}</p>
              </div>
              <button onClick={() => setCustomer(null)} className="text-muted hover:text-fg"><X size={14} /></button>
            </div>
          ) : (
            <div className="relative">
              <input value={custSearch} onChange={e => setCustSearch(e.target.value)}
                placeholder="Add customer (optional)…"
                className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-xs text-fg placeholder:text-muted/50 focus:outline-none focus:border-gold/60" />
              {custResults?.data?.length > 0 && custSearch.length >= 2 && (
                <div className="absolute bottom-full left-0 right-0 bg-surface2 border border-border rounded-lg overflow-hidden shadow-xl z-10 mb-1">
                  {custResults.data.slice(0, 5).map((c: any) => (
                    <button key={c.id} onClick={() => { setCustomer(c); setCustSearch('') }}
                      className="w-full text-left px-3 py-2 text-xs text-fg hover:bg-bg">
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
            <span>Subtotal</span>
            <span className="font-mono">{fmt(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Discount %</span>
            <input type="number" min={0} max={100} value={discount}
              onChange={e => setDiscount(Number(e.target.value))}
              className="w-16 bg-bg border border-border rounded px-2 py-0.5 text-xs text-fg text-right focus:outline-none" />
          </div>
          {discountAmt > 0 && (
            <div className="flex justify-between text-rose text-xs">
              <span>Discount</span>
              <span className="font-mono">-{fmt(discountAmt)}</span>
            </div>
          )}
          <div className="flex justify-between text-fg font-semibold border-t border-border pt-2">
            <span>Total</span>
            <span className="font-mono text-gold">{fmt(total)}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="px-4 py-3 border-t border-border space-y-3">
          <div className="flex gap-1">
            {PAYMENT_METHODS.map(m => (
              <button key={m} onClick={() => setPayMethod(m)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  payMethod === m ? 'bg-gold text-bg' : 'bg-bg border border-border text-muted hover:text-fg'
                }`}>
                {m}
              </button>
            ))}
          </div>
          {payMethod === 'CASH' && (
            <input type="number" value={cashGiven} onChange={e => setCashGiven(e.target.value)}
              placeholder="Cash given…"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
          )}
          <button onClick={placeOrder}
            disabled={!cart.length || orderMut.isPending}
            className="w-full bg-jade text-bg py-3 rounded-xl text-sm font-bold hover:bg-jade/90 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors">
            {orderMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  )
}
