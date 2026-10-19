/**
 * Card renderers — one per shareable resource. Each does fetch → normalize → ImageResponse,
 * with a branded fallback on any failure. Called BOTH from the app/<route>/opengraph-image.tsx
 * files AND from app/api/og/[kind] (which is what the custom-domain site renderer points its
 * og:image at, so an IDX agent's own-domain links get the same rich card).
 */
import { ImageResponse } from 'next/og'
import {
  OG_SIZE, ogFonts, ogFetch, imgToDataUri, imgSize, firstName, money, C,
  Eyebrow, AgentChip, PhotoCard,
} from './shared'
import { computeMatchScore } from '@/lib/matchScore'
import { hubAccentOf } from '@/components/agent-hub/HubClassicTheme'
import { isPropertyAvailableStatus } from '@/lib/utils'

type Fonts = ReturnType<typeof ogFonts>

const IR = (node: React.ReactElement, fonts: Fonts) => new ImageResponse(node, { ...OG_SIZE, fonts })

// --- Showcase ------------------------------------------------------------------------------
// A light, luxe card - "Dana's Showcase" with three of its best matches laid out like the cards
// on the Showcase page itself (photo, X% Match, price, beds/baths/sq ft, street). This is the
// preview people see in iMessage / texts when a Showcase link is sent, so it has to sell.

export const titleCase = (s?: string | null) => {
  const t = String(s || '').trim()
  return t && t === t.toUpperCase() ? t.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : t
}
const num = (n: any): number | null => (n == null || n === '' || !isFinite(Number(n)) ? null : Number(n))
const fmtN = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1))


export type OgHome = { photo: string | null; price: string; facts: string; street: string; city: string; match: number | null; isNew?: boolean }

/** A listing photo with Bright's bottom-left watermark pushed out of frame (scaled from the top-right). */
export function MlsSafePhoto({ src, w, h, radius = 0, corners }: { src: string | null; w: number; h: number; radius?: number; corners?: [number, number, number, number] }) {
  // corners = [top-left, top-right, bottom-right, bottom-left]. Zoomed 16% from the right so the
  // watermark falls outside; as centred top-to-bottom as it can be while the bottom tenth (where the
  // watermark sits) still falls outside - wide boxes showed only roofs (user, 10/19).
  const r = corners || [radius, radius, radius, radius]
  const dim = imgSize(src)
  const k = dim ? Math.max(w / dim.w, h / dim.h) * 1.16 : 0
  const bw = dim ? Math.round(dim.w * k) : Math.round(w * 1.16), bh = dim ? Math.round(dim.h * k) : Math.round(h * 1.16)
  const top = Math.round(Math.max(0, Math.min((bh - h) / 2, bh - h - bh * 0.1)))
  // Square corners: a plain <img> in a clipping box. Rounded: the photo is the box's own
  // background, since the image renderer clips a child <img> to a square, not a curve - it ran over
  // rounded card corners (user, 10/19). (Backgrounds repeat in tall boxes, hence not used for both.)
  if (!r.some(Boolean) || !dim) {
    return (
      <div style={{ display: 'flex', position: 'relative', width: w, height: h, overflow: 'hidden', backgroundColor: '#E9E2D3' }}>
        {src ? <img src={src} width={bw} height={bh} style={{ position: 'absolute', top: -top, right: 0, width: bw, height: bh, objectFit: 'cover' }} /> : null}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', position: 'relative', width: w, height: h, borderTopLeftRadius: r[0], borderTopRightRadius: r[1], borderBottomRightRadius: r[2], borderBottomLeftRadius: r[3], backgroundColor: '#E9E2D3',
      ...(src && dim ? { backgroundImage: `url(${src})`, backgroundSize: `${bw}px ${bh}px`, backgroundPosition: `${w - bw}px ${-top}px`, backgroundRepeat: 'no-repeat' } : {}) }} />
  )
}

/** The biggest font size (max..min) at which `text` fits `width` on one line; em = a letter's
 *  average width for that face (Playfair black ~0.53, Manrope black ~0.62, Manrope ~0.52). */
function fitSize(text: string, width: number, em: number, max: number, min: number) {
  return Math.max(min, Math.min(max, Math.floor(width / (Math.max(1, text.length) * em))))
}

function initialsOf(name: string) {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'A'
}

// A home's tag on the card (user, 10/19): its match only when it's a strong one - "36% Match" on a
// preview undersells the whole Showcase - otherwise "New" for a home added this week.
function HomeTag({ h, accentLight }: { h: OgHome; accentLight: string }) {
  const text = h.match != null && h.match >= 70 ? `${h.match}% Match` : h.isNew ? 'New' : null
  if (!text) return null
  return (
    <div style={{ display: 'flex', position: 'absolute', top: 14, left: 14, alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999, backgroundColor: 'rgba(17,24,39,0.88)', color: '#fff', fontSize: 17, fontWeight: 900 }}>
      <div style={{ display: 'flex', width: 8, height: 8, borderRadius: 999, backgroundColor: accentLight }} />
      {text}
    </div>
  )
}

const HOUSE_D = ['M3 10.5 12 3l9 7.5', 'M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5']

