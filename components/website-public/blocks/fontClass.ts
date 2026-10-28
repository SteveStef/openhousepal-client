// Maps the site's theme.heading_font/body_font (same 'serif' | 'sans' | 'mono' enum as
// StudioBrandKit) to the real loaded site fonts (Playfair Display / DM Sans - see
// lib/site-fonts.ts + app/(sitepublic)/site-theme.css) rather than Tailwind's generic
// font-serif/font-sans utilities, which only resolve to browser-default stacks. The
// 'font-serif'/'font-sans' fallback parameter values are kept as-is so call sites don't need to
// change - only what they resolve to has changed.
export function fontClass(font: string | undefined, fallback: 'font-serif' | 'font-sans' = 'font-sans'): string {
  // An explicit "Serif" choice carries .ohp-site-heading-serif too, so it still wins on the
  // Default look, whose plain .ohp-site-heading is set in the sans (see site-theme.css).
  if (font === 'serif') return 'ohp-site-heading ohp-site-heading-serif'
  if (font === 'mono') return 'font-mono'
  if (font === 'sans') return 'ohp-site-sans'
  return fallback === 'font-serif' ? 'ohp-site-heading' : 'ohp-site-body'
}

/** A section's main heading in the agent's Heading font, on either look. Plain .ohp-site-heading
 *  follows the look (Classic sans, Luxe serif) and ignored the picker on Classic's big headings
 *  (the welcome headline, section titles - 10/27 audit); this keeps the heading styling and adds
 *  the chosen family on top. */
export function headingClass(font: string | undefined): string {
  if (font === 'serif') return 'ohp-site-heading ohp-site-heading-serif'
  if (font === 'sans') return 'ohp-site-heading ohp-site-heading-sans'
  if (font === 'mono') return 'ohp-site-heading ohp-site-heading-mono'
  return 'ohp-site-heading'
}
