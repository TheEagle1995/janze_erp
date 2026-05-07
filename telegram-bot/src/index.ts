import { Telegraf, session } from 'telegraf'
import { config }     from './config'
import { logger }     from './utils/logger'
import { initDatabase, adminDb } from './database'
import { getRedis, closeRedis, sessionStore, rateLimiter } from './database/redis'
import { analyticsService, productService, customerService } from './services/api.service'
import { fmt }        from './utils/format'
import cron           from 'node-cron'
import express        from 'express'

const bot = new Telegraf(config.bot.token)

// ── Rate limit middleware ─────────────────────────────────────────────────────
bot.use(async (ctx, next) => {
  const id = ctx.from?.id?.toString()
  if (id) {
    const { allowed } = await rateLimiter.check(id)
    if (!allowed) return ctx.reply('Too many requests. Please wait.').catch(() => {})
  }
  return next()
})

// ── /start ───────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  const tid   = ctx.from.id.toString()
  const admin = await adminDb.findByTelegramId(tid)
  const name  = fmt.escape(ctx.from.first_name ?? 'there')
  if (admin?.isActive) {
    await ctx.replyWithMarkdownV2(`⚡ *Welcome back, ${name}\\!*\n\nUse /report, /stock, /help`)
  } else {
    await ctx.replyWithMarkdownV2(`👋 *Hello, ${name}\\!*\n\nTo access admin features: /register YOUR\\_CODE`)
  }
})

// ── /register ────────────────────────────────────────────────────────────────
bot.command('register', async (ctx) => {
  const parts = ctx.message.text.split(' ')
  const code  = parts[1]?.trim()
  if (!code) { await ctx.reply('Usage: /register [code]'); return }
  if (code !== config.admin.registrationCode) { await ctx.reply('Invalid registration code.'); return }
  const name = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ')
  await adminDb.register({ telegramId: ctx.from.id.toString(), telegramUsername: ctx.from.username, name })
  await ctx.replyWithMarkdownV2(`✅ *Registered as admin\\!*\n\nWelcome, ${fmt.escape(name)}\\! Try /report`)
})

// ── /report ───────────────────────────────────────────────────────────────────
bot.command('report', async (ctx) => {
  const admin = await adminDb.findByTelegramId(ctx.from.id.toString())
  if (!admin?.isActive) { await ctx.reply('🔒 Admin only. Use /register'); return }
  await ctx.sendChatAction('typing')
  try {
    const { kpi, topProduct } = await analyticsService.getDailyReport()
    const rev  = kpi.revenue?.value ?? 0
    const ords = kpi.orders?.value  ?? 0
    const avg  = kpi.avgOrder?.value ?? 0
    const revChange = kpi.revenue?.change ?? 0

    const text = [
      `📊 *Daily Report*`,
      `📅 ${fmt.escape(new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' }))}`,
      ``,
      `💰 Revenue: *${fmt.escape(fmt.currency(rev))}*`,
      `   ${revChange >= 0 ? '📈' : '📉'} ${fmt.escape(fmt.pct(revChange))} vs yesterday`,
      `🛒 Orders: *${ords}*`,
      `📦 Avg Basket: *${fmt.escape(fmt.currency(avg))}*`,
      topProduct ? `🏆 Top: ${fmt.escape(topProduct.name)} \\(×${topProduct.total_sold}\\)` : '',
      `👤 New Customers: *${kpi.newCustomers ?? 0}*`,
    ].filter(Boolean).join('\n')

    await ctx.replyWithMarkdownV2(text)
  } catch (err: any) {
    await ctx.reply(`❌ Failed to fetch report: ${err.message}`)
  }
})

