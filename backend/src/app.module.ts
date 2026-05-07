import { Module }        from '@nestjs/common'
import { ConfigModule }  from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { DatabaseModule }     from './database/database.module'
import { AuthModule }         from './modules/auth/auth.module'
import { UsersModule }        from './modules/users/users.module'
import { BranchesModule }     from './modules/branches/branches.module'
import { ProductsModule }     from './modules/products/products.module'
import { InventoryModule }    from './modules/inventory/inventory.module'
import { OrdersModule }       from './modules/orders/orders.module'
import { CustomersModule }    from './modules/customers/customers.module'
import { AnalyticsModule }    from './modules/analytics/analytics.module'
import { SuppliersModule }    from './modules/suppliers/suppliers.module'
import { FinanceModule }      from './modules/finance/finance.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { DiscountsModule }     from './modules/discounts/discounts.module'
import { DebtsModule }         from './modules/debts/debts.module'
import { EmployeesModule }     from './modules/employees/employees.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    BranchesModule,
    ProductsModule,
    InventoryModule,
    OrdersModule,
    CustomersModule,
    AnalyticsModule,
    SuppliersModule,
    FinanceModule,
    NotificationsModule,
    DiscountsModule,
    DebtsModule,
    EmployeesModule,
  ],
})
export class AppModule {}
