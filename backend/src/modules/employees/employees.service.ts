import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  // ── List ──────────────────────────────────────────────────────
  async findAll(params: { search?: string; branchId?: string; isActive?: string }) {
    const where: any = {}
    if (params.branchId) where.branchId = params.branchId
    if (params.isActive !== undefined)
      where.isActive = params.isActive !== 'false'
    if (params.search) {
      where.OR = [
        { name:  { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search } },
      ]
    }

    return this.prisma.employee.findMany({
      where,
      include: { attendance: { orderBy: { checkIn: 'desc' }, take: 1 } },
      orderBy: { name: 'asc' },
    })
  }

  // ── Get one ───────────────────────────────────────────────────
  async findOne(id: string) {
    const e = await this.prisma.employee.findUnique({
      where:   { id },
      include: { attendance: { orderBy: { checkIn: 'desc' }, take: 30 } },
    })
    if (!e) throw new NotFoundException(`Employee ${id} not found`)
    return e
  }

  // ── Create ────────────────────────────────────────────────────
  create(data: any) {
    const { name, role, phone, email, salary, branchId, hireDate, notes } = data
    return this.prisma.employee.create({
      data: {
        name, role: role ?? 'CASHIER',
        phone: phone || null,
        email: email || null,
        salary: salary ? Number(salary) : null,
        branchId: branchId || null,
        hireDate: hireDate ? new Date(hireDate) : null,
        notes: notes || null,
      },
    })
  }

  // ── Update ────────────────────────────────────────────────────
  async update(id: string, data: any) {
    await this.findOne(id)
    const { name, role, phone, email, salary, branchId, hireDate, isActive, notes } = data
    return this.prisma.employee.update({
      where: { id },
      data:  {
        name, role, phone, email,
        salary: salary !== undefined ? Number(salary) : undefined,
        branchId, isActive,
        hireDate: hireDate ? new Date(hireDate) : undefined,
        notes,
      },
    })
  }

  // ── Check-in ──────────────────────────────────────────────────
  async checkIn(employeeId: string, notes?: string) {
    await this.findOne(employeeId)

    // Check if already checked in today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const existing = await this.prisma.attendanceLog.findFirst({
      where: {
        employeeId,
        checkIn:  { gte: today },
        checkOut: null,
      },
    })
    if (existing) throw new BadRequestException('Already checked in today')

    const now = new Date()
    // Determine status: late if after 09:30
    const status = now.getHours() >= 9 && now.getMinutes() > 30 ? 'LATE' : 'PRESENT'

    return this.prisma.attendanceLog.create({
      data: { employeeId, checkIn: now, status, notes: notes || null, date: today },
    })
  }

  // ── Check-out ─────────────────────────────────────────────────
  async checkOut(employeeId: string, notes?: string) {
    const log = await this.prisma.attendanceLog.findFirst({
      where: { employeeId, checkOut: null },
      orderBy: { checkIn: 'desc' },
    })
    if (!log) throw new BadRequestException('Not checked in')

    const now   = new Date()
    const hours = (now.getTime() - log.checkIn.getTime()) / 3_600_000

    return this.prisma.attendanceLog.update({
      where: { id: log.id },
      data:  { checkOut: now, hoursWorked: Math.round(hours * 100) / 100, notes: notes || null },
    })
  }

  // ── Timesheet ─────────────────────────────────────────────────
  async timesheet(employeeId: string, dateFrom?: string, dateTo?: string) {
    await this.findOne(employeeId)
    const where: any = { employeeId }
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date.gte = new Date(dateFrom)
      if (dateTo)   where.date.lte = new Date(dateTo)
    }
    return this.prisma.attendanceLog.findMany({ where, orderBy: { checkIn: 'desc' } })
  }

  // ── Performance (sales linked by branchId for now) ────────────
  async performance(employeeId: string, dateFrom?: string, dateTo?: string) {
    // Returns order stats for the employee's branch as a proxy
    const emp = await this.findOne(employeeId)
    const where: any = { branchId: emp.branchId }
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo)   where.createdAt.lte = new Date(dateTo)
    }
    where.status = 'COMPLETED'

    const stats = await this.prisma.order.aggregate({
      where,
      _count: { id: true },
      _sum:   { total: true },
    })

    return {
      salesCount: stats._count.id,
      revenue:    Number(stats._sum.total ?? 0),
      avgSale:    stats._count.id > 0 ? Number(stats._sum.total ?? 0) / stats._count.id : 0,
    }
  }

  // ── Delete ────────────────────────────────────────────────────
  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.employee.delete({ where: { id } })
  }
}
