import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../database/prisma.service'
import * as bcrypt from 'bcrypt'

@Injectable()
export class AuthService {
  constructor(
    private prisma:  PrismaService,
    private jwt:     JwtService,
    private config:  ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, include: { branch: true } })
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials')
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Invalid credentials')
    return user
  }

  async validatePin(branchId: string, pin: string) {
    const users = await this.prisma.user.findMany({
      where: { branchId, isActive: true, pin: { not: null } },
      include: { branch: true },
    })
    for (const user of users) {
      if (user.pin && await bcrypt.compare(pin, user.pin)) return user
    }
    throw new UnauthorizedException('Invalid PIN')
  }

  async login(user: any) {
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })
    const payload = { sub: user.id, email: user.email, role: user.role, branchId: user.branchId }
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload),
      this.jwt.signAsync(payload, {
        secret:     this.config.get('JWT_REFRESH_SECRET'),
        expiresIn:  this.config.get('JWT_REFRESH_EXPIRES_IN', '30d'),
      }),
    ])

    // Store refresh token
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)
    await this.prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } })

    return {
      accessToken, refreshToken,
      user: {
        id:       user.id,
        name:     user.name,
        email:    user.email,
        role:     user.role,
        branchId: user.branchId,
        branch:   user.branch,
      },
    }
  }

  async refresh(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({ where: { token } })
    if (!stored || stored.expiresAt < new Date()) throw new UnauthorizedException('Invalid or expired refresh token')

    let payload: any
    try {
      payload = await this.jwt.verifyAsync(token, { secret: this.config.get('JWT_REFRESH_SECRET') })
    } catch { throw new UnauthorizedException('Invalid refresh token') }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { branch: true } })
    if (!user?.isActive) throw new UnauthorizedException()

    await this.prisma.refreshToken.delete({ where: { token } })
    return this.login(user)
  }

  async logout(token: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token } })
  }
}
