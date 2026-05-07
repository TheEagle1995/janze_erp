import { create } from 'zustand'

export interface CartItem {
  variantId:       string
  productId:       string
  name:            string
  sku:             string
  size?:           string
  color?:          string
  unitPrice:       number
  originalPrice:   number   // always stores the catalogue price
  unitCost:        number
  quantity:        number
  discountPct:     number
  discountFixed:   number
  lineTotal:       number
  isFlexiblePrice: boolean  // seller enters price at sale time
}

interface CartState {
  items:      CartItem[]
  customerId: string | null
  customerName: string | null
  addItem:       (item: Omit<CartItem, 'lineTotal' | 'originalPrice'>) => void
  removeItem:    (variantId: string) => void
  updateQty:     (variantId: string, qty: number) => void
  setUnitPrice:  (variantId: string, price: number) => void
  setDiscount:   (variantId: string, pct: number, fixed: number) => void
  setCustomer:   (id: string | null, name: string | null) => void
  clearCart:     () => void
  getSubtotal:   () => number
  getTotal:      (taxRate?: number) => number
  getDiscountTotal: () => number
  getTaxTotal:   (taxRate?: number) => number
}

const calcLine = (item: Omit<CartItem, 'lineTotal'>): number => {
  const base   = item.unitPrice * item.quantity
  const discPct = base * (item.discountPct / 100)
  return Math.max(0, base - discPct - item.discountFixed)
}

export const useCartStore = create<CartState>((set, get) => ({
  items:        [],
  customerId:   null,
  customerName: null,

  addItem: (item) => set((state) => {
    const existing = state.items.find(i => i.variantId === item.variantId)
    if (existing) {
      return { items: state.items.map(i => i.variantId === item.variantId
        ? { ...i, quantity: i.quantity + item.quantity, lineTotal: calcLine({ ...i, quantity: i.quantity + item.quantity }) }
        : i) }
    }
    const full = { ...item, originalPrice: item.unitPrice }
    return { items: [...state.items, { ...full, lineTotal: calcLine(full) }] }
  }),

  removeItem: (variantId) => set(s => ({ items: s.items.filter(i => i.variantId !== variantId) })),

  updateQty: (variantId, qty) => set(s => ({
    items: qty <= 0
      ? s.items.filter(i => i.variantId !== variantId)
      : s.items.map(i => i.variantId === variantId ? { ...i, quantity: qty, lineTotal: calcLine({ ...i, quantity: qty }) } : i),
  })),

  setUnitPrice: (variantId, price) => set(s => ({
    items: s.items.map(i => i.variantId === variantId
      ? { ...i, unitPrice: price, lineTotal: calcLine({ ...i, unitPrice: price }) }
      : i),
  })),

  setDiscount: (variantId, pct, fixed) => set(s => ({
    items: s.items.map(i => i.variantId === variantId
      ? { ...i, discountPct: pct, discountFixed: fixed, lineTotal: calcLine({ ...i, discountPct: pct, discountFixed: fixed }) }
      : i),
  })),

  setCustomer: (id, name) => set({ customerId: id, customerName: name }),

  clearCart: () => set({ items: [], customerId: null, customerName: null }),

  getSubtotal:      () => get().items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
  getDiscountTotal: () => get().items.reduce((s, i) => s + (i.unitPrice * i.quantity - i.lineTotal), 0),
  getTaxTotal:      (taxRate = 0) => {
    const net = get().items.reduce((s, i) => s + i.lineTotal, 0)
    return net * taxRate / 100
  },
  getTotal: (taxRate = 0) => {
    const net = get().items.reduce((s, i) => s + i.lineTotal, 0)
    return net + net * taxRate / 100
  },
}))
