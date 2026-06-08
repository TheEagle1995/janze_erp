/**
 * barcodeGen.ts — Janze ERP
 *
 * Pure-JS barcode generation (no npm packages needed).
 *   - Code128 via Canvas API  → dataURL
 *   - EAN-13   via Canvas API → dataURL
 *   - QR       via free API   → img URL (fallback: canvas gradient placeholder)
 */

// ── Code 128 ──────────────────────────────────────────────────────────────────
// Based on the Code 128B character set (printable ASCII 32–127)

const CODE128_START_B  = 104
const CODE128_STOP     = 106
const CODE128_QUIET    = 10   // quiet zone modules

// Patterns: each entry = 6 bar widths (alternating bar/space)
const CODE128_PATTERNS: number[][] = [
  [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],
  [1,2,1,3,2,2],[1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],
  [1,3,2,2,1,2],[2,2,1,2,1,3],[2,2,1,3,1,2],[2,3,1,2,1,2],
  [1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],[1,1,3,2,2,2],
  [1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
  [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],
  [3,1,1,2,2,2],[3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],
  [3,2,2,1,1,2],[3,2,2,2,1,1],[2,1,2,1,2,3],[2,1,2,3,2,1],
  [2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],[1,3,1,3,2,1],
  [1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
  [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],
  [1,3,2,1,3,1],[1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],
  [3,1,3,1,2,1],[2,1,1,3,3,1],[2,3,1,1,3,1],[2,1,3,1,1,3],
  [2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],[3,1,1,3,2,1],
  [3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
  [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],
  [1,1,1,4,2,2],[1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],
  [1,4,1,2,2,1],[1,1,2,2,1,4],[1,1,2,4,1,2],[1,2,2,1,1,4],
  [1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],[2,4,1,2,1,1],
  [2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],
  [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],
  [1,2,4,1,1,2],[1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],
  [4,2,1,2,1,1],[2,1,2,1,4,1],[2,1,4,1,2,1],[4,1,2,1,2,1],
  [1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],[1,1,4,1,1,3],
  [1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],
  [1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],[2,1,1,4,1,2],
  [2,1,1,2,1,4],[2,1,1,2,3,2],[2,3,3,1,1,1],[1,1,2,1,4,2], // 106 = stop
]

const STOP_PATTERN = [2,3,3,1,1,1,2]  // 7 bars for stop char

function code128Encode(text: string): number[] {
  // Use Code 128B (full ASCII)
  const codes: number[] = [CODE128_START_B]
  let checksum = CODE128_START_B

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) - 32
    if (charCode < 0 || charCode > 94) continue   // skip non-printable
    codes.push(charCode)
    checksum += charCode * (i + 1)
  }

  codes.push(checksum % 103)
  codes.push(CODE128_STOP)
  return codes
}

function drawCode128(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: { x: number; y: number; height: number; moduleW: number; color: string }
) {
  const { x, y, height, moduleW, color } = opts
  const codes = code128Encode(text)

  ctx.fillStyle = color
  let cx = x + CODE128_QUIET * moduleW

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]
    const pattern = code === CODE128_STOP ? STOP_PATTERN : CODE128_PATTERNS[code]
    if (!pattern) continue

    for (let j = 0; j < pattern.length; j++) {
      const w = pattern[j] * moduleW
      if (j % 2 === 0) {   // even = bar (dark)
        ctx.fillRect(cx, y, w, height)
      }
      cx += w
    }
  }

  // Right quiet zone
  cx += CODE128_QUIET * moduleW
  return cx - x   // total width drawn
}

export interface BarcodeOptions {
  text:        string
  type:        'code128' | 'ean13' | 'qr'
  width?:      number
  height?:     number
  moduleW?:    number
  showText?:   boolean
  fontSize?:   number
  color?:      string
  background?: string
}

/** Returns a PNG data URL of the barcode */
export function generateBarcodeDataUrl(opts: BarcodeOptions): string {
  const {
    text,
    type,
    moduleW   = 2,
    height    = 60,
    showText  = true,
    fontSize  = 11,
    color     = '#000000',
    background = '#ffffff',
  } = opts

  if (!text) return ''

  if (type === 'qr') {
    // QR is handled via URL — return empty and let caller use getQrUrl()
    return ''
  }

  const canvas = document.createElement('canvas')
  const ctx    = canvas.getContext('2d')!
  ctx.font     = `${fontSize}px monospace`

  const quietPx  = CODE128_QUIET * moduleW
  const textH    = showText ? fontSize + 4 : 0
  const barsH    = height

  // Estimate width: we need to render to measure, then resize
  canvas.width  = 600
  canvas.height = barsH + textH + 8

  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  let barsW = 0

  if (type === 'code128') {
    barsW = drawCode128(ctx, text, {
      x: 0, y: 4, height: barsH, moduleW, color,
    })
  } else if (type === 'ean13') {
    barsW = drawEAN13(ctx, text, {
      x: 0, y: 4, height: barsH, moduleW, color, fontSize, showText,
    })
  }

  // Crop to actual width
  const finalW = Math.max(barsW, 60)
  const finalH = barsH + textH + 8

  const canvas2 = document.createElement('canvas')
  canvas2.width  = finalW
  canvas2.height = finalH
  const ctx2 = canvas2.getContext('2d')!

  ctx2.fillStyle = background
  ctx2.fillRect(0, 0, finalW, finalH)

  ctx2.drawImage(canvas, 0, 0)

  if (showText && type === 'code128') {
    ctx2.fillStyle = color
    ctx2.font      = `${fontSize}px monospace`
    ctx2.textAlign = 'center'
    ctx2.fillText(
      text.length > 24 ? text.slice(0, 24) + '…' : text,
      finalW / 2,
      barsH + 4 + fontSize
    )
  }

  return canvas2.toDataURL('image/png')
}

