import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../../database/prisma.service'

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async getChartOfAccounts(includeInactive = false) {
    const accounts = await this.prisma.financeAccount.findMany({
      where:   includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    const map  = new Map<string, any>()
    const roots: any[] = []
    for (const a of accounts) { map.set(a.id, { ...a, children: [] }) }
    for (const a of accounts) {
      const node = map.get(a.id)!
      a.parentId ? map.get(a.parentId)?.children.push(node) : roots.push(node)
    }
    return roots
  }

  async getByType(type: string) {
    return this.prisma.financeAccount.findMany({
      where: { type: type as any, isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
  }

  async create(data: any) {
    const existing = await this.prisma.financeAccount.findUnique({ where: { code: data.code } })
    if (existing) throw new BadRequestException(`Account code ${data.code} already exists`)
    return this.prisma.financeAccount.create({ data })
  }
}
