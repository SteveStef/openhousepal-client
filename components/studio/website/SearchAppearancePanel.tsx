'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Image as ImageIcon, Info, Loader2, Search, Sparkles, Upload, Wand2 } from 'lucide-react'
import api from '@/lib/api-service'
import type { SitePage, SiteSeo } from '@/types'
import type { SeoPagesData } from '@/lib/api-service'
import { autoSectionMeta, type SeoCtx } from '@/lib/siteSeoAuto'
import SeoPagesList, { AutoChip, seoCtxFrom, type SeoPreviewPage } from './SeoPagesList'
import OhpSwitch from '@/components/ui/OhpSwitch'
import GoogleListingCard from './GoogleListingCard'

// IDX editor -> "Google" tab: everything that decides how the site looks in a Google result and a
// browser tab - the site name, the home result's blue title + grey description, the tab icon, and
// each main page's own title + description (the indented sub-links Google can show under the
// result). Google chooses when to show sub-links; this gives it everything it looks for.

/** Every IDX site's tab icon until the agent picks their own - the OpenHousePal house mark (owner, 10/24). */
export const OHP_TAB_ICON = '/icon-512.png'

export const DEFAULT_SITE_SEO: SiteSeo = { site_name: '', home_title: '', description: '', favicon_url: null, share_image_url: null, allow_indexing: true, share_rating: true, pages: {} }

export type SeoLink = { key: string; label: string; path: string; fallbackTitle: string; fallbackDescription: string }

/** The pages that can show as sub-links, in the order the site's menu lists them. */
export function seoLinksFor(pages: SitePage[], area: string, ctx?: SeoCtx): SeoLink[] {
  const inWhere = area ? ` in ${area}` : ''
  const custom = pages.filter(p => !p.is_home && p.slug && !['about', 'contact'].includes(p.slug))
  const links: SeoLink[] = [
    { key: 'search', label: 'Search Homes', path: 'search', fallbackTitle: 'Search Homes', fallbackDescription: `Search every home for sale${inWhere} - updated all day, with photos, prices and open houses.` },
    { key: 'properties', label: 'Featured Listings', path: 'properties', fallbackTitle: 'Featured Listings', fallbackDescription: `Hand-picked homes for sale${inWhere}, with photos, prices and full details.` },
    { key: 'neighborhoods', label: 'Neighborhoods', path: 'neighborhoods', fallbackTitle: 'Neighborhoods', fallbackDescription: `Neighborhood guides${inWhere} - schools, commute, parks and market data, town by town.` },
    { key: 'blog', label: 'Articles', path: 'blog', fallbackTitle: 'Articles & Media', fallbackDescription: `Local market updates and guides for buyers and sellers${inWhere}.` },
    ...custom.map(p => ({ key: p.slug, label: p.title, path: p.slug, fallbackTitle: p.title, fallbackDescription: '' })),
    { key: 'about', label: 'About', path: 'about', fallbackTitle: 'About', fallbackDescription: '' },
    { key: 'contact', label: 'Contact', path: 'contact', fallbackTitle: 'Contact', fallbackDescription: '' },
  ]
  // With the agent's real facts loaded, use the exact automatic wording the live site uses.
  if (!ctx) return links
  return links.map(l => { const auto = autoSectionMeta(l.key, ctx); return auto ? { ...l, fallbackTitle: auto.title, fallbackDescription: auto.description } : l })
}

const TITLE_MAX = 60
const DESC_MAX = 160

