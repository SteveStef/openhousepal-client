/**
 * Card renderers — one per shareable resource. Each does fetch → normalize → ImageResponse,
 * with a branded fallback on any failure. Called BOTH from the app/<route>/opengraph-image.tsx
 * files AND from app/api/og/[kind] (which is what the custom-domain site renderer points its
 * og:image at, so an IDX agent's own-domain links get the same rich card).
 */
import { ImageResponse } from 'next/og'
import {
  OG_SIZE, ogFonts, ogFetch, imgToDataUri, firstName, money, C,
  Eyebrow, AgentChip, PhotoCard, IdentityCard,
} from './shared'
import { computeMatchScore } from '@/lib/matchScore'
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

/** "Street, City" when it fits on one card line, else just the street (trimmed with an ellipsis). */
function oneLine(street: string, city: string, max = 31) {
  const both = [street, city].filter(Boolean).join(', ')
  if (both.length <= max) return both
  return street.length <= max ? street : `${street.slice(0, max - 1).trim()}…`
}

export type OgHome = { photo: string | null; price: string; facts: string; street: string; city: string; match: number | null }

/** A listing photo with Bright's bottom-left watermark pushed out of frame (scaled from the top-right). */
export function MlsSafePhoto({ src, w, h, radius = 0 }: { src: string | null; w: number; h: number; radius?: number }) {
  return (
    <div style={{ display: 'flex', position: 'relative', width: w, height: h, overflow: 'hidden', borderRadius: radius, backgroundColor: '#E9E2D3' }}>
      {src ? <img src={src} style={{ position: 'absolute', top: 0, right: 0, width: Math.round(w * 1.16), height: Math.round(h * 1.16), objectFit: 'cover' }} /> : null}
    </div>
  )
}

function initialsOf(name: string) {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'A'
}

export function ShowcaseCard({
  count, forName, agentName, agentBrokerage, agentPhoto, homes,
}: {
  count: number
  forName: string
  agentName: string
  agentBrokerage: string | null
  agentPhoto: string | null
  homes: OgHome[]
}) {
  const shown = homes.slice(0, 3)
  const more = Math.max(0, count - shown.length)
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', position: 'relative', width: '100%', height: '100%', fontFamily: 'Manrope', color: '#111827',
      backgroundColor: '#FAF8F3', padding: '44px 54px 46px',
      backgroundImage: 'radial-gradient(700px 380px at 92% 0%, rgba(201,162,77,0.30) 0%, rgba(201,162,77,0) 70%), radial-gradient(620px 360px at 0% 100%, rgba(201,162,77,0.16) 0%, rgba(201,162,77,0) 70%)',
    }}>
      {/* who it's for + who made it */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 18, fontWeight: 900, letterSpacing: 5, textTransform: 'uppercase', color: '#8B7355' }}>
            <div style={{ display: 'flex', width: 34, height: 2, backgroundColor: C.gold }} />
            {forName ? 'Hand-picked homes' : 'Your personal Showcase'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 10, fontFamily: 'Playfair', fontWeight: 900, fontSize: 74, lineHeight: 1, letterSpacing: -1.5 }}>
            <span>{forName ? `${forName}’s` : 'Your'}</span>
            <span style={{ color: C.gold, marginLeft: 20 }}>Showcase</span>
          </div>
          <div style={{ display: 'flex', marginTop: 12, fontSize: 22, fontWeight: 400, color: '#6B7280' }}>
            {count ? `${count} ${count === 1 ? 'home' : 'homes'} · updated the moment new ones list` : 'Updated the moment new homes list'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 22px 12px 12px', borderRadius: 999, backgroundColor: '#FFFFFF', border: '1px solid rgba(201,162,77,0.35)', boxShadow: '0 10px 30px -14px rgba(17,24,39,0.25)' }}>
          {agentPhoto
            ? <img src={agentPhoto} width={58} height={58} style={{ width: 58, height: 58, borderRadius: 999, objectFit: 'cover', border: `2px solid ${C.gold}` }} />
            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 58, height: 58, borderRadius: 999, backgroundColor: '#111827', color: C.goldLight, fontSize: 22, fontWeight: 900 }}>{initialsOf(agentName)}</div>}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 13, fontWeight: 900, letterSpacing: 2.5, textTransform: 'uppercase', color: '#8B7355' }}>From your agent</div>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 900, color: '#111827', marginTop: 2 }}>{agentName}</div>
            {agentBrokerage ? <div style={{ display: 'flex', fontSize: 15, fontWeight: 400, color: '#6B7280', marginTop: 1 }}>{agentBrokerage}</div> : null}
          </div>
        </div>
      </div>

      {/* three of its homes, like the cards inside */}
      <div style={{ display: 'flex', gap: 22, marginTop: 'auto' }}>
        {shown.map((h, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', width: 345, borderRadius: 26, overflow: 'hidden', backgroundColor: '#FFFFFF',
            border: '1px solid rgba(17,24,39,0.06)', boxShadow: '0 22px 44px -22px rgba(17,24,39,0.45)',
          }}>
            <div style={{ display: 'flex', position: 'relative' }}>
              <MlsSafePhoto src={h.photo} w={345} h={196} />
              {h.match != null ? (
                <div style={{ display: 'flex', position: 'absolute', top: 14, left: 14, alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999, backgroundColor: 'rgba(17,24,39,0.88)', color: '#fff', fontSize: 17, fontWeight: 900 }}>
                  <div style={{ display: 'flex', width: 8, height: 8, borderRadius: 999, backgroundColor: C.goldLight }} />
                  {`${h.match}% Match`}
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', padding: '15px 20px 17px' }}>
              <div style={{ display: 'flex', fontSize: 30, fontWeight: 900, color: '#111827', letterSpacing: -0.5 }}>{h.price || 'Price on request'}</div>
              {h.facts ? <div style={{ display: 'flex', fontSize: 17, fontWeight: 900, color: '#A8803A', marginTop: 4 }}>{h.facts}</div> : null}
              <div style={{ display: 'flex', fontSize: 17, fontWeight: 400, color: '#6B7280', marginTop: 5 }}>{oneLine(h.street, h.city)}</div>
            </div>
          </div>
        ))}
      </div>
      {more > 0 && shown.length ? (
        <div style={{ display: 'flex', position: 'absolute', right: 56, bottom: 14, fontSize: 14, fontWeight: 900, letterSpacing: 2.5, textTransform: 'uppercase', color: '#8B7355' }}>
          {`+ ${more} more inside`}
        </div>
      ) : null}
    </div>
  )
}

