import localFont from 'next/font/local'

// The typefaces behind the 4 Design Studio styles. Loaded through next/font (self-hosted, same
// origin), so the editor, the wizard's live previews, the client-side PNG fallback (html2canvas
// can only draw fonts the document already has), and the headless /print render used for server
// PNG/PDF export all draw the exact same glyphs. Only pages that import the design canvas pull
// these in - nothing else in the app pays for them.
//
// Each style pairs a display face with a working face - see lib/studio/designTheme.ts:
//   Editorial     - Playfair Display (magazine serif, italic kicker) + Inter
//   Modern Luxury - Cormorant Garamond (fine high-contrast serif)    + Jost (tracked geometric caps)
//   Minimal       - Manrope throughout (quiet, precise grotesk)
//   Bold          - Anton (condensed poster caps)                     + Archivo
// Font files live in frontend/fonts (Latin) - builds never download from Google Fonts (11/01: a
// Google Fonts hiccup failed two production builds in a row).
const playfair = localFont({ src: [
  { path: '../../fonts/playfair-display-normal-400-900.woff2', weight: '400 900', style: 'normal' },
  { path: '../../fonts/playfair-display-italic-400-900.woff2', weight: '400 900', style: 'italic' },
], display: 'swap', adjustFontFallback: 'Times New Roman' })
const cormorant = localFont({ src: [
  { path: '../../fonts/cormorant-garamond-normal-300-700.woff2', weight: '300 700', style: 'normal' },
  { path: '../../fonts/cormorant-garamond-italic-300-700.woff2', weight: '300 700', style: 'italic' },
], display: 'swap', adjustFontFallback: 'Times New Roman' })
const jost = localFont({ src: '../../fonts/jost-normal-100-900.woff2', weight: '100 900', display: 'swap' })
const manrope = localFont({ src: '../../fonts/manrope-normal-200-800.woff2', weight: '200 800', display: 'swap' })
const anton = localFont({ src: '../../fonts/anton-normal-400.woff2', weight: '400', display: 'swap' })
const archivo = localFont({ src: '../../fonts/archivo-normal-100-900.woff2', weight: '100 900', display: 'swap' })
const inter = localFont({ src: '../../fonts/inter-normal-100-900.woff2', weight: '100 900', display: 'swap' })
// The handwritten line on the Keepsake layout (the instant-print caption and its headline).
const allura = localFont({ src: '../../fonts/allura-normal-400.woff2', weight: '400', display: 'swap', adjustFontFallback: false })
// A readable, lightly joined hand for the Keepsake's short lines (the words on the print, the QR asks).
const dancing = localFont({ src: '../../fonts/dancing-script-normal-400-700.woff2', weight: '400 700', display: 'swap', adjustFontFallback: false })

export const DESIGN_FONTS = {
  playfair: `${playfair.style.fontFamily}, Georgia, serif`,
  cormorant: `${cormorant.style.fontFamily}, Georgia, serif`,
  jost: `${jost.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`,
  manrope: `${manrope.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`,
  anton: `${anton.style.fontFamily}, Impact, 'Arial Narrow', sans-serif`,
  archivo: `${archivo.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`,
  inter: `${inter.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`,
  script: `${allura.style.fontFamily}, 'Brush Script MT', cursive`,
  hand: `${dancing.style.fontFamily}, 'Brush Script MT', cursive`,
}
