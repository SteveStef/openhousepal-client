import QRCode from 'qrcode'

// The one QR look used everywhere (Studio designs, printed kits, kiosk, forms, blogs, Similar Homes):
// soft rounded modules, rounded "eyes" in a deep brand tone, and a small house mark in a white tile
// in the middle - reads as a real, branded code rather than a raw black square. Built on error
// correction 'Q' (25% of the code can be covered and it still scans) - not 'H', which makes the
// code denser and harder to read small/blurred - with the mark kept to ~3.5% of the area. Eye colour is forced dark enough for scanners (a light gold would read as "white").

export type QrStyle = {
  /** Colour of the modules (the dots). Default near-black. */
  dot?: string
  /** Colour of the three corner eyes + the house mark. Darkened automatically if too light. */
  eye?: string
  /** Show the house mark in the middle (default true). */
  mark?: boolean
}

const DEFAULT_EYE = '#5C431A' // deep OpenHousePal bronze - ~9:1 on white

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function luminance([r, g, b]: [number, number, number]) {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
/** Same hue, darkened until it has at least ~9:1 contrast on white (scanners need dark eyes). */
export function scanSafe(color: string | undefined, fallback = DEFAULT_EYE): string {
  const rgb = color ? hexToRgb(color) : null
  if (!rgb) return fallback
  let [r, g, b] = rgb
  for (let i = 0; i < 12 && luminance([r, g, b]) > 0.07; i++) { r *= 0.85; g *= 0.85; b *= 0.85 }
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

// lucide "house" outline, 24-unit box
const HOUSE = 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'

export type QrSvgParts = { size: number; body: string }

/** SVG markup (viewBox 0 0 size size) for `text` in the house style. Quiet zone not included. */
export function styledQrSvg(text: string, style: QrStyle = {}): QrSvgParts | null {
  let qr
  const mark = style.mark !== false
  try {
    qr = QRCode.create(text, { errorCorrectionLevel: mark ? 'Q' : 'M' })
  } catch {
    return null
  }
  const n = qr.modules.size
  const data = qr.modules.data
  const dot = style.dot || '#111318'
  const eye = scanSafe(style.eye)
  // centre tile for the mark: an odd number of modules, ~21% of the width
  let hole = mark ? Math.round(n * 0.19) : 0
  if (hole && hole % 2 === 0) hole += 1
  const h0 = Math.floor((n - hole) / 2)
  const inEye = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)
  const inHole = (r: number, c: number) => hole > 0 && r >= h0 - 1 && r < h0 + hole + 1 && c >= h0 - 1 && c < h0 + hole + 1
  let dots = ''
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!data[r * n + c] || inEye(r, c) || inHole(r, c)) continue
      // near-full modules with softly rounded corners: reads as 'dots' but keeps the ink scanners need
      dots += `M${c + 0.02} ${r + 0.3}a.28 .28 0 0 1 .28-.28h.4a.28 .28 0 0 1 .28 .28v.4a.28 .28 0 0 1-.28 .28h-.4a.28 .28 0 0 1-.28-.28z`
    }
  }
  const eyeAt = (x: number, y: number) =>
    `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.9" fill="none" stroke="${eye}" stroke-width="1"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.95" fill="${eye}"/>`
  let body = `<path d="${dots}" fill="${dot}"/>` + eyeAt(0, 0) + eyeAt(n - 7, 0) + eyeAt(0, n - 7)
  if (hole) {
    const pad = 0.5
    const x = h0 - 1 + pad, w = hole + 2 - pad * 2
    const k = (hole * 0.78) / 24
    const ox = h0 + (hole - 24 * k) / 2, oy = h0 + (hole - 24 * k) / 2
    body += `<rect x="${x}" y="${x}" width="${w}" height="${w}" rx="${w * 0.22}" fill="#FFFFFF" stroke="${eye}" stroke-width="0.35"/>` +
      `<path d="${HOUSE}" transform="translate(${ox} ${oy}) scale(${k})" fill="none" stroke="${eye}" stroke-width="${2.1}" stroke-linejoin="round" stroke-linecap="round"/>`
  }
  return { size: n, body }
}

/** A full standalone SVG string (with a quiet zone and background) - for <img>/canvas use. */
export function styledQrSvgString(text: string, style: QrStyle & { margin?: number; light?: string } = {}): string | null {
  const p = styledQrSvg(text, style)
  if (!p) return null
  const m = style.margin ?? 1
  const s = p.size + m * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-m} ${-m} ${s} ${s}" width="${s * 10}" height="${s * 10}">` +
    `<rect x="${-m}" y="${-m}" width="${s}" height="${s}" fill="${style.light || '#FFFFFF'}"/>${p.body}</svg>`
}
