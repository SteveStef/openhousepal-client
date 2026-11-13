'use client'

import { announceChange } from '@/lib/dataChanged'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, Loader2, X, AlertTriangle, ArrowRight, Download } from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { isTouchPhone, saveFile } from '@/lib/mobileShare'
import { AIToolCallRef } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { luxeAllowedFor } from '@/lib/brandKit'
import { luxeUpgrade } from '@/lib/navAccess'
import { designProfileMissing, runClientAction } from './clientActions'
import LinkPreviewCard from './LinkPreviewCard'
import BrandPick, { type BrandPicks } from './BrandPick'
import { getTemplatesFor, isCompositionReady } from '@/lib/studio/designTemplates'
import { DESIGN_COLOR_MODES } from '@/lib/studio/designColors'
import { InvitePick, type InvitePicks } from './InvitePick'
import { BlogPick, type BlogPicks } from './BlogPick'
import { KitPick, kitStart, type KitPicks } from './KitPick'
import { DiscoveryPick, discoveryStart, type DiscoveryPicks } from './DiscoveryPick'
import { FollowupPick, followupStart, type FollowupPicks } from './FollowupPick'
import { InviteSendPick, inviteSendInitial, inviteSendLabel, type InviteSendPicks } from './InviteSendPick'
import { ShowcaseRemovePick, showcaseRemoveInitial, showcaseRemoveLabel, type ShowcaseRemovePicks } from './ShowcaseRemovePick'
import { WorkingScene, CardIcon, CardStep, StepDone, DesignLivePreview, BrandLivePreview, FormPick, OPTION_GRID, PickShell, useAgentBits, useDesignProperty, useSteps, type FormPicks } from './CardPickers'
import { joinColorMode, splitColorMode } from '@/lib/studio/designColors'
import { LUXE_METALS, LUXE_METAL_ORDER, type LuxeMetal } from '@/lib/luxeMetals'
import { SpotlightPick, spotlightStart, type SpotlightPicks } from './SpotlightPick'
import { CmaPick, cmaStart, type CmaPicks } from './CmaPick'
import { MediaPick, mediaStart, type MediaPicks } from './MediaPick'
import dynamic from 'next/dynamic'

// Cinematic Video's editor (and its video player) only loads when a chat actually starts one.
const CinematicEditor = dynamic(() => import('@/components/studio/media/cinematic/CinematicEditor'), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-zinc-800" />,
})

type Made = AIToolCallRef['made']

