/**
 * Shared building blocks for the dynamic social-share (Open Graph) images that every public
 * agent link gets — `app/<route>/opengraph-image.tsx` files call into this.
 *
 * These render through `next/og` (Satori), which only understands flexbox: every element with
 * more than one child MUST set `display: 'flex'`. No CSS grid, no `gap` on non-flex, fonts must
 * be handed in as raw bytes. Keep that in mind when editing the card layouts.
 */
import fs from 'node:fs'
import path from 'node:path'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

// Brand palette (matches the marketing site + PDFs)
export const C = {
  bgTop: '#37290f',
  bgMid: '#1a150d',
  bgBot: '#100d09',
  gold: '#C9A24D',
  goldLight: '#EAD09A',
  cream: '#F3ECDD',
  sub: '#E4DBC7',
  chipBg: 'rgba(228,200,136,0.14)',
  chipBorder: 'rgba(228,200,136,0.34)',
  gridLine: '#E4C888',
}

// Fonts are read off disk once per server process. public/fonts ships TTFs specifically so
// Satori can use them (it can't take WOFF2).
let _fonts: { name: string; data: Buffer; weight: 400 | 700 | 900; style: 'normal' }[] | null = null
export function ogFonts() {
  if (_fonts) return _fonts
  const dir = path.join(process.cwd(), 'public', 'fonts')
  const read = (f: string) => fs.readFileSync(path.join(dir, f))
  _fonts = [
    { name: 'Manrope', data: read('montserrat-v31-latin-regular.ttf'), weight: 400, style: 'normal' },
    { name: 'Manrope', data: read('montserrat-v31-latin-900.ttf'), weight: 900, style: 'normal' },
    { name: 'Playfair', data: read('playfair-display-v40-latin-regular.ttf'), weight: 400, style: 'normal' },
    { name: 'Playfair', data: read('playfair-display-v40-latin-900.ttf'), weight: 900, style: 'normal' },
  ]
  return _fonts
}

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8081'

/** Server-side fetch of a public backend endpoint. Never throws — returns null on any problem so
 *  the caller can fall back to a text-only card rather than 500 the whole unfurl. */
export async function ogFetch<T = any>(pathname: string, revalidate?: number): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${pathname}`, {
      headers: { accept: 'application/json' },
      // A shared preview image doesn't need to be second-fresh; 10 min cache keeps repeated
      // unfurls (and crawler retries) off the backend. Showcases: 2 min, so a link copied right
      // after new homes land shows them.
      next: { revalidate: revalidate ?? (pathname.startsWith('/collections/shared/') ? 120 : 600) },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** Media URLs from the API can be absolute (Bright photos, CloudFront headshots) or backend-
 *  relative (`/uploads/...`). Satori needs an absolute URL it can fetch. */
export function absMedia(url?: string | null): string | null {
  if (!url) return null
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
}

/** Fetch a remote image ourselves and hand Satori a `data:` URI instead of a URL. Satori's own
 *  image loading is unreliable (hangs on a slow host, chokes on some redirects/content-types) and
 *  a failure there tears down the whole response. This never throws — returns null on any problem
 *  so the card can just omit that tile. */
export async function imgToDataUri(url?: string | null, timeoutMs = 3500): Promise<string | null> {
  const abs = absMedia(url)
  if (!abs) return null
  if (abs.startsWith('data:')) return abs
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(abs, { signal: ctrl.signal, next: { revalidate: 86400 } })
    clearTimeout(t)
    if (!res.ok) return null
    const type = res.headers.get('content-type') || 'image/jpeg'
    if (!type.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > 6_000_000) return null
    return `data:${type};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/** Pixel size of a JPEG / PNG / WebP data URI (read from its header), or null. */
export function imgSize(dataUri: string | null): { w: number; h: number } | null {
  if (!dataUri?.startsWith('data:')) return null
  try {
    const b = Buffer.from(dataUri.slice(dataUri.indexOf(',') + 1, dataUri.indexOf(',') + 1 + 140000), 'base64')
    if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
    if (b.toString('ascii', 8, 12) === 'WEBP') {
      const kind = b.toString('ascii', 12, 16)
      if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) }
      if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff }
      if (kind === 'VP8L') { const n = b.readUInt32LE(21); return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 } }
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2
      while (i < b.length - 9) {
        if (b[i] !== 0xff) { i++; continue }
        const m = b[i + 1]
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) }
        i += 2 + b.readUInt16BE(i + 2)
      }
    }
  } catch { /* unreadable - caller falls back */ }
  return null
}

