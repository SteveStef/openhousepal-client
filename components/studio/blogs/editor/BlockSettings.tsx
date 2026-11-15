'use client'

// The settings of one section of an article - what the agent changes about a card that isn't typed
// straight onto the page: which photo, which town, which homes, where a button goes. Opened from
// the section's toolbar (the pencil) in the blog editor. Text sections have no settings: their
// words are typed on the page itself.

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ImagePlus, Loader2, Plus, X } from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { notify } from '@/contexts/ToastContext'
import type { AgentFormConfig, BlogAiContext, BlogAiPropertyRef, BlogBlock, LinkedProperty } from '@/types'
import { BLOG_CTA_FORMS, ctaFormTypeOf } from '@/lib/studio/blogTopics'
import PropertySelector from '@/components/studio/PropertySelector'
import type { AreaCard } from '@/components/studio/blogs/AreaSpotlightSection'
import { youtubeIdOf } from '@/components/studio/blogs/ShowcaseBlocks'

type Update = (updater: (block: BlogBlock) => BlogBlock) => void

const label = 'block text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-white/50'
const input = 'mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-base font-semibold text-[#111827] outline-none transition placeholder:font-medium placeholder:text-gray-400 focus:border-[#C9A24D] focus:shadow-[0_0_0_4px_rgba(201,162,77,.14)] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white sm:text-sm'
const note = 'text-xs font-semibold leading-relaxed text-gray-500 dark:text-gray-400'
const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-[11px] font-black transition active:scale-95 ${on ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'border border-gray-200 text-gray-600 hover:border-[#C9A24D] dark:border-gray-700 dark:text-gray-300'}`

/** Sections whose settings open by themselves when they're first added (there's something to pick). */
export const hasSettings = (type: BlogBlock['type']) => !['paragraph', 'heading', 'subheading', 'quote', 'callout', 'bulleted_list', 'numbered_list', 'divider', 'disclaimer'].includes(type)

// The agent's own sales, listings, videos and towns - loaded once per editor visit, on first use.
let ctxOnce: Promise<BlogAiContext | null> | null = null
function useBlogContext(): BlogAiContext | null | undefined {
  const [ctx, setCtx] = useState<BlogAiContext | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    if (!ctxOnce) ctxOnce = api.blogs.aiContext().then(r => (r.success && r.data ? r.data : null))
    ctxOnce.then(c => { if (alive) setCtx(c) })
    return () => { alive = false }
  }, [])
  return ctx
}

function Field({ title, value, onChange, placeholder, hint, max }: { title: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; max?: number }) {
  return (
    <label className="block">
      <span className={label}>{title}</span>
      <input value={value} onChange={e => onChange(max ? e.target.value.slice(0, max) : e.target.value)} placeholder={placeholder} className={input} />
      {hint && <span className={`mt-1 block ${note}`}>{hint}</span>}
    </label>
  )
}

function useUpload(onDone: (url: string) => void) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const pick = () => ref.current?.click()
  const field = (
    <input ref={ref} type="file" accept="image/jpeg" className="hidden" onChange={async e => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      setBusy(true)
      const res = await api.studio.uploadMedia(file)
      if (res.success && res.data) onDone(res.data.url)
      else notify(res.error || "That photo couldn't be uploaded - use a JPG under 10MB.")
      setBusy(false)
    }} />
  )
  return { pick, busy, field }
}

export default function BlockSettings({ block, onUpdate, signatureOn, onOpenPublish }: {
  block: BlogBlock
  onUpdate: Update
  /** The agent's email signature closes the article in place of the closing section / contact card. */
  signatureOn?: boolean
  onOpenPublish?: () => void
}) {
  const data = block.data || {}
  const set = (key: string, value: any) => onUpdate(b => ({ ...b, data: { ...(b.data || {}), [key]: value } }))
  const signatureNote = signatureOn ? (
    <p className={`rounded-xl bg-[#C9A24D]/10 p-3 ${note}`}>
      Your email signature card closes this article, so readers see it here instead.{' '}
      {onOpenPublish && <button type="button" onClick={onOpenPublish} className="font-black text-[#8b7355] underline dark:text-[#e8c97a]">Change that in Review and Publish</button>}
    </p>
  ) : null

  switch (block.type) {
    case 'image': return <ImageSettings data={data} set={set} />
    case 'gallery': return <GallerySettings images={data.images || []} onChange={images => set('images', images)} />
    case 'youtube': return <YoutubeSettings data={data} set={set} />
    case 'property_card': return <PropertySettings data={data} set={set} />
    case 'area_spotlight': return <TownSettings area={data.area || null} onChange={area => set('area', area)} />
    case 'property_showcase': return <HomesRowSettings data={data} set={set} />
    case 'video_showcase': return <VideosSettings data={data} set={set} />
    case 'lead_form': return <LeadFormSettings data={data} onUpdate={onUpdate} set={set} />
    case 'ask_agent':
      return <Field title="Ask me about..." value={data.topic || ''} onChange={v => set('topic', v)} max={60} placeholder="first-time buyer programs" hint="Readers see “Ask me about …” with Call, Text, Email and Message. Leave it empty for a plain “Ask me”." />
    case 'button':
      return (
        <div className="space-y-3">
          <Field title="Button words" value={data.label || ''} onChange={v => set('label', v)} placeholder="Learn More" max={40} />
          <Field title="Opens this link" value={data.url || ''} onChange={v => set('url', v)} placeholder="https://..." hint="The button shows on the article once it has a link." />
        </div>
      )
    case 'contact_form':
      return <Field title="Heading" value={data.label || ''} onChange={v => set('label', v)} placeholder="Ask me a question" hint="Readers' questions arrive in your Leads." />
    case 'qr_code':
      return (
        <div className="space-y-3">
          <Field title="The code opens this link" value={data.url || ''} onChange={v => set('url', v)} placeholder="https://..." />
          <Field title="Words next to it" value={data.label || ''} onChange={v => set('label', v)} placeholder="Scan for more" />
        </div>
      )
    case 'cta':
      return (
        <div className="space-y-3">
          {signatureNote}
          <Field title="The question" value={data.heading || ''} onChange={v => set('heading', v)} placeholder="Have a question about your move?" />
          <Field title="Button words" value={data.label || ''} onChange={v => set('label', v)} placeholder="Contact Me" max={40} />
          <div>
            <span className={label}>The button opens</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BLOG_CTA_FORMS.map(f => (
                <button key={f.formType} type="button" onClick={() => onUpdate(b => ({ ...b, data: { ...(b.data || {}), formType: f.formType, label: f.label } }))} className={chip(ctaFormTypeOf(data) === f.formType)}>{f.label}</button>
              ))}
            </div>
          </div>
        </div>
      )
    case 'agent_profile':
      return signatureNote || <p className={note}>Your contact card, filled in from your profile: your photo, name, brokerage and a Contact button.</p>
    case 'payment_example':
      return <p className={note}>Worked out from real homes for sale and Freddie Mac&apos;s average rate when the article was written{data.as_of ? ` (${data.as_of})` : ''}. You can move it or remove it. Its numbers can&apos;t be typed over, so they always match their sources.</p>
    case 'sources':
      return <p className={note}>The pages the AI writer read for this article&apos;s facts, with the dates. You can move the list or remove it. It can&apos;t be typed over, so it always matches what was checked.</p>
    case 'related_articles':
      return <p className={note}>Your other published articles show here on the live article. Nothing to set up.</p>
    default:
      return <p className={note}>Click the words on the page and type to change them.</p>
  }
}

