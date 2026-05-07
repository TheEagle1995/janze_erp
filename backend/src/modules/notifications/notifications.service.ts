import { Injectable, Logger } from '@nestjs/common'
import { OnEvent }            from '@nestjs/event-emitter'
import { ConfigService }      from '@nestjs/config'
import { PrismaService }      from '../../database/prisma.service'
import axios                  from 'axios'

export interface CampaignResult {
  sent:   number
  failed: number
  errors: string[]
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private config:  ConfigService,
    private prisma:  PrismaService,
  ) {}

  @OnEvent('order.completed')
  async handleOrderCompleted({ order, cashierId }: any) {
    const total     = Number(order.total)
    const threshold = Number(this.config.get('LARGE_ORDER_THRESHOLD', 1_000_000))

    if (total >= threshold) {
      await this.notifyBot('large-order', {
        orderNumber:   order.orderNumber,
        branchId:      order.branchId,
        cashierId,
        total,
        itemCount:     order.items?.length ?? 0,
        paymentMethod: order.payments?.[0]?.method ?? 'CASH',
      })
    }

    // Finance journal entry is auto-created by JournalService (@OnEvent handler)
  }

  @OnEvent('order.refunded')
  async handleOrderRefunded({ order, userId }: any) {
    await this.notifyBot('order-refunded', {
      orderId:      order.id,
      orderNumber:  order.orderNumber,
      branchId:     order.branchId,
      refundAmount: Number(order.total),
      userId,
    })
  }

  private async notifyBot(event: string, payload: any) {
    const url = this.config.get('TELEGRAM_BOT_INTERNAL_URL')
    if (!url) return

    try {
      await axios.post(`${url}/internal/${event}`, payload, {
        headers:  { 'X-Internal-Key': this.config.get('API_INTERNAL_KEY', '') },
        timeout:  3000,
      })
    } catch (err: any) {
      this.logger.warn(`Failed to notify bot for ${event}: ${err.message}`)
    }
  }

  /**
   * Send a Telegram marketing campaign to BotAdmin subscribers.
   * Falls back to a direct Telegram Bot API call if the internal bot URL is not configured.
   */
  async sendCampaign(dto: {
    message:  string
    segment?: string   // 'ALL' | 'VIP' | 'REGULAR' | 'INACTIVE'
    botToken?: string  // override from env if provided
  }): Promise<CampaignResult> {
    const result: CampaignResult = { sent: 0, failed: 0, errors: [] }

    // Get all active bot admins
    const admins = await this.prisma.botAdmin.findMany({ where: { isActive: true } })

    if (!admins.length) {
      result.errors.push('No active Telegram subscribers found in bot_admins table.')
      return result
    }

    const token = dto.botToken ?? this.config.get<string>('TELEGRAM_BOT_TOKEN', '')
    if (!token) {
      result.errors.push('TELEGRAM_BOT_TOKEN is not configured. Set it in backend/.env')
      return result
    }

    // Compose message with optional segment label
    const segmentLabel = dto.segment && dto.segment !== 'ALL' ? `[${dto.segment} customers]\n\n` : ''
    const text = `📣 *Campaign Message*\n\n${segmentLabel}${dto.message}`

    for (const admin of admins) {
      try {
        await axios.post(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            chat_id:    admin.telegramId,
            text,
            parse_mode: 'Markdown',
          },
          { timeout: 8000 },
        )
        result.sent++
        // Update lastActiveAt
        await this.prisma.botAdmin.update({ where: { id: admin.id }, data: { lastActiveAt: new Date() } })
      } catch (err: any) {
        result.failed++
        result.errors.push(`@${admin.telegramUsername ?? admin.telegramId}: ${err.message}`)
      }
    }

    this.logger.log(`Campaign sent: ${result.sent} ok, ${result.failed} failed`)
    return result
  }

  /** Get subscriber count */
  async getSubscriberCount() {
    const total  = await this.prisma.botAdmin.count({ where: { isActive: true } })
    const byRole = await this.prisma.botAdmin.groupBy({ by: ['role'], _count: { id: true } })
    return { total, byRole }
  }
}
