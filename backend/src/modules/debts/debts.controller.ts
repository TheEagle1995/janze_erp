import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common'
import { DebtsService }  from './debts.service'
import { JwtAuthGuard }  from '../../common/guards/jwt-auth.guard'
import { RolesGuard }    from '../../common/guards/roles.guard'
import { Roles }         from '../../common/decorators/roles.decorator'

@Controller('debts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DebtsController {
  constructor(private svc: DebtsService) {}

  @Get()
  findAll(@Query() q: any) { return this.svc.findAll(q) }

  @Get('summary')
  summary(@Query('branchId') branchId?: string) { return this.svc.summary(branchId) }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id) }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  create(@Body() body: any, @Req() req: any) {
    return this.svc.create({ ...body, createdBy: req.user?.id })
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() body: any) { return this.svc.update(id, body) }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('id') id: string) { return this.svc.remove(id) }

  @Post(':id/payments')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  addPayment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.svc.addPayment(id, { ...body, createdBy: req.user?.id })
  }

  @Post('mark-overdue')
  @Roles('SUPER_ADMIN', 'ADMIN')
  markOverdue() { return this.svc.markOverdue() }
}
