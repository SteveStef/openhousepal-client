'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ClipboardList, Clapperboard, Home, Link2, MapPin, PenLine, Play, Sparkles, Tag } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import type { BlogAiContext, BlogAiPropertyRef, BlogBlock } from '@/types'
import { youtubeIdOf } from './ShowcaseBlocks'
import { BLOG_CTA_FORMS, ctaFormTypeOf } from '@/lib/studio/blogTopics'

// The AI writer's Finish step - after the draft is written, before the editor opens: drop in a
// video where it fits, choose how the article ends (the agent's recent sales or listings in the
// area, or videos about the area), and whether the email signature closes it. Everything here is
// the agent's own data; `applyFinish` turns the choices into ordinary article blocks.

export type FinishChoices = {
  video: { url: string; title?: string; position: string } | null
  sales: string[] | null
  listings: string[] | null
  videos: string[] | null
  signature: boolean
  /** The form the closing button opens (null = keep the one the article has). */
  cta?: string | null
  /** Town Spotlight sections to add for these Areas slugs. */
  spotlight?: string[] | null
  /** Move the video that's already in the article: 'after_intro' | 'before_end' | 'section:<heading id>'. */
  moveVideo?: string | null
}

export const emptyFinish = (signature: boolean): FinishChoices => ({ video: null, sales: null, listings: null, videos: null, signature, cta: null, spotlight: null, moveVideo: null })

/** Where a video goes for a position choice (index to insert at). */
function videoAt(out: BlogBlock[], position: string): number {
  const heads = out.map((b, i) => (b.type === 'heading' ? i : -1)).filter(i => i >= 0)
  if (position === 'after_intro') return heads[0] ?? 0
  if (position === 'before_end') return heads[heads.length - 1] ?? out.length
  if (position.startsWith('section:')) {
    const start = out.findIndex(b => b.id === position.slice(8))
    if (start >= 0) { let at = start + 1; while (at < out.length && out[at].type !== 'heading') at++; return at }
  }
  return out.length
}

/** Where the article's video is now, in words ("After: Why pre-approval comes first"). */
export function videoSpot(blocks: BlogBlock[]): { label: string; headingId: string | null } | null {
  const vi = blocks.findIndex(b => b.type === 'youtube')
  if (vi < 0) return null
  for (let i = vi - 1; i >= 0; i--) {
    if (blocks[i].type === 'heading') return { label: `In "${headingText(blocks[i]).slice(0, 60)}"`, headingId: blocks[i].id }
  }
  return { label: 'Right after the intro', headingId: null }
}

const bid = (k: string) => `${k}-fin-${Math.random().toString(36).slice(2, 10)}`
const headingText = (b: BlogBlock) => String(b.data?.html || b.data?.text || '').replace(/<[^>]+>/g, '').trim()

const inAreas = (city: string | null | undefined, areas: string[]) => {
  const c = (city || '').toLowerCase().trim()
  return !!c && areas.some(a => a.split(',')[0].toLowerCase().trim() === c)
}

export function areaPicks<T extends { city?: string | null }>(items: T[], areas: string[]) {
  const local = areas.length ? items.filter(i => inAreas(i.city, areas)) : []
  return { items: local.length ? local : items, local: local.length > 0 }
}

const placeLabel = (areas: string[]) => {
  const towns = areas.map(a => a.split(',')[0].trim()).filter(Boolean)
  return towns.length === 0 ? '' : towns.length === 1 ? towns[0] : `${towns.slice(0, -1).join(', ')} & ${towns[towns.length - 1]}`
}

/** The chosen extras as blocks: the video where the agent put it, the pitch just before the
 *  call to action (so the article ends: closing words -> showcase -> CTA -> signature). */
