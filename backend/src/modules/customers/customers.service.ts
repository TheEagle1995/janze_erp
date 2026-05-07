import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: any) {
    const search = params.search as string | undefined
    const page   = Math.max(1,   parseInt(String(params.page  ?? 1)))
    const limit  = Math.min(200, parseInt(String(params.limit ?? 20)))
    const where: any = {}
    if (params.segment && params.segment !== 'ALL') where.segment = params.segment
    if (search) where.OR = [
      { name:  { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.count({ where }),
    ])
    return { data, meta: { total, page, limit } }
  }

  async findByPhone(phone: string) {
    return this.prisma.customer.findUnique({ where: { phone } })
  }

  async findOne(id: string) {
    const c = await this.prisma.customer.findUnique({ where: { id } })
    if (!c) throw new NotFoundException(`Customer ${id} not found`)
    return c
  }

  private sanitize(data: any) {
    const d: any = {
      name:          String(data.name ?? '').trim(),
      phone:         String(data.phone ?? '').trim(),
      email:         data.email   ? String(data.email).trim()   : null,
      address:       data.address ? String(data.address).trim() : null,
      notes:         data.notes   ? String(data.notes).trim()   : null,
      loyaltyPoints: data.loyaltyPoints !== undefined ? Number(data.loyaltyPoints) : 0,
      discountPct:   data.discountPct   !== undefined ? Number(data.discountPct)   : 0,
      segment:       data.segment ?? 'REGULAR',
    }
    // Convert birthday string "YYYY-MM-DD" → Date
    if (data.birthday) {
      const parsed = new Date(data.birthday)
      d.birthday = isNaN(parsed.getTime()) ? null : parsed
    } else {
      d.birthday = null
    }
    return d
  }

  async create(data: any) {
    const existing = await this.prisma.customer.findUnique({ where: { phone: data.phone } })
    if (existing) throw new ConflictException(`Customer with phone ${data.phone} already exists`)
    return this.prisma.customer.create({ data: this.sanitize(data) })
  }

  async update(id: string, data: any) {
    await this.findOne(id)
    // Check phone uniqueness against other customers
    if (data.phone) {
      const conflict = await this.prisma.customer.findUnique({ where: { phone: String(data.phone).trim() } })
      if (conflict && conflict.id !== id) {
        throw new ConflictException(`Phone ${data.phone} is already used by another customer`)
      }
    }
    try {
      return await this.prisma.customer.update({ where: { id }, data: this.sanitize(data) })
    } catch (err: any) {
      if (err.code === 'P2002') throw new ConflictException('Phone number already in use')
      throw err
    }
  }

  async getHistory(id: string, params: { page?: number; limit?: number }) {
    const { page = 1, limit = 10 } = params
    await this.findOne(id)
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerId: id },
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { variant: { include: { product: true } } } }, payments: true },
      }),
      this.prisma.order.count({ where: { customerId: id } }),
    ])
    return { data: orders, meta: { total, page, limit } }
  }

  async adjustPoints(id: string, type: 'ADD' | 'REDEEM', points: number, description: string) {
    const customer = await this.findOne(id)
    if (type === 'REDEEM' && customer.loyaltyPoints < points) {
      throw new ConflictException('Insufficient loyalty points')
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.customer.update({
        where: { id },
        data:  { loyaltyPoints: type === 'ADD' ? { increment: points } : { decrement: points } },
      }),
      this.prisma.loyaltyTransaction.create({ data: { customerId: id, type, points, description } }),
    ])
    return updated
  }
}