function ImageSettings({ data, set }: { data: any; set: (k: string, v: any) => void }) {
  const up = useUpload(url => set('url', url))
  return (
    <div className="space-y-3">
      {data.url ? (
        <div className="relative overflow-hidden rounded-xl">
          <img src={resolveMediaUrl(data.url)} alt="" className="max-h-48 w-full object-cover" />
          <button type="button" onClick={up.pick} className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg bg-black/65 px-3 py-2 text-[11px] font-black text-white">
            {up.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Replace photo
          </button>
        </div>
      ) : (
        <button type="button" onClick={up.pick} disabled={up.busy} className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#C9A24D]/50 text-[#8b7355] transition hover:border-[#C9A24D] dark:text-[#e8c97a]">
          {up.busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          <span className="text-xs font-black">Choose a photo (JPG)</span>
        </button>
      )}
      {up.field}
      <Field title="Caption" value={data.caption || ''} onChange={v => set('caption', v)} placeholder="Optional - shows under the photo" />
      <Field title="Describe the photo" value={data.alt || ''} onChange={v => set('alt', v)} placeholder="A brick colonial on a tree-lined street" hint="Read aloud to people who can't see it, and helps Google understand the photo." />
    </div>
  )
}

function GallerySettings({ images, onChange }: { images: string[]; onChange: (images: string[]) => void }) {
  const up = useUpload(url => onChange([...images, url]))
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {images.map((url, i) => (
          <div key={url + i} className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
            <img src={resolveMediaUrl(url)} alt="" className="h-full w-full object-cover" />
            <button type="button" aria-label="Remove photo" onClick={() => onChange(images.filter((_, k) => k !== i))} className="absolute right-1 top-1 rounded-full bg-black/65 p-1.5 text-white"><X className="h-3 w-3" /></button>
          </div>
        ))}
        <button type="button" onClick={up.pick} disabled={up.busy} aria-label="Add a photo" className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-[#C9A24D]/50 text-[#8b7355] hover:border-[#C9A24D] dark:text-[#e8c97a]">
          {up.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
        </button>
      </div>
      {up.field}
      <p className={`mt-2 ${note}`}>JPG photos. They show as a tidy grid.</p>
    </div>
  )
}

function YoutubeSettings({ data, set }: { data: any; set: (k: string, v: any) => void }) {
  const [url, setUrl] = useState<string>(data.url || '')
  const ok = !url.trim() || !!youtubeIdOf(url.trim())
  return (
    <div className="space-y-3">
      <label className="block">
        <span className={label}>YouTube link</span>
        <input value={url} onChange={e => { const v = e.target.value; setUrl(v); if (!v.trim() || youtubeIdOf(v.trim())) set('url', v.trim()) }} placeholder="https://www.youtube.com/watch?v=..." className={input} />
        {!ok && <span className="mt-1 block text-xs font-bold text-amber-600">That doesn&apos;t look like a YouTube link yet.</span>}
      </label>
      <Field title="Title under the video" value={data.title || ''} onChange={v => set('title', v)} placeholder="Optional" />
    </div>
  )
}

function PropertySettings({ data, set }: { data: any; set: (k: string, v: any) => void }) {
  const property: LinkedProperty | null = data.property || null
  const [picking, setPicking] = useState(!property)
  const size = data.displaySize === 'large' ? 'large' : 'compact'
  return (
    <div className="space-y-3">
      {property && !picking ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <p className="min-w-0 truncate text-sm font-black text-[#111827] dark:text-white">{property.address}</p>
          <button type="button" onClick={() => setPicking(true)} className="shrink-0 rounded-lg bg-[#111827] px-3 py-1.5 text-[11px] font-black text-white dark:bg-white dark:text-[#111827]">Change home</button>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <PropertySelector value={property} onChange={p => { set('property', p); if (p) setPicking(false) }} compact />
          {property && <button type="button" onClick={() => setPicking(false)} className="mt-2 text-xs font-bold text-gray-400 hover:underline">Cancel</button>}
        </div>
      )}
      <div>
        <span className={label}>Size</span>
        <div className="mt-2 flex gap-1.5">
          <button type="button" onClick={() => set('displaySize', 'compact')} className={chip(size === 'compact')}>Small row</button>
          <button type="button" onClick={() => set('displaySize', 'large')} className={chip(size === 'large')}>Large with photo</button>
        </div>
      </div>
    </div>
  )
}

function TownSettings({ area, onChange }: { area: AreaCard | null; onChange: (area: AreaCard | null) => void }) {
  const ctx = useBlogContext()
  const cards: AreaCard[] | null = ctx === undefined ? null : ((ctx as any)?.area_cards || [])
  return (
    <div>
      <p className={note}>A photo-led section with the town&apos;s live market numbers, school districts and what&apos;s nearby, from your Areas. Picking a town again refreshes its numbers.</p>
      {!cards ? (
        <p className="mt-3 flex items-center gap-2 text-xs font-bold text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading your towns...</p>
      ) : cards.length === 0 ? (
        <p className="mt-3 text-xs font-bold text-gray-500">No towns yet. Add the towns you serve in IDX, Areas, then come back.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {cards.map(c => {
            const on = area?.slug === c.slug
            return (
              <motion.button key={c.slug} type="button" whileTap={{ scale: 0.97 }} onClick={() => onChange(c)} className={`overflow-hidden rounded-xl border text-left ${on ? 'border-[#C9A24D] shadow-[0_0_0_3px_rgba(201,162,77,.2)]' : 'border-gray-200 dark:border-white/10'}`}>
                <span className="block aspect-[16/9] bg-cover bg-center" style={{ backgroundImage: c.photo ? `url(${resolveMediaUrl(c.photo)})` : 'linear-gradient(135deg,#111827,#2a2218)' }} />
                <span className="flex items-center gap-1 px-2.5 py-2 text-xs font-black text-[#111827] dark:text-white">{on && <Check className="h-3.5 w-3.5 text-[#C9A24D]" />}<span className="truncate">{c.name}{c.state ? `, ${c.state}` : ''}</span></span>
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const money = (n?: number | null) => (n ? `$${Math.round(n).toLocaleString()}` : '')

function HomesRowSettings({ data, set }: { data: any; set: (k: string, v: any) => void }) {
  const ctx = useBlogContext()
  const kind: 'sales' | 'listings' = data.kind === 'listings' ? 'listings' : 'sales'
  const chosen: BlogAiPropertyRef[] = data.properties || []
  const all: BlogAiPropertyRef[] | null = ctx === undefined ? null : ((kind === 'sales' ? ctx?.recent_sales : ctx?.listings) || [])
  const has = (p: BlogAiPropertyRef) => chosen.some(c => (c.id && c.id === p.id) || c.address === p.address)
  const toggle = (p: BlogAiPropertyRef) => set('properties', has(p) ? chosen.filter(c => !((c.id && c.id === p.id) || c.address === p.address)) : [...chosen, p].slice(0, 6))
  // Homes already on the card that are no longer in the agent's list still show, so they can be taken off.
  const extra = all ? chosen.filter(c => !all.some(p => (p.id && p.id === c.id) || p.address === c.address)) : []
  return (
    <div className="space-y-3">
      <Field title="Title" value={data.title || ''} onChange={v => set('title', v)} placeholder={kind === 'sales' ? 'Recent Sales in the Area' : 'Homes for Sale'} />
      <div>
        <span className={label}>{kind === 'sales' ? 'Your sales to show' : 'Your listings to show'} · {chosen.length} of 6</span>
        {!all ? (
          <p className="mt-2 flex items-center gap-2 text-xs font-bold text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
        ) : all.length + extra.length === 0 ? (
          <p className={`mt-2 ${note}`}>{kind === 'sales' ? 'No sales on your Agent Hub yet.' : 'No active listings found.'}</p>
        ) : (
          <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {[...extra, ...all].map(p => {
              const on = has(p)
              return (
                <button key={p.id || p.address} type="button" onClick={() => toggle(p)} className={`flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/10' : 'border-gray-200 dark:border-gray-700'}`}>
                  <span className="h-10 w-14 shrink-0 rounded-lg bg-gray-100 bg-cover bg-center dark:bg-gray-800" style={p.image_url ? { backgroundImage: `url(${resolveMediaUrl(p.image_url)})` } : undefined} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-[#111827] dark:text-white">{p.address}</span>
                    <span className="block truncate text-[11px] font-semibold text-gray-500">{[p.city, money(p.price)].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${on ? 'bg-[#C9A24D] text-[#111827]' : 'border border-gray-300 dark:border-gray-600'}`}>{on && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                </button>
              )
            })}
          </div>
        )}
        <p className={`mt-2 ${note}`}>Real homes from your account only: addresses, prices and photos can&apos;t be typed in here.</p>
      </div>
    </div>
  )
}

function VideosSettings({ data, set }: { data: any; set: (k: string, v: any) => void }) {
  const ctx = useBlogContext()
  const chosen: { id?: string; url: string; title?: string; image?: string | null }[] = data.videos || []
  const all = ctx === undefined ? null : (ctx?.videos || [])
  const has = (url: string) => chosen.some(c => c.url === url)
  const extra = all ? chosen.filter(c => !all.some(v => v.url === c.url)) : []
  const rows = [...extra.map(c => ({ id: c.id || c.url, url: c.url, title: c.title || 'Video', image: c.image })), ...(all || [])]
  return (
    <div className="space-y-3">
      <Field title="Title" value={data.title || ''} onChange={v => set('title', v)} placeholder="Videos about the area" />
      <div>
        <span className={label}>Your videos to show · {chosen.length}</span>
        {!all ? (
          <p className="mt-2 flex items-center gap-2 text-xs font-bold text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
        ) : rows.length === 0 ? (
          <p className={`mt-2 ${note}`}>No videos on your Agent Hub yet. Add them there, or use a YouTube video section for one link.</p>
        ) : (
          <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {rows.map(v => {
              const on = has(v.url)
              return (
                <button key={v.url} type="button" onClick={() => set('videos', on ? chosen.filter(c => c.url !== v.url) : [...chosen, { id: v.id, url: v.url, title: v.title, image: v.image || null }])} className={`flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/10' : 'border-gray-200 dark:border-gray-700'}`}>
                  <span className="min-w-0 flex-1 truncate text-xs font-black text-[#111827] dark:text-white">{v.title || 'Video'}</span>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${on ? 'bg-[#C9A24D] text-[#111827]' : 'border border-gray-300 dark:border-gray-600'}`}>{on && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function LeadFormSettings({ data, set, onUpdate }: { data: any; set: (k: string, v: any) => void; onUpdate: Update }) {
  const [forms, setForms] = useState<AgentFormConfig[] | null>(null)
  useEffect(() => {
    api.forms.getMine().then(res => setForms(res.success && res.data ? res.data.filter(f => f.form_type !== 'showcase_request') : []))
  }, [])
  const pick = (id: string) => {
    const f = forms?.find(x => x.id === id)
    if (!f) return
    onUpdate(b => ({ ...b, data: { ...(b.data || {}), formId: f.id, formSlug: f.slug, title: f.headline || f.title, description: f.subtitle || f.description || '' } }))
  }
  if (forms === null) return <p className="flex items-center gap-2 text-xs font-bold text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your forms...</p>
  if (forms.length === 0) return <p className={note}>You don&apos;t have any forms yet. Make one in Tools, Forms, then come back.</p>
  return (
    <div className="space-y-3">
      <div>
        <span className={label}>Which form</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {forms.map(f => <button key={f.id} type="button" onClick={() => pick(f.id)} className={chip(data.formId === f.id)}>{f.title}</button>)}
        </div>
      </div>
      {data.formId && (
        <>
          <Field title="Headline readers see" value={data.title || ''} onChange={v => set('title', v)} placeholder="Tell me what you need" />
          <Field title="One line under it" value={data.description || ''} onChange={v => set('description', v)} placeholder="What they'll get" />
          <Field title="Button words" value={data.label || ''} onChange={v => set('label', v)} placeholder="Start" max={24} />
        </>
      )}
      <p className={note}>Answers arrive in your Leads, like any other form.</p>
    </div>
  )
}