// ── EAN-13 ────────────────────────────────────────────────────────────────────

const EAN13_L: number[][] = [
  [3,2,1,1],[2,2,2,1],[2,1,2,2],[1,4,1,1],[1,1,3,2],
  [1,2,3,1],[1,1,1,4],[1,3,1,2],[1,2,1,3],[3,1,1,2],
]
const EAN13_G: number[][] = EAN13_L.map(p => [...p].reverse())
const EAN13_R: number[][] = EAN13_L.map(p => p.map(n => (n === 1 ? 2 : n === 2 ? 1 : n === 3 ? 4 : 3)))

const EAN13_PARITY = [
  [0,0,0,0,0,0],[0,0,1,0,1,1],[0,0,1,1,0,1],[0,0,1,1,1,0],
  [0,1,0,0,1,1],[0,1,1,0,0,1],[0,1,1,1,0,0],[0,1,0,1,0,1],
  [0,1,0,1,1,0],[0,1,1,0,1,0],
]

function ean13Checksum(digits: number[]): number {
  const d = digits.slice(0, 12)
  const s = d.reduce((acc, v, i) => acc + v * (i % 2 === 0 ? 1 : 3), 0)
  return (10 - (s % 10)) % 10
}

function drawEAN13(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: { x: number; y: number; height: number; moduleW: number; color: string; fontSize: number; showText: boolean }
): number {
  const { x, y, height, moduleW: mw, color, fontSize, showText } = opts

  // Pad/trim to 13 digits
  let raw = text.replace(/\D/g, '').slice(0, 13).padStart(13, '0')
  const digits = raw.split('').map(Number)
  // Fix checksum
  digits[12] = ean13Checksum(digits)

  const parity    = EAN13_PARITY[digits[0]]
  const quietW    = 9 * mw
  const guardH    = height + (showText ? fontSize + 2 : 0)
  const normalH   = height

  ctx.fillStyle   = color
  let cx = x + quietW

  // Left guard |‖|
  const guard = [1, 1, 1]
  for (let i = 0; i < 3; i++) {
    if (i % 2 === 0) ctx.fillRect(cx, y, guard[i] * mw, guardH)
    cx += guard[i] * mw
  }

  // Left 6 digits
  for (let i = 0; i < 6; i++) {
    const enc = i === 0 ? EAN13_L : (parity[i - 1] === 0 ? EAN13_L : EAN13_G)
    const pat = enc[digits[i + 1]]
    for (let j = 0; j < pat.length; j++) {
      if (j % 2 === 0) ctx.fillRect(cx, y, pat[j] * mw, normalH)
      cx += pat[j] * mw
    }
  }

  // Center guard ‖|‖
  const center = [1, 1, 1, 1, 1]
  for (let i = 0; i < 5; i++) {
    if (i % 2 === 1) ctx.fillRect(cx, y, center[i] * mw, guardH)
    cx += center[i] * mw
  }

  // Right 6 digits
  for (let i = 0; i < 6; i++) {
    const pat = EAN13_R[digits[i + 7]]
    for (let j = 0; j < pat.length; j++) {
      if (j % 2 === 0) ctx.fillRect(cx, y, pat[j] * mw, normalH)
      cx += pat[j] * mw
    }
  }

  // Right guard |‖|
  for (let i = 0; i < 3; i++) {
    if (i % 2 === 0) ctx.fillRect(cx, y, guard[i] * mw, guardH)
    cx += guard[i] * mw
  }

  // Text
  if (showText) {
    ctx.fillStyle   = color
    ctx.font        = `${fontSize}px monospace`
    ctx.textAlign   = 'left'
    // First digit (outside bars)
    ctx.fillText(String(digits[0]), x, y + guardH)
    // Left 6 digits under bars
    const leftMid = x + quietW + 3 * mw + 6 * 7 * mw / 2
    ctx.textAlign = 'center'
    ctx.fillText(digits.slice(1, 7).join(''), leftMid, y + guardH)
    // Right 6 digits
    const rightMid = x + quietW + 3 * mw + 6 * 7 * mw + 5 * mw + 6 * 7 * mw / 2
    ctx.fillText(digits.slice(7, 13).join(''), rightMid, y + guardH)
  }

  return cx + quietW - x
}

/** URL for a QR code image (uses free public API) */
export function getQrUrl(text: string, size = 150): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&format=png&margin=4`
}

/** Generate a random EAN-13 barcode (with valid checksum) */
export function randomEAN13(): string {
  const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10))
  const s      = digits.reduce((acc, v, i) => acc + v * (i % 2 === 0 ? 1 : 3), 0)
  digits.push((10 - (s % 10)) % 10)
  return digits.join('')
}
