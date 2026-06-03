import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi, branchesApi } from '../lib/api'
import { useState } from 'react'
import { PageHeader, Badge, EmptyState, fmt } from '../components/Shared'
import { Search, AlertTriangle, X, Loader2, TrendingUp, TrendingDown, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

type AdjType = 'RECEIVE' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'TRANSFER' | 'DAMAGE' | 'INITIAL'

const ADJ_TYPES: AdjType[] = ['RECEIVE','RETURN','ADJUSTMENT','DAMAGE','INITIAL','TRANSFER']

export default function InventoryPage() {
  const qc = useQueryClient()
  const [search,   setSearch]   = useState('')
  const [branchId, setBranch]   = useState('')
  const [lowOnly,  setLowOnly]  = useState(false)
  const [page,     setPage]     = useState(1)
  const [showAdj,  setShowAdj]  = useState(false)
  const [adjItem,  setAdjItem]  = useState<any>(null)
  const [adjForm,  setAdjForm]  = useState({ type: 'ADJUSTMENT' as AdjType, quantity: 0, note: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', search, branchId, lowOnly, page],
    queryFn:  () => inventoryApi.list({
      search: search || undefined,
      branchId: branchId || undefined,
      lowStock: lowOnly ? 'true' : undefined,
      page, limit: 30,
    }),
  })

  const { data: summary } = useQuery({
    queryKey: ['inventory.summary', branchId],
    queryFn:  () => inventoryApi.summary({ branchId: branchId || undefined }),
  })

  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list })

  const adjMut = useMutation({
    mutationFn: (d: any) => inventoryApi.adjust(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      setShowAdj(false)
      toast.success('Stock adjusted')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const items = data?.data ?? []
  const meta  = data?.meta ?? {}

  const openAdj = (item: any) => {
    setAdjItem(item)
    setAdjForm({ type: 'ADJUSTMENT', quantity: 0, note: '' })
    setShowAdj(true)
  }

  const submitAdj = () => {
    if (!adjItem) return
    if (!adjForm.quantity) return toast.error('Quantity required')
    adjMut.mutate({
      variantId: adjItem.variantId,
      branchId:  adjItem.branchId,
      type:      adjForm.type,
      quantity:  Number(adjForm.quantity),
      note:      adjForm.note || undefined,
    })
  }

  const stockColor = (qty: number, reorder: number) => {
    if (qty <= 0)          return 'red'
    if (qty <= reorder)    return 'gold'
    return 'green'
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Inventory" subtitle="Stock management" />

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-4 gap-3 px-6 py-3 border-b border-border">
          {[
            { label: 'Total SKUs',    value: summary.totalSkus,      color: 'text-fg' },
            { label: 'Total Units',   value: summary.totalUnits,     color: 'text-fg' },
            { label: 'Stock Value',   value: fmt(summary.stockValue), color: 'text-gold' },
            { label: 'Low Stock',     value: summary.lowStockCount,  color: 'text-rose' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface rounded-lg px-3 py-2">
              <p className="text-xs text-muted">{label}</p>
              <p className={`text-sm font-semibold font-mono ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search products…"
            className="bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-fg w-48 focus:outline-none focus:border-gold/60" />
        </div>
        {branches?.length > 1 && (
          <select value={branchId} onChange={e => { setBranch(e.target.value); setPage(1) }}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none">
            <option value="">All branches</option>
            {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
          <input type="checkbox" checked={lowOnly} onChange={e => { setLowOnly(e.target.checked); setPage(1) }}
            className="accent-gold" />
          <AlertTriangle size={13} className="text-gold" /> Low stock only
        </label>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-gold" /></div>
        ) : items.length ? (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Product</th>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">SKU</th>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Variant</th>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Branch</th>
                <th className="text-right px-4 py-3 text-xs text-muted font-medium">Stock</th>
                <th className="text-right px-4 py-3 text-xs text-muted font-medium">Reorder</th>
                <th className="text-right px-4 py-3 text-xs text-muted font-medium">Value</th>
                <th className="text-center px-4 py-3 text-xs text-muted font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item: any) => (
                <tr key={`${item.variantId}-${item.branchId}`}
                  className="hover:bg-surface2/30">
                  <td className="px-4 py-3 text-sm text-fg">{item.productName}</td>
                  <td className="px-4 py-3 text-xs text-muted font-mono">{item.sku}</td>
                  <td className="px-4 py-3 text-xs text-muted">{[item.size, item.color].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted">{item.branchName}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-mono font-semibold ${
                      item.quantity <= 0 ? 'text-rose' : item.quantity <= (item.reorderPoint ?? 5) ? 'text-gold' : 'text-jade'
                    }`}>{item.quantity}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted">{item.reorderPoint ?? 5}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-fg">{fmt(item.stockValue ?? 0)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge color={stockColor(item.quantity, item.reorderPoint ?? 5)}>
                      {item.quantity <= 0 ? 'Out' : item.quantity <= (item.reorderPoint ?? 5) ? 'Low' : 'OK'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openAdj(item)}
                      className="text-xs text-muted hover:text-gold flex items-center gap-1">
                      <RotateCcw size={12} /> Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No inventory records found" />
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

      {/* Adjustment Modal */}
      {showAdj && adjItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-fg">Stock Adjustment</h2>
              <button onClick={() => setShowAdj(false)} className="text-muted hover:text-fg"><X size={18} /></button>
            </div>
            <div className="bg-surface2 rounded-lg p-3 mb-4 text-sm">
              <p className="text-fg font-medium">{adjItem.productName}</p>
              <p className="text-xs text-muted mt-0.5">{adjItem.sku} · {adjItem.branchName}</p>
              <p className="text-xs text-muted mt-0.5">Current stock: <span className="text-fg font-mono">{adjItem.quantity}</span></p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted mb-1">Adjustment Type</label>
                <select value={adjForm.type} onChange={e => setAdjForm(v => ({ ...v, type: e.target.value as AdjType }))}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none">
                  {ADJ_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Quantity (use negative to decrease)</label>
                <input type="number" value={adjForm.quantity}
                  onChange={e => setAdjForm(v => ({ ...v, quantity: Number(e.target.value) }))}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Note</label>
                <input type="text" value={adjForm.note}
                  onChange={e => setAdjForm(v => ({ ...v, note: e.target.value }))}
                  placeholder="Reason for adjustment…"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdj(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-muted hover:text-fg">Cancel</button>
              <button onClick={submitAdj} disabled={adjMut.isPending}
                className="flex-1 py-2 bg-gold text-bg rounded-lg text-sm font-semibold hover:bg-gold/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {adjMut.isPending && <Loader2 size={14} className="animate-spin" />}
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