// A design the helper made, right in the chat: its picture (the same render as the Studio's own
// download) plus Download buttons - no trip to the Studio needed.
function MadeDesign({ made, fresh }: { made: NonNullable<Made> & { design_id?: string; is_print?: string }; fresh?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [png, setPng] = useState<Blob | null>(null)
  const [pdf, setPdf] = useState<Blob | null>(null)
  const [failed, setFailed] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  useEffect(() => {
    if (!made.design_id) return
    let live = true
    let objectUrl: string | null = null
    api.designs.exportPng(made.design_id).then(r => {
      if (!live) return
      if (r.success && r.blob) { objectUrl = URL.createObjectURL(r.blob); setUrl(objectUrl); setPng(r.blob) } else setFailed(true)
    })
    // A print design's PDF is made ahead too: on an iPhone the Share sheet only opens if the file is
    // ready the moment they tap.
    if (made.is_print) api.designs.exportPdf(made.design_id).then(r => { if (live && r.success && r.blob) setPdf(r.blob) })
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [made.design_id, made.is_print])
  const fileName = (made.title || 'design').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'design'
  // The site's one rule (lib/mobileShare): a phone gets the Share sheet (Save Image / Save to
  // Files), a computer a plain download (owner, 11/01).
  const downloadPdf = async () => {
    if (!made.design_id) return
    if (pdf) { await saveFile(pdf, `${fileName}.pdf`); return }
    setPdfBusy(true)
    const r = await api.designs.exportPdf(made.design_id)
    setPdfBusy(false)
    if (r.success && r.blob) { setPdf(r.blob); await saveFile(r.blob, `${fileName}.pdf`) }
  }
  return (
    <div ref={boxRef} className="mt-2.5">
      {/* A thumbnail, not the whole chat (owner, 10/30) - tap it for full size. */}
      <div className="flex justify-center rounded-xl border border-gray-100 bg-gray-50 p-2 dark:border-zinc-800 dark:bg-zinc-800/60">
        {url ? (
          <a href={url} target="_blank" rel="noopener" title="See it full size" className="block">
            <img src={url} alt={made.title || 'Your design'} className="ohp-ai-reveal block h-auto max-h-[220px] w-auto max-w-full rounded-lg shadow-sm"
                 onLoad={() => { if (fresh) boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }} />
          </a>
        ) : failed ? <div className="flex h-24 items-center justify-center px-4 text-center text-xs text-gray-400">Preview not ready - open it in the Studio.</div>
          : <div className="ohp-skeleton flex h-[180px] w-[180px] items-end justify-center rounded-lg pb-3"><span className="ohp-ai-shimmer text-xs font-semibold">Drawing your design...</span></div>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {url && (
          <a href={url} download={`${fileName}.png`} data-testid="ai-design-download"
            onClick={e => { if (png && isTouchPhone()) { e.preventDefault(); saveFile(png, `${fileName}.png`) } }}
            className="ohp-ai-card-in ohp-ai-press inline-flex min-w-[7rem] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#8b7355] px-3 py-2 text-sm font-bold text-white hover:bg-[#7a6549]">
            <Download className="h-4 w-4" /> Download
          </a>
        )}
        {made.is_print && (
          <button onClick={downloadPdf} disabled={pdfBusy} style={{ ['--i' as string]: 1 }} className="ohp-ai-card-in ohp-ai-press inline-flex min-w-[7rem] flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Print PDF
          </button>
        )}
      </div>
    </div>
  )
}

type DesignHome = { listing_key: string; address: string; photo?: string | null }
type LogoMode = 'personal' | 'team' | 'brokerage' | 'none'
type Look = { layout: string | null; colors: string; metal: LuxeMetal | null; photo: string | null; home: DesignHome | null; focal: { x: number; y: number } | null; logo?: LogoMode | null }

const stepChip = (on: boolean) => `ohp-ai-press rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${on
  ? 'border-[#111827] bg-[#111827] text-white dark:border-[#C9A24D] dark:bg-[#C9A24D] dark:text-[#111827]'
  : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')

// A design's look, picked right on the card before "Make it" (owner, 10/30: "I wasn't able to
// customize it") - the Studio's own steps: layout, colors (+ the Luxe finish on plans with Luxe, like the
// Studio's), and the photo (the listing's main one first). Home and photo fold once picked; layout,
// colors and the finish stay open to browse until their check (owner, 11/01). After the photo,
// everything folds and the picture grows - drag it to move the photo in its frame.
function DesignPick({ payload: given, look, onLook, luxeOk }: { payload: Record<string, any>; look: Look; onLook: (l: Look) => void; luxeOk: boolean }) {
  // Another of their homes picked on the card (owner, 11/01) - everything below follows it.
  const homes = (given.homes || []) as DesignHome[]
  const payload = look.home ? { ...given, listing_key: look.home.listing_key, address: look.home.address } : given
  const property = useDesignProperty(payload)
  const layouts = getTemplatesFor(payload.situation, payload.format).filter(t => isCompositionReady(t.composition))
    .filter((t, i, all) => all.findIndex(o => o.composition === t.composition) === i)
    .filter(t => luxeOk || t.composition !== 'luxe')
  const colors = DESIGN_COLOR_MODES.filter(c => luxeOk || c.id !== 'luxe')
  const layout = look.layout || layouts[0]?.composition || null
  const photos = Array.from(new Set([...(property?.photos || []), property?.image_url].filter(Boolean) as string[])).slice(0, 12)
  const photo = look.photo || photos[0] || null
  const ids = [homes.length > 1 && 'home', layouts.length > 1 && 'layout', 'colors', luxeOk && 'finish', 'logo', photos.length > 1 && 'photo'].filter(Boolean) as string[]
  // Which logo goes on it, or none (owner, 11/05) - the first one they have to start.
  const { kit } = useAgentBits()
  const logos = ([['personal', 'My logo', kit?.personal_logo_url], ['team', 'Team', kit?.team_logo_url], ['brokerage', 'Brokerage', kit?.brokerage_logo_url]] as const).filter(l => !!l[2])
  const logo: LogoMode = look.logo ?? logos[0]?.[0] ?? 'personal'
  // The home they named in chat is already picked - start on the next step (owner, 11/01).
  const steps = useSteps(ids, ids[0] === 'home' && given.listing_key ? ids[1] ?? null : undefined)
  const n = (id: string) => ids.indexOf(id) + 1
  const color = colors.find(c => c.id === look.colors) || colors[0]
  // every step folded (after the photo, or by hand): the picture grows and can be dragged
  const big = steps.open === null
  return (
    <PickShell testid="ai-design-pick" side={300} preview={
      /* how it will look, redrawn as they tap (owner, 11/01) - the Studio's own renderer */
      <DesignLivePreview payload={payload} layout={layout} colors={joinColorMode(look.colors, look.metal)} property={property} photo={photo}
        focal={look.focal} onFocal={f => onLook({ ...look, focal: f })} big={big} brandingMode={logo} />
    }>
      {homes.length > 1 && (
        <CardStep id="home" n={n('home')} title="Home" summary={(payload.address || '').split(',')[0]} steps={steps}>
          <div className={OPTION_GRID} data-testid="ai-design-homes">
            {homes.map(h => {
              const on = h.listing_key === payload.listing_key
              return (
                <button key={h.listing_key} type="button" aria-pressed={on}
                  onClick={() => { onLook({ ...look, home: h.listing_key === given.listing_key ? null : h, photo: null, focal: null }); steps.picked('home') }}
                  className={`ohp-ai-press flex items-center gap-2 rounded-xl border p-1.5 pr-2.5 text-left text-xs font-bold transition-colors ${on
                    ? 'border-[#111827] bg-white text-[#111827] ring-2 ring-[#C9A24D]/60 dark:border-[#C9A24D] dark:bg-zinc-900 dark:text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`}>
                  {h.photo ? <img src={resolveMediaUrl(h.photo)} alt="" className="h-8 w-11 shrink-0 rounded-md object-cover" /> : <span className="h-8 w-11 shrink-0 rounded-md bg-gray-100 dark:bg-zinc-800" />}
                  <span className="min-w-0 flex-1 truncate">{h.address}</span>
                  {on && <Check className="h-3.5 w-3.5 shrink-0 text-[#C9A24D]" strokeWidth={3} />}
                </button>
              )
            })}
          </div>
        </CardStep>
      )}
      {layouts.length > 1 && (
        <CardStep id="layout" n={n('layout')} title="Layout" summary={layout ? titleCase(layout) : ''} steps={steps}>
          <div className="flex flex-wrap gap-1.5">
            {layouts.map(t => (
              <button key={t.composition} type="button" onClick={() => onLook({ ...look, layout: t.composition })} aria-pressed={t.composition === layout}
                className={stepChip(t.composition === layout)}>{titleCase(t.composition)}</button>
            ))}
            <StepDone onDone={() => steps.done('layout')} />
          </div>
        </CardStep>
      )}
      <CardStep id="colors" n={n('colors')} title="Colors" steps={steps}
        summary={<span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: `linear-gradient(135deg, ${color.swatch[0]} 55%, ${color.swatch[1]} 55%)` }} />{color.id === 'brand' ? 'My brand' : color.label}</span>}>
        <div className="flex flex-wrap gap-1.5">
          {colors.map(c => {
            const on = c.id === look.colors
            return (
              <button key={c.id} type="button" onClick={() => onLook({ ...look, colors: c.id })} aria-pressed={on} title={c.description}
                className={`ohp-ai-press inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs font-bold transition-colors ${on
                  ? 'border-[#111827] bg-white text-[#111827] ring-2 ring-[#C9A24D]/60 dark:border-[#C9A24D] dark:bg-zinc-900 dark:text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`}>
                <span className="relative h-5 w-5 overflow-hidden rounded-full ring-1 ring-black/10" style={{ background: c.swatch[0] }}>
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-tl-full" style={{ background: c.swatch[1] }} />
                </span>
                {c.id === 'brand' ? 'My brand' : c.label}
              </button>
            )
          })}
          <StepDone onDone={() => steps.done('colors')} />
        </div>
      </CardStep>
      {luxeOk && (
        <CardStep id="finish" n={n('finish')} title="Luxe finish" summary={look.metal ? LUXE_METALS[look.metal].label : 'None'} steps={steps}>
          {/* The Studio's Luxe finish: the metal takes over every accent (the price, rules, buttons). */}
          <div className="flex flex-wrap gap-1.5">
            {([null, ...LUXE_METAL_ORDER] as (LuxeMetal | null)[]).map(m => (
              <button key={m || 'none'} type="button" onClick={() => onLook({ ...look, metal: m })} aria-pressed={look.metal === m}
                className={`${stepChip(look.metal === m)} inline-flex items-center gap-1.5`}>
                {m && <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ background: `linear-gradient(135deg, ${LUXE_METALS[m].light}, ${LUXE_METALS[m].deep})` }} />}
                {m ? LUXE_METALS[m].label : 'None'}
              </button>
            ))}
            <StepDone onDone={() => steps.done('finish')} />
          </div>
        </CardStep>
      )}
      <CardStep id="logo" n={n('logo')} title="Logo" summary={logo === 'none' || !logos.length ? 'None' : logos.find(l => l[0] === logo)?.[1] || 'None'} steps={steps}>
        {logos.length ? (
          <div className="flex flex-wrap gap-1.5" data-testid="ai-design-logo">
            {logos.map(([mode, label]) => (
              <button key={mode} type="button" onClick={() => { onLook({ ...look, logo: mode }); steps.picked('logo') }} aria-pressed={logo === mode} className={stepChip(logo === mode)}>{label}</button>
            ))}
            <button type="button" onClick={() => { onLook({ ...look, logo: 'none' }); steps.picked('logo') }} aria-pressed={logo === 'none'} className={stepChip(logo === 'none')}>No logo</button>
          </div>
        ) : <p className="text-[11.5px] font-semibold text-gray-500 dark:text-zinc-400">No logo yet. You can add one in Branding.</p>}
      </CardStep>
      {photos.length > 1 && (
        <CardStep id="photo" n={n('photo')} title="Photo" summary={photo === photos[0] ? 'Main photo' : `Photo ${photos.indexOf(photo || '') + 1}`} steps={steps}>
          <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-1 [scrollbar-width:thin]" data-testid="ai-design-photos">
            {photos.map((src, i) => {
              const on = src === photo
              return (
                <button key={src} type="button" onClick={() => {
                  onLook({ ...look, photo: i === 0 ? null : src, focal: src === photo ? look.focal : null })
                  // the photo's in: fold everything, grow the picture for framing (owner, 11/01)
                  window.setTimeout(() => steps.closeAll(), 350)
                }} aria-pressed={on}
                  aria-label={i === 0 ? 'Main photo' : `Photo ${i + 1}`}
                  className={`ohp-ai-press relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10 ${on ? 'ring-2 ring-[#C9A24D] ring-offset-1 dark:ring-offset-zinc-900' : 'opacity-80 hover:opacity-100'}`}>
                  <img src={resolveMediaUrl(src)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[8px] font-black uppercase tracking-wide text-white">Main</span>}
                  {on && <span className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#C9A24D] text-white"><Check className="h-2.5 w-2.5" strokeWidth={4} /></span>}
                </button>
              )
            })}
          </div>
        </CardStep>
      )}
    </PickShell>
  )
}

