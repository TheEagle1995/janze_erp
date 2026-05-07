import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { OrdersService }  from './orders.service'
import { JwtAuthGuard }   from '../../common/guards/jwt-auth.guard'

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private service: OrdersService) {}

  @Post()           @ApiOperation({ summary: 'Create order (POS checkout)' })
  create(@Body() dto: any, @Request() req: any) { return this.service.create(dto, req.user.id) }

  @Get()            @ApiOperation({ summary: 'List orders' })
  findAll(@Query() q: any) { return this.service.findAll(q) }

  @Get(':id')       @ApiOperation({ summary: 'Get order detail' })
  findOne(@Param('id') id: string) { return this.service.findOne(id) }

  @Patch(':id') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Edit a PENDING order' })
  update(@Param('id') id: string, @Body() dto: any, @Request() req: any) { return this.service.update(id, dto, req.user.id) }

  @Post(':id/refund') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Refund order' })
  refund(@Param('id') id: string, @Request() req: any) { return this.service.refund(id, req.user.id) }

  @Patch(':id/finalize') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Finalize/deliver order → COMPLETED' })
  finalize(@Param('id') id: string, @Request() req: any) { return this.service.finalize(id, req.user.id) }

  @Patch(':id/cancel') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Cancel order → VOID' })
  cancel(@Param('id') id: string, @Request() req: any) { return this.service.cancel(id, req.user.id) }

  @Post('sync-offline') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Sync offline orders' })
  syncOffline(@Body() body: { orders: any[] }, @Request() req: any) {
    return this.service.syncOffline(body.orders, req.user.id)
  }
}
