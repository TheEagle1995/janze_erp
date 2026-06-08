export type Brand    = 'AVERO' | 'JANZE'
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CASHIER'
export type OrderStatus = 'PENDING' | 'COMPLETED' | 'REFUNDED' | 'VOID'
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'LOYALTY'

export interface User {
  id: string; name: string; email: string; role: UserRole
  branchId: string; branch?: Branch; isActive: boolean
}

export interface Branch {
  id: string; name: string; brand: Brand
  address?: string; phone?: string; currency: string; taxRate: number
}

export interface Product {
  id: string; name: string; brand: Brand; skuBase: string
  costPrice: number; sellPrice: number; imageUrls: string[]; tags: string[]
  isActive: boolean; category?: { id: string; name: string }
  variants: ProductVariant[]
}

export interface ProductVariant {
  id: string; productId: string; sku: string; barcode?: string
  size?: string; color?: string; colorHex?: string; priceOverride?: number
  isActive: boolean; inventory: InventoryItem[]
}

export interface InventoryItem {
  id: string; variantId: string; branchId: string
  quantity: number; reservedQty: number; lowStockThreshold: number
}

export interface Customer {
  id: string; name: string; phone: string; email?: string
  loyaltyPoints: number; discountPct: number; totalSpent: number; totalOrders: number
}

export interface Order {
  id: string; orderNumber: string; branchId: string; cashierId: string
  customerId?: string; subtotal: number; discountTotal: number
  taxTotal: number; total: number; status: OrderStatus
  items: OrderItem[]; payments: Payment[]; createdAt: string
  cashier?: { name: string }; customer?: Customer
}

export interface OrderItem {
  id: string; variantId: string; quantity: number
  unitPrice: number; unitCost: number; lineTotal: number
  variant: ProductVariant & { product: Product }
}

export interface Payment {
  id: string; method: PaymentMethod; amount: number
}

export interface DashboardKPIs {
  revenue:  { value: number; change: number }
  orders:   { value: number; change: number }
  avgOrder: { value: number; change: number }
  newCustomers: number
}

export interface Expense {
  id: string; expenseNumber: string; branchId: string
  accountId: string; description: string; amountTiyin: bigint
  amount: number; status: string; category: string
  expenseDate: string; createdAt: string
  account?: { code: string; name: string }
}

export interface ApiResponse<T> {
  data: T
  meta?: { total: number; page: number; limit: number; lastPage: number }
}
