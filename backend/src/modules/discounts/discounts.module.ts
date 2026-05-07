import { Module } from '@nestjs/common'
import { DiscountsService }    from './discounts.service'
import { DiscountsController } from './discounts.controller'
import { DatabaseModule }      from '../../database/database.module'

@Module({
  imports:     [DatabaseModule],
  providers:   [DiscountsService],
  controllers: [DiscountsController],
  exports:     [DiscountsService],
})
export class DiscountsModule {}