export async function imgsToDataUris(urls: (string | null | undefined)[], timeoutMs = 3500): Promise<(string | null)[]> {
  return Promise.all(urls.map(u => imgToDataUri(u, timeoutMs)))
}

/** Last-resort card when data can't be loaded — still a valid branded PNG, never a broken unfurl. */
export function fallbackCard(title: string, sub?: string) {
  return (
    <Shell>
      <div style={{ display: 'flex' }}><Mark size={64} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto' }}>
        <div style={{ display: 'flex', fontFamily: 'Playfair', fontWeight: 900, fontSize: 68, lineHeight: 1.05, color: '#fff' }}>{title}</div>
        {sub ? <div style={{ display: 'flex', fontSize: 28, fontWeight: 400, color: C.sub, marginTop: 18 }}>{sub}</div> : null}
      </div>
    </Shell>
  )
}

/** ogFonts() but never throws — falls back to Satori's default font if the files can't be read. */
export function ogFontsSafe() {
  try {
    return ogFonts()
  } catch {
    return [] as ReturnType<typeof ogFonts>
  }
}

export function firstName(full?: string | null): string {
  return (full || '').trim().split(/\s+/)[0] || ''
}

export function money(n?: number | null): string {
  if (!n || !isFinite(n)) return ''
  return `$${Math.round(n).toLocaleString('en-US')}`
}

// ---------------------------------------------------------------------------
// Reusable pieces
// ---------------------------------------------------------------------------

/** The OpenHousePal house (the H of the logo: roof, round window, open gold door), as SVG-in-JSX. */
export function Mark({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 3 40 44" fill="none">
      <path d="M3.5 22.5 L20 8 L36.5 22.5" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 20 V43 H14.5 M25.5 43 H33 V20" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={20} cy={18.6} r={2.5} stroke="#FFFFFF" strokeWidth={2.2} />
      <path d="M25.5 46 V29.5 L19.5 31.8 V46 Z" fill={C.goldLight} />
    </svg>
  )
}

/** Agent identity chip — photo (or initials) + name + brokerage. This is what makes the card
 *  the AGENT's, not OpenHousePal's. */
export function AgentChip({
  name,
  brokerage,
  photo,
  dark = false,
}: {
  name: string
  brokerage?: string | null
  photo?: string | null
  dark?: boolean
}) {
  const initials = name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      {photo ? (
        <img src={photo} width={74} height={74} style={{ width: 74, height: 74, borderRadius: 999, objectFit: 'cover', border: `3px solid ${C.goldLight}` }} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 74, height: 74, borderRadius: 999, border: `3px solid ${C.goldLight}`, background: 'rgba(228,200,136,0.15)', color: C.goldLight, fontSize: 28, fontWeight: 900 }}>
          {initials}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 27, fontWeight: 900, color: dark ? '#111827' : '#fff', lineHeight: 1.1 }}>{name}</div>
        {brokerage ? (
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', color: C.gold, marginTop: 4 }}>{brokerage}</div>
        ) : null}
      </div>
    </div>
  )
}

/** The dark radial-glow page every text-forward card sits on. */
export function Shell({ children, pad = 74 }: { children: React.ReactNode; pad?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: pad,
        fontFamily: 'Manrope',
        color: '#fff',
        backgroundColor: C.bgBot,
        backgroundImage: `radial-gradient(1100px 560px at 76% 20%, ${C.bgTop} 0%, ${C.bgMid} 52%, ${C.bgBot} 100%)`,
      }}
    >
      {children}
    </div>
  )
}

/** Small uppercase label (the "eyebrow" over a headline). */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', fontSize: 24, fontWeight: 900, letterSpacing: 8, textTransform: 'uppercase', color: C.goldLight }}>
      {children}
    </div>
  )
}

/**
 * Identity card: big agent photo on the left, headline + credential + one supporting line on the
 * right, on the dark brand ground. Used for Agent Hub and Form links (no property involved).
 * `photo` must already be a data: URI (or null → initials block).
 */
