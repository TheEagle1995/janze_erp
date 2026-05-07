import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../database/prisma.service'
import Decimal from 'decimal.js'

function tiyinToDecimal(t: bigint) {
  return new Decimal(t.toString()).div(100)
}

@Injectable()
export class PLReportService {
  constructor(private prisma: PrismaService) {}

  async generate(filters: {
    branchId?: string
    dateFrom:  string
    dateTo:    string
    currency?: string
  }) {
    const from = new Date(filters.dateFrom)
    const to   = new Date(filters.dateTo + 'T23:59:59')
    const balances = await this.getBalances(filters.branchId ?? null, from, to)

    const sum = (prefixes: string[]) =>
      balances
        .filter(b => prefixes.some(p => b.code.startsWith(p)))
        .reduce((s, b) => s.plus(b.balance), new Decimal(0))

    const grossRevenue = sum(['4001', '4002'])
    const discounts    = sum(['4010']).abs()
    const returns      = sum(['4020']).abs()
    const netRevenue   = grossRevenue.minus(discounts).minus(returns)
    const cogs         = sum(['5'])
    const grossProfit  = netRevenue.minus(cogs)
    const opex         = sum(['6'])
    const ebit         = grossProfit.minus(opex)
    const taxRate      = parseFloat(process.env.VAT_RATE_PCT ?? '12') / 100
    const incomeTax    = ebit.isPositive() ? ebit.times(taxRate) : new Decimal(0)
    const netProfit    = ebit.minus(incomeTax)

    const m = (d: Decimal) => Math.round(d.toNumber())

    return {
      period:     { from, to },
      currency:   filters.currency ?? 'UZS',
      grossRevenue:      m(grossRevenue),
      discounts:         m(discounts),
      returns:           m(returns),
      netRevenue:        m(netRevenue),
      cogs:              m(cogs),
      grossProfit:       m(grossProfit),
      grossMarginPct:    netRevenue.isZero() ? 0 : +grossProfit.div(netRevenue).times(100).toFixed(2),
      operatingExpenses: m(opex),
      ebit:              m(ebit),
      incomeTax:         m(incomeTax),
      taxRate:           taxRate * 100,
      netProfit:         m(netProfit),
      netMarginPct:      netRevenue.isZero() ? 0 : +netProfit.div(netRevenue).times(100).toFixed(2),
    }
  }

  async getMonthlyTrend(branchId: string | null, months = 12) {
    const results = []
    const now = new Date()

    for (let i = months - 1; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const start = new Date(d.getFullYear(), d.getMonth(), 1)
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const b     = await this.getBalances(branchId, start, end)

      const sum = (pfx: string[]) =>
        b.filter(x => pfx.some(p => x.code.startsWith(p)))
         .reduce((s, x) => s + x.balance.toNumber(), 0)

      results.push({
        month:    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        revenue:  Math.round(sum(['4001', '4002'])),
        cogs:     Math.round(sum(['5'])),
        expenses: Math.round(sum(['6'])),
      })
    }
    return results
  }

  // Fetch account balances using Prisma (avoids raw SQL issues)
  private async getBalances(branchId: string | null, from: Date, to: Date) {
    // Get all posted journal entries for the period
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        status: 'POSTED',
        date:   { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      include: { lines: true },
    })

    // Get relevant accounts (REVENUE + EXPENSE)
    const accounts = await this.prisma.financeAccount.findMany({
      where: { isActive: true, type: { in: ['REVENUE', 'EXPENSE'] } },
      orderBy: { sortOrder: 'asc' },
    })

    const debitMap  = new Map<string, bigint>()
    const creditMap = new Map<string, bigint>()

    for (const entry of entries) {
      for (const line of entry.lines) {
        if (line.debitAccountId) {
          debitMap.set(line.debitAccountId, (debitMap.get(line.debitAccountId) ?? BigInt(0)) + line.amountTiyin)
        }
        if (line.creditAccountId) {
          creditMap.set(line.creditAccountId, (creditMap.get(line.creditAccountId) ?? BigInt(0)) + line.amountTiyin)
        }
      }
    }

    return accounts.map(acc => {
      const debits  = debitMap.get(acc.id)  ?? BigInt(0)
      const credits = creditMap.get(acc.id) ?? BigInt(0)
      const balance = acc.type === 'REVENUE'
        ? tiyinToDecimal(credits - debits)
        : tiyinToDecimal(debits - credits)

      return { code: acc.code, type: acc.type, balance: balance.isNegative() ? new Decimal(0) : balance }
    })
  }
}