export function ShowcaseCard({
  count, forName, agentName, agentBrokerage, agentPhoto, homes, accent = C.gold, criteria = [],
}: {
  count: number
  forName: string
  agentName: string
  agentBrokerage: string | null
  agentPhoto: string | null
  homes: OgHome[]
  /** The colour it opens in - the agent's website colour when the link is on their own domain. */
  accent?: string
  /** What its search looks for ("$600K-$900K", "3+ beds", "Ardmore") - shown while it has no homes. */
  criteria?: string[]
}) {
  const shown = homes.slice(0, 3)
  const more = Math.max(0, count - shown.length)
  const deep = mixHex(accent, '#111111', 0.35)
  const light = mixHex(accent, '#ffffff', 0.4)
  const rgb = [1, 3, 5].map(i => parseInt(accent.slice(i, i + 2), 16)).join(',')
  const btnInk = lum(accent) > 0.6 ? '#16130e' : '#ffffff'
  // The homes fill the row whatever the count: three side by side, two wide, one as a feature.
  const n = shown.length
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', position: 'relative', width: '100%', height: '100%', fontFamily: 'Manrope', color: '#111827',
      backgroundColor: '#FAF8F3', padding: '44px 54px 46px',
      backgroundImage: `radial-gradient(700px 380px at 92% 0%, rgba(${rgb},0.30) 0%, rgba(${rgb},0) 70%), radial-gradient(620px 360px at 0% 100%, rgba(${rgb},0.16) 0%, rgba(${rgb},0) 70%)`,
    }}>
      {/* who it's for + who made it */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 18, fontWeight: 900, letterSpacing: 5, textTransform: 'uppercase', color: deep }}>
            <div style={{ display: 'flex', width: 34, height: 2, backgroundColor: accent }} />
            {forName ? 'Hand-picked homes' : 'Your personal Showcase'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 10, fontFamily: 'Playfair', fontWeight: 900, fontSize: 74, lineHeight: 1, letterSpacing: -1.5 }}>
            <span>{forName ? `${forName}’s` : 'Your'}</span>
            <span style={{ color: accent, marginLeft: 20 }}>Showcase</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 20px', borderRadius: 999, fontSize: 17, fontWeight: 900,
              backgroundImage: `linear-gradient(135deg, ${light}, ${accent})`, color: btnInk, boxShadow: `0 12px 24px -14px ${deep}` }}>
              Open my Showcase
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={btnInk} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
            </div>
            <div style={{ display: 'flex', fontSize: 20, fontWeight: 400, color: '#6B7280' }}>
              {count ? `${count} ${count === 1 ? 'home' : 'homes'} · new ones added as they list` : 'New homes added as they list'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 22px 12px 12px', borderRadius: 999, backgroundColor: '#FFFFFF', border: `1px solid rgba(${rgb},0.35)`, boxShadow: '0 10px 30px -14px rgba(17,24,39,0.25)' }}>
          {agentPhoto
            ? <img src={agentPhoto} width={58} height={58} style={{ width: 58, height: 58, borderRadius: 999, objectFit: 'cover', border: `2px solid ${accent}` }} />
            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 58, height: 58, borderRadius: 999, backgroundColor: '#111827', color: light, fontSize: 22, fontWeight: 900 }}>{initialsOf(agentName)}</div>}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 13, fontWeight: 900, letterSpacing: 2.5, textTransform: 'uppercase', color: deep }}>From your agent</div>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 900, color: '#111827', marginTop: 2 }}>{agentName}</div>
            {agentBrokerage ? <div style={{ display: 'flex', fontSize: 15, fontWeight: 400, color: '#6B7280', marginTop: 1 }}>{agentBrokerage}</div> : null}
          </div>
        </div>
      </div>

      {/* its homes, like the cards inside - or, before the first one lands, the search it runs */}
      {n === 1 ? (
        // One home: the email signature's featured-listing card - photo, kicker, address, spec pills,
        // and the price with a "View home" cue in its own column.
        <div style={{ display: 'flex', marginTop: 'auto', width: 1092, height: 300, borderRadius: 26, backgroundColor: '#FFFFFF', border: `2px solid rgba(${rgb},0.55)`, boxShadow: '0 22px 44px -22px rgba(17,24,39,0.45)' }}>
          <div style={{ display: 'flex', position: 'relative' }}>
            <MlsSafePhoto src={shown[0].photo} w={470} h={296} corners={[24, 0, 0, 24]} />
            <HomeTag h={shown[0]} accentLight={light} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, minWidth: 0, padding: '0 34px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 900, letterSpacing: 3.5, textTransform: 'uppercase', color: deep }}>
              <div style={{ display: 'flex', width: 22, height: 2, backgroundColor: accent }} />
              Newest for you
            </div>
            <div style={{ display: 'flex', fontFamily: 'Playfair', fontWeight: 900, fontSize: fitSize(shown[0].street || 'A new home', 360, 0.53, 36, 18), lineHeight: 1.1, color: '#111827', marginTop: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>{shown[0].street || 'A new home'}</div>
            {shown[0].city ? <div style={{ display: 'flex', fontSize: 19, color: '#6B7280', marginTop: 4 }}>{shown[0].city}</div> : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {shown[0].facts.split('  ·  ').filter(Boolean).map(f => (
                <div key={f} style={{ display: 'flex', padding: '6px 13px', borderRadius: 999, fontSize: 16, fontWeight: 900, color: deep, backgroundColor: `rgba(${rgb},0.14)` }}>{f}</div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 34px', borderLeft: `1px solid rgba(${rgb},0.35)` }}>
            <div style={{ display: 'flex', fontSize: 38, fontWeight: 900, color: '#111827', letterSpacing: -1 }}>{shown[0].price || 'Price on request'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 999, fontSize: 15, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase', color: btnInk, backgroundImage: `linear-gradient(135deg, ${light}, ${accent})` }}>
              View home
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={btnInk} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
            </div>
          </div>
        </div>
      ) : n === 2 ? (
        // Two homes: wide photos, and under each the address on the left, the price on the right.
        <div style={{ display: 'flex', gap: 22, marginTop: 'auto' }}>
          {shown.map((h, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', width: 535, borderRadius: 26, backgroundColor: '#FFFFFF', border: `2px solid rgba(${rgb},0.4)`, boxShadow: '0 22px 44px -22px rgba(17,24,39,0.45)' }}>
              <div style={{ display: 'flex', position: 'relative' }}>
                <MlsSafePhoto src={h.photo} w={531} h={206} corners={[24, 24, 0, 0]} />
                <HomeTag h={h} accentLight={light} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px 22px 18px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', fontSize: fitSize(h.street || 'A new home', 300, 0.62, 22, 14), fontWeight: 900, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>{h.street || 'A new home'}</div>
                  <div style={{ display: 'flex', fontSize: 16, color: '#6B7280', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>{[h.city, ...h.facts.split('  ·  ').filter(f => !f.includes('sq ft'))].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingLeft: 18, marginLeft: 16, borderLeft: `1px solid rgba(${rgb},0.35)` }}>
                  <div style={{ display: 'flex', fontSize: 28, fontWeight: 900, color: '#111827', letterSpacing: -0.5 }}>{h.price || 'Price on request'}</div>
                  <div style={{ display: 'flex', fontSize: 13, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', color: deep, marginTop: 2 }}>View home →</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : n === 3 ? (
        <div style={{ display: 'flex', gap: 22, marginTop: 'auto' }}>
          {shown.map((h, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', width: 345, borderRadius: 26, backgroundColor: '#FFFFFF',
              border: '1px solid rgba(17,24,39,0.06)', boxShadow: '0 22px 44px -22px rgba(17,24,39,0.45)',
            }}>
              <div style={{ display: 'flex', position: 'relative' }}>
                <MlsSafePhoto src={h.photo} w={343} h={196} corners={[25, 25, 0, 0]} />
                <HomeTag h={h} accentLight={light} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', padding: '15px 20px 17px' }}>
                <div style={{ display: 'flex', fontSize: 30, fontWeight: 900, color: '#111827', letterSpacing: -0.5 }}>{h.price || 'Price on request'}</div>
                {h.facts ? <div style={{ display: 'flex', fontSize: 17, fontWeight: 900, color: deep, marginTop: 4 }}>{h.facts}</div> : null}
                <div style={{ display: 'flex', fontSize: fitSize([h.street, h.city].filter(Boolean).join(', '), 305, 0.52, 17, 12), fontWeight: 400, color: '#6B7280', marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 305 }}>{[h.street, h.city].filter(Boolean).join(', ')}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // No homes yet: it's a live search - what it's looking for, and where the homes will land.
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto', width: 1092, height: 290, borderRadius: 26, padding: '0 40px', backgroundColor: '#FFFFFF', border: `2px solid rgba(${rgb},0.4)`, boxShadow: '0 22px 44px -22px rgba(17,24,39,0.35)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 900, letterSpacing: 3.5, textTransform: 'uppercase', color: deep }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={deep} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              Searching for
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16, maxWidth: 700 }}>
              {(criteria.length ? criteria : ['Homes picked for you']).slice(0, 7).map(c => (
                <div key={c} style={{ display: 'flex', padding: '9px 16px', borderRadius: 999, fontSize: 19, fontWeight: 900, color: '#111827', backgroundColor: `rgba(${rgb},0.13)`, border: `1px solid rgba(${rgb},0.35)` }}>{c}</div>
              ))}
            </div>
            <div style={{ display: 'flex', fontSize: 18, color: '#6B7280', marginTop: 18 }}>Matching homes land here the moment they list.</div>
          </div>
          {/* three home tiles waiting, fanned */}
          <div style={{ display: 'flex', position: 'relative', width: 270, height: 220 }}>
            {[-8, 0, 8].map((deg, i) => (
              <div key={i} style={{ display: 'flex', position: 'absolute', left: 30 + i * 40, top: 20 + (i === 1 ? -6 : 8), width: 150, height: 180, borderRadius: 18, transform: `rotate(${deg}deg)`,
                flexDirection: 'column', overflow: 'hidden', backgroundColor: '#FFFFFF', border: `2px dashed rgba(${rgb},0.55)`, boxShadow: '0 16px 30px -18px rgba(17,24,39,0.45)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 110, backgroundImage: `linear-gradient(135deg, rgba(${rgb},0.2), rgba(${rgb},0.06))` }}>
                  <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">{HOUSE_D.map((d, k) => <path key={k} d={d} />)}</svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', width: 80, height: 11, borderRadius: 6, backgroundColor: `rgba(${rgb},0.3)` }} />
                  <div style={{ display: 'flex', width: 110, height: 8, borderRadius: 4, backgroundColor: 'rgba(17,24,39,0.08)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {more > 0 && n ? (
        <div style={{ display: 'flex', position: 'absolute', right: 56, bottom: 14, fontSize: 14, fontWeight: 900, letterSpacing: 2.5, textTransform: 'uppercase', color: deep }}>
          {`+ ${more} more inside`}
        </div>
      ) : null}
    </div>
  )
}

const shortMoney = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(/\.0$/, '')}M` : `$${Math.round(n / 1000)}K`)
const place = (s: string) => titleCase(String(s).split(',')[0])

/** A Showcase's search in a few words, for the card before its first home lands. */
function searchCriteria(p: any): string[] {
  if (!p) return []
  const out: string[] = []
  const lo = num(p.min_price), hi = num(p.max_price)
  if (lo && hi) out.push(`${shortMoney(lo)} - ${shortMoney(hi)}`)
  else if (hi) out.push(`Up to ${shortMoney(hi)}`)
  else if (lo) out.push(`${shortMoney(lo)}+`)
  if (num(p.min_beds)) out.push(`${num(p.min_beds)}+ beds`)
  if (num(p.min_baths)) out.push(`${num(p.min_baths)}+ baths`)
  const types = [p.is_single_family && 'Single family', p.is_town_house && 'Townhouse', p.is_condo && 'Condo', p.is_multi_family && 'Multi-family', p.is_lot_land && 'Land', p.is_farm && 'Farm'].filter(Boolean) as string[]
  if (types.length && types.length <= 2) out.push(...types)
  for (const c of [...(p.cities || []), ...(p.townships || [])].slice(0, 2)) out.push(place(c))
  for (const d of (p.school_districts || []).slice(0, 1)) out.push(`${place(d)} schools`)
  if (num(p.diameter) && p.address) out.push(`Within ${num(p.diameter)} mi of ${place(p.address)}`)
  else if (p.has_drawn_area) out.push('Your map area')
  if (num(p.min_year_built) && num(p.min_year_built)! > 1900) out.push(`Built ${num(p.min_year_built)}+`)
  return out
}

export async function renderShowcaseCard(shareToken: string, fonts: Fonts, accentParam?: string | null): Promise<ImageResponse> {
  // ?accent=rrggbb - the agent's website colour (the Showcase opens in it on their own domain)
  const accent = accentParam && /^[0-9a-f]{6}$/i.test(accentParam) ? `#${accentParam}` : C.gold
  try {
    const data = await ogFetch<any>(`/collections/shared/${encodeURIComponent(shareToken)}`)
    const all: any[] = Array.isArray(data?.matchedProperties) ? data.matchedProperties : []
    // Not the home they toured (it's in the set at 100%) - the card shows them new homes.
    const orig = data?.originalProperty || {}
    const origKey = String(orig.listingKey || orig.ListingKey || '')
    const origStreet = String(orig.address || '').split(',')[0].trim().toLowerCase()
    const isOrig = (p: any) => (origKey && String(p?.ListingKey || '') === origKey) || (origStreet && String(p?.FullStreetAddress || '').trim().toLowerCase() === origStreet)
    const live = all.filter(p => !isOrig(p) && isPropertyAvailableStatus(p?.MlsStatus || p?.StandardStatus))
    const pool = live.length >= 3 ? live : all.filter(p => !isOrig(p))
    // The three NEWEST homes in their Showcase (user, 10/17) - so a link copied today shows what just
    // came in - each still wearing the same "X% Match" the client sees on their cards.
    const subject = data?.preferences?.show_match_score !== false ? data?.originalProperty : null
    const scored = pool.map(p => ({ p, match: subject ? computeMatchScore(p, subject, pool) : null }))
    const t = (p: any) => Date.parse(p?.AddedAt || '') || Date.parse(p?.MLSListDate || p?.ListingContractDate || '') || 0
    scored.sort((a, b) => (t(b.p) - t(a.p)) || ((b.match ?? 0) - (a.match ?? 0)))
    const top = scored.filter(s => s.p?.ListPictureURL).slice(0, 3)
    const [agentPhoto, ...photos] = await Promise.all([
      imgToDataUri(data?.agentPhotoUrl),
      ...top.map(s => imgToDataUri(s.p.ListPictureURL, 4500)),
    ])
    const homes: OgHome[] = top.map((s, i) => {
      const p = s.p
      const beds = num(p.BedroomsTotal), baths = num(p.BathroomsTotal), sqft = num(p.LivingArea)
      return {
        photo: photos[i],
        price: money(num(p.ListPrice)),
        facts: [beds != null ? `${fmtN(beds)} bd` : null, baths != null ? `${fmtN(baths)} ba` : null, sqft ? `${Math.round(sqft).toLocaleString('en-US')} sq ft` : null].filter(Boolean).join('  ·  '),
        street: titleCase(p.FullStreetAddress),
        city: titleCase(p.City),
        match: s.match != null ? Math.round(s.match) : null,
        isNew: Date.now() - t(p) < 7 * 86400000,
      }
    })
    return IR(
      <ShowcaseCard
        count={all.length}
        forName={titleCase(firstName(data?.customer?.firstName || data?.customer?.name))}
        agentName={data?.agentFullName || data?.agentName || 'Your agent'}
        agentBrokerage={data?.agentBrokerage || null}
        agentPhoto={agentPhoto}
        homes={homes}
        accent={accent}
        criteria={searchCriteria(data?.preferences)}
      />,
      fonts,
    )
  } catch {
    return IR(<ShowcaseCard count={0} forName="" agentName="Your agent" agentBrokerage={null} agentPhoto={null} homes={[]} accent={accent} />, fonts)
  }
}

// --- CMA ------------------------------------------------------------------------------------
// The home full-bleed with the agent's headshot (user, 10/19 - a hybrid of the old card and the
// report-coloured one): the agent's accent, who it's for, what's inside and a button. No value on
// the card: the number is the reason to open it (and a forwarded preview shouldn't give it away).
export function CmaCard({ forName, ...rest }: {
  photo: string | null; street: string; place: string; facts: string[]; forName: string; mode: 'buyer' | 'listing'
  comps: number; agentName: string; agentBrokerage: string | null; agentPhoto: string | null; base?: string; accent: string
}) {
  return <HomePhotoCard {...rest} eyebrow="Comparative Market Analysis" sub={`What it's worth  ·  Prepared for ${forName || 'you'}`} />
}

/** A home's link (CMA, open house): the whole home behind it (user, 10/19 - "I like the before ...
 *  entire property pic"), the agent's real headshot on top, then the label, "Street, Town" in one
 *  serif line and one line under it. */
export function HomePhotoCard({ photo, street, place, eyebrow, sub, agentName, agentBrokerage, agentPhoto, accent }: {
  photo: string | null; street: string; place: string; eyebrow: string; sub: string
  agentName: string; agentBrokerage: string | null; agentPhoto: string | null; accent: string
}) {
  const light = mixHex(accent, '#ffffff', 0.45)
  const btnInk = lum(accent) > 0.6 ? '#111827' : '#ffffff'
  const rgb = [1, 3, 5].map(i => parseInt(accent.slice(i, i + 2), 16)).join(',')
  // "847 Lesley Rd, Villanova" - the town in the same serif and size, on one line (user, 10/19)
  const headline = [street, place.split(',')[0]].filter(Boolean).join(', ')
  // a long address gets smaller until it fits on one line (user, 10/19) - only a freak lot
  // description ("Lot E 133-9.00 ... off of Shortly Rd") still runs out of room at the smallest size
  const titleSize = fitSize(headline, 1056, 0.53, 78, 26)
  return (
    <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%', fontFamily: 'Manrope', backgroundColor: C.bgBot,
      backgroundImage: `radial-gradient(1000px 640px at 78% 22%, ${C.bgTop} 0%, ${C.bgMid} 55%, ${C.bgBot} 100%)` }}>
      {photo ? <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0 }}><MlsSafePhoto src={photo} w={1200} h={630} /></div> : null}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex',
        backgroundImage: 'linear-gradient(0deg, rgba(9,7,4,0.95) 0%, rgba(9,7,4,0.4) 55%, rgba(9,7,4,0.5) 100%), linear-gradient(90deg, rgba(9,7,4,0.8) 0%, rgba(9,7,4,0.15) 60%, rgba(9,7,4,0.3) 100%)' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 7, display: 'flex', backgroundImage: `linear-gradient(90deg, ${accent}, ${light}, ${accent})` }} />

      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '52px 72px 58px', color: '#fff' }}>
        {/* the agent first - their real headshot */}
        <div style={{ display: 'flex', alignSelf: 'flex-start', alignItems: 'center', gap: 16, padding: '9px 26px 9px 9px', borderRadius: 999, backgroundColor: 'rgba(9,7,4,0.55)', border: `1px solid rgba(${rgb},0.45)` }}>
          {agentPhoto
            ? <img src={agentPhoto} width={66} height={66} style={{ width: 66, height: 66, borderRadius: 999, objectFit: 'cover', border: `3px solid ${light}` }} />
            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 66, height: 66, borderRadius: 999, backgroundColor: accent, color: btnInk, fontSize: 24, fontWeight: 900 }}>{initialsOf(agentName)}</div>}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 24, fontWeight: 900 }}>{agentName}</div>
            {agentBrokerage ? <div style={{ display: 'flex', fontSize: 15, fontWeight: 900, letterSpacing: 2.5, textTransform: 'uppercase', color: light }}>{agentBrokerage}</div> : null}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 20, fontWeight: 900, letterSpacing: 6, textTransform: 'uppercase', color: light }}>
            <div style={{ display: 'flex', width: 34, height: 2, backgroundColor: light }} />
            {eyebrow}
          </div>
          <div style={{ display: 'flex', fontFamily: 'Playfair', fontWeight: 900, fontSize: titleSize, lineHeight: 1.04, letterSpacing: -1, marginTop: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 1056 }}>{headline}</div>
          <div style={{ display: 'flex', fontSize: 30, color: C.sub, marginTop: 14 }}>{sub}</div>
        </div>
      </div>
    </div>
  )
}

export async function renderCmaCard(slug: string, fonts: Fonts, preview?: { mode?: string | null; client?: string | null } | null): Promise<ImageResponse> {
  const hex = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d)
  try {
    const data = await ogFetch<any>(`/api/cma/public/${encodeURIComponent(slug)}`)
    const subj = data?.subject || {}
    const agent = data?.agent || {}
    const [photo, agentPhoto] = await Promise.all([
      imgToDataUri(subj.photo_url || (Array.isArray(subj.photos) ? subj.photos[0] : null), 4500),
      imgToDataUri(agent.headshot_url || agent.photo_url || agent.photoUrl),
    ])
    const beds = num(subj.beds), baths = num(subj.baths), sqft = num(subj.sqft)
    const facts = [beds != null ? `${fmtN(beds)} bd` : null, baths != null ? `${fmtN(baths)} ba` : null, sqft ? `${Math.round(sqft).toLocaleString('en-US')} sq ft` : null].filter(Boolean) as string[]
    const mode = (preview?.mode || data?.mode) === 'listing' ? 'listing' : 'buyer'
    return IR(
      <CmaCard photo={photo} street={titleCase(subj.street_address) || 'Your home'}
        place={[titleCase(subj.city), subj.state].filter(Boolean).join(', ')}
        facts={facts} forName={titleCase(firstName(preview?.client ?? data?.client_name))} mode={mode}
        comps={Array.isArray(data?.comparables) ? data.comparables.length : 0}
        agentName={agent.name || agent.full_name || 'Your agent'} agentBrokerage={agent.brokerage || null} agentPhoto={agentPhoto}
        base={hex(agent.primary_color, '#111827')} accent={hex(agent.secondary_color, C.gold)} />,
      fonts,
    )
  } catch {
    return IR(<CmaCard photo={null} street="Your home" place="" facts={[]} forName="" mode="listing" comps={0} agentName="Your agent" agentBrokerage={null} agentPhoto={null} base="#111827" accent={C.gold} />, fonts)
  }
}

