import { Module } from '@nestjs/common'
import { EmployeesService }    from './employees.service'
import { EmployeesController } from './employees.controller'
import { DatabaseModule }      from '../../database/database.module'

@Module({
  imports:     [DatabaseModule],
  providers:   [EmployeesService],
  controllers: [EmployeesController],
  exports:     [EmployeesService],
})
export class EmployeesModule {}
