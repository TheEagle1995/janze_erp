import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi, inventoryApi } from '../lib/api'
import { fmt } from '../utils/format'
import { useAuthStore } from '../store/authStore'
import ExcelImportModal from '../components/shared/ExcelImportModal'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import dayjs from 'dayjs'
import {
  Plus, Search, Pencil, Trash2, X, RefreshCw, Package,
  LayoutGrid, List, Upload, Tag, ChevronDown,
  Layers, Eye, EyeOff, CheckSquare,
  ArrowUpDown, Printer, SlidersHorizontal,
  CheckCircle2, AlertTriangle,
} from 'lucide-react'

type SortKey     = 'name' | 'sellPrice' | 'costPrice' | 'margin' | 'createdAt'
type SortDir     = 'asc' | 'desc'
type StatusFilter= 'all' | 'active' | 'inactive'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Variant {
  id?:            string
  sku:            string
  barcode:        string
  size:           string
  color:          string
  colorHex:       string
  priceOverride:  string
  isFlexiblePrice?:boolean
}

const EMPTY_VARIANT: Variant = {
  sku: '', barcode: '', size: '', color: '', colorHex: '', priceOverride: '',
}

// ─── Barcode SVG (EAN-8 simplified visual) ────────────────────────────────────
function BarcodeDisplay({ code, small = false }: { code: string; small?: boolean }) {
  if (!code) return null
  // Simple visual bar pattern from code digits
  const bars = code.split('').map(c => parseInt(c)).filter(n => !isNaN(n))
  const h    = small ? 24 : 40
  const w    = small ? 60 : 100
  return (
    <svg viewBox={`0 0 ${w} ${h + 8}`} width={w} height={h + 8} className="shrink-0">
      {bars.map((n, i) => (
        <rect key={i}
          x={2 + i * ((w - 4) / bars.length)}
          y={0}
          width={Math.max(1, (n % 3) + 1)}
          height={h}
          fill="currentColor"
          opacity={0.8}
        />
      ))}
      <text x={w / 2} y={h + 7} textAnchor="middle"
        fontSize={small ? 5 : 7} fill="currentColor" opacity={0.7}
        fontFamily="monospace">
        {code}
      </text>
    </svg>
  )
}

// ─── Color swatch ─────────────────────────────────────────────────────────────
function ColorDot({ hex, label }: { hex?: string; label?: string }) {
  return (
    <div title={label}
      className="w-4 h-4 rounded-full border border-white/20 shrink-0"
      style={{ background: hex || '#888' }}
    />
  )
}

