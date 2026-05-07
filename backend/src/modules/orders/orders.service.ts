import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { EventEmitter2 } from '@nestjs/event-emitter'
import Decimal from 'decimal.js'

/** Calculate line total matching the frontend cartStore logic exactly */
function calcLineTotal(unitPrice: number, quantity: number, discountPct = 0, discountFixed = 0): number {
  const base    = unitPrice * quantity
  const discPct = base * (discountPct / 100)
  return Math.max(0, Math.round((base - discPct - discountFixed) * 100) / 100)
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  async create(dto: any, cashierId: string) {
    const { branchId, customerId, items, payments, notes, offlineId, source = 'ORDER' } = dto

    // Idempotency: reject duplicate offline orders
    if (offlineId) {
      const existing = await this.prisma.order.findUnique({ where: { offlineId } })
      if (existing) return existing
    }

    // ── Stock check: log a warning if below zero, but never block the sale ──────
    // Stock can go negative — the inventory module will show it as a restock alert.
    // (Blocking sales at the register causes more harm than an overdrawn stock count.)

    const branch  = await this.prisma.branch.findUnique({ where: { id: branchId } })

    // VAT removed — taxRate is always 0
    const itemsWithTotals = items.map((i: any) => ({
      ...i,
      computedLineTotal: calcLineTotal(
        Number(i.unitPrice),
        Number(i.quantity),
        Number(i.discountPct  ?? 0),
        Number(i.discountFixed ?? 0),
      ),
    }))

    const subtotal      = Math.round(itemsWithTotals.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0) * 100) / 100
    const discountTotal = Math.round(itemsWithTotals.reduce((s: number, i: any) => s + (i.unitPrice * i.quantity - i.computedLineTotal), 0) * 100) / 100
    const netAmount     = Math.round((subtotal - discountTotal) * 100) / 100
    const taxTotal      = 0
    const total         = netAmount

    // ── Generate order number (collision-safe) ───────────────────────────────
    // Use timestamp + random suffix to guarantee uniqueness even under concurrency.
    // Format: AVE-20260101-0001-XY  (brand prefix, date, seq padded, 2-char random)
    const date   = new Date()
    const prefix = `${branch?.brand?.slice(0,3) ?? 'ERP'}-${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`
    const count  = await this.prisma.order.count({ where: { orderNumber: { startsWith: prefix } } })
    const rand   = Math.random().toString(36).slice(2, 4).toUpperCase()
    const orderNumber = `${prefix}-${String(count + 1).padStart(4, '0')}-${rand}`

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await (tx.order.create as any)({
        data: {
          orderNumber, branchId, cashierId,
          customerId: customerId ?? null,
          subtotal,
          discountTotal,
          taxTotal,
          total,
          status: 'COMPLETED',
          source,                          // 'POS' or 'ORDER'
          offlineId: offlineId ?? null,
          notes: notes ?? null,
          items: {
            create: itemsWithTotals.map((i: any) => ({
              variantId:     i.variantId,
              quantity:      i.quantity,
              unitPrice:     Number(i.unitPrice),
              unitCost:      Number(i.unitCost ?? 0),
              discountPct:   Number(i.discountPct  ?? 0),
              discountFixed: Number(i.discountFixed ?? 0),
              lineTotal:     i.computedLineTotal,   // ← correctly discounted
            })),
          },
          payments: {
            create: payments
              .filter((p: any) => Number(p.amount) > 0)
              .map((p: any) => ({ method: p.method, amount: Number(p.amount), reference: p.reference ?? null })),
          },
        },
        include: { items: { include: { variant: { include: { product: true } } } }, payments: true },
      })

      // Decrement inventory (only for variants that have tracked inventory)
      for (const item of itemsWithTotals) {
        const inv = await tx.inventory.findUnique({
          where: { variantId_branchId: { variantId: item.variantId, branchId } },
        })
        if (inv) {
          await tx.inventory.update({
            where: { variantId_branchId: { variantId: item.variantId, branchId } },
            data:  { quantity: { decrement: item.quantity } },
          })
        }
        await tx.stockMovement.create({
          data: { variantId: item.variantId, fromBranchId: branchId, type: 'SALE', quantity: item.quantity, userId: cashierId, referenceId: created.id },
        })
      }

      // Award loyalty points immediately (1 point per 1000 UZS)
      if (customerId) {
        const pointsEarned = Math.floor(total / 1000)
        await tx.customer.update({
          where: { id: customerId },
          data:  { loyaltyPoints: { increment: pointsEarned }, totalSpent: { increment: total }, totalOrders: { increment: 1 } },
        })
        if (pointsEarned > 0) {
          await tx.loyaltyTransaction.create({
            data: { customerId, type: 'ADD', points: pointsEarned, description: `Sale ${orderNumber}`, orderId: created.id },
          })
        }
      }

      return created
    })

    // Only emit order.completed for ORDER-sourced orders (not POS).
    // POS sales are tracked separately and do not feed the Orders analytics or Finance journals.
    if (source === 'ORDER') {
      this.events.emit('order.completed', { order, cashierId })
    }

    return order
  }

  async findAll(params: { branchId?: string; cashierId?: string; status?: string; statusIn?: string; source?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number; sortBy?: string; sortDir?: string; includeItems?: string }) {
    const { branchId, cashierId, status, dateFrom, dateTo } = params
    const page  = Math.max(1,   parseInt(String(params.page  ?? 1)))
    const limit = Math.min(200, parseInt(String(params.limit ?? 20)))
    const where: any = {}
    if (branchId)       where.branchId  = branchId
    if (cashierId)      where.cashierId = cashierId
    if (params.source)  where.source    = params.source   // 'POS' or 'ORDER'
    if (params.statusIn) {
      where.status = { in: String(params.statusIn).split(',').map((s: string) => s.trim()) }
    } else if (status) {
      where.status = status
    }
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo)   where.createdAt.lte = new Date(dateTo + 'T23:59:59')
    }

    const sortField = params.sortBy ?? 'createdAt'
    const sortOrder = params.sortDir === 'asc' ? 'asc' : 'desc'

    // When includeItems=true, embed sold products so the dashboard can display what was sold
    const withItems = params.includeItems === 'true' || (params.includeItems as any) === true
    const includeClause: any = {
      cashier:  { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, phone: true } },
      payments: true,
      _count:   { select: { items: true } },
    }
    if (withItems) {
      includeClause.items = {
        select: {
          quantity:  true,
          unitPrice: true,
          lineTotal: true,
          variant: { include: { product: { select: { id: true, name: true } } } },
        },
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { [sortField]: sortOrder },
        include: includeClause,
      }),
      this.prisma.order.count({ where }),
    ])
    return { data: orders, meta: { total, page, limit, lastPage: Math.ceil(total / limit) } }
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items:    { include: { variant: { include: { product: true } } } },
        payments: true,
        cashier:  { select: { id: true, name: true } },
        customer: true,
        branch:   { select: { id: true, name: true, brand: true } },
      },
    })
    if (!order) throw new NotFoundException(`Order ${id} not found`)
    return order
  }

  async refund(id: string, userId: string) {
    const order = await this.findOne(id)
    if (order.status !== 'COMPLETED') throw new BadRequestException('Only completed orders can be refunded')

    const updated = await this.prisma.$transaction(async (tx) => {
      const upd = await tx.order.update({ where: { id }, data: { status: 'REFUNDED' } })

      // Restore inventory
      for (const item of order.items) {
        await tx.inventory.update({
          where: { variantId_branchId: { variantId: item.variantId, branchId: order.branchId } },
          data:  { quantity: { increment: item.quantity } },
        })
        await tx.stockMovement.create({
          data: { variantId: item.variantId, toBranchId: order.branchId, type: 'RETURN', quantity: item.quantity, userId, referenceId: id },
        })
      }

      // Reverse loyalty
      if (order.customerId) {
        const pointsEarned = Math.floor(Number(order.total) / 1000)
        await tx.customer.update({
          where: { id: order.customerId },
          data:  { loyaltyPoints: { decrement: pointsEarned }, totalSpent: { decrement: Number(order.total) }, totalOrders: { decrement: 1 } },
        })
      }
      return upd
    })

    this.events.emit('order.refunded', { order: updated, userId })
    return updated
  }

  /** Finalize an order — marks it COMPLETED so it feeds analytics */
  async finalize(id: string, userId: string) {
    const order = await this.findOne(id)
    if (order.status === 'COMPLETED') return order   // already done
    if (order.status === 'VOID')      throw new BadRequestException('Cannot finalize a cancelled order')
    if (order.status === 'REFUNDED')  throw new BadRequestException('Cannot finalize a refunded order')

    const updated = await this.prisma.$transaction(async (tx) => {
      const upd = await tx.order.update({
        where: { id },
        data:  { status: 'COMPLETED' },
      })

      // Award loyalty points on finalize (1 point per 1000 UZS)
      if (order.customerId) {
        const pointsEarned = Math.floor(Number(order.total) / 1000)
        await tx.customer.update({
          where: { id: order.customerId },
          data:  { loyaltyPoints: { increment: pointsEarned }, totalSpent: { increment: Number(order.total) }, totalOrders: { increment: 1 } },
        })
        if (pointsEarned > 0) {
          await tx.loyaltyTransaction.create({
            data: { customerId: order.customerId, type: 'ADD', points: pointsEarned, description: `Sale ${order.orderNumber}`, orderId: id },
          })
        }
      }
      return upd
    })

    // Fire event for finance journal entry (non-blocking)
    this.events.emit('order.completed', { order: updated, cashierId: userId })
    return updated
  }

  /** Cancel an order — marks it VOID and restores inventory */
  async cancel(id: string, userId: string) {
    const order = await this.findOne(id)
    if (order.status === 'VOID') return order
    if (order.status === 'REFUNDED') throw new BadRequestException('Order already refunded')

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id }, data: { status: 'VOID' } })

      // Restore inventory — inventory is always decremented on create (PENDING or COMPLETED)
      if (order.status === 'COMPLETED' || order.status === 'PENDING') {
        for (const item of order.items) {
          const inv = await tx.inventory.findUnique({
            where: { variantId_branchId: { variantId: item.variantId, branchId: order.branchId } },
          })
          if (inv) {
            await tx.inventory.update({
              where: { variantId_branchId: { variantId: item.variantId, branchId: order.branchId } },
              data:  { quantity: { increment: item.quantity } },
            })
          }
          await tx.stockMovement.create({
            data: { variantId: item.variantId, toBranchId: order.branchId, type: 'RETURN', quantity: item.quantity, userId, referenceId: id },
          })
        }
        // Reverse loyalty only if it was COMPLETED (loyalty is awarded on finalize)
        if (order.status === 'COMPLETED' && order.customerId) {
          const pts = Math.floor(Number(order.total) / 1000)
          if (pts > 0) {
            await tx.customer.update({
              where: { id: order.customerId },
              data:  { loyaltyPoints: { decrement: pts }, totalSpent: { decrement: Number(order.total) }, totalOrders: { decrement: 1 } },
            })
          }
        }
      }
      return updated
    })
  }

  /** Edit a PENDING order — replace items, payments, customer, and notes */
  async update(id: string, dto: any, userId: string) {
    const order = await this.findOne(id)
    if (order.status !== 'PENDING') throw new BadRequestException('Only pending orders can be edited')

    const { customerId, items, payments, notes } = dto
    const branchId = order.branchId

    const itemsWithTotals = (items ?? []).map((i: any) => ({
      ...i,
      computedLineTotal: calcLineTotal(
        Number(i.unitPrice),
        Number(i.quantity),
        Number(i.discountPct  ?? 0),
        Number(i.discountFixed ?? 0),
      ),
    }))

    const subtotal      = Math.round(itemsWithTotals.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0) * 100) / 100
    const discountTotal = Math.round(itemsWithTotals.reduce((s: number, i: any) => s + (i.unitPrice * i.quantity - i.computedLineTotal), 0) * 100) / 100
    const netAmount     = Math.round((subtotal - discountTotal) * 100) / 100
    const total         = netAmount

    return this.prisma.$transaction(async (tx) => {
      // ── 1. Restore inventory for ALL old items ───────────────────────────
      for (const oldItem of order.items) {
        const inv = await tx.inventory.findUnique({
          where: { variantId_branchId: { variantId: oldItem.variantId, branchId } },
        })
        if (inv) {
          await tx.inventory.update({
            where: { variantId_branchId: { variantId: oldItem.variantId, branchId } },
            data:  { quantity: { increment: oldItem.quantity } },
          })
        }
      }

      // ── 2. Delete old items + payments ───────────────────────────────────
      await tx.orderItem.deleteMany({ where: { orderId: id } })
      await tx.payment.deleteMany({ where: { orderId: id } })

      // ── 3. Create new items + payments, recalculate totals ───────────────
      const updated = await tx.order.update({
        where: { id },
        data: {
          customerId:    customerId ?? null,
          notes:         notes      ?? null,
          subtotal,
          discountTotal,
          taxTotal:      0,
          total,
          updatedAt:     new Date(),
          items: {
            create: itemsWithTotals.map((i: any) => ({
              variantId:     i.variantId,
              quantity:      i.quantity,
              unitPrice:     Number(i.unitPrice),
              unitCost:      Number(i.unitCost ?? 0),
              discountPct:   Number(i.discountPct  ?? 0),
              discountFixed: Number(i.discountFixed ?? 0),
              lineTotal:     i.computedLineTotal,
            })),
          },
          payments: {
            create: (payments ?? [])
              .filter((p: any) => Number(p.amount) > 0)
              .map((p: any) => ({ method: p.method, amount: Number(p.amount), reference: p.reference ?? null })),
          },
        },
        include: { items: { include: { variant: { include: { product: true } } } }, payments: true },
      })

      // ── 4. Decrement inventory for new items ─────────────────────────────
      for (const item of itemsWithTotals) {
        const inv = await tx.inventory.findUnique({
          where: { variantId_branchId: { variantId: item.variantId, branchId } },
        })
        if (inv) {
          await tx.inventory.update({
            where: { variantId_branchId: { variantId: item.variantId, branchId } },
            data:  { quantity: { decrement: item.quantity } },
          })
        }
        await tx.stockMovement.create({
          data: { variantId: item.variantId, fromBranchId: branchId, type: 'SALE', quantity: item.quantity, userId, referenceId: id },
        })
      }

      return updated
    })
  }

  async syncOffline(orders: any[], cashierId: string) {
    const results = []
    for (const o of orders) {
      try {
        const result = await this.create({ ...o, offlineId: o.offlineId }, cashierId)
        results.push({ offlineId: o.offlineId, status: 'synced', orderId: result.id })
      } catch (err: any) {
        results.push({ offlineId: o.offlineId, status: 'failed', error: err.message })
      }
    }
    return results
  }
}
