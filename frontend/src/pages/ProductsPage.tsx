import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi }        from '../api/products'
import { branchesApi }        from '../api/branches'
import { inventoryApi }       from '../api/inventory'
import { useAuthStore }       from '../stores/authStore'
import { fmt }                from '../utils/format'
import { exportProductsToExcel } from '../utils/excel'
import ExcelImportModal       from '../components/shared/ExcelImportModal'
import { useT }               from '../i18n'
import toast                  from 'react-hot-toast'
import { Search, Plus, Package, Pencil, Trash2, X, PlusCircle, MinusCircle, Wand2, RefreshCw, FileSpreadsheet, Download, Zap, PackagePlus, Printer, Check, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

// ─── Restock Modal ────────────────────────────────────────────────────────────
function RestockModal({ product, branchId, onClose }: { product: any; branchId: string; onClose: () => void }) {
  const qc = useQueryClient()
  // Build a flat list of variants to restock
  const [quantities, setQuantities] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    product.variants?.forEach((v: any) => { init[v.id] = '' })
    return init
  })
  const [note, setNote] = useState('')

  const restockMut = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(quantities).filter(([, q]) => Number(q) > 0)
      if (entries.length === 0) throw new Error('Enter quantity for at least one variant')
      // Call adjust for each variant with positive qty
      for (const [variantId, qty] of entries) {
        await inventoryApi.adjust({ variantId, branchId, quantity: Number(qty), note: note || 'Restock', type: 'PURCHASE' })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Stock updated successfully!')
      onClose()
    },
    onError: (e: any) => toast.error(e.message ?? e.response?.data?.message ?? 'Failed to update stock'),
  })

  const variants: any[] = product.variants ?? []
  // Current stock per variant for the current branch
  const currentStock = (v: any) => {
    const inv = v.inventory?.find((i: any) => i.branchId === branchId)
    return inv?.quantity ?? 0
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-jade/10 rounded-xl">
              <PackagePlus size={16} className="text-jade" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-fg">Restock Product</h2>
              <p className="text-xs text-muted">{product.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-muted bg-surface2 border border-border rounded-xl px-3 py-2.5">
            Enter how many units arrived for each variant. The new quantity will be
            <strong className="text-fg"> added on top</strong> of the current stock.
          </p>

          {/* Variant rows */}
          <div className="space-y-2">
            {variants.map((v: any) => {
              const label   = [v.size, v.color].filter(Boolean).join(' / ') || 'Default'
              const current = currentStock(v)
              const adding  = Number(quantities[v.id] || 0)
              return (
                <div key={v.id} className="flex items-center gap-3 bg-surface2 border border-border rounded-xl px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-fg truncate">{label}</div>
                    <div className="text-xs text-muted font-mono">{v.sku}</div>
                  </div>
                  {/* Current → New */}
                  <div className="text-xs text-center">
                    <div className={clsx('font-mono font-semibold', current <= 0 ? 'text-rose' : 'text-muted')}>{current}</div>
                    <div className="text-muted/50 text-[10px]">now</div>
                  </div>
                  {adding > 0 && (
                    <>
                      <div className="text-muted text-xs">→</div>
                      <div className="text-xs text-center">
                        <div className="font-mono font-semibold text-jade">{current + adding}</div>
                        <div className="text-muted/50 text-[10px]">after</div>
                      </div>
                    </>
                  )}
                  <input
                    type="number" min={0}
                    value={quantities[v.id]}
                    onChange={e => setQuantities(prev => ({ ...prev, [v.id]: e.target.value }))}
                    placeholder="+ qty"
                    className="input w-20 text-center font-mono text-sm py-1.5"
                  />
                </div>
              )
            })}
          </div>

          {/* Note */}
          <div>
            <label className="text-xs text-muted mb-1 block">Note (optional)</label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Supplier delivery, batch #12"
              className="input w-full text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm py-2">Cancel</button>
          <button
            onClick={() => restockMut.mutate()}
            disabled={restockMut.isPending || Object.values(quantities).every(q => !q || Number(q) === 0)}
            className="btn-primary flex-1 text-sm py-2 flex items-center justify-center gap-2 disabled:opacity-50">
            <PackagePlus size={14} />
            {restockMut.isPending ? 'Saving…' : 'Add Stock'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Auto-generation helpers ──────────────────────────────────────────────────

/** Generate a SKU base from brand + product name
 *  e.g. AVERO + "Classic Tee" → "AVR-CLS-001" */
function generateSkuBase(brand: string, name: string, count = 1): string {
  const brandPrefix = brand === 'AVERO' ? 'AVR' : 'JNZ'
  const words       = name.trim().toUpperCase().split(/\s+/).filter(Boolean)
  const nameCode    = words.length >= 2
    ? words[0].slice(0, 2) + words[1].slice(0, 2)   // "CLASSIC TEE" → "CLTE"
    : words[0]?.slice(0, 4) ?? 'PROD'
  const num = String(count).padStart(3, '0')
  return `${brandPrefix}-${nameCode}-${num}`
}

/** Generate an EAN-13 barcode with valid check digit */
function generateEAN13(): string {
  // 12 random digits (country code 860 = Uzbekistan)
  const digits = [8, 6, 0, ...Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))]
  // EAN-13 check digit
  const sum = digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0)
  const check = (10 - (sum % 10)) % 10
  return [...digits, check].join('')
}

// ─── Code 128B Barcode Generator ──────────────────────────────────────────────
const C128: string[] = [
  "11011001100","11001101100","11001100110","10010011000","10010001100",
  "10001001100","10011001000","10011000100","10001100100","11001001000",
  "11001000100","11000100100","10110011100","10011011100","10011001110",
  "10111001100","10011101100","10011100110","11001110010","11001011100",
  "11001001110","11011100100","11001110100","11101101110","11101001100",
  "11100101100","11100100110","11101100100","11100110100","11100110010",
  "11011011000","11011000110","11000110110","10100011000","10001011000",
  "10001000110","10110001000","10001101000","10001100010","11010001000",
  "11000101000","11000100010","10110111000","10110001110","10001101110",
  "10111011000","10111000110","10001110110","11101110110","11010001110",
  "11000101110","11011101000","11011100010","11011101110","11101011000",
  "11101000110","11100010110","11101101000","11101100010","11100011010",
  "11101111010","11001000010","11110001010","10100110000","10100001100",
  "10010110000","10010000110","10000101100","10000100110","10110010000",
  "10110000100","10011010000","10011000010","10000110100","10000110010",
  "11000010010","11001010000","11110111010","11000010100","10001111010",
  "10100111100","10010111100","10010011110","10111100100","10011110100",
  "10011110010","11110100100","11110010100","11110010010","11101011110",
  "11011110110","11110110110","10101111000","10100011110","10001011110",
  "10111101000","10111100010","11110101000","11110100010","10111011110",
  "10111101110","11101011110","11110101110",
]

function barcodeSVG(text: string): string {
  if (!text) return ''
  const s = text.replace(/[^\x20-\x7E]/g, '').slice(0, 60)
  if (!s) return ''
  const vals = [...s].map(c => c.charCodeAt(0) - 32)
  const chk  = (104 + vals.reduce((acc, v, i) => acc + v * (i + 1), 0)) % 103
  const bits  = '11010010000' + vals.map(v => C128[v] ?? '').join('') + (C128[chk] ?? '') + '1100011101011'
  let rects = '', n = 0
  for (const b of bits) {
    if (b === '1') rects += `<rect x="${n}" y="0" width="1" height="10" fill="#000"/>`
    n++
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} 10" width="100%" style="display:block">${rects}</svg>`
}

// ─── Label sizes (thermal printer) ───────────────────────────────────────────
const PLABEL_SIZES = [
  { id: '40x25', label: '40 × 25 mm', w: 40, h: 25 },
  { id: '40x30', label: '40 × 30 mm', w: 40, h: 30 },
  { id: '58x40', label: '58 × 40 mm', w: 58, h: 40 },
  { id: '60x40', label: '60 × 40 mm', w: 60, h: 40 },
]

// ─── Label Design system ─────────────────────────────────────────────────────
interface LabelDesign {
  showBrand:      boolean
  showVariant:    boolean
  showPrice:      boolean
  showBarcode:    boolean
  showBarcodeNum: boolean
  showSku:        boolean
  showFooter:     boolean
  showDivider:    boolean
  bgColor:        string
  textColor:      string
  priceColor:     string
  mutedColor:     string
  accentColor:    string
  borderStyle:    'none' | 'solid' | 'dashed' | 'double'
  borderColor:    string
  borderRadius:   number
  accentStripe:   'none' | 'top' | 'bottom' | 'left' | 'right'
  stripeSize:     number   // mm
  priceBadge:     'none' | 'pill' | 'square'
  fontFamily:     string
  priceAlign:     'left' | 'center' | 'right'
  layout:         'standard' | 'centered' | 'price-top' | 'two-col' | 'badge'
  footerText:     string
}

