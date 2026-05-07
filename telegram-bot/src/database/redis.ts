import Redis from 'ioredis'
import { config } from '../config'

let client: Redis | null = null
export function getRedis() {
  if (!client) client = new Redis(config.redis.url, { maxRetriesPerRequest: 3, lazyConnect: true })
  return client
}
export const closeRedis = async () => { client && await client.quit(); client = null }

export const sessionStore = {
  async get(id: string | number) { try { const r = await getRedis().get(`tg:sess:${id}`); return r ? JSON.parse(r) : {} } catch { return {} } },
  async set(id: string | number, data: any) { try { await getRedis().setex(`tg:sess:${id}`, 7200, JSON.stringify(data)) } catch {} },
}
export const rateLimiter = {
  async check(id: string, max = 30, window = 60) {
    try {
      const key = `tg:rl:${id}`; const now = Date.now()
      const pipe = getRedis().pipeline()
      pipe.zadd(key, now, `${now}`); pipe.zremrangebyscore(key, '-inf', now - window * 1000)
      pipe.zcard(key); pipe.expire(key, window)
      const results = await pipe.exec()
      const count = (results?.[2]?.[1] as number) ?? 0
      return { allowed: count <= max }
    } catch { return { allowed: true } }
  },
}
