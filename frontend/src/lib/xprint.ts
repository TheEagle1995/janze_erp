/**
 * XPrint Service — Janze ERP
 *
 * Connects to a locally-running XPrint agent via WebSocket.
 * XPrint agent must be installed on the cashier machine and listening
 * on ws://localhost:<port> (default 3000).
 *
 * Protocol: JSON messages
 *   Send: { action: 'print', type: 'receipt'|'label', data: string, copies?: number }
 *   Send: { action: 'status' }
 *   Recv: { ok: boolean, error?: string }
 *
 * Fallback: if XPrint is not connected, uses window.open + window.print()
 */

export type PrinterStatus = 'connected' | 'disconnected' | 'connecting' | 'error'

export interface PrinterSettings {
  host:     string   // default: '127.0.0.1'
  port:     number   // default: 3000
  width:    '80mm' | '58mm'
  copies:   number
  autoConnect: boolean
}

export const DEFAULT_SETTINGS: PrinterSettings = {
  host:        '127.0.0.1',
  port:        3000,
  width:       '80mm',
  copies:      1,
  autoConnect: true,
}

// ── ESC/POS helpers ───────────────────────────────────────────────────────────
const ESC = '\x1B'
const GS  = '\x1D'

export const cmd = {
  INIT:       ESC + '@',
  CUT:        GS  + 'V' + '\x41' + '\x03',
  ALIGN_L:    ESC + 'a' + '\x00',
  ALIGN_C:    ESC + 'a' + '\x01',
  ALIGN_R:    ESC + 'a' + '\x02',
  BOLD_ON:    ESC + 'E' + '\x01',
  BOLD_OFF:   ESC + 'E' + '\x00',
  DOUBLE_H:   GS  + '!' + '\x11',   // double height+width
  NORMAL:     GS  + '!' + '\x00',
  FEED:       (n: number) => ESC + 'd' + String.fromCharCode(n),
  TEXT:       (s: string) => s,
  LF:         '\n',
  SEPARATOR:  (width: number) => '-'.repeat(width) + '\n',
  DOT_SEP:    (width: number) => ('.'.repeat(width)).replace(/\./g, '-') + '\n',
}

/** Build ESC/POS receipt string */
export function buildReceiptEscPos(opts: {
  brandName:    string
  branchName:   string
  orderId:      string
  dateStr:      string
  timeStr:      string
  cashierName?: string
  customerName?: string
  payMethod:    string
  items:        Array<{ name: string; variant?: string; qty: number; price: number; total: number }>
  subtotal:     number
  discountAmt:  number
  total:        number
  cashGiven?:   number
  change?:      number
  width80mm?:   boolean
}): string {
  const W = opts.width80mm ? 42 : 32  // chars per line
  const fmt = (n: number) => n.toLocaleString('uz-UZ') + " so'm"
  const rpad = (s: string, n: number) => s.substring(0, n).padEnd(n)
  const lpad = (s: string, n: number) => s.substring(0, n).padStart(n)
  const row  = (l: string, r: string) => rpad(l, W - r.length - 1) + ' ' + r + '\n'

  let out = ''
  out += cmd.INIT
  out += cmd.ALIGN_C
  out += cmd.DOUBLE_H
  out += opts.brandName + '\n'
  out += cmd.NORMAL
  out += cmd.BOLD_ON
  out += opts.branchName + '\n'
  out += cmd.BOLD_OFF
  out += opts.dateStr + '  ' + opts.timeStr + '\n'
  if (opts.cashierName) out += 'Kassir: ' + opts.cashierName + '\n'
  out += cmd.ALIGN_L
  out += cmd.SEPARATOR(W)

  if (opts.customerName) out += row('Mijoz:', opts.customerName)
  out += row('Chek #:', '#' + opts.orderId)
  out += row("To'lov:", opts.payMethod === 'CASH' ? 'Naqd' : opts.payMethod === 'CARD' ? 'Karta' : "O'tkazma")
  out += cmd.SEPARATOR(W)

  for (const item of opts.items) {
    const name = item.name + (item.variant ? ' (' + item.variant + ')' : '')
    out += name.substring(0, W) + '\n'
    const qtyPrice = '  ' + item.qty + ' x ' + fmt(item.price)
    out += rpad(qtyPrice, W - fmt(item.total).length - 1) + ' ' + fmt(item.total) + '\n'
  }

  out += cmd.SEPARATOR(W)
  out += row('Jami:', fmt(opts.subtotal))
  if (opts.discountAmt > 0) {
    out += cmd.BOLD_ON
    out += row('Chegirma:', '-' + fmt(opts.discountAmt))
    out += cmd.BOLD_OFF
  }
  out += cmd.BOLD_ON
  out += row("TO'LOV:", fmt(opts.total))
  out += cmd.BOLD_OFF

  if (opts.cashGiven && opts.cashGiven > 0) {
    out += row('Berildi:', fmt(opts.cashGiven))
    out += cmd.BOLD_ON
    out += row('Qaytim:', fmt(opts.change ?? 0))
    out += cmd.BOLD_OFF
  }

  out += cmd.SEPARATOR(W)
  out += cmd.ALIGN_C
  out += 'Rahmat! Yana keling!\n'
  out += 'JANZE ERP v2\n'
  out += cmd.FEED(4)
  out += cmd.CUT
  return out
}

