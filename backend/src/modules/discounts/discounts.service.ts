import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class DiscountsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.discount.findMany({ orderBy: { createdAt: 'desc' } })
  }

  async findOne(id: string) {
    const d = await this.prisma.discount.findUnique({ where: { id } })
    if (!d) throw new NotFoundException(`Discount ${id} not found`)
    return d
  }

  async findByCode(code: string) {
    const d = await this.prisma.discount.findUnique({ where: { code } })
    if (!d) throw new NotFoundException(`Code ${code} not found`)
    return d
  }

  create(data: any) {
    return this.prisma.discount.create({ data })
  }

  async update(id: string, data: any) {
    await this.findOne(id)
    return this.prisma.discount.update({ where: { id }, data })
  }

  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.discount.delete({ where: { id } })
  }
}
