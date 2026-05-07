import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { CustomersService } from './customers.service'
import { JwtAuthGuard }     from '../../common/guards/jwt-auth.guard'

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private service: CustomersService) {}

  @Get()                        findAll(@Query() q: any) { return this.service.findAll(q) }
  @Get('phone/:phone')          findByPhone(@Param('phone') p: string) { return this.service.findByPhone(p) }
  @Get(':id')                   findOne(@Param('id') id: string) { return this.service.findOne(id) }
  @Get(':id/history')           getHistory(@Param('id') id: string, @Query() q: any) { return this.service.getHistory(id, q) }
  @Post()                       create(@Body() body: any) { return this.service.create(body) }
  @Put(':id')                   update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body) }
  @Post(':id/points')           adjustPoints(@Param('id') id: string, @Body() body: any) {
    return this.service.adjustPoints(id, body.type, body.points, body.description)
  }
}
