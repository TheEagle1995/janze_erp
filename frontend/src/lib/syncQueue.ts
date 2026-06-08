/**
 * syncQueue.ts — Janze ERP
 *
 * Offline sale queue.
 * When the POS has no internet:
 *   1. Sales are saved locally in IndexedDB (queue store)
 *   2. When internet returns, queued sales are sent to the API automatically
 *   3. UI subscribes via onStatusChange to show pending count
 */

const DB_NAME    = 'janze-erp-queue'
const DB_VERSION = 1
const STORE      = 'pending-sales'

export type SaleStatus = 'pending' | 'syncing' | 'synced' | 'failed'

export interface QueuedSale {
  localId:    string        // uuid generated offline
  status:     SaleStatus
  createdAt:  number        // Date.now()
  retries:    number
  payload:    SalePayload
  error?:     string
}

export interface SalePayload {
  items: Array<{
    productId:  string
    variantId?: string
    qty:        number
    price:      number
    discount:   number
  }>
  customerId?:    string
  paymentMethod:  'CASH' | 'CARD' | 'TRANSFER'
  cashGiven?:     number
  total:          number
  branchId?:      string
  note?:          string
}

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'localId' })
        store.createIndex('status', 'status', { unique: false })
      }
    }
    req.onsuccess  = () => resolve((req as IDBOpenDBRequest).result)
    req.onerror    = () => reject(req.error)
  })
}

async function dbGetAll(): Promise<QueuedSale[]> {
  const db = await openQueueDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

async function dbPut(sale: QueuedSale): Promise<void> {
  const db = await openQueueDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).put(sale)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

async function dbDelete(localId: string): Promise<void> {
  const db = await openQueueDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).delete(localId)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ── Sync Queue Service ────────────────────────────────────────────────────────

type StatusListener = (pending: number) => void

class SyncQueueService {
  private listeners: Set<StatusListener> = new Set()
  private isSyncing = false
  private apiUrl    = '/api/sales'   // override via configure()

  configure(opts: { apiUrl?: string }) {
    if (opts.apiUrl) this.apiUrl = opts.apiUrl
  }

  onStatusChange(fn: StatusListener) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private async emit() {
    const count = await this.getPendingCount()
    this.listeners.forEach(fn => fn(count))
  }

  // ── Enqueue a sale ──────────────────────────────────────────────────────────

  async enqueue(payload: SalePayload): Promise<string> {
    const sale: QueuedSale = {
      localId:   crypto.randomUUID(),
      status:    'pending',
      createdAt: Date.now(),
      retries:   0,
      payload,
    }
    await dbPut(sale)
    await this.emit()
    // Attempt immediate sync if online
    if (navigator.onLine) this.sync()
    return sale.localId
  }

  // ── Get pending count ───────────────────────────────────────────────────────

  async getPendingCount(): Promise<number> {
    const all = await dbGetAll()
    return all.filter(s => s.status === 'pending' || s.status === 'failed').length
  }

  async getAll(): Promise<QueuedSale[]> {
    return dbGetAll()
  }

  // ── Sync all pending ────────────────────────────────────────────────────────

  async sync(): Promise<void> {
    if (this.isSyncing) return
    this.isSyncing = true

    try {
      const all     = await dbGetAll()
      const pending = all.filter(s => s.status === 'pending' || s.status === 'failed')

      for (const sale of pending) {
        await this.syncOne(sale)
      }
    } finally {
      this.isSyncing = false
      await this.emit()
    }
  }

  private async syncOne(sale: QueuedSale): Promise<void> {
    // Mark as syncing
    await dbPut({ ...sale, status: 'syncing' })

    try {
      const res = await fetch(this.apiUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(sale.payload),
      })

      if (res.ok) {
        // Success — remove from queue
        await dbDelete(sale.localId)
      } else {
        const err = await res.text().catch(() => res.statusText)
        await dbPut({
          ...sale,
          status:  'failed',
          retries: sale.retries + 1,
          error:   err,
        })
      }
    } catch (err) {
      await dbPut({
        ...sale,
        status:  'failed',
        retries: sale.retries + 1,
        error:   err instanceof Error ? err.message : 'Network error',
      })
    }
  }

  // ── Network listeners ───────────────────────────────────────────────────────

  startListening() {
    window.addEventListener('online',  this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
  }

  stopListening() {
    window.removeEventListener('online',  this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
  }

  private handleOnline  = () => { this.sync() }
  private handleOffline = () => { this.emit() }
}

// Singleton
export const syncQueue = new SyncQueueService()

// Start listening to network events on module load (browser only)
if (typeof window !== 'undefined') {
  syncQueue.startListening()
}
