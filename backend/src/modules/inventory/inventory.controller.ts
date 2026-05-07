import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { InventoryService } from './inventory.service'
import { JwtAuthGuard }     from '../../common/guards/jwt-auth.guard'
import { RolesGuard }       from '../../common/guards/roles.guard'

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private service: InventoryService) {}

  @Get()                  findAll(@Query() q: any) { return this.service.getInventory(q) }
  @Get('low-stock')       getLowStock(@Query('branchId') b?: string) { return this.service.getLowStock(b) }
  @Get('movements')       getMovements(@Query() q: any) { return this.service.getMovements(q) }

  @Patch('adjust')
  adjust(@Body() body: any, @Request() req: any) {
    return this.service.adjust(body.variantId, body.branchId, body.quantity, body.note ?? '', req.user.id, body.type)
  }

  @Post('transfer')
  transfer(@Body() body: any, @Request() req: any) {
    return this.service.transfer(body.variantId, body.fromBranchId, body.toBranchId, body.quantity, req.user.id)
  }
}
