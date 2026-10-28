'use client'

// The WEBSITE version of the agent's signature card (user, 10/24): the same details and features
// as the email signature's Site Version - photo, name, title / brokerage / team, verified badge,
// phone + email (with copy), Save Contact, the CTA buttons (forms open over the page), the social
// links, the featured listing rotation / recent sales and the stats - but laid out for the web:
// real-size buttons, thicker, and re-arranged for a phone (stacked) vs a computer (two columns).
// It is NOT the email signature: that one stays exactly as it is (lib/signaturePreview + the
// backend's install HTML). Fed by buildSignatureSiteInput, so what's shown can't drift from it.

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, BadgeCheck, Check, ChevronLeft, ChevronRight, Contact, Copy, Mail, MessageSquare, Phone } from 'lucide-react'
import { LUXE_METALS, type LuxeMetal } from '@/lib/luxeMetals'
import { salesWords } from '@/lib/salesWording'

type Input = ReturnType<typeof import('@/lib/signatureSiteData').buildSignatureSiteInput>

const fmtPhone = (raw: string) => {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') d = d.slice(1)
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw
}
const inkOn = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.64 ? '#111827' : '#ffffff'
}
function chip(raw: string): { label: string; bg: string } {
  const c = String(raw || '').replace(/-BRIGHT/gi, '').replace(/_/g, ' ').trim().toLowerCase()
  if (c.includes('coming soon')) return { label: 'Coming Soon', bg: '#111827' }
  if (c.includes('under contract')) return { label: 'Under Contract', bg: '#b7791f' }
  if (c.includes('pending')) return { label: 'Pending', bg: '#b7791f' }
  if (c.includes('sold') || c.includes('closed')) return { label: 'Sold', bg: '#e11d48' }
  if (c.includes('active')) return { label: 'Active', bg: '#1f9d55' }
  return { label: c ? c.replace(/\b\w/g, x => x.toUpperCase()) : 'Featured', bg: '#111827' }
}

