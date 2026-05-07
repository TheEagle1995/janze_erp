import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  findAll()       { return this.prisma.branch.findMany({ orderBy: { name: 'asc' } }) }
  async findOne(id: string) {
    const b = await this.prisma.branch.findUnique({ where: { id } })
    if (!b) throw new NotFoundException()
    return b
  }
  create(data: any) { return this.prisma.branch.create({ data }) }
  async update(id: string, data: any) {
    await this.findOne(id)
    return this.prisma.branch.update({ where: { id }, data })
  }
}
