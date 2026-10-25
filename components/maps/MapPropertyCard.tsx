'use client'

// The small card that pops up when a home's pin is clicked on a map (10/25) - one card for every
// map on the site: the CMA builder's comp map (CompsMapView), the client CMA report's map, the
// Showcase editor's map and the IDX Search page. Before this each map hand-wrote its own HTML
// string inside a Google InfoWindow (tall, cramped, often clipped at the map's edge). Placement
// inside the map is MapPopup's job; this file is only the look.
//
// - photo with rounded corners, status pill on it; an optional tag (Match %, comp #) bottom-left
// - price, then one specs row: "4 bd · 3.5 ba · 2,010 sq ft · 0.03 ac" (only what the home has)
// - street + town on one line; optional action buttons under it
// - 'stack' (photo on top) for normal maps, 'row' (photo left, ~96px tall) for short/narrow maps
// - look 'app' = OpenHousePal's own light/dark colors; 'classic' / 'luxe' = the agent site's own
//   --site-* colors (so each IDX site keeps its accent, fonts and light/dark mode)

import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export interface MapCardPill { label: string; bg: string; fg?: string }
export interface MapCardSpec { value: string; unit: string }

/** "4 bd · 3.5 ba · 2,010 sq ft · 0.03 ac" as parts - only the facts the home has. */
export function mapCardSpecs({ beds, baths, sqft, acres }: { beds?: number | null; baths?: number | null; sqft?: number | null; acres?: number | null }): MapCardSpec[] {
  const out: MapCardSpec[] = []
  if (beds != null && beds > 0) out.push({ value: String(beds), unit: 'bd' })
  if (baths != null && baths > 0) out.push({ value: String(baths), unit: 'ba' })
  if (sqft != null && sqft > 0) out.push({ value: Math.round(sqft).toLocaleString('en-US'), unit: 'sq ft' })
  if (acres != null && acres > 0) out.push({ value: acres.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: acres < 1 ? 2 : 0 }), unit: 'ac' })
  return out
}

const LOOK_VARS = {
  app: '[--mc-bg:#ffffff] [--mc-ink:#111827] [--mc-soft:#374151] [--mc-muted:#6b7280] [--mc-line:rgba(17,24,39,0.08)] [--mc-photo:#f3f4f6] [--mc-accent:#8b7355] '
    + 'dark:[--mc-bg:#151517] dark:[--mc-ink:#ffffff] dark:[--mc-soft:#e5e7eb] dark:[--mc-muted:#9ca3af] dark:[--mc-line:rgba(255,255,255,0.1)] dark:[--mc-photo:#1f2937] dark:[--mc-accent:#d7b974]',
  site: '[--mc-bg:var(--site-surface)] [--mc-ink:var(--site-heading)] [--mc-soft:var(--site-ink-soft)] [--mc-muted:var(--site-muted)] [--mc-line:var(--site-line)] [--mc-photo:var(--site-bg-alt)] [--mc-accent:var(--site-accent)]',
}

export interface MapPropertyCardProps {
  photo?: string | null
  /** Already formatted, e.g. "$1,250,000". */
  price?: string | null
  /** Small grey words at the end of the price line ("2.1% over ask", "0.4 mi away"). */
  priceNote?: string | null
  status?: MapCardPill | null
  /** Bottom-left on the photo - "92% Match", "#3". */
  tag?: MapCardPill | null
  street?: string | null
  place?: string | null
  specs?: MapCardSpec[]
  /** The whole card opens this (IDX: the listing page). */
  href?: string
  onOpen?: () => void
  /** Small round buttons on the photo, left of the close button (IDX heart). */
  photoActions?: ReactNode
  /** A row of buttons at the bottom (CMA: Details / Add). */
  actions?: ReactNode
  onClose?: () => void
  layout?: 'stack' | 'row'
  look?: 'app' | 'classic' | 'luxe'
  /** Extra class for the price (a Luxe site's heading font). */
  priceClassName?: string
}

