import { Module } from '@nestjs/common'
import { DebtsService }    from './debts.service'
import { DebtsController } from './debts.controller'
import { DatabaseModule }  from '../../database/database.module'

@Module({
  imports:     [DatabaseModule],
  providers:   [DebtsService],
  controllers: [DebtsController],
  exports:     [DebtsService],
})
export class DebtsModule {}