// ── /stock ────────────────────────────────────────────────────────────────────
bot.command('stock', async (ctx) => {
  const admin = await adminDb.findByTelegramId(ctx.from.id.toString())
  if (!admin?.isActive) { await ctx.reply('🔒 Admin only.'); return }
  await ctx.sendChatAction('typing')
  try {
    const alerts = await analyticsService.getLowStockAlerts()
    if (!alerts.length) { await ctx.reply('✅ All products well stocked!'); return }
    const critical = alerts.filter((a: any) => a.severity === 'critical')
    const low      = alerts.filter((a: any) => a.severity === 'low')
    let text = `🔔 *Low Stock Alert \\(${alerts.length} items\\)*\n\n`
    if (critical.length) {
      text += `🚨 *CRITICAL:*\n`
      critical.slice(0,5).forEach((a: any) => {
        text += `• ${fmt.escape(a.productName)} ${a.size ? `\\(${fmt.escape(a.size)}\\)` : ''} — *${a.quantity} left*\n`
      })
    }
    if (low.length) {
      text += `\n⚠️ *Low:*\n`
      low.slice(0,5).forEach((a: any) => {
        text += `• ${fmt.escape(a.productName)} — ${a.quantity} left\n`
      })
    }
    await ctx.replyWithMarkdownV2(text)
  } catch (err: any) { await ctx.reply(`❌ Error: ${err.message}`) }
})

// ── /search ───────────────────────────────────────────────────────────────────
bot.command('search', async (ctx) => {
  const q = ctx.message.text.replace('/search', '').trim()
  if (!q) { await ctx.reply('Usage: /search [product name]'); return }
  await ctx.sendChatAction('typing')
  try {
    const { products, total } = await productService.search(q)
    if (!products.length) { await ctx.reply('No products found'); return }
    let text = `🔍 *Results for:* _${fmt.escape(q)}_\n_${total} found_\n\n`
    products.forEach((p: any, i: number) => {
      text += `${i+1}\\. *${fmt.escape(p.name)}* \\(${fmt.escape(p.brand)}\\)\n   ${p.variants?.length ?? 0} variants\n`
    })
    await ctx.replyWithMarkdownV2(text)
  } catch (err: any) { await ctx.reply(`❌ Error: ${err.message}`) }
})

// ── /customer ─────────────────────────────────────────────────────────────────
bot.command('customer', async (ctx) => {
  const admin = await adminDb.findByTelegramId(ctx.from.id.toString())
  if (!admin?.isActive) { await ctx.reply('🔒 Admin only.'); return }
  const phone = ctx.message.text.replace('/customer', '').trim()
  if (!phone) { await ctx.reply('Usage: /customer [phone]'); return }
  await ctx.sendChatAction('typing')
  try {
    const c = await customerService.findByPhone(phone)
    if (!c) { await ctx.reply('Customer not found'); return }
    await ctx.replyWithMarkdownV2(
      `👤 *${fmt.escape(c.name)}*\n📞 ${fmt.escape(c.phone)}\n⭐ ${c.loyaltyPoints} pts\n💰 ${fmt.escape(fmt.currency(c.totalSpent))}\n🛒 ${c.totalOrders} orders`
    )
  } catch { await ctx.reply('Customer not found') }
})

// ── /help ─────────────────────────────────────────────────────────────────────
bot.command('help', async (ctx) => {
  const admin = await adminDb.findByTelegramId(ctx.from.id.toString())
  const text = admin?.isActive
    ? `⚡ *AVERO Bot Commands*\n\n/report — Daily sales report\n/stock — Low stock alerts\n/search \\[name\\] — Search products\n/customer \\[phone\\] — Customer lookup\n/help — This message`
    : `👋 *AVERO Bot*\n\n/register \\[code\\] — Register as admin\n/search \\[name\\] — Browse products`
  await ctx.replyWithMarkdownV2(text)
})

// ── Error handler ─────────────────────────────────────────────────────────────
bot.catch((err: any, ctx) => {
  logger.error('Bot error', { error: err.message, userId: ctx.from?.id })
})