export async function renderOpenHouseCard(eventId: string, fonts: Fonts): Promise<ImageResponse> {
  try {
    const data = await ogFetch<any>(`/open-house/property/${encodeURIComponent(eventId)}`)
    const p = data?.property || {}
    const bits = [
      p.beds ? `${p.beds % 1 === 0 ? p.beds : p.beds.toFixed(1)} bd` : null,
      p.baths ? `${p.baths % 1 === 0 ? p.baths : p.baths.toFixed(1)} ba` : null,
      p.squareFeet ? `${Math.round(p.squareFeet).toLocaleString()} sqft` : null,
    ].filter(Boolean)
    const sub = [money(p.price), bits.join('  ·  ')].filter(Boolean).join('  ·  ') || 'Sign in and take a look around'
    const [photo, agentPhoto] = await Promise.all([
      imgToDataUri(p.imageSrc || (Array.isArray(p.photos) ? p.photos[0] : null), 4500),
      imgToDataUri(p.agentPhotoUrl, 4500),
    ])
    // the same look as the CMA card, in the sign-in page's own colour
    const accent = typeof data?.theme?.accentColor === 'string' && /^#[0-9a-f]{6}$/i.test(data.theme.accentColor) ? data.theme.accentColor : C.gold
    return IR(
      <HomePhotoCard photo={photo} street={titleCase(p.address) || 'Open House'} place={titleCase(p.city)} eyebrow="Open House" sub={sub}
        agentName={p.agentName || 'Your host'} agentBrokerage={p.agentBrokerage || null} agentPhoto={agentPhoto} accent={accent} />,
      fonts,
    )
  } catch {
    return IR(<PhotoCard photo={null} eyebrow="Open House" headline="You're invited to an open house" sub="Sign in and take a look around" agentName="Your host" />, fonts)
  }
}

// An article link (user, 10/18): the same look as the article cards on the Agent Hub - the cover
// photo when there is one (uploaded or AI-made), otherwise the designed cover art picked by who
// the article is for (key + doorway for buyers, sold sign for sellers...) - framed in the agent's
// own metal / accent, the category chip, the agent, the title sized so it never gets cut off, an
// automatic one-line summary that always ends on a whole word, and the reading time.
type CoverKind = 'buyers' | 'sellers' | 'market' | 'community' | 'home' | 'general'
function coverKindOf(category?: string | null, title?: string | null): CoverKind {
  const s = `${category || ''} ${title || ''}`.toLowerCase()
  if (/buy|first[- ]time|mortgage|offer|closing/.test(s)) return 'buyers'
  if (/sell|list|staging|pricing|downsiz/.test(s)) return 'sellers'
  if (/market|insight|update|trend|rate|data|report|forecast/.test(s)) return 'market'
  if (/neighbo|communit|town|area|local|guide|school|living in/.test(s)) return 'community'
  if (/home|lifestyle|design|renovat|garden|tips|maint/.test(s)) return 'home'
  return 'general'
}
// Same palettes and line art as components/BlogCoverArt.tsx (the hub / IDX article cards).
const COVER_PAL: Record<CoverKind, { a: string; b: string; glow: string }> = {
  buyers: { a: '#0f2e26', b: '#1c5a49', glow: '232,201,122' },
  sellers: { a: '#2a1a12', b: '#6e4426', glow: '219,164,124' },
  market: { a: '#131a33', b: '#2a3466', glow: '201,162,77' },
  community: { a: '#1a1510', b: '#3a2d1a', glow: '232,201,122' },
  home: { a: '#0b0f0e', b: '#1d2b2a', glow: '201,162,77' },
  general: { a: '#111827', b: '#2a2218', glow: '201,162,77' },
}
const COVER_MOTIF: Record<CoverKind, { d: string[]; circles?: [number, number, number][]; rects?: [number, number, number, number][] }> = {
  buyers: { d: ['M8 40V18l16-11 16 11v22', 'M20 40V27h8v13', 'm33 17-9 9M27 23l2 2M25 25l2 2'], circles: [[36, 14, 4]] },
  sellers: { d: ['M4 42h40', 'M10 42V22l10-8 10 8v20', 'M30 42V26l6-5 6 5v16', 'M23 17v5', 'M18 12.5h10'], rects: [[14, 8, 18, 9]] },
  market: { d: ['M6 40h36', 'M8 34l9-10 7 6 8-11 8 5', 'm34 19 6 5v-7z', 'M10 40V30M19 40V26M27 40V32M35 40V26M43 40V22'] },
  community: { d: ['M2 42h44', 'M5 42V26l6-5 6 5v16', 'M17 42V20h10v22', 'M27 42V30l7-6 7 6v12', 'M20 24h4M20 29h4M20 34h4M8 31h2M36 33h2'], circles: [[37, 10, 3.5]] },
  home: { d: ['M12 30l12-11 12 11', 'M15 28v10h18V28', 'M21 38v-6h6v6'], rects: [[5, 5, 38, 38]] },
  general: { d: ['M2 40h44', 'M6 40V28l6-5 6 5v12', 'M18 40V22l6-5 6 5v18', 'M30 40V30l6-5 6 5v10', 'M24 23v4M12 29v3M36 31v3'] },
}
function CoverMotif({ kind, size, color, width = 0.9 }: { kind: CoverKind; size: number; color: string; width?: number }) {
  const m = COVER_MOTIF[kind]
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {m.d.map((d, i) => <path key={i} d={d} />)}
      {(m.circles || []).map(([cx, cy, r], i) => <circle key={`c${i}`} cx={cx} cy={cy} r={r} />)}
      {(m.rects || []).map(([x, y, w, h], i) => <rect key={`r${i}`} x={x} y={y} width={w} height={h} rx={kind === 'home' ? 3 : 1.5} />)}
    </svg>
  )
}

