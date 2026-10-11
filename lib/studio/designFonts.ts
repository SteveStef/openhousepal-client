import { Allura, Anton, Archivo, Cormorant_Garamond, Inter, Jost, Manrope, Playfair_Display } from 'next/font/google'

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
const playfair = Playfair_Display({ subsets: ['latin'], style: ['normal', 'italic'], display: 'swap' })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], display: 'swap' })
const jost = Jost({ subsets: ['latin'], display: 'swap' })
const manrope = Manrope({ subsets: ['latin'], display: 'swap' })
const anton = Anton({ subsets: ['latin'], weight: '400', display: 'swap' })
const archivo = Archivo({ subsets: ['latin'], display: 'swap' })
const inter = Inter({ subsets: ['latin'], display: 'swap' })
// The handwritten line on the Keepsake layout (the instant-print caption and its headline).
const allura = Allura({ subsets: ['latin'], weight: '400', display: 'swap' })

export const DESIGN_FONTS = {
  playfair: `${playfair.style.fontFamily}, Georgia, serif`,
  cormorant: `${cormorant.style.fontFamily}, Georgia, serif`,
  jost: `${jost.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`,
  manrope: `${manrope.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`,
  anton: `${anton.style.fontFamily}, Impact, 'Arial Narrow', sans-serif`,
  archivo: `${archivo.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`,
  inter: `${inter.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`,
  script: `${allura.style.fontFamily}, 'Brush Script MT', cursive`,
}
