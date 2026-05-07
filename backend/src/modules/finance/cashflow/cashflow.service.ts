import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../database/prisma.service'
import Decimal from 'decimal.js'

@Injectable()
export class CashFlowService {
  constructor(private prisma: PrismaService) {}

  async generate(filters: { branchId?: string; dateFrom: string; dateTo: string }) {
    const from = new Date(filters.dateFrom)
    const to   = new Date(filters.dateTo + 'T23:59:59')
    const movements = await this.getCashMovements(filters.branchId ?? null, from, to)
    const inflow  = movements.filter(m => m > 0).reduce((s, m) => s + m, 0)
    const outflow = movements.filter(m => m < 0).reduce((s, m) => s + m, 0)
    return {
      period:    { from, to },
      inflow:    Math.round(inflow),
      outflow:   Math.round(Math.abs(outflow)),
      netChange: Math.round(inflow + outflow),
    }
  }

  async getDailyCashPosition(branchId: string, days = 30) {
    const results = []
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const date    = new Date(now); date.setDate(now.getDate() - i); date.setHours(0,0,0,0)
      const dateEnd = new Date(date); dateEnd.setHours(23,59,59,999)
      const movements = await this.getCashMovements(branchId, date, dateEnd)
      const inflow  = movements.filter(m => m > 0).reduce((s, m) => s + m, 0)
      const outflow = movements.filter(m => m < 0).reduce((s, m) => s + m, 0)
      results.push({
        date:      date.toISOString().slice(0, 10),
        inflow:    Math.round(inflow),
        outflow:   Math.round(Math.abs(outflow)),
        netChange: Math.round(inflow + outflow),
      })
    }
    return results
  }

  async getProjection(branchId: string) {
    const now  = new Date()
    const from = new Date(now); from.setDate(now.getDate() - 30)
    const movements = await this.getCashMovements(branchId, from, now)
    const totalNet       = movements.reduce((s, m) => s + m, 0)
    const avgDailyNet    = totalNet / 30
    return {
      avgDailyNetFlow:   Math.round(avgDailyNet),
      projectedIn30Days: Math.round(avgDailyNet * 30),
    }
  }

  // Get net cash movements using Prisma (no raw SQL)
  private async getCashMovements(branchId: string | null, from: Date, to: Date): Promise<number[]> {
    // Find cash/bank account IDs
    const cashAccounts = await this.prisma.financeAccount.findMany({
      where: { subtype: { in: ['CASH', 'BANK'] }, isActive: true },
      select: { id: true },
    })
    const cashIds = cashAccounts.map(a => a.id)
    if (cashIds.length === 0) return []

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        status: 'POSTED',
        date:   { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        lines: {
          where: {
            OR: [
              { debitAccountId:  { in: cashIds } },
              { creditAccountId: { in: cashIds } },
            ],
          },
        },
      },
    })

    const nets: number[] = []
    for (const entry of entries) {
      let net = BigInt(0)
      for (const line of entry.lines) {
        if (line.debitAccountId  && cashIds.includes(line.debitAccountId))  net += line.amountTiyin
        if (line.creditAccountId && cashIds.includes(line.creditAccountId)) net -= line.amountTiyin
      }
      if (net !== BigInt(0)) nets.push(Number(net) / 100)
    }
    return nets
  }
}
