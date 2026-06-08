/**
 * offlineDB.ts — Janze ERP
 *
 * IndexedDB wrapper for offline support.
 * Stores products and app settings locally so POS works without internet.
 *
 * Stores:
 *   products  — cached product list (synced from API)
 *   settings  — key/value app settings
 */

const DB_NAME    = 'janze-erp'
const DB_VERSION = 1

export interface OfflineProduct {
  id:           string
  name:         string
  barcode?:     string
  price:        number
  stock:        number
  category?:    string
  unit?:        string
  imageUrl?:    string
  variants?:    Array<{ id: string; name: string; price: number; stock: number }>
  updatedAt:    number   // Date.now() when cached
}

type StoreMap = {
  products: OfflineProduct
  settings: { key: string; value: unknown }
}

class OfflineDB {
  private db: IDBDatabase | null = null
  private opening: Promise<IDBDatabase> | null = null

  // ── Open / Init ─────────────────────────────────────────────────────────────
  private open(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db)
    if (this.opening) return this.opening

    this.opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains('products')) {
          const store = db.createObjectStore('products', { keyPath: 'id' })
          store.createIndex('barcode', 'barcode', { unique: false })
          store.createIndex('category', 'category', { unique: false })
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }
      }

      req.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result
        resolve(this.db)
      }

      req.onerror = () => reject(req.error)
    })

    return this.opening
  }

  // ── Generic helpers ──────────────────────────────────────────────────────────
  private async tx<K extends keyof StoreMap>(
    storeName: K,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest | IDBRequest[]
  ): Promise<unknown> {
    const db    = await this.open()
    const tx    = db.transaction(storeName as string, mode)
    const store = tx.objectStore(storeName as string)
    const reqs  = fn(store)
    const all   = Array.isArray(reqs) ? reqs : [reqs]

    return new Promise((resolve, reject) => {
      const results: unknown[] = []
      let done = 0

      for (const req of all) {
        req.onsuccess = () => {
          results.push(req.result)
          if (++done === all.length) resolve(all.length === 1 ? results[0] : results)
        }
        req.onerror = () => reject(req.error)
      }

      tx.onerror  = () => reject(tx.error)
    })
  }

  // ── Products ─────────────────────────────────────────────────────────────────

  async saveProducts(products: OfflineProduct[]): Promise<void> {
    const db  = await this.open()
    const tx  = db.transaction('products', 'readwrite')
    const store = tx.objectStore('products')

    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear()
      clearReq.onsuccess = () => {
        const ts = Date.now()
        let count = 0

        if (products.length === 0) { resolve(); return }

        for (const p of products) {
          const req = store.put({ ...p, updatedAt: ts })
          req.onsuccess = () => { if (++count === products.length) resolve() }
          req.onerror   = () => reject(req.error)
        }
      }
      clearReq.onerror = () => reject(clearReq.error)
      tx.onerror = () => reject(tx.error)
    })
  }

  async getAllProducts(): Promise<OfflineProduct[]> {
    return (await this.tx('products', 'readonly', s => s.getAll())) as OfflineProduct[]
  }

  async getProductByBarcode(barcode: string): Promise<OfflineProduct | undefined> {
    const db    = await this.open()
    const tx    = db.transaction('products', 'readonly')
    const index = tx.objectStore('products').index('barcode')

    return new Promise((resolve, reject) => {
      const req = index.get(barcode)
      req.onsuccess = () => resolve(req.result)
      req.onerror   = () => reject(req.error)
    })
  }

  async getProduct(id: string): Promise<OfflineProduct | undefined> {
    return (await this.tx('products', 'readonly', s => s.get(id))) as OfflineProduct | undefined
  }

  /** Check if we have a valid product cache (not older than maxAge ms) */
  async isCacheFresh(maxAgeMs = 15 * 60 * 1000): Promise<boolean> {
    const products = await this.getAllProducts()
    if (products.length === 0) return false
    const oldest = Math.min(...products.map(p => p.updatedAt))
    return Date.now() - oldest < maxAgeMs
  }

  // ── Settings ─────────────────────────────────────────────────────────────────

  async setSetting(key: string, value: unknown): Promise<void> {
    await this.tx('settings', 'readwrite', s => s.put({ key, value }))
  }

  async getSetting<T = unknown>(key: string): Promise<T | undefined> {
    const row = (await this.tx('settings', 'readonly', s => s.get(key))) as
      { key: string; value: T } | undefined
    return row?.value
  }

  // ── Housekeeping ─────────────────────────────────────────────────────────────

  async clearProducts(): Promise<void> {
    await this.tx('products', 'readwrite', s => s.clear())
  }

  async close(): Promise<void> {
    this.db?.close()
    this.db     = null
    this.opening = null
  }
}

// Singleton
export const offlineDB = new OfflineDB()
