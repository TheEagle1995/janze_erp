import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../database/prisma.service'
import Decimal from 'decimal.js'

function decimalToTiyin(d: any): bigint { return BigInt(new Decimal(d).times(100).toFixed(0)) }

@Injectable()
export class BudgetService {
  constructor(private prisma: PrismaService) {}

  findAll(branchId?: string) {
    return this.prisma.budget.findMany({ where: { isActive: true, ...(branchId ? { branchId } : {}) }, include: { lines: true } })
  }

  create(dto: any, createdBy: string) {
    return this.prisma.budget.create({
      data: { ...dto, createdBy, periodStart: new Date(dto.periodStart), periodEnd: new Date(dto.periodEnd),
        lines: { create: dto.lines?.map((l: any) => ({ accountId: l.accountId, budgetedTiyin: decimalToTiyin(l.budgetedAmount) })) ?? [] } },
      include: { lines: true },
    })
  }

  async getBudgetActual(budgetId: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id: budgetId }, include: { lines: { include: { account: true } } } })
    if (!budget) throw new NotFoundException()

    const actuals = await Promise.all(budget.lines.map(async line => {
      // Pure ORM — avoids $queryRaw uuid typecast issue (text = uuid operator error)
      const debitLines = await this.prisma.journalLine.findMany({
        where: {
          debitAccountId: line.accountId,
          journal: {
            status: 'POSTED',
            date:   { gte: budget.periodStart, lte: budget.periodEnd },
          },
        },
        select: { amountTiyin: true },
      })
      const actual = debitLines.reduce((s, l) => s + l.amountTiyin, BigInt(0))
      const pct    = line.budgetedTiyin > BigInt(0) ? Number(actual * BigInt(10000) / line.budgetedTiyin) / 100 : 0
      return { accountId: line.accountId, accountName: line.account.name, budgeted: Number(line.budgetedTiyin) / 100, actual: Number(actual) / 100, variance: Number(actual - line.budgetedTiyin) / 100, pctSpent: pct }
    }))
    return { budgetId, name: budget.name, period: budget.period, periodStart: budget.periodStart, periodEnd: budget.periodEnd, lines: actuals }
  }
}
