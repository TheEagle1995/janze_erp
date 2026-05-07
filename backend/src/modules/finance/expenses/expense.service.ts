import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../../database/prisma.service'
import { JournalService } from '../journals/journal.service'
import Decimal from 'decimal.js'

function decimalToTiyin(d: any): bigint {
  return BigInt(new Decimal(String(d)).times(100).toFixed(0))
}
function tiyinToNumber(t: bigint): number {
  return Number(t) / 100
}

@Injectable()
export class ExpenseService {
  constructor(
    private prisma:  PrismaService,
    private journal: JournalService,
  ) {}

  async findAll(filters: any) {
    const { branchId, status, accountId, dateFrom, dateTo } = filters
    const page  = parseInt(String(filters.page  ?? 1))
    const limit = parseInt(String(filters.limit ?? 20))

    const where: any = {}
    if (branchId)  where.branchId  = branchId
    if (status)    where.status    = status
    if (accountId) where.accountId = accountId
    if (dateFrom || dateTo) {
      where.expenseDate = {}
      if (dateFrom) where.expenseDate.gte = new Date(dateFrom)
      if (dateTo)   where.expenseDate.lte = new Date(dateTo)
    }

    const [expenses, total, agg] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { expenseDate: 'desc' },
        include: { account: { select: { code: true, name: true } } },
      }),
      this.prisma.expense.count({ where }),
      this.prisma.expense.aggregate({ where, _sum: { amountTiyin: true } }),
    ])

    return {
      data:        expenses.map(e => ({ ...e, amount: tiyinToNumber(e.amountTiyin) })),
      meta:        { total, page, limit },
      totalAmount: tiyinToNumber(agg._sum.amountTiyin ?? BigInt(0)),
    }
  }

  async findOne(id: string) {
    const e = await this.prisma.expense.findUnique({
      where:   { id },
      include: { account: true },
    })
    if (!e) throw new NotFoundException('Expense not found')
    return { ...e, amount: tiyinToNumber(e.amountTiyin) }
  }

  async create(dto: any, submittedBy: string) {
    const account = await this.prisma.financeAccount.findUnique({
      where: { id: dto.accountId },
    })
    if (!account) throw new NotFoundException('Finance account not found')
    if (account.type !== 'EXPENSE') {
      throw new BadRequestException('Account must be an EXPENSE type')
    }

    const amountTiyin    = decimalToTiyin(dto.amount)
    const taxAmountTiyin = decimalToTiyin(dto.taxAmount ?? 0)
    if (amountTiyin <= BigInt(0)) {
      throw new BadRequestException('Amount must be greater than zero')
    }

    const count = await this.prisma.expense.count()
    const expenseNumber = `EXP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`

    return this.prisma.expense.create({
      data: {
        expenseNumber,
        branchId:         dto.branchId,
        accountId:        dto.accountId,
        submittedBy,
        description:      dto.description,
        amountTiyin,
        taxAmountTiyin,
        currency:         dto.currency      ?? 'UZS',
        status:           'PENDING',
        category:         dto.category,
        cashFlowCategory: dto.cashFlowCategory ?? 'OPERATING',
        receiptUrl:       dto.receiptUrl    ?? null,
        notes:            dto.notes         ?? null,
        expenseDate:      new Date(dto.expenseDate),
      },
    })
  }

  async approve(id: string, approvedBy: string, dto: any = {}) {
    const e = await this.prisma.expense.findUnique({ where: { id } })
    if (!e) throw new NotFoundException('Expense not found')
    if (e.status !== 'PENDING') throw new ConflictException('Can only approve PENDING expenses')
    if (e.submittedBy === approvedBy) throw new ForbiddenException('Cannot approve your own expense')

    return this.prisma.expense.update({
      where: { id },
      data:  { status: 'APPROVED', approvedBy, approvedAt: new Date() },
    })
  }

  async reject(id: string, rejectedBy: string, dto: { reason?: string } = {}) {
    const e = await this.prisma.expense.findUnique({ where: { id } })
    if (!e) throw new NotFoundException('Expense not found')
    if (!['PENDING', 'APPROVED'].includes(e.status)) {
      throw new ConflictException(`Cannot reject expense with status: ${e.status}`)
    }
    return this.prisma.expense.update({ where: { id }, data: { status: 'REJECTED' } })
  }

  async markPaid(id: string, paidBy: string, paymentNote?: string) {
    const e = await this.prisma.expense.findUnique({
      where:   { id },
      include: { account: true },
    })
    if (!e) throw new NotFoundException('Expense not found')
    if (e.status !== 'APPROVED') {
      throw new ConflictException('Expense must be APPROVED before payment')
    }

    // Find the cash account for the credit side
    const cashAccount = await this.prisma.financeAccount.findFirst({
      where: { code: '1001', isActive: true },
    })

    let journalId: string | null = null
    if (cashAccount) {
      const je = await this.journal.createAndPost({
        branchId:      e.branchId,
        date:          new Date(),
        description:   e.description,
        source:        'EXPENSE',
        referenceId:   id,
        referenceType: 'EXPENSE',
        userId:        paidBy,
        lines: [
          { debitAccountId:  e.accountId,      amountTiyin: e.amountTiyin },
          { creditAccountId: cashAccount.id, amountTiyin: e.amountTiyin },
        ],
      }).catch(() => null)
      journalId = je?.id ?? null
    }

    return this.prisma.expense.update({
      where: { id },
      data:  {
        status:    'PAID',
        paidBy,
        paidAt:    new Date(),
        journalId,
        notes:     paymentNote
          ? `${e.notes ?? ''}\nPayment note: ${paymentNote}`.trim()
          : e.notes,
      },
    })
  }

  async getCategoryBreakdown(filters: any) {
    const { branchId, dateFrom, dateTo } = filters
    const from = dateFrom ? new Date(dateFrom) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const to   = dateTo   ? new Date(dateTo)   : new Date()

    const where: any = {
      status:      { in: ['APPROVED', 'PAID'] },
      expenseDate: { gte: from, lte: to },
    }
    if (branchId) where.branchId = branchId

    const rows = await this.prisma.expense.groupBy({
      by:     ['category', 'accountId'],
      where,
      _sum:   { amountTiyin: true },
      _count: { id: true },
    })

    return rows.map(r => ({
      category:    r.category,
      count:       r._count.id,
      totalAmount: tiyinToNumber(r._sum.amountTiyin ?? BigInt(0)),
    }))
  }
}
