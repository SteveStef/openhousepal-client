import localFont from 'next/font/local'

// The invitation's display serif (titles, dates) - the same face the link-preview images use.
// Font files live in frontend/fonts (Latin) - builds never download from Google Fonts (11/01: a
// Google Fonts hiccup failed two production builds in a row).
export const inviteSerif = localFont({ src: [
  { path: '../../fonts/playfair-display-normal-400-900.woff2', weight: '400 900', style: 'normal' },
  { path: '../../fonts/playfair-display-italic-400-900.woff2', weight: '400 900', style: 'italic' },
], display: 'swap', adjustFontFallback: 'Times New Roman' })
export const SERIF = inviteSerif.style.fontFamily
