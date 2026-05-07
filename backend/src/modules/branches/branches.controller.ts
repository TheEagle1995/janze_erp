import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { BranchesService } from './branches.service'
import { JwtAuthGuard }    from '../../common/guards/jwt-auth.guard'

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('branches')
export class BranchesController {
  constructor(private svc: BranchesService) {}
  @Get()       findAll() { return this.svc.findAll() }
  @Get(':id')  findOne(@Param('id') id: string) { return this.svc.findOne(id) }
  @Post()      create(@Body() b: any) { return this.svc.create(b) }
  @Put(':id')  update(@Param('id') id: string, @Body() b: any) { return this.svc.update(id, b) }
}
