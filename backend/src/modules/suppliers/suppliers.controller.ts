import { Controller, Get, Post, Put, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { SuppliersService } from './suppliers.service'
import { JwtAuthGuard }     from '../../common/guards/jwt-auth.guard'

@ApiTags('Suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private svc: SuppliersService) {}

  @Get()                      findAll() { return this.svc.findAll() }
  @Get('insights')            insights() { return this.svc.getProductInsights() }
  @Get('purchase-orders')     getPOs(@Query() q: any) { return this.svc.getPOs(q) }
  @Get(':id')                 findOne(@Param('id') id: string) { return this.svc.findOne(id) }
  @Post()                     create(@Body() b: any) { return this.svc.create(b) }
  @Put(':id')                 update(@Param('id') id: string, @Body() b: any) { return this.svc.update(id, b) }
  @Post(':id/purchase-orders')   createPO(@Param('id') id: string, @Body() b: any) { return this.svc.createPO(id, b) }
  @Patch('purchase-orders/:id/receive') receivePO(@Param('id') id: string) { return this.svc.receivePO(id) }
}