export function applyFinish(blocks: BlogBlock[], c: FinishChoices, ctx: BlogAiContext | null, areas: string[]): BlogBlock[] {
  let out = [...blocks]
  if (c.moveVideo) {
    const vi = out.findIndex(b => b.type === 'youtube')
    if (vi >= 0) { const [vb] = out.splice(vi, 1); out.splice(videoAt(out, c.moveVideo), 0, vb) }
  }
  if (c.video && youtubeIdOf(c.video.url)) {
    const vb = { id: bid('youtube'), type: 'youtube', data: { url: c.video.url, title: c.video.title || '' } } as BlogBlock
    out.splice(videoAt(out, c.video.position), 0, vb)
  }
  if (c.cta) {
    const form = BLOG_CTA_FORMS.find(f => f.formType === c.cta)
    if (form) out = out.map(b => (b.type === 'cta' ? { ...b, data: { ...b.data, formType: form.formType, label: form.label } } as BlogBlock : b))
  }
  const place = placeLabel(areas)
  const pitch: BlogBlock[] = []
  const pick = (list: BlogAiPropertyRef[], ids: string[]) => ids.map(id => list.find(p => p.id === id)).filter(Boolean) as BlogAiPropertyRef[]
  if (c.sales?.length && ctx) {
    const props = pick(ctx.recent_sales, c.sales)
    const local = props.every(p => inAreas(p.city, areas))
    pitch.push({ id: bid('property_showcase'), type: 'property_showcase', data: { kind: 'sales', title: place && local ? `Recent Sales in ${place}` : 'Recent Sales in the Area', properties: props } } as BlogBlock)
  }
  if (c.listings?.length && ctx) {
    const props = pick(ctx.listings, c.listings)
    const local = props.every(p => inAreas(p.city, areas))
    pitch.push({ id: bid('property_showcase'), type: 'property_showcase', data: { kind: 'listings', title: place && local ? `Homes for Sale in ${place}` : 'Homes for Sale', properties: props } } as BlogBlock)
  }
  if (c.spotlight?.length && ctx) {
    for (const card of ((ctx as any).area_cards || []).filter((a: any) => c.spotlight!.includes(a.slug))) {
      pitch.push({ id: bid('area_spotlight'), type: 'area_spotlight', data: { area: card } } as BlogBlock)
    }
  }
  if (c.videos?.length && ctx) {
    const vids = c.videos.map(u => (ctx.videos || []).find(v => v.url === u)).filter(Boolean).map(v => ({ id: v!.id, url: v!.url, title: v!.title, image: v!.image || null }))
    pitch.push({ id: bid('video_showcase'), type: 'video_showcase', data: { title: place ? `Get to know ${place}` : 'Videos about the area', videos: vids } } as BlogBlock)
  }
  if (pitch.length) {
    const cta = out.findIndex(b => b.type === 'cta')
    const at = cta >= 0 ? cta : out.findIndex(b => b.type === 'agent_profile')
    out.splice(at >= 0 ? at : out.length, 0, ...pitch)
  }
  return out
}

