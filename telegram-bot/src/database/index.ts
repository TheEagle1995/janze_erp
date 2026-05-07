import { Pool } from 'pg'
import { config } from '../config'
const pool = new Pool({ connectionString: config.db.url, max: 3 })

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_admins (
      id                 SERIAL PRIMARY KEY,
      telegram_id        VARCHAR(20) UNIQUE NOT NULL,
      telegram_username  VARCHAR(100),
      name               VARCHAR(100) NOT NULL,
      role               VARCHAR(20) NOT NULL DEFAULT 'MANAGER',
      is_active          BOOLEAN NOT NULL DEFAULT true,
      notify_daily_report BOOLEAN NOT NULL DEFAULT true,
      notify_low_stock    BOOLEAN NOT NULL DEFAULT true,
      notify_large_orders BOOLEAN NOT NULL DEFAULT true,
      registered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_active_at     TIMESTAMPTZ
    )
  `)
}

export const adminDb = {
  async findByTelegramId(id: string) {
    const { rows } = await pool.query(
      `SELECT id, telegram_id as "telegramId", telegram_username as "telegramUsername", name, role,
              is_active as "isActive", notify_daily_report as "notifyDailyReport",
              notify_low_stock as "notifyLowStock", notify_large_orders as "notifyLargeOrders"
       FROM bot_admins WHERE telegram_id = $1`, [id])
    return rows[0] ?? null
  },
  async findAll(activeOnly = true) {
    const { rows } = await pool.query(
      `SELECT telegram_id as "telegramId", name, role, notify_daily_report as "notifyDailyReport",
              notify_low_stock as "notifyLowStock", notify_large_orders as "notifyLargeOrders"
       FROM bot_admins WHERE ($1 = false OR is_active = true)`, [activeOnly])
    return rows
  },
  async findByPref(pref: string) {
    const col = pref === 'notifyDailyReport' ? 'notify_daily_report'
               : pref === 'notifyLowStock' ? 'notify_low_stock' : 'notify_large_orders'
    const { rows } = await pool.query(
      `SELECT telegram_id as "telegramId", name FROM bot_admins WHERE is_active = true AND ${col} = true`)
    return rows
  },
  async register(data: { telegramId: string; telegramUsername?: string; name: string }) {
    const { rows } = await pool.query(
      `INSERT INTO bot_admins (telegram_id, telegram_username, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (telegram_id) DO UPDATE SET name = EXCLUDED.name, is_active = true
       RETURNING *`, [data.telegramId, data.telegramUsername ?? null, data.name])
    return rows[0]
  },
  async touchLastActive(telegramId: string) {
    await pool.query(`UPDATE bot_admins SET last_active_at = NOW() WHERE telegram_id = $1`, [telegramId])
  },
}
