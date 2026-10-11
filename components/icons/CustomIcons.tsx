// Two custom line icons matching lucide-react's own conventions (24x24 viewBox, currentColor
// stroke, round joins) for concepts lucide has no ready-made glyph for. Both accept the same
// `{ className }` prop shape as a lucide icon, so they drop into any `icon={...}` slot untouched.

interface CustomIconProps {
  className?: string
  /** Accepted for parity with lucide icons - some call sites (pricing cards) pass their own
   * strokeWidth override. Defaults to each icon's own natural weight when omitted. */
  strokeWidth?: number
}

/** Listing Spotlight's icon (a standalone site for one listing, browsed at its own address) - a
 * browser-chrome window frame with a bold target/focus ring centered in its content area, reading
 * as "the spotlight/focus is on this one listing." Redesigned 2026-09-24 (direct feedback the old
 * version - a fussy little house silhouette + a thin door-line detail - read noticeably thinner
 * than every lucide icon next to it, which all lean on one or two big simple shapes rather than
 * several small ones): now just 4 pieces, each bold enough to read clearly at 18px - the window
 * frame, its top bar, one thick ring, and a solid center dot - instead of cramming a tiny building
 * silhouette into the same space. */
export function SpotlightIcon({ className, strokeWidth = 2 }: CustomIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 8.5h20" />
      <circle cx="12" cy="15" r="4" />
      <circle cx="12" cy="15" r="1.2" fill="currentColor" />
    </svg>
  )
}

/** The Kits icon - a bundle of documents (Sign-In Sheet, Cheat Sheet, Brag Sheet, Similar Homes
 * flyer). Built on lucide's own "files" glyph (one sheet in front, one peeking out behind, folded
 * corner) so it sits cleanly alongside the other lucide icons in the tab row and pricing cards
 * instead of the old fanned-cards shape. */
export function KitsIcon({ className, strokeWidth = 2 }: CustomIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* front sheet with a folded top-right corner (lucide "files" geometry) */}
      <path d="M15.5 2H8.6a1.6 1.6 0 0 0-1.6 1.6v12.8a1.6 1.6 0 0 0 1.6 1.6h9.8a1.6 1.6 0 0 0 1.6-1.6V6.5Z" />
      <path d="M15 2v5h5" />
      {/* the sheet peeking out behind it */}
      <path d="M4 7.6v12.8A1.6 1.6 0 0 0 5.6 22h9.8" />
      {/* a couple of content lines so it reads as printed sheets, not a blank page */}
      <path d="M10 11h5" />
      <path d="M10 14h5" />
    </svg>
  )
}