export default function BlogFinishStep({ ctx, blocks, areas, value, onChange, canSignature, videoInArticle = false, usedSales = false, usedListings = false }: {
  ctx: BlogAiContext | null
  blocks: BlogBlock[]
  areas: string[]
  value: FinishChoices
  onChange: (next: FinishChoices) => void
  canSignature: boolean
  /** The video picked before writing is already in its section. */
  videoInArticle?: boolean
  /** Sales / listings were already picked for the article in the interview. */
  usedSales?: boolean
  usedListings?: boolean
}) {
  const [videoUrl, setVideoUrl] = useState(value.video?.url || '')
  const place = placeLabel(areas)
  const sales = useMemo(() => areaPicks(ctx?.recent_sales || [], areas), [ctx, areas])
  const listings = useMemo(() => areaPicks(ctx?.listings || [], areas), [ctx, areas])
  const hubVideos = (ctx?.videos || []).filter(v => youtubeIdOf(v.url))
  const heads = blocks.filter(b => b.type === 'heading')
  // The pitch (user, 10/17) leads with the form readers fill out; sales / listings / videos / a Town
  // Spotlight are only offered when the article doesn't already have them.
  const ctaBlock = blocks.find(b => b.type === 'cta')
  const ctaForm = value.cta || (ctaBlock ? ctaFormTypeOf(ctaBlock.data as any) : null)
  const hasSales = usedSales || blocks.some(b => b.type === 'property_showcase' && b.data?.kind === 'sales')
  const hasListings = usedListings || blocks.some(b => b.type === 'property_card' || (b.type === 'property_showcase' && b.data?.kind === 'listings'))
  const hasVideos = blocks.some(b => b.type === 'youtube' || b.type === 'video_showcase')
  const hasSpotlight = blocks.some(b => b.type === 'area_spotlight')
  const spotCards = useMemo(() => {
    const wanted = areas.map(a => a.split(',')[0].toLowerCase().trim())
    return (((ctx as any)?.area_cards || []) as any[]).filter(c => wanted.includes(String(c.name || '').toLowerCase())).slice(0, 5)
  }, [ctx, areas])
  const already = [hasSales && 'your sales', hasListings && 'your listings', hasVideos && 'a video', hasSpotlight && 'a Town Spotlight'].filter(Boolean) as string[]
  const spot = videoSpot(blocks)
  const set = (patch: Partial<FinishChoices>) => onChange({ ...value, ...patch })
  const setVideo = (url: string, title?: string) => {
    setVideoUrl(url)
    set({ video: youtubeIdOf(url) ? { url, title, position: value.video?.position || 'after_intro' } : null })
  }
  const toggle = (key: 'sales' | 'listings' | 'videos', defaults: string[]) => set({ [key]: value[key] ? null : defaults } as Partial<FinishChoices>)
  const flip = (key: 'sales' | 'listings' | 'videos', id: string) => {
    const cur = value[key] || []
    set({ [key]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id].slice(0, 6) } as Partial<FinishChoices>)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a]"><PenLine className="h-4 w-4" /></span>
        <div>
          <p className="text-sm font-black text-[#111827] dark:text-white">Finish your article</p>
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Optional - add a video and choose how it ends. You can change all of it in the editor.</p>
        </div>
      </div>

      {/* Video (already placed when one was picked before writing) */}
      {videoInArticle ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-900/15">
          {/* One text run (the words used to split into three cramped flex columns on a phone). */}
          <p className="flex items-start gap-2 text-xs font-bold leading-snug text-emerald-800 dark:text-emerald-300"><Clapperboard className="mt-px h-4 w-4 shrink-0 text-emerald-600" /><span className="min-w-0">Your video is in the article{spot ? <> - <span className="font-black">{spot.label}</span></> : null}.</span></p>
          <label className="mt-2 block">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700/70 dark:text-emerald-300/70">Where it goes</span>
            <select value={value.moveVideo || (spot?.headingId ? `section:${spot.headingId}` : 'after_intro')} onChange={e => set({ moveVideo: e.target.value })} className="mt-1 w-full min-w-0 truncate rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-base font-bold sm:py-2 sm:text-sm text-[#111827] outline-none focus:border-[#C9A24D] dark:border-emerald-900/50 dark:bg-[#1A1A1C] dark:text-white">
              <option value="after_intro">Right after the intro</option>
              {heads.map(h => <option key={h.id} value={`section:${h.id}`}>In: {headingText(h).slice(0, 60)}</option>)}
              <option value="before_end">Just before the ending</option>
            </select>
          </label>
        </div>
      ) : (
      <Card icon={Clapperboard} title="Add a video" hint="A YouTube link, or one from your Agent Hub.">
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={videoUrl} onChange={e => setVideo(e.target.value.trim())} placeholder="Paste a YouTube link" className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-base font-semibold sm:text-sm text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white" />
        </div>
        {hubVideos.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {hubVideos.slice(0, 12).map(v => (
              <Thumb key={v.id} img={v.image || `https://i.ytimg.com/vi/${youtubeIdOf(v.url)}/mqdefault.jpg`} label={v.title || (v.kind === 'tour' ? 'House tour' : 'Video')} on={value.video?.url === v.url} onClick={() => setVideo(value.video?.url === v.url ? '' : v.url, v.title)} video />
            ))}
          </div>
        )}
        <AnimatePresence>
          {value.video && (
            <motion.label initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 block overflow-hidden">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Where it goes</span>
              <select value={value.video.position} onChange={e => set({ video: { ...value.video!, position: e.target.value } })} className="mt-1 w-full min-w-0 truncate rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base font-bold sm:text-sm text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white">
                <option value="after_intro">Right after the intro</option>
                {heads.map(h => <option key={h.id} value={`section:${h.id}`}>After: {headingText(h).slice(0, 60)}</option>)}
                <option value="before_end">Just before the ending</option>
              </select>
            </motion.label>
          )}
        </AnimatePresence>
      </Card>
      )}

      {/* Pitch - the form first */}
      <Card icon={Sparkles} title="End with a pitch" hint={place ? `What readers do once they've read it - right at the end, for ${place}.` : "What readers do once they've read it - right at the end."}>
        {ctaForm && (
          <div className="rounded-xl border border-[#C9A24D]/40 bg-[#fffaf0] p-3 dark:bg-[#C9A24D]/[0.06]">
            <p className="flex items-center gap-1.5 text-[11px] font-black text-[#111827] dark:text-white"><ClipboardList className="h-3.5 w-3.5 text-[#C9A24D]" /> Readers finish with your form</p>
            <p className="mt-0.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">The closing button opens it right on the article - every answer lands in your Leads.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BLOG_CTA_FORMS.map(f => (
                <motion.button key={f.formType} type="button" whileTap={{ scale: 0.95 }} onClick={() => set({ cta: f.formType })}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-black transition sm:px-2.5 sm:py-1 sm:text-[11px] ${ctaForm === f.formType ? 'border-[#C9A24D] bg-[#C9A24D] text-[#111827]' : 'border-gray-200 bg-white text-gray-600 hover:border-[#C9A24D]/60 dark:border-gray-700 dark:bg-transparent dark:text-gray-300'}`}>
                  {ctaForm === f.formType && <Check className="h-3 w-3" />}{f.label}
                </motion.button>
              ))}
            </div>
          </div>
        )}
        {(!hasSales || !hasListings || !hasVideos || (!hasSpotlight && spotCards.length > 0)) && (
          <>
            <p className="mb-2 mt-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Show your work above it <span className="normal-case tracking-normal">· optional</span></p>
            <div className="grid gap-2 sm:grid-cols-3">
              {!hasSales && <PitchOption icon={Tag} label={sales.local && place ? `Recent Sales in ${place}` : 'Recent Sales'} count={sales.items.length} on={!!value.sales} disabled={!sales.items.length} empty="Add sales on your Agent Hub"
                onClick={() => toggle('sales', sales.items.slice(0, 4).map(s => s.id))} />}
              {!hasListings && <PitchOption icon={Home} label={listings.local && place ? `Listings in ${place}` : 'My listings'} count={listings.items.length} on={!!value.listings} disabled={!listings.items.length} empty="No active listings"
                onClick={() => toggle('listings', listings.items.slice(0, 4).map(s => s.id))} />}
              {!hasVideos && <PitchOption icon={Play} label="Videos about the area" count={hubVideos.length} on={!!value.videos} disabled={!hubVideos.length} empty="Add videos on your Agent Hub"
                onClick={() => toggle('videos', hubVideos.slice(0, 2).map(v => v.url))} />}
              {!hasSpotlight && spotCards.length > 0 && <PitchOption icon={MapPin} label={`Town Spotlight: ${spotCards.map(c => c.name).join(' & ')}`} count={spotCards.length} on={!!value.spotlight} disabled={false} empty=""
                onClick={() => set({ spotlight: value.spotlight ? null : spotCards.map(c => c.slug) })} countLabel="photos, market numbers, schools" />}
            </div>
          </>
        )}
        {already.length > 0 && <p className="mt-2 text-[10px] font-semibold text-gray-400">Already in the article: {already.join(', ')}.</p>}
        <AnimatePresence initial={false}>
          {value.sales && !hasSales && <PickRow key="s" title="Which sales" items={sales.items} picked={value.sales} onFlip={id => flip('sales', id)} />}
          {value.listings && !hasListings && <PickRow key="l" title="Which listings" items={listings.items} picked={value.listings} onFlip={id => flip('listings', id)} />}
          {value.videos && !hasVideos && (
            <motion.div key="v" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Which videos</p>
              <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
                {hubVideos.map(v => <Thumb key={v.id} img={v.image || `https://i.ytimg.com/vi/${youtubeIdOf(v.url)}/mqdefault.jpg`} label={v.title || 'Video'} on={value.videos!.includes(v.url)} onClick={() => flip('videos', v.url)} video />)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {canSignature && (
        <button type="button" onClick={() => set({ signature: !value.signature })} className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-[#C9A24D]/60 dark:border-gray-800 dark:bg-[#1A1A1C]">
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${value.signature ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-gray-700'}`}>
            <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }} className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${value.signature ? 'right-0.5' : 'left-0.5'}`} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black text-[#111827] dark:text-white">End with my email signature</span>
            <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400">Your signature card closes the article instead of the small contact card.</span>
          </span>
        </button>
      )}
    </div>
  )
}

function Card({ icon: Icon, title, hint, children }: { icon: typeof Clapperboard; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#1A1A1C]">
      <p className="flex items-center gap-1.5 text-xs font-black text-[#111827] dark:text-white"><Icon className="h-4 w-4 text-[#C9A24D]" /> {title}</p>
      <p className="mb-3 mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">{hint}</p>
      {children}
    </div>
  )
}

function PitchOption({ icon: Icon, label, count, on, disabled, empty, onClick, countLabel }: { icon: typeof Tag; label: string; count: number; on: boolean; disabled: boolean; empty: string; onClick: () => void; countLabel?: string }) {
  return (
    <motion.button type="button" disabled={disabled} onClick={onClick} whileTap={disabled ? undefined : { scale: 0.96 }}
      className={`relative rounded-xl border px-3 py-3 text-left transition ${disabled ? 'cursor-not-allowed border-dashed border-gray-200 opacity-50 dark:border-gray-800' : on ? 'border-[#C9A24D] bg-[#C9A24D]/10 shadow-[0_10px_24px_-16px_rgba(201,162,77,.9)]' : 'border-gray-200 hover:-translate-y-0.5 hover:border-[#C9A24D]/60 dark:border-gray-700'}`}>
      <span className={`absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full ${on ? 'bg-[#C9A24D] text-[#111827]' : 'border border-gray-300 dark:border-gray-600'}`}>{on && <Check className="h-3 w-3" />}</span>
      <Icon className="h-4 w-4 text-[#C9A24D]" />
      <span className="mt-1.5 block pr-4 text-xs font-black leading-tight text-[#111827] dark:text-white">{label}</span>
      <span className="mt-0.5 block text-[10px] font-semibold text-gray-500 dark:text-gray-400">{disabled ? empty : countLabel || `${count} available`}</span>
    </motion.button>
  )
}

function PickRow({ title, items, picked, onFlip }: { title: string; items: BlogAiPropertyRef[]; picked: string[]; onFlip: (id: string) => void }) {
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-gray-400">{title} <span className="normal-case tracking-normal">· up to 6</span></p>
      <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
        {items.slice(0, 30).map(p => <Thumb key={p.id} img={p.image_url ? resolveMediaUrl(p.image_url) : null} label={p.address} sub={[p.city, p.price ? `$${Math.round(p.price / 1000).toLocaleString()}K` : ''].filter(Boolean).join(' · ')} on={picked.includes(p.id)} onClick={() => onFlip(p.id)} />)}
      </div>
    </motion.div>
  )
}

function Thumb({ img, label, sub, on, onClick, video }: { img?: string | null; label: string; sub?: string; on: boolean; onClick: () => void; video?: boolean }) {
  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.95 }} title={label}
      className={`relative w-36 shrink-0 overflow-hidden rounded-xl border-2 text-left transition ${on ? 'border-[#C9A24D] shadow-[0_10px_24px_-14px_rgba(201,162,77,.9)]' : 'border-transparent opacity-80 hover:opacity-100'}`}>
      <div className="relative aspect-video bg-gray-100 dark:bg-white/5">
        {img ? <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Home className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-gray-300" />}
        {video && <Play className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 fill-white text-white drop-shadow" />}
        {on && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#C9A24D] text-[#111827]"><Check className="h-3 w-3" /></span>}
      </div>
      <div className="bg-white px-2 py-1.5 dark:bg-[#151517]">
        <p className="truncate text-[11px] font-black text-[#111827] dark:text-white">{label}</p>
        {sub && <p className="truncate text-[10px] font-semibold text-gray-500">{sub}</p>}
      </div>
    </motion.button>
  )
}
