import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../../database/prisma.service'
import Decimal from 'decimal.js'

function decimalToTiyin(d: any): bigint {
  return BigInt(new Decimal(String(d)).times(100).toFixed(0))
}

@Injectable()
export class ReconciliationService {
  constructor(private prisma: PrismaService) {}

  async openShift(dto: { branchId: string; cashierId: string; openingCash: number }) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const existing = await this.prisma.cashReconciliation.findFirst({
      where: { cashierId: dto.cashierId, shiftDate: today, status: 'OPEN' },
    })
    if (existing) throw new ConflictException('Shift already open for this cashier today')

    return this.prisma.cashReconciliation.create({
      data: {
        branchId:    dto.branchId,
        cashierId:   dto.cashierId,
        shiftDate:   today,
        shiftStart:  new Date(),
        openingCash: decimalToTiyin(dto.openingCash),
        status:      'OPEN',
      },
    })
  }

  async closeShift(
    id: string,
    dto: { countedCash: number; discrepancyNote?: string },
    userId: string,
  ) {
    const recon = await this.prisma.cashReconciliation.findUnique({ where: { id } })
    if (!recon) throw new NotFoundException('Reconciliation session not found')
    if (recon.status !== 'OPEN') throw new ConflictException('Shift is not open')

    const countedTiyin  = decimalToTiyin(dto.countedCash)
    const expectedTiyin = recon.openingCash  // simplified — in prod derive from orders
    const diff          = countedTiyin - expectedTiyin
    const tolerance     = BigInt(500000)  // 5000 UZS in tiyin
    const absGap        = diff < BigInt(0) ? -diff : diff
    const status        = absGap <= tolerance ? 'BALANCED' : 'DISCREPANCY'

    return this.prisma.cashReconciliation.update({
      where: { id },
      data: {
        shiftEnd:        new Date(),
        countedCash:     countedTiyin,
        expectedCash:    expectedTiyin,
        differenceTiyin: diff,
        status,
        discrepancyNote: dto.discrepancyNote ?? null,
      },
    })
  }

  async getCurrentShift(branchId: string, cashierId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return this.prisma.cashReconciliation.findFirst({
      where: { branchId, cashierId, shiftDate: today, status: 'OPEN' },
    })
  }

  getHistory(branchId: string, days = 30) {
    const from = new Date()
    from.setDate(from.getDate() - days)
    return this.prisma.cashReconciliation.findMany({
      where:   { branchId, shiftDate: { gte: from } },
      orderBy: { shiftDate: 'desc' },
    })
  }
}
