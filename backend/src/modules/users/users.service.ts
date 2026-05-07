import { Injectable, NotFoundException, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import * as bcrypt from 'bcrypt'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll(params: { branchId?: string; role?: string } = {}) {
    const where: any = {}
    if (params.branchId) where.branchId = params.branchId
    if (params.role)     where.role     = params.role
    return this.prisma.user.findMany({
      where,
      select: { id:true, name:true, email:true, role:true, branchId:true, isActive:true, lastLogin:true, createdAt:true },
      orderBy: { name: 'asc' },
    })
  }

  async findOne(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: { id:true, name:true, email:true, role:true, branchId:true, isActive:true, createdAt:true, branch: true },
    })
    if (!u) throw new NotFoundException()
    return u
  }

  async create(data: any) {
    const exists = await this.prisma.user.findUnique({ where: { email: data.email } })
    if (exists) throw new ConflictException('Email already in use')
    const passwordHash = await bcrypt.hash(data.password, 12)
    const pin          = data.pin ? await bcrypt.hash(data.pin, 10) : null
    return this.prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash, role: data.role, branchId: data.branchId, pin },
      select: { id:true, name:true, email:true, role:true, branchId:true },
    })
  }

  /** Self-service profile update — only name and email */
  async updateProfile(id: string, data: { name?: string; email?: string }) {
    await this.findOne(id)
    const updateData: any = {}
    if (data.name?.trim())  updateData.name  = data.name.trim()
    if (data.email?.trim()) {
      const conflict = await this.prisma.user.findUnique({ where: { email: data.email.trim() } })
      if (conflict && conflict.id !== id) throw new ConflictException('Email already in use')
      updateData.email = data.email.trim()
    }
    return this.prisma.user.update({
      where: { id },
      data:  updateData,
      select: { id:true, name:true, email:true, role:true, branchId:true, isActive:true, branch: true },
    })
  }

  /** Self-service password change — requires current password verification */
  async changePassword(id: string, data: { currentPassword: string; newPassword: string }) {
    if (!data.newPassword || data.newPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters')
    }
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException()
    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Current password is incorrect')
    await this.prisma.user.update({
      where: { id },
      data:  { passwordHash: await bcrypt.hash(data.newPassword, 12) },
    })
    return { success: true }
  }

  async update(id: string, data: any) {
    await this.findOne(id)
    const updateData: any = {
      name:     data.name,
      role:     data.role,
      isActive: data.isActive,
    }
    if (data.branchId) updateData.branchId     = data.branchId
    if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 12)
    if (data.pin)      updateData.pin          = await bcrypt.hash(data.pin, 10)
    return this.prisma.user.update({
      where: { id },
      data:  updateData,
      select: { id:true, name:true, email:true, role:true, branchId:true, isActive:true },
    })
  }
}