// ── Internal webhook (called by avero-erp-api) ────────────────────────────────
async function startInternalServer() {
  const app = express()
  app.use(express.json())

  app.post('/internal/large-order', async (req, res) => {
    const key = req.headers['x-internal-key']
    if (key !== config.api.internalKey) { res.status(403).json({ error: 'Forbidden' }); return }
    res.json({ ok: true })

    try {
      const { orderNumber, total, branchId, paymentMethod } = req.body
      const admins = await adminDb.findByPref('notifyLargeOrders')
      for (const admin of admins) {
        await bot.telegram.sendMessage(admin.telegramId,
          `💰 *Large Sale\\!*\n\n🧾 ${fmt.escape(orderNumber)}\n💵 *${fmt.escape(fmt.currency(total))} UZS*\n💳 ${fmt.escape(paymentMethod)}`,
          { parse_mode: 'MarkdownV2' }
        ).catch(() => {})
      }
    } catch (err: any) { logger.error('Large order notify failed', { error: err.message }) }
  })

  app.get('/health', (_, res) => res.json({ status: 'ok' }))
  app.listen(config.bot.port, () => logger.info(`Bot webhook server on port ${config.bot.port}`))
}

// ── Scheduled jobs ────────────────────────────────────────────────────────────
function initJobs() {
  // Daily report at 22:00 Tashkent time
  cron.schedule('0 22 * * *', async () => {
    logger.info('Sending daily report')
    try {
      const { kpi } = await analyticsService.getDailyReport()
      const admins  = await adminDb.findByPref('notifyDailyReport')
      const text = `📊 *Automated Daily Report*\n💰 Revenue: *${fmt.escape(fmt.currency(kpi.revenue?.value ?? 0))}*\n🛒 Orders: *${kpi.orders?.value ?? 0}*`
      for (const admin of admins) {
        await bot.telegram.sendMessage(admin.telegramId, text, { parse_mode: 'MarkdownV2' }).catch(() => {})
      }
    } catch (err: any) { logger.error('Daily report job failed', { error: err.message }) }
  }, { timezone: 'Asia/Tashkent' })

  // Low stock check every 60 min
  cron.schedule('0 * * * *', async () => {
    try {
      const alerts = await analyticsService.getLowStockAlerts()
      if (!alerts.length) return
      const critical = alerts.filter((a: any) => a.severity === 'critical')
      if (!critical.length) return
      const admins = await adminDb.findByPref('notifyLowStock')
      const text   = `🚨 *${critical.length} Critical Low Stock Items*\n${critical.slice(0,3).map((a: any) => `• ${fmt.escape(a.productName)}: ${a.quantity} left`).join('\n')}`
      for (const admin of admins) {
        await bot.telegram.sendMessage(admin.telegramId, text, { parse_mode: 'MarkdownV2' }).catch(() => {})
      }
    } catch {}
  }, { timezone: 'Asia/Tashkent' })
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function main() {
  await initDatabase()
  logger.info('Database ready')

  try { await getRedis().ping(); logger.info('Redis ready') }
  catch { logger.warn('Redis not available — sessions disabled') }

  await startInternalServer()
  initJobs()

  await bot.telegram.setMyCommands([
    { command: 'report',   description: 'Daily sales report' },
    { command: 'stock',    description: 'Low stock alerts' },
    { command: 'search',   description: 'Search products' },
    { command: 'customer', description: 'Customer lookup by phone' },
    { command: 'register', description: 'Register as admin' },
    { command: 'help',     description: 'Show help' },
  ])

  if (config.bot.mode === 'webhook' && config.bot.webhookUrl) {
    const webhookPath = `/webhook/${config.bot.token}`
    await bot.telegram.setWebhook(`${config.bot.webhookUrl}${webhookPath}`, {
      secret_token: config.bot.webhookSecret,
    })
    logger.info(`Webhook set: ${config.bot.webhookUrl}${webhookPath}`)
  } else {
    await bot.telegram.deleteWebhook()
    bot.launch({ dropPendingUpdates: true })
    logger.info('Bot started in polling mode')
  }

  logger.info('🤖 AVERO Bot is live!')

  process.once('SIGINT',  () => { bot.stop('SIGINT');  closeRedis() })
  process.once('SIGTERM', () => { bot.stop('SIGTERM'); closeRedis() })
}

main().catch((err) => { logger.error('Fatal', { error: err.message }); process.exit(1) })