export async function renderShowcaseCard(shareToken: string, fonts: Fonts): Promise<ImageResponse> {
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
    // The same "X% Match" the client sees on their cards - best three first.
    const subject = data?.preferences?.show_match_score !== false ? data?.originalProperty : null
    const scored = pool.map(p => ({ p, match: subject ? computeMatchScore(p, subject, pool) : null }))
    if (subject) scored.sort((a, b) => (b.match ?? 0) - (a.match ?? 0))
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
      />,
      fonts,
    )
  } catch {
    return IR(<ShowcaseCard count={0} forName="" agentName="Your agent" agentBrokerage={null} agentPhoto={null} homes={[]} />, fonts)
  }
}

export async function renderCmaCard(slug: string, fonts: Fonts): Promise<ImageResponse> {
  try {
    const data = await ogFetch<any>(`/api/cma/public/${encodeURIComponent(slug)}`)
    const subj = data?.subject || {}
    const agent = data?.agent || {}
    const address = [subj.street_address, subj.city].filter(Boolean).map(titleCase).join(', ') || 'Your home'
    const [photo, agentPhoto] = await Promise.all([
      imgToDataUri(subj.photo_url || (Array.isArray(subj.photos) ? subj.photos[0] : null)),
      imgToDataUri(agent.photo_url || agent.photoUrl),
    ])
    const client = firstName(data?.client_name)
    return IR(
      <PhotoCard
        photo={photo}
        eyebrow="Market Analysis"
        headline={address}
        sub={client ? `What it's worth — prepared for ${client}` : "What it's worth — prepared for you"}
        agentName={agent.name || agent.full_name || 'Your agent'}
        agentBrokerage={agent.brokerage || null}
        agentPhoto={agentPhoto}
      />,
      fonts,
    )
  } catch {
    return IR(<PhotoCard photo={null} eyebrow="Market Analysis" headline="What your home is worth" sub="A market analysis prepared for you" agentName="Your agent" />, fonts)
  }
}

export async function renderOpenHouseCard(eventId: string, fonts: Fonts): Promise<ImageResponse> {
  try {
    const data = await ogFetch<any>(`/open-house/property/${encodeURIComponent(eventId)}`)
    const p = data?.property || {}
    const address = [p.address, p.city].filter(Boolean).map(titleCase).join(', ') || 'Open House'
    const bits = [
      p.beds ? `${p.beds % 1 === 0 ? p.beds : p.beds.toFixed(1)} bd` : null,
      p.baths ? `${p.baths % 1 === 0 ? p.baths : p.baths.toFixed(1)} ba` : null,
      p.squareFeet ? `${Math.round(p.squareFeet).toLocaleString()} sqft` : null,
    ].filter(Boolean)
    const sub = [money(p.price), bits.join('  ·  ')].filter(Boolean).join('   ·   ') || 'Sign in and take a look around'
    const [photo, agentPhoto] = await Promise.all([
      imgToDataUri(p.imageSrc || (Array.isArray(p.photos) ? p.photos[0] : null)),
      imgToDataUri(p.agentPhotoUrl),
    ])
    return IR(
      <PhotoCard photo={photo} eyebrow="Open House" headline={address} sub={sub} agentName={p.agentName || 'Your host'} agentBrokerage={p.agentBrokerage || null} agentPhoto={agentPhoto} />,
      fonts,
    )
  } catch {
    return IR(<PhotoCard photo={null} eyebrow="Open House" headline="You're invited to an open house" sub="Sign in and take a look around" agentName="Your host" />, fonts)
  }
}