/** Build label ESC/POS string (58mm) */
export function buildLabelEscPos(opts: {
  name:     string
  variant?: string
  price:    number
  sku?:     string
}): string {
  const fmt = (n: number) => n.toLocaleString('uz-UZ') + " so'm"
  let out = ''
  out += cmd.INIT
  out += cmd.ALIGN_L
  out += cmd.BOLD_ON
  out += opts.name.substring(0, 32) + '\n'
  out += cmd.BOLD_OFF
  if (opts.variant) out += opts.variant.substring(0, 32) + '\n'
  out += cmd.DOUBLE_H
  out += cmd.ALIGN_R
  out += fmt(opts.price) + '\n'
  out += cmd.NORMAL
  out += cmd.ALIGN_L
  if (opts.sku) out += 'SKU: ' + opts.sku + '\n'
  out += cmd.FEED(2)
  out += cmd.CUT
  return out
}

// ── XPrint Service ────────────────────────────────────────────────────────────
type StatusListener = (s: PrinterStatus, msg?: string) => void

class XPrintService {
  private ws:        WebSocket | null = null
  private settings:  PrinterSettings  = { ...DEFAULT_SETTINGS }
  private status:    PrinterStatus    = 'disconnected'
  private listeners: Set<StatusListener> = new Set()
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retryCount  = 0
  private MAX_RETRY   = 5

  onStatus(fn: StatusListener) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(s: PrinterStatus, msg?: string) {
    this.status = s
    this.listeners.forEach(fn => fn(s, msg))
  }

  getStatus() { return this.status }

  configure(s: Partial<PrinterSettings>) {
    this.settings = { ...this.settings, ...s }
  }

