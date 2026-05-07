import axios from 'axios'
import { config } from '../config'

const api = axios.create({
  baseURL: config.api.baseUrl,
  timeout: 10000,
  headers: { 'X-Internal-Key': config.api.internalKey, 'X-Source': 'telegram-bot' },
})

export const analyticsService = {
  async getDailyReport(branchId?: string) {
    const [kpi, top] = await Promise.all([
      api.get('/analytics/dashboard', { params: { period: 'today', branchId } }),
      api.get('/analytics/top-products', { params: { dateFrom: new Date().toISOString().slice(0,10), dateTo: new Date().toISOString().slice(0,10), limit: 1, branchId } }),
    ])
    return { kpi: kpi.data, topProduct: top.data?.[0] ?? null }
  },
  async getLowStockAlerts(branchId?: string) {
    const r = await api.get('/inventory/low-stock', { params: { branchId } })
    return (Array.isArray(r.data) ? r.data : r.data?.items ?? []).map((item: any) => ({
      productName: item.variant?.product?.name ?? 'Unknown',
      sku:         item.variant?.sku ?? '',
      size:        item.variant?.size,
      color:       item.variant?.color,
      branchName:  item.branch?.name ?? 'Branch',
      quantity:    item.quantity ?? 0,
      threshold:   item.lowStockThreshold ?? 5,
      severity:    (item.quantity ?? 0) <= Math.floor((item.lowStockThreshold ?? 5) * 0.4) ? 'critical' : 'low',
    }))
  },
}

export const customerService = {
  async findByPhone(phone: string) {
    const r = await api.get(`/customers/phone/${encodeURIComponent(phone)}`)
    return r.data
  },
}

export const productService = {
  async search(query: string, page = 1, limit = 5) {
    const r = await api.get('/products', { params: { search: query || undefined, page, limit, isActive: true } })
    return { products: r.data.data ?? [], total: r.data.meta?.total ?? 0 }
  },
}
