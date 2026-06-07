import { useState, useCallback, useRef } from 'react'
import { useMutation, useQueryClient }   from '@tanstack/react-query'
import { productsApi }                   from '../../lib/api'
import { parseExcelFile, downloadTemplate, ImportRow, IMPORT_COLUMNS } from '../../utils/excel'
import { useAuthStore }                  from '../../store/authStore'
import toast                             from 'react-hot-toast'
import {
  X, Upload, FileSpreadsheet, Download, CheckCircle2,
  AlertTriangle, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react'
import clsx from 'clsx'

interface Props {
  onClose: () => void
}

type Step = 'upload' | 'preview' | 'done'

export default function ExcelImportModal({ onClose }: Props) {
  const user  = useAuthStore(s => s.user)
  const qc    = useQueryClient()

  const [step,     setStep]     = useState<Step>('upload')
  const [rows,     setRows]     = useState<ImportRow[]>([])
  const [result,   setResult]   = useState<any>(null)
  const [dragging, setDragging] = useState(false)
  const [parsing,  setParsing]  = useState(false)
  const [expandErr, setExpandErr] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const validRows   = rows.filter(r => r._valid)
  const invalidRows = rows.filter(r => !r._valid)

  // ── File handling ─────────────────────────────────────────
  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx','xls','csv'].includes(ext ?? '')) {
      toast.error('Please upload an .xlsx, .xls, or .csv file')
      return
    }
    setParsing(true)
    try {
      const parsed = await parseExcelFile(file)
      if (parsed.length === 0) { toast.error('File is empty or no data rows found'); return }
      setRows(parsed)
      setStep('preview')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to parse file')
    } finally {
      setParsing(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  // ── Import mutation ───────────────────────────────────────
  const importMutation = useMutation({
    mutationFn: () => productsApi.bulkImport(
      validRows.map(r => ({
        name:         r.name,
        sku:          r.sku,
        brand:        r.brand,
        costPrice:    Number(r.costPrice)    || 0,
        sellPrice:    Number(r.sellPrice)    || 0,
        initialStock: Number(r.initialStock) || 0,
        size:         r.size,
        color:        r.color,
        barcode:      r.barcode,
        description:  r.description,
      })),
      user?.branchId
    ),
    onSuccess: (data) => {
      setResult(data)
      setStep('done')
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success(`${data.created} products imported!`)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Import failed')
    },
  })

  // ── Column label map ──────────────────────────────────────
  const colMap: Record<string, string> = Object.fromEntries(IMPORT_COLUMNS.map(c => [c.key, c.label.replace(' *','')]))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-jade/10 flex items-center justify-center">
              <FileSpreadsheet size={18} className="text-jade" />
            </div>
            <div>
              <h2 className="font-semibold text-fg text-sm">Import Products from Excel</h2>
              <p className="text-xs text-muted">Upload .xlsx or .csv to bulk-add products</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-0 px-5 py-3 border-b border-border flex-shrink-0">
          {(['upload','preview','done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && <div className={clsx('w-8 h-px', step === 'upload' ? 'bg-border' : 'bg-jade/40')} />}
              <div className={clsx(
                'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
                step === s ? 'bg-jade/15 text-jade' : i < (['upload','preview','done'] as Step[]).indexOf(step) ? 'text-jade/70' : 'text-muted'
              )}>
                <span className={clsx(
                  'w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold',
                  step === s ? 'bg-jade text-bg' : i < (['upload','preview','done'] as Step[]).indexOf(step) ? 'bg-jade/30 text-jade' : 'bg-border text-muted'
                )}>
                  {i + 1}
                </span>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Drag & drop zone */}
              <div
                onDrop={onDrop}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onClick={() => fileRef.current?.click()}
                className={clsx(
                  'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all',
                  dragging
                    ? 'border-jade bg-jade/5 scale-[1.01]'
                    : 'border-border hover:border-jade/50 hover:bg-surface2'
                )}
              >
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileInput} />
                {parsing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={36} className="text-jade animate-spin" />
                    <p className="text-sm text-muted">Parsing file…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload size={36} className={dragging ? 'text-jade' : 'text-muted'} />
                    <div>
                      <p className="font-semibold text-fg text-sm">
                        {dragging ? 'Drop it here!' : 'Drop your Excel file here'}
                      </p>
                      <p className="text-xs text-muted mt-1">or click to browse · .xlsx, .xls, .csv supported</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Template download */}
              <div className="flex items-center justify-between bg-surface2 border border-border rounded-xl p-4">
                <div>
                  <p className="text-sm font-medium text-fg">Need a template?</p>
                  <p className="text-xs text-muted">Download our pre-formatted Excel template with example data</p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 btn-secondary text-xs px-3 py-2 whitespace-nowrap"
                >
                  <Download size={13} /> Download Template
                </button>
              </div>

              {/* Column guide */}
              <div className="bg-surface2 border border-border rounded-xl p-4">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Expected Columns</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {IMPORT_COLUMNS.map(c => (
                    <div key={c.key} className="flex items-center gap-1.5 text-xs">
                      <span className={clsx(
                        'w-1.5 h-1.5 rounded-full flex-shrink-0',
                        c.required ? 'bg-rose' : 'bg-muted'
                      )} />
                      <span className="text-fg">{c.label.replace(' *','')}</span>
                      {c.required && <span className="text-rose text-[9px]">req</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface2 border border-border rounded-xl p-3 text-center">
                  <div className="text-lg font-bold font-mono text-fg">{rows.length}</div>
                  <div className="text-xs text-muted">Total rows</div>
                </div>
                <div className="bg-jade/10 border border-jade/20 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold font-mono text-jade">{validRows.length}</div>
                  <div className="text-xs text-jade/70">Ready to import</div>
                </div>
                <div className={clsx(
                  'rounded-xl p-3 text-center border',
                  invalidRows.length > 0 ? 'bg-rose/10 border-rose/20' : 'bg-surface2 border-border'
                )}>
                  <div className={clsx('text-lg font-bold font-mono', invalidRows.length > 0 ? 'text-rose' : 'text-muted')}>
                    {invalidRows.length}
                  </div>
                  <div className={clsx('text-xs', invalidRows.length > 0 ? 'text-rose/70' : 'text-muted')}>
                    With errors
                  </div>
                </div>
              </div>

              {/* Table preview */}
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface2 border-b border-border">
                      <th className="px-3 py-2 text-left text-muted font-medium">#</th>
                      {IMPORT_COLUMNS.slice(0, 7).map(c => (
                        <th key={c.key} className="px-3 py-2 text-left text-muted font-medium whitespace-nowrap">
                          {colMap[c.key]}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left text-muted font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        className={clsx(
                          'border-b border-border last:border-0',
                          !row._valid ? 'bg-rose/5' : 'hover:bg-surface2/50'
                        )}
                      >
                        <td className="px-3 py-2 text-muted">{i + 2}</td>
                        <td className="px-3 py-2 font-medium text-fg max-w-[140px] truncate">{row.name || <span className="text-rose italic">missing</span>}</td>
                        <td className="px-3 py-2 text-muted">{row.sku || '—'}</td>
                        <td className="px-3 py-2 text-muted">{row.brand || '—'}</td>
                        <td className="px-3 py-2 text-muted">{row.category || '—'}</td>
                        <td className="px-3 py-2 font-mono">{row.costPrice || '—'}</td>
                        <td className={clsx('px-3 py-2 font-mono', !row.sellPrice ? 'text-rose' : 'text-fg')}>
                          {row.sellPrice || <span className="text-rose italic">missing</span>}
                        </td>
                        <td className="px-3 py-2 font-mono">{row.initialStock || '0'}</td>
                        <td className="px-3 py-2">
                          {row._valid ? (
                            <span className="flex items-center gap-1 text-jade text-[10px]">
                              <CheckCircle2 size={11} /> OK
                            </span>
                          ) : (
                            <button
                              onClick={() => setExpandErr(expandErr === i ? null : i)}
                              className="flex items-center gap-1 text-rose text-[10px]"
                            >
                              <AlertTriangle size={11} />
                              {row._errors.length} error{row._errors.length > 1 ? 's' : ''}
                              {expandErr === i ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            </button>
                          )}
                          {expandErr === i && (
                            <ul className="mt-1 space-y-0.5">
                              {row._errors.map((e, j) => (
                                <li key={j} className="text-rose text-[10px]">• {e}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {invalidRows.length > 0 && (
                <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-400">
                  <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                  <span>
                    {invalidRows.length} row{invalidRows.length > 1 ? 's' : ''} will be skipped due to validation errors.{' '}
                    {validRows.length > 0
                      ? `Only the ${validRows.length} valid rows will be imported.`
                      : 'Fix the errors and re-upload to import these products.'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center py-8 space-y-4">
              <CheckCircle2 size={56} className="text-jade" />
              <h3 className="text-xl font-bold text-fg">Import Complete!</h3>
              <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold font-mono text-jade">{result.created}</div>
                  <div className="text-xs text-muted">Created</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold font-mono text-muted">{result.skipped}</div>
                  <div className="text-xs text-muted">Skipped</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold font-mono text-fg">{result.total}</div>
                  <div className="text-xs text-muted">Total</div>
                </div>
              </div>
              {result.errors?.length > 0 && (
                <div className="w-full bg-surface2 border border-border rounded-xl p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs font-semibold text-muted mb-2">Skipped rows:</p>
                  {result.errors.map((e: string, i: number) => (
                    <p key={i} className="text-xs text-rose">• {e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between p-5 border-t border-border flex-shrink-0">
          <div>
            {step === 'preview' && (
              <button onClick={() => { setStep('upload'); setRows([]) }} className="text-xs text-muted hover:text-fg transition-colors">
                ← Back to upload
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-xs px-4 py-2">
              {step === 'done' ? 'Close' : 'Cancel'}
            </button>
            {step === 'preview' && validRows.length > 0 && (
              <button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending}
                className="btn-primary text-xs px-4 py-2 flex items-center gap-2"
              >
                {importMutation.isPending
                  ? <><Loader2 size={12} className="animate-spin" /> Importing…</>
                  : <><CheckCircle2 size={12} /> Import {validRows.length} Products</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
