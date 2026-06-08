/**
 * LabelDesignerPage — Janze ERP Barcode Center
 *
 * Features:
 *  - Mahsulot qidirish → barcode generatsiya
 *  - Tur: Code128 / EAN-13 / QR
 *  - Live preview (Canvas)
 *  - Bulk: bir nechta mahsulot, har birini alohida chop etish
 *  - XPrint orqali 58mm label bosish
 *  - PNG yuklab olish
 *  - Qo'lda barcode kiritish (test/custom)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery }        from '@tanstack/react-query'
import { productsApi }     from '../lib/api'
import { generateBarcodeDataUrl, getQrUrl, randomEAN13, type BarcodeOptions } from '../lib/barcodeGen'
import { xprint }          from '../lib/xprint'
import { fmt }             from '../utils/format'
import toast               from 'react-hot-toast'
import clsx                from 'clsx'
import {
  Search, Download, Printer, Plus, Trash2,
  QrCode, Barcode, RefreshCw, Copy, X, ScanLine,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
type BarcodeType = 'code128' | 'ean13' | 'qr'

interface LabelItem {
  id:       string
  name:     string
  price:    number
  sku?:     string
  barcode:  string
  copies:   number
  type:     BarcodeType
}

// ── BarcodePreview ─────────────────────────────────────────────────────────────
function BarcodePreview({
  barcode, type, showText = true, size = 'md'
}: {
  barcode: string; type: BarcodeType; showText?: boolean; size?: 'sm' | 'md' | 'lg'
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [qrUrl,  setQrUrl]  = useState('')
  const [qrFail, setQrFail] = useState(false)

  const dims = { sm: { h: 40, mw: 1.5 }, md: { h: 60, mw: 2 }, lg: { h: 80, mw: 2.5 } }[size]

  useEffect(() => {
    if (!barcode) return

    if (type === 'qr') {
      setQrUrl(getQrUrl(barcode, size === 'lg' ? 200 : size === 'md' ? 150 : 100))
      setQrFail(false)
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    // Temp canvas to measure
    const tmpCanvas = document.createElement('canvas')
    tmpCanvas.width  = 800
    tmpCanvas.height = dims.h + 20
    const tmpCtx = tmpCanvas.getContext('2d')!
    tmpCtx.fillStyle = '#fff'
    tmpCtx.fillRect(0, 0, 800, dims.h + 20)

    const dataUrl = generateBarcodeDataUrl({
      text: barcode, type,
      height: dims.h, moduleW: dims.mw,
      showText,
    })

    if (!dataUrl) return

    const img = new Image()
    img.onload = () => {
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
    }
    img.src = dataUrl
  }, [barcode, type, dims.h, dims.mw, showText, size])

  if (!barcode) {
    return (
      <div className={clsx(
        'flex items-center justify-center text-muted text-xs rounded-lg border border-dashed border-border bg-surface2',
        size === 'lg' ? 'h-32 w-full' : size === 'md' ? 'h-20 w-full' : 'h-12 w-full'
      )}>
        Barcode yo'q
      </div>
    )
  }

  if (type === 'qr') {
    return qrFail ? (
      <div className="flex items-center justify-center text-muted text-xs rounded-lg border border-dashed border-border bg-surface2 h-24 w-full">
        QR xato
      </div>
    ) : (
      <img
        src={qrUrl}
        alt="QR"
        onError={() => setQrFail(true)}
        className={clsx(
          'rounded bg-white object-contain',
          size === 'lg' ? 'h-44' : size === 'md' ? 'h-28' : 'h-16'
        )}
      />
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="bg-white rounded"
      style={{ maxWidth: '100%', display: 'block' }}
    />
  )
}

// ── Label card ─────────────────────────────────────────────────────────────────
function LabelCard({
  item, onRemove, onChange, onPrint, onDownload,
}: {
  item:       LabelItem
  onRemove:   () => void
  onChange:   (patch: Partial<LabelItem>) => void
  onPrint:    () => void
  onDownload: () => void
}) {
  return (
    <div className="bg-surface2 border border-border rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{item.name}</div>
          <div className="text-xs text-muted font-mono mt-0.5">{item.barcode}</div>
        </div>
        <button onClick={onRemove} className="text-muted hover:text-rose transition-colors flex-shrink-0">
          <X size={16} />
        </button>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-lg p-3 flex items-center justify-center min-h-[80px]">
        <BarcodePreview barcode={item.barcode} type={item.type} size="md" />
      </div>

      {/* Price */}
      {item.price > 0 && (
        <div className="text-center text-gold font-bold font-mono text-sm">
          {fmt.currency(item.price)}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Type selector */}
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {(['code128','ean13','qr'] as BarcodeType[]).map(t => (
            <button
              key={t}
              onClick={() => onChange({ type: t })}
              className={clsx('px-2 py-1 font-medium transition-colors',
                item.type === t ? 'bg-gold-dim text-gold' : 'text-muted hover:text-fg'
              )}
            >
              {t === 'code128' ? '128' : t === 'ean13' ? 'EAN' : 'QR'}
            </button>
          ))}
        </div>

        {/* Copies */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => onChange({ copies: Math.max(1, item.copies - 1) })}
            className="w-6 h-6 flex items-center justify-center rounded border border-border text-muted hover:text-fg"
          >
            –
          </button>
          <span className="w-6 text-center text-sm font-medium">{item.copies}</span>
          <button
            onClick={() => onChange({ copies: Math.min(99, item.copies + 1) })}
            className="w-6 h-6 flex items-center justify-center rounded border border-border text-muted hover:text-fg"
          >
            +
          </button>
        </div>

        {/* Actions */}
        <button
          onClick={onDownload}
          className="p-1.5 rounded-lg border border-border text-muted hover:text-fg hover:border-gold/40 transition-colors"
          title="PNG yuklab olish"
        >
          <Download size={14} />
        </button>
        <button
          onClick={onPrint}
          className="p-1.5 rounded-lg border border-border text-muted hover:text-fg hover:border-gold/40 transition-colors"
          title="Printerda chop etish"
        >
          <Printer size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function LabelDesignerPage() {
  const [search,       setSearch]       = useState('')
  const [items,        setItems]        = useState<LabelItem[]>([])
  const [globalType,   setGlobalType]   = useState<BarcodeType>('code128')
  const [customInput,  setCustomInput]  = useState('')
  const [customName,   setCustomName]   = useState('')
  const [customPrice,  setCustomPrice]  = useState('')
  const [previewItem,  setPreviewItem]  = useState<LabelItem | null>(null)
  const [printing,     setPrinting]     = useState(false)

  // ── Product search ───────────────────────────────────────────
  const { data: products, isFetching } = useQuery({
    queryKey: ['products-barcode', search],
    queryFn:  () => productsApi.list({ search: search || undefined, isActive: true, limit: 30 }),
    select:   (d: any) => (d?.data ?? []) as any[],
    enabled:  search.length > 0,
  })

  // ── Add product to label list ───────────────────────────────
  const addProduct = useCallback((product: any) => {
    const barcode = product.barcode
      ?? product.variants?.[0]?.barcode
      ?? product.sku
      ?? randomEAN13()

    const newItem: LabelItem = {
      id:      product.id + '-' + Date.now(),
      name:    product.name,
      price:   product.sellPrice ?? 0,
      sku:     product.sku ?? product.variants?.[0]?.sku,
      barcode,
      copies:  1,
      type:    globalType,
    }

    setItems(prev => {
      if (prev.some(i => i.barcode === barcode)) {
        toast('Bu barcode allaqachon qo\'shilgan', { icon: 'ℹ️' })
        return prev
      }
      return [...prev, newItem]
    })
    setSearch('')
    toast.success(`"${product.name}" qo'shildi`)
  }, [globalType])

  // ── Add custom barcode ──────────────────────────────────────
  const addCustom = () => {
    const bc = customInput.trim() || randomEAN13()
    const newItem: LabelItem = {
      id:      'custom-' + Date.now(),
      name:    customName.trim() || 'Custom label',
      price:   Number(customPrice) || 0,
      barcode: bc,
      copies:  1,
      type:    globalType,
    }
    setItems(prev => [...prev, newItem])
    setCustomInput('')
    setCustomName('')
    setCustomPrice('')
    toast.success('Qo\'shildi')
  }

  // ── Update item ─────────────────────────────────────────────
  const updateItem = (id: string, patch: Partial<LabelItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  // ── Apply global type to all ────────────────────────────────
  const applyGlobalType = () => {
    setItems(prev => prev.map(i => ({ ...i, type: globalType })))
    toast.success(`Hammasi ${globalType} ga o'zgartirildi`)
  }

  // ── Download single ─────────────────────────────────────────
  const downloadItem = (item: LabelItem) => {
    if (item.type === 'qr') {
      const url = getQrUrl(item.barcode, 300)
      const a   = document.createElement('a')
      a.href    = url
      a.download = `qr-${item.barcode}.png`
      a.target  = '_blank'
      a.click()
      return
    }
    const dataUrl = generateBarcodeDataUrl({
      text:     item.barcode,
      type:     item.type,
      height:   80,
      moduleW:  2.5,
      showText: true,
    })
    if (!dataUrl) return toast.error('Barcode generatsiya xatosi')
    const a   = document.createElement('a')
    a.href    = dataUrl
    a.download = `barcode-${item.barcode}.png`
    a.click()
  }

  // ── Print single via XPrint ─────────────────────────────────
  const printItem = async (item: LabelItem) => {
    const sent = await xprint.printLabel({
      name:    item.name,
      price:   item.price,
      sku:     item.sku ?? item.barcode,
    })
    if (sent) toast.success(`"${item.name}" — ${item.copies} ta label bosildi`)
    else toast('📄 Brauzer chopi ishlatildi (XPrint yo\'q)', { icon: 'ℹ️' })
  }

  // ── Print all ───────────────────────────────────────────────
  const printAll = async () => {
    if (!items.length) return toast.error('Label yo\'q')
    setPrinting(true)
    let ok = 0
    for (const item of items) {
      for (let c = 0; c < item.copies; c++) {
        await xprint.printLabel({ name: item.name, price: item.price, sku: item.sku ?? item.barcode })
        ok++
        await new Promise(r => setTimeout(r, 150))
      }
    }
    setPrinting(false)
    toast.success(`${ok} ta label bosildi`)
  }

  // ── Browser print all (fallback) ────────────────────────────
  const browserPrintAll = () => {
    if (!items.length) return toast.error('Label yo\'q')

    const rows = items.flatMap(item => {
      const dataUrl = item.type !== 'qr'
        ? generateBarcodeDataUrl({ text: item.barcode, type: item.type, height: 60, moduleW: 2, showText: true })
        : null
      const qrSrc = item.type === 'qr' ? getQrUrl(item.barcode, 120) : null

      return Array.from({ length: item.copies }, () => `
        <div class="label">
          <div class="name">${item.name}</div>
          ${item.sku ? `<div class="sku">SKU: ${item.sku}</div>` : ''}
          ${dataUrl ? `<img src="${dataUrl}" class="barcode" />` : ''}
          ${qrSrc   ? `<img src="${qrSrc}"   class="qr"      />` : ''}
          <div class="price">${item.price > 0 ? fmt.currency(item.price) : ''}</div>
          <div class="code">${item.barcode}</div>
        </div>`)
    })

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Labels</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fff; font-family: 'Courier New', monospace; }
  .page { display: flex; flex-wrap: wrap; gap: 4mm; padding: 4mm; }
  .label {
    width: 58mm; border: 1px dashed #ccc;
    padding: 2mm 3mm; display: flex; flex-direction: column; align-items: center;
    page-break-inside: avoid;
  }
  .name  { font-size: 10px; font-weight: bold; text-align: center; word-break: break-word; margin-bottom: 2px; }
  .sku   { font-size: 8px; color: #666; margin-bottom: 2px; }
  .barcode { max-width: 100%; height: auto; margin: 2px 0; display: block; }
  .qr    { width: 30mm; height: 30mm; margin: 2px auto; display: block; }
  .price { font-size: 14px; font-weight: bold; text-align: right; width: 100%; margin-top: 2px; }
  .code  { font-size: 8px; color: #888; text-align: center; margin-top: 1px; }
  @media print {
    body { margin: 0; }
    .page { padding: 0; }
    @page { margin: 5mm; }
  }
</style></head><body>
<div class="page">${rows.join('')}</div>
<script>window.onload=function(){window.print();setTimeout(function(){window.close()},800)}<\/script>
</body></html>`

    const win = window.open('', '_blank', 'width=800,height=600,toolbar=0,menubar=0')
    if (!win) return toast.error('Popup bloklangan — ruxsat bering')
    win.document.write(html)
    win.document.close()
  }

  const totalCopies = items.reduce((s, i) => s + i.copies, 0)

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full gap-4" style={{ height: 'calc(100vh - 5rem)' }}>

      {/* ── LEFT PANEL: search + add ── */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">

        {/* Title */}
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <ScanLine size={20} className="text-gold" />
            Barcode Center
          </h1>
          <p className="text-xs text-muted mt-0.5">Label generatsiya va chop etish</p>
        </div>

        {/* Global type */}
        <div className="card p-3 space-y-2">
          <div className="text-xs font-semibold text-muted uppercase tracking-wide">Tur tanlang</div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { type: 'code128' as BarcodeType, icon: Barcode, label: 'Code 128' },
              { type: 'ean13'   as BarcodeType, icon: Barcode, label: 'EAN-13'   },
              { type: 'qr'      as BarcodeType, icon: QrCode,  label: 'QR Code'  },
            ].map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => setGlobalType(type)}
                className={clsx(
                  'flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-all',
                  globalType === type
                    ? 'border-gold bg-gold-dim text-gold'
                    : 'border-border text-muted hover:border-gold/40 hover:text-fg'
                )}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
          {items.length > 0 && (
            <button
              onClick={applyGlobalType}
              className="w-full text-xs text-muted hover:text-gold transition-colors py-1 border border-dashed border-border rounded-lg"
            >
              Hammaga qo'llash →
            </button>
          )}
        </div>

        {/* Product search */}
        <div className="card p-3 space-y-2">
          <div className="text-xs font-semibold text-muted uppercase tracking-wide">Mahsulot qidirish</div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nomi, SKU, barcode..."
              className="input pl-8 text-sm w-full"
            />
            {isFetching && <RefreshCw size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted animate-spin" />}
          </div>

          {/* Results */}
          {search.length > 0 && (
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {(products ?? []).length === 0 && !isFetching && (
                <div className="text-xs text-muted text-center py-3">Topilmadi</div>
              )}
              {(products ?? []).map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface hover:border-gold/30 border border-transparent transition-all text-sm flex items-center gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted font-mono">
                      {p.barcode ?? p.variants?.[0]?.barcode ?? p.sku ?? 'Barcode yo\'q'}
                    </div>
                  </div>
                  <Plus size={14} className="text-muted flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom barcode */}
        <div className="card p-3 space-y-2">
          <div className="text-xs font-semibold text-muted uppercase tracking-wide">Qo'lda kiritish</div>
          <input
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            placeholder="Mahsulot nomi"
            className="input text-sm w-full"
          />
          <div className="flex gap-2">
            <input
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              placeholder="Barcode (bo'sh = random)"
              className="input text-sm flex-1 font-mono"
            />
            <button
              onClick={() => setCustomInput(randomEAN13())}
              className="p-2 border border-border rounded-lg text-muted hover:text-fg transition-colors"
              title="Random EAN-13"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <input
            value={customPrice}
            onChange={e => setCustomPrice(e.target.value)}
            placeholder="Narx (ixtiyoriy)"
            type="number"
            className="input text-sm w-full"
          />
          <button onClick={addCustom} className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
            <Plus size={14} /> Qo'shish
          </button>
        </div>
      </div>

      {/* ── RIGHT PANEL: label grid + actions ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="text-sm text-muted">
            {items.length > 0
              ? <><span className="font-semibold text-fg">{items.length}</span> label · <span className="font-semibold text-fg">{totalCopies}</span> nusxa</>
              : 'Chap paneldan mahsulot qo\'shing'}
          </div>

          <div className="ml-auto flex gap-2">
            {items.length > 0 && (
              <>
                <button
                  onClick={() => setItems([])}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-rose/40 text-rose rounded-lg hover:bg-rose/5 transition-colors"
                >
                  <Trash2 size={13} /> Tozalash
                </button>
                <button
                  onClick={browserPrintAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border text-muted rounded-lg hover:text-fg hover:border-gold/40 transition-colors"
                >
                  <Printer size={13} /> Brauzer chopi
                </button>
                <button
                  onClick={printAll}
                  disabled={printing}
                  className="btn-primary flex items-center gap-1.5 px-4 text-sm disabled:opacity-60"
                >
                  {printing
                    ? <><RefreshCw size={13} className="animate-spin" /> Bosilmoqda...</>
                    : <><Printer size={13} /> XPrint ({totalCopies} ta)</>}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Grid */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-muted gap-4">
            <div className="w-20 h-20 rounded-2xl bg-surface2 border border-border flex items-center justify-center">
              <Barcode size={36} className="opacity-30" />
            </div>
            <div>
              <div className="font-medium text-fg">Label yo'q</div>
              <div className="text-sm mt-1">Chap paneldan mahsulot qidirib qo'shing</div>
              <div className="text-xs mt-0.5 text-muted">yoki barcodeni qo'lda kiriting</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {items.map(item => (
                <LabelCard
                  key={item.id}
                  item={item}
                  onRemove={() => removeItem(item.id)}
                  onChange={patch => updateItem(item.id, patch)}
                  onPrint={() => printItem(item)}
                  onDownload={() => downloadItem(item)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
