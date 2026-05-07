import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { AnalyticsService } from './analytics.service'
import { JwtAuthGuard }     from '../../common/guards/jwt-auth.guard'

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private svc: AnalyticsService) {}

  @Get('dashboard')        dashboard(@Query() q: any)      { return this.svc.getDashboard(q) }
  @Get('sales-chart')      salesChart(@Query() q: any)     { return this.svc.getSalesChart(q) }
  @Get('top-products')     topProducts(@Query() q: any)    { return this.svc.getTopProducts(q) }
  @Get('slow-movers')      slowMovers(@Query() q: any)     { return this.svc.getSlowMovers(q) }
  @Get('by-employee')      byEmployee(@Query() q: any)     { return this.svc.getByEmployee(q) }
  @Get('profit-loss')      profitLoss(@Query() q: any)     { return this.svc.getProfitLoss(q) }
  @Get('payment-methods')  paymentMethods(@Query() q: any) { return this.svc.getPaymentMethods(q) }
  @Get('by-branch')        byBranch(@Query() q: any)       { return this.svc.getByBranch(q) }
  @Get('hourly-stats')     hourlyStats(@Query() q: any)    { return this.svc.getHourlyStats(q) }
  @Get('weekday-stats')    weekdayStats(@Query() q: any)   { return this.svc.getWeekdayStats(q) }
}
