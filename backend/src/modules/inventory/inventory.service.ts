import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getInventory(params: { branchId?: string; variantId?: string; page?: number; limit?: number }) {
    const { branchId, variantId, page = 1, limit = 50 } = params
    const where: any = {}
    if (branchId)  where.branchId  = branchId
    if (variantId) where.variantId = variantId

    const [items, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where, skip: (+page - 1) * +limit, take: +limit,
        include: {
          variant: {
            include: {
              product: { select: { id: true, name: true, brand: true, sellPrice: true, costPrice: true } },
            },
          },
          branch: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.inventory.count({ where }),
    ])
    return { data: items, meta: { total, page: +page, limit: +limit } }
  }

  async getLowStock(branchId?: string) {
    const where: any = {}
    if (branchId) where.branchId = branchId

    const items = await this.prisma.inventory.findMany({
      where,
      include: {
        branch:  { select: { id: true, name: true } },
        variant: {
          include: {
            product: { select: { id: true, name: true, brand: true } },
          },
        },
      },
    })

    return items
      .filter(i => i.quantity >= 0 && i.quantity <= i.lowStockThreshold)
      .sort((a, b) => a.quantity - b.quantity)
      .map(i => ({
        id:                i.id,
        quantity:          i.quantity,
        reservedQty:       i.reservedQty,
        lowStockThreshold: i.lowStockThreshold,
        severity:          i.quantity <= Math.floor(i.lowStockThreshold * 0.4) ? 'critical' : 'low',
        branch:            i.branch,
        variant: {
          id:      i.variant.id,
          sku:     i.variant.sku,
          size:    i.variant.size,
          color:   i.variant.color,
          product: i.variant.product,
        },
      }))
  }

  async adjust(variantId: string, branchId: string, quantity: number, note: string, userId: string, type?: string) {
    const inv     = await this.prisma.inventory.findUnique({ where: { variantId_branchId: { variantId, branchId } } })
    const current = inv?.quantity ?? 0
    const newQty  = current + quantity

    // Allow negative stock — it surfaces as a restock alert in the inventory module
    const movementType = (type as any) ?? 'ADJUSTMENT'

    const [updated] = await this.prisma.$transaction([
      this.prisma.inventory.upsert({
        where:  { variantId_branchId: { variantId, branchId } },
        create: { variantId, branchId, quantity },
        update: { quantity: newQty },
      }),
      this.prisma.stockMovement.create({
        data: { variantId, toBranchId: branchId, type: movementType, quantity, note, userId },
      }),
    ])
    return { variantId, branchId, previousQty: current, newQty, adjustment: quantity }
  }

  async transfer(variantId: string, fromBranchId: string, toBranchId: string, quantity: number, userId: string) {
    const fromInv = await this.prisma.inventory.findUnique({
      where: { variantId_branchId: { variantId, branchId: fromBranchId } },
    })
    if (!fromInv || fromInv.quantity < quantity) {
      throw new BadRequestException(`Insufficient stock. Available: ${fromInv?.quantity ?? 0}`)
    }

    await this.prisma.$transaction([
      this.prisma.inventory.update({
        where: { variantId_branchId: { variantId, branchId: fromBranchId } },
        data:  { quantity: { decrement: quantity } },
      }),
      this.prisma.inventory.upsert({
        where:  { variantId_branchId: { variantId, branchId: toBranchId } },
        create: { variantId, branchId: toBranchId, quantity },
        update: { quantity: { increment: quantity } },
      }),
      this.prisma.stockMovement.create({
        data: { variantId, fromBranchId, toBranchId, type: 'TRANSFER', quantity, userId },
      }),
    ])
    return { success: true, variantId, fromBranchId, toBranchId, transferred: quantity }
  }

  async getMovements(params: { variantId?: string; branchId?: string; type?: string; page?: number; limit?: number }) {
    const { variantId, branchId, type, page = 1, limit = 50 } = params
    const where: any = {}
    if (variantId) where.variantId = variantId
    if (type)      where.type      = type
    if (branchId)  where.OR = [{ fromBranchId: branchId }, { toBranchId: branchId }]

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where, skip: (+page - 1) * +limit, take: +limit,
        orderBy: { createdAt: 'desc' },
        include: {
          variant: { include: { product: { select: { name: true, brand: true } } } },
          user:    { select: { name: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ])
    return { data: movements, meta: { total, page: +page, limit: +limit } }
  }
}
