import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../../../database/prisma.service'
import Decimal from 'decimal.js'

function tiyinToDecimal(t: bigint) {
  return new Decimal(t.toString()).div(100)
}
function decimalToTiyin(d: any): bigint {
  return BigInt(new Decimal(String(d)).times(100).toFixed(0))
}

@Injectable()
export class JournalService {
  private readonly logger = new Logger(JournalService.name)
  constructor(private prisma: PrismaService) {}

  /** Auto-create journal entry whenever an order is finalized */
  @OnEvent('order.completed')
  async handleOrderCompleted({ order, cashierId }: any) {
    try {
      // Fetch full order with items, payments, branch
      const full = await this.prisma.order.findUnique({
        where:   { id: order.id },
        include: {
          items:    { select: { unitCost: true, quantity: true, lineTotal: true } },
          payments: { select: { method: true, amount: true } },
          branch:   { select: { brand: true } },
        },
      })
      if (!full) return

      const brand = full.branch?.brand ?? 'AVERO'

      // Sum payments by type (DEBT amounts are receivables, not cash/card inflow)
      const cashAmount     = full.payments.filter(p => p.method === 'CASH')
        .reduce((s, p) => s + Number(p.amount), 0)
      const cardAmount     = full.payments.filter(p => p.method === 'CARD' || p.method === 'TRANSFER')
        .reduce((s, p) => s + Number(p.amount), 0)
      const revenueAmount  = Number(full.total)
      const discountAmount = Number(full.discountTotal ?? 0)
      const cogsAmount     = full.items.reduce((s, i) => s + Number(i.unitCost) * Number(i.quantity), 0)

      await this.createSaleEntry({
        orderId:        full.id,
        branchId:       full.branchId,
        orderDate:      full.createdAt.toISOString(),
        orderNumber:    full.orderNumber,
        brand,
        cashAmount,
        cardAmount,
        revenueAmount,
        discountAmount,
        taxAmount:      0,
        cogsAmount,
        userId:         cashierId,
      })
    } catch (err: any) {
      // Never block a sale for a finance journal failure — just log it
      this.logger.error(`Failed to create journal entry for order ${order.id}: ${err.message}`)
    }
  }

  async createAndPost(params: {
    branchId:      string
    date:          Date
    description:   string
    source:        string
    referenceId?:  string
    referenceType?: string
    currency?:     string
    notes?:        string
    userId?:       string
    lines:         Array<{
      debitAccountId?:  string
      creditAccountId?: string
      amountTiyin:      bigint
      description?:     string
      taxAmount?:       bigint
    }>
  }) {
    this.validateBalance(params.lines)

    const entryNumber = await this.generateEntryNumber()

    return this.prisma.journalEntry.create({
      data: {
        entryNumber,
        branchId:      params.branchId,
        date:          params.date,
        description:   params.description,
        status:        'POSTED',
        source:        params.source as any,
        referenceId:   params.referenceId   ?? null,
        referenceType: params.referenceType ?? null,
        currency:      params.currency      ?? 'UZS',
        notes:         params.notes         ?? null,
        postedAt:      new Date(),
        postedBy:      params.userId        ?? null,
        lines: {
          create: params.lines.map((l, idx) => ({
            debitAccountId:  l.debitAccountId  ?? null,
            creditAccountId: l.creditAccountId ?? null,
            amountTiyin:     l.amountTiyin,
            description:     l.description     ?? null,
            taxAmount:       l.taxAmount        ?? BigInt(0),
            lineOrder:       idx,
          })),
        },
      },
      include: { lines: true },
    })
  }