// ─── Product card (grid view) ─────────────────────────────────────────────────
function ProductCard({
  product, onEdit, onDelete, onToggleActive, onDetail, onPrintLabel, selected, onSelect,
}: {
  product:        any
  onEdit:         () => void
  onDelete:       () => void
  onToggleActive: () => void
  onDetail:       () => void
  onPrintLabel:   () => void
  selected:       boolean
  onSelect:       (e: React.MouseEvent) => void
}) {
  const variants      = product.variants ?? []
  const price         = Number(product.sellPrice ?? product.price ?? 0)
  const cost          = Number(product.costPrice ?? product.cost  ?? 0)
  const margin        = cost > 0 && price > 0 ? Math.round(((price - cost) / price) * 100) : null
  const uniqueColors  = [...new Set(variants.map((v: any) => v.colorHex).filter(Boolean))] as string[]
  const uniqueSizes   = [...new Set(variants.map((v: any) => v.size).filter(Boolean))] as string[]
  const hasBarcode    = variants.some((v: any) => v.barcode)

  return (
    <div className={clsx(
      'card group relative overflow-hidden hover:border-gold/30 transition-all cursor-pointer',
      !product.isActive && 'opacity-60',
      selected && 'border-gold/60 bg-gold/5',
    )} onClick={onDetail}>
      {/* Checkbox (top-left) */}
      <div className="absolute top-2 left-2 z-10" onClick={onSelect}>
        <div className={clsx(
          'w-5 h-5 rounded border flex items-center justify-center transition-all',
          selected
            ? 'bg-gold border-gold text-black'
            : 'border-border bg-surface opacity-0 group-hover:opacity-100',
        )}>
          {selected && <CheckCircle2 size={12} />}
        </div>
      </div>

      {/* Status badge */}
      {!product.isActive && (
        <div className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded bg-surface2 border border-border text-muted">
          Nofaol
        </div>
      )}

      {/* Product image placeholder */}
      <div className="h-28 -mx-5 -mt-4 mb-4 bg-surface2 flex items-center justify-center border-b border-border overflow-hidden">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name}
            className="h-full w-full object-cover" />
        ) : (
          <Package size={36} className="text-muted opacity-30" />
        )}
      </div>

      {/* Name + brand */}
      <div className="font-semibold text-sm leading-tight mb-0.5 truncate">{product.name}</div>
      <div className="text-xs text-muted mb-3">{product.brand || product.category?.name || '—'}</div>

      {/* Price row */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-bold text-gold font-mono">{fmt.compact(price)}</span>
        <span className="text-xs text-muted">UZS</span>
        {margin !== null && (
          <span className={clsx('text-xs ml-auto font-medium',
            margin >= 30 ? 'text-jade' : margin >= 15 ? 'text-gold' : 'text-rose')}>
            {margin}% margin
          </span>
        )}
      </div>

      {/* Variants info */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {uniqueColors.length > 0 && (
          <div className="flex items-center gap-0.5">
            {uniqueColors.slice(0, 5).map((hex, i) => (
              <ColorDot key={i} hex={hex} />
            ))}
            {uniqueColors.length > 5 && (
              <span className="text-xs text-muted">+{uniqueColors.length - 5}</span>
            )}
          </div>
        )}
        {uniqueSizes.length > 0 && (
          <div className="flex gap-0.5 flex-wrap">
            {uniqueSizes.slice(0, 4).map(s => (
              <span key={s} className="text-xs px-1 rounded border border-border text-muted">{s}</span>
            ))}
            {uniqueSizes.length > 4 && (
              <span className="text-xs text-muted">+{uniqueSizes.length - 4}</span>
            )}
          </div>
        )}
        {variants.length > 0 && (
          <span className="text-xs text-muted ml-auto">{variants.length} variant</span>
        )}
      </div>

      {/* Barcode preview */}
      {hasBarcode && (
        <div className="flex items-center gap-1 text-muted mb-3">
          <BarcodeDisplay code={variants.find((v: any) => v.barcode)?.barcode ?? ''} small />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1 mt-auto pt-3 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}>
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs
            text-muted hover:text-fg hover:bg-surface2 transition-colors">
          <Pencil size={11} /> Tahrirlash
        </button>
        <button onClick={onPrintLabel} title="Label chop etish"
          className="px-2 py-1.5 rounded-lg text-xs text-muted hover:text-gold hover:bg-gold/10 transition-colors">
          <Printer size={11} />
        </button>
        <button onClick={onToggleActive}
          className="px-2 py-1.5 rounded-lg text-xs text-muted hover:text-fg hover:bg-surface2 transition-colors">
          {product.isActive ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
        <button onClick={onDelete}
          className="px-2 py-1.5 rounded-lg text-xs text-muted hover:text-rose hover:bg-rose/10 transition-colors">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

// ─── Product row (list view) ──────────────────────────────────────────────────
function ProductRow({
  product, onEdit, onDelete, onToggleActive, onDetail,
}: {
  product:        any
  onEdit:         () => void
  onDelete:       () => void
  onToggleActive: () => void
  onDetail:       () => void
}) {
  const variants = product.variants ?? []
  const price    = Number(product.sellPrice ?? product.price ?? 0)
  const cost     = Number(product.costPrice ?? product.cost  ?? 0)
  const margin   = cost > 0 && price > 0 ? Math.round(((price - cost) / price) * 100) : null
  const firstBarcode = variants.find((v: any) => v.barcode)?.barcode

  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface2/50 group cursor-pointer"
      onClick={onDetail}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface2 flex items-center justify-center shrink-0">
            {product.imageUrl
              ? <img src={product.imageUrl} className="w-9 h-9 rounded-lg object-cover" />
              : <Package size={16} className="text-muted opacity-50" />
            }
          </div>
          <div>
            <div className="font-medium text-sm">{product.name}</div>
            <div className="text-xs text-muted">{product.brand || '—'}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted">{product.category?.name || product.categoryId || '—'}</td>
      <td className="px-4 py-3 font-mono font-medium text-gold text-sm">{fmt.compact(price)}</td>
      <td className="px-4 py-3 font-mono text-sm text-muted">{cost > 0 ? fmt.compact(cost) : '—'}</td>
      <td className="px-4 py-3 text-sm">
        {margin !== null ? (
          <span className={clsx('font-medium',
            margin >= 30 ? 'text-jade' : margin >= 15 ? 'text-gold' : 'text-rose')}>
            {margin}%
          </span>
        ) : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {[...new Set(variants.map((v: any) => v.colorHex).filter(Boolean))].slice(0,4).map((hex, i) => (
            <ColorDot key={i} hex={hex as string} />
          ))}
          <span className="text-xs text-muted ml-1">{variants.length} var</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {firstBarcode && <BarcodeDisplay code={firstBarcode} small />}
      </td>
      <td className="px-4 py-3">
        <span className={clsx('text-xs px-2 py-0.5 rounded border font-medium',
          product.isActive
            ? 'text-jade bg-jade/10 border-jade/30'
            : 'text-muted bg-surface2 border-border')}>
          {product.isActive ? 'Faol' : 'Nofaol'}
        </span>
      </td>
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit}
            className="p-1.5 rounded hover:bg-surface2 text-muted hover:text-fg transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={onToggleActive}
            className="p-1.5 rounded hover:bg-surface2 text-muted hover:text-fg transition-colors">
            {product.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded hover:bg-rose/10 text-muted hover:text-rose transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ product, onClose, onEdit }: { product: any; onClose: () => void; onEdit: () => void }) {
  const variants = product.variants ?? []
  const price    = Number(product.sellPrice ?? product.price ?? 0)
  const cost     = Number(product.costPrice ?? product.cost  ?? 0)
  const margin   = cost > 0 && price > 0 ? Math.round(((price - cost) / price) * 100) : null

  const { data: stock } = useQuery({
    queryKey: ['product-stock', product.id],
    queryFn:  () => inventoryApi.list({ productId: product.id, limit: 100 }),
    enabled:  !!product.id,
  })
  const stockItems = Array.isArray(stock) ? stock : (stock as any)?.data ?? []

  const stockByVariant: Record<string, number> = {}
  stockItems.forEach((s: any) => {
    const vid = s.variantId ?? s.variant?.id
    if (vid) stockByVariant[vid] = (stockByVariant[vid] ?? 0) + (s.quantity ?? 0)
  })

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface border-l border-border h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold">{product.name}</h2>
            <div className="text-xs text-muted">{product.brand || '—'}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={onEdit}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border
                text-muted hover:text-fg hover:border-gold/30 transition-colors">
              <Pencil size={13} /> Tahrirlash
            </button>
            <button onClick={onClose} className="p-1.5 text-muted hover:text-fg">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Price summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Sotuv narxi', value: fmt.currency(price), color: 'text-gold' },
              { label: 'Tan narxi',   value: cost > 0 ? fmt.currency(cost) : '—', color: '' },
              { label: 'Margin',      value: margin != null ? `${margin}%` : '—',
                color: margin != null ? (margin >= 30 ? 'text-jade' : margin >= 15 ? 'text-gold' : 'text-rose') : '' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card py-3 px-3">
                <div className="text-xs text-muted mb-1">{label}</div>
                <div className={clsx('font-bold font-mono text-sm', color)}>{value}</div>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="space-y-1.5 text-sm">
            {[
              { label: 'Kategoriya', value: product.category?.name || product.categoryId || '—' },
              { label: 'Birlik',     value: product.unit || 'dona' },
              { label: 'Moslashuvchan narx', value: product.isFlexiblePrice ? 'Ha' : "Yo'q" },
              { label: 'Qo\'shilgan', value: product.createdAt ? dayjs(product.createdAt).format('DD.MM.YYYY') : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>

          {/* Description */}
          {product.description && (
            <div>
              <div className="text-xs text-muted uppercase tracking-wide mb-1">Tavsif</div>
              <p className="text-sm text-muted">{product.description}</p>
            </div>
          )}

          {/* Variants table */}
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-2 flex items-center gap-2">
              <Layers size={12} /> Variantlar ({variants.length})
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface2">
                    <th className="px-3 py-2 text-left text-muted font-medium">SKU</th>
                    <th className="px-3 py-2 text-left text-muted font-medium">Rang/O'lcham</th>
                    <th className="px-3 py-2 text-left text-muted font-medium">Barkod</th>
                    <th className="px-3 py-2 text-right text-muted font-medium">Narx</th>
                    <th className="px-3 py-2 text-right text-muted font-medium">Stok</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v: any, i: number) => {
                    const qty    = stockByVariant[v.id] ?? 0
                    const vPrice = v.priceOverride ? Number(v.priceOverride) : price
                    return (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono text-muted">{v.sku || '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            {v.colorHex && <ColorDot hex={v.colorHex} label={v.color} />}
                            <span>{[v.color, v.size].filter(Boolean).join(' / ') || '—'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-muted text-[10px]">{v.barcode || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {vPrice !== price ? (
                            <span className="text-gold">{fmt.compact(vPrice)}</span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={clsx('font-medium',
                            qty <= 0 ? 'text-rose' : qty <= 5 ? 'text-gold' : 'text-jade')}>
                            {qty}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────
function ProductModal({
  product, categories, onClose,
}: { product: any | null; categories: any[]; onClose: () => void }) {
  const qc     = useQueryClient()
  const user   = useAuthStore(s => s.user)
  const isEdit = !!product

  const toForm = (p: any) => ({
    name:            p?.name            ?? '',
    skuBase:         p?.skuBase         ?? '',
    brand:           p?.brand           ?? 'AVERO',
    costPrice:       String(p?.costPrice ?? p?.cost  ?? ''),
    sellPrice:       String(p?.sellPrice ?? p?.price ?? ''),
    description:     p?.description     ?? '',
    categoryId:      p?.categoryId      ?? (categories[0]?.id ?? ''),
    unit:            p?.unit            ?? 'dona',
    isActive:        p?.isActive        ?? true,
    isFlexiblePrice: p?.isFlexiblePrice ?? false,
    variants: (p?.variants?.length ? p.variants : [{ ...EMPTY_VARIANT }]).map((v: any) => ({
      id:            v.id,
      sku:           v.sku           ?? '',
      barcode:       v.barcode       ?? '',
      size:          v.size          ?? '',
      color:         v.color         ?? '',
      colorHex:      v.colorHex      ?? '',
      priceOverride: v.priceOverride != null ? String(v.priceOverride) : '',
    })),
  })

  const [form, setForm] = useState<any>(() => toForm(product))
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  const setVariant = (i: number, k: string, v: any) =>
    setForm((f: any) => ({
      ...f,
      variants: f.variants.map((vv: any, idx: number) => idx === i ? { ...vv, [k]: v } : vv),
    }))

  const addVariant    = () => setForm((f: any) => ({ ...f, variants: [...f.variants, { ...EMPTY_VARIANT }] }))
  const removeVariant = (i: number) => setForm((f: any) => ({
    ...f, variants: f.variants.filter((_: any, idx: number) => idx !== i),
  }))

  const autoSku = () => {
    const base = form.name.slice(0, 6).toUpperCase().replace(/\s/g, '')
    const ts   = Date.now().toString().slice(-4)
    set('skuBase', `${base}-${ts}`)
  }

  const genBarcodes = () => {
    setForm((f: any) => ({
      ...f,
      variants: f.variants.map((v: any, i: number) => ({
        ...v,
        barcode: v.barcode || `860${Date.now().toString().slice(-7)}${i}`.slice(0, 13),
      })),
    }))
  }

  const save = useMutation({
    mutationFn: (payload: any) => isEdit
      ? productsApi.update(product.id, payload)
      : productsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success(isEdit ? 'Mahsulot yangilandi!' : "Mahsulot qo'shildi!")
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Xatolik'),
  })

  const handleSubmit = () => {
    if (!form.name.trim())     return toast.error('Nomi majburiy')
    if (!form.sellPrice)       return toast.error('Sotuv narxi majburiy')
    if (form.variants.some((v: any) => !v.sku.trim())) return toast.error("Har variantda SKU bo'lishi kerak")

    save.mutate({
      name:            form.name.trim(),
      skuBase:         form.skuBase.trim() || undefined,
      brand:           form.brand.trim()   || undefined,
      costPrice:       form.costPrice      ? Number(form.costPrice)  : undefined,
      sellPrice:       Number(form.sellPrice),
      description:     form.description.trim() || undefined,
      categoryId:      form.categoryId     || undefined,
      unit:            form.unit,
      isActive:        form.isActive,
      isFlexiblePrice: form.isFlexiblePrice,
      variants:        form.variants.map((v: any) => ({
        id:            v.id,
        sku:           v.sku.trim(),
        barcode:       v.barcode.trim()       || undefined,
        size:          v.size.trim()          || undefined,
        color:         v.color.trim()         || undefined,
        colorHex:      v.colorHex             || undefined,
        priceOverride: v.priceOverride        ? Number(v.priceOverride) : undefined,
      })),
    })
  }

  const profitCalc = form.costPrice && form.sellPrice && Number(form.sellPrice) > Number(form.costPrice)
    ? Number(form.sellPrice) - Number(form.costPrice)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-2xl
        flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Package size={18} className="text-gold" />
            {isEdit ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-fg"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nomi *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Mahsulot nomi" className="input w-full" />
            </div>
            <div>
              <label className="label">Brend</label>
              <input value={form.brand} onChange={e => set('brand', e.target.value)}
                placeholder="AVERO" className="input w-full" />
            </div>
            <div>
              <label className="label">Kategoriya</label>
              <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)}
                className="input w-full">
                <option value="">— Tanlang —</option>
                {categories.map((c: any) => (
                  <option key={c.id ?? c} value={c.id ?? c}>{c.name ?? c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label flex items-center justify-between">
                SKU bazasi
                <button onClick={autoSku} type="button"
                  className="text-xs text-gold hover:underline">Auto</button>
              </label>
              <input value={form.skuBase} onChange={e => set('skuBase', e.target.value)}
                placeholder="SHIRT-001" className="input w-full font-mono" />
            </div>
            <div>
              <label className="label">Birlik</label>
              <select value={form.unit} onChange={e => set('unit', e.target.value)}
                className="input w-full">
                {['dona','kg','litr','metr','juft','box'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface2 rounded-xl p-4">
              <div className="text-xs text-muted mb-2">Tan narxi (xarid)</div>
              <input type="number" min="0" value={form.costPrice}
                onChange={e => set('costPrice', e.target.value)}
                className="bg-transparent text-xl font-bold outline-none w-full text-fg placeholder:text-muted/40"
                placeholder="0" />
              <div className="text-xs text-muted mt-1">UZS</div>
            </div>
            <div className="bg-gold/10 border border-gold/30 rounded-xl p-4">
              <div className="text-xs text-gold mb-2">Sotuv narxi *</div>
              <input type="number" min="0" value={form.sellPrice}
                onChange={e => set('sellPrice', e.target.value)}
                className="bg-transparent text-xl font-bold outline-none w-full text-gold placeholder:text-gold/30"
                placeholder="0" />
              <div className="text-xs text-gold/60 mt-1">
                {profitCalc ? `+${fmt.compact(profitCalc)} foyda` : 'UZS'}
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex gap-4">
            {[
              { key: 'isActive',        label: 'Mahsulot faol' },
              { key: 'isFlexiblePrice', label: 'Moslashuvchan narx (POS\'da kiritiladi)' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer select-none text-sm">
                <div onClick={() => set(key, !form[key])}
                  className={clsx('w-10 h-5 rounded-full transition-colors relative shrink-0',
                    form[key] ? 'bg-jade' : 'bg-surface2 border border-border')}>
                  <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    form[key] ? 'translate-x-5' : 'translate-x-0.5')} />
                </div>
                {label}
              </label>
            ))}
          </div>

          {/* Description */}
          <div>
            <label className="label">Tavsif</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={2} placeholder="Ixtiyoriy…" className="input w-full resize-none" />
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-muted uppercase tracking-wide">
                Variantlar va Barkodlar
              </div>
              <div className="flex gap-2">
                <button onClick={genBarcodes} type="button"
                  className="flex items-center gap-1 text-xs text-muted hover:text-fg
                    bg-surface2 border border-border rounded-lg px-2.5 py-1.5 transition-colors">
                  <RefreshCw size={10} /> Barkodlar
                </button>
                <button onClick={addVariant} type="button"
                  className="flex items-center gap-1 text-xs text-gold bg-gold/10
                    border border-gold/30 rounded-lg px-2.5 py-1.5 hover:bg-gold/20 transition-colors">
                  <Plus size={10} /> Variant
                </button>
              </div>
            </div>

            {/* Column headers */}
            <div className="grid gap-2 px-1 mb-1" style={{ gridTemplateColumns: '3fr 3fr 2fr 3fr 2fr auto' }}>
              {['SKU *','Barkod','O\'lcham','Rang','Narx',''].map(h => (
                <span key={h} className="text-xs text-muted/70">{h}</span>
              ))}
            </div>

            <div className="space-y-2">
              {form.variants.map((v: any, i: number) => (
                <div key={i} className="bg-surface2 border border-border rounded-xl p-2.5
                  grid gap-2 items-center" style={{ gridTemplateColumns: '3fr 3fr 2fr 3fr 2fr auto' }}>
                  <input value={v.sku} onChange={e => setVariant(i,'sku',e.target.value)}
                    className="input text-xs font-mono py-1.5" placeholder="SKU-001" />
                  <input value={v.barcode} onChange={e => setVariant(i,'barcode',e.target.value)}
                    className="input text-xs font-mono py-1.5" placeholder="860…" />
                  <input value={v.size} onChange={e => setVariant(i,'size',e.target.value)}
                    className="input text-xs py-1.5" placeholder="S/M/L" />
                  <div className="flex gap-1 items-center">
                    <input type="color" value={v.colorHex || '#888888'}
                      onChange={e => setVariant(i,'colorHex',e.target.value)}
                      className="w-7 h-7 rounded border border-border bg-surface p-0.5 cursor-pointer shrink-0" />
                    <input value={v.color} onChange={e => setVariant(i,'color',e.target.value)}
                      className="input text-xs py-1.5 flex-1" placeholder="Qizil" />
                  </div>
                  <input type="number" min="0" value={v.priceOverride}
                    onChange={e => setVariant(i,'priceOverride',e.target.value)}
                    className="input text-xs font-mono py-1.5" placeholder={form.sellPrice || '—'} />
                  <button onClick={() => removeVariant(i)} type="button"
                    disabled={form.variants.length <= 1}
                    className="p-1 rounded text-muted hover:text-rose hover:bg-rose/10
                      disabled:opacity-30 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
          <p className="text-xs text-muted">* majburiy maydonlar</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">Bekor</button>
            <button onClick={handleSubmit} disabled={save.isPending}
              className="btn-primary disabled:opacity-50 flex items-center gap-2">
              {save.isPending && <RefreshCw size={13} className="animate-spin" />}
              {isEdit ? 'Yangilash' : "Qo'shish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const qc       = useQueryClient()
  const navigate = useNavigate()

  const [search,     setSearch]     = useState('')
  const [catFilter,  setCatFilter]  = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey,    setSortKey]    = useState<SortKey>('createdAt')
  const [sortDir,    setSortDir]    = useState<SortDir>('desc')
  const [page,       setPage]       = useState(1)
  const [view,       setView]       = useState<'grid' | 'list'>('grid')
  const [modal,      setModal]      = useState<'add' | 'edit' | null>(null)
  const [editing,    setEditing]    = useState<any>(null)
  const [detail,     setDetail]     = useState<any>(null)
  const [excelOpen,  setExcelOpen]  = useState(false)
  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  const [showSort,   setShowSort]   = useState(false)

  // ── Queries ───────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', search, catFilter, page],
    queryFn:  () => productsApi.list({
      search:     search || undefined,
      categoryId: catFilter || undefined,
      page,
      limit: 48,
    }),
  })

  const { data: catData } = useQuery({
    queryKey: ['categories'],
    queryFn:  () => productsApi.categories(),
  })

  const rawProducts = Array.isArray(data) ? data : (data as any)?.data ?? []
  const meta        = (data as any)?.meta
  const categories  = Array.isArray(catData)
    ? catData
    : (catData as any)?.data ?? catData ?? []

  // ── Client-side sort + status filter ──────────────────────
  const products = useMemo(() => {
    let list = [...rawProducts]

    // Status filter
    if (statusFilter === 'active')   list = list.filter((p: any) =>  p.isActive)
    if (statusFilter === 'inactive') list = list.filter((p: any) => !p.isActive)

    // Sort
    list.sort((a: any, b: any) => {
      let av: any, bv: any
      if (sortKey === 'margin') {
        const pa = Number(a.sellPrice ?? a.price ?? 0)
        const ca = Number(a.costPrice ?? a.cost  ?? 0)
        const pb = Number(b.sellPrice ?? b.price ?? 0)
        const cb = Number(b.costPrice ?? b.cost  ?? 0)
        av = pa > 0 && ca > 0 ? ((pa - ca) / pa) * 100 : -1
        bv = pb > 0 && cb > 0 ? ((pb - cb) / pb) * 100 : -1
      } else if (sortKey === 'sellPrice') {
        av = Number(a.sellPrice ?? a.price ?? 0)
        bv = Number(b.sellPrice ?? b.price ?? 0)
      } else if (sortKey === 'costPrice') {
        av = Number(a.costPrice ?? a.cost ?? 0)
        bv = Number(b.costPrice ?? b.cost ?? 0)
      } else if (sortKey === 'createdAt') {
        av = new Date(a.createdAt ?? 0).getTime()
        bv = new Date(b.createdAt ?? 0).getTime()
      } else {
        av = (a.name ?? '').toLowerCase()
        bv = (b.name ?? '').toLowerCase()
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })
    return list
  }, [rawProducts, statusFilter, sortKey, sortDir])

  // ── Stats ─────────────────────────────────────────────────
  const activeCount   = rawProducts.filter((p: any) =>  p.isActive).length
  const inactiveCount = rawProducts.filter((p: any) => !p.isActive).length
  const totalVariants = rawProducts.reduce((s: number, p: any) => s + (p.variants?.length ?? 0), 0)

  // ── Bulk helpers ──────────────────────────────────────────
  const allSelected  = products.length > 0 && products.every((p: any) => selected.has(p.id))
  const someSelected = selected.size > 0

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(products.map((p: any) => p.id)))
  }
  const clearSelect = () => setSelected(new Set())

  // ── Mutations ─────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success("Mahsulot o'chirildi") },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Xatolik'),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      productsApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Xatolik'),
  })

  const handleDelete = (p: any) => {
    if (!confirm(`"${p.name}" ni o'chirishni tasdiqlaysizmi?`)) return
    deleteMut.mutate(p.id)
  }
  const handleToggle = (p: any) => toggleMut.mutate({ id: p.id, isActive: !p.isActive })

  const openEdit = (p: any) => { setEditing(p); setModal('edit'); setDetail(null) }
  const openAdd  = () => { setEditing(null); setModal('add') }

  return (
    <div className="flex gap-4 h-full">
      {/* ── Category sidebar ── */}
      <aside className="w-44 shrink-0 space-y-1">
        <div className="text-xs text-muted uppercase tracking-wide px-2 mb-2">Kategoriyalar</div>
        <button
          onClick={() => { setCatFilter(''); setPage(1) }}
          className={clsx('w-full text-left px-3 py-2 rounded-xl text-sm transition-colors',
            !catFilter ? 'bg-gold text-black font-medium' : 'text-muted hover:text-fg hover:bg-surface2')}>
          Barchasi
        </button>
        {(Array.isArray(categories) ? categories : []).map((c: any) => {
          const id    = c.id ?? c
          const name  = c.name ?? c
          return (
            <button key={id}
              onClick={() => { setCatFilter(id); setPage(1) }}
              className={clsx('w-full text-left px-3 py-2 rounded-xl text-sm transition-colors truncate',
                catFilter === id
                  ? 'bg-gold text-black font-medium'
                  : 'text-muted hover:text-fg hover:bg-surface2')}>
              {name}
            </button>
          )
        })}
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">Mahsulotlar</h1>
            <p className="text-xs text-muted mt-0.5">
              {meta?.total ?? products.length} ta · {activeCount} faol · {totalVariants} variant
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Qidirish…"
                className="input pl-9 pr-3 py-1.5 w-52 text-sm"
              />
            </div>

            {/* View toggle */}
            <div className="flex gap-0.5 bg-surface border border-border rounded-lg p-0.5">
              <button onClick={() => setView('grid')}
                className={clsx('p-1.5 rounded transition-colors',
                  view === 'grid' ? 'bg-gold/20 text-gold' : 'text-muted hover:text-fg')}>
                <LayoutGrid size={15} />
              </button>
              <button onClick={() => setView('list')}
                className={clsx('p-1.5 rounded transition-colors',
                  view === 'list' ? 'bg-gold/20 text-gold' : 'text-muted hover:text-fg')}>
                <List size={15} />
              </button>
            </div>

            <button onClick={() => setExcelOpen(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border border-border
                text-muted hover:text-fg hover:border-gold/30 transition-colors">
              <Upload size={14} /> Excel import
            </button>

            <button onClick={openAdd} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> Yangi mahsulot
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-20 text-muted">
            <RefreshCw size={24} className="mx-auto mb-3 animate-spin opacity-40" />
            Yuklanmoqda…
          </div>
        )}

        {/* Empty */}
        {!isLoading && products.length === 0 && (
          <div className="text-center py-20 text-muted">
            <Package size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Mahsulot topilmadi</p>
            <button onClick={openAdd} className="btn-primary mt-4 inline-flex items-center gap-2">
              <Plus size={14} /> Yangi mahsulot
            </button>
          </div>
        )}

        {/* Grid view */}
        {!isLoading && products.length > 0 && view === 'grid' && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((p: any) => (
              <ProductCard
                key={p.id}
                product={p}
                onEdit={() => openEdit(p)}
                onDelete={() => handleDelete(p)}
                onToggleActive={() => handleToggle(p)}
                onDetail={() => setDetail(p)}
              />
            ))}
          </div>
        )}

        {/* List view */}
        {!isLoading && products.length > 0 && view === 'list' && (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Mahsulot','Kategoriya','Narx','Tan narxi','Margin','Variantlar','Barkod','Holat',''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs text-muted uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p: any) => (
                    <ProductRow
                      key={p.id}
                      product={p}
                      onEdit={() => openEdit(p)}
                      onDelete={() => handleDelete(p)}
                      onToggleActive={() => handleToggle(p)}
                      onDetail={() => setDetail(p)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="btn-secondary py-1 px-3 text-sm disabled:opacity-40">← Oldingi</button>
            <span className="text-sm text-muted">{page} / {meta.totalPages}</span>
            <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}
              className="btn-secondary py-1 px-3 text-sm disabled:opacity-40">Keyingi →</button>
          </div>
        )}
      </div>

      {/* ── Modals & Panels ── */}
      {(modal === 'add' || modal === 'edit') && (
        <ProductModal
          product={modal === 'edit' ? editing : null}
          categories={Array.isArray(categories) ? categories : []}
          onClose={() => { setModal(null); setEditing(null) }}
        />
      )}

      {detail && (
        <DetailPanel
          product={detail}
          onClose={() => setDetail(null)}
          onEdit={() => openEdit(detail)}
        />
      )}

      {excelOpen && <ExcelImportModal onClose={() => { setExcelOpen(false); refetch() }} />}
    </div>
  )
}