export default function MapPropertyCard({
  photo, price, priceNote, status, tag, street, place, specs = [], href, onOpen, photoActions, actions, onClose,
  layout = 'stack', look = 'app', priceClassName = '',
}: MapPropertyCardProps) {
  const row = layout === 'row'
  const luxe = look === 'luxe'
  const vars = look === 'app' ? LOOK_VARS.app : LOOK_VARS.site
  const radius = luxe ? 'rounded-[22px]' : 'rounded-[18px]'
  const photoRadius = luxe ? 'rounded-[17px]' : 'rounded-[13px]'
  const pillShape = look === 'classic' ? 'rounded-md' : 'rounded-full'

  const pill = (p: MapCardPill, small = false) => (
    <span className={`inline-flex max-w-full items-center truncate ${pillShape} font-black uppercase leading-none shadow-[0_1px_3px_rgba(0,0,0,0.25)] ${small ? 'px-1.5 py-[3px] text-[8px] tracking-[0.06em]' : 'px-2 py-[4px] text-[9.5px] tracking-[0.08em]'}`}
      style={{ backgroundColor: p.bg, color: p.fg || '#ffffff' }}>{p.label}</span>
  )

  const closeBtn = onClose && (
    <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); onClose() }} aria-label="Close"
      className={row
        ? 'absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--mc-photo)] text-[var(--mc-muted)] transition hover:text-[var(--mc-ink)]'
        : 'flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white shadow-sm transition hover:bg-black/70'}>
      <X className={row ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2.75} />
    </button>
  )

  const photoBox = (
    <div className={`relative shrink-0 overflow-hidden ${photoRadius} bg-[var(--mc-photo)] ${row ? 'h-[84px] w-[96px]' : 'h-[128px] w-full'}`}>
      {photo ? <img src={photo} alt="" loading="eager" decoding="async" className="h-full w-full object-cover" draggable={false} /> : null}
      {(tag || !row) && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent" />}
      {status && <div className={`absolute flex ${row ? 'left-1.5 top-1.5 max-w-[calc(100%-12px)]' : 'left-2 top-2 max-w-[calc(100%-84px)]'}`}>{pill(status, row)}</div>}
      {tag && <div className={`absolute ${row ? 'bottom-1.5 left-1.5' : 'bottom-2 left-2'}`}>{pill(tag, true)}</div>}
    </div>
  )

  const body = (
    <div className={`min-w-0 ${row ? 'flex flex-1 flex-col justify-center py-0.5 pr-6' : 'px-2 pb-1.5 pt-2.5'}`}>
      <div className="flex min-w-0 items-baseline gap-2">
        <p className={`shrink-0 font-black leading-none tracking-tight text-[var(--mc-ink)] ${row ? 'text-[15px]' : 'text-[18px]'} ${priceClassName}`}>{price || 'Price n/a'}</p>
        {priceNote && <p className="ml-auto min-w-0 truncate text-[10.5px] font-bold text-[var(--mc-muted)]">{priceNote}</p>}
      </div>
      {specs.length > 0 && (
        <p className={`mt-1.5 truncate leading-tight text-[var(--mc-muted)] ${row ? 'text-[11px]' : 'text-[12px]'}`}>
          {specs.map((s, i) => (
            <span key={s.unit}>
              {i > 0 && <span className={`opacity-60 ${row ? 'mx-[3px]' : 'mx-1'}`}>·</span>}
              <span className="font-extrabold text-[var(--mc-soft)]">{s.value}</span> <span className="font-semibold">{row && s.unit === 'sq ft' ? 'sf' : s.unit}</span>
            </span>
          ))}
        </p>
      )}
      {(street || place) && (
        <p className={`mt-1 truncate leading-tight text-[var(--mc-muted)] ${row ? 'text-[10.5px]' : 'text-[11.5px]'}`}>
          <span className="font-bold text-[var(--mc-ink)]">{street}</span>{street && place ? ', ' : ''}<span className="font-medium">{place}</span>
        </p>
      )}
      {actions && <div className={`flex gap-1.5 ${row ? 'mt-1.5' : 'mt-2.5'}`}>{actions}</div>}
    </div>
  )

  const inner = <>{photoBox}{body}</>
  const shell = `relative block overflow-hidden border border-[var(--mc-line)] bg-[var(--mc-bg)] p-1.5 text-left shadow-[0_18px_40px_-14px_rgba(15,23,42,0.45),0_3px_8px_rgba(15,23,42,0.12)] ${radius} ${vars} ${row ? 'flex w-[320px] max-w-full items-stretch gap-2.5' : 'w-[264px] max-w-full'}`
  const clickable = !!(href || onOpen)

  return (
    <div className={shell}>
      {/* Outside the card's link, so a button here never also opens the home. */}
      {row ? closeBtn : (photoActions || closeBtn) && <div className="absolute right-3.5 top-3.5 z-10 flex items-center gap-1.5">{photoActions}{closeBtn}</div>}
      {href ? (
        <a href={href} onClick={() => onOpen?.()} className={`block min-w-0 ${row ? 'flex flex-1 items-stretch gap-2.5' : ''}`}>{inner}</a>
      ) : clickable ? (
        <div role="button" tabIndex={0} onClick={() => onOpen?.()} onKeyDown={e => { if (e.key === 'Enter') onOpen?.() }}
          className={`min-w-0 cursor-pointer ${row ? 'flex flex-1 items-stretch gap-2.5' : ''}`}>{inner}</div>
      ) : inner}
    </div>
  )
}

/** The two button looks the card's actions use. */
export const mapCardButton = {
  quiet: 'flex-1 rounded-[10px] border border-[var(--mc-line)] bg-[var(--mc-bg)] px-2 py-[7px] text-[11px] font-black text-[var(--mc-ink)] transition hover:border-[var(--mc-accent)]',
  solid: 'flex-1 rounded-[10px] px-2 py-[7px] text-[11px] font-black text-white transition hover:brightness-110',
}