// Something the helper SET UP for the agent (10/30) - nothing happens until they tap Confirm.
// The server keeps the status, so a reload shows Done / Cancelled, never a second Confirm.
// Which cards can hand off to their feature's own editor (owner, 11/03), and how. Kits already open
// on the Open Houses page; sending, settings switches and follow-ups have no editor to hand off to.
type EditorHandoff = { mode: 'make' | 'move'; page: string; ask: string; button: string; href?: string }
function editorFor(action: AIToolCallRef): EditorHandoff | null {
  const make = (page: string, ask: string, button: string): EditorHandoff => ({ mode: 'make', page, ask, button })
  if (action.picker === 'form') return make('the Forms editor', 'Rather edit it in the full form editor?', 'Open in Forms')
  if (action.picker === 'spotlight') return make('the Spotlight editor', 'Rather finish it in the full Spotlight editor?', 'Open in Spotlight')
  if (action.picker === 'invite') return make('the invite editor', 'Rather finish it in the full invite editor?', 'Open in Invites')
  if (action.picker === 'cma') return make('your CMA', 'Rather work on it on the CMA page?', 'Open the CMA')
  if (action.client_action === 'create_design') return make('Studio', 'Rather fine-tune it in the Studio editor?', 'Open in Studio')
  if (action.tool === 'create_showcase') return make('Showcases', 'Rather set it up on the Showcases page?', 'Open in Showcases')
  if (action.picker === 'brand') return { mode: 'move', page: 'the Branding page', ask: 'Rather pick on the Branding page?', button: 'Open Branding', href: '/studio/brand-kit' }
  if (action.picker === 'blog') return { mode: 'move', page: 'the Blogs page', ask: 'Rather write it yourself on the Blogs page?', button: 'Open Blogs', href: '/studio/blogs?new=1' }
  if (action.picker === 'media') return { mode: 'move', page: 'Media Lab', ask: 'Rather make it in Media Lab?', button: 'Open Media Lab', href: '/studio/media/new' }
  return null
}

