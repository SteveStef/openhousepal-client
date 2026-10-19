'use client'

import { SiteTheme } from './types'
import { fontClass } from './blocks/fontClass'
import { ShowcaseListing } from './PropertyShowcaseCard'

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// Sized down by actual character count rather than one fixed size for every stat - a number
// like "4" and a township name like "Radnor Township School District" can't both read well at
// the same size in a single-line row, so a long value (school district name is the usual
// culprit) shrinks to fit rather than getting cut off at the row's edge.
function fitTextClass(value: string | number): string {
  const length = String(value).length
  if (length > 24) return 'text-[11px] sm:text-xs'
  if (length > 16) return 'text-xs sm:text-sm'
  if (length > 10) return 'text-sm sm:text-base'
  return 'text-base sm:text-lg'
}

// A boxed icon-chip grid (the Showcase's own "Important Facts" bar style) read as dashboard UI
// next to a full-bleed hero photo, not a boutique real estate site. This is the alternative:
// plain figures with small tracked caps labels underneath, separated by hairline gold dividers -
// the "spec line" pattern real luxury listing sites use, no icons, no background boxes.
function StatItem({ value, label, theme, first }: { value: string | number; label: string; theme: SiteTheme; first: boolean }) {
  return (
    // shrink-0 - without it, a flex row that doesn't quite fit (a long school district name is
    // the usual culprit) squeezes this item's box narrower than its own text, wrapping the value
    // onto two lines. This keeps every value on one line always; if there truly isn't room, the
    // whole item wraps down to its own row instead (via the parent's flex-wrap) rather than the
    // text breaking mid-word.
    <div
      className={`flex shrink-0 flex-col items-center px-4 sm:px-6 ${first ? 'pl-0' : 'border-l'}`}
      style={first ? undefined : { borderColor: `${theme.secondary_color}40` }}
    >
      <span className={`whitespace-nowrap font-black leading-none text-white ${fitTextClass(value)} ${fontClass(theme.heading_font, 'font-serif')}`}>{value}</span>
      <span className="mt-1.5 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">{label}</span>
    </div>
  )
}

// Echoes the same facts the Showcase property detail view surfaces (see PropertyDetailsModal's
// FactChip grid: beds/baths/sqft/$-per-sqft/built/HOA) plus Lot Size and School District, but
// restyled for the public marketing site as one quiet, elegant line rather than a grid of boxed
// stat cards - lives right on the hero photo itself (rendered by FeaturedHeroCard, under the
// price/address), sharing that block's own fade/slide transition on a listing change rather than
// animating separately.
export default function ListingFactBar({ listing, theme }: { listing: ShowcaseListing; theme: SiteTheme }) {
  const stats: { value: string | number; label: string }[] = []
  if (listing.bedrooms != null) stats.push({ value: listing.bedrooms, label: 'Beds' })
  if (listing.bathrooms != null) stats.push({ value: listing.bathrooms, label: 'Baths' })
  if (listing.living_area != null) stats.push({ value: listing.living_area.toLocaleString(), label: 'Sq Ft' })
  if (listing.price_per_sqft != null) stats.push({ value: `$${listing.price_per_sqft.toFixed(0)}`, label: '/ Sq Ft' })
  if (listing.year_built != null) stats.push({ value: listing.year_built, label: 'Built' })
  if (listing.lot_size_acres != null) stats.push({ value: listing.lot_size_acres.toFixed(listing.lot_size_acres < 1 ? 2 : 1), label: 'Acres' })
  if (listing.has_hoa != null) stats.push({ value: listing.has_hoa ? 'Yes' : 'No', label: 'HOA' })
  if (listing.school_district) stats.push({ value: titleCase(listing.school_district), label: 'School' })

  if (stats.length === 0) return null

  return (
    // flex-nowrap + overflow-x-auto, not flex-wrap - a long school district name plus every
    // other stat doesn't always fit one row's width, and wrapping (the item itself, even with
    // shrink-0 protecting its text) still occasionally dropped School to its own second line.
    // This guarantees one line always - on a narrow viewport it scrolls horizontally instead.
    <div className="scrollbar-hide mt-3 flex flex-nowrap items-center justify-between overflow-x-auto border-t pt-3" style={{ borderColor: `${theme.secondary_color}30` }}>
      {stats.map((s, i) => <StatItem key={i} value={s.value} label={s.label} theme={theme} first={i === 0} />)}
    </div>
  )
}