const SOCIAL: Record<string, { label: string; color: string; path: React.ReactNode }> = {
  website: { label: 'Website', color: '#475569', path: <><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></> },
  instagram: { label: 'Instagram', color: '#E1306C', path: <><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></> },
  facebook: { label: 'Facebook', color: '#1877F2', path: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /> },
  youtube: { label: 'YouTube', color: '#FF0000', path: <><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" /><path d="m10 15 5-3-5-3z" /></> },
  tiktok: { label: 'TikTok', color: '#111827', path: <><ellipse cx="9.4" cy="17.4" rx="3.4" ry="2.9" fill="currentColor" stroke="none" /><rect x="11.6" y="3.8" width="1.8" height="13.6" rx="0.9" fill="currentColor" stroke="none" /><path d="M13.4 3.8 A3.1 3.1 0 0 1 17.3 6.6" /></> },
}

// One home per slide - a recent sale too, one at a time, big, like a listing (user, 10/27: three
// small sold tiles side by side read cramped on a wide card).
type Slide =
  | { kind: 'listing'; item: any; href: string }
  | { kind: 'sale'; item: { image: string; city: string; price: string }; href: string }
const saleSlides = (items: { image: string; city: string; price: string }[] | undefined, href: string): Slide[] =>
  (items || []).map(item => ({ kind: 'sale' as const, item, href }))

export default function SignatureWebCard({ input, onForm, formPaths, followPage = true }: {
  input: Input
  /** A CTA that is one of the agent's own forms: opened over the page instead of leaving it. */
  onForm: (url: string, label: string) => void
  formPaths: string[]
  /** Go dark when the page around it is dark (websites). Off in the Studio preview. */
  followPage?: boolean
}) {
  const { identity, socials, buttons, listing, saleCards, listingHref, salesHref, stats, rotation, statsStrip, salesRecent, accent, fontFamily, dark: darkPref, luxe, metal } = input
  const m = LUXE_METALS[(metal || 'gold') as LuxeMetal]
  // Dark when the agent chose it, or when the page around it is dark (Guest Pass, Spotlight, CMA...).
  const [pageDark, setPageDark] = useState(false)
  const dark = !!darkPref || pageDark
  const ink = dark ? '#F4F2EC' : '#16171A'
  const muted = dark ? 'rgba(244,242,236,.62)' : 'rgba(22,23,26,.58)'
  const line = luxe ? (dark ? `rgba(${m.lightRgb},.26)` : `rgba(${m.rgb},.38)`) : (dark ? 'rgba(255,255,255,.10)' : 'rgba(22,23,26,.09)')
  const soft = dark ? 'rgba(255,255,255,.05)' : 'rgba(22,23,26,.035)'
  const bg = luxe
    ? (dark
      ? `radial-gradient(120% 140% at 100% 0%, rgba(${m.rgb},.20), transparent 55%), linear-gradient(135deg, #0b0f0e 0%, #111827 55%, #17140f 100%)`
      : `radial-gradient(110% 130% at 100% 0%, rgba(${m.rgb},.20), transparent 55%), linear-gradient(135deg, #fffdf8 0%, #fbf6ec 55%, #f4ead7 100%)`)
    : (dark ? '#17181C' : '#FFFFFF')
  const fill = `linear-gradient(180deg, color-mix(in srgb, ${accent} 100%, white 12%), ${accent} 55%, color-mix(in srgb, ${accent} 100%, black 10%))`
  const onAccent = inkOn(accent)

  const slides: Slide[] = useMemo(() => {
    if (rotation) {
      const out: Slide[] = rotation.listings.map((it: any) => ({ kind: 'listing' as const, item: it, href: it.href || rotation.listingsHref || '' }))
      if (rotation.sales?.length) out.splice(Math.max(0, Math.min(rotation.salesAt ?? out.length, out.length)), 0, ...saleSlides(rotation.sales, rotation.salesHref || ''))
      return out
    }
    if (listing) return [{ kind: 'listing', item: listing, href: listingHref || listing.href || '' }]
    if (saleCards?.length) return saleSlides(saleCards, salesHref || '')
    return []
  }, [rotation, listing, saleCards, listingHref, salesHref])
  const [at, setAt] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (slides.length < 2 || paused) return
    const t = window.setInterval(() => setAt(i => (i + 1) % slides.length), 6000)
    return () => window.clearInterval(t)
  }, [slides.length, paused])
  const slide = slides[at % Math.max(1, slides.length)]

  const [copied, setCopied] = useState<string | null>(null)
  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).then(() => { setCopied(v); window.setTimeout(() => setCopied(c => (c === v ? null : c)), 1600) }).catch(() => {})
  }
  const tel = String(identity.phone || '').replace(/[^\d+]/g, '')
  const contacts = [
    tel ? { key: 'call', icon: Phone, label: 'Call', href: `tel:${tel}` } : null,
    tel ? { key: 'text', icon: MessageSquare, label: 'Text', href: `sms:${tel}` } : null,
    identity.email ? { key: 'email', icon: Mail, label: 'Email', href: `mailto:${identity.email}` } : null,
    identity.vcardUrl ? { key: 'save', icon: Contact, label: 'Save', href: identity.vcardUrl } : null,
  ].filter(Boolean) as { key: string; icon: any; label: string; href: string }[]
  const subLine = [identity.title, identity.company, identity.team].filter(Boolean)
  const initials = (identity.name || 'A').split(' ').slice(0, 2).map((p: string) => p[0]?.toUpperCase() || '').join('')
  const isForm = (url: string) => { try { return formPaths.includes(new URL(url, window.location.href).pathname.replace(/\/$/, '')) } catch { return false } }
  const hasSide = slides.length > 0 || (!!stats && !statsStrip)
  // Two columns once the card itself is wide enough (it sits in columns of every width), else stacked.
  const rootRef = useRef<HTMLDivElement>(null)
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    if (followPage) setPageDark(!!el.closest('.dark, [data-mode="dark"]'))
    const ro = new ResizeObserver(([e]) => setWide(e.contentRect.width >= 640))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={rootRef} className="overflow-hidden rounded-[28px] shadow-[0_30px_70px_-42px_rgba(0,0,0,0.55)]"
      style={{ background: bg, border: `1px solid ${line}`, color: ink }}>
      {luxe && <div aria-hidden className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${m.deep}, ${m.light}, ${m.pale}, ${m.light}, ${m.deep})` }} />}
      <div className={`grid gap-0 ${hasSide && wide ? 'grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]' : ''}`}>
        {/* ---- who they are + every way to reach them */}
        <div className="p-5 sm:p-7">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {identity.headshot ? (
                <img src={identity.headshot} alt={identity.name} className="h-[84px] w-[84px] rounded-[22px] object-cover sm:h-[104px] sm:w-[104px]"
                  style={{ objectPosition: identity.headshotPosition ? `${identity.headshotPosition.x}% ${identity.headshotPosition.y}%` : undefined, boxShadow: `0 0 0 3px ${accent}, 0 16px 30px -16px rgba(0,0,0,.6)` }} />
              ) : (
                <span className="grid h-[84px] w-[84px] place-items-center rounded-[22px] text-2xl font-black sm:h-[104px] sm:w-[104px]" style={{ background: accent, color: onAccent }}>{initials}</span>
              )}
            </div>
            <div className="min-w-0">
              {identity.name && (
                <p className="flex items-center gap-1.5 text-[22px] font-black leading-[1.1] tracking-[-0.01em] sm:text-[27px]" style={{ fontFamily }}>
                  {/* The checkmark rides with the last word, so a long name never leaves it alone on
                      its own line (user, 10/27). */}
                  <span className="min-w-0 break-words">{(() => {
                    const words = String(identity.name).trim().split(/\s+/)
                    const last = words.pop()
                    return <>{words.length ? `${words.join(' ')} ` : ''}<span className="whitespace-nowrap">{last}{identity.showVerifiedBadge && <BadgeCheck className="ml-1.5 inline-block h-5 w-5 -translate-y-0.5 align-middle text-white" style={{ fill: "#1685e5" }} aria-label="Verified" />}</span></>
                  })()}</span>
                </p>
              )}
              {subLine.length > 0 && (
                <p className="mt-1 text-[13px] font-semibold leading-snug sm:text-[14px]" style={{ color: muted }}>
                  {subLine.map((b, i) => <span key={b}>{i > 0 && <span className="mx-1.5 opacity-50">·</span>}{i > 0 ? <b style={{ color: ink }}>{b}</b> : b}</span>)}
                </p>
              )}
            </div>
          </div>

          {/* phone + email (user, 10/24 - "don't like the spacing"): one tidy panel, a row each -
              icon, the label over the value, copy at the far right - so both line up evenly
              instead of floating at different widths. Side by side when the card is wide. */}
          {(identity.phone || identity.email) && (() => {
            const rows = [identity.phone ? { k: 'Mobile', v: fmtPhone(identity.phone), icon: Phone } : null, identity.email ? { k: 'Email', v: identity.email, icon: Mail } : null].filter(Boolean) as { k: string; v: string; icon: any }[]
            const side = wide && !hasSide && rows.length > 1
            return (
              <div className={`mt-4 grid overflow-hidden rounded-2xl ${side ? 'grid-cols-2' : ''}`} style={{ border: `1px solid ${line}`, background: soft }}>
                {rows.map((row, i) => (
                  <div key={row.k} className="flex min-w-0 items-center gap-3 px-3.5 py-2.5"
                    style={i ? (side ? { borderLeft: `1px solid ${line}` } : { borderTop: `1px solid ${line}` }) : undefined}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}>
                      <row.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: muted }}>{row.k}</span>
                      <span className="mt-0.5 block truncate font-bold" title={row.v} style={{ fontSize: row.v.length > 26 ? 12.5 : row.v.length > 21 ? 13.5 : 15 }}>{row.v}</span>
                    </span>
                    <button type="button" onClick={() => copy(row.v)} aria-label={`Copy ${row.k.toLowerCase()}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors" style={{ border: `1px solid ${line}`, color: copied === row.v ? '#10b981' : muted }}>
                      {copied === row.v ? <Check className="h-4 w-4" strokeWidth={3} /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* one-tap ways to reach them - real-size buttons */}
          {contacts.length > 0 && (
            <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${contacts.length}, minmax(0, 1fr))` }}>
              {contacts.map(c => (
                <a key={c.key} href={c.href} {...(c.key === 'save' ? { download: '' } : {})}
                  className="flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-black uppercase tracking-[0.08em] transition-transform active:scale-[0.97]"
                  style={c.key === 'save' ? { background: fill, color: onAccent } : { background: soft, border: `1px solid ${line}`, color: ink }}>
                  <c.icon className="h-[18px] w-[18px]" style={c.key === 'save' ? undefined : { color: accent }} />
                  <span className="max-w-full truncate">{c.label}</span>
                </a>
              ))}
            </div>
          )}

          {/* the agent's buttons (My Agent Hub, their forms...) */}
          {buttons.length > 0 && (
            // One per row on every size - side by side cut long ones off ("What's My Home Worth?"),
            // user 10/27. The label wraps rather than being trimmed.
            <div className="mt-3 grid gap-2">
              {buttons.map((b, i) => {
                const label = b.label.replace(/[→]/g, '').trim()
                const first = i === 0
                return (
                  <a key={`${b.label}-${i}`} href={b.url || '#'} target="_blank" rel="noopener"
                    onClick={e => { if (b.url && isForm(b.url)) { e.preventDefault(); onForm(b.url, label) } }}
                    className="group flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-4 py-2 text-center text-[13px] font-black leading-tight transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
                    style={first ? { background: fill, color: onAccent, boxShadow: `0 14px 28px -16px ${accent}` } : { border: `1.5px solid ${accent}`, color: ink }}>
                    <span className="min-w-0 text-balance">{label}</span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </a>
                )
              })}
            </div>
          )}

          {/* socials */}
          {socials.length > 0 && (
            <div className={`mt-4 flex flex-wrap items-center gap-2 ${wide ? '' : 'justify-center'}`}>
              {socials.map(s => {
                const look = SOCIAL[s.network]
                if (!look) return null
                return (
                  <a key={s.network} href={s.url} target="_blank" rel="noopener" aria-label={look.label} title={look.label}
                    className="grid h-11 w-11 place-items-center rounded-full transition-transform hover:-translate-y-0.5"
                    style={{ background: dark ? 'rgba(255,255,255,.92)' : '#fff', border: `1px solid ${line}`, color: look.color }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{look.path}</svg>
                  </a>
                )
              })}
            </div>
          )}

          {stats && statsStrip && <Stats stats={stats} accent={accent} line={line} soft={soft} muted={muted} href={salesHref} className="mt-5" />}
        </div>

        {/* ---- their numbers, then their homes (user, 10/27: numbers first - on a phone they used
            to come last, under the homes). One home at a time - photo filling the column on a wide
            card, its details and the arrows under it. */}
        {hasSide && (
          <div className={`flex min-w-0 flex-col gap-3 p-3 sm:p-4 ${wide ? "border-l" : "border-t"}`} style={{ borderColor: line }}
            onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            {stats && !statsStrip && <Stats stats={stats} accent={accent} line={line} soft={soft} muted={muted} href={salesHref} />}
            {slide && (
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px]" style={{ background: soft, border: `1px solid ${line}` }}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.a key={at} href={slide.href || undefined} target="_blank" rel="noopener"
                    initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                    className="flex min-h-0 flex-1 flex-col">
                    <HomeSlide slide={slide} accent={accent} muted={muted} salesRecent={salesRecent !== false} tall={wide} />
                  </motion.a>
                </AnimatePresence>
                {slides.length > 1 && (
                  <div className="flex items-center justify-between gap-3 px-4 pb-3">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {slides.map((_, k) => {
                        const cur = at % slides.length
                        const start = Math.min(Math.max(0, cur - 3), Math.max(0, slides.length - 7))
                        if (k < start || k >= start + 7) return null
                        return <button key={k} type="button" aria-label={`Show ${k + 1}`} onClick={() => { setPaused(true); setAt(k) }}
                          className="h-1.5 rounded-full transition-all duration-300" style={{ width: k === cur ? 20 : 6, background: k === cur ? accent : line }} />
                      })}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="mr-1 text-[11px] font-black tabular-nums" style={{ color: muted }}>{(at % slides.length) + 1} / {slides.length}</span>
                      {[[-1, ChevronLeft], [1, ChevronRight]].map(([d, Icon]: any) => (
                        <button key={d} type="button" aria-label={d < 0 ? 'Previous' : 'Next'} onClick={() => { setPaused(true); setAt(i => (i + d + slides.length) % slides.length) }}
                          className="grid h-8 w-8 place-items-center rounded-full transition-transform hover:scale-105 active:scale-95" style={{ background: dark ? 'rgba(255,255,255,.08)' : '#fff', border: `1px solid ${line}` }}>
                          <Icon className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function HomeSlide({ slide, accent, muted, salesRecent, tall }: { slide: Slide; accent: string; muted: string; salesRecent: boolean; tall: boolean }) {
  const sale = slide.kind === 'sale'
  const item: any = slide.item
  const c = sale ? { label: 'Sold', bg: '#e11d48' } : chip(item.status)
  const kicker = sale ? salesWords('Recently sold', salesRecent)
    : c.label === 'Coming Soon' ? 'Coming soon' : c.label === 'Sold' ? salesWords('Recent sale', salesRecent) : /just listed/i.test(item.kicker || '') ? item.kicker : 'Featured listing'
  const specs = sale ? [] : [item.beds ? `${item.beds} bd` : '', item.baths ? `${item.baths} ba` : '', item.sqft ? `${Number(item.sqft).toLocaleString()} sqft` : '', !item.sqft && item.acres ? `${item.acres} ac` : ''].filter(Boolean)
  const title = sale ? item.city : item.address
  const sub = sale ? '' : [item.location, specs.join(' · ')].filter(Boolean).join('  ·  ')
  return (
    <>
      <div className={`relative w-full overflow-hidden bg-black/10 ${tall ? 'min-h-[200px] flex-1' : 'aspect-[16/10]'}`}>
        {item.image && <img src={item.image} alt={title || ''} className="ohp-mls-crop absolute inset-0 h-full w-full object-cover object-left-bottom" loading="lazy" />}
        <span className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow" style={{ background: c.bg }}>{c.label}</span>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
        {item.price && <span className="absolute bottom-3 left-3 text-[24px] font-black leading-none text-white drop-shadow">{item.price}</span>}
      </div>
      <div className="px-4 pb-2 pt-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: accent }}>{kicker}</p>
        {title && <p className="mt-0.5 truncate text-[15px] font-black">{title}</p>}
        {sub && <p className="truncate text-[12.5px] font-semibold" style={{ color: muted }}>{sub}</p>}
      </div>
    </>
  )
}

function Stats({ stats, accent, line, soft, muted, href, className = '' }: {
  stats: { volume: string; sold: string; avg: string }; accent: string; line: string; soft: string; muted: string; href?: string; className?: string
}) {
  const cells = [{ v: stats.volume, l: 'Sales volume' }, { v: stats.sold, l: 'Homes sold' }, { v: stats.avg, l: 'Avg. price' }]
  const body = (
    <div className="grid grid-cols-3 overflow-hidden rounded-[18px]" style={{ background: soft, border: `1px solid ${line}` }}>
      {cells.map((c, i) => (
        <div key={c.l} className="flex flex-col items-center px-2 py-3 text-center" style={i ? { borderLeft: `1px solid ${line}` } : undefined}>
          <span className="text-[19px] font-black leading-none" style={{ color: accent }}>{c.v}</span>
          <span className="mt-1 whitespace-nowrap text-[9px] font-black uppercase tracking-[0.1em]" style={{ color: muted }}>{c.l}</span>
        </div>
      ))}
    </div>
  )
  return href ? <a href={href} target="_blank" rel="noopener" className={`block ${className}`}>{body}</a> : <div className={className}>{body}</div>
}
