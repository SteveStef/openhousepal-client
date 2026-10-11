import { Playfair_Display, DM_Sans } from 'next/font/google'

// Loaded once, shared by the public site renderer (app/(sitepublic)/layout.tsx) and the Studio
// editor's live preview (WebsiteEditorShell.tsx) so what an agent sees while editing matches
// what visitors see once published. Uses the `variable` (CSS custom property) form rather than
// `.className` so it can be applied to any wrapping element, not just <body> - see
// app/(sitepublic)/site-theme.css for how --font-site-heading/--font-site-body get consumed.
export const siteHeadingFont = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-site-heading',
  display: 'swap',
})

export const siteBodyFont = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-site-body',
  display: 'swap',
})

export const siteFontVariables = `${siteHeadingFont.variable} ${siteBodyFont.variable}`
