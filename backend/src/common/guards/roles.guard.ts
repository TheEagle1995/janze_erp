import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '../decorators/roles.decorator'

const HIERARCHY: Record<string, number> = { SUPER_ADMIN: 4, ADMIN: 3, MANAGER: 2, CASHIER: 1 }

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ])
    if (!required || required.length === 0) return true
    const { user } = ctx.switchToHttp().getRequest()
    const userLevel     = HIERARCHY[user?.role] ?? 0
    const requiredLevel = Math.min(...required.map(r => HIERARCHY[r] ?? 0))
    return userLevel >= requiredLevel
  }
}
