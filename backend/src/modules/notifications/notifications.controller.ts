import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth }                from '@nestjs/swagger'
import { JwtAuthGuard }                          from '../../common/guards/jwt-auth.guard'
import { NotificationsService }                  from './notifications.service'

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  /** Send a Telegram campaign to all bot subscribers */
  @Post('campaign')
  sendCampaign(@Body() body: { message: string; segment?: string }) {
    return this.svc.sendCampaign(body)
  }

  /** Get count of active Telegram subscribers */
  @Get('subscribers')
  getSubscribers() {
    return this.svc.getSubscriberCount()
  }
}