  async voidEntry(journalId: string, reason: string, userId: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where:   { id: journalId },
      include: { lines: true },
    })
    if (!entry) throw new NotFoundException('Journal entry not found')
    if (entry.status !== 'POSTED') {
      throw new BadRequestException('Only POSTED entries can be voided')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.journalEntry.update({
        where: { id: journalId },
        data:  { status: 'VOIDED', voidedAt: new Date(), voidedBy: userId, voidReason: reason },
      })

      const revNum = await this.generateEntryNumber()
      await tx.journalEntry.create({
        data: {
          entryNumber:   revNum,
          branchId:      entry.branchId,
          date:          new Date(),
          description:   `VOID: ${entry.description}`,
          status:        'POSTED',
          source:        entry.source,
          postedAt:      new Date(),
          postedBy:      userId,
          lines: {
            create: entry.lines.map((l, idx) => ({
              debitAccountId:  l.creditAccountId,
              creditAccountId: l.debitAccountId,
              amountTiyin:     l.amountTiyin,
              lineOrder:       idx,
            })),
          },
        },
      })
    })

    return this.prisma.journalEntry.findUnique({ where: { id: journalId } })
  }

  async getEntries(filters: {
    branchId?: string
    source?:   string
    status?:   string
    dateFrom?: string
    dateTo?:   string
    page?:     number | string
    limit?:    number | string
  }) {
    const { branchId, source, status, dateFrom, dateTo } = filters
    const page  = parseInt(String(filters.page  ?? 1))
    const limit = parseInt(String(filters.limit ?? 20))

    const where: any = {}
    if (branchId) where.branchId = branchId
    if (source)   where.source   = source
    if (status)   where.status   = status
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date.gte = new Date(dateFrom)
      if (dateTo)   where.date.lte = new Date(dateTo)
    }

    const [entries, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { date: 'desc' },
        include: { lines: true },
      }),
      this.prisma.journalEntry.count({ where }),
    ])
    return { data: entries, meta: { total, page, limit } }
  }

  async getTrialBalance(branchId: string | null, asOf: Date) {
    // Get all accounts with their posted balances
    const accounts = await this.prisma.financeAccount.findMany({
      where:   { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        debitLines: {
          include: {
            journal: {
              select: { status: true, date: true, branchId: true },
            },
          },
        },
        creditLines: {
          include: {
            journal: {
              select: { status: true, date: true, branchId: true },
            },
          },
        },
      },
    })

    return accounts.map(acc => {
      const filterJournal = (j: any) =>
        j.journal.status === 'POSTED' &&
        j.journal.date <= asOf &&
        (!branchId || j.journal.branchId === branchId)

      const debits  = acc.debitLines.filter(filterJournal)
        .reduce((s, l) => s + l.amountTiyin, BigInt(0))
      const credits = acc.creditLines.filter(filterJournal)
        .reduce((s, l) => s + l.amountTiyin, BigInt(0))

      const isDebitNormal = ['ASSET', 'EXPENSE'].includes(acc.type)
      const balance = isDebitNormal
        ? tiyinToDecimal(debits - credits)
        : tiyinToDecimal(credits - debits)

      return {
        accountCode: acc.code,
        accountName: acc.name,
        type:        acc.type,
        balance:     balance.toNumber(),
      }
    }).filter(a => a.balance !== 0)
  }

  async createSaleEntry(params: {
    orderId:        string
    branchId:       string
    orderDate:      string
    orderNumber:    string
    brand:          string
    cashAmount:     number
    cardAmount:     number
    revenueAmount:  number
    discountAmount: number
    taxAmount:      number
    cogsAmount:     number
    userId:         string
  }) {
    const accountCodes = ['4001','4002','4010','2010','1001','1010','5001','5002','1031','1032']
    const accounts = await this.prisma.financeAccount.findMany({
      where: { code: { in: accountCodes }, isActive: true },
    })
    const am = new Map(accounts.map(a => [a.code, a]))

    const revenueCode   = params.brand === 'AVERO' ? '4001' : '4002'
    const cogsCode      = params.brand === 'AVERO' ? '5001' : '5002'
    const inventoryCode = params.brand === 'AVERO' ? '1031' : '1032'

    const lines: any[] = []

    if (params.cashAmount > 0 && am.get('1001')) {
      lines.push({ debitAccountId: am.get('1001')!.id, amountTiyin: decimalToTiyin(params.cashAmount) })
    }
    if (params.cardAmount > 0 && am.get('1010')) {
      lines.push({ debitAccountId: am.get('1010')!.id, amountTiyin: decimalToTiyin(params.cardAmount) })
    }
    if (params.revenueAmount > 0 && am.get(revenueCode)) {
      lines.push({ creditAccountId: am.get(revenueCode)!.id, amountTiyin: decimalToTiyin(params.revenueAmount) })
    }
    if (params.taxAmount > 0 && am.get('2010')) {
      lines.push({ creditAccountId: am.get('2010')!.id, amountTiyin: decimalToTiyin(params.taxAmount) })
    }
    if (params.discountAmount > 0 && am.get('4010')) {
      lines.push({ debitAccountId: am.get('4010')!.id, amountTiyin: decimalToTiyin(params.discountAmount) })
    }
    if (params.cogsAmount > 0 && am.get(cogsCode) && am.get(inventoryCode)) {
      lines.push({ debitAccountId: am.get(cogsCode)!.id, amountTiyin: decimalToTiyin(params.cogsAmount) })
      lines.push({ creditAccountId: am.get(inventoryCode)!.id, amountTiyin: decimalToTiyin(params.cogsAmount) })
    }

    if (lines.length < 2) return null

    try {
      // Verify balance before posting
      let d = BigInt(0), c = BigInt(0)
      for (const l of lines) {
        if (l.debitAccountId)  d += l.amountTiyin
        if (l.creditAccountId) c += l.amountTiyin
      }
      if (d !== c) return null  // Skip unbalanced entries (e.g. missing accounts)

      return await this.createAndPost({
        branchId:      params.branchId,
        date:          new Date(params.orderDate),
        description:   `Sale — ${params.orderNumber}`,
        source:        'SALE',
        referenceId:   params.orderId,
        referenceType: 'ORDER',
        userId:        params.userId,
        lines,
      })
    } catch {
      return null  // Never block a sale for a finance issue
    }
  }

  private validateBalance(lines: any[]) {
    if (!lines?.length) {
      throw new BadRequestException('Journal entry must have at least one line')
    }
    let debits = BigInt(0), credits = BigInt(0)
    for (const l of lines) {
      if (!l.debitAccountId && !l.creditAccountId) {
        throw new BadRequestException('Each line needs a debit or credit account')
      }
      if (l.debitAccountId)  debits  += l.amountTiyin
      if (l.creditAccountId) credits += l.amountTiyin
    }
    if (debits !== credits) {
      throw new BadRequestException(
        `Unbalanced journal entry: debits ${debits} ≠ credits ${credits}`,
      )
    }
  }

  private async generateEntryNumber(): Promise<string> {
    const now    = new Date()
    const prefix = `JE-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    const count  = await this.prisma.journalEntry.count({
      where: { entryNumber: { startsWith: prefix } },
    })
    return `${prefix}-${String(count + 1).padStart(5, '0')}`
  }
}
