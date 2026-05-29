import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi } from '../lib/api'
import { useState } from 'react'
import { PageHeader, Badge, EmptyState, fmt } from '../components/Shared'
import { Plus, Search, Edit2, Trash2, X, Loader2, RefreshCw, Camera, Package } from 'lucide-react'
import toast from 'react-hot-toast'

const EMPTY_VARIANT = { sku: '', barcode: '', size: '', color: '', colorHex: '', priceOverride: '' }

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      className={`relative w-10 h-6 rounded-full cursor-pointer transition-colors duration-200 flex-shrink-0 ${value ? 'bg-gold' : 'bg-surface2 border border-border'}`}
    >
      <div
        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${value ? 'left-5' : 'left-1'}`}
      />
    </div>
  )
}

export default function ProductsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [brand, setBrand]   = useState('')
  const [page, setPage]     = useState(1)
  const [modal, setModal]   = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<any>(null)

  const [form, setForm] = useState<any>({
    name: '', skuBase: '', brand: 'JANZE', costPrice: '', sellPrice: '',
    description: '', categoryId: '', unit: 'dona', isActive: true, isFlexiblePrice: false,
    variants: [{ ...EMPTY_VARIANT }],
  })

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, brand, page],
    queryFn:  () => productsApi.list({ search, brand: brand || undefined, page, limit: 20 }),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories', brand],
    queryFn:  () => productsApi.categories(brand || undefined),
  })

  const createMut = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); closeModal(); toast.success('Mahsulot qo\'shildi!') },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Xatolik yuz berdi'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => productsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); closeModal(); toast.success('Mahsulot yangilandi!') },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Xatolik yuz berdi'),
  })

  const deleteMut = useMutation({
    mutationFn: productsApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Mahsulot o\'chirildi') },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Xatolik yuz berdi'),
  })

  const openAdd = () => {
    setForm({
      name: '', skuBase: '', brand: 'JANZE', costPrice: '', sellPrice: '',
      description: '', categoryId: '', unit: 'dona', isActive: true, isFlexiblePrice: false,
      variants: [{ ...EMPTY_VARIANT }],
    })
    setModal('add')
  }

  const openEdit = (p: any) => {
    setEditing(p)
    setForm({
      name: p.name, skuBase: p.skuBase, brand: p.brand, costPrice: p.costPrice,
      sellPrice: p.sellPrice, description: p.description ?? '', categoryId: p.categoryId ?? '',
      unit: p.unit ?? 'dona', isActive: p.isActive, isFlexiblePrice: p.isFlexiblePrice ?? false,
      variants: p.variants?.map((v: any) => ({
        sku: v.sku, barcode: v.barcode ?? '', size: v.size ?? '',
        color: v.color ?? '', colorHex: v.colorHex ?? '', priceOverride: v.priceOverride ?? '',
      })) ?? [{ ...EMPTY_VARIANT }],
    })
    setModal('edit')
  }

  const closeModal = () => { setModal(null); setEditing(null) }

  const autoSku = () => {
    const base = form.name.slice(0, 6).toUpperCase().replace(/\s/g, '')
    const ts = Date.now().toString().slice(-4)
    setForm((f: any) => ({ ...f, skuBase: `${base}-${ts}` }))
    toast.success('SKU yaratildi!')
  }

  const genBarcodes = () => {
    setForm((f: any) => ({
      ...f,
      variants: f.variants.map((v: any) => ({
        ...v,
        barcode: v.barcode || String(Math.floor(1000000000000 + Math.random() * 9000000000000)),
      })),
    }))
    toast.success('Barkodlar yaratildi!')
  }

  const submitForm = () => {
    if (!form.name?.trim())    return toast.error('Mahsulot nomi kiritilishi shart')
    if (!form.skuBase?.trim()) return toast.error('SKU bazasi kiritilishi shart')
    if (form.sellPrice === '' || form.sellPrice === undefined) return toast.error('Sotuv narxi kiritilishi shart')
    if (Number(form.sellPrice) <= 0) return toast.error('Sotuv narxi 0 dan katta bo\'lishi kerak')
    if (form.variants.some((v: any) => !v.sku?.trim())) return toast.error('Har bir variant uchun SKU kiritilishi shart')

    const payload = {
      ...form,
      costPrice: Number(form.costPrice || 0),
      sellPrice: Number(form.sellPrice),
      variants: form.variants.map((v: any) => ({
        ...v,
        priceOverride: v.priceOverride ? Number(v.priceOverride) : null,
      })),
    }

    if (modal === 'add') createMut.mutate(payload)
    else updateMut.mutate({ id: editing.id, data: payload })
  }

  const addVariant    = () => setForm((f: any) => ({ ...f, variants: [...f.variants, { ...EMPTY_VARIANT }] }))
  const removeVariant = (i: number) => setForm((f: any) => ({ ...f, variants: f.variants.filter((_: any, idx: number) => idx !== i) }))
  const setVariant    = (i: number, key: string, val: string) => setForm((f: any) => ({
    ...f,
    variants: f.variants.map((v: any, idx: number) => idx === i ? { ...v, [key]: val } : v),
  }))

  const products = data?.data ?? []
  const meta     = data?.meta ?? {}

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Mahsulotlar"
        subtitle={`Jami ${meta.total ?? 0} ta mahsulot`}
        action={
          <button onClick={openAdd} className="flex items-center gap-1.5 bg-gold text-bg px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gold/90">
            <Plus size={14} /> Mahsulot qo'shish
          </button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Mahsulot qidirish…"
            className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-fg placeholder:text-muted/50 focus:outline-none focus:border-gold/60" />
        </div>
        <select value={brand} onChange={e => { setBrand(e.target.value); setPage(1) }}
          className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none">
          <option value="">Barcha brendlar</option>
          <option value="JANZE">JANZE</option>
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={24} className="animate-spin text-gold" />
          </div>
        ) : products.length ? (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Mahsulot</th>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Brend</th>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">SKU Bazasi</th>
                <th className="text-right px-4 py-3 text-xs text-muted font-medium">Tan narxi</th>
                <th className="text-right px-4 py-3 text-xs text-muted font-medium">Sotuv narxi</th>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Variantlar</th>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Holat</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p: any) => (
                <tr key={p.id} className="hover:bg-surface2/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-fg">{p.name}</p>
                    {p.category && <p className="text-xs text-muted">{p.category.name}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted">{p.brand}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{p.skuBase}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted">{fmt(p.costPrice)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-gold">{fmt(p.sellPrice)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.variants?.slice(0, 4).map((v: any) => (
                        <span key={v.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface2 border border-border text-xs text-muted font-mono">
                          {v.colorHex && (
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: v.colorHex }} />
                          )}
                          {[v.size, v.color].filter(Boolean).join('/') || v.sku?.split('-').pop() || '—'}
                        </span>
                      ))}
                      {(p.variants?.length ?? 0) > 4 && (
                        <span className="text-xs text-muted">+{p.variants.length - 4}</span>
                      )}
                      {!(p.variants?.length) && <span className="text-xs text-muted">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={p.isActive ? 'green' : 'red'}>{p.isActive ? 'Faol' : 'Nofaol'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(p)} className="text-muted hover:text-fg transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => { if (confirm('Mahsulotni nofaol qilishni xohlaysizmi?')) deleteMut.mutate(p.id) }}
                        className="text-muted hover:text-rose transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Mahsulotlar topilmadi" />
        )}
      </div>

      {/* Pagination */}
      {meta.lastPage > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border text-sm text-muted">
          <span>{page}-sahifa / {meta.lastPage}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-surface2">Oldingi</button>
            <button disabled={page === meta.lastPage} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-surface2">Keyingi</button>
          </div>
        </div>
      )}

      {/* ── BILLZ-STYLE MODAL ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gold/15 flex items-center justify-center">
                  <Package size={16} className="text-gold" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-fg leading-tight">
                    {modal === 'add' ? 'Mahsulot qo\'shish' : 'Mahsulotni tahrirlash'}
                  </h2>
                  <p className="text-xs text-muted leading-tight">
                    {modal === 'add' ? 'Yangi mahsulot ma\'lumotlarini kiriting' : `${editing?.name} tahrirlash`}
                  </p>
                </div>
              </div>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-fg hover:bg-surface2 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex flex-1 overflow-hidden">

              {/* Left: image upload */}
              <div className="w-44 flex-shrink-0 border-r border-border p-5 flex flex-col gap-4">
                <div className="aspect-square bg-bg border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-gold/40 transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-surface2 flex items-center justify-center group-hover:bg-gold/10 transition-colors">
                    <Camera size={18} className="text-muted group-hover:text-gold transition-colors" />
                  </div>
                  <span className="text-xs text-muted text-center leading-tight px-2">Rasm<br/>yuklash</span>
                </div>
                <p className="text-xs text-muted/60 text-center leading-relaxed">PNG, JPG<br/>max 2 MB</p>

                {/* Status toggles */}
                <div className="mt-auto space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted">Faol</span>
                    <Toggle value={form.isActive} onChange={v => setForm((f: any) => ({ ...f, isActive: v }))} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted">Moslashuvchan narx</span>
                    <Toggle value={form.isFlexiblePrice} onChange={v => setForm((f: any) => ({ ...f, isFlexiblePrice: v }))} />
                  </div>
                </div>
              </div>

              {/* Right: form */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">

                {/* ── Section 1: Asosiy ma'lumotlar ── */}
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Asosiy ma'lumotlar</p>
                  <div className="grid grid-cols-2 gap-3">

                    {/* Name – full width */}
                    <div className="col-span-2">
                      <label className="field-label">Nomi *</label>
                      <input
                        value={form.name}
                        onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
                        className="field"
                        placeholder="Mahsulot nomi"
                        autoFocus
                      />
                    </div>

                    {/* Category */}
                    <div>
                      <label className="field-label">Kategoriya</label>
                      <select
                        value={form.categoryId}
                        onChange={e => setForm((f: any) => ({ ...f, categoryId: e.target.value }))}
                        className="field"
                      >
                        <option value="">Tanlang…</option>
                        {(categories ?? []).map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Unit */}
                    <div>
                      <label className="field-label">O'lchov birligi</label>
                      <select
                        value={form.unit}
                        onChange={e => setForm((f: any) => ({ ...f, unit: e.target.value }))}
                        className="field"
                      >
                        <option value="dona">Dona</option>
                        <option value="kg">Kilogramm (kg)</option>
                        <option value="litr">Litr</option>
                        <option value="metr">Metr</option>
                        <option value="juft">Juft</option>
                        <option value="quti">Quti</option>
                        <option value="pakет">Paket</option>
                      </select>
                    </div>

                    {/* Brand */}
                    <div>
                      <label className="field-label">Brend</label>
                      <select
                        value={form.brand}
                        onChange={e => setForm((f: any) => ({ ...f, brand: e.target.value }))}
                        className="field"
                      >
                        <option value="JANZE">JANZE</option>
                      </select>
                    </div>

                    {/* SKU Base */}
                    <div>
                      <label className="field-label">SKU Bazasi *</label>
                      <div className="flex gap-2">
                        <input
                          value={form.skuBase}
                          onChange={e => setForm((f: any) => ({ ...f, skuBase: e.target.value }))}
                          className="field flex-1"
                          placeholder="BASE-001"
                        />
                        <button
                          onClick={autoSku}
                          className="px-3 py-1.5 bg-surface2 border border-border rounded-lg text-xs text-muted hover:text-fg hover:border-gold/40 transition-colors whitespace-nowrap"
                        >
                          Auto
                        </button>
                      </div>
                    </div>

                    {/* Description – full width */}
                    <div className="col-span-2">
                      <label className="field-label">Tavsif</label>
                      <textarea
                        value={form.description}
                        onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
                        className="field resize-none h-16"
                        placeholder="Ixtiyoriy tavsif…"
                      />
                    </div>
                  </div>
                </div>

                {/* ── Section 2: Narxlar ── */}
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Narxlar</p>
                  <div className="grid grid-cols-2 gap-3">

                    {/* Cost price */}
                    <div className="bg-bg border border-border rounded-xl p-4">
                      <p className="text-xs text-muted mb-2">Tan narxi (xarid narxi)</p>
                      <div className="flex items-baseline gap-2">
                        <input
                          type="number"
                          min="0"
                          value={form.costPrice}
                          onChange={e => setForm((f: any) => ({ ...f, costPrice: e.target.value }))}
                          className="bg-transparent text-xl font-semibold text-fg outline-none w-full placeholder:text-muted/40"
                          placeholder="0"
                        />
                        <span className="text-xs text-muted flex-shrink-0">so'm</span>
                      </div>
                    </div>

                    {/* Sell price */}
                    <div className="bg-bg border border-gold/40 rounded-xl p-4">
                      <p className="text-xs text-gold mb-2">Sotuv narxi *</p>
                      <div className="flex items-baseline gap-2">
                        <input
                          type="number"
                          min="0"
                          value={form.sellPrice}
                          onChange={e => setForm((f: any) => ({ ...f, sellPrice: e.target.value }))}
                          className="bg-transparent text-xl font-semibold text-gold outline-none w-full placeholder:text-gold/30"
                          placeholder="0"
                        />
                        <span className="text-xs text-gold/60 flex-shrink-0">so'm</span>
                      </div>
                      {form.costPrice && form.sellPrice && Number(form.sellPrice) > Number(form.costPrice) && (
                        <p className="text-xs text-emerald-400 mt-1.5">
                          +{fmt(Number(form.sellPrice) - Number(form.costPrice))} foyda
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Section 3: Variantlar ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-muted uppercase tracking-widest">Variantlar va Barkodlar</p>
                    <div className="flex gap-2">
                      <button
                        onClick={genBarcodes}
                        className="flex items-center gap-1.5 text-xs text-muted hover:text-fg bg-surface2 border border-border rounded-lg px-2.5 py-1.5 transition-colors"
                      >
                        <RefreshCw size={11} /> Barkod yaratish
                      </button>
                      <button
                        onClick={addVariant}
                        className="flex items-center gap-1.5 text-xs text-gold bg-gold/10 border border-gold/30 rounded-lg px-2.5 py-1.5 hover:bg-gold/20 transition-colors"
                      >
                        <Plus size={11} /> Variant qo'shish
                      </button>
                    </div>
                  </div>

                  {/* Variant column headers */}
                  <div className="grid gap-2 px-1 mb-1.5" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
                    <span className="col-span-3 text-xs text-muted/70">SKU *</span>
                    <span className="col-span-3 text-xs text-muted/70">Barkod (EAN-13)</span>
                    <span className="col-span-2 text-xs text-muted/70">O'lcham</span>
                    <span className="col-span-2 text-xs text-muted/70">Rang</span>
                    <span className="col-span-2 text-xs text-muted/70">Alohida narx</span>
                    <span className="col-span-1" />
                  </div>

                  <div className="space-y-2">
                    {form.variants.map((v: any, i: number) => (
                      <div
                        key={i}
                        className="bg-bg border border-border rounded-xl p-2.5 grid gap-2 items-center hover:border-border/80 transition-colors"
                        style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
                      >
                        <div className="col-span-3">
                          <input
                            value={v.sku}
                            onChange={e => setVariant(i, 'sku', e.target.value)}
                            className="field text-xs font-mono"
                            placeholder={`${form.skuBase || 'SKU'}-${i + 1}`}
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            value={v.barcode}
                            onChange={e => setVariant(i, 'barcode', e.target.value)}
                            className="field text-xs font-mono"
                            placeholder="8600000000000"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            value={v.size}
                            onChange={e => setVariant(i, 'size', e.target.value)}
                            className="field text-xs"
                            placeholder="S, M, L…"
                          />
                        </div>
                        <div className="col-span-2">
                          <div className="flex gap-1 items-center">
                            <input
                              type="color"
                              value={v.colorHex || '#888888'}
                              onChange={e => setVariant(i, 'colorHex', e.target.value)}
                              className="w-7 h-7 rounded border border-border bg-bg cursor-pointer flex-shrink-0 p-0.5"
                              title="Rang tanla"
                            />
                            <input
                              value={v.color}
                              onChange={e => setVariant(i, 'color', e.target.value)}
                              className="field text-xs flex-1"
                              placeholder="Qizil…"
                            />
                          </div>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="0"
                            value={v.priceOverride}
                            onChange={e => setVariant(i, 'priceOverride', e.target.value)}
                            className="field text-xs font-mono"
                            placeholder={form.sellPrice || '—'}
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          {form.variants.length > 1 && (
                            <button
                              onClick={() => removeVariant(i)}
                              className="w-6 h-6 flex items-center justify-center rounded-md text-muted hover:text-rose hover:bg-rose/10 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted">* majburiy maydonlar</p>
              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-muted hover:text-fg border border-border rounded-lg hover:border-border/80 transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={submitForm}
                  disabled={createMut.isPending || updateMut.isPending}
                  className="px-5 py-2 bg-gold text-bg rounded-lg text-sm font-semibold hover:bg-gold/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  {(createMut.isPending || updateMut.isPending) && <Loader2 size={14} className="animate-spin" />}
                  {modal === 'add' ? 'Saqlash' : 'Yangilash'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      <style>{`
        .field {
          width: 100%;
          background: rgb(var(--color-bg));
          border: 1px solid rgb(var(--color-border));
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 13px;
          color: rgb(var(--color-fg));
          outline: none;
          transition: border-color .15s;
        }
        .field:focus { border-color: rgba(212,168,90,.6); }
        .field-label {
          display: block;
          font-size: 11px;
          color: rgb(var(--color-muted));
          margin-bottom: 6px;
        }
      `}</style>
    </div>
  )
}
