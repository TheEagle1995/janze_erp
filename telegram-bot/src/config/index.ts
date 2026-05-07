export const config = {
  bot: {
    token:         process.env.BOT_TOKEN!,
    mode:          (process.env.BOT_MODE ?? 'polling') as 'polling' | 'webhook',
    webhookUrl:    process.env.WEBHOOK_URL,
    webhookSecret: process.env.WEBHOOK_SECRET,
    port:          parseInt(process.env.BOT_PORT ?? '8080'),
  },
  admin: { registrationCode: process.env.ADMIN_REGISTRATION_CODE ?? 'CHANGE-ME' },
  api: {
    baseUrl:     process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1',
    internalKey: process.env.API_INTERNAL_KEY ?? '',
  },
  db: { url: process.env.DATABASE_URL! },
  redis: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
  alerts: { largeOrderThreshold: parseInt(process.env.LARGE_ORDER_THRESHOLD ?? '1000000') },
}
