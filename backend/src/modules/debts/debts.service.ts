import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { Cron, CronExpression } from '@nestjs/schedule'

@Injectable()
export class DebtsService {
  private readonly logger = new Logger(DebtsService.name)
  constructor(private prisma: PrismaService) {}

  /** Run at midnight every day — flip UNPAID/PARTIAL debts past due date to OVERDUE */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async autoMarkOverdue() {
    const updated = await this.markOverdue()
    if (updated.count > 0) {
      this.logger.log(`Marked ${updated.count} debt(s) as OVERDUE`)
    }
  }

  // ── List ──────────────────────────────────────────────────────
  async findAll(params: {
    search?: string
    status?: string
    branchId?: string
    page?: number
    limit?: number
  }) {
    const page  = Math.max(1, Number(params.page  ?? 1))
    const limit = Math.min(100, Number(params.limit ?? 20))
    const skip  = (page - 1) * limit

    const where: any = {}
    if (params.branchId) where.branchId = params.branchId
    if (params.status)   where.status   = params.status
    if (params.search) {
      where.OR = [
        { customerName: { contains: params.search, mode: 'insensitive' } },
        { phone:        { contains: params.search } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.debt.findMany({
        where,
        include: { payments: { orderBy: { paidAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.debt.count({ where }),
    ])

    return { data, meta: { total, page, limit, lastPage: Math.ceil(total / limit) } }
  }

  // ── Get one ───────────────────────────────────────────────────
  async findOne(id: string) {
    const debt = await this.prisma.debt.findUnique({
      where:   { id },
      include: { payments: { orderBy: { paidAt: 'desc' } }, customer: true },
    })
    if (!debt) throw new NotFoundException(`Debt ${id} not found`)
    return debt
  }

  // ── Create ────────────────────────────────────────────────────
  create(data: any) {
    const { amount, currency = 'UZS', dueDate, customerName, phone,
            customerId, description, notes, branchId, createdBy } = data

    return this.prisma.debt.create({
      data: {
        customerName, phone: phone || null,
        customerId:   customerId || null,
        amount,
        paid:         0,
        currency,
        dueDate:      dueDate ? new Date(dueDate) : null,
        status:       'UNPAID',
        description:  description || null,
        notes:        notes || null,
        branchId:     branchId || null,
        createdBy:    createdBy || null,
      },
      include: { payments: true },
    })
  }

  // ── Update ────────────────────────────────────────────────────
  async update(id: string, data: any) {
    await this.findOne(id)
    const { customerName, phone, amount, currency, dueDate, description, notes } = data
    return this.prisma.debt.update({
      where: { id },
      data:  {
        customerName, phone, amount, currency,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        description, notes,
      },
      include: { payments: true },
    })
  }

  // ── Delete ────────────────────────────────────────────────────
  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.debt.delete({ where: { id } })
  }

  // ── Add payment ───────────────────────────────────────────────
  async addPayment(debtId: string, payment: any) {
    const debt = await this.findOne(debtId)

    const payAmount = Number(payment.amount)
    const remaining = Number(debt.amount) - Number(debt.paid)

    if (payAmount <= 0)         throw new BadRequestException('Payment amount must be positive')
    if (payAmount > remaining)  throw new BadRequestException(`Payment exceeds remaining: ${remaining}`)

    const newPaid = Number(debt.paid) + payAmount
    const newStatus =
      newPaid >= Number(debt.amount) ? 'PAID'
      : newPaid > 0                  ? 'PARTIAL'
      : 'UNPAID'

    const [p] = await this.prisma.$transaction([
      this.prisma.debtPayment.create({
        data: {
          debtId,
          amount:    payAmount,
          method:    payment.method ?? 'CASH',
          paidAt:    payment.paidAt ? new Date(payment.paidAt) : new Date(),
          notes:     payment.notes || null,
          createdBy: payment.createdBy || null,
        },
      }),
      this.prisma.debt.update({
        where: { id: debtId },
        data:  { paid: newPaid, status: newStatus },
      }),
    ])

    return p
  }

  // ── Summary ───────────────────────────────────────────────────
  async summary(branchId?: string) {
    const where: any = branchId ? { branchId } : {}

    const [total, overdue, partial] = await Promise.all([
      this.prisma.debt.aggregate({ where,                         _sum: { amount: true, paid: true } }),
      this.prisma.debt.aggregate({ where: { ...where, status: 'OVERDUE',  }, _sum: { amount: true } }),
      this.prisma.debt.aggregate({ where: { ...where, status: 'PARTIAL'  }, _sum: { amount: true } }),
    ])

    return {
      totalAmount:    Number(total._sum.amount   ?? 0),
      totalPaid:      Number(total._sum.paid     ?? 0),
      totalRemaining: Number(total._sum.amount   ?? 0) - Number(total._sum.paid ?? 0),
      overdueAmount:  Number(overdue._sum.amount ?? 0),
      partialAmount:  Number(partial._sum.amount ?? 0),
    }
  }

  // ── Auto-update overdue status ────────────────────────────────
  async markOverdue() {
    const updated = await this.prisma.debt.updateMany({
      where: {
        status:  { in: ['UNPAID', 'PARTIAL'] },
        dueDate: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    })
    return updated
  }
}
