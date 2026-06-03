import { useQuery } from '@tanstack/react-query'
import { ordersApi, branchesApi } from '../lib/api'
import { useState } from 'react'
import { PageHeader, Badge, EmptyState, fmt, fmtDateTime } from '../components/Shared'
import { Search, Loader2, ChevronRight } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

const STATUS_COLORS: Record<string, any> = {
  COMPLETED: 'green', PENDING: 'gold', VOID: 'red', REFUNDED: 'muted',
}

export default function OrdersPage() {
  const { user }              = useAuthStore()
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [source, setSource]   = useState('')
  const [branchId, setBranch] = useState(user?.branchId ?? '')
  const [page, setPage]       = useState(1)
  const [selected, setSelected] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['orders', search, status, source, branchId, page],
    queryFn:  () => ordersApi.list({
      search, status: status || undefined, source: source || undefined,
      branchId: branchId || undefined, page, limit: 25, includeItems: 'true',
    }),
  })

  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list })

  const orders = data?.data ?? []
  const meta   = data?.meta ?? {}

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Orders" subtitle={`${meta.total ?? 0} orders`} />

      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Order ID…"
            className="bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-fg w-44 focus:outline-none focus:border-gold/60" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none">
          <option value="">All statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="PENDING">Pending</option>
          <option value="VOID">Void</option>
          <option value="REFUNDED">Refunded</option>
        </select>
        <select value={source} onChange={e => { setSource(e.target.value); setPage(1) }}
          className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none">
          <option value="">All sources</option>
          <option value="ORDER">Orders</option>
          <option value="POS">POS</option>
        </select>
        {branches?.length > 1 && (
          <select value={branchId} onChange={e => { setBranch(e.target.value); setPage(1) }}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none">
            <option value="">All branches</option>
            {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={24} className="animate-spin text-gold" />
            </div>
          ) : orders.length ? (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Order</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Items</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Customer</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Cashier</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Source</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-xs text-muted font-medium">Total</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o: any) => {
                  const items: any[] = o.items ?? []
                  const summary = items.length > 0
                    ? items.slice(0, 2).map((it: any) => `${it.variant?.product?.name ?? 'Item'} ×${it.quantity}`).join(', ')
                      + (items.length > 2 ? ` +${items.length - 2}` : '')
                    : `${o._count?.items ?? 0} items`
                  return (
                    <tr key={o.id} onClick={() => setSelected(o)}
                      className={`cursor-pointer hover:bg-surface2/40 ${selected?.id === o.id ? 'bg-surface2/60' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-muted">#{o.id.slice(-8)}</td>
                      <td className="px-4 py-3 text-xs text-fg max-w-[200px] truncate">{summary}</td>
                      <td className="px-4 py-3 text-xs text-muted">{o.customer?.name ?? 'Walk-in'}</td>
                      <td className="px-4 py-3 text-xs text-muted">{o.cashier?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge color={o.source === 'POS' ? 'gold' : 'muted'}>{o.source}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={STATUS_COLORS[o.status] ?? 'default'}>{o.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-gold">{fmt(o.total)}</td>
                      <td className="px-4 py-3 text-xs text-muted">{fmtDateTime(o.createdAt)}</td>
                      <td className="px-4 py-3 text-muted"><ChevronRight size={14} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState message="No orders found" />
          )}

          {meta.lastPage > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border text-sm text-muted">
              <span>Page {page} of {meta.lastPage}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-surface2">Prev</button>
                <button disabled={page === meta.lastPage} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-surface2">Next</button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 border-l border-border overflow-auto bg-surface p-4 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-fg">Order Detail</h3>
              <button onClick={() => setSelected(null)} className="text-muted hover:text-fg">×</button>
            </div>
            <div className="space-y-3 text-sm">
              <div><p className="text-xs text-muted">Order ID</p><p className="font-mono text-xs text-fg">#{selected.id}</p></div>
              <div><p className="text-xs text-muted">Status</p><Badge color={STATUS_COLORS[selected.status]}>{selected.status}</Badge></div>
              <div><p className="text-xs text-muted">Date</p><p className="text-fg">{fmtDateTime(selected.createdAt)}</p></div>
              {selected.customer && <div><p className="text-xs text-muted">Customer</p><p className="text-fg">{selected.customer.name}</p></div>}
              {selected.cashier && <div><p className="text-xs text-muted">Cashier</p><p className="text-fg">{selected.cashier.name}</p></div>}

              <div>
                <p className="text-xs text-muted mb-2">Items</p>
                <div className="space-y-1">
                  {(selected.items ?? []).map((it: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-fg truncate flex-1">{it.variant?.product?.name ?? 'Item'} ×{it.quantity}</span>
                      <span className="font-mono text-gold ml-2">{fmt(it.lineTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-2 space-y-1">
                {selected.discountTotal > 0 && (
                  <div className="flex justify-between text-xs text-muted">
                    <span>Discount</span><span>-{fmt(selected.discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-fg">Total</span>
                  <span className="text-gold font-mono">{fmt(selected.total)}</span>
                </div>
              </div>

              {selected.payments?.length > 0 && (
                <div>
                  <p className="text-xs text-muted mb-1">Payments</p>
                  {selected.payments.map((p: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs">
                      <Badge color="muted">{p.method}</Badge>
                      <span className="font-mono text-fg">{fmt(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