/** The share line: written-for-sharing text first, trimmed to whole words (never "property ta"). */
function shareLine(...cands: (string | null | undefined)[]): string | null {
  const raw = cands.map(c => String(c || '').replace(/\s+/g, ' ').trim()).find(Boolean)
  if (!raw) return null
  const MAX = 230
  if (raw.length <= MAX) return raw
  const cut = raw.slice(0, MAX)
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  if (sentence >= 60) return cut.slice(0, sentence + 1)
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\-–—]+$/, '') + '…'
}

export function BlogCard({ photo, kind, category, title, summary, minutes, agentName, agentBrokerage, agentPhoto, look: lookIn }: {
  photo: string | null; kind: CoverKind; category: string; title: string; summary: string | null; minutes: number | null
  agentName: string; agentBrokerage: string | null; agentPhoto: string | null; look: HubLook
}) {
  let look = lookIn
  // Everything takes the article's own color (user, 10/18): the no-cover art is tinted with it
  // instead of a fixed color per category, and a dark accent (Navy, Charcoal...) is lifted so the
  // labels stay readable on the dark card.
  const hi = lum(look.light) < 0.6 ? mixHex(look.light, '#ffffff', 0.55) : look.light
  const rgbOf = (h: string) => { const x = h.replace('#', ''); const n = parseInt(x, 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}` }
  const pal = { a: '#0a0b0e', b: mixHex(look.deep, '#0a0b0e', 0.45), glow: rgbOf(lum(look.base) < 0.35 ? mixHex(look.base, '#ffffff', 0.5) : look.base) }
  const glow = `rgb(${pal.glow})`
  look = { ...look, light: hi }
  // Title steps down with length so it always fits (3 lines at most).
  const long = (summary?.length || 0) > 150
  const tSize = title.length > 95 ? 40 : title.length > 72 ? 44 : title.length > 48 ? (long ? 48 : 52) : (long ? 54 : 62)
  const sSize = (summary?.length || 0) > 190 ? 19 : long ? 20 : 22
  return (
    <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%', fontFamily: 'Manrope', color: '#fff', overflow: 'hidden',
      backgroundColor: pal.a, backgroundImage: `radial-gradient(900px 640px at 100% 0%, rgba(${pal.glow},0.42), transparent 58%), linear-gradient(135deg, ${pal.a}, ${pal.b})` }}>
      {photo ? <img src={photo} style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover' }} /> : (
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex' }}>
          <div style={{ position: 'absolute', right: 70, top: 40, display: 'flex', opacity: 0.6 }}><CoverMotif kind={kind} size={380} color={glow} /></div>
          <div style={{ position: 'absolute', left: -40, top: 250, display: 'flex', opacity: 0.14 }}><CoverMotif kind={kind} size={260} color={glow} /></div>
        </div>
      )}
      {/* readable text over any photo */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex',
        backgroundImage: photo
          ? 'linear-gradient(0deg, rgba(7,10,15,0.96) 0%, rgba(7,10,15,0.78) 38%, rgba(7,10,15,0.25) 70%, rgba(7,10,15,0.35) 100%)'
          : 'linear-gradient(0deg, rgba(7,10,15,0.85) 0%, rgba(7,10,15,0.35) 50%, rgba(7,10,15,0) 80%)' }} />
      {/* the agent's metal / accent frame */}
      <div style={{ position: 'absolute', top: 22, left: 22, right: 22, bottom: 22, display: 'flex', border: `2px solid ${look.light}`, borderRadius: 22, opacity: 0.75 }} />

      {/* the agent, top-left */}
      {/* the agent, top-left - big enough to read in a small preview (user, 10/18: "double the size") */}
      <div style={{ position: 'absolute', top: 46, left: 52, display: 'flex', alignItems: 'center', gap: 17, padding: '8px 30px 8px 8px', borderRadius: 999,
        backgroundColor: 'rgba(8,8,10,0.62)', border: `1.5px solid ${look.light}66` }}>
        {agentPhoto
          ? <img src={agentPhoto} width={84} height={84} style={{ width: 84, height: 84, borderRadius: 999, objectFit: 'cover', border: `3px solid ${look.light}` }} />
          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 84, height: 84, borderRadius: 999, backgroundColor: '#111', color: look.light, fontSize: 30, fontWeight: 900 }}>{initialsOf(agentName)}</div>}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: agentName.length > 20 ? 27 : 33, fontWeight: 900, lineHeight: 1.05 }}>{agentName}</div>
          {agentBrokerage ? <div style={{ display: 'flex', fontSize: 16.5, fontWeight: 900, letterSpacing: 2.5, textTransform: 'uppercase', color: look.light, marginTop: 4 }}>{agentBrokerage}</div> : null}
        </div>
      </div>

      <div style={{ position: 'absolute', left: 62, right: 70, bottom: 50, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 17, fontWeight: 900, letterSpacing: 5, textTransform: 'uppercase', color: look.light }}>{category}</div>
        <div style={{ display: 'flex', width: 70, height: 3, marginTop: 12, backgroundImage: `linear-gradient(90deg, ${look.light}, rgba(0,0,0,0))` }} />
        <div style={{ display: 'flex', fontFamily: 'Playfair', fontWeight: 900, fontSize: tSize, lineHeight: 1.06, letterSpacing: -0.8, marginTop: 14, maxWidth: 1040 }}>{title}</div>
        {summary ? <div style={{ display: 'flex', fontSize: sSize, lineHeight: 1.36, color: 'rgba(243,236,221,0.88)', marginTop: 12, maxWidth: 1040 }}>{summary}</div> : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, fontSize: 15, fontWeight: 900, letterSpacing: 3.5, textTransform: 'uppercase', color: look.light }}>
          Read the story
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={look.light} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
          {minutes ? <div style={{ display: 'flex', color: 'rgba(255,255,255,0.55)' }}>·  {minutes} min read</div> : null}
        </div>
      </div>
    </div>
  )
}

/** The card's colors from the article's own look: Luxe = its metal, Classic = its accent (the Agent
 *  Hub's Classic choices), Editorial = black & white, Modern / Midnight = their gold. No look saved
 *  = the article default (Classic, Original gold). */
function articleLook(data: any, hubCfg: any): HubLook {
  const dark = !!hubCfg?.visitorDarkMode
  const theme = String(data?.theme || 'luxe')
  if (theme === 'luxe_plus') return { ...(LUXE[data?.luxeMetal] || LUXE.gold), dark }
  if (theme === 'editorial') return { base: '#d1d5db', light: '#f3f4f6', deep: '#6b7280', wash: ['#ffffff', '#f5f5f5', '#e5e5e5'], night: ['#0b0b0b', '#141414', '#1f1f1f'], dark }
  if (theme === 'midnight') return { ...LUXE.gold, light: '#e8c97a', dark: true }
  if (theme === 'modern') return { ...LUXE.gold, dark }
  const accent = hubAccentOf(data?.accentColor)
  return hubLook({ hubTheme: 'classic', hubAccent: accent, visitorDarkMode: dark })
}

export async function renderBlogCard(agentSlug: string, blogSlug: string, fonts: Fonts): Promise<ImageResponse> {
  try {
    const [data, hub] = await Promise.all([
      ogFetch<any>(`/studio/blogs/public/${encodeURIComponent(agentSlug)}/${encodeURIComponent(blogSlug)}?track=false`, 0),
      ogFetch<any>(`/agent-hub/public/${encodeURIComponent(agentSlug)}`, 0),
    ])
    const [photo, agentPhoto] = await Promise.all([
      imgToDataUri(data?.socialImageUrl || data?.coverImageUrl, 5000),
      imgToDataUri(data?.agentPhotoUrl),
    ])
    const look = articleLook(data, hub?.config || null)
    const category = data?.category ? String(data.category) : 'Market Notes'
    const title = String(data?.socialTitle || data?.title || 'From the blog')
    return IR(
      <BlogCard photo={photo} kind={coverKindOf(category, title)} category={category} title={title}
        summary={shareLine(data?.socialDescription, data?.metaDescription, data?.subtitle)}
        minutes={Number(data?.readingTimeMinutes) || null}
        agentName={data?.agentName || 'Your agent'} agentBrokerage={data?.agentBrokerage || null} agentPhoto={agentPhoto} look={look} />,
      fonts,
    )
  } catch {
    return IR(<PhotoCard photo={null} eyebrow="Market Notes" headline="From the blog" agentName="Your agent" />, fonts)
  }
}

// --- Forms ---------------------------------------------------------------------------------
// One of the agent's forms (user, 10/18 - "match what we did for the Agent Hub"): the same business-
// card frame in the agent's own hub look (Luxe metal or Classic accent, light or dark - a form set
// to dark is dark), with the form's own picture (a price tag for What's My Home Worth, a key for
// I'm Buying, a yard sign for I'm Selling, a calendar for a showing...) so a few of them in one
// text thread don't look the same, and a button-like "tap here" line.
type FormKind = 'value' | 'buy' | 'sell' | 'showing' | 'showcase' | 'talk' | 'start'
const FORM_KIND: Record<string, FormKind> = {
  home_value: 'value', buying: 'buy', buyer_onboarding: 'buy', selling: 'sell', seller_onboarding: 'sell', make_me_sell: 'sell',
  showing: 'showing', showcase_request: 'showcase', how_can_i_help: 'talk',
}
const FORM_FACE: Record<FormKind, { eyebrow: string; button: string; d: string[] }> = {
  value: { eyebrow: 'Home value', button: "See what it's worth",
    d: ['M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z', 'M7.5 7.5h.01'] },
  buy: { eyebrow: 'Buying', button: 'Start my search',
    d: ['M2.59 17.41A2 2 0 0 0 2 18.83V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.17a2 2 0 0 0 1.41-.59l.82-.81a6.5 6.5 0 1 0-4-4z', 'M16.5 7.5h.01'] },
  sell: { eyebrow: 'Selling', button: "Let's talk selling",
    d: ['M4 22V3', 'M4 5h16', 'M9 5v3', 'M17 5v3', 'M8 8h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', 'M11 15v-2.5l3-2 3 2V15'] },
  showing: { eyebrow: 'Private showing', button: 'Pick a time',
    d: ['M8 2v4', 'M16 2v4', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M3 10h18', 'M9 16l2 2 4-4'] },
  showcase: { eyebrow: 'Your own Showcase', button: 'Build my Showcase',
    d: ['M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.13a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0z', 'M20 3v4', 'M22 5h-4'] },
  talk: { eyebrow: 'Get in touch', button: "Let's talk",
    d: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', 'M8 9h8', 'M8 13h5'] },
  // An agent's own form could be about anything (user, 10/19: "what if it says let's talk but it's
  // not about talking") - so nothing that guesses what it's for.
  start: { eyebrow: 'Quick form', button: 'Click here to start',
    d: ['M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'M12 11h4', 'M12 16h4', 'M8 11h.01', 'M8 16h.01'] },
}


// The card's words (user, 10/18): the title on one line ("Name Your Price" / "We'll Tell You If
// It's Possible" as two), the line under it on one line. Built-in forms still on their template
// words get copy written for the card; anything the agent wrote is used as they wrote it.
const FORM_CARD_COPY: Record<string, { defaults: string[]; headline: string; support: string }> = {
  home_value: { defaults: ["Let's Find Out What Your Home Is Worth"], headline: "What's My Home Worth?", support: "Find out your home's true value in today's market." },
  buying: { defaults: ["Let's Find Your Next Home"], headline: "Let's Find Your Next Home", support: "Tell me what you want and I'll build your plan." },
  selling: { defaults: ["Let's Get Your Home Sold"], headline: "Let's Get Your Home Sold", support: 'A few quick questions to plan your sale.' },
  showing: { defaults: ['Schedule a Showing'], headline: 'Schedule a Showing', support: "Pick a time and I'll set it up for you." },
  showcase_request: { defaults: ['Setup My Own Showcase', 'Set Up My Own Showcase'], headline: 'Create A Showcase', support: 'Homes that match what you want, as they list.' },
  how_can_i_help: { defaults: ['How Can We Help', 'How Can I Help'], headline: 'How Can I Help?', support: "Tell me what you need and I'll follow up." },
  seller_onboarding: { defaults: ["Let's Get Your Listing Started"], headline: "Let's Get Your Listing Started", support: 'A few details to set your listing up right.' },
  buyer_onboarding: { defaults: ["Let's Get You Set Up"], headline: "Let's Get You Set Up", support: 'A few details so I can start finding your homes.' },
  make_me_sell: { defaults: ["Name Your Price - We'll Tell You If It's Possible"], headline: "Name Your Price - We'll Tell You If It's Possible", support: 'Tell me the number that would make you say yes.' },
}
const firstSentence = (t: string) => (t.match(/^.*?[.!?](?=\s|$)/)?.[0] || t).trim()
function formCardCopy(formType: string, headline: string, subtitle: string | null | undefined): { lines: string[]; support: string } {
  const preset = FORM_CARD_COPY[formType]
  const own = !preset || !preset.defaults.some(d => d.toLowerCase() === headline.trim().toLowerCase())
  const title = own ? headline : preset.headline
  // the agent's own line under the form's title (its first sentence), else a neutral one
  const support = own ? (subtitle?.trim() ? firstSentence(subtitle) : 'Just a few quick questions.') : preset.support
  return { lines: title.split(/\s+[-–—]\s+/).filter(Boolean).slice(0, 2), support }
}
// One line each: the size that fits the column (measured: Playfair black ~0.51em a letter, Manrope ~0.49em - with a little room).
const COL = 540
const fitTitle = (lines: string[]) => Math.max(28, Math.min(60, Math.floor(COL / (Math.max(...lines.map(l => l.length)) * 0.52))))
const fitSupport = (t: string) => Math.max(17, Math.min(23, Math.floor(COL / (t.length * 0.5))))
const singleLine = { whiteSpace: 'nowrap' as const, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, maxWidth: COL + 60 }

export function FormCard({ photo, name, brokerage, lines, support, kind, look }: {
  photo: string | null; name: string; brokerage: string | null; lines: string[]; support: string; kind: FormKind; look: HubLook
}) {
  const face = FORM_FACE[kind]
  const ink = look.dark ? '#F3ECDD' : '#16130e'
  const sub = look.dark ? 'rgba(243,236,221,0.72)' : mixHex(look.deep, '#16130e', 0.25)
  const cardBg = look.dark ? `linear-gradient(135deg, ${look.night[0]} 0%, ${look.night[1]} 55%, ${look.night[2]} 100%)` : `linear-gradient(135deg, ${look.wash[0]} 0%, ${look.wash[1]} 55%, ${look.wash[2]} 100%)`
  const outer = look.dark ? `radial-gradient(900px 520px at 85% 0%, ${mixHex(look.base, '#000000', 0.7)} 0%, #0d0d0f 60%, #070708 100%)` : `radial-gradient(900px 520px at 85% 0%, ${mixHex(look.base, '#1a150d', 0.6)} 0%, #16120c 58%, #0d0b08 100%)`
  const label = look.dark ? look.light : look.deep
  const btnInk = lum(mixHex(look.light, look.base, 0.5)) < 0.5 ? '#ffffff' : '#16130e'
  const titleSize = fitTitle(lines)
  return (
    <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%', fontFamily: 'Manrope', backgroundColor: '#0d0b08',
      backgroundImage: outer, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', position: 'relative', width: 1060, height: 500, borderRadius: 30, overflow: 'hidden',
        backgroundImage: cardBg, boxShadow: '0 40px 90px -30px rgba(0,0,0,0.85)', border: `2px solid ${look.light}` }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, display: 'flex', backgroundImage: `linear-gradient(90deg, ${look.deep}, ${look.base}, ${look.light}, ${look.base}, ${look.deep})` }} />
        <div style={{ position: 'absolute', top: 30, left: 30, right: 30, bottom: 30, display: 'flex', border: `1px solid ${look.base}66`, borderRadius: 20 }} />
        {/* the form's picture, big and quiet in the corner */}
        <div style={{ position: 'absolute', right: 46, top: 40, display: 'flex', opacity: look.dark ? 0.14 : 0.12 }}>
          <svg width={230} height={230} viewBox="0 0 24 24" fill="none" stroke={look.base} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round">
            {face.d.map((seg, i) => <path key={i} d={seg} />)}
          </svg>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 0 0 60px' }}>
          <div style={{ display: 'flex', position: 'relative' }}>
            <div style={{ display: 'flex', padding: 7, borderRadius: 34, backgroundImage: `linear-gradient(140deg, ${look.light}, ${look.base} 60%, ${look.deep})`, boxShadow: `0 24px 50px -20px ${look.deep}b3` }}>
              {photo
                ? <img src={photo} width={232} height={310} style={{ width: 232, height: 310, borderRadius: 28, objectFit: 'cover' }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 232, height: 310, borderRadius: 28, backgroundColor: look.dark ? '#000' : '#16130e', color: look.light, fontSize: 88, fontWeight: 900 }}>{initialsOf(name)}</div>}
            </div>
            {/* the same picture as a badge on the photo */}
            <div style={{ position: 'absolute', right: -22, bottom: -14, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 84, height: 84, borderRadius: 999,
              backgroundImage: `linear-gradient(140deg, ${look.light}, ${look.base} 60%, ${look.deep})`, border: `5px solid ${look.dark ? look.night[1] : '#ffffff'}`, boxShadow: '0 16px 30px -12px rgba(0,0,0,0.55)' }}>
              <Ico d={face.d} size={38} color={btnInk} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 46px 0 58px', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 16, fontWeight: 900, letterSpacing: 4, textTransform: 'uppercase', color: label }}>
            <div style={{ display: 'flex', width: 28, height: 2, backgroundColor: look.base }} />
            {face.eyebrow}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
            {lines.map((l, i) => (
              <div key={i} style={{ display: 'flex', ...singleLine, fontFamily: 'Playfair', fontWeight: 900, fontSize: titleSize, lineHeight: 1.1, letterSpacing: -1, color: i === 0 ? ink : label }}>{l}</div>
            ))}
          </div>
          <div style={{ display: 'flex', ...singleLine, fontSize: fitSupport(support), lineHeight: 1.3, fontWeight: 600, color: sub, marginTop: 14 }}>{support}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 54, padding: '0 24px', borderRadius: 999, fontSize: 19, fontWeight: 900, flexShrink: 0,
              backgroundImage: `linear-gradient(135deg, ${look.light}, ${look.base})`, color: btnInk, boxShadow: `0 12px 26px -14px ${look.deep}` }}>
              {face.button}
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={btnInk} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
            </div>
            <div style={{ display: 'flex', fontSize: 15, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: sub }}>About 25 seconds</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 26, fontSize: 19, fontWeight: 800, color: ink }}>
            {name}{brokerage ? <div style={{ display: 'flex', color: sub, fontWeight: 700 }}>·  {brokerage}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Local design review only (route passes it outside production): 'luxe-silver-dark', 'classic-#1f3a5f-light'. */
function lookOverride(spec: string | null | undefined): any | null {
  const [theme, pick, mode] = String(spec || '').split('-')
  if (theme === 'luxe') return { hubTheme: 'luxe', hubLuxeMetal: pick, visitorDarkMode: mode === 'dark' }
  if (theme === 'classic') return { hubTheme: 'classic', hubAccent: pick, visitorDarkMode: mode === 'dark' }
  return null
}

export async function renderFormCard(agentSlug: string, formSlug: string, fonts: Fonts, previewLook?: string | null): Promise<ImageResponse> {
  try {
    // Fresh within a minute of an edit to the form or the hub's look.
    const [data, hub] = await Promise.all([
      ogFetch<any>(`/agent-hub/forms/public/${encodeURIComponent(agentSlug)}/${encodeURIComponent(formSlug)}`, 60),
      ogFetch<any>(`/agent-hub/public/${encodeURIComponent(agentSlug)}`, 60),
    ])
    const cfg = hub?.config || {}
    const agentPhoto = await imgToDataUri(data?.agentPhotoUrl || cfg.profilePhotoUrl || cfg.profile?.photoUrl)
    const agentName: string = data?.agentName || cfg.profile?.name || 'Your agent'
    // The form's own look (the Agent Hub's unless it has its own - resolved by the backend).
    const fl = data?.look
    const look = hubLook(lookOverride(previewLook) || (fl ? { hubTheme: fl.theme, hubAccent: fl.accent, hubLuxeMetal: fl.metal, visitorDarkMode: !!fl.dark } : { ...cfg, visitorDarkMode: !!cfg.visitorDarkMode || !!data?.darkMode }))
    const kind = FORM_KIND[String(data?.formType || '')] || (formSlug.includes('worth') || formSlug.includes('value') ? 'value' : 'start')
    const copy = formCardCopy(String(data?.formType || ''), String(data?.headline || data?.title || "Let's talk"), data?.subtitle)
    return IR(
      <FormCard photo={agentPhoto} name={agentName} brokerage={data?.agentBrokerage || cfg.profile?.brokerage || null}
        lines={copy.lines} support={copy.support} kind={kind} look={look} />,
      fonts,
    )
  } catch {
    return IR(<FormCard photo={null} name="Your agent" brokerage={null} lines={['Quick Form']} support="Just a few quick questions." kind="start" look={hubLook(null)} />, fonts)
  }
}

// --- Spotlight -----------------------------------------------------------------------------
// The listing's own cinematic card: the header photo full-bleed, a status pill, the street in big
// serif, the price in gold, the key facts, a strip of three more photos and the agent presenting it.

const photoUrl = (p: any): string | null => (typeof p === 'string' ? p : p?.url || p?.src || null)

function statusOf(raw: any, dom: any): string {
  const st = String(raw || '').toUpperCase()
  if (st.includes('CLOSED') || st === 'SOLD') return 'Sold'
  if (st.includes('CONTRACT') || st.includes('PENDING')) return 'Under Contract'
  if (st.includes('COMING')) return 'Coming Soon'
  const d = num(dom)
  return d != null && d <= 7 ? 'Just Listed' : 'For Sale'
}

export function SpotlightCard({
  hero, strip, status, street, place, price, facts, agentName, agentBrokerage, agentPhoto,
}: {
  hero: string | null
  strip: (string | null)[]
  status: string
  street: string
  place: string
  price: string
  facts: { v: string; l: string }[]
  agentName: string
  agentBrokerage: string | null
  agentPhoto: string | null
}) {
  const thumbs = strip.filter(Boolean).slice(0, 3) as string[]
  return (
    <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%', fontFamily: 'Manrope', color: '#fff', backgroundColor: '#0B0B0B', overflow: 'hidden' }}>
      {hero ? <img src={hero} style={{ position: 'absolute', top: 0, right: 0, width: 1392, height: 731, objectFit: 'cover' }} /> : null}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex',
        backgroundImage: 'linear-gradient(90deg, rgba(8,7,5,0.94) 0%, rgba(8,7,5,0.78) 36%, rgba(8,7,5,0.15) 66%, rgba(8,7,5,0.35) 100%), linear-gradient(0deg, rgba(8,7,5,0.85) 0%, rgba(8,7,5,0) 45%)' }} />
      {/* thin gold frame */}
      <div style={{ position: 'absolute', top: 22, left: 22, right: 22, bottom: 22, display: 'flex', border: '1px solid rgba(232,201,122,0.35)', borderRadius: 4 }} />

      <div style={{ position: 'absolute', top: 0, left: 0, width: 760, height: '100%', display: 'flex', flexDirection: 'column', padding: '62px 0 58px 66px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 16px', borderRadius: 999, backgroundColor: C.gold, color: '#111827', fontSize: 17, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase' }}>
            <div style={{ display: 'flex', width: 8, height: 8, borderRadius: 999, backgroundColor: '#111827' }} />
            {status}
          </div>
          {place ? <div style={{ display: 'flex', fontSize: 18, fontWeight: 900, letterSpacing: 4, textTransform: 'uppercase', color: C.goldLight }}>{place}</div> : null}
        </div>

        <div style={{ display: 'flex', fontFamily: 'Playfair', fontWeight: 900, fontSize: street.length > 22 ? 62 : 76, lineHeight: 1.02, letterSpacing: -1.5, marginTop: 'auto', maxWidth: 700 }}>{street}</div>
        {price ? <div style={{ display: 'flex', fontSize: 50, fontWeight: 900, color: C.goldLight, marginTop: 14, letterSpacing: -0.5 }}>{price}</div> : null}

        {facts.length ? (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 22 }}>
            {facts.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                {i > 0 ? <div style={{ display: 'flex', width: 1, height: 40, backgroundColor: 'rgba(232,201,122,0.45)', margin: '0 22px' }} /> : null}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', fontSize: 28, fontWeight: 900, color: '#fff' }}>{f.v}</div>
                  <div style={{ display: 'flex', fontSize: 13, fontWeight: 900, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{f.l}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 30 }}>
          {agentPhoto
            ? <img src={agentPhoto} width={56} height={56} style={{ width: 56, height: 56, borderRadius: 999, objectFit: 'cover', border: `2px solid ${C.goldLight}` }} />
            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 999, border: `2px solid ${C.goldLight}`, color: C.goldLight, fontSize: 21, fontWeight: 900 }}>{initialsOf(agentName)}</div>}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 13, fontWeight: 900, letterSpacing: 2.5, textTransform: 'uppercase', color: C.goldLight }}>Presented by</div>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 900, color: '#fff', marginTop: 2 }}>{agentBrokerage ? `${agentName}  ·  ${agentBrokerage}` : agentName}</div>
          </div>
        </div>
      </div>

      {/* three more photos */}
      {thumbs.length ? (
        <div style={{ position: 'absolute', right: 58, top: 58, bottom: 58, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
          {thumbs.map((t, i) => (
            <div key={i} style={{ display: 'flex', borderRadius: 18, border: '3px solid rgba(255,255,255,0.9)', boxShadow: '0 18px 36px -16px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
              <MlsSafePhoto src={t} w={232} h={148} radius={14} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export async function renderSpotlightCard(host: string, path: string, fonts: Fonts): Promise<ImageResponse> {
  try {
    const data = await ogFetch<any>(
      `/public/property-sites/resolve?host=${encodeURIComponent(host)}&path=${encodeURIComponent(path)}`,
    )
    if (!data) throw new Error('unresolved')
    const prop = data.property || {}
    const content = data.content || {}
    const agent = (Array.isArray(data.agents) && data.agents[0]) || {}
    const photos: string[] = (Array.isArray(prop.photos) ? prop.photos : []).map(photoUrl).filter(Boolean) as string[]
    const heroUrl = content.hero_image || content.header?.photo || photos[0] || prop.photo_url || prop.img_src
    const stripUrls = photos.filter(u => u !== heroUrl).slice(0, 3)
    const [hero, agentPhoto, ...strip] = await Promise.all([
      imgToDataUri(heroUrl, 5000), imgToDataUri(agent.photo_url), ...stripUrls.map(u => imgToDataUri(u, 4500)),
    ])
    const beds = num(prop.beds ?? prop.bedrooms), baths = num(prop.baths ?? prop.bathrooms)
    const sqft = num(prop.sqft ?? prop.living_area), acres = num(prop.lot_size_acres)
    const facts = [
      beds != null ? { v: fmtN(beds), l: beds === 1 ? 'Bed' : 'Beds' } : null,
      baths != null ? { v: fmtN(baths), l: baths === 1 ? 'Bath' : 'Baths' } : null,
      sqft ? { v: Math.round(sqft).toLocaleString('en-US'), l: 'Sq Ft' } : null,
      acres && acres >= 0.5 ? { v: acres.toFixed(2).replace(/\.?0+$/, ''), l: 'Acres' } : null,
    ].filter(Boolean) as { v: string; l: string }[]
    const place = [titleCase(prop.city), prop.state].filter(Boolean).join(', ')
    return IR(
      <SpotlightCard
        hero={hero}
        strip={strip}
        status={statusOf(prop.status, prop.days_on_market)}
        street={titleCase(prop.address || prop.street_address) || 'A home worth seeing'}
        place={place}
        price={money(num(prop.price ?? prop.list_price))}
        facts={facts}
        agentName={agent.name || 'Your agent'}
        agentBrokerage={agent.brokerage || null}
        agentPhoto={agentPhoto}
      />,
      fonts,
    )
  } catch {
    return IR(<SpotlightCard hero={null} strip={[]} status="For Sale" street="A home worth seeing" place="" price="" facts={[]} agentName="Your agent" agentBrokerage={null} agentPhoto={null} />, fonts)
  }
}

export async function renderPropertyCard(agentId: string, listingKey: string, fonts: Fonts): Promise<ImageResponse> {
  try {
    const data = await ogFetch<any>(`/api/properties/agent/${encodeURIComponent(agentId)}/listing/${encodeURIComponent(listingKey)}`)
    const p = data?.property || {}
    const [photo, agentPhoto] = await Promise.all([
      imgToDataUri(p.ListPictureURL || p.img_src || p.image || (Array.isArray(p.photos) ? p.photos[0] : null), 5000),
      // agentPhotoUrl is what the page sends (agent_photo_url never existed - the card showed initials)
      imgToDataUri(data?.agentPhotoUrl || data?.agent_photo_url, 4500),
    ])
    const bits = [
      p.bedrooms || p.BedroomsTotal ? `${p.bedrooms || p.BedroomsTotal} bd` : null,
      p.bathrooms || p.BathroomsTotal ? `${p.bathrooms || p.BathroomsTotal} ba` : null,
      p.living_area || p.LivingArea ? `${Math.round(p.living_area || p.LivingArea).toLocaleString()} sqft` : null,
    ].filter(Boolean)
    // the label follows the home's real status ("COMING SOON-BRIGHT" -> Coming Soon); a lease
    // listing ("ResidentialLease" / "CommercialLease") is for rent, priced by the month
    const st = String(p.MlsStatus || p.StandardStatus || p.status || '').toUpperCase()
    const lease = /LEASE|RENT/i.test(`${p.MlsPropertyType || ''} ${p.PropertyType || ''} ${st}`)
    const price = money(p.price || p.ListPrice)
    const sub = [price ? (lease ? `${price}/mo` : price) : null, bits.join('  ·  ')].filter(Boolean).join('  ·  ') || 'Take a look inside'
    const eyebrow = st.includes('COMING') ? 'Coming Soon' : /PENDING|CONTRACT/.test(st) ? 'Under Contract' : /CLOSED|SOLD/.test(st) ? (lease ? 'Rented' : 'Sold') : lease ? 'For Rent' : 'For Sale'
    // the same look as the CMA and open house cards
    return IR(
      <HomePhotoCard photo={photo} street={titleCase(p.street_address || p.FullStreetAddress || p.address) || 'A home worth seeing'} place={titleCase(p.city || p.City)}
        eyebrow={eyebrow} sub={sub} accent={C.gold}
        agentName={data?.agentName || data?.agent_name || p.list_agent_full_name || 'Your agent'}
        agentBrokerage={data?.agentBrokerage || data?.agent_brokerage || null} agentPhoto={agentPhoto} />,
      fonts,
    )
  } catch {
    return IR(<PhotoCard photo={null} eyebrow="For Sale" headline="A home worth seeing" agentName="Your agent" />, fonts)
  }
}

// --- Agent Hub + IDX website -------------------------------------------------------------
// The agent as the brand (user, 10/17: "Agent Hub preview elevated", "IDX sites don't have a stunning
// preview"): one of their homes full-bleed behind, a big gold-ringed headshot, the name in serif,
// title / brokerage / market, and a row of real numbers from their pages.

export function AgentCard({
  bg, photo, name, eyebrow, credential, market, stats, site,
}: {
  bg: string | null
  photo: string | null
  name: string
  eyebrow: string
  credential: string | null
  market: string | null
  stats: { v: string; l: string }[]
  site: string | null
}) {
  return (
    <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%', fontFamily: 'Manrope', color: '#fff', backgroundColor: C.bgBot,
      backgroundImage: `radial-gradient(1100px 560px at 80% 10%, ${C.bgTop} 0%, ${C.bgMid} 52%, ${C.bgBot} 100%)`, overflow: 'hidden' }}>
      {bg ? <img src={bg} style={{ position: 'absolute', top: 0, right: 0, width: 760, height: 630, objectFit: 'cover' }} /> : null}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex',
        backgroundImage: 'linear-gradient(90deg, rgba(12,10,7,1) 0%, rgba(12,10,7,0.97) 40%, rgba(12,10,7,0.55) 62%, rgba(12,10,7,0.2) 100%), linear-gradient(0deg, rgba(12,10,7,0.75) 0%, rgba(12,10,7,0) 40%)' }} />
      <div style={{ position: 'absolute', top: 24, left: 24, right: 24, bottom: 24, display: 'flex', border: '1px solid rgba(232,201,122,0.3)', borderRadius: 6 }} />

      <div style={{ position: 'absolute', top: 0, left: 0, width: 820, height: '100%', display: 'flex', flexDirection: 'column', padding: '64px 0 60px 72px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
          <div style={{ display: 'flex', padding: 6, borderRadius: 999, backgroundImage: `linear-gradient(140deg, ${C.goldLight}, ${C.gold} 60%, #8B6A2B)`, boxShadow: '0 24px 60px -18px rgba(201,162,77,0.65)' }}>
            {photo
              ? <img src={photo} width={176} height={176} style={{ width: 176, height: 176, borderRadius: 999, objectFit: 'cover', border: '4px solid #120f0a' }} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 176, height: 176, borderRadius: 999, backgroundColor: '#120f0a', color: C.goldLight, fontSize: 64, fontWeight: 900 }}>{initialsOf(name)}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 520 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 17, fontWeight: 900, letterSpacing: 5, textTransform: 'uppercase', color: C.goldLight }}>
              <div style={{ display: 'flex', width: 30, height: 2, backgroundColor: C.gold }} />{eyebrow}
            </div>
            <div style={{ display: 'flex', fontFamily: 'Playfair', fontWeight: 900, fontSize: name.length > 18 ? 58 : 72, lineHeight: 1.0, letterSpacing: -1.2, marginTop: 12 }}>{name}</div>
            {credential ? <div style={{ display: 'flex', fontSize: 20, fontWeight: 900, letterSpacing: 2.5, textTransform: 'uppercase', color: C.gold, marginTop: 14 }}>{credential}</div> : null}
          </div>
        </div>
        {market ? <div style={{ display: 'flex', fontFamily: 'Playfair', fontSize: 34, fontWeight: 400, color: C.cream, marginTop: 34, maxWidth: 700 }}>{market}</div> : null}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto' }}>
          {stats.map((st, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 ? <div style={{ display: 'flex', width: 1, height: 44, backgroundColor: 'rgba(232,201,122,0.45)', margin: '0 26px' }} /> : null}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: 34, fontWeight: 900, color: '#fff' }}>{st.v}</div>
                <div style={{ display: 'flex', fontSize: 13, fontWeight: 900, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{st.l}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {site ? (
        <div style={{ position: 'absolute', right: 56, bottom: 50, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 999, backgroundColor: 'rgba(12,10,7,0.72)', border: '1px solid rgba(232,201,122,0.4)', fontSize: 18, fontWeight: 900, color: C.goldLight }}>
          {site}
        </div>
      ) : null}
    </div>
  )
}

const pickImg = (items: any[]): string | null => {
  for (const it of items || []) {
    const u = it?.image || it?.photo || it?.imageUrl || it?.image_url || it?.photo_url || (Array.isArray(it?.photos) ? photoUrl(it.photos[0]) : null)
    if (u) return u
  }
  return null
}

// The Agent Hub is the agent's link-in-bio, so its preview is a business card (user, 10/18): their
// photo, name, title, brokerage, market, phone, email and the socials their hub links to - no
// stats, web address, buttons or listing photo. Dressed in the hub's own look: the Luxe metal
// (gold / silver / bronze) or the Classic accent, light or dark - whatever the agent picked.
const ICON = {
  phone: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z'],
  mail: ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6'],
  pin: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  instagram: ['M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z', 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z', 'M17.5 6.5h.01'],
  facebook: ['M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z'],
  youtube: ['M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z', 'M9.75 15.02l5.75-3.27-5.75-3.27v6.54z'],
  linkedin: ['M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z', 'M2 9h4v12H2z', 'M4 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'],
  tiktok: ['M9 12a4 4 0 1 0 4 4V2a5 5 0 0 0 5 5'],
  globe: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
}
function Ico({ d, size = 22, color }: { d: string[]; size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {d.map((seg, i) => <path key={i} d={seg} />)}
    </svg>
  )
}
const fmtPhone = (v?: string | null) => {
  const d = String(v || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (v || '')
}

// The hub's palette. Luxe metals mirror HubLuxeTheme's --m-* variables; Classic derives light / deep
// tones from the agent's accent.
type HubLook = { base: string; light: string; deep: string; wash: [string, string, string]; night: [string, string, string]; dark: boolean }
const LUXE: Record<string, Omit<HubLook, 'dark'>> = {
  gold: { base: '#C9A24D', light: '#e8c97a', deep: '#8b6a2b', wash: ['#fffdf8', '#fbf3df', '#f6e7c4'], night: ['#07110e', '#0d1626', '#1d1810'] },
  silver: { base: '#A9AFB7', light: '#e3e7ec', deep: '#6b717a', wash: ['#ffffff', '#f1f3f5', '#e6e9ed'], night: ['#080b14', '#121428', '#1a1d22'] },
  bronze: { base: '#A9714B', light: '#dba47c', deep: '#6e4426', wash: ['#fffaf6', '#f7e8dc', '#f0dccb'], night: ['#071010', '#1a1020', '#20150e'] },
}
function mixHex(a: string, b: string, t: number) {
  const p = (h: string) => { const x = h.replace('#', ''); const n = parseInt(x.length === 3 ? x.split('').map(c => c + c).join('') : x, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b)
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0')
  return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`
}
function lum(hex: string) {
  const x = hex.replace('#', ''); const n = parseInt(x.length === 3 ? x.split('').map(c => c + c).join('') : x, 16)
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}
function hubLook(cfg: any): HubLook {
  const dark = !!cfg?.visitorDarkMode
  if (cfg?.hubTheme === 'luxe') return { ...(LUXE[cfg?.hubLuxeMetal] || LUXE.gold), dark }
  // Exactly the Classic accents the hub page accepts (anything else shows as Original there too).
  const accent = hubAccentOf(cfg?.hubAccent)
  // Navy / Charcoal / Black on a dark hub would vanish - lift them so lines and icons still show.
  const lifted = dark && lum(accent) < 0.35 ? mixHex(accent, '#ffffff', 0.55) : accent
  return {
    base: lifted, light: mixHex(lifted, '#ffffff', 0.4), deep: dark ? lifted : mixHex(accent, '#111111', 0.35),
    wash: ['#ffffff', mixHex(accent, '#ffffff', 0.93), mixHex(accent, '#ffffff', 0.84)],
    night: ['#0b0b0c', '#141416', mixHex(accent, '#0b0b0c', 0.85)], dark,
  }
}

export function BusinessCard({ photo, name, title, brokerage, market, phone, email, inside, look }: {
  photo: string | null; name: string; title: string | null; brokerage: string | null; market: string | null
  phone: string | null; email: string | null; inside: string[]; look: HubLook
}) {
  const ink = look.dark ? '#F3ECDD' : '#16130e'
  const sub = look.dark ? 'rgba(243,236,221,0.72)' : mixHex(look.deep, '#16130e', 0.25)
  const cardBg = look.dark ? `linear-gradient(135deg, ${look.night[0]} 0%, ${look.night[1]} 55%, ${look.night[2]} 100%)` : `linear-gradient(135deg, ${look.wash[0]} 0%, ${look.wash[1]} 55%, ${look.wash[2]} 100%)`
  const outer = look.dark ? `radial-gradient(900px 520px at 85% 0%, ${mixHex(look.base, '#000000', 0.7)} 0%, #0d0d0f 60%, #070708 100%)` : `radial-gradient(900px 520px at 85% 0%, ${mixHex(look.base, '#1a150d', 0.6)} 0%, #16120c 58%, #0d0b08 100%)`
  const label = look.dark ? look.light : look.deep
  // Dark text on a light button, white on a dark one (Navy / Charcoal / Black accents).
  const btnInk = lum(mixHex(look.light, look.base, 0.5)) < 0.5 ? '#ffffff' : '#16130e'
  return (
    <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%', fontFamily: 'Manrope', backgroundColor: '#0d0b08',
      backgroundImage: outer, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', position: 'relative', width: 1060, height: 500, borderRadius: 30, overflow: 'hidden',
        backgroundImage: cardBg, boxShadow: '0 40px 90px -30px rgba(0,0,0,0.85)', border: `2px solid ${look.light}` }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, display: 'flex', backgroundImage: `linear-gradient(90deg, ${look.deep}, ${look.base}, ${look.light}, ${look.base}, ${look.deep})` }} />
        <div style={{ position: 'absolute', top: 30, left: 30, right: 30, bottom: 30, display: 'flex', border: `1px solid ${look.base}66`, borderRadius: 20 }} />
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 0 0 66px' }}>
          <div style={{ display: 'flex', padding: 7, borderRadius: 34, backgroundImage: `linear-gradient(140deg, ${look.light}, ${look.base} 60%, ${look.deep})`, boxShadow: `0 24px 50px -20px ${look.deep}b3` }}>
            {photo
              ? <img src={photo} width={300} height={340} style={{ width: 300, height: 340, borderRadius: 28, objectFit: 'cover' }} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 300, height: 340, borderRadius: 28, backgroundColor: look.dark ? '#000' : '#16130e', color: look.light, fontSize: 96, fontWeight: 900 }}>{initialsOf(name)}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 70px 0 56px', flex: 1, minWidth: 0 }}>
          {(title || brokerage) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 16, fontWeight: 900, letterSpacing: 4, textTransform: 'uppercase', color: label }}>
              <div style={{ display: 'flex', width: 28, height: 2, backgroundColor: look.base }} />
              {[title, brokerage].filter(Boolean).join('  ·  ')}
            </div>
          ) : null}
          <div style={{ display: 'flex', fontFamily: 'Playfair', fontWeight: 900, fontSize: name.length > 20 ? 54 : name.length > 15 ? 62 : 70, lineHeight: 1.02, letterSpacing: -1, color: ink, marginTop: 12 }}>{name}</div>
          {market ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, fontSize: 24, fontWeight: 700, color: sub }}>
              <Ico d={ICON.pin} size={22} color={look.base} /> {market}
            </div>
          ) : null}
          <div style={{ display: 'flex', width: 120, height: 2, backgroundColor: look.base, marginTop: 26, marginBottom: 22 }} />
          {phone ? <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 26, fontWeight: 800, color: ink }}><Ico d={ICON.phone} color={look.base} /> {fmtPhone(phone)}</div> : null}
          {email ? <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: email.length > 30 ? 20 : 24, fontWeight: 700, color: ink, marginTop: 10 }}><Ico d={ICON.mail} color={look.base} /> {email}</div> : null}
          {/* What the link opens (user, 10/18): not "my links" - everything on their page, listed from
              what this hub actually has (listings, sales, videos, articles, reviews). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 50, padding: '0 22px', borderRadius: 999, fontSize: 18, fontWeight: 900, flexShrink: 0,
              backgroundImage: `linear-gradient(135deg, ${look.light}, ${look.base})`, color: btnInk, boxShadow: `0 12px 26px -14px ${look.deep}` }}>
              Visit my page
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={btnInk} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
            </div>
            {inside.length ? <div style={{ display: 'flex', fontSize: 15, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: sub }}>{inside.join('  ·  ')}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export async function renderHubCard(agentSlug: string, fonts: Fonts): Promise<ImageResponse> {
  try {
    // Fresh within a minute of the agent saving their hub or Settings (name, photo, brokerage, look).
    const [data, blogs] = await Promise.all([
      ogFetch<any>(`/agent-hub/public/${encodeURIComponent(agentSlug)}`, 0),
      ogFetch<any[]>(`/studio/blogs/public/${encodeURIComponent(agentSlug)}`, 300),
    ])
    const cfg = data?.config || {}
    const profile = cfg.profile || {}
    const contact = cfg.contact || {}
    const photo = await imgToDataUri(cfg.profilePhotoUrl || profile.photoUrl || profile.photo_url)
    const title = profile.title ? String(profile.title).replace(/[®�]/g, '').trim() : ''
    // What's on their page (user, 10/18): Sales first (never "Listings"), then Videos - or Info when
    // there are none - then Blogs, or Home Tours when there are no blogs. Only sections the hub
    // actually shows (switched on, with something in them).
    const sections: { id: string; visible?: boolean }[] = Array.isArray(cfg.layoutSections) ? cfg.layoutSections : []
    const shown = (id: string) => {
      const sec = sections.find(x => x?.id === id)
      if (sec) return sec.visible !== false
      return Array.isArray(cfg.visibleSectionIds) ? cfg.visibleSectionIds.includes(id) : true
    }
    const items = (k: string) => (Array.isArray(cfg[k]) ? cfg[k] : []) as any[]
    const hasSales = shown('sales') && items('recentSales').some(x => x && x.visible !== false)
    const hasVideos = shown('videos') && items('videoLinks').some(x => String(x?.link || '').trim())
    const hasBlogs = shown('blogs') && ((Array.isArray(blogs) && blogs.length > 0) || items('blogCards').some(x => String(x?.link || x?.title || '').trim()))
    const hasTours = shown('tours') && (!!String(cfg.houseTourUrl || '').trim() || items('houseTourLinks').some(x => String(x?.link || '').trim()))
    const inside = [hasSales && 'Sales', hasVideos ? 'Videos' : 'Info', hasBlogs ? 'Blogs' : hasTours ? 'Home Tours' : null].filter(Boolean) as string[]
    return IR(
      <BusinessCard photo={photo} name={profile.name || 'Real Estate Agent'}
        title={title ? (/^realtor$/i.test(title) ? 'Realtor®' : title) : null}
        brokerage={profile.brokerage ? String(profile.brokerage) : null} market={profile.market ? String(profile.market) : null}
        phone={contact.call || contact.text || null} email={contact.email || null} inside={inside} look={hubLook(cfg)} />,
      fonts,
    )
  } catch {
    return IR(<BusinessCard photo={null} name="Real Estate Agent" title={null} brokerage={null} market={null} phone={null} email={null} inside={[]} look={hubLook(null)} />, fonts)
  }
}

/** The agent's IDX website (home page and any page without its own image). */
export async function renderSiteCard(siteId: string, host: string, fonts: Fonts): Promise<ImageResponse> {
  try {
    const [profile, featured, areas] = await Promise.all([
      ogFetch<any>(`/public/sites/${encodeURIComponent(siteId)}/profile`),
      ogFetch<any>(`/public/sites/${encodeURIComponent(siteId)}/properties?limit=12`),
      ogFetch<any>(`/public/sites/${encodeURIComponent(siteId)}/areas`),
    ])
    const homes: any[] = Array.isArray(featured) ? featured : Array.isArray(featured?.items) ? featured.items : []
    const towns: any[] = Array.isArray(areas) ? areas : []
    const name: string = profile?.name || 'Real Estate Agent'
    const [photo, bg] = await Promise.all([
      imgToDataUri(profile?.photo_url),
      imgToDataUri(pickImg(homes) || pickImg(towns), 5000),
    ])
    const stats = [
      homes.length ? { v: String(homes.length), l: homes.length === 1 ? 'Featured home' : 'Featured homes' } : null,
      towns.length ? { v: String(towns.length), l: towns.length === 1 ? 'Neighborhood guide' : 'Neighborhood guides' } : null,
    ].filter(Boolean) as { v: string; l: string }[]
    const credential = [profile?.title ? String(profile.title).replace('®', '') : null, profile?.brokerage].filter(Boolean).join(' · ') || null
    return IR(
      <AgentCard bg={bg} photo={photo} name={name} eyebrow="Homes for sale" credential={credential}
        market={profile?.market ? String(profile.market) : towns.length ? towns.slice(0, 3).map(t => t.name).join(' · ') : null}
        stats={stats} site={host || null} />,
      fonts,
    )
  } catch {
    return IR(<AgentCard bg={null} photo={null} name="Real Estate Agent" eyebrow="Homes for sale" credential={null} market={null} stats={[]} site={host || null} />, fonts)
  }
}

/** A home on the agent's IDX website - the same card as a Showcase property link (user, 10/17:
 *  "the IDX one is very bland"). `own` = one of the agent's featured homes, else a search result. */
export async function renderIdxListingCard(siteId: string, listingKey: string, own: boolean, fonts: Fonts): Promise<ImageResponse> {
  try {
    const base = `/public/sites/${encodeURIComponent(siteId)}`
    const [p, profile] = await Promise.all([
      ogFetch<any>(`${base}/${own ? 'properties' : 'search/properties'}/${encodeURIComponent(listingKey)}`),
      ogFetch<any>(`${base}/profile`),
    ])
    if (!p) throw new Error('no listing')
    const address = [p.address || p.street_address, p.city].filter(Boolean).map(titleCase).join(', ') || 'A home worth seeing'
    const [photo, agentPhoto] = await Promise.all([
      imgToDataUri((Array.isArray(p.photos) && photoUrl(p.photos[0])) || p.photo, 5000),
      imgToDataUri(profile?.photo_url),
    ])
    const beds = num(p.beds ?? p.bedrooms), baths = num(p.baths ?? p.bathrooms), sqft = num(p.sqft ?? p.living_area)
    const bits = [beds != null ? `${fmtN(beds)} bd` : null, baths != null ? `${fmtN(baths)} ba` : null, sqft ? `${Math.round(sqft).toLocaleString('en-US')} sqft` : null].filter(Boolean)
    const sub = [money(num(p.price)), bits.join('  ·  ')].filter(Boolean).join('   ·   ') || undefined
    const st = String(p.status || '').toUpperCase()
    const eyebrow = st.includes('CLOSED') || st === 'SOLD' ? 'Sold' : st.includes('PENDING') || st.includes('CONTRACT') ? 'Under Contract' : st.includes('COMING') ? 'Coming Soon' : 'For Sale'
    return IR(<PhotoCard photo={photo} eyebrow={eyebrow} headline={address} sub={sub} agentName={profile?.name || 'Your agent'} agentBrokerage={profile?.brokerage || null} agentPhoto={agentPhoto} />, fonts)
  } catch {
    return IR(<PhotoCard photo={null} eyebrow="For Sale" headline="A home worth seeing" agentName="Your agent" />, fonts)
  }
}
