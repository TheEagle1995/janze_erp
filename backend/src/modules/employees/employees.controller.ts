import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common'
import { EmployeesService } from './employees.service'
import { JwtAuthGuard }     from '../../common/guards/jwt-auth.guard'
import { RolesGuard }       from '../../common/guards/roles.guard'
import { Roles }            from '../../common/decorators/roles.decorator'

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private svc: EmployeesService) {}

  @Get()
  findAll(@Query() q: any) { return this.svc.findAll(q) }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id) }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Body() body: any) { return this.svc.create(body) }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() body: any) { return this.svc.update(id, body) }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('id') id: string) { return this.svc.remove(id) }

  @Post(':id/check-in')
  checkIn(@Param('id') id: string, @Body('notes') notes?: string) { return this.svc.checkIn(id, notes) }

  @Post(':id/check-out')
  checkOut(@Param('id') id: string, @Body('notes') notes?: string) { return this.svc.checkOut(id, notes) }

  @Get(':id/timesheet')
  timesheet(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) { return this.svc.timesheet(id, from, to) }

  @Get(':id/performance')
  performance(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) { return this.svc.performance(id, from, to) }
}
