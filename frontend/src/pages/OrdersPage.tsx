import { useState, useEffect, useRef }  from 'react'
import { ordersApi, productsApi, customersApi } from '../lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { useT }         from '../i18n'
import { fmt }          from '../utils/format'
import { useNavigate }  from 'react-router-dom'
import toast            from 'react-hot-toast'
import clsx             from 'clsx'
import {
  RotateCcw, Plus, ShoppingCart, Eye, X, Package,
  CheckCircle2, XCircle, Clock, BarChart2, TrendingUp,
  Search, Trash2, User, CreditCard, Banknote, PackagePlus, Sparkles, Pencil,
} from 'lucide-react'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'bg-jade/10 text-jade border-jade/20',
  REFUNDED:  'bg-amber-400/10 text-amber-400 border-amber-400/20',
  VOID:      'bg-rose/10 text-rose border-rose/20',
  PENDING:   'bg-gold/10 text-gold border-gold/20',
}

// Valid PaymentMethod enum values — MIXED is NOT a valid method (it's a display-only label for orders with multiple payment types)
const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER', 'LOYALTY', 'DEBT']

// ── Create Order Modal ────────────────────────────────────────────────────────
interface OrderLineItem {
  variantId:    string
  productName:  string
  variantLabel: string
  unitPrice:    number
  quantity:     number
  discountPct:  number
  isNew?:       boolean   // flag for products just created inline
}

const EMPTY_NEW_PRODUCT = { name: '', sellPrice: '', costPrice: '', sku: '', barcode: '', size: '', color: '' }

