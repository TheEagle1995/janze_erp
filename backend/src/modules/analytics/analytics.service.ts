import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

// Only Orders-section records feed analytics.
// POS sales (source = 'POS') are tracked separately on the POS page.
const ORDER_SOURCE = 'ORDER'

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(params: { branchId?: string; period?: string }) {
    const { branchId, period = 'today' } = params
    const { from, to, prevFrom, prevTo } = this.getPeriodDates(period)

    const where: any     = { source: ORDER_SOURCE, status: 'COMPLETED', createdAt: { gte: from, lte: to } }
    const prevWhere: any = { source: ORDER_SOURCE, status: 'COMPLETED', createdAt: { gte: prevFrom, lte: prevTo } }
    if (branchId) { where.branchId = branchId; prevWhere.branchId = branchId }

    const itemWhere: any = { order: where }

    const [current, previous, newCustomers, itemsSoldResult] = await Promise.all([
      this.prisma.order.aggregate({
        where,
        _sum:   { total: true, discountTotal: true },
        _count: { id: true },
        _avg:   { total: true },
      }),
      this.prisma.order.aggregate({
        where: prevWhere,
        _sum:   { total: true },
        _count: { id: true },
        _avg:   { total: true },
      }),
      this.prisma.customer.count({ where: { createdAt: { gte: from, lte: to } } }),
      this.prisma.orderItem.aggregate({ where: itemWhere, _sum: { quantity: true } }),
    ])

    const revenue    = Number(current._sum.total    ?? 0)
    const prevRev    = Number(previous._sum.total   ?? 0)
    const orders     = current._count.id
    const prevOrders = previous._count.id

    return {
      revenue:      { value: revenue,     change: this.pctChange(revenue, prevRev) },
      orders:       { value: orders,      change: this.pctChange(orders, prevOrders) },
      avgOrder:     { value: Number(current._avg.total ?? 0), change: 0 },
      discountTotal: Number(current._sum.discountTotal ?? 0),
      newCustomers,
      itemsSold:    Number(itemsSoldResult._sum.quantity ?? 0),
    }
  }

  async getSalesChart(params: { branchId?: string; dateFrom: string; dateTo: string; groupBy?: string }) {
    const { branchId, dateFrom, dateTo, groupBy = 'day' } = params
    const from = new Date(dateFrom)
    const to   = new Date(dateTo + 'T23:59:59')

    const where: any = { source: ORDER_SOURCE, status: 'COMPLETED', createdAt: { gte: from, lte: to } }
    if (branchId) where.branchId = branchId

    const orders = await this.prisma.order.findMany({
      where,
      select: { total: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const grouped: Record<string, { revenue: number; count: number }> = {}
    for (const o of orders) {
      const d = o.createdAt
      let key: string
      if (groupBy === 'month') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      } else if (groupBy === 'week') {
        const jan1 = new Date(d.getFullYear(), 0, 1)
        const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
        key = `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
      } else if (groupBy === 'hour') {
        key = `${String(d.getHours()).padStart(2, '0')}:00`
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      }
      if (!grouped[key]) grouped[key] = { revenue: 0, count: 0 }
      grouped[key].revenue += Number(o.total)
      grouped[key].count   += 1
    }

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, { revenue, count }]) => ({ period, revenue: Math.round(revenue), count }))
  }

  async getHourlyStats(params: { branchId?: string; date?: string }) {
    const date = params.date ? new Date(params.date) : new Date()
    const from = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const to   = new Date(from); to.setDate(to.getDate() + 1)

    const where: any = { source: ORDER_SOURCE, status: 'COMPLETED', createdAt: { gte: from, lt: to } }
    if (params.branchId) where.branchId = params.branchId

    const orders = await this.prisma.order.findMany({
      where, select: { total: true, createdAt: true },
    })

    const hours: Record<number, { revenue: number; count: number }> = {}
    for (let h = 0; h < 24; h++) hours[h] = { revenue: 0, count: 0 }
    for (const o of orders) {
      const h = o.createdAt.getHours()
      hours[h].revenue += Number(o.total)
      hours[h].count   += 1
    }
    return Object.entries(hours).map(([h, v]) => ({
      hour:    Number(h),
      label:   `${String(h).padStart(2, '0')}:00`,
      revenue: Math.round(v.revenue),
      count:   v.count,
    }))
  }

  async getWeekdayStats(params: { branchId?: string; dateFrom: string; dateTo: string }) {
    const from = new Date(params.dateFrom)
    const to   = new Date(params.dateTo + 'T23:59:59')
    const where: any = { source: ORDER_SOURCE, status: 'COMPLETED', createdAt: { gte: from, lte: to } }
    if (params.branchId) where.branchId = params.branchId

    const orders = await this.prisma.order.findMany({
      where, select: { total: true, createdAt: true },
    })

    const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    const days: Record<number, { revenue: number; count: number }> = {}
    for (let d = 0; d < 7; d++) days[d] = { revenue: 0, count: 0 }
    for (const o of orders) {
      const d = o.createdAt.getDay()
      days[d].revenue += Number(o.total)
      days[d].count   += 1
    }
    return Object.entries(days).map(([d, v]) => ({
      day:     DAYS[Number(d)],
      revenue: Math.round(v.revenue),
      count:   v.count,
    }))
  }

  async getTopProducts(params: { branchId?: string; dateFrom: string; dateTo: string; limit?: number }) {
    const { branchId, dateFrom, dateTo, limit = 10 } = params
    const from = new Date(dateFrom)
    const to   = new Date(dateTo + 'T23:59:59')

    const orderWhere: any = { source: ORDER_SOURCE, status: 'COMPLETED', createdAt: { gte: from, lte: to } }
    if (branchId) orderWhere.branchId = branchId

    const items = await this.prisma.orderItem.findMany({
      where: { order: orderWhere },
      select: {
        quantity:  true,
        lineTotal: true,
        variant: {
          select: {
            product: { select: { id: true, name: true, brand: true } },
          },
        },
      },
    })

    const map = new Map<string, { id: string; name: string; brand: string; total_sold: number; total_revenue: number }>()
    for (const item of items) {
      const p = item.variant.product
      const existing = map.get(p.id)
      if (existing) {
        existing.total_sold    += item.quantity
        existing.total_revenue += Number(item.lineTotal)
      } else {
        map.set(p.id, { id: p.id, name: p.name, brand: p.brand, total_sold: item.quantity, total_revenue: Number(item.lineTotal) })
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, Number(limit))
  }

  async getSlowMovers(params: { branchId?: string; days?: number }) {
    const { branchId, days = 30 } = params
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const soldOrderWhere: any = { source: ORDER_SOURCE, status: 'COMPLETED', createdAt: { gte: cutoff } }
    if (branchId) soldOrderWhere.branchId = branchId

    const soldVariantIds = (await this.prisma.orderItem.findMany({
      where: { order: soldOrderWhere },
      select:   { variantId: true },
      distinct: ['variantId'],
    })).map(r => r.variantId)

    return this.prisma.inventory.findMany({
      where: {
        variantId: { notIn: soldVariantIds },
        quantity:  { gt: 0 },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        variant: { include: { product: { select: { id: true, name: true, brand: true } } } },
        branch:  { select: { id: true, name: true } },
      },
      take: 50,
    })
  }

  async getByEmployee(params: { branchId?: string; dateFrom: string; dateTo: string }) {
    const from = new Date(params.dateFrom)
    const to   = new Date(params.dateTo + 'T23:59:59')
    const where: any = { source: ORDER_SOURCE, status: 'COMPLETED', createdAt: { gte: from, lte: to } }
    if (params.branchId) where.branchId = params.branchId

    const grouped = await this.prisma.order.groupBy({
      by:    ['cashierId'],
      where,
      _sum:  { total: true },
      _count:{ id: true },
      _avg:  { total: true },
    })

    const userIds  = grouped.map(g => g.cashierId)
    const users    = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    const userMap  = new Map(users.map(u => [u.id, u.name]))

    return grouped.map(g => ({
      cashierId:     g.cashierId,
      cashierName:   userMap.get(g.cashierId) ?? 'Unknown',
      totalRevenue:  Number(g._sum.total ?? 0),
      orderCount:    g._count.id,
      avgOrderValue: Number(g._avg.total ?? 0),
    })).sort((a, b) => b.totalRevenue - a.totalRevenue)
  }

  async getProfitLoss(params: { branchId?: string; dateFrom: string; dateTo: string }) {
    const from = new Date(params.dateFrom)
    const to   = new Date(params.dateTo + 'T23:59:59')
    const where: any = { source: ORDER_SOURCE, status: 'COMPLETED', createdAt: { gte: from, lte: to } }
    if (params.branchId) where.branchId = params.branchId

    const [revenue, orderCount] = await Promise.all([
      this.prisma.order.aggregate({ where, _sum: { total: true, discountTotal: true, taxTotal: true } }),
      this.prisma.order.count({ where }),
    ])

    const orderItems = await this.prisma.orderItem.findMany({
      where: { order: where },
      select: { unitCost: true, quantity: true },
    })
    const costOfGoods = orderItems.reduce(
      (s, i) => s + Number(i.unitCost) * Number(i.quantity), 0
    )

    const grossRevenue  = Number(revenue._sum.total         ?? 0)
    const discountTotal = Number(revenue._sum.discountTotal ?? 0)
    const taxTotal      = Number(revenue._sum.taxTotal      ?? 0)
    const netRevenue    = grossRevenue - discountTotal
    const grossProfit   = netRevenue - costOfGoods
    const grossMargin   = netRevenue > 0 ? (grossProfit / netRevenue * 100).toFixed(1) : '0'

    return {
      dateFrom: params.dateFrom,
      dateTo:   params.dateTo,
      grossRevenue,
      discountTotal,
      taxTotal,
      netRevenue,
      costOfGoods,
      grossProfit,
      grossMargin,
      orderCount,
      netProfit: grossProfit,
    }
  }

  async getPaymentMethods(params: { branchId?: string; dateFrom?: string; dateTo?: string }) {
    const from = params.dateFrom ? new Date(params.dateFrom) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const to   = params.dateTo   ? new Date(params.dateTo + 'T23:59:59') : new Date()

    const where: any = { order: { source: ORDER_SOURCE, status: 'COMPLETED', createdAt: { gte: from, lte: to } } }
    if (params.branchId) where.order = { ...where.order, branchId: params.branchId }

    const rows = await this.prisma.payment.groupBy({
      by:    ['method'],
      where,
      _sum:  { amount: true },
      _count:{ id: true },
    })

    const total = rows.reduce((s, r) => s + Number(r._sum.amount ?? 0), 0)
    return rows.map(r => ({
      method:  r.method,
      amount:  Number(r._sum.amount ?? 0),
      count:   r._count.id,
      pct:     total > 0 ? parseFloat(((Number(r._sum.amount ?? 0) / total) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.amount - a.amount)
  }

  async getByBranch(params: { dateFrom?: string; dateTo?: string }) {
    const from = params.dateFrom ? new Date(params.dateFrom) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const to   = params.dateTo   ? new Date(params.dateTo + 'T23:59:59') : new Date()

    const branchWhere: any = { source: ORDER_SOURCE, status: 'COMPLETED', createdAt: { gte: from, lte: to } }

    const grouped = await this.prisma.order.groupBy({
      by:    ['branchId'],
      where: branchWhere,
      _sum:  { total: true },
      _count:{ id: true },
    })

    const branchIds = grouped.map(g => g.branchId)
    const branches  = await this.prisma.branch.findMany({
      where:  { id: { in: branchIds } },
      select: { id: true, name: true, brand: true },
    })
    const branchMap = new Map(branches.map(b => [b.id, b]))

    return grouped.map(g => ({
      branchId:   g.branchId,
      branchName: branchMap.get(g.branchId)?.name ?? 'Unknown',
      brand:      branchMap.get(g.branchId)?.brand ?? '',
      revenue:    Number(g._sum.total ?? 0),
      orderCount: g._count.id,
    })).sort((a, b) => b.revenue - a.revenue)
  }

  private getPeriodDates(period: string) {
    const now = new Date()
    let from: Date, to: Date, prevFrom: Date, prevTo: Date

    if (period === 'today') {
      from     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      to       = new Date(from); to.setDate(to.getDate() + 1)
      prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate() - 1)
      prevTo   = new Date(from)
    } else if (period === 'week') {
      const day  = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1)
      from     = new Date(now.getFullYear(), now.getMonth(), diff)
      to       = new Date(); to.setHours(23, 59, 59)
      prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate() - 7)
      prevTo   = new Date(from); prevTo.setDate(prevTo.getDate() - 1)
    } else {
      from     = new Date(now.getFullYear(), now.getMonth(), 1)
      to       = new Date(); to.setHours(23, 59, 59)
      prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      prevTo   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    }
    return { from, to, prevFrom, prevTo }
  }

  private pctChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return parseFloat(((current - previous) / previous * 100).toFixed(1))
  }
}
