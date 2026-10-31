import localFont from 'next/font/local'

// Font files live in frontend/fonts (Latin) - builds never download from Google Fonts (11/01: a
// Google Fonts hiccup failed two production builds in a row).

// Loaded once, shared by the public site renderer (app/(sitepublic)/layout.tsx) and the Studio
// editor's live preview (WebsiteEditorShell.tsx) so what an agent sees while editing matches
// what visitors see once published. Uses the `variable` (CSS custom property) form rather than
// `.className` so it can be applied to any wrapping element, not just <body> - see
// app/(sitepublic)/site-theme.css for how --font-site-heading/--font-site-body get consumed.
export const siteHeadingFont = localFont({
  src: '../fonts/playfair-display-normal-400-900.woff2',
  weight: '400 900',
  variable: '--font-site-heading',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
})

export const siteBodyFont = localFont({
  src: '../fonts/dm-sans-normal-100-1000.woff2',
  weight: '100 1000',
  variable: '--font-site-body',
  display: 'swap',
})

export const siteFontVariables = `${siteHeadingFont.variable} ${siteBodyFont.variable}`