const DEFAULT_DESIGN: LabelDesign = {
  showBrand: true, showVariant: true, showPrice: true,
  showBarcode: true, showBarcodeNum: true, showSku: false,
  showFooter: false, showDivider: false,
  bgColor: '#ffffff', textColor: '#111111', priceColor: '#111111',
  mutedColor: '#666666', accentColor: '#6366f1',
  borderStyle: 'solid', borderColor: '#cccccc', borderRadius: 2,
  accentStripe: 'none', stripeSize: 3,
  priceBadge: 'none',
  fontFamily: 'Arial', priceAlign: 'right',
  layout: 'standard', footerText: '',
}

const TPLS: { id: string; label: string; preview: string; design: Partial<LabelDesign> }[] = [
  {
    id: 'minimal', label: 'Minimal', preview: 'linear-gradient(135deg,#fff 60%,#f3f4f6 100%)',
    design: { bgColor: '#ffffff', textColor: '#111111', priceColor: '#111111', mutedColor: '#888888',
              accentColor: '#111111', borderStyle: 'none', borderRadius: 0, fontFamily: 'Arial',
              accentStripe: 'none', priceBadge: 'none', showDivider: false,
              showBrand: false, showSku: false, priceAlign: 'right', layout: 'standard' },
  },
  {
    id: 'classic', label: 'Classic', preview: 'linear-gradient(135deg,#fffdf4 60%,#f5e6c8 100%)',
    design: { bgColor: '#fffdf4', textColor: '#1c1c0e', priceColor: '#7c3a00', mutedColor: '#9a7a44',
              accentColor: '#b08040', borderStyle: 'solid', borderColor: '#b08040', borderRadius: 2,
              fontFamily: 'Georgia', accentStripe: 'none', priceBadge: 'none', showDivider: true,
              showBrand: true, showSku: false, priceAlign: 'right', layout: 'standard' },
  },
  {
    id: 'modern', label: 'Modern', preview: 'linear-gradient(135deg,#0f172a 60%,#1e3a5f 100%)',
    design: { bgColor: '#0f172a', textColor: '#e2e8f0', priceColor: '#fbbf24', mutedColor: '#94a3b8',
              accentColor: '#fbbf24', borderStyle: 'none', borderRadius: 3, fontFamily: 'Arial',
              accentStripe: 'left', stripeSize: 2.5, priceBadge: 'none', showDivider: false,
              showBrand: true, showSku: false, priceAlign: 'right', layout: 'standard' },
  },
  {
    id: 'bold', label: 'Bold', preview: 'linear-gradient(135deg,#fff 50%,#fee2e2 100%)',
    design: { bgColor: '#ffffff', textColor: '#111111', priceColor: '#ffffff', mutedColor: '#6b7280',
              accentColor: '#dc2626', borderStyle: 'solid', borderColor: '#fecaca', borderRadius: 2,
              fontFamily: 'Arial', accentStripe: 'top', stripeSize: 3.5, priceBadge: 'square',
              showDivider: false, showBrand: true, showSku: true, priceAlign: 'right', layout: 'standard' },
  },
  {
    id: 'luxury', label: 'Luxury', preview: 'linear-gradient(135deg,#0a0a0a 60%,#2a1f00 100%)',
    design: { bgColor: '#0a0a0a', textColor: '#d4af37', priceColor: '#d4af37', mutedColor: '#8b7355',
              accentColor: '#d4af37', borderStyle: 'solid', borderColor: '#d4af37', borderRadius: 1,
              fontFamily: 'Georgia', accentStripe: 'left', stripeSize: 2, priceBadge: 'none',
              showDivider: true, showBrand: true, showSku: false, priceAlign: 'right', layout: 'standard' },
  },
  {
    id: 'neon', label: 'Neon', preview: 'linear-gradient(135deg,#0d0d1a 60%,#001a33 100%)',
    design: { bgColor: '#0d0d1a', textColor: '#00e5ff', priceColor: '#00ff88', mutedColor: '#4466cc',
              accentColor: '#00ff88', borderStyle: 'solid', borderColor: '#00ff8840', borderRadius: 2,
              fontFamily: 'Courier New', accentStripe: 'top', stripeSize: 2, priceBadge: 'pill',
              showDivider: false, showBrand: true, showSku: false, priceAlign: 'right', layout: 'standard' },
  },
  {
    id: 'ocean', label: 'Ocean', preview: 'linear-gradient(135deg,#0c4a6e 60%,#164e63 100%)',
    design: { bgColor: '#0c4a6e', textColor: '#e0f2fe', priceColor: '#38bdf8', mutedColor: '#7dd3fc',
              accentColor: '#38bdf8', borderStyle: 'solid', borderColor: '#0284c7', borderRadius: 3,
              fontFamily: 'Arial', accentStripe: 'bottom', stripeSize: 2.5, priceBadge: 'none',
              showDivider: false, showBrand: true, showSku: false, priceAlign: 'right', layout: 'standard' },
  },
  {
    id: 'elegant', label: 'Elegant', preview: 'linear-gradient(135deg,#f8f7ff 60%,#ede9fe 100%)',
    design: { bgColor: '#f8f7ff', textColor: '#1e1b4b', priceColor: '#4f46e5', mutedColor: '#7c3aed',
              accentColor: '#818cf8', borderStyle: 'double', borderColor: '#818cf8', borderRadius: 3,
              fontFamily: 'Georgia', accentStripe: 'none', priceBadge: 'none', showDivider: true,
              showBrand: true, showSku: false, priceAlign: 'center', layout: 'centered' },
  },
  {
    id: 'forest', label: 'Forest', preview: 'linear-gradient(135deg,#14532d 60%,#052e16 100%)',
    design: { bgColor: '#14532d', textColor: '#dcfce7', priceColor: '#86efac', mutedColor: '#6ee7b7',
              accentColor: '#4ade80', borderStyle: 'none', borderRadius: 2, fontFamily: 'Georgia',
              accentStripe: 'right', stripeSize: 2.5, priceBadge: 'none', showDivider: false,
              showBrand: false, showSku: false, priceAlign: 'right', layout: 'standard' },
  },
  {
    id: 'price-first', label: 'Price First', preview: 'linear-gradient(135deg,#f0fdf4 50%,#d1fae5 100%)',
    design: { bgColor: '#f0fdf4', textColor: '#064e3b', priceColor: '#ffffff', mutedColor: '#6b7280',
              accentColor: '#059669', borderStyle: 'solid', borderColor: '#6ee7b7', borderRadius: 2,
              fontFamily: 'Arial', accentStripe: 'none', priceBadge: 'square', showDivider: false,
              showBrand: false, showSku: false, priceAlign: 'center', layout: 'price-top' },
  },
  {
    id: 'two-col', label: 'Split', preview: 'linear-gradient(90deg,#1e293b 50%,#0f172a 50%)',
    design: { bgColor: '#1e293b', textColor: '#f1f5f9', priceColor: '#fbbf24', mutedColor: '#94a3b8',
              accentColor: '#fbbf24', borderStyle: 'none', borderRadius: 2, fontFamily: 'Arial',
              accentStripe: 'none', priceBadge: 'none', showDivider: false,
              showBrand: true, showSku: true, priceAlign: 'left', layout: 'two-col' },
  },
  {
    id: 'badge', label: 'Badge', preview: 'linear-gradient(135deg,#fff 60%,#eff6ff 100%)',
    design: { bgColor: '#ffffff', textColor: '#1e3a8a', priceColor: '#ffffff', mutedColor: '#6b7280',
              accentColor: '#2563eb', borderStyle: 'solid', borderColor: '#bfdbfe', borderRadius: 3,
              fontFamily: 'Arial', accentStripe: 'top', stripeSize: 4, priceBadge: 'square',
              showDivider: false, showBrand: true, showSku: false, priceAlign: 'right', layout: 'badge' },
  },
]

const FONT_OPTS = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS']