function CreateOrderModal({ branchId, onClose, onCreated }: {
  branchId: string
  onClose:  () => void
  onCreated: () => void
}) {
  const t  = useT()
  const qc = useQueryClient()

  const [productSearch,    setProductSearch]    = useState('')
  const [customerSearch,   setCustomerSearch]   = useState('')
  const [showProductDrop,  setShowProductDrop]  = useState(false)
  const [showCustomerDrop, setShowCustomerDrop] = useState(false)
  const [showNewProduct,   setShowNewProduct]   = useState(false)
  const [newProduct,       setNewProduct]       = useState(EMPTY_NEW_PRODUCT)
  const [lines,     setLines]     = useState<OrderLineItem[]>([])
  const [customer,  setCustomer]  = useState<any>(null)
  const [payMethod, setPayMethod] = useState('CASH')
  const [notes,     setNotes]     = useState('')
  const [payAmount, setPayAmount] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const newNameRef = useRef<HTMLInputElement>(null)

  // Product search
  const { data: productData, isFetching: productFetching } = useQuery({
    queryKey: ['products-search-order', productSearch],
    queryFn:  () => productsApi.list({ search: productSearch || undefined, limit: 20 }),
    enabled:  showProductDrop,
  })
  const products: any[] = productData?.data ?? []
  const noResults = showProductDrop && !productFetching && productSearch.trim().length > 0 && products.length === 0

  // Customer search
  const { data: customerData } = useQuery({
    queryKey: ['customers-search-order', customerSearch],
    queryFn:  () => customersApi.list({ search: customerSearch || undefined, limit: 10 }),
    enabled:  showCustomerDrop,
  })
  const customers: any[] = customerData?.data ?? []

  // Totals
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  const discount = lines.reduce((s, l) => s + (l.unitPrice * l.quantity * l.discountPct / 100), 0)
  const total    = Math.max(0, subtotal - discount)

  // Sync pay amount when total changes
  useEffect(() => {
    setPayAmount(total > 0 ? String(Math.round(total)) : '')
  }, [total])

  // Auto-focus new product name field when panel opens
  useEffect(() => {
    if (showNewProduct) setTimeout(() => newNameRef.current?.focus(), 50)
  }, [showNewProduct])

  const addVariant = (product: any, variant: any) => {
    const price = Number(variant.priceOverride ?? product.sellPrice ?? 0)
    const label = [variant.size, variant.color].filter(Boolean).join(' / ') || 'Default'
    const existing = lines.findIndex(l => l.variantId === variant.id)
    if (existing >= 0) {
      setLines(prev => prev.map((l, i) => i === existing ? { ...l, quantity: l.quantity + 1 } : l))
    } else {
      setLines(prev => [...prev, {
        variantId:    variant.id,
        productName:  product.name,
        variantLabel: label,
        unitPrice:    price,
        quantity:     1,
        discountPct:  0,
      }])
    }
    setProductSearch('')
    setShowProductDrop(false)
  }

  const updateLine = (idx: number, field: keyof OrderLineItem, value: any) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx))

  // Create product inline and immediately add to order
  const createProductMut = useMutation({
    mutationFn: (data: any) => productsApi.create(data),
    onSuccess: (created: any) => {
      // Invalidate products cache so it shows up in Products page too
      qc.invalidateQueries({ queryKey: ['products'] })
      const variant = created.variants?.[0]
      if (!variant) { toast.error(t.orders.failedCreateProduct); return }
      const price = Number(created.sellPrice ?? 0)
      const label = [variant.size, variant.color].filter(Boolean).join(' / ') || '—'
      setLines(prev => [...prev, {
        variantId:    variant.id,
        productName:  created.name,
        variantLabel: label,
        unitPrice:    price,
        quantity:     1,
        discountPct:  0,
        isNew:        true,
      }])
      setNewProduct(EMPTY_NEW_PRODUCT)
      setShowNewProduct(false)
      toast.success(`"${created.name}" ${t.notifications.created}`)
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? t.orders.failedCreateProduct),
  })

  const handleCreateProduct = () => {
    if (!newProduct.name.trim()) { toast.error(t.orders.productRequired); return }
    if (!newProduct.sellPrice || Number(newProduct.sellPrice) <= 0) { toast.error(t.orders.priceRequired); return }
    const sku = newProduct.sku.trim() || `${newProduct.name.slice(0,6).toUpperCase().replace(/\s/g,'')}-${Date.now()}`
    createProductMut.mutate({
      name:      newProduct.name.trim(),
      sellPrice: Number(newProduct.sellPrice),
      costPrice: Number(newProduct.costPrice || 0),
      skuBase:   sku,
      isActive:  true,
      variants: [{
        sku,
        barcode:  newProduct.barcode.trim() || null,
        size:     newProduct.size.trim()    || null,
        color:    newProduct.color.trim()   || null,
        isActive: true,
      }],
    })
  }

  const createMut = useMutation({
    mutationFn: (payload: any) => ordersApi.create(payload),
    onSuccess: () => {
      toast.success(t.orders.createdSuccess)
      onCreated()
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? t.orders.failedCreate),
  })

  const handleSubmit = () => {
    if (lines.length === 0) { toast.error(t.orders.addOneProduct); return }
    const paid = Number(payAmount) || total
    createMut.mutate({
      branchId,
      customerId:  customer?.id ?? null,
      source:      'ORDER',              // Orders section — feeds Dashboard & Analytics
      notes:       notes || null,
      items: lines.map(l => ({
        variantId:     l.variantId,
        quantity:      l.quantity,
        unitPrice:     l.unitPrice,
        unitCost:      0,
        discountPct:   l.discountPct,
        discountFixed: 0,
      })),
      payments: [{ method: payMethod, amount: paid, reference: null }],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-fg">{t.orders.createOrder}</h2>
            <p className="text-xs text-muted">{t.orders.createOrderSub}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Customer picker */}
          <div className="relative">
            <label className="text-xs font-medium text-muted mb-1.5 flex items-center gap-1">
              <User size={11} /> {t.orders.customer} <span className="text-muted/50 ml-1">{t.orders.optionalLabel}</span>
            </label>
            {customer ? (
              <div className="flex items-center justify-between bg-surface2 border border-border rounded-xl px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-fg">{customer.name}</span>
                  {customer.phone && <span className="text-xs text-muted ml-2">{customer.phone}</span>}
                  {customer.loyaltyPoints > 0 && (
                    <span className="text-xs text-gold ml-2">⭐ {customer.loyaltyPoints} pts</span>
                  )}
                </div>
                <button onClick={() => setCustomer(null)} className="text-muted hover:text-rose transition-colors">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true) }}
                  onFocus={() => setShowCustomerDrop(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDrop(false), 150)}
                  placeholder={t.orders.searchCustomerPh}
                  className="input pl-8 w-full text-sm"
                />
                {showCustomerDrop && customers.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-surface border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {customers.map((c: any) => (
                      <button key={c.id} onMouseDown={() => { setCustomer(c); setCustomerSearch(''); setShowCustomerDrop(false) }}
                        className="w-full text-left px-3 py-2.5 hover:bg-surface2 transition-colors flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-fg">{c.name}</div>
                          <div className="text-xs text-muted">{c.phone}</div>
                        </div>
                        {c.loyaltyPoints > 0 && <span className="text-xs text-gold">⭐ {c.loyaltyPoints}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Product search */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-muted flex items-center gap-1">
                <ShoppingCart size={11} /> {t.orders.items}
              </label>
              <button
                onClick={() => { setShowNewProduct(v => !v); setShowProductDrop(false) }}
                className={clsx(
                  'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors',
                  showNewProduct
                    ? 'bg-gold/10 border-gold/30 text-gold'
                    : 'border-border text-muted hover:border-gold/40 hover:text-gold'
                )}>
                <PackagePlus size={12} />
                {showNewProduct ? t.orders.cancelNewProduct : t.orders.newProductBtn}
              </button>
            </div>

            {/* ── Inline new product form ── */}
            {showNewProduct && (
              <div className="mb-3 bg-gold/5 border border-gold/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={13} className="text-gold" />
                  <span className="text-xs font-semibold text-gold">{t.orders.quickAddProduct}</span>
                  <span className="text-[10px] text-muted ml-auto">{t.orders.quickAddProductNote}</span>
                </div>

                {/* Row 1: name + sell price */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted mb-1 block">{t.orders.productNameLabel} *</label>
                    <input
                      ref={newNameRef}
                      value={newProduct.name}
                      onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Nike Air Max"
                      className="input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted mb-1 block">{t.orders.sellingPrice} *</label>
                    <input
                      type="number" min={0}
                      value={newProduct.sellPrice}
                      onChange={e => setNewProduct(p => ({ ...p, sellPrice: e.target.value }))}
                      placeholder="0"
                      className="input w-full text-sm font-mono"
                    />
                  </div>
                </div>

                {/* Row 2: cost + SKU */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted mb-1 block">{t.orders.costPriceLabel}</label>
                    <input
                      type="number" min={0}
                      value={newProduct.costPrice}
                      onChange={e => setNewProduct(p => ({ ...p, costPrice: e.target.value }))}
                      placeholder="0"
                      className="input w-full text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted mb-1 block">{t.orders.skuAutoBlank}</label>
                    <input
                      value={newProduct.sku}
                      onChange={e => setNewProduct(p => ({ ...p, sku: e.target.value }))}
                      placeholder={t.orders.autoGenerated}
                      className="input w-full text-sm font-mono"
                    />
                  </div>
                </div>

                {/* Row 3: barcode + size + color */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-muted mb-1 block">{t.products.barcode}</label>
                    <input
                      value={newProduct.barcode}
                      onChange={e => setNewProduct(p => ({ ...p, barcode: e.target.value }))}
                      placeholder={t.common.optional}
                      className="input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted mb-1 block">{t.products.size}</label>
                    <input
                      value={newProduct.size}
                      onChange={e => setNewProduct(p => ({ ...p, size: e.target.value }))}
                      placeholder="XL, 42…"
                      className="input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted mb-1 block">{t.products.color}</label>
                    <input
                      value={newProduct.color}
                      onChange={e => setNewProduct(p => ({ ...p, color: e.target.value }))}
                      placeholder="Black…"
                      className="input w-full text-sm"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCreateProduct}
                  disabled={createProductMut.isPending}
                  className="w-full btn-primary py-2 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  <PackagePlus size={14} />
                  {createProductMut.isPending ? t.orders.creating : t.orders.createAndAdd}
                </button>
              </div>
            )}

            {/* Search existing products */}
            {!showNewProduct && (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  ref={searchRef}
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setShowProductDrop(true) }}
                  onFocus={() => setShowProductDrop(true)}
                  onBlur={() => setTimeout(() => setShowProductDrop(false), 200)}
                  placeholder={t.orders.searchProductsPh}
                  className="input pl-8 w-full text-sm"
                />
                {showProductDrop && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-surface border border-border rounded-xl shadow-xl max-h-64 overflow-y-auto">
                    {products.map((p: any) => (
                      <div key={p.id}>
                        {p.variants?.length === 1 ? (
                          <button onMouseDown={() => addVariant(p, p.variants[0])}
                            className="w-full text-left px-3 py-2.5 hover:bg-surface2 transition-colors flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-fg">{p.name}</div>
                              <div className="text-xs text-muted">{p.variants[0].sku}</div>
                            </div>
                            <span className="font-mono text-sm text-gold">{fmt.compact(Number(p.variants[0].priceOverride ?? p.sellPrice))}</span>
                          </button>
                        ) : (
                          p.variants?.map((v: any) => (
                            <button key={v.id} onMouseDown={() => addVariant(p, v)}
                              className="w-full text-left px-3 py-2 hover:bg-surface2 transition-colors flex items-center justify-between pl-5">
                              <div>
                                <div className="text-sm font-medium text-fg">{p.name} <span className="text-muted text-xs">· {[v.size, v.color].filter(Boolean).join('/')}</span></div>
                                <div className="text-xs text-muted">{v.sku}</div>
                              </div>
                              <span className="font-mono text-sm text-gold">{fmt.compact(Number(v.priceOverride ?? p.sellPrice))}</span>
                            </button>
                          ))
                        )}
                      </div>
                    ))}

                    {/* No results → prompt to create */}
                    {noResults && (
                      <div className="px-4 py-3 border-t border-border">
                        <p className="text-xs text-muted mb-2">
                          {t.orders.noProductFound} <strong className="text-fg">"{productSearch}"</strong>
                        </p>
                        <button
                          onMouseDown={() => {
                            setNewProduct(p => ({ ...p, name: productSearch }))
                            setShowProductDrop(false)
                            setProductSearch('')
                            setShowNewProduct(true)
                          }}
                          className="flex items-center gap-2 text-xs font-medium text-gold hover:underline">
                          <PackagePlus size={12} /> {t.orders.createAsNew} "{productSearch}"
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Line items */}
          {lines.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface2 border-b border-border">
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted">{t.orders.colProduct}</th>
                    <th className="text-center px-2 py-2 text-xs font-medium text-muted w-20">{t.orders.colQty}</th>
                    <th className="text-right px-2 py-2 text-xs font-medium text-muted w-28">{t.orders.colPrice}</th>
                    <th className="text-center px-2 py-2 text-xs font-medium text-muted w-20">{t.orders.colDisc}</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted w-24">{t.common.total}</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const lineTotal = Math.max(0, l.unitPrice * l.quantity * (1 - l.discountPct / 100))
                    return (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <div className="font-medium text-fg text-xs flex items-center gap-1.5">
                            {l.productName}
                            {l.isNew && (
                              <span className="text-[9px] font-bold bg-gold/15 text-gold px-1.5 py-0.5 rounded-full border border-gold/20">NEW</span>
                            )}
                          </div>
                          <div className="text-muted text-[10px]">{l.variantLabel}</div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="number" min={1} value={l.quantity}
                            onChange={e => updateLine(i, 'quantity', Math.max(1, Number(e.target.value)))}
                            className="input w-16 text-center text-xs py-1 px-1"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number" min={0} value={l.unitPrice}
                            onChange={e => updateLine(i, 'unitPrice', Number(e.target.value))}
                            className="input w-24 text-right text-xs py-1 px-2"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="number" min={0} max={100} value={l.discountPct}
                            onChange={e => updateLine(i, 'discountPct', Math.min(100, Number(e.target.value)))}
                            className="input w-16 text-center text-xs py-1 px-1"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-fg">
                          {fmt.compact(lineTotal)}
                        </td>
                        <td className="px-2 py-2">
                          <button onClick={() => removeLine(i)} className="text-muted hover:text-rose transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {lines.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted border-2 border-dashed border-border rounded-xl">
              <Package size={28} className="opacity-30 mb-2" />
              <p className="text-sm">{t.orders.addProductsHint}</p>
            </div>
          )}

          {/* Payment */}
          {lines.length > 0 && (
            <div className="bg-surface2 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard size={12} /> {t.orders.payment}
              </h3>

              {/* Totals summary */}
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

              {/* Payment method */}
              <div className="flex gap-2 flex-wrap">
                {PAYMENT_METHODS.map(m => (
                  <button key={m} onClick={() => setPayMethod(m)}
                    className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      payMethod === m
                        ? 'bg-gold text-bg border-gold'
                        : 'bg-surface border-border text-muted hover:border-gold/40')}>
                    {m === 'CASH' ? <Banknote size={12} /> : <CreditCard size={12} />}
                    {m}
                  </button>
                ))}
              </div>

              {/* Amount received */}
              <div>
                <label className="text-xs text-muted mb-1 block">{t.orders.amountReceived}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="input w-full font-mono text-right pr-14"
                    placeholder={String(Math.round(total))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">UZS</span>
                </div>
                {Number(payAmount) > total && total > 0 && (
                  <p className="text-xs text-jade mt-1">
                    {t.common.change}: {fmt.compact(Number(payAmount) - total)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted mb-1.5 block">{t.common.notes} {t.orders.optionalLabel}</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder={t.orders.notesPlaceholder}
              className="input w-full resize-none text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-5 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">{t.common.cancel}</button>
          <button
            onClick={handleSubmit}
            disabled={lines.length === 0 || createMut.isPending}
            className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus size={15} />
            {createMut.isPending ? t.orders.creating : `${t.orders.createOrder} · ${fmt.compact(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Order Modal ──────────────────────────────────────────────────────────
function EditOrderModal({ order, onClose, onSaved }: {
  order:   any
  onClose: () => void
  onSaved: () => void
}) {
  const t  = useT()
  const qc = useQueryClient()

  // Pre-populate lines from existing order items
  const [lines, setLines] = useState<OrderLineItem[]>(() =>
    (order.items ?? []).map((item: any) => ({
      variantId:    item.variantId,
      productName:  item.variant?.product?.name ?? 'Unknown',
      variantLabel: [item.variant?.size, item.variant?.color].filter(Boolean).join(' / ') || 'Default',
      unitPrice:    Number(item.unitPrice),
      quantity:     item.quantity,
      discountPct:  Number(item.discountPct ?? 0),
    }))
  )

  const [customer,       setCustomer]       = useState<any>(order.customer ?? null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDrop, setShowCustomerDrop] = useState(false)
  const [productSearch,  setProductSearch]  = useState('')
  const [showProductDrop, setShowProductDrop] = useState(false)
  const [showNewProduct,  setShowNewProduct] = useState(false)
  const [newProduct,      setNewProduct]     = useState(EMPTY_NEW_PRODUCT)
  const [payMethod, setPayMethod] = useState<string>(order.payments?.[0]?.method ?? 'CASH')
  const [payAmount, setPayAmount] = useState<string>('')
  const [notes,     setNotes]     = useState(order.notes ?? '')
  const newNameRef = useRef<HTMLInputElement>(null)

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  const discount = lines.reduce((s, l) => s + (l.unitPrice * l.quantity * l.discountPct / 100), 0)
  const total    = Math.max(0, subtotal - discount)

  useEffect(() => { setPayAmount(total > 0 ? String(Math.round(total)) : '') }, [total])
  useEffect(() => { if (showNewProduct) setTimeout(() => newNameRef.current?.focus(), 50) }, [showNewProduct])

  // Product search
  const { data: productData, isFetching: productFetching } = useQuery({
    queryKey: ['products-search-edit', productSearch],
    queryFn:  () => productsApi.list({ search: productSearch || undefined, limit: 20 }),
    enabled:  showProductDrop,
  })
  const products: any[] = productData?.data ?? []
  const noResults = showProductDrop && !productFetching && productSearch.trim().length > 0 && products.length === 0

  // Customer search
  const { data: customerData } = useQuery({
    queryKey: ['customers-search-edit', customerSearch],
    queryFn:  () => customersApi.list({ search: customerSearch || undefined, limit: 10 }),
    enabled:  showCustomerDrop,
  })
  const customers: any[] = customerData?.data ?? []

  const addVariant = (product: any, variant: any) => {
    const price = Number(variant.priceOverride ?? product.sellPrice ?? 0)
    const label = [variant.size, variant.color].filter(Boolean).join(' / ') || 'Default'
    const existing = lines.findIndex(l => l.variantId === variant.id)
    if (existing >= 0) {
      setLines(prev => prev.map((l, i) => i === existing ? { ...l, quantity: l.quantity + 1 } : l))
    } else {
      setLines(prev => [...prev, { variantId: variant.id, productName: product.name, variantLabel: label, unitPrice: price, quantity: 1, discountPct: 0 }])
    }
    setProductSearch(''); setShowProductDrop(false)
  }

  const updateLine = (idx: number, field: keyof OrderLineItem, value: any) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx))

  // Inline new product creation
  const createProductMut = useMutation({
    mutationFn: (data: any) => productsApi.create(data),
    onSuccess: (created: any) => {
      qc.invalidateQueries({ queryKey: ['products'] })
      const variant = created.variants?.[0]
      if (!variant) return
      setLines(prev => [...prev, {
        variantId: variant.id, productName: created.name,
        variantLabel: [variant.size, variant.color].filter(Boolean).join(' / ') || '—',
        unitPrice: Number(created.sellPrice ?? 0), quantity: 1, discountPct: 0, isNew: true,
      }])
      setNewProduct(EMPTY_NEW_PRODUCT); setShowNewProduct(false)
      toast.success(`"${created.name}" ${t.notifications.created}`)
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? t.orders.failedCreateProduct),
  })

  const handleCreateProduct = () => {
    if (!newProduct.name.trim()) { toast.error(t.orders.productRequired); return }
    if (!newProduct.sellPrice || Number(newProduct.sellPrice) <= 0) { toast.error(t.orders.priceRequired); return }
    const sku = newProduct.sku.trim() || `${newProduct.name.slice(0,6).toUpperCase().replace(/\s/g,'')}-${Date.now()}`
    createProductMut.mutate({
      name: newProduct.name.trim(), sellPrice: Number(newProduct.sellPrice),
      costPrice: Number(newProduct.costPrice || 0), skuBase: sku, isActive: true,
      variants: [{ sku, barcode: newProduct.barcode.trim()||null, size: newProduct.size.trim()||null, color: newProduct.color.trim()||null, isActive: true }],
    })
  }

  const saveMut = useMutation({
    mutationFn: (payload: any) => ordersApi.update(order.id, payload),
    onSuccess: () => { toast.success(t.orders.updatedSuccess); onSaved(); onClose() },
    onError:   (e: any) => toast.error(e.response?.data?.message ?? t.orders.failedUpdate),
  })

  const handleSave = () => {
    if (lines.length === 0) { toast.error(t.orders.addOneProduct); return }
    saveMut.mutate({
      customerId: customer?.id ?? null,
      notes: notes || null,
      items: lines.map(l => ({
        variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice,
        unitCost: 0, discountPct: l.discountPct, discountFixed: 0,
      })),
      payments: [{ method: payMethod, amount: Number(payAmount) || total, reference: null }],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Pencil size={15} className="text-gold" />
              <h2 className="text-base font-bold text-fg">{t.orders.editOrder}</h2>
              <span className="font-mono text-xs text-muted bg-surface2 px-2 py-0.5 rounded-lg border border-border">{order.orderNumber}</span>
            </div>
            <p className="text-xs text-muted mt-0.5">{t.orders.editOrderSub}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Customer */}
          <div className="relative">
            <label className="text-xs font-medium text-muted mb-1.5 flex items-center gap-1">
              <User size={11} /> {t.orders.customer} <span className="text-muted/50 ml-1">{t.orders.optionalLabel}</span>
            </label>
            {customer ? (
              <div className="flex items-center justify-between bg-surface2 border border-border rounded-xl px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-fg">{customer.name}</span>
                  {customer.phone && <span className="text-xs text-muted ml-2">{customer.phone}</span>}
                </div>
                <button onClick={() => setCustomer(null)} className="text-muted hover:text-rose transition-colors"><X size={13} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true) }}
                  onFocus={() => setShowCustomerDrop(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDrop(false), 150)}
                  placeholder={t.orders.searchCustomerPh} className="input pl-8 w-full text-sm" />
                {showCustomerDrop && customers.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-surface border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {customers.map((c: any) => (
                      <button key={c.id} onMouseDown={() => { setCustomer(c); setCustomerSearch(''); setShowCustomerDrop(false) }}
                        className="w-full text-left px-3 py-2.5 hover:bg-surface2 transition-colors flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-fg">{c.name}</div>
                          <div className="text-xs text-muted">{c.phone}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Products */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-muted flex items-center gap-1"><ShoppingCart size={11} /> {t.orders.items}</label>
              <button onClick={() => { setShowNewProduct(v => !v); setShowProductDrop(false) }}
                className={clsx('flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors',
                  showNewProduct ? 'bg-gold/10 border-gold/30 text-gold' : 'border-border text-muted hover:border-gold/40 hover:text-gold')}>
                <PackagePlus size={12} />{showNewProduct ? t.orders.cancelBtn : t.orders.newProductBtn}
              </button>
            </div>

            {showNewProduct && (
              <div className="mb-3 bg-gold/5 border border-gold/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={13} className="text-gold" />
                  <span className="text-xs font-semibold text-gold">{t.orders.quickAddProductShort}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted mb-1 block">{t.orders.productNameLabel} *</label>
                    <input ref={newNameRef} value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} placeholder="Nike Air Max…" className="input w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted mb-1 block">{t.orders.sellingPrice} *</label>
                    <input type="number" min={0} value={newProduct.sellPrice} onChange={e => setNewProduct(p => ({ ...p, sellPrice: e.target.value }))} placeholder="0" className="input w-full text-sm font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-muted mb-1 block">{t.products.barcode}</label>
                    <input value={newProduct.barcode} onChange={e => setNewProduct(p => ({ ...p, barcode: e.target.value }))} placeholder={t.common.optional} className="input w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted mb-1 block">{t.products.size}</label>
                    <input value={newProduct.size} onChange={e => setNewProduct(p => ({ ...p, size: e.target.value }))} placeholder="XL…" className="input w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted mb-1 block">{t.products.color}</label>
                    <input value={newProduct.color} onChange={e => setNewProduct(p => ({ ...p, color: e.target.value }))} placeholder="Black…" className="input w-full text-sm" />
                  </div>
                </div>
                <button onClick={handleCreateProduct} disabled={createProductMut.isPending}
                  className="w-full btn-primary py-2 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  <PackagePlus size={14} />{createProductMut.isPending ? t.orders.creating : t.orders.createAndAdd}
                </button>
              </div>
            )}

            {!showNewProduct && (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setShowProductDrop(true) }}
                  onFocus={() => setShowProductDrop(true)}
                  onBlur={() => setTimeout(() => setShowProductDrop(false), 200)}
                  placeholder={t.orders.searchProductsPh} className="input pl-8 w-full text-sm" />
                {showProductDrop && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-surface border border-border rounded-xl shadow-xl max-h-56 overflow-y-auto">
                    {products.map((p: any) => (
                      <div key={p.id}>
                        {p.variants?.length === 1 ? (
                          <button onMouseDown={() => addVariant(p, p.variants[0])}
                            className="w-full text-left px-3 py-2.5 hover:bg-surface2 transition-colors flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-fg">{p.name}</div>
                              <div className="text-xs text-muted">{p.variants[0].sku}</div>
                            </div>
                            <span className="font-mono text-sm text-gold">{fmt.compact(Number(p.variants[0].priceOverride ?? p.sellPrice))}</span>
                          </button>
                        ) : p.variants?.map((v: any) => (
                          <button key={v.id} onMouseDown={() => addVariant(p, v)}
                            className="w-full text-left px-3 py-2 hover:bg-surface2 transition-colors flex items-center justify-between pl-5">
                            <div>
                              <div className="text-sm font-medium text-fg">{p.name} <span className="text-muted text-xs">· {[v.size, v.color].filter(Boolean).join('/')}</span></div>
                              <div className="text-xs text-muted">{v.sku}</div>
                            </div>
                            <span className="font-mono text-sm text-gold">{fmt.compact(Number(v.priceOverride ?? p.sellPrice))}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                    {noResults && (
                      <div className="px-4 py-3 border-t border-border">
                        <p className="text-xs text-muted mb-2">{t.orders.noProductFound} <strong className="text-fg">"{productSearch}"</strong></p>
                        <button onMouseDown={() => { setNewProduct(p => ({ ...p, name: productSearch })); setShowProductDrop(false); setProductSearch(''); setShowNewProduct(true) }}
                          className="flex items-center gap-2 text-xs font-medium text-gold hover:underline">
                          <PackagePlus size={12} /> {t.orders.createAsNew} "{productSearch}"
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Line items */}
          {lines.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface2 border-b border-border">
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted">{t.orders.colProduct}</th>
                    <th className="text-center px-2 py-2 text-xs font-medium text-muted w-20">{t.orders.colQty}</th>
                    <th className="text-right px-2 py-2 text-xs font-medium text-muted w-28">{t.orders.colPrice}</th>
                    <th className="text-center px-2 py-2 text-xs font-medium text-muted w-20">{t.orders.colDisc}</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted w-24">{t.common.total}</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const lineTotal = Math.max(0, l.unitPrice * l.quantity * (1 - l.discountPct / 100))
                    return (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <div className="font-medium text-fg text-xs flex items-center gap-1.5">
                            {l.productName}
                            {l.isNew && <span className="text-[9px] font-bold bg-gold/15 text-gold px-1.5 py-0.5 rounded-full border border-gold/20">NEW</span>}
                          </div>
                          <div className="text-muted text-[10px]">{l.variantLabel}</div>
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min={1} value={l.quantity}
                            onChange={e => updateLine(i, 'quantity', Math.max(1, Number(e.target.value)))}
                            className="input w-16 text-center text-xs py-1 px-1" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min={0} value={l.unitPrice}
                            onChange={e => updateLine(i, 'unitPrice', Number(e.target.value))}
                            className="input w-24 text-right text-xs py-1 px-2" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min={0} max={100} value={l.discountPct}
                            onChange={e => updateLine(i, 'discountPct', Math.min(100, Number(e.target.value)))}
                            className="input w-16 text-center text-xs py-1 px-1" />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-fg">{fmt.compact(lineTotal)}</td>
                        <td className="px-2 py-2">
                          <button onClick={() => removeLine(i)} className="text-muted hover:text-rose transition-colors"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {lines.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-muted border-2 border-dashed border-border rounded-xl">
              <Package size={24} className="opacity-30 mb-2" />
              <p className="text-sm">{t.orders.addProductsHintEdit}</p>
            </div>
          )}

          {/* Payment */}
          {lines.length > 0 && (
            <div className="bg-surface2 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5"><CreditCard size={12} /> {t.orders.payment}</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted">
                  <span>{t.common.subtotal}</span><span className="font-mono">{fmt.compact(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-rose">
                    <span>{t.common.discount}</span><span className="font-mono">-{fmt.compact(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-border pt-2">
                  <span className="text-fg">{t.common.total}</span>
                  <span className="font-mono text-gold">{fmt.compact(total)}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {PAYMENT_METHODS.map(m => (
                  <button key={m} onClick={() => setPayMethod(m)}
                    className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      payMethod === m ? 'bg-gold text-bg border-gold' : 'bg-surface border-border text-muted hover:border-gold/40')}>
                    {m === 'CASH' ? <Banknote size={12} /> : <CreditCard size={12} />}{m}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">{t.orders.amountReceived}</label>
                <div className="relative">
                  <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                    className="input w-full font-mono text-right pr-14" placeholder={String(Math.round(total))} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">UZS</span>
                </div>
                {Number(payAmount) > total && total > 0 && (
                  <p className="text-xs text-jade mt-1">{t.common.change}: {fmt.compact(Number(payAmount) - total)}</p>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted mb-1.5 block">{t.common.notes}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder={t.orders.notesPlaceholder} className="input w-full resize-none text-sm" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-5 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">{t.common.cancel}</button>
          <button onClick={handleSave} disabled={lines.length === 0 || saveMut.isPending}
            className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <CheckCircle2 size={15} />
            {saveMut.isPending ? t.orders.saving : `${t.orders.saveChanges ?? t.common.save} · ${fmt.compact(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Order detail modal ────────────────────────────────────────────────────────
function OrderDetailModal({ order, onClose }: { order: any; onClose: () => void }) {
  const t = useT()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-fg font-mono">{order.orderNumber}</h2>
            <p className="text-xs text-muted">{fmt.dateTime(order.createdAt)}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-surface2 rounded-xl p-3">
              <div className="text-xs text-muted mb-1">{t.orders.customer}</div>
              <div className="font-medium text-fg">{order.customer?.name ?? '—'}</div>
              {order.customer?.phone && <div className="text-xs text-muted">{order.customer.phone}</div>}
            </div>
            <div className="bg-surface2 rounded-xl p-3">
              <div className="text-xs text-muted mb-1">{t.orders.status}</div>
              <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full border', STATUS_BADGE[order.status])}>
                {order.status === 'COMPLETED' ? t.orders.completed
                  : order.status === 'PENDING' ? t.orders.pending
                  : order.status === 'VOID'    ? t.orders.cancelled
                  : order.status === 'REFUNDED'? t.orders.refunded
                  : order.status}
              </span>
            </div>
            <div className="bg-surface2 rounded-xl p-3">
              <div className="text-xs text-muted mb-1">{t.orders.cashier}</div>
              <div className="font-medium text-fg">{order.cashier?.name ?? '—'}</div>
            </div>
            <div className="bg-surface2 rounded-xl p-3">
              <div className="text-xs text-muted mb-1">{t.orders.branch}</div>
              <div className="font-medium text-fg">{order.branch?.name ?? '—'}</div>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t.orders.items}</h3>
            <div className="space-y-2">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <div>
                    <div className="text-sm font-medium text-fg">{item.variant?.product?.name ?? '—'}</div>
                    <div className="text-xs text-muted">
                      {[item.variant?.size, item.variant?.color].filter(Boolean).join(' / ')}
                      {' · '}{item.quantity}× {fmt.compact(Number(item.unitPrice))}
                    </div>
                  </div>
                  <div className="font-mono text-sm font-semibold">{fmt.compact(Number(item.total ?? item.lineTotal ?? 0))}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-surface2 rounded-xl p-3 space-y-1.5 text-sm">
            {Number(order.discountTotal) > 0 && (
              <div className="flex justify-between text-rose">
                <span>{t.common.discount}</span>
                <span className="font-mono">-{fmt.compact(Number(order.discountTotal))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-border pt-2">
              <span className="text-fg">{t.common.total}</span>
              <span className="font-mono text-gold">{fmt.compact(Number(order.total))}</span>
            </div>
          </div>

          {/* Payments */}
          {order.payments?.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">{t.orders.payment}</h3>
              {order.payments.map((p: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted capitalize">{p.method?.toLowerCase()}</span>
                  <span className="font-mono">{fmt.compact(Number(p.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const branchId = useAuthStore(s => s.user?.branchId)
  const t        = useT()
  const navigate = useNavigate()
  const qc       = useQueryClient()

  const [tab,         setTab]       = useState<'active' | 'history'>('active')
  const [page,        setPage]      = useState(1)
  const [dateFrom,    setFrom]      = useState('')
  const [dateTo,      setTo]        = useState('')
  const [detail,      setDetail]    = useState<any>(null)
  const [showCreate,  setShowCreate] = useState(false)
  const [editOrder,   setEditOrder]  = useState<any>(null)

  // Orders section is fully independent of POS.
  // Only source='ORDER' records are shown here.
  // Active = PENDING orders; History = COMPLETED + VOID + REFUNDED
  const { data, isLoading } = useQuery({
    queryKey: ['orders', branchId, tab, page, dateFrom, dateTo],
    queryFn:  () => ordersApi.list({
      branchId,
      source:   'ORDER',
      page,
      limit: 20,
      dateFrom: dateFrom || undefined,
      dateTo:   dateTo   || undefined,
      statusIn: tab === 'active' ? 'PENDING' : 'COMPLETED,VOID,REFUNDED',
    }),
  })

  // Count badge for active (PENDING) tab — Orders section only
  const { data: activeCount } = useQuery({
    queryKey: ['orders-count-active', branchId],
    queryFn:  () => ordersApi.list({ branchId, source: 'ORDER', limit: 1, page: 1, statusIn: 'PENDING' }),
    refetchInterval: 15_000,
  })

  const finalize = useMutation({
    mutationFn: (id: string) => ordersApi.finalize(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success(t.orders.orderFinalized) },
    onError:    (e: any) => toast.error(e.response?.data?.message ?? t.orders.failedFinalize),
  })

  const cancel = useMutation({
    mutationFn: (id: string) => ordersApi.cancel(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success(t.orders.orderCancelled) },
    onError:    (e: any) => toast.error(e.response?.data?.message ?? t.orders.failedCancel),
  })

  const refund = useMutation({
    mutationFn: (id: string) => ordersApi.refund(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success(t.orders.orderRefunded) },
    onError:    (e: any) => toast.error(e.response?.data?.message ?? t.orders.failedRefund),
  })

  const orders      = (data as any)?.data ?? []
  const meta        = (data as any)?.meta ?? {}
  const activeTotal = (activeCount as any)?.meta?.total ?? 0

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-fg">{t.orders.title}</h1>
          <p className="text-sm text-muted mt-0.5">{meta.total ?? 0} {t.orders.ordersCount}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/analytics')}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl text-sm text-muted hover:text-gold hover:border-gold/40 transition-colors">
            <BarChart2 size={14} /> {t.orders.analytics}
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> {t.orders.newOrder}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface2 rounded-xl p-1 w-fit border border-border">
        <button onClick={() => { setTab('active'); setPage(1) }}
          className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
            tab === 'active' ? 'bg-surface text-fg shadow' : 'text-muted hover:text-fg')}>
          <Clock size={13} />
          {t.orders.activeOrders}
          {activeTotal > 0 && (
            <span className="bg-gold text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {activeTotal}
            </span>
          )}
        </button>
        <button onClick={() => { setTab('history'); setPage(1) }}
          className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
            tab === 'history' ? 'bg-surface text-fg shadow' : 'text-muted hover:text-fg')}>
          <TrendingUp size={13} />
          {t.orders.history}
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-center gap-2 bg-gold/5 border border-gold/20 rounded-xl px-4 py-2.5 text-xs text-muted">
        <CheckCircle2 size={13} className="text-gold flex-shrink-0" />
        <span>{tab === 'active' ? t.orders.pendingBanner : t.orders.historyBanner}</span>
      </div>

      {/* Date filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs text-muted">{t.common.from}</span>
        <input type="date" value={dateFrom} onChange={e => { setFrom(e.target.value); setPage(1) }} className="input w-40 text-sm" />
        <span className="text-xs text-muted">{t.common.to}</span>
        <input type="date" value={dateTo}   onChange={e => { setTo(e.target.value);   setPage(1) }} className="input w-40 text-sm" />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setFrom(''); setTo('') }} className="text-xs text-muted hover:text-rose transition-colors flex items-center gap-1">
            <X size={11} /> {t.common.reset}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface2">
                {[t.orders.orderNumber, t.common.date, t.common.cashier, t.orders.customer, t.orders.items, t.common.total, t.orders.payment, t.orders.status, t.common.actions].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs font-medium text-muted whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-8 text-muted">{t.common.loading}</td></tr>
              ) : orders.map((o: any) => (
                <tr key={o.id} className="border-b border-border hover:bg-surface2/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gold font-semibold">{o.orderNumber}</td>
                  <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{fmt.dateTime(o.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-fg">{o.cashier?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted text-sm">{o.customer?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-fg font-mono">{o._count?.items ?? '—'}</td>
                  <td className="px-4 py-3 font-mono font-bold text-fg">{fmt.compact(Number(o.total))}</td>
                  <td className="px-4 py-3 text-xs text-muted uppercase">{o.payments?.[0]?.method ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full border', STATUS_BADGE[o.status] ?? 'text-muted border-border')}>
                      {o.status === 'COMPLETED' ? t.orders.completed
                        : o.status === 'PENDING'   ? t.orders.pending
                        : o.status === 'VOID'      ? t.orders.cancelled
                        : o.status === 'REFUNDED'  ? t.orders.refunded
                        : o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">

                      {/* View detail */}
                      <button onClick={() => setDetail(o)}
                        className="p-1.5 rounded hover:bg-surface2 text-muted hover:text-gold transition-colors" title="View detail">
                        <Eye size={13} />
                      </button>

                      {/* Edit — PENDING orders only */}
                      {o.status === 'PENDING' && (
                        <button
                          onClick={async () => {
                            // Fetch full order (with items + variants) then open edit modal
                            try {
                              const full = await ordersApi.getOne(o.id)
                              setEditOrder(full)
                            } catch { toast.error(t.orders.failedLoad) }
                          }}
                          className="p-1.5 rounded hover:bg-surface2 text-muted hover:text-gold transition-colors" title="Edit order">
                          <Pencil size={13} />
                        </button>
                      )}

                      {/* Finalize — PENDING orders in active tab */}
                      {tab === 'active' && o.status === 'PENDING' && (
                        <button
                          onClick={() => {
                            if (confirm(`${o.orderNumber}: ${t.orders.finalizeConfirm}`))
                              finalize.mutate(o.id)
                          }}
                          disabled={finalize.isPending}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-jade/10 text-jade hover:bg-jade/20 text-xs font-medium transition-colors whitespace-nowrap"
                          title={t.orders.finalize}>
                          <CheckCircle2 size={11} /> {t.orders.finalize}
                        </button>
                      )}

                      {/* Cancel — PENDING orders only */}
                      {o.status === 'PENDING' && (
                        <button
                          onClick={() => {
                            if (confirm(`${o.orderNumber}: ${t.orders.cancelConfirm}`))
                              cancel.mutate(o.id)
                          }}
                          disabled={cancel.isPending}
                          className="p-1.5 rounded hover:bg-surface2 text-muted hover:text-rose transition-colors"
                          title="Cancel order">
                          <XCircle size={13} />
                        </button>
                      )}

                      {/* Refund — COMPLETED orders in history */}
                      {tab === 'history' && o.status === 'COMPLETED' && (
                        <button
                          onClick={() => { if (confirm(`${o.orderNumber}: ${t.orders.refundConfirm}`)) refund.mutate(o.id) }}
                          disabled={refund.isPending}
                          className="p-1.5 rounded hover:bg-surface2 text-muted hover:text-amber-400 transition-colors"
                          title="Refund">
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!isLoading && !orders.length && (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-muted">
                    <Package size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">
                      {tab === 'active' ? t.orders.noActiveOrders : t.orders.noOrderHistory}
                    </p>
                    {tab === 'active' && (
                      <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2 text-xs px-4 py-2 mt-3">
                        <Plus size={13} /> {t.orders.newOrder}
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {meta.lastPage > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.min(meta.lastPage, 10) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={clsx('w-8 h-8 rounded-lg text-sm transition-colors',
                p === page ? 'bg-gold text-bg font-bold' : 'bg-surface2 text-muted hover:bg-border')}>
              {p}
            </button>
          ))}
        </div>
      )}

      {detail && <OrderDetailModal order={detail} onClose={() => setDetail(null)} />}

      {showCreate && branchId && (
        <CreateOrderModal
          branchId={branchId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { qc.invalidateQueries({ queryKey: ['orders'] }); setTab('active') }}
        />
      )}

      {editOrder && (
        <EditOrderModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['orders'] }); setEditOrder(null) }}
        />
      )}
    </div>
  )
}
