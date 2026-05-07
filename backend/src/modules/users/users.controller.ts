import { Controller, Get, Post, Put, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { Roles }        from '../../common/decorators/roles.decorator'
import { RolesGuard }   from '../../common/guards/roles.guard'

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private svc: UsersService) {}
  @Get()       findAll(@Query() q: any) { return this.svc.findAll(q) }

  /** Self-service: update own name / email */
  @Patch('me')
  updateMe(@Request() req: any, @Body() body: any) {
    return this.svc.updateProfile(req.user.id, body)
  }

  /** Self-service: change own password */
  @Patch('me/password')
  changeMyPassword(@Request() req: any, @Body() body: any) {
    return this.svc.changePassword(req.user.id, body)
  }

  @Get(':id')  findOne(@Param('id') id: string) { return this.svc.findOne(id) }
  @Post()      @Roles('ADMIN','SUPER_ADMIN') create(@Body() b: any) { return this.svc.create(b) }
  @Put(':id')  @Roles('ADMIN','SUPER_ADMIN') update(@Param('id') id: string, @Body() b: any) { return this.svc.update(id, b) }
}