// ─── Build thermal-ready print HTML ──────────────────────────────────────────
function buildPrintHTML(product: any, copies: Record<string, number>, sizeId: string, d: LabelDesign): string {
  const size   = PLABEL_SIZES.find(s => s.id === sizeId) ?? PLABEL_SIZES[1]
  const large  = size.w >= 58
  const namePt = large ? 8.5 : 7
  const midPt  = large ? 11  : 8.5
  const border = d.borderStyle === 'none' ? 'none' : `1px ${d.borderStyle} ${d.borderColor}`
  const labels: string[] = []

  // price badge wrapper
  const wrapPrice = (txt: string, fspt: number) => {
    if (!d.showPrice) return ''
    if (d.priceBadge === 'pill')
      return `<span style="font-size:${fspt}pt;font-weight:900;background:${d.priceColor};color:#fff;padding:0.2mm 1.5mm;border-radius:100px;display:inline-block;white-space:nowrap">${txt}</span>`
    if (d.priceBadge === 'square')
      return `<span style="font-size:${fspt}pt;font-weight:900;background:${d.accentColor};color:#fff;padding:0.2mm 1.2mm;border-radius:1mm;display:inline-block;white-space:nowrap">${txt}</span>`
    return `<span style="font-size:${fspt}pt;font-weight:900;color:${d.priceColor};white-space:nowrap">${txt}</span>`
  }

  for (const v of product.variants ?? []) {
    const count = copies[v.id] ?? 0
    if (count <= 0) continue
    const bc      = (v.barcode || v.sku || '').replace(/[^\x20-\x7E]/g, '')
    const vlbl    = [v.size, v.color].filter(Boolean).join(' / ') || 'Default'
    const priceN  = new Intl.NumberFormat('uz-UZ').format(Number(v.priceOverride ?? product.sellPrice))
    const priceS  = `${priceN} UZS`
    const pHtml   = wrapPrice(priceS, midPt)
    const bcSVG   = d.showBarcode ? barcodeSVG(bc) : ''
    const divHtml = d.showDivider
      ? `<div style="height:0.3mm;background:${d.mutedColor}40;margin:0.5mm 0"></div>` : ''

    // accent stripe
    const stripeHtml = d.accentStripe === 'none' ? '' : (() => {
      const pos: Record<string, string> = {
        top:    `top:0;left:0;right:0;height:${d.stripeSize}mm`,
        bottom: `bottom:0;left:0;right:0;height:${d.stripeSize}mm`,
        left:   `top:0;left:0;bottom:0;width:${d.stripeSize}mm`,
        right:  `top:0;right:0;bottom:0;width:${d.stripeSize}mm`,
      }
      return `<div style="position:absolute;${pos[d.accentStripe]};background:${d.accentColor}"></div>`
    })()

    const pad  = d.accentStripe === 'left'  ? `padding-left:${d.stripeSize + 1.5}mm` :
                 d.accentStripe === 'right' ? `padding-right:${d.stripeSize + 1.5}mm` :
                 d.accentStripe === 'top'   ? `padding-top:${d.stripeSize + 1}mm`    :
                 d.accentStripe === 'bottom'? `padding-bottom:${d.stripeSize + 0.5}mm` : ''
    const brd  = border
    const ctr  = d.layout === 'centered' ? 'text-align:center;align-items:center' : ''

    let inner = ''
    if (d.layout === 'two-col') {
      const left = `
        ${d.showBrand && product.brand ? `<div style="font-size:5pt;font-weight:700;letter-spacing:0.8mm;text-transform:uppercase;color:${d.mutedColor}">${product.brand}</div>` : ''}
        <div style="font-size:${namePt}pt;font-weight:700;color:${d.textColor};line-height:1.2;overflow:hidden;max-height:2.6em">${product.name}</div>
        ${d.showSku && v.sku ? `<div style="font-size:5pt;font-family:monospace;color:${d.mutedColor}">${v.sku}</div>` : ''}
        ${d.showVariant ? `<div style="font-size:5.5pt;color:${d.mutedColor}">${vlbl}</div>` : ''}
        ${pHtml ? `<div style="margin-top:0.5mm">${pHtml}</div>` : ''}
      `
      const right = `
        ${bcSVG ? `<div style="width:100%;margin-bottom:0.3mm">${bcSVG}</div>` : ''}
        ${d.showBarcodeNum && bc ? `<div style="font-size:5pt;text-align:center;font-family:monospace;color:${d.mutedColor}">${bc}</div>` : ''}
      `
      inner = `
        <div style="display:flex;height:100%;gap:1.5mm;overflow:hidden">
          <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden">${left}</div>
          <div style="width:38%;display:flex;flex-direction:column;justify-content:flex-end">${right}</div>
        </div>
      `
    } else if (d.layout === 'badge') {
      inner = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1mm">
          <div style="flex:1;overflow:hidden">
            ${d.showBrand && product.brand ? `<div style="font-size:5pt;font-weight:700;letter-spacing:0.8mm;text-transform:uppercase;color:${d.mutedColor}">${product.brand}</div>` : ''}
            <div style="font-size:${namePt}pt;font-weight:700;color:${d.textColor};line-height:1.2">${product.name}</div>
          </div>
          ${pHtml ? `<div style="flex-shrink:0">${pHtml}</div>` : ''}
        </div>
        ${d.showSku && v.sku ? `<div style="font-size:5pt;font-family:monospace;color:${d.mutedColor};margin-top:0.3mm">${v.sku}</div>` : ''}
        ${d.showVariant ? `<div style="font-size:5.5pt;color:${d.mutedColor};margin-top:0.2mm">${vlbl}</div>` : ''}
        ${divHtml}
        ${bcSVG ? `<div style="flex:1;min-height:0;margin-top:0.5mm">${bcSVG}</div>` : ''}
        ${d.showBarcodeNum && bc ? `<div style="font-size:5pt;text-align:center;font-family:monospace;color:${d.mutedColor};margin-top:0.2mm">${bc}</div>` : ''}
        ${d.showFooter && d.footerText ? `<div style="font-size:5pt;text-align:center;color:${d.mutedColor};font-style:italic">${d.footerText}</div>` : ''}
      `
    } else if (d.layout === 'price-top') {
      inner = `
        ${pHtml ? `<div style="text-align:${d.priceAlign};margin-bottom:0.3mm">${pHtml}</div>` : ''}
        <div style="font-size:${namePt}pt;font-weight:700;color:${d.textColor};line-height:1.2">${product.name}</div>
        ${d.showSku && v.sku ? `<div style="font-size:5pt;font-family:monospace;color:${d.mutedColor}">${v.sku}</div>` : ''}
        ${d.showVariant ? `<div style="font-size:5.5pt;color:${d.mutedColor}">${vlbl}</div>` : ''}
        ${divHtml}
        ${bcSVG ? `<div style="flex:1;min-height:0;margin-top:0.5mm">${bcSVG}</div>` : ''}
        ${d.showBarcodeNum && bc ? `<div style="font-size:5pt;text-align:center;font-family:monospace;color:${d.mutedColor}">${bc}</div>` : ''}
        ${d.showFooter && d.footerText ? `<div style="font-size:5pt;text-align:center;color:${d.mutedColor};font-style:italic">${d.footerText}</div>` : ''}
      `
    } else if (d.layout === 'centered') {
      inner = `
        ${d.showBrand && product.brand ? `<div style="font-size:5pt;font-weight:700;letter-spacing:0.8mm;text-transform:uppercase;color:${d.mutedColor}">${product.brand}</div>` : ''}
        <div style="font-size:${namePt}pt;font-weight:700;color:${d.textColor};line-height:1.2">${product.name}</div>
        ${d.showSku && v.sku ? `<div style="font-size:5pt;font-family:monospace;color:${d.mutedColor}">${v.sku}</div>` : ''}
        ${d.showVariant ? `<div style="font-size:5.5pt;color:${d.mutedColor}">${vlbl}</div>` : ''}
        ${pHtml ? `<div style="margin-top:0.3mm">${pHtml}</div>` : ''}
        ${divHtml}
        ${bcSVG ? `<div style="flex:1;min-height:0;margin-top:0.5mm">${bcSVG}</div>` : ''}
        ${d.showBarcodeNum && bc ? `<div style="font-size:5pt;text-align:center;font-family:monospace;color:${d.mutedColor}">${bc}</div>` : ''}
        ${d.showFooter && d.footerText ? `<div style="font-size:5pt;text-align:center;color:${d.mutedColor};font-style:italic">${d.footerText}</div>` : ''}
      `
    } else {
      // standard
      inner = `
        ${d.showBrand && product.brand ? `<div style="font-size:5pt;font-weight:700;letter-spacing:0.8mm;text-transform:uppercase;color:${d.mutedColor}">${product.brand}</div>` : ''}
        <div style="font-size:${namePt}pt;font-weight:700;color:${d.textColor};line-height:1.2">${product.name}</div>
        ${d.showSku && v.sku ? `<div style="font-size:5pt;font-family:monospace;color:${d.mutedColor}">${v.sku}</div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.4mm">
          ${d.showVariant ? `<span style="font-size:5.5pt;color:${d.mutedColor}">${vlbl}</span>` : '<span></span>'}
          ${pHtml ? `<span style="text-align:${d.priceAlign}">${pHtml}</span>` : ''}
        </div>
        ${divHtml}
        ${bcSVG ? `<div style="flex:1;min-height:0;margin-top:0.6mm">${bcSVG}</div>` : ''}
        ${d.showBarcodeNum && bc ? `<div style="font-size:5pt;text-align:center;font-family:monospace;color:${d.mutedColor}">${bc}</div>` : ''}
        ${d.showFooter && d.footerText ? `<div style="font-size:5pt;text-align:center;color:${d.mutedColor};font-style:italic">${d.footerText}</div>` : ''}
      `
    }

    const one = `
<div class="lbl" style="border:${brd};border-radius:${d.borderRadius}mm;background:${d.bgColor};color:${d.textColor};${pad};${ctr}">
  ${stripeHtml}
  ${inner}
</div>`
    for (let i = 0; i < count; i++) labels.push(one)
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Labels — ${product.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
@page{size:${size.w}mm ${size.h}mm;margin:0}
body{font-family:'${d.fontFamily}',Arial,sans-serif;-webkit-print-color-adjust:exact;color-adjust:exact}
.lbl{width:${size.w}mm;height:${size.h}mm;padding:1.5mm 2mm;page-break-after:always;overflow:hidden;position:relative;display:flex;flex-direction:column;justify-content:space-between}
.lbl:last-child{page-break-after:avoid}
</style></head>
<body>${labels.join('\n')}</body></html>`
}

// ─── Print Labels Modal ───────────────────────────────────────────────────────
function PrintLabelsModal({ product, onClose }: { product: any; onClose: () => void }) {
  const [tab, setTab]           = useState<'setup' | 'design'>('setup')
  const [sizeId, setSizeId]     = useState('40x30')
  const [copies, setCopies]     = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    ;(product.variants ?? []).forEach((v: any) => { init[v.id] = 1 })
    return init
  })
  const [previewV, setPreviewV] = useState<any>((product.variants ?? [])[0] ?? null)
  const [design, setDesign]     = useState<LabelDesign>({ ...DEFAULT_DESIGN })
  const [activeTemplate, setActiveTemplate] = useState('minimal')

  const size        = PLABEL_SIZES.find(s => s.id === sizeId) ?? PLABEL_SIZES[1]
  const PX_PER_MM   = 3.7795
  const previewW    = size.w * PX_PER_MM
  const previewH    = size.h * PX_PER_MM
  const totalCopies = Object.values(copies).reduce((s, c) => s + c, 0)
  const allOn       = (product.variants ?? []).every((v: any) => (copies[v.id] ?? 0) > 0)

  const setD = (patch: Partial<LabelDesign>) => setDesign(prev => ({ ...prev, ...patch }))

  const applyTemplate = (tplId: string) => {
    const tpl = TPLS.find(t => t.id === tplId)
    if (tpl) { setDesign(prev => ({ ...prev, ...tpl.design })); setActiveTemplate(tplId) }
  }

  const toggleAll = () => {
    const newVal: Record<string, number> = {}
    ;(product.variants ?? []).forEach((v: any) => { newVal[v.id] = allOn ? 0 : 1 })
    setCopies(newVal)
  }

  const handlePrint = () => {
    if (totalCopies === 0) return toast.error('Select at least one label to print')
    const html = buildPrintHTML(product, copies, sizeId, design)
    const w = window.open('', '_blank', 'width=640,height=480')
    if (!w) { toast.error('Pop-up blocked. Allow pop-ups and try again.'); return }
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 400)
  }

  // ── Toggle switch helper ────────────────────────────────────────────────────
  const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-fg">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!on)}
        className={clsx(
          'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
          on ? 'bg-indigo-500' : 'bg-surface2 border border-border'
        )}
      >
        <span className={clsx(
          'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
          on ? 'translate-x-4' : 'translate-x-0.5'
        )} />
      </button>
    </div>
  )

  // ── Color picker row ────────────────────────────────────────────────────────
  const ColorRow = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-fg">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted font-mono">{value}</span>
        <input
          type="color" value={value}
          onChange={e => onChange(e.target.value)}
          className="w-7 h-7 rounded-lg cursor-pointer border border-border p-0.5 bg-surface2"
        />
      </div>
    </div>
  )

  // ── Live label preview (React) ──────────────────────────────────────────────
  const renderPreview = () => {
    if (!previewV) return <div className="text-muted text-sm">No variant selected</div>

    const bc      = previewV.barcode || previewV.sku || ''
    const vlbl    = [previewV.size, previewV.color].filter(Boolean).join(' / ') || 'Default'
    const priceN  = new Intl.NumberFormat('uz-UZ').format(Number(previewV.priceOverride ?? product.sellPrice))
    const priceTxt = `${priceN} UZS`
    const large   = size.w >= 58
    const namePx  = large ? 9 : 7.5
    const pricePx = large ? 12 : 9.5
    const d       = design

    // stripe padding compensation
    const stripePad: React.CSSProperties = {}
    if (d.accentStripe === 'left')   stripePad.paddingLeft   = d.stripeSize * PX_PER_MM + 4
    if (d.accentStripe === 'right')  stripePad.paddingRight  = d.stripeSize * PX_PER_MM + 4
    if (d.accentStripe === 'top')    stripePad.paddingTop    = d.stripeSize * PX_PER_MM + 4
    if (d.accentStripe === 'bottom') stripePad.paddingBottom = d.stripeSize * PX_PER_MM + 2

    const stripeStyle: React.CSSProperties = (() => {
      const base: React.CSSProperties = { position: 'absolute', background: d.accentColor, flexShrink: 0 }
      if (d.accentStripe === 'top')    return { ...base, top: 0, left: 0, right: 0, height: d.stripeSize * PX_PER_MM }
      if (d.accentStripe === 'bottom') return { ...base, bottom: 0, left: 0, right: 0, height: d.stripeSize * PX_PER_MM }
      if (d.accentStripe === 'left')   return { ...base, top: 0, left: 0, bottom: 0, width: d.stripeSize * PX_PER_MM }
      if (d.accentStripe === 'right')  return { ...base, top: 0, right: 0, bottom: 0, width: d.stripeSize * PX_PER_MM }
      return {}
    })()

    // price badge renderer
    const PriceEl = () => {
      if (!d.showPrice) return null
      const base: React.CSSProperties = { fontWeight: 900, whiteSpace: 'nowrap', flexShrink: 0 }
      if (d.priceBadge === 'pill')
        return <span style={{ ...base, fontSize: pricePx, background: d.priceColor, color: '#fff', padding: '1px 6px', borderRadius: 100 }}>{priceTxt}</span>
      if (d.priceBadge === 'square')
        return <span style={{ ...base, fontSize: pricePx, background: d.accentColor, color: '#fff', padding: '1px 5px', borderRadius: 4 }}>{priceTxt}</span>
      return <span style={{ ...base, fontSize: pricePx, color: d.priceColor }}>{priceTxt}</span>
    }

    const Brand = () => d.showBrand && product.brand
      ? <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: d.mutedColor }}>{product.brand}</div>
      : null
    const Name  = () => <div style={{ fontSize: namePx, fontWeight: 700, color: d.textColor, lineHeight: 1.2, overflow: 'hidden' }}>{product.name}</div>
    const Sku   = () => d.showSku && previewV.sku
      ? <div style={{ fontSize: 5.5, fontFamily: 'monospace', color: d.mutedColor }}>{previewV.sku}</div> : null
    const Vlbl  = () => d.showVariant
      ? <div style={{ fontSize: 6.5, color: d.mutedColor }}>{vlbl}</div> : null
    const Divider = () => d.showDivider
      ? <div style={{ height: 1, background: `${d.mutedColor}40`, margin: '2px 0' }} /> : null
    const Barcode = () => d.showBarcode && bc
      ? <div style={{ flex: 1, minHeight: 0, marginTop: 2 }} dangerouslySetInnerHTML={{ __html: barcodeSVG(bc) }} /> : null
    const BcNum = () => d.showBarcodeNum && bc
      ? <div style={{ fontSize: 5.5, textAlign: 'center', color: d.mutedColor, fontFamily: 'monospace', letterSpacing: 1, marginTop: 1 }}>{bc}</div> : null
    const Footer = () => d.showFooter && d.footerText
      ? <div style={{ fontSize: 5.5, textAlign: 'center', color: d.mutedColor, fontStyle: 'italic', marginTop: 1 }}>{d.footerText}</div> : null

    const containerStyle: React.CSSProperties = {
      width: previewW, height: previewH, position: 'relative',
      background: d.bgColor, color: d.textColor,
      border: d.borderStyle === 'none' ? `1px dashed ${d.borderColor}55` : `1.5px ${d.borderStyle} ${d.borderColor}`,
      borderRadius: d.borderRadius * PX_PER_MM * 0.4,
      overflow: 'hidden', padding: '5px 7px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      fontFamily: `'${d.fontFamily}', Arial, sans-serif`,
      boxShadow: '0 8px 36px rgba(0,0,0,0.38)',
      ...stripePad,
      ...(d.layout === 'centered' ? { alignItems: 'center', textAlign: 'center' } : {}),
    }

    let body: React.ReactNode

    if (d.layout === 'two-col') {
      body = (
        <div style={{ display: 'flex', height: '100%', gap: 5, overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
            <Brand /><Name /><Sku /><Vlbl />
            <div style={{ marginTop: 2 }}><PriceEl /></div>
          </div>
          <div style={{ width: '38%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <Barcode /><BcNum />
          </div>
        </div>
      )
    } else if (d.layout === 'badge') {
      body = (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
          <div style={{ flex: 1, overflow: 'hidden' }}><Brand /><Name /></div>
          <PriceEl />
        </div>
        <Sku /><Vlbl /><Divider /><Barcode /><BcNum /><Footer />
      </>)
    } else if (d.layout === 'price-top') {
      body = (<>
        <div style={{ textAlign: d.priceAlign as any }}><PriceEl /></div>
        <Name /><Sku /><Vlbl /><Divider /><Barcode /><BcNum /><Footer />
      </>)
    } else if (d.layout === 'centered') {
      body = (<><Brand /><Name /><Sku /><Vlbl /><PriceEl /><Divider /><Barcode /><BcNum /><Footer /></>)
    } else {
      body = (<>
        <Brand /><Name /><Sku />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 1 }}>
          <Vlbl />
          <div style={{ textAlign: d.priceAlign as any }}><PriceEl /></div>
        </div>
        <Divider /><Barcode /><BcNum /><Footer />
      </>)
    }

    return (
      <div style={containerStyle}>
        {d.accentStripe !== 'none' && <div style={stripeStyle} />}
        {body}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full shadow-2xl flex flex-col" style={{ maxWidth: 860, maxHeight: '92vh' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <Printer size={16} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-fg">Print Labels</h2>
              <p className="text-xs text-muted">{product.name} · {(product.variants ?? []).length} variant{(product.variants ?? []).length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors"><X size={18} /></button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0">

          {/* ── Left panel ── */}
          <div className="flex-shrink-0 border-r border-border flex flex-col" style={{ width: 272 }}>

            {/* Tab bar */}
            <div className="flex border-b border-border flex-shrink-0">
              {(['setup', 'design'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={clsx(
                    'flex-1 py-2.5 text-xs font-semibold transition-colors capitalize',
                    tab === t ? 'text-indigo-400 border-b-2 border-indigo-500 -mb-px' : 'text-muted hover:text-fg'
                  )}
                >
                  {t === 'setup' ? '⚙ Setup' : '🎨 Design'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">

              {/* ── SETUP TAB ── */}
              {tab === 'setup' && (<>

                {/* Size */}
                <div>
                  <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Label Size</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PLABEL_SIZES.map(s => (
                      <button key={s.id} onClick={() => setSizeId(s.id)}
                        className={clsx(
                          'text-xs px-2 py-2 rounded-xl border transition-all text-center font-medium',
                          sizeId === s.id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-border text-muted hover:border-indigo-400/40 hover:text-fg'
                        )}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Copies */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-semibold text-muted uppercase tracking-widest">Copies per Variant</div>
                    <button onClick={toggleAll} className="text-[10px] text-indigo-400 hover:underline">
                      {allOn ? 'Clear all' : 'Select all'}
                    </button>
                  </div>
                  {/* Quick-set all */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] text-muted">Set all:</span>
                    {[1, 2, 5, 10, 25].map(n => (
                      <button key={n}
                        onClick={() => {
                          const nv: Record<string, number> = {}
                          ;(product.variants ?? []).forEach((v: any) => { nv[v.id] = n })
                          setCopies(nv)
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-md border border-border text-muted hover:border-indigo-400/50 hover:text-indigo-400 transition-colors font-mono">
                        ×{n}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {(product.variants ?? []).map((v: any) => {
                      const vlbl = [v.size, v.color].filter(Boolean).join(' / ') || 'Default'
                      const qty  = copies[v.id] ?? 0
                      return (
                        <div key={v.id} onClick={() => setPreviewV(v)}
                          className={clsx(
                            'flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all select-none',
                            previewV?.id === v.id ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-border hover:border-indigo-400/30'
                          )}>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-fg truncate leading-tight">{vlbl}</div>
                            <div className="text-[10px] text-muted font-mono truncate">{v.sku}</div>
                          </div>
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setCopies(p => ({ ...p, [v.id]: Math.max(0, qty - 1) }))}
                              className="w-6 h-6 rounded-lg bg-surface2 border border-border flex items-center justify-center text-muted hover:text-fg hover:border-indigo-400/40 transition-colors">
                              <MinusCircle size={11} />
                            </button>
                            <span className={clsx('w-6 text-center text-xs font-bold font-mono', qty === 0 ? 'text-muted' : 'text-fg')}>{qty}</span>
                            <button onClick={() => setCopies(p => ({ ...p, [v.id]: qty + 1 }))}
                              className="w-6 h-6 rounded-lg bg-surface2 border border-border flex items-center justify-center text-muted hover:text-fg hover:border-indigo-400/40 transition-colors">
                              <PlusCircle size={11} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>)}

              {/* ── DESIGN TAB ── */}
              {tab === 'design' && (<>

                {/* Templates */}
                <div>
                  <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Templates</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TPLS.map(tpl => (
                      <button key={tpl.id} onClick={() => applyTemplate(tpl.id)}
                        className={clsx(
                          'text-[10px] py-1.5 px-1 rounded-xl border transition-all flex flex-col items-center gap-1',
                          activeTemplate === tpl.id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-border text-muted hover:border-indigo-400/30 hover:text-fg'
                        )}>
                        <span className="w-full h-7 rounded-lg flex-shrink-0 border border-white/10"
                          style={{ background: tpl.preview }} />
                        <span className="leading-tight text-center font-medium">{tpl.label}</span>
                        {activeTemplate === tpl.id && <Check size={8} className="text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Layout */}
                <div>
                  <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Layout</div>
                  <div className="grid grid-cols-3 gap-1 mb-1.5">
                    {([
                      { id: 'standard',  label: 'Standard',    icon: '▤' },
                      { id: 'centered',  label: 'Centered',    icon: '▥' },
                      { id: 'price-top', label: 'Price First', icon: '▲' },
                      { id: 'two-col',   label: 'Split',       icon: '▐' },
                      { id: 'badge',     label: 'Badge',       icon: '◈' },
                    ] as const).map(l => (
                      <button key={l.id} onClick={() => setD({ layout: l.id })}
                        className={clsx(
                          'text-[10px] py-2 px-1 rounded-xl border transition-all flex flex-col items-center gap-0.5',
                          design.layout === l.id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-border text-muted hover:border-indigo-400/30 hover:text-fg'
                        )}>
                        <span className="text-sm leading-none">{l.icon}</span>
                        <span className="leading-tight text-center">{l.label}</span>
                      </button>
                    ))}
                  </div>
                  {design.showPrice && (
                    <div className="flex gap-1">
                      {(['left', 'center', 'right'] as const).map(a => (
                        <button key={a} onClick={() => setD({ priceAlign: a })}
                          className={clsx(
                            'flex-1 text-[10px] py-1 rounded-lg border capitalize transition-all',
                            design.priceAlign === a ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-border text-muted hover:text-fg'
                          )}>
                          ↔ {a}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Visibility */}
                <div>
                  <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-1">Show / Hide</div>
                  <div className="space-y-0.5 divide-y divide-border/40">
                    <Toggle on={design.showBrand}      onChange={v => setD({ showBrand: v })}      label="Brand name" />
                    <Toggle on={design.showVariant}    onChange={v => setD({ showVariant: v })}    label="Variant (size / color)" />
                    <Toggle on={design.showPrice}      onChange={v => setD({ showPrice: v })}      label="Price" />
                    <Toggle on={design.showBarcode}    onChange={v => setD({ showBarcode: v })}    label="Barcode" />
                    <Toggle on={design.showBarcodeNum} onChange={v => setD({ showBarcodeNum: v })} label="Barcode number" />
                    <Toggle on={design.showSku}        onChange={v => setD({ showSku: v })}        label="SKU code" />
                    <Toggle on={design.showDivider}    onChange={v => setD({ showDivider: v })}    label="Divider line" />
                    <Toggle on={design.showFooter}     onChange={v => setD({ showFooter: v })}     label="Footer text" />
                  </div>
                </div>

                {/* Colors */}
                <div>
                  <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-1">Colors</div>
                  <div className="divide-y divide-border/40">
                    <ColorRow label="Background"  value={design.bgColor}     onChange={v => { setD({ bgColor: v });     setActiveTemplate('') }} />
                    <ColorRow label="Text"        value={design.textColor}   onChange={v => { setD({ textColor: v });   setActiveTemplate('') }} />
                    <ColorRow label="Price"       value={design.priceColor}  onChange={v => { setD({ priceColor: v });  setActiveTemplate('') }} />
                    <ColorRow label="Subtle text" value={design.mutedColor}  onChange={v => { setD({ mutedColor: v });  setActiveTemplate('') }} />
                    <ColorRow label="Accent"      value={design.accentColor} onChange={v => { setD({ accentColor: v }); setActiveTemplate('') }} />
                  </div>
                </div>

                {/* Accent stripe */}
                <div>
                  <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Accent Stripe</div>
                  <div className="grid grid-cols-5 gap-1 mb-2">
                    {(['none', 'top', 'bottom', 'left', 'right'] as const).map(pos => (
                      <button key={pos} onClick={() => setD({ accentStripe: pos })}
                        className={clsx(
                          'text-[10px] py-1.5 rounded-lg border capitalize transition-all',
                          design.accentStripe === pos ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-border text-muted hover:text-fg'
                        )}>
                        {pos === 'none' ? '✕' : pos}
                      </button>
                    ))}
                  </div>
                  {design.accentStripe !== 'none' && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs text-fg">Thickness (mm)</span>
                      <div className="flex items-center gap-2">
                        <input type="range" min={1} max={8} step={0.5} value={design.stripeSize}
                          onChange={e => setD({ stripeSize: Number(e.target.value) })}
                          className="w-20 accent-indigo-500" />
                        <span className="text-[10px] text-muted w-5 text-right">{design.stripeSize}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Price badge */}
                <div>
                  <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Price Style</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { id: 'none',   label: 'Plain text' },
                      { id: 'pill',   label: '● Pill' },
                      { id: 'square', label: '■ Box' },
                    ] as const).map(ps => (
                      <button key={ps.id} onClick={() => setD({ priceBadge: ps.id })}
                        className={clsx(
                          'text-[10px] py-2 rounded-xl border transition-all text-center',
                          design.priceBadge === ps.id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-border text-muted hover:border-indigo-400/30 hover:text-fg'
                        )}>
                        {ps.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Border */}
                <div>
                  <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Border</div>
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    {(['none', 'solid', 'dashed', 'double'] as const).map(bs => (
                      <button key={bs} onClick={() => setD({ borderStyle: bs })}
                        className={clsx(
                          'text-[10px] py-1.5 rounded-lg border capitalize transition-all',
                          design.borderStyle === bs ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-border text-muted hover:text-fg'
                        )}>
                        {bs}
                      </button>
                    ))}
                  </div>
                  {design.borderStyle !== 'none' && (
                    <div className="divide-y divide-border/40">
                      <ColorRow label="Border color" value={design.borderColor} onChange={v => setD({ borderColor: v })} />
                      <div className="flex items-center justify-between py-1">
                        <span className="text-xs text-fg">Radius (mm)</span>
                        <div className="flex items-center gap-2">
                          <input type="range" min={0} max={5} step={0.5} value={design.borderRadius}
                            onChange={e => setD({ borderRadius: Number(e.target.value) })}
                            className="w-20 accent-indigo-500" />
                          <span className="text-[10px] text-muted w-5 text-right">{design.borderRadius}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Typography */}
                <div>
                  <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Font</div>
                  <select value={design.fontFamily} onChange={e => setD({ fontFamily: e.target.value })}
                    className="input w-full text-xs">
                    {FONT_OPTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                  </select>
                </div>

                {/* Footer text */}
                {design.showFooter && (
                  <div>
                    <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-1.5">Footer Text</div>
                    <input value={design.footerText} onChange={e => setD({ footerText: e.target.value })}
                      placeholder="e.g. Thank you! · avero.uz"
                      className="input w-full text-xs" maxLength={48} />
                  </div>
                )}

              </>)}
            </div>
          </div>

          {/* ── Right panel: live preview ── */}
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 min-w-0"
            style={{ background: 'repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(255,255,255,0.01) 10px,rgba(255,255,255,0.01) 20px)' }}>
            <div className="text-[10px] font-semibold text-muted uppercase tracking-widest">
              Preview · {size.label}
            </div>
            <div className="flex items-center justify-center" style={{ minHeight: previewH + 20 }}>
              {renderPreview()}
            </div>
            <div className="text-[11px] text-muted text-center leading-relaxed">
              {tab === 'setup' ? 'Click a variant row to preview it here' : 'Changes apply to all labels instantly'}<br />
              <span className="text-indigo-400 font-semibold">{totalCopies}</span> label{totalCopies !== 1 ? 's' : ''} queued
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border flex-shrink-0">
          <div className="text-xs text-muted">
            {totalCopies} label{totalCopies !== 1 ? 's' : ''} · {size.label} · {design.fontFamily}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost text-sm px-4 py-2">Cancel</button>
            <button
              onClick={handlePrint}
              disabled={totalCopies === 0}
              className="flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#6366f1', color: '#fff', border: 'none' }}
            >
              <Printer size={14} />
              Print {totalCopies > 0 ? `${totalCopies} Label${totalCopies !== 1 ? 's' : ''}` : 'Labels'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface VariantRow {
  sku:           string
  barcode:       string
  size:          string
  color:         string
  colorHex:      string
  priceOverride: string
  stock:         Record<string, string>   // branchId → quantity
}

const emptyVariant = (): VariantRow => ({
  sku: '', barcode: '', size: '', color: '', colorHex: '#000000', priceOverride: '', stock: {},
})

interface ProductForm {
  name:            string
  brand:           'AVERO' | 'JANZE'
  categoryId:      string
  skuBase:         string
  costPrice:       string
  sellPrice:       string
  description:     string
  isFlexiblePrice: boolean
  variants:        VariantRow[]
}

const emptyForm = (): ProductForm => ({
  name: '', brand: 'AVERO', categoryId: '', skuBase: '',
  costPrice: '', sellPrice: '', description: '',
  isFlexiblePrice: false,
  variants: [emptyVariant()],
})

// ─── Product Form Modal ───────────────────────────────────────────────────────
function ProductModal({
  product,
  categories,
  onClose,
}: {
  product:    any | null   // null = create mode
  categories: any[]
  onClose:    () => void
}) {
  const qc     = useQueryClient()
  const t      = useT()
  const isEdit = !!product

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn:  () => branchesApi.list(),
  })

  const [form, setForm] = useState<ProductForm>(() => {
    if (product) {
      return {
        name:            product.name            ?? '',
        brand:           product.brand           ?? 'AVERO',
        categoryId:      product.categoryId      ?? '',
        skuBase:         product.skuBase         ?? '',
        costPrice:       String(product.costPrice  ?? ''),
        sellPrice:       String(product.sellPrice  ?? ''),
        description:     product.description     ?? '',
        isFlexiblePrice: product.isFlexiblePrice ?? false,
        variants:        product.variants?.length
          ? product.variants.map((v: any) => ({
              sku:           v.sku          ?? '',
              barcode:       v.barcode      ?? '',
              size:          v.size         ?? '',
              color:         v.color        ?? '',
              colorHex:      v.colorHex     ?? '#000000',
              priceOverride: v.priceOverride ? String(v.priceOverride) : '',
              stock:         {},   // stock edits handled in Inventory module
            }))
          : [emptyVariant()],
      }
    }
    return emptyForm()
  })

  const set = (field: keyof ProductForm, value: any) =>
    setForm(f => ({ ...f, [field]: value }))

  const setVariant = (idx: number, field: keyof VariantRow, value: any) =>
    setForm(f => {
      const variants = [...f.variants]
      variants[idx] = { ...variants[idx], [field]: value }
      return { ...f, variants }
    })

  const addVariant    = () => setForm(f => ({ ...f, variants: [...f.variants, emptyVariant()] }))
  const removeVariant = (idx: number) =>
    setForm(f => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) }))

  // Auto-generate SKU for each variant when skuBase changes
  const autoFillSKUs = () => {
    if (!form.skuBase) return
    setForm(f => ({
      ...f,
      variants: f.variants.map((v, i) => ({
        ...v,
        sku: v.sku || `${f.skuBase}-V${i + 1}`,
      })),
    }))
  }

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      isEdit ? productsApi.update(product.id, payload) : productsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success(isEdit ? t.notifications.updated : t.notifications.created)
      onClose()
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message ?? t.errors.saveFailed),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim())                      return toast.error(t.products.productName + ' — ' + t.errors.required)
    if (!form.skuBase.trim())                   return toast.error(t.products.skuBase + ' — ' + t.errors.required)
    if (form.costPrice === '' || form.costPrice === undefined)
                                                return toast.error(t.products.costPrice + ' — ' + t.errors.required)
    if (form.sellPrice === '' || form.sellPrice === undefined)
                                                return toast.error(t.products.sellPrice + ' — ' + t.errors.required)
    if (Number(form.sellPrice) <= 0)            return toast.error('Sell price must be greater than 0')
    if (form.variants.some(v => !v.sku.trim())) return toast.error(t.products.sku + ' — ' + t.errors.required)

    const basePayload = {
      name:            form.name.trim(),
      brand:           form.brand,
      categoryId:      form.categoryId || null,
      skuBase:         form.skuBase.trim(),
      costPrice:       Number(form.costPrice),
      sellPrice:       Number(form.sellPrice),
      isFlexiblePrice: form.isFlexiblePrice,
      description:     form.description.trim() || null,
      imageUrls:       product?.imageUrls ?? [],
      tags:            [],
    }

    const payload = isEdit
      ? basePayload   // on edit: only update product-level fields, not variants
      : {
          ...basePayload,
          variants: form.variants.map(v => ({
            sku:           v.sku.trim(),
            barcode:       v.barcode.trim() || null,
            size:          v.size.trim()    || null,
            color:         v.color.trim()   || null,
            colorHex:      v.colorHex       || null,
            priceOverride: v.priceOverride  ? Number(v.priceOverride) : null,
            stock:         Object.fromEntries(
              Object.entries(v.stock ?? {}).map(([k, val]) => [k, Number(val)])
            ),
          })),
        }

    saveMutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-bold">{isEdit ? t.products.editProduct : t.products.addProduct}</h2>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">{t.products.productName} *</label>
              <input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Classic Tee"
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="label">{t.products.brand} *</label>
              <select value={form.brand} onChange={e => set('brand', e.target.value as any)} className="input w-full">
                <option value="AVERO">AVERO</option>
                <option value="JANZE">JANZE</option>
              </select>
            </div>

            <div>
              <label className="label">{t.products.category}</label>
              <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)} className="input w-full">
                <option value="">{t.products.noCategory}</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">{t.products.skuBase} *</label>
              <div className="flex gap-2">
                <input
                  value={form.skuBase}
                  onChange={e => set('skuBase', e.target.value)}
                  onBlur={autoFillSKUs}
                  placeholder="e.g. AVR-TEE-002"
                  className="input flex-1 font-mono"
                  required
                />
                <button
                  type="button"
                  title="Auto-generate SKU from brand + name"
                  onClick={() => {
                    if (!form.name) return toast.error(t.products.productName + ' ' + t.errors.required)
                    const base = generateSkuBase(form.brand, form.name, Math.floor(Math.random() * 900) + 100)
                    set('skuBase', base)
                    setForm(f => ({
                      ...f,
                      skuBase: base,
                      variants: f.variants.map((v, i) => ({
                        ...v,
                        sku: v.sku || `${base}-V${i + 1}`,
                      })),
                    }))
                    toast.success('SKU generated!')
                  }}
                  className="px-3 py-2 bg-surface2 border border-border rounded-lg hover:border-gold/50 hover:text-gold transition-colors flex items-center gap-1 text-xs text-muted"
                >
                  <Wand2 size={13} /> Auto
                </button>
              </div>
            </div>

            <div>
              <label className="label">{t.products.costPrice} *</label>
              <input
                value={form.costPrice}
                onChange={e => set('costPrice', e.target.value)}
                type="number" min="0" placeholder="0"
                className="input w-full font-mono"
                required
              />
            </div>

            <div>
              <label className="label">{t.products.sellPrice} *</label>
              <input
                value={form.sellPrice}
                onChange={e => set('sellPrice', e.target.value)}
                type="number" min="0" placeholder="0"
                className="input w-full font-mono"
                required
              />
            </div>

            {form.costPrice && form.sellPrice && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">{t.products.margin}:</span>
                <span className={clsx(
                  'font-mono font-semibold',
                  Number(form.sellPrice) > Number(form.costPrice) ? 'text-jade' : 'text-rose'
                )}>
                  {(((Number(form.sellPrice) - Number(form.costPrice)) / Number(form.sellPrice)) * 100).toFixed(1)}%
                </span>
                <span className="text-muted text-xs">
                  ({fmt.compact(Number(form.sellPrice) - Number(form.costPrice))} {t.products.profit})
                </span>
              </div>
            )}

            {/* Flexible Price toggle — editable only from product edit page */}
            <div className="col-span-2">
              <div className={clsx(
                'flex items-center justify-between p-3 rounded-xl border transition-colors',
                form.isFlexiblePrice
                  ? 'border-gold/40 bg-gold-dim'
                  : 'border-border bg-surface2'
              )}>
                <div className="flex items-center gap-2">
                  <Zap size={15} className={form.isFlexiblePrice ? 'text-gold' : 'text-muted'} />
                  <div>
                    <div className={clsx('text-sm font-medium', form.isFlexiblePrice ? 'text-gold' : 'text-fg')}>
                      Flexible Price
                    </div>
                    <div className="text-xs text-muted">
                      {form.isFlexiblePrice
                        ? 'Seller enters price at time of sale'
                        : 'Uses fixed sell price above'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => set('isFlexiblePrice', !form.isFlexiblePrice)}
                  className={clsx(
                    'w-10 h-5 rounded-full transition-colors relative flex-shrink-0',
                    form.isFlexiblePrice ? 'bg-gold' : 'bg-surface border border-border'
                  )}
                >
                  <span className={clsx(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    form.isFlexiblePrice ? 'translate-x-5' : 'translate-x-0.5'
                  )} />
                </button>
              </div>
            </div>

            <div className="col-span-2">
              <label className="label">{t.products.description}</label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Optional product description…"
                rows={2}
                className="input w-full resize-none"
              />
            </div>
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">{t.products.variants} *</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  title={t.products.genBarcodes}
                  onClick={() => {
                    setForm(f => ({
                      ...f,
                      variants: f.variants.map(v => ({
                        ...v,
                        barcode: v.barcode || generateEAN13(),
                      })),
                    }))
                    toast.success('Barcodes generated!')
                  }}
                  className="flex items-center gap-1 text-xs text-muted hover:text-gold transition-colors"
                >
                  <RefreshCw size={12} /> {t.products.genBarcodes}
                </button>
                <button
                  type="button"
                  onClick={addVariant}
                  className="flex items-center gap-1 text-xs text-gold hover:underline"
                >
                  <PlusCircle size={13} /> {t.products.addVariant}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {form.variants.map((v, idx) => (
                <div key={idx} className="bg-surface2 border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted font-medium">{t.products.variant} {idx + 1}</span>
                    {form.variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(idx)}
                        className="text-rose hover:text-red-400"
                      >
                        <MinusCircle size={14} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label text-xs">{t.products.sku} *</label>
                      <input
                        value={v.sku}
                        onChange={e => setVariant(idx, 'sku', e.target.value)}
                        placeholder="AVR-TEE-002-M"
                        className="input w-full text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">{t.products.barcode}</label>
                      <div className="flex gap-1">
                        <input
                          value={v.barcode}
                          onChange={e => setVariant(idx, 'barcode', e.target.value)}
                          placeholder="8600000000000"
                          className="input flex-1 text-xs font-mono"
                        />
                        <button
                          type="button"
                          title={t.products.genBarcodes}
                          onClick={() => setVariant(idx, 'barcode', generateEAN13())}
                          className="px-2 py-1 bg-surface2 border border-border rounded-lg hover:border-gold/50 hover:text-gold transition-colors"
                        >
                          <RefreshCw size={11} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="label text-xs">{t.products.size}</label>
                      <input
                        value={v.size}
                        onChange={e => setVariant(idx, 'size', e.target.value)}
                        placeholder="S / M / L / 32 …"
                        className="input w-full text-xs"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">{t.products.color}</label>
                      <input
                        value={v.color}
                        onChange={e => setVariant(idx, 'color', e.target.value)}
                        placeholder="Black, White …"
                        className="input w-full text-xs"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">{t.products.colorHex}</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={v.colorHex}
                          onChange={e => setVariant(idx, 'colorHex', e.target.value)}
                          className="w-10 h-9 rounded border border-border bg-surface2 cursor-pointer p-0.5"
                        />
                        <input
                          value={v.colorHex}
                          onChange={e => setVariant(idx, 'colorHex', e.target.value)}
                          placeholder="#000000"
                          className="input flex-1 text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label text-xs">{t.products.priceOverride}</label>
                      <input
                        value={v.priceOverride}
                        onChange={e => setVariant(idx, 'priceOverride', e.target.value)}
                        type="number" min="0"
                        placeholder="Leave empty = base price"
                        className="input w-full text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Initial stock — always visible on create */}
                  {!isEdit && (
                    <div>
                      <label className="label text-xs mt-2">
                        {(branches as any[]).length > 0 ? t.products.stockPerBranch : t.products.initialStock}
                      </label>
                      {(branches as any[]).length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {(branches as any[]).map((b: any) => (
                            <div key={b.id} className="flex items-center gap-2">
                              <span className="text-xs text-muted w-24 truncate">{b.name}</span>
                              <input
                                type="number" min="0"
                                value={v.stock[b.id] ?? ''}
                                onChange={e => {
                                  const stock = { ...v.stock, [b.id]: e.target.value }
                                  setVariant(idx, 'stock' as any, stock)
                                }}
                                placeholder="0"
                                className="input text-xs font-mono w-20"
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min="0"
                            value={v.stock['_default'] ?? ''}
                            onChange={e => {
                              const stock = { ...v.stock, _default: e.target.value }
                              setVariant(idx, 'stock' as any, stock)
                            }}
                            placeholder="0"
                            className="input text-xs font-mono w-28"
                          />
                          <span className="text-xs text-muted">{t.products.units}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-border flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {saveMutation.isPending
              ? t.common.loading
              : isEdit ? t.products.saveChanges : t.products.createProduct
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Products Page ───────────────────────────────────────────────────────
export default function ProductsPage() {
  const branchId = useAuthStore(s => s.user?.branchId)
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(1)
  const [modalOpen, setModalOpen]     = useState(false)
  const [importOpen, setImportOpen]   = useState(false)
  const [editing, setEditing]         = useState<any | null>(null)
  const [restocking, setRestocking]   = useState<any | null>(null)
  const [printing, setPrinting]       = useState<any | null>(null)
  const qc                        = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, page],
    queryFn:  () => productsApi.list({ search: search || undefined, page, limit: 24 }),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn:  () => productsApi.categories(),
  })

  const deleteProduct = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success(t.notifications.deleted)
    },
    onError: () => toast.error(t.errors.deleteFailed),
  })

  const t        = useT()
  const products = (data as any)?.data ?? []
  const meta     = (data as any)?.meta ?? {}

  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit   = (p: any) => { setEditing(p); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  return (
    <div className="space-y-4">
      {importOpen && <ExcelImportModal onClose={() => { setImportOpen(false); qc.invalidateQueries({ queryKey: ['products'] }) }} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-fg">{t.products.title}</h1>
          {meta.total !== undefined && (
            <p className="text-sm text-muted mt-0.5">{meta.total} {t.products.title.toLowerCase()} {t.common.total.toLowerCase()}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportProductsToExcel(products)}
            disabled={products.length === 0}
            className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-2 disabled:opacity-40"
          >
            <Download size={13} /> {t.common.export} Excel
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-2 border-jade/30 text-jade hover:border-jade/60"
          >
            <FileSpreadsheet size={13} /> {t.common.import} Excel
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm px-4 py-2">
            <Plus size={14} /> {t.products.addProduct}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder={t.common.search}
          className="input pl-9"
        />
      </div>

      {/* Product grid */}
      {isLoading ? (
        <div className="text-center py-16 text-muted">{t.common.loading}</div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p>{t.common.noData}</p>
          <button onClick={openCreate} className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus size={14} /> {t.products.addProduct}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((p: any) => {
              const totalStock = p.variants?.reduce(
                (s: number, v: any) => s + (v.inventory?.reduce((q: number, i: any) => q + i.quantity, 0) ?? 0), 0
              ) ?? 0
              return (
                <div key={p.id} className="card hover:border-gold/30 transition-colors group">
                  <div className="aspect-square bg-surface2 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                    {p.imageUrls?.[0]
                      ? <img src={p.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                      : <Package size={32} className="text-muted" />
                    }
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{p.name}</div>
                      <div className="text-xs text-muted font-mono mt-0.5">{p.skuBase}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={clsx(
                          'text-xs px-1.5 py-0.5 rounded',
                          p.brand === 'AVERO' ? 'bg-gold-dim text-gold' : 'bg-purple-900/30 text-purple-400'
                        )}>
                          {p.brand}
                        </span>
                        <span className="text-xs text-muted">{p.variants?.length ?? 0} {t.products.variantsCount}</span>
                        <span className={clsx(
                          'text-xs',
                          totalStock > 5 ? 'text-jade' : totalStock > 0 ? 'text-yellow-400' : 'text-rose'
                        )}>
                          {totalStock} {t.products.inStock}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        {p.isFlexiblePrice && <Zap size={10} className="text-gold" aria-label="Flexible Price" />}
                        <div className="text-sm font-bold text-gold font-mono">{fmt.compact(p.sellPrice)}</div>
                      </div>
                      <div className="text-xs text-muted">Cost: {fmt.compact(p.costPrice)}</div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(p)}
                      className="btn-secondary flex-1 text-xs py-1.5 flex items-center justify-center gap-1"
                    >
                      <Pencil size={12} /> {t.common.edit}
                    </button>
                    <button
                      onClick={() => setRestocking(p)}
                      className="flex-1 text-xs py-1.5 rounded-lg border border-jade/30 text-jade hover:bg-jade/10 transition-colors flex items-center justify-center gap-1"
                      title="Add incoming stock"
                    >
                      <PackagePlus size={12} /> Restock
                    </button>
                    <button
                      onClick={() => setPrinting(p)}
                      className="flex-1 text-xs py-1.5 rounded-lg border transition-colors flex items-center justify-center gap-1"
                      style={{ borderColor: 'rgba(99,102,241,0.35)', color: '#818cf8' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.10)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                      title="Print barcode labels"
                    >
                      <Printer size={12} /> Label
                    </button>
                    <button
                      onClick={() => { if (confirm(`Remove "${p.name}"?`)) deleteProduct.mutate(p.id) }}
                      className="p-1.5 rounded-lg border border-border hover:border-rose hover:text-rose transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {meta.lastPage > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              {Array.from({ length: meta.lastPage }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={clsx(
                    'w-8 h-8 rounded-lg text-sm transition-colors',
                    p === page ? 'bg-gold text-bg font-bold' : 'bg-surface2 text-muted hover:bg-border'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Edit / Create Modal */}
      {modalOpen && (
        <ProductModal
          product={editing}
          categories={categories as any[]}
          onClose={closeModal}
        />
      )}

      {/* Restock Modal */}
      {restocking && branchId && (
        <RestockModal
          product={restocking}
          branchId={branchId}
          onClose={() => setRestocking(null)}
        />
      )}

      {/* Print Labels Modal */}
      {printing && (
        <PrintLabelsModal
          product={printing}
          onClose={() => setPrinting(null)}
        />
      )}
    </div>
  )
}