export default function ActionCard({ messageId, action }: { messageId: string; action: AIToolCallRef }) {
  const { user } = useAuth()
  const [state, setState] = useState<{ status: string; message: string; link: string; made?: Made; share?: AIToolCallRef['share'] }>({
    status: action.status || 'pending',
    message: action.result_message || '',
    link: action.result_link || '',
    made: action.made,
    share: action.share,
  })
  const [busy, setBusy] = useState<'confirm' | 'cancel' | null>(null)
  const [fresh, setFresh] = useState(false)  // made just now (not a reopened chat) - bring it into view
  const isDesign = action.client_action === 'create_design' && !!action.payload
  // What their profile still needs before any ad can be made - said up front, not after Make it (11/02)
  const [designMissing, setDesignMissing] = useState('')
  useEffect(() => {
    if (!isDesign || (action.status && action.status !== 'pending')) return
    let live = true
    designProfileMissing(String(action.payload?.format || ''), user).then(m => { if (live) setDesignMissing(m) })
    return () => { live = false }
  }, [isDesign, action.status, action.payload?.format, user])
  const [look, setLook] = useState<Look>({ layout: (action.payload?.layout as string) || null, colors: splitColorMode((action.payload?.colors as string) || 'light').base, metal: splitColorMode(action.payload?.colors as string).metal, photo: null, home: null, focal: null, logo: (action.payload?.branding_mode as LogoMode) || null })
  const luxeOk = luxeAllowedFor(user) || !!user?.is_admin
  // Branding: the card's swatches start from what they have now (payload.current) - sent as picks on Save.
  const cur = (action.payload?.current || {}) as Record<string, any>
  // A color they named ("navy") starts the card on it, not on what they have now (11/02)
  const askedColor = ((action.payload?.body || {}) as Record<string, any>).secondary_color as string | undefined
  const [brand, setBrand] = useState<BrandPicks>({ theme: cur.theme === 'luxe' ? 'luxe' : 'classic', metal: cur.metal || 'gold', dark: !!cur.dark, secondary_color: askedColor || cur.secondary_color || '#C9A24D',
    heading_font: cur.heading_font || 'serif', body_font: cur.body_font || 'sans', disclaimer_text: cur.disclaimer_text || '', qr: cur.qr?.choice || 'ohp', headshot: cur.attached_headshot || cur.headshot || null,
    logos: { ...(cur.logos || {}), ...(cur.attached_logo ? { [cur.attached_logo.kind]: cur.attached_logo.url } : {}) } })
  const isBrand = action.picker === 'brand'
  // Invites: the four designs, tapped on the card (owner's test, 11/01: it picked Classic for them)
  const isInvite = action.picker === 'invite'
  const inviteBody = ((action.payload as any)?.body || {}) as Record<string, any>
  const inviteOpts = ((action.payload as any)?.options || {}) as Record<string, any>
  const [invite, setInvite] = useState<InvitePicks>({
    kind: inviteOpts.kind_given ? inviteBody.invite_type : (inviteBody.invite_type || 'brokers_open'), listing_key: inviteOpts.homes?.[0]?.listing_key && !inviteBody.address ? inviteOpts.homes[0].listing_key : null,
    date: inviteBody.event_date || '', start_time: inviteBody.start_time || '', end_time: inviteBody.end_time || '',
    design: inviteBody.design || 'classic', luxe_metal: inviteOpts.luxe_ok && inviteOpts.brand_metal ? inviteOpts.brand_metal : null, accent_color: inviteOpts.brand_accent || null,
    title: inviteBody.title || '', subtitle: null, message: inviteBody.message || inviteOpts.presets?.[inviteBody.invite_type]?.message || '', place_name: inviteBody.place_name || '', address: inviteBody.address || '',
    audience: inviteOpts.presets?.[inviteBody.invite_type]?.audience || 'clients', motion: 'normal', extra_dates: [], questions: inviteOpts.presets?.[inviteBody.invite_type]?.questions || [],
    ...(inviteOpts.attached_cover ? { cover: inviteOpts.attached_cover } : {}) })
  // Spotlight: the look + color on a small front page; CMA: AI or manual; form: background + home (11/01)
  const isSpotlight = action.picker === 'spotlight'
  const [spot, setSpot] = useState<SpotlightPicks>(() => spotlightStart((action.payload || {}) as Record<string, any>))
  const isMedia = action.picker === 'media'
  const [media, setMedia] = useState<MediaPicks>(() => mediaStart((action.payload || {}) as Record<string, any>))
  const isCma = action.picker === 'cma'
  const [cmaAi, setCmaAi] = useState<boolean>(action.payload?.ai !== false)
  const [cmaMode, setCmaMode] = useState<string>((action.payload?.mode as string) === 'buyer' ? 'buyer' : 'listing')
  const [cma, setCma] = useState<CmaPicks>(() => cmaStart((action.payload || {}) as Record<string, any>))
  const isForm = action.picker === 'form'
  const isBlog = action.picker === 'blog'
  const isKit = action.picker === 'kit'
  const isInviteSend = action.picker === 'invite_send'
  const isDiscovery = action.picker === 'discovery'
  // A follow-up: every field changeable on the card (owner, 11/09)
  const isFollowup = action.picker === 'followup'
  const [fu, setFu] = useState<FollowupPicks>(() => followupStart(action.payload as Record<string, any>))
  const [disc, setDisc] = useState<DiscoveryPicks>(() => discoveryStart((action.payload || {}) as Record<string, any>))
  const [inviteSend, setInviteSend] = useState<InviteSendPicks>(() => inviteSendInitial(action.payload))
  // Removing homes from a Showcase (11/08): the checked homes go on Confirm.
  const isRemove = action.picker === 'showcase_remove'
  const [remove, setRemove] = useState<ShowcaseRemovePicks>(() => showcaseRemoveInitial(action.payload))
  const [kit, setKit] = useState<KitPicks>(() => kitStart((action.payload || {}) as Record<string, any>))
  const blogBody = ((action.payload as any)?.body || {}) as Record<string, string>
  const blogList = (k: string) => (Array.isArray((blogBody as any)[k]) ? (blogBody as any)[k] as string[] : [])
  const [blog, setBlog] = useState<BlogPicks>({ topic: blogBody.topic || '', goal: blogBody.goal || '', tone: blogBody.tone || 'warm', length: blogBody.length || 'standard',
    cta: blogBody.cta || 'how_can_i_help', audiences: blogList('audiences'), areas: blogList('areas'), spotlight: true,
    points: [], key_points: blogBody.key_points || '', personal_take: '', facts: '', sale_ids: [], listing_ids: [], video: null,
    theme: 'luxe', luxe_metal: 'gold', accent_color: null, category: '', cover: ((action.payload as any)?.options?.attached_cover as string) || null,
    agent_hub_visible: true, agent_hub_featured: false, idx_visible: true, use_signature_card: true })
  // A form card reopened later starts from the taps already made on it (saved as they go, below)
  const formDraft = ((action as any).draft_picks || null) as Partial<FormPicks> | null
  const [form, setForm] = useState<FormPicks>({ background_effects: formDraft?.background_effects ?? action.payload?.background_effects !== false,
    welcome_text_effects: formDraft?.welcome_text_effects ?? action.payload?.welcome_text_effects !== false,
    dark: formDraft?.dark !== undefined ? formDraft.dark : typeof action.payload?.dark === 'boolean' ? action.payload.dark as boolean : null,
    look: formDraft?.look ?? null,
    style: formDraft?.style !== undefined ? formDraft.style : (action.payload?.style as FormPicks['style']) ?? null,
    one_contact: formDraft?.one_contact ?? !!action.payload?.one_contact,
    first_last: formDraft?.first_last ?? !!action.payload?.first_last,
    after_mode: formDraft?.after_mode !== undefined ? formDraft.after_mode : (action.payload?.after_mode as string) || null,
    after_url: formDraft?.after_url ?? (action.payload?.after_url as string) ?? '',
    listing_key: formDraft && 'listing_key' in formDraft ? formDraft.listing_key ?? null : (action.payload?.listing_key as string) || null,
    questions: ((formDraft?.questions || (action.payload as any)?.questions || []) as any[]).map(q => ({ label: q.label, type: q.type, options: q.options, required: q.required, show_if: q.show_if, fields: q.fields })) })
  // A newer card for the same form (they asked for a change) greys this one out right away - the
  // server marks it replaced too, so a tap here would do nothing (ai_routes._replace_open_form_cards)
  const formTitle = String(action.payload?.title || '').trim().toLowerCase()
  useEffect(() => {
    if (!isForm || (action.status && action.status !== 'pending')) return
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as { id: string; title: string }
      if (d.id !== action.record_id && d.title === formTitle)
        setState(s => (s.status === 'pending' ? { ...s, status: 'replaced', message: 'Replaced by the updated card below.' } : s))
    }
    window.dispatchEvent(new CustomEvent('ohp-form-card', { detail: { id: action.record_id, title: formTitle } }))
    window.addEventListener('ohp-form-card', on)
    return () => window.removeEventListener('ohp-form-card', on)
  }, [isForm, action.status, action.record_id, formTitle])
  // ...so when they ask the helper to change question 5, it changes the list they're looking at (11/02)
  const formSaved = useRef(JSON.stringify(form))
  useEffect(() => {
    if (!isForm || state.status !== 'pending') return
    const now = JSON.stringify(form)
    if (now === formSaved.current) return
    const t = setTimeout(() => { formSaved.current = now; api.ai.saveActionDraft(action.record_id, messageId, form as unknown as Record<string, unknown>).catch(() => {}) }, 600)
    return () => clearTimeout(t)
  }, [form, isForm, state.status, action.record_id, messageId])
  const picks = isBrand ? brand : isInvite ? invite : isSpotlight ? spot : isCma ? { ai: cmaAi, mode: cmaMode, ...cma } : isForm ? form : isBlog ? blog : isInviteSend ? inviteSend : isRemove ? remove : isDiscovery ? disc : isFollowup ? fu : isMedia ? media : undefined
  // Finished on the server while this chat was open: the card follows (the chat reloads the message).
  useEffect(() => {
    if ((action.status === 'done' || action.status === 'failed') && (state.status === 'working' || state.status === 'running'))
      setState(st => ({ ...st, status: action.status as string, message: action.result_message || st.message, link: action.result_link || st.link, made: action.made || st.made }))
  }, [action.status, action.result_message, action.result_link, action.made, state.status])

  // The card's "What should change or be added?" line - its questions change in place (11/03)
  const reviseForm = async (instruction: string, at: number | null) => {
    const r = await api.ai.reviseFormCard(action.record_id, messageId, { instruction, at, picks: form as unknown as Record<string, unknown> })
    if (!r.success || !r.data) return { ok: false, message: r.error || r.message || "Couldn't make that change - try again." }
    const extra = r.data as { one_contact?: boolean; first_last?: boolean; changed?: boolean; style?: FormPicks['style']; dark?: boolean }
    if (extra.changed === false) return { ok: false, message: r.data.note }   // nothing really changed: never say it did
    const oneContact = extra.one_contact
    const next = { ...form, ...(typeof oneContact === 'boolean' ? { one_contact: oneContact } : {}), ...(typeof extra.first_last === 'boolean' ? { first_last: extra.first_last } : {}),
      ...(extra.style ? { style: extra.style } : {}), ...(typeof extra.dark === 'boolean' ? { dark: extra.dark } : {}),
      questions: r.data.questions.map(q => ({ label: q.label, type: q.type, options: q.options, required: q.required, show_if: (q as any).show_if, fields: (q as any).fields })) }
    formSaved.current = JSON.stringify(next)  // already saved on the card by the server
    setForm(next)
    return { ok: true, message: r.data.note, focus: r.data.focus, oneContact }
  }

  const act = async (kind: 'confirm' | 'cancel', extra?: Record<string, unknown>): Promise<{ status: string; link: string }> => {
    let end = { status: 'failed', link: '' }
    setBusy(kind)
    const r = kind === 'confirm'
      ? await api.ai.confirmAction(action.record_id, messageId, { ...(picks as Record<string, unknown> | undefined), ...extra })
      : await api.ai.cancelAction(action.record_id, messageId)
    const data = r.data as (typeof r.data & { client_action?: string; payload?: Record<string, unknown> }) | undefined
    if (r.success && data?.status === 'running' && data.client_action) {
      // Built here in the browser (a design), then recorded on the card.
      setState(st => ({ ...st, status: 'running', message: 'Making it...' }))
      const picked = data.client_action === 'build_open_house_kit' ? kit : data.client_action === 'create_design' ? { ...(look.layout ? { layout: look.layout } : {}), colors: joinColorMode(look.colors, look.metal), ...(look.logo ? { branding_mode: look.logo } : {}), ...(look.photo ? { photo: look.photo } : {}), ...(look.focal ? { focal: look.focal } : {}), ...(look.home ? { listing_key: look.home.listing_key, address: look.home.address } : {}) } : {}
      const out = await runClientAction(data.client_action, { ...(data.payload || {}), ...picked }, user)
      const saved = await api.ai.clientActionResult(action.record_id, messageId, out)
      setFresh(true)
      end = { status: saved.data?.status || (out.ok ? 'done' : 'failed'), link: saved.data?.result_link || out.link || '' }
      setState({ ...end, message: saved.data?.result_message || out.message, made: (saved.data as any)?.made || (out.made as Made) })
    } else if (r.success && r.data) {
      const made = (r.data as any).made as Made
      setFresh(true)
      end = { status: r.data.status || 'failed', link: r.data.result_link || '' }
      setState({ ...end, message: r.data.result_message || '', share: (r.data as any).share || null, made })
      // Same as the editor's Publish / Take down: drop the live page's cached copy, or a taken-down
      // Spotlight keeps showing (Next never replaces a cached page with the server's "not found").
      if (r.data.status === 'done' && action.tool === 'publish_spotlight') fetch('/api/website-property-sites/revalidate', { method: 'POST' }).catch(() => {})
    } else {
      setState({ status: 'failed', message: r.error || 'Something went wrong - nothing was changed.', link: '' })
    }
    if (end.status === 'done') announceChange()
    setBusy(null)
    return end
  }

  // "Rather do it in the full editor?" (owner, 11/03: every feature where it makes sense). 'make': the
  // card makes it as it is now, then its own editor opens. 'move': nothing is made here (Branding is
  // just a page of settings; a blog post would start a paid AI write) - the card closes so a tap later
  // can't overwrite what they do on the page, and the page opens.
  const editor = editorFor(action)
  const openInEditor = async () => {
    if (!editor) return
    if (editor.mode === 'move') {
      setBusy('cancel')
      await api.ai.cancelAction(action.record_id, messageId)
      setBusy(null)
      setState({ status: 'cancelled', message: `Moved to ${editor.page} - finish it there.`, link: editor.href || '' })
      window.dispatchEvent(new CustomEvent('ohp:navigate', { detail: editor.href }))
      return
    }
    // A Spotlight opened in its editor does its first-time setup there, in front of them.
    const end = await act('confirm', isSpotlight ? { editor: true } : undefined)
    if ((end.status === 'done' || end.status === 'working') && end.link) {
      setState(st => ({ ...st, message: `${action.tool === 'edit_form' ? 'Saved' : 'Made'} - it opened in ${editor.page}. Changes you make there are the real thing.` }))
      window.dispatchEvent(new CustomEvent('ohp:navigate', { detail: end.link }))
    }
  }

  const pending = state.status === 'pending'
  const cineId = state.status === 'done' && typeof state.link === 'string' ? (state.link.match(/^\/studio\/media\/motion\/([0-9a-f-]{8,})$/i)?.[1] ?? null) : null
  // Tapped the main button: the choices fold away and the card shows it working (owner, 11/01 - they
  // could keep tapping options already sent).
  const choosing = pending && busy !== 'confirm'
  const working = !!busy || state.status === 'running' || state.status === 'working'
  const iconState = working ? 'live' : state.status === 'done' ? 'done' : state.status === 'cancelled' || state.status === 'expired' || state.status === 'failed' || state.status === 'replaced' || state.status === 'stale' ? 'off' : 'idle'
  return (
    <div className={`ohp-ai-card-in mt-2 w-full rounded-2xl border bg-white p-2.5 sm:p-3.5 text-left shadow-sm transition-colors duration-300 dark:bg-zinc-900 ${
      state.status === 'done' ? 'border-emerald-200 dark:border-emerald-900/50' : working ? 'border-[#C9A24D] shadow-[0_8px_26px_-14px_rgba(201,162,77,.7)]' : 'border-[#C9A24D]/40 dark:border-[#C9A24D]/30'}`} data-testid="ai-action-card">
      <div className="flex items-center gap-3">
        <CardIcon tool={action.tool} state={iconState} />
        <p className="min-w-0 flex-1 text-sm font-bold leading-snug text-[#111827] dark:text-white">{action.title}</p>
      </div>
      {!!action.details?.length && (
        <ul className="mt-1.5 space-y-1">
          {/* a design's "Look:" line is the picker below (and the picture once made) - it could only go stale */}
          {action.details.filter((d, di) => !(isFollowup && choosing) && !(isRemove && state.status !== 'pending' && di > 0) && !(isCma && /^(Seller \/ Listing|Buyer \/ Offer) CMA$/.test(d)) && !(isDesign && (d.startsWith('Look:') || (d.startsWith('Home:') && (action.payload as any)?.homes?.length > 1))) && !(isInvite && d.startsWith('Design:')) && !(state.status === 'done' && d.startsWith('Made in your Studio'))).map((d, i) => (
            <li key={i} className="flex gap-1.5 text-xs leading-snug text-gray-600 dark:text-zinc-300">
              <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-[#C9A24D]" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{d}</span>
            </li>
          ))}
        </ul>
      )}
      {isDesign && choosing && designMissing && (
        <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300" data-testid="ai-design-missing">
          <p className="flex items-start gap-1.5"><AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> First add {designMissing} to your profile - every ad has to show them.</p>
          <Link href="/settings" className="group mt-1.5 inline-flex items-center gap-1 font-bold text-[#8b7355] dark:text-[#C9A24D]">
            Add them in Settings <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}
      {isDesign && choosing && <DesignPick payload={action.payload as Record<string, any>} look={look} onLook={setLook} luxeOk={luxeOk} />}
      {isBrand && choosing && (
        <PickShell testid="ai-brand-shell" side={300} preview={<BrandLivePreview picks={brand} />}>
          <BrandPick picks={brand} onPicks={setBrand} luxeOk={luxeAllowedFor(user)} upgradeLabel={luxeUpgrade(user?.plan_tier).label} notUsing={((action.payload as any)?.current?.not_using || []) as string[]} qrAllowed={!!cur.qr?.allowed} />
        </PickShell>
      )}
      {isSpotlight && choosing && <SpotlightPick payload={action.payload as Record<string, any>} picks={spot} onPicks={setSpot} />}
      {isCma && choosing && <CmaPick payload={action.payload as Record<string, any>} ai={cmaAi} onAi={setCmaAi} mode={cmaMode} onMode={setCmaMode} picks={cma} onPicks={setCma} />}
      {isMedia && choosing && <MediaPick payload={action.payload as Record<string, any>} picks={media} onPicks={setMedia} />}
      {editor && choosing && !isForm && (
        <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-[#faf7f0] px-2.5 py-2 ring-1 ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10" data-testid="ai-open-editor-bar">
          <p className="min-w-0 flex-1 text-[11.5px] font-semibold leading-snug text-gray-600 dark:text-zinc-300">{editor.ask}</p>
          <button type="button" onClick={openInEditor} disabled={!!busy || (isDesign && !!designMissing)} data-testid="ai-open-editor"
            className="ohp-ai-press inline-flex shrink-0 items-center gap-1 rounded-full bg-[#111827] px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-50 dark:bg-[#C9A24D] dark:text-[#111827]">
            {editor.button} <ChevronRight className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
        </div>
      )}
      {isForm && choosing && <FormPick payload={action.payload as Record<string, any>} picks={form} onPicks={setForm} onOpenEditor={openInEditor} onRevise={reviseForm} busy={!!busy} />}
      {isFollowup && choosing && <FollowupPick picks={fu} onPicks={setFu} />}
      {isDiscovery && choosing && <DiscoveryPick payload={action.payload as Record<string, any>} picks={disc} onPicks={setDisc} />}
      {isInviteSend && choosing && <InviteSendPick payload={action.payload as Record<string, any>} picks={inviteSend} onPicks={setInviteSend} />}
      {isRemove && choosing && <ShowcaseRemovePick payload={action.payload as Record<string, any>} picks={remove} onPicks={setRemove} />}
      {isKit && choosing && <KitPick payload={action.payload as Record<string, any>} picks={kit} onPicks={setKit} />}
      {isBlog && choosing && <BlogPick payload={action.payload as Record<string, any>} picks={blog} onPicks={setBlog} />}
      {isInvite && choosing && <InvitePick payload={action.payload as Record<string, any>} picks={invite} onPicks={setInvite} />}
      {/* a pick the server still needs ("Pick the day on the card first.") */}
      {choosing && state.message && <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300" data-testid="ai-card-need">{state.message}</p>}
      {action.warning && choosing && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> {action.warning}
        </p>
      )}
      {pending && busy === 'confirm' ? (
        <div className="ohp-ai-fade mt-3 rounded-lg bg-gray-50 px-2.5 py-2 dark:bg-zinc-800"><WorkingScene tool={action.tool} /></div>
      ) : pending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => act('confirm')}
            disabled={!!busy || (isInviteSend && !inviteSend.lead_ids.length) || (isRemove && !remove.property_ids.length) || (isFollowup && !fu.title.trim()) || (isDesign && !!designMissing)}
            data-testid="ai-card-confirm"
            className={`ohp-ai-press inline-flex min-w-[7rem] flex-auto items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-60 ${isRemove ? 'bg-rose-600 shadow-rose-600/30 hover:bg-rose-700' : 'bg-[#8b7355] shadow-[#8b7355]/30 hover:bg-[#7a6549]'}`}
          >
            {busy === 'confirm' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isInviteSend ? inviteSendLabel(inviteSend) : isRemove ? showcaseRemoveLabel(remove) : (action.confirm_label || 'Confirm')}
          </button>
          <button
            onClick={() => act('cancel')}
            disabled={!!busy}
            className="ohp-ai-press inline-flex flex-auto items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" /> Cancel
          </button>
        </div>
      ) : (
        <div key={state.status} className={`ohp-ai-fade mt-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold ${
          state.status === 'done' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
            : state.status === 'running' ? 'bg-gray-50 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300'
            : 'bg-gray-50 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300'
        }`}>
          {state.status === 'done' && <span className="ohp-ai-check mr-1 h-4 w-4 items-center justify-center rounded-full bg-emerald-500 align-[-3px] text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>}
          {state.status === 'running' || state.status === 'working'
            ? <WorkingScene tool={action.tool} message={state.status === 'working' ? state.message : undefined} />
            : state.message || 'Done.'}
          {state.status === 'done' && state.made?.kind === 'design' && <MadeDesign made={state.made as any} fresh={fresh} />}
          {state.status === 'done' && state.made?.kind === 'media' && (state.made as any).url && (
            (state.made as any).media === 'video'
              ? <video src={resolveMediaUrl((state.made as any).url)} controls playsInline className="mt-2 max-h-[260px] w-full rounded-lg bg-black" data-testid="ai-media-result" />
              : <a href={resolveMediaUrl((state.made as any).url)} target="_blank" rel="noopener" className="mt-2 block" title="See it full size"><img src={resolveMediaUrl((state.made as any).url)} alt="Your finished photo" className="ohp-ai-reveal max-h-[260px] w-auto max-w-full rounded-lg shadow-sm" data-testid="ai-media-result" /></a>
          )}
          {state.status === 'done' && state.share?.url && <LinkPreviewCard url={state.share.url} preview={state.share.preview} />}
          {(state.status === 'done' || state.status === 'working') && state.link && !cineId && (
            <Link href={state.link} className="group mt-1.5 flex items-center gap-1 font-bold text-[#8b7355] dark:text-[#C9A24D]">
              Open it <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      )}
      {/* Cinematic Video: its whole editor, right here in the chat (owner, 11/11). */}
      {/* data-wide lets the chat give this message its full desktop width (ChatThread). */}
      {cineId && <div className="mt-3" data-testid="ai-cinematic-editor" data-wide="yes"><CinematicEditor id={cineId} embedded /></div>}
    </div>
  )
}
