/**
 * Excel / CSV utilities using SheetJS (xlsx package)
 * Install: npm install xlsx
 */
import * as XLSX from 'xlsx'

// ── Template column definitions ───────────────────────────────────────────────
export const IMPORT_COLUMNS = [
  { key: 'name',         label: 'Name *',        example: 'Classic T-Shirt',   required: true  },
  { key: 'sku',          label: 'SKU',           example: 'TSH-001',           required: false },
  { key: 'brand',        label: 'Brand',         example: 'AVERO',             required: false },
  { key: 'category',     label: 'Category',      example: 'Tops',              required: false },
  { key: 'costPrice',    label: 'Cost Price',    example: '45000',             required: false },
  { key: 'sellPrice',    label: 'Sell Price *',  example: '89000',             required: true  },
  { key: 'initialStock', label: 'Initial Stock', example: '50',                required: false },
  { key: 'size',         label: 'Size',          example: 'M',                 required: false },
  { key: 'color',        label: 'Color',         example: 'Black',             required: false },
  { key: 'barcode',      label: 'Barcode',       example: '4690612345678',     required: false },
  { key: 'description',  label: 'Description',   example: 'Cotton fabric...',  required: false },
]

// ── Validation ────────────────────────────────────────────────────────────────
export interface ImportRow {
  _rowIndex:    number
  name:         string
  sku:          string
  brand:        string
  category:     string
  costPrice:    string
  sellPrice:    string
  initialStock: string
  size:         string
  color:        string
  barcode:      string
  description:  string
  _errors:      string[]
  _valid:       boolean
}

export function validateRow(row: any, idx: number): ImportRow {
  const errors: string[] = []
  if (!row.name?.toString()?.trim())     errors.push('Name is required')
  if (!row.sellPrice && row.sellPrice !== 0) errors.push('Sell price is required')
  const sp = Number(row.sellPrice)
  if (isNaN(sp) || sp < 0)              errors.push('Sell price must be a positive number')
  const cp = Number(row.costPrice ?? 0)
  if (isNaN(cp))                         errors.push('Cost price must be a number')
  const st = Number(row.initialStock ?? 0)
  if (isNaN(st) || st < 0)              errors.push('Stock must be a non-negative number')

  return {
    _rowIndex:    idx,
    name:         row.name?.toString()?.trim()         ?? '',
    sku:          row.sku?.toString()?.trim()           ?? '',
    brand:        row.brand?.toString()?.trim()         ?? '',
    category:     row.category?.toString()?.trim()      ?? '',
    costPrice:    row.costPrice?.toString()             ?? '0',
    sellPrice:    row.sellPrice?.toString()             ?? '',
    initialStock: row.initialStock?.toString()          ?? '0',
    size:         row.size?.toString()?.trim()          ?? '',
    color:        row.color?.toString()?.trim()         ?? '',
    barcode:      row.barcode?.toString()?.trim()        ?? '',
    description:  row.description?.toString()?.trim()   ?? '',
    _errors:      errors,
    _valid:       errors.length === 0,
  }
}

// ── Parse file (xlsx or csv) ──────────────────────────────────────────────────
export async function parseExcelFile(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data  = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb    = XLSX.read(data, { type: 'array', cellDates: true })
        const ws    = wb.Sheets[wb.SheetNames[0]]
        const rows  = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[]
        // Normalise column keys: "Sell Price *" → sellPrice
        const normalised = rows.map(r => {
          const out: any = {}
          for (const col of IMPORT_COLUMNS) {
            // Match by label (with/without asterisk) or key
            const labels = [col.label, col.label.replace(' *',''), col.key]
            for (const lbl of labels) {
              if (r[lbl] !== undefined) { out[col.key] = r[lbl]; break }
            }
          }
          return out
        })
        resolve(normalised.map((r, i) => validateRow(r, i)))
      } catch (err) {
        reject(new Error('Could not parse file. Make sure it is a valid .xlsx or .csv file.'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

// ── Download template ─────────────────────────────────────────────────────────
export function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    IMPORT_COLUMNS.map(c => c.label),
    IMPORT_COLUMNS.map(c => c.example),
  ])
  // Column widths
  ws['!cols'] = IMPORT_COLUMNS.map(() => ({ wch: 18 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Products')
  XLSX.writeFile(wb, 'avero-products-template.xlsx')
}

// ── Export product list ───────────────────────────────────────────────────────
export function exportProductsToExcel(products: any[]) {
  const rows = products.flatMap((p: any) => {
    if (!p.variants?.length) {
      return [{
        Name:          p.name,
        SKU:           '',
        Brand:         p.brand ?? '',
        Category:      p.category?.name ?? '',
        'Cost Price':  p.costPrice ?? 0,
        'Sell Price':  p.sellPrice ?? 0,
        Stock:         '',
        Size:          '',
        Color:         '',
        Barcode:       '',
        Description:   p.description ?? '',
        Status:        p.isActive ? 'Active' : 'Inactive',
      }]
    }
    return p.variants.map((v: any) => {
      const stock = v.inventory?.reduce((s: number, i: any) => s + (i.quantity ?? 0), 0) ?? 0
      return {
        Name:          p.name,
        SKU:           v.sku ?? '',
        Brand:         p.brand ?? '',
        Category:      p.category?.name ?? '',
        'Cost Price':  p.costPrice ?? 0,
        'Sell Price':  v.priceOverride ?? p.sellPrice ?? 0,
        Stock:         stock,
        Size:          v.size ?? '',
        Color:         v.color ?? '',
        Barcode:       v.barcode ?? '',
        Description:   p.description ?? '',
        Status:        p.isActive ? 'Active' : 'Inactive',
      }
    })
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 25 }, { wch: 14 }, { wch: 12 }, { wch: 16 },
    { wch: 12 }, { wch: 12 }, { wch: 8  }, { wch: 8  },
    { wch: 10 }, { wch: 16 }, { wch: 30 }, { wch: 10 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Products')
  XLSX.writeFile(wb, `avero-products-${new Date().toISOString().slice(0,10)}.xlsx`)
}