  connect(force = false) {
    if (!force && (this.status === 'connected' || this.status === 'connecting')) return
    this.disconnect()
    this.emit('connecting')

    const url = `ws://${this.settings.host}:${this.settings.port}`
    try {
      this.ws = new WebSocket(url)
    } catch {
      this.emit('error', 'URL xato')
      return
    }

    this.ws.onopen = () => {
      this.retryCount = 0
      this.emit('connected')
      this.ws!.send(JSON.stringify({ action: 'status' }))
    }

    this.ws.onclose = () => {
      this.emit('disconnected')
      this.scheduleRetry()
    }

    this.ws.onerror = () => {
      this.emit('error', "XPrint agentiga ulanib bo'lmadi")
      this.scheduleRetry()
    }

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.error) console.warn('[XPrint]', data.error)
      } catch { /* ignore */ }
    }
  }

  private scheduleRetry() {
    if (this.retryCount >= this.MAX_RETRY) return
    if (!this.settings.autoConnect) return
    const delay = Math.min(2000 * Math.pow(2, this.retryCount), 30_000)
    this.retryCount++
    this.retryTimer = setTimeout(() => this.connect(), delay)
  }

  disconnect() {
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null }
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    this.retryCount = 0
    this.emit('disconnected')
  }

  private send(payload: object): Promise<boolean> {
    return new Promise(resolve => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        resolve(false); return
      }
      this.ws.send(JSON.stringify(payload))
      resolve(true)
    })
  }

  /** Print a full receipt. Returns true if sent via XPrint, false = used fallback */
  async printReceipt(opts: Parameters<typeof buildReceiptEscPos>[0]): Promise<boolean> {
    const escpos = buildReceiptEscPos({ ...opts, width80mm: this.settings.width === '80mm' })
    const sent   = await this.send({
      action:  'print',
      type:    'receipt',
      data:    btoa(unescape(encodeURIComponent(escpos))),
      copies:  this.settings.copies,
      encoding: 'base64',
    })
    if (sent) return true
    // Fallback: browser print
    this.browserPrintReceipt(opts)
    return false
  }

  /** Print a 58mm price label */
  async printLabel(opts: Parameters<typeof buildLabelEscPos>[0]): Promise<boolean> {
    const escpos = buildLabelEscPos(opts)
    const sent   = await this.send({
      action:  'print',
      type:    'label',
      data:    btoa(unescape(encodeURIComponent(escpos))),
      copies:  1,
      encoding: 'base64',
    })
    if (sent) return true
    this.browserPrintLabel(opts)
    return false
  }

  // ── Browser print fallbacks ────────────────────────────────────────────────
  browserPrintReceipt(opts: Parameters<typeof buildReceiptEscPos>[0]) {
    const fmt = (n: number) => n.toLocaleString('uz-UZ') + " so'm"
    const change = (opts.cashGiven ?? 0) > 0 ? (opts.cashGiven! - opts.total) : 0

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Chek #${opts.orderId}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  width: ${opts.width80mm !== false ? '80mm' : '58mm'};
  max-width: ${opts.width80mm !== false ? '80mm' : '58mm'};
  margin: 0 auto;
  padding: 3mm 4mm;
  background: #fff;
  color: #000;
}
.center { text-align: center; }
.right  { text-align: right; }
.bold   { font-weight: bold; }
.big    { font-size: 15px; font-weight: bold; }
.xlg    { font-size: 18px; font-weight: bold; }
.sep    { border-top: 1px dashed #000; margin: 3px 0; }
.row    { display: flex; justify-content: space-between; gap: 2px; margin: 1px 0; }
.row .l { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row .r { text-align: right; white-space: nowrap; flex-shrink: 0; }
.item-line { font-size: 10px; padding-left: 4px; color: #333; }
.total-val { font-size: 14px; font-weight: bold; }
@media print {
  html, body { width: ${opts.width80mm !== false ? '80mm' : '58mm'}; }
  @page { margin: 0; size: ${opts.width80mm !== false ? '80mm' : '58mm'} auto; }
}
</style></head><body>
<div class="center big">${opts.brandName}</div>
<div class="center bold">${opts.branchName}</div>
<div class="center">${opts.dateStr}&nbsp;&nbsp;${opts.timeStr}</div>
${opts.cashierName ? `<div class="center">Kassir: ${opts.cashierName}</div>` : ''}
<div class="sep"></div>
${opts.customerName ? `<div class="row"><span class="l">Mijoz:</span><span class="r bold">${opts.customerName}</span></div>` : ''}
<div class="row"><span class="l">Chek:</span><span class="r">#${opts.orderId}</span></div>
<div class="row"><span class="l">To'lov:</span><span class="r">${opts.payMethod === 'CASH' ? 'Naqd' : opts.payMethod === 'CARD' ? 'Karta' : "O'tkazma"}</span></div>
<div class="sep"></div>
${opts.items.map(item => `
<div class="bold">${item.name}${item.variant ? ' <span style="font-weight:normal;font-size:10px;">(${item.variant})</span>' : ''}</div>
<div class="row item-line">
  <span class="l">${item.qty} × ${fmt(item.price)}</span>
  <span class="r bold">${fmt(item.total)}</span>
</div>`).join('')}
<div class="sep"></div>
<div class="row"><span class="l">Jami:</span><span class="r">${fmt(opts.subtotal)}</span></div>
${opts.discountAmt > 0 ? `<div class="row bold"><span class="l">Chegirma:</span><span class="r" style="color:#c00;">-${fmt(opts.discountAmt)}</span></div>` : ''}
<div class="row bold"><span class="l xlg">TO'LOV:</span><span class="r xlg total-val">${fmt(opts.total)}</span></div>
${(opts.cashGiven ?? 0) > 0 ? `
<div class="row"><span class="l">Berildi:</span><span class="r">${fmt(opts.cashGiven!)}</span></div>
<div class="row bold"><span class="l">Qaytim:</span><span class="r" style="color:#080;">${fmt(change)}</span></div>` : ''}
<div class="sep"></div>
<div class="center">Rahmat! Yana keling!</div>
<div class="center" style="font-size:9px;margin-top:2px;">JANZE ERP v2</div>
<br/><br/>
</body></html>`

    const win = window.open('', '_blank', 'width=340,height=600,toolbar=0,menubar=0,scrollbars=1')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); setTimeout(() => win.close(), 800) }, 500)
  }

  browserPrintLabel(opts: Parameters<typeof buildLabelEscPos>[0]) {
    const fmt = (n: number) => n.toLocaleString('uz-UZ') + " so'm"
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Label</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Courier New', monospace; width: 58mm; padding: 2mm 3mm; background: #fff; color: #000; font-size: 10px; }
.name  { font-size: 12px; font-weight: bold; word-break: break-word; margin-bottom: 1px; }
.var   { font-size: 10px; color: #444; margin-bottom: 2px; }
.price { font-size: 20px; font-weight: bold; text-align: right; margin: 2px 0; }
.sku   { font-size: 9px; color: #777; font-family: monospace; }
@media print { @page { margin: 0; size: 58mm 40mm; } }
</style></head><body>
<div class="name">${opts.name}</div>
${opts.variant ? `<div class="var">${opts.variant}</div>` : ''}
<div class="price">${fmt(opts.price)}</div>
${opts.sku ? `<div class="sku">SKU: ${opts.sku}</div>` : ''}
</body></html>`

    const win = window.open('', '_blank', 'width=240,height=180,toolbar=0,menubar=0')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); setTimeout(() => win.close(), 600) }, 400)
  }
}

export const xprint = new XPrintService()
