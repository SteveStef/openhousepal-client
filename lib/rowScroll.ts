// Card-aligned stepping for the Agent Hub's horizontal shelves (Videos, House Tours, Recent Sales,
// My Listings, Blogs when not in Carousel view). A relative `scrollBy(cardWidth)` drifts: row
// padding, snap adjustments, or a previous smooth scroll that hadn't finished yet all leave the row
// part-way between cards, so after a step you'd see half of the old first card still hanging on
// (explicit ask: when it scrolls past one, fully scroll it off so the next one sits first).
// Instead, find the first card whose left edge is past the row's visible start and scroll so THAT
// card's left edge lands exactly on the start - every step ends perfectly aligned regardless of
// where the row was before.
export function scrollRowByCard(row: HTMLElement | null, direction: 1 | -1 = 1, loop = false) {
  if (!row) return
  const cards = Array.from(row.children) as HTMLElement[]
  if (!cards.length) return
  const style = getComputedStyle(row)
  const padLeft = parseFloat(style.paddingLeft || '0') || 0
  // The Studio live preview renders the hub inside a CSS scale() (ScaleFit) - bounding rects come
  // back scaled while scrollLeft doesn't, so convert every measured distance back to CSS pixels.
  const rowRect = row.getBoundingClientRect()
  const scale = row.offsetWidth ? rowRect.width / row.offsetWidth : 1
  const startX = rowRect.left + padLeft * scale
  const maxScroll = row.scrollWidth - row.clientWidth

  if (direction === 1) {
    if (row.scrollLeft >= maxScroll - 4) {
      if (loop) row.scrollTo({ left: 0, behavior: 'smooth' })
      return
    }
    const next = cards.find(card => card.getBoundingClientRect().left > startX + 2 * scale)
    if (!next) return
    const delta = (next.getBoundingClientRect().left - startX) / scale
    row.scrollTo({ left: Math.min(maxScroll, row.scrollLeft + delta), behavior: 'smooth' })
  } else {
    const prev = [...cards].reverse().find(card => card.getBoundingClientRect().left < startX - 2 * scale)
    if (!prev) return
    const delta = (prev.getBoundingClientRect().left - startX) / scale
    row.scrollTo({ left: Math.max(0, row.scrollLeft + delta), behavior: 'smooth' })
  }
}

// The auto-advance glide: the same card-aligned target as scrollRowByCard, but moved by hand over
// ~1.1s on an ease-in-out curve (the browser's own smooth scroll is a short, mechanical slide).
// Returns the index of the card that lands at the front, so the shelf can give it its small lift.
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function glideRowByCard(row: HTMLElement | null, direction: 1 | -1 = 1, loop = false, duration = 1100): number | null {
  if (!row) return null
  const cards = Array.from(row.children) as HTMLElement[]
  if (!cards.length) return null
  const style = getComputedStyle(row)
  const padLeft = parseFloat(style.paddingLeft || '0') || 0
  const rowRect = row.getBoundingClientRect()
  const scale = row.offsetWidth ? rowRect.width / row.offsetWidth : 1
  const startX = rowRect.left + padLeft * scale
  const maxScroll = row.scrollWidth - row.clientWidth

  let target: number | null = null
  let lead: number | null = null
  if (direction === 1) {
    if (row.scrollLeft >= maxScroll - 4) {
      if (!loop) return null
      target = 0
      lead = 0
    } else {
      const idx = cards.findIndex(card => card.getBoundingClientRect().left > startX + 2 * scale)
      if (idx < 0) return null
      target = Math.min(maxScroll, row.scrollLeft + (cards[idx].getBoundingClientRect().left - startX) / scale)
      lead = idx
    }
  } else {
    let idx = -1
    for (let i = cards.length - 1; i >= 0; i--) {
      if (cards[i].getBoundingClientRect().left < startX - 2 * scale) { idx = i; break }
    }
    if (idx < 0) return null
    target = Math.max(0, row.scrollLeft + (cards[idx].getBoundingClientRect().left - startX) / scale)
    lead = idx
  }

  const from = row.scrollLeft
  const delta = target - from
  if (Math.abs(delta) < 1) return lead
  const el = row as HTMLElement & { __glide?: number }
  const id = (el.__glide || 0) + 1
  el.__glide = id
  // Native smooth scrolling and scroll-snap would both fight a per-frame scrollLeft; park them.
  const prevBehavior = row.style.scrollBehavior
  const prevSnap = row.style.scrollSnapType
  row.style.scrollBehavior = 'auto'
  row.style.scrollSnapType = 'none'
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const total = reduce ? 1 : duration
  const t0 = performance.now()
  const finish = () => { row.style.scrollBehavior = prevBehavior; row.style.scrollSnapType = prevSnap }
  const step = (now: number) => {
    if (el.__glide !== id) { finish(); return }
    const p = Math.min(1, (now - t0) / total)
    row.scrollLeft = from + delta * easeInOutCubic(p)
    if (p < 1) requestAnimationFrame(step)
    else finish()
  }
  requestAnimationFrame(step)
  return lead
}
