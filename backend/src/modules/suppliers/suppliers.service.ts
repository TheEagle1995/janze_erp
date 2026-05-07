import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  findAll() { return this.prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }) }
  async findOne(id: string) {
    const s = await this.prisma.supplier.findUnique({ where: { id }, include: { purchaseOrders: { orderBy: { createdAt: 'desc' }, take: 10 } } })
    if (!s) throw new NotFoundException()
    return s
  }
  create(data: any) { return this.prisma.supplier.create({ data }) }
  async update(id: string, data: any) { await this.findOne(id); return this.prisma.supplier.update({ where: { id }, data }) }

  async createPO(supplierId: string, data: any) {
    const count = await this.prisma.purchaseOrder.count()
    const orderNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`
    return this.prisma.purchaseOrder.create({ data: { ...data, supplierId, orderNumber } })
  }

  async receivePO(poId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id: poId } })
    if (!po) throw new NotFoundException()
    return this.prisma.purchaseOrder.update({ where: { id: poId }, data: { status: 'PAID', receivedDate: new Date() } })
  }

  getPOs(params: { supplierId?: string; status?: string }) {
    const where: any = {}
    if (params.supplierId) where.supplierId = params.supplierId
    if (params.status)     where.status     = params.status
    return this.prisma.purchaseOrder.findMany({
      where,
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  /** Product insights: trending (most sold in last 30 days) & slow-moving (lowest sales) */
  async getProductInsights() {
    const since30 = new Date()
    since30.setDate(since30.getDate() - 30)

    // Get all order items from last 30 days
    const recentItems = await this.prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: since30 }, status: 'COMPLETED' } },
      include: { variant: { include: { product: { select: { id: true, name: true, brand: true } } } } },
    })

    // Aggregate by product
    const productMap = new Map<string, { id: string; name: string; brand: string; sold: number; revenue: number }>()
    for (const item of recentItems) {
      const prod = item.variant?.product
      if (!prod) continue
      const existing = productMap.get(prod.id)
      if (existing) {
        existing.sold    += item.quantity
        existing.revenue += Number(item.lineTotal)
      } else {
        productMap.set(prod.id, { id: prod.id, name: prod.name, brand: prod.brand, sold: item.quantity, revenue: Number(item.lineTotal) })
      }
    }

    const ranked = Array.from(productMap.values()).sort((a, b) => b.sold - a.sold)

    // All active products to find slow movers
    const allProducts = await this.prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, brand: true },
    })
    const soldIds = new Set(ranked.map(p => p.id))
    const slowMovers = allProducts
      .filter(p => !soldIds.has(p.id))
      .slice(0, 10)
      .map(p => ({ ...p, sold: 0, revenue: 0 }))

    // Pending POs with upcoming/overdue deliveries
    const pendingPOs = await this.prisma.purchaseOrder.findMany({
      where:   { status: { not: 'PAID' } },
      include: { supplier: { select: { name: true } } },
      orderBy: { expectedDate: 'asc' },
      take:    10,
    })

    return {
      trending:   ranked.slice(0, 10),
      slowMovers: (slowMovers as any[]).concat(ranked.slice(-5).reverse()),
      pendingPOs,
    }
  }
}