export async function renderBlogCard(agentSlug: string, blogSlug: string, fonts: Fonts): Promise<ImageResponse> {
  try {
    const data = await ogFetch<any>(`/studio/blogs/public/${encodeURIComponent(agentSlug)}/${encodeURIComponent(blogSlug)}?track=false`)
    const [photo, agentPhoto] = await Promise.all([
      imgToDataUri(data?.socialImageUrl || data?.coverImageUrl),
      imgToDataUri(data?.agentPhotoUrl),
    ])
    return IR(
      <PhotoCard
        photo={photo}
        eyebrow={data?.category ? String(data.category) : 'Market Notes'}
        headline={data?.title || 'Market Notes'}
        sub={data?.subtitle ? String(data.subtitle).slice(0, 110) : undefined}
        agentName={data?.agentName || 'Your agent'}
        agentBrokerage={data?.agentBrokerage || null}
        agentPhoto={agentPhoto}
      />,
      fonts,
    )
  } catch {
    return IR(<PhotoCard photo={null} eyebrow="Market Notes" headline="From the blog" agentName="Your agent" />, fonts)
  }
}

const FORM_EYEBROW: Record<string, string> = {
  buying: "Let's Find It", selling: "Let's Talk", home_value: 'Home Value', 'home-value': 'Home Value',
}

export async function renderFormCard(agentSlug: string, formSlug: string, fonts: Fonts): Promise<ImageResponse> {
  try {
    const data = await ogFetch<any>(`/agent-hub/forms/public/${encodeURIComponent(agentSlug)}/${encodeURIComponent(formSlug)}`)
    const agentPhoto = await imgToDataUri(data?.agentPhotoUrl)
    const agentName: string = data?.agentName || 'Your agent'
    return IR(
      <IdentityCard
        photo={agentPhoto}
        name={agentName}
        eyebrow={FORM_EYEBROW[String(data?.formType || formSlug)] || 'Get In Touch'}
        headline={data?.headline || data?.title || "Let's talk"}
        credential={data?.agentBrokerage ? `${agentName} · ${data.agentBrokerage}` : agentName}
        support={data?.subtitle ? String(data.subtitle).slice(0, 120) : 'A few quick questions and I follow up personally.'}
      />,
      fonts,
    )
  } catch {
    return IR(<IdentityCard photo={null} name="Your agent" eyebrow="Get In Touch" headline="Let's talk" credential={null} support="A few quick questions and I follow up personally." />, fonts)
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
    const address = [p.street_address || p.FullStreetAddress || p.address, p.city || p.City].filter(Boolean).map(titleCase).join(', ') || 'A home worth seeing'
    const photo = await imgToDataUri(p.ListPictureURL || p.img_src || p.image || (Array.isArray(p.photos) ? p.photos[0] : null))
    const bits = [
      p.bedrooms || p.BedroomsTotal ? `${p.bedrooms || p.BedroomsTotal} bd` : null,
      p.bathrooms || p.BathroomsTotal ? `${p.bathrooms || p.BathroomsTotal} ba` : null,
      p.living_area || p.LivingArea ? `${Math.round(p.living_area || p.LivingArea).toLocaleString()} sqft` : null,
    ].filter(Boolean)
    const sub = [money(p.price || p.ListPrice), bits.join('  ·  ')].filter(Boolean).join('   ·   ') || undefined
    return IR(
      <PhotoCard
        photo={photo}
        eyebrow="For Sale"
        headline={address}
        sub={sub}
        agentName={data?.agentName || data?.agent_name || p.list_agent_full_name || 'Your agent'}
        agentBrokerage={p.ListOfficeName || p.list_office_name || null}
        agentPhoto={null}
      />,
      fonts,
    )
  } catch {
    return IR(<PhotoCard photo={null} eyebrow="For Sale" headline="A home worth seeing" agentName="Your agent" />, fonts)
  }
}

export async function renderHubCard(agentSlug: string, fonts: Fonts): Promise<ImageResponse> {
  try {
    const data = await ogFetch<any>(`/agent-hub/public/${encodeURIComponent(agentSlug)}`)
    const profile = data?.config?.profile || {}
    const name: string = profile.name || 'Real Estate Agent'
    const photo = await imgToDataUri(data?.config?.profilePhotoUrl || profile.photoUrl || profile.photo_url)
    return IR(
      <IdentityCard
        photo={photo}
        name={name}
        eyebrow={profile.title ? String(profile.title) : 'Real Estate'}
        headline={name}
        credential={profile.brokerage ? String(profile.brokerage) : null}
        support={profile.market ? String(profile.market) : null}
      />,
      fonts,
    )
  } catch {
    return IR(<IdentityCard photo={null} name="Real Estate Agent" eyebrow="Real Estate" headline="Let's work together" credential={null} support={null} />, fonts)
  }
}