export default function SearchAppearancePanel({ seo, onChange, pages, defaults, focusKey, onFocusKey, data = null, onPreview }: {
  seo: SiteSeo
  onChange: (next: SiteSeo) => void
  pages: SitePage[]
  /** Pulled from the agent's profile/brand, used when a field is blank. */
  defaults: { siteName: string; area: string; logoUrl?: string | null }
  focusKey: string
  onFocusKey: (key: string) => void
  /** Every page's facts (sites.getSeoPages) - powers "Every page on Google". */
  data?: SeoPagesData | null
  onPreview?: (page: SeoPreviewPage | null) => void
}) {
  const set = (patch: Partial<SiteSeo>) => onChange({ ...seo, ...patch })
  const setPage = (key: string, patch: { title?: string; description?: string }) => onChange({ ...seo, pages: { ...seo.pages, [key]: { ...(seo.pages[key] || {}), ...patch } } })
  const links = seoLinksFor(pages, defaults.area, data ? seoCtxFrom(data) : undefined)
    const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const siteName = seo.site_name || defaults.siteName

  // The picture a shared link shows (texts, Facebook, LinkedIn...) - seo.share_image_url, which the
  // live site already used but nothing in the editor could set (10/27 audit). Blank = the designed
  // card made from the agent's photo, name and towns.
  const [shareUploading, setShareUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [iconError, setIconError] = useState('')
  const shareRef = useRef<HTMLInputElement>(null)
  const uploadShare = async (file: File) => {
    setShareUploading(true); setUploadError('')
    // Design uploads take JPG only - any picture is turned into one first (a PNG used to fail silently).
    const r = await api.studio.uploadMedia(await shareJpeg(file), 'design')
    setShareUploading(false)
    if (r.success && r.data?.url) set({ share_image_url: r.data.url })
    else setUploadError(r.error || 'That picture could not be uploaded. Try a JPG or PNG.')
  }

  const upload = async (file: File) => {
    setUploading(true)
    setIconError('')
    // The square icon is a PNG - the logo upload takes PNGs; the design one is JPG-only, so the
    // tab icon upload always failed (found with the share picture, 10/27).
    const icon = await squareIcon(file)
    const r = await api.studio.uploadMedia(icon, icon.type === 'image/png' ? 'brand_logo' : 'design')
    setUploading(false)
    if (r.success && r.data?.url) set({ favicon_url: r.data.url })
    else setIconError(r.error || 'That icon could not be uploaded. Try a JPG or PNG.')
  }

  // The live site fills a blank home title/description automatically - those count as ready.
  const autoHome = data ? autoSectionMeta('home', seoCtxFrom(data)) : null
  const checks = [
    { ok: !!siteName.trim(), label: 'Site name' },
    { ok: !!((seo.home_title || '').trim() || autoHome?.title), label: 'Home title' },
    { ok: ((seo.description || '').trim() || autoHome?.description || '').length >= 70, label: 'Home description' },
    { ok: true, label: 'Tab icon' },
    { ok: links.filter(l => (seo.pages[l.key]?.description || l.fallbackDescription).trim()).length >= 4, label: 'Sub-link descriptions' },
  ]
  const score = checks.filter(c => c.ok).length

  const suggestTitle = () => set({ home_title: `${siteName || 'Your Name'} | ${defaults.area ? `${defaults.area} ` : ''}Real Estate` })

  return (
    <div className="space-y-5">
      {/* In Google at all? (automatic - this only reports) */}
      <GoogleListingCard agentName={data?.agent?.name || undefined} />

      {/* Google-ready meter */}
      <div className="rounded-2xl border border-[#C9A24D]/30 bg-gradient-to-br from-[#fffaf0] to-[#f6ead2] p-4 dark:border-white/10 dark:from-[#C9A24D]/10 dark:to-transparent">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8b7355] dark:text-[#e8c97a]">Google-ready</p>
          <p className="font-serif text-lg font-black text-[#111827] dark:text-white">{score}<span className="text-sm text-gray-400">/{checks.length}</span></p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80 dark:bg-white/10">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-[#8b6a2b] via-[#C9A24D] to-[#e8c97a]" initial={false} animate={{ width: `${(score / checks.length) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {checks.map(c => (
            <span key={c.label} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black transition ${c.ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300' : 'bg-white/80 text-gray-500 dark:bg-white/5 dark:text-white/50'}`}>
              {c.ok ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />}{c.label}
            </span>
          ))}
        </div>
      </div>

      {/* Name + tab icon */}
      <Group title="Your name on Google" hint="Shown above your link, and on the browser tab." active={focusKey === 'brand'} onFocus={() => onFocusKey('brand')}>
        <Field label="Site name" value={seo.site_name} auto={defaults.siteName || undefined} placeholder="e.g. The Gordon Group" onChange={v => set({ site_name: v })} max={40} />
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-white/50">Tab icon{!seo.favicon_url && <span className="rounded-full bg-[#C9A24D]/15 px-1.5 py-px text-[8.5px] font-black tracking-wide text-[#8b6a2b] dark:text-[#e8c97a]">OPENHOUSEPAL</span>}</p>
          <div className="mt-1.5 flex items-center gap-3">
            <motion.span key={seo.favicon_url || 'ohp'} initial={{ scale: 0.6, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white shadow-sm dark:border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={seo.favicon_url || OHP_TAB_ICON} alt="" className="h-full w-full object-cover" />
            </motion.span>
            <div className="flex flex-wrap gap-2">
              <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-3 py-2 text-[11px] font-black text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {seo.favicon_url ? 'Change icon' : 'Upload my own'}
              </motion.button>
              {defaults.logoUrl && seo.favicon_url !== defaults.logoUrl && <button type="button" onClick={() => set({ favicon_url: defaults.logoUrl! })} className="rounded-xl px-2.5 py-2 text-[11px] font-black text-[#8b7355] transition hover:text-[#111827] dark:text-[#e8c97a]">Use my logo</button>}
              {seo.favicon_url && <button type="button" onClick={() => set({ favicon_url: null })} className="rounded-xl px-2.5 py-2 text-[11px] font-black text-gray-400 transition hover:text-[#111827] dark:hover:text-white">Back to house icon</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
          </div>
          {iconError && <p className="mt-1.5 text-[11px] font-bold text-red-500">{iconError}</p>}
          <p className="mt-1.5 text-[11px] font-semibold text-gray-400">
            Shows on the browser tab for everything on your own domain - your site, Showcases, Spotlights, forms and CMAs. Any image works; it&apos;s fitted to a crisp square for you (a simple logo mark reads best that small). Until you pick one, the OpenHousePal house icon is used. Shows once you publish.
          </p>
        </div>
      </Group>

      {/* The picture on a shared link */}
      <Group title="When your link is shared" hint="The picture people see when your website's link is texted or posted." active={focusKey === 'share'} onFocus={() => onFocusKey('share')}>
        <div className="flex items-center gap-3">
          <span className="relative flex h-[63px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-[#111827] to-[#2a2f3a] shadow-sm dark:border-white/10">
            {seo.share_image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={seo.share_image_url} alt="" className="h-full w-full object-cover" />
              : <span className="px-2 text-center text-[9px] font-black uppercase leading-tight tracking-wide text-[#e8c97a]">Your designed card</span>}
          </span>
          <div className="flex flex-wrap gap-2">
            <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => shareRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-3 py-2 text-[11px] font-black text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]">
              {shareUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {seo.share_image_url ? 'Change picture' : 'Use my own picture'}
            </motion.button>
            {seo.share_image_url && <button type="button" onClick={() => set({ share_image_url: null })} className="rounded-xl px-2.5 py-2 text-[11px] font-black text-gray-400 transition hover:text-[#111827] dark:hover:text-white">Back to my designed card</button>}
          </div>
          <input ref={shareRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadShare(f); e.target.value = '' }} />
        </div>
        {uploadError && <p className="mt-1.5 text-[11px] font-bold text-red-500">{uploadError}</p>}
        <p className="mt-1.5 text-[11px] font-semibold text-gray-400">
          Until you pick one, we make a card for you from your photo, name and towns - it updates itself. Your own picture works best wide (about 1200 x 630).
        </p>
      </Group>

      {/* Home result */}
      <Group title="Your main result" hint="The big blue headline and the line under it." active={focusKey === 'home'} onFocus={() => onFocusKey('home')}>
        <Field label="Headline" value={seo.home_title} auto={autoHome?.title || `${siteName || 'Your Name'} | ${defaults.area ? `${defaults.area} ` : ''}Real Estate`} placeholder={`${siteName || 'Your Name'} | Real Estate`} onChange={v => set({ home_title: v })} max={TITLE_MAX}
          action={<button type="button" onClick={suggestTitle} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-[#8b7355] transition hover:text-[#111827] dark:text-[#e8c97a]"><Wand2 className="h-3 w-3" /> Suggest</button>} />
        <Field label="Description" value={seo.description} auto={autoHome?.description || `${siteName || 'We'} help${siteName ? 's' : ''} buyers and sellers${defaults.area ? ` across ${defaults.area}` : ''} - search every home for sale, see what's sold, and get a free home value.`} placeholder="A sentence or two about you and the area you serve" onChange={v => set({ description: v })} max={DESC_MAX} multiline />
      </Group>

      {/* Every page - main pages (Google's sub-links), neighborhoods, articles, homes */}
      <Group title="Every page on Google" hint="Each page's blue title and grey line - written for you automatically. Tap one to preview it; reword any main page or neighborhood." active={focusKey.startsWith('pg:') || focusKey.startsWith('page:')} onFocus={() => {}}>
        <SeoPagesList seo={seo} onChange={onChange} pages={pages} data={data} siteName={siteName} focusKey={focusKey}
          onPreview={(page, key) => { onPreview?.(page); onFocusKey(key) }} />
      </Group>

      {/* Indexing */}
      <div className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200 p-4 dark:border-white/[0.08]">
        <div className="flex items-start gap-2.5">
          <Search className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24D]" />
          <div>
            <p className="text-xs font-black text-[#111827] dark:text-white">Let Google find my site</p>
            <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">Off hides the whole site from search results (it still works by link).</p>
          </div>
        </div>
        <OhpSwitch on={seo.allow_indexing} onChange={v => set({ allow_indexing: v })} label="Let Google find my site" />
      </div>

      {/* Star rating - only ever sent when it helps (see content_adapters.google_rating) */}
      <div className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200 p-4 dark:border-white/[0.08]">
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24D]" />
          <div>
            <p className="text-xs font-black text-[#111827] dark:text-white">Share my star rating with Google</p>
            <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              Only ever sent when it helps you: 3 or more reviews averaging 4.0 stars or better. Otherwise nothing is sent - no rating, never a low one.
            </p>
            {data && (seo.share_rating === false ? (
              <p className="mt-1.5 text-[11px] font-black text-gray-500">Off - your rating is never sent.</p>
            ) : data.google_rating ? (
              <p className="mt-1.5 text-[11px] font-black text-emerald-600">Sending: {Number(data.google_rating.average).toFixed(1)}★ from {data.google_rating.count} reviews</p>
            ) : (
              <p className="mt-1.5 text-[11px] font-black text-amber-600">
                Not sent right now - {!data.reviews ? 'your Reviews page is off.' : data.review_filter_on ? 'you show only 4–5 star reviews, and Google needs every review counted.' : 'it needs 3+ reviews averaging 4.0 or better.'}
              </p>
            ))}
          </div>
        </div>
        <OhpSwitch on={seo.share_rating !== false} onChange={v => set({ share_rating: v })} label="Share my star rating with Google" />
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-[11px] font-semibold leading-relaxed text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span><b className="text-[#111827] dark:text-white">Good to know:</b> Google decides when to show sub-links - usually once people search your name. Your site already sends Google a sitemap, your business details and every page&apos;s title and description; fill these in and publish to give it the best shot. Changes reach Google the next time it visits (often a few days).</span>
      </p>
    </div>
  )
}

function Group({ title, hint, active, onFocus, children }: { title: string; hint: string; active: boolean; onFocus: () => void; children: React.ReactNode }) {
  return (
    <div onFocusCapture={onFocus} onPointerDownCapture={onFocus} className={`rounded-2xl border p-4 transition ${active ? 'border-[#C9A24D]/60 shadow-[0_14px_30px_-22px_rgba(201,162,77,.9)]' : 'border-gray-200 dark:border-white/[0.08]'}`}>
      <p className="flex items-center gap-1.5 text-sm font-black text-[#111827] dark:text-white"><Sparkles className={`h-3.5 w-3.5 transition ${active ? 'text-[#C9A24D]' : 'text-gray-300'}`} />{title}</p>
      <p className="mb-3 mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">{hint}</p>
      {children}
    </div>
  )
}

function Field({ label, value: own, placeholder, auto, onChange: setOwn, max, multiline, compact, action }: {
  label: string; value: string; placeholder?: string; onChange: (v: string) => void; max: number; multiline?: boolean; compact?: boolean; action?: React.ReactNode
  /** Real text the live site uses when this is blank - shown as the value (not grey), owner 10/24. */
  auto?: string
}) {
  const [cleared, setCleared] = useState(false)
  const isAuto = !own && !cleared && !!auto
  const value = own || (cleared ? '' : auto || '')
  const onChange = (v: string) => { setCleared(v === ''); setOwn(v) }
  const len = (value || '').length
  const over = len > max
  const cls = `w-full rounded-xl border bg-white px-3 ${compact ? 'py-2 text-xs' : 'py-2.5 text-sm'} font-semibold outline-none transition focus:border-[#C9A24D] focus:shadow-[0_0_0_4px_rgba(201,162,77,.14)] dark:bg-[#0B0B0B] dark:text-white ${over ? 'border-amber-400' : 'border-gray-200 dark:border-gray-700'}`
  return (
    <label className={`block ${compact ? '' : 'mt-3 first:mt-0'}`}>
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-white/50">{label}{isAuto && <AutoChip />}</span>
        <span className="flex items-center gap-2">
          {action}
          <span className={`text-[10px] font-black tabular-nums ${over ? 'text-amber-600' : len > max * 0.85 ? 'text-[#8b7355]' : 'text-gray-300'}`}>{len}/{max}</span>
        </span>
      </span>
      {multiline
        ? <textarea value={value || ''} onChange={e => onChange(e.target.value)} onBlur={() => setCleared(false)} placeholder={placeholder} rows={compact ? 2 : 3} className={`${cls} mt-1 resize-none`} />
        : <input value={value || ''} onChange={e => onChange(e.target.value)} onBlur={() => setCleared(false)} placeholder={placeholder} className={`${cls} mt-1`} />}
      {over && <span className="mt-1 block text-[10px] font-bold text-amber-600">Google usually cuts this off around {max} characters.</span>}
    </label>
  )
}


/** A tab icon has to read at 16px: fit the picture (whole, never cropped) into a crisp 256px
 * square PNG before uploading. SVGs too (the upload takes JPG / PNG only). */
/** A shared-link picture as a JPG (what design uploads take), at most 1600px wide. */
async function shareJpeg(file: File): Promise<File> {
  if (file.type === 'image/jpeg' || typeof document === 'undefined') return file
  try {
    const url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url })
    const scale = Math.min(1, 1600 / img.width)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height) // see-through parts turn white, not black
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, 'image/jpeg', 0.9))
    return blob ? new File([blob], 'share-picture.jpg', { type: 'image/jpeg' }) : file
  } catch {
    return file
  }
}

async function squareIcon(file: File): Promise<File> {
  // SVGs are drawn into the square too - uploads take JPG / PNG only
  if (typeof document === 'undefined') return file
  try {
    const url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url })
    const SIZE = 256
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = SIZE
    const ctx = canvas.getContext('2d')!
    const scale = Math.min(SIZE / img.width, SIZE / img.height)
    const w = img.width * scale, h = img.height * scale
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h)
    URL.revokeObjectURL(url)
    const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, 'image/png'))
    return blob ? new File([blob], 'tab-icon.png', { type: 'image/png' }) : file
  } catch {
    return file
  }
}