export function IdentityCard({
  photo, name, eyebrow, headline, credential, support,
}: {
  photo: string | null
  name: string
  eyebrow: string
  headline: string
  credential?: string | null
  support?: string | null
}) {
  const initials = name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'A'
  return (
    <div
      style={{
        display: 'flex', width: '100%', height: '100%', fontFamily: 'Manrope', color: '#fff',
        backgroundColor: C.bgBot,
        backgroundImage: `radial-gradient(1000px 700px at 82% 50%, ${C.bgTop} 0%, ${C.bgMid} 58%, ${C.bgBot} 100%)`,
      }}
    >
      <div style={{ display: 'flex', width: 470, height: '100%', position: 'relative', backgroundColor: '#221b11' }}>
        {photo ? (
          <img src={photo} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontFamily: 'Playfair', fontWeight: 900, fontSize: 140, color: C.goldLight }}>
            {initials}
          </div>
        )}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', backgroundImage: `linear-gradient(90deg, rgba(16,13,9,0) 55%, ${C.bgBot} 100%)` }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, padding: 76, gap: 20 }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <div style={{ display: 'flex', fontFamily: 'Playfair', fontWeight: 900, fontSize: 74, lineHeight: 1.02, letterSpacing: -1 }}>{headline}</div>
        {credential ? <div style={{ display: 'flex', fontSize: 30, fontWeight: 900, color: C.goldLight }}>{credential}</div> : null}
        {support ? <div style={{ display: 'flex', fontSize: 24, fontWeight: 400, color: C.sub }}>{support}</div> : null}
      </div>
    </div>
  )
}

/**
 * Full-bleed photo card: the property/subject photo fills the frame, a dark scrim sits over it,
 * and the eyebrow + headline + sub sit bottom-left with the agent chip bottom-right. Used for
 * CMA, open house, and Listing Spotlight links. `photo` must already be a data: URI (or null).
 *
 * IMPORTANT for Satori: never put `undefined` in a style object here — it calls `.trim()` on
 * values and throws on undefined. Use conditional spreads.
 */
export function PhotoCard({
  photo, eyebrow, headline, sub, agentName, agentBrokerage, agentPhoto,
}: {
  photo: string | null
  eyebrow: string
  headline: string
  sub?: string
  agentName: string
  agentBrokerage?: string | null
  agentPhoto?: string | null
}) {
  return (
    <div
      style={{
        display: 'flex', position: 'relative', width: '100%', height: '100%', fontFamily: 'Manrope',
        backgroundColor: C.bgBot,
        backgroundImage: `radial-gradient(1000px 640px at 78% 22%, ${C.bgTop} 0%, ${C.bgMid} 55%, ${C.bgBot} 100%)`,
      }}
    >
      {photo ? (
        <img src={photo} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : null}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex',
          backgroundImage:
            'linear-gradient(0deg, rgba(9,7,4,0.95) 0%, rgba(9,7,4,0.35) 52%, rgba(9,7,4,0.5) 100%), linear-gradient(90deg, rgba(9,7,4,0.78) 0%, rgba(9,7,4,0.12) 55%, rgba(9,7,4,0.3) 100%)',
        }}
      />
      {/* The agent first - their headshot top-left - so the link reads as theirs (user, 10/17) */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '56px 72px 66px', color: '#fff' }}>
        <div style={{ display: 'flex', alignSelf: 'flex-start', padding: '10px 26px 10px 10px', borderRadius: 999, backgroundColor: 'rgba(9,7,4,0.55)', border: '1px solid rgba(234,208,154,0.35)' }}>
          <AgentChip name={agentName} brokerage={agentBrokerage} photo={agentPhoto} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto' }}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <div style={{ display: 'flex', fontFamily: 'Playfair', fontWeight: 900, fontSize: headline.length > 44 ? 56 : 68, lineHeight: 1.04, marginTop: 16, maxWidth: 1050 }}>
            {headline}
          </div>
          {sub ? (
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 400, color: C.sub, marginTop: 14 }}>{sub}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** A short fingerprint of what a card shows - goes in its image address (?v=) so apps that cache
 *  previews by address (iMessage, Facebook, Slack) pick up an edit instead of the old picture. */
export function cardVersion(...parts: unknown[]): string {
  const s = parts.map(p => (p == null ? '' : String(p))).join('|')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(36)
}
