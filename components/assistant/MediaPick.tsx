'use client'

import { Check, Clapperboard, Film, Lamp, Moon, Sofa, Sparkles } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { CardStep, OPTION_GRID, PickShell, StepDone, chip, useSteps } from './CardPickers'
import { PhotoDrop } from './PhotoDrop'

// AI Media on a card (owner, 11/05): Media Lab's new-project page as steps, with the photo as the
// preview. A photo dropped in the chat is already picked; one can be dropped right here too.
export type MediaPicks = {
  tool: string; effects: string[]; photo: string | null; photos: string[]; added: string[]
  room_type: string | null; style: string | null; staging_tag: string; enhancements: string[]; video_style: 'standard' | 'day_to_twilight'
}

export function mediaStart(payload: Record<string, any>): MediaPicks {
  const tool = payload?.tool || ''
  const first = payload?.photo || null
  return { tool, effects: tool && tool !== 'video' && tool !== 'cinematic' ? [tool] : [], photo: first, photos: first ? [first] : [], added: [], room_type: payload?.room_type || null, style: payload?.style || null,
    staging_tag: 'bottom-right', enhancements: payload?.enhancements || [], video_style: payload?.video_style === 'day_to_twilight' ? 'day_to_twilight' : 'standard' }
}

const TOOLS: [string, string, string, typeof Moon][] = [
  ['twilight', 'Twilight', 'Turns a day photo to dusk', Moon], ['lights_on', 'Lights on', 'Warms the house with its lights on', Lamp],
  ['virtual_staging', 'Virtual staging', 'Furnishes an empty room', Sofa], ['enhance', 'Enhance', 'Grass, sky, light and clean-up', Sparkles],
  ['video', 'AI video', 'Turns photos into a moving clip', Clapperboard],
  ['cinematic', 'Cinematic Video', 'A film-style tour with room captions', Film],
]
// Several photos, in order: AI video (up to 7). Cinematic Video uses every photo of the listing
// (its editor - right in the chat - asks the length and the rooms); with uploads, up to 40 to choose from.
const MULTI_MAX: Record<string, number> = { video: 7, cinematic: 40 }
const ROOMS: [string, string][] = [['living_room', 'Living room'], ['family_room', 'Family room'], ['primary_bedroom', 'Primary bedroom'], ['bedroom', 'Bedroom'], ['nursery', 'Nursery'], ['kitchen', 'Kitchen'],
  ['dining_room', 'Dining room'], ['office', 'Office'], ['basement', 'Basement'], ['bonus_room', 'Bonus room'], ['home_gym', 'Home gym'], ['sunroom', 'Sunroom'], ['entryway', 'Entryway'], ['patio', 'Patio']]
const STYLES: [string, string][] = [['modern', 'Modern'], ['transitional', 'Transitional'], ['luxury', 'Luxury'], ['traditional', 'Traditional']]
const FIXES: [string, string][] = [['grass', 'Greener grass'], ['sky', 'Blue sky'], ['brighten_exterior', 'Brighten the outside'], ['lighting', 'Better lighting'], ['polish', 'Overall polish'],
  ['yard_cleanup', 'Clean up the yard'], ['declutter', 'Remove cars, bins & clutter'], ['remove_furniture', 'Remove furniture']]
const TAGS: [string, string][] = [['bottom-right', 'Bottom right'], ['bottom-middle', 'Bottom middle'], ['off', 'No tag']]
const name = (list: [string, string][], id: string | null) => list.find(x => x[0] === id)?.[1]

export function MediaPick({ payload, picks, onPicks }: { payload: Record<string, any>; picks: MediaPicks; onPicks: (p: MediaPicks) => void }) {
  const video = picks.tool === 'video'
  const cinematic = picks.tool === 'cinematic'
  const multi = video || cinematic
  const max = MULTI_MAX[picks.tool] || 1
  const staging = picks.effects.includes('virtual_staging')
  const enhance = picks.effects.includes('enhance')
  const listing = (payload.listing?.photos || []) as string[]
  const library = Array.from(new Set([...picks.added, ...((payload.uploads || []) as string[]), ...listing]))
  const cineListing = cinematic && listing.length >= 2
  const ids = ['tool', ...(cineListing ? [] : ['photo']), ...(staging ? ['room'] : []), ...(enhance ? ['fixes'] : []), ...(video ? ['clip'] : [])]
  const steps = useSteps(ids, payload.tool ? (payload.photo ? ids[2] ?? null : 'photo') : undefined)
  const n = (id: string) => ids.indexOf(id) + 1
  const set = (p: Partial<MediaPicks>, step?: string) => { onPicks({ ...picks, ...p }); if (step) steps.picked(step) }
  const toolTap = (id: string) => {
    if (id === 'video' || id === 'cinematic') return set({ tool: id, effects: [], photos: picks.photos.slice(0, MULTI_MAX[id]) }, 'tool')
    // Photo edits stack, like the page: tap more than one.
    const effects = picks.effects.includes(id) ? picks.effects.filter(e => e !== id) : [...picks.effects, id]
    set({ tool: effects[0] || '', effects })
  }
  const photoTap = (src: string) => {
    if (!multi) return set({ photo: src }, 'photo')
    const one = video && picks.video_style === 'day_to_twilight'
    const photos = picks.photos.includes(src) ? picks.photos.filter(x => x !== src) : one ? [src] : picks.photos.length >= max ? picks.photos : [...picks.photos, src]
    set({ photos, photo: photos[0] || null })
  }
  const added = (url: string) => set(multi ? { added: [url, ...picks.added], photos: [...picks.photos, url].slice(0, max), photo: picks.photo || url } : { added: [url, ...picks.added], photo: url }, multi ? undefined : 'photo')
  const u = (payload.usage || {}) as Record<string, number | null>
  const est = video ? u.video_est_usd : u.image_est_usd
  const pct = est && u.month_ai_budget_usd ? Math.max(1, Math.round((est / u.month_ai_budget_usd) * 100)) : null
  const toolLine = cinematic ? 'Cinematic Video' : video ? 'AI video' : picks.effects.map(e => TOOLS.find(t => t[0] === e)?.[1]).join(' + ') || 'Pick one'
  const chosen = multi ? picks.photos : picks.photo ? [picks.photo] : []
  return (
    <PickShell testid="ai-media-pick" side={300} preview={
      <div className="overflow-hidden rounded-xl bg-[#111827] ring-1 ring-black/10" data-testid="ai-media-preview">
        <div className="relative aspect-[16/10]">
          {(picks.photo || (cineListing ? listing[0] : null)) ? <img src={resolveMediaUrl((picks.photo || listing[0])!)} alt="" className="h-full w-full object-cover" />
            : <div className="grid h-full place-items-center px-6 text-center text-[11px] font-bold text-white/60">Your photo shows here</div>}
          {picks.photo && !cinematic && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white">Before</span>}
          {cineListing && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white">{listing.length} photos</span>}
        </div>
        <p className="px-2.5 py-2 text-[11px] font-bold text-white/85">{toolLine}{cinematic ? ' · less than 1% of your AI' : pct != null ? ` · about ${pct}% of your AI` : ''}</p>
      </div>
    }>
      <CardStep id="tool" n={n('tool')} title="Make" summary={toolLine} steps={steps}>
        <div className={OPTION_GRID} data-testid="ai-media-tools">
          {TOOLS.map(([id, label, sub, Icon]) => {
            const on = id === 'video' ? video : id === 'cinematic' ? cinematic : picks.effects.includes(id)
            return (
              <button key={id} type="button" onClick={() => toolTap(id)} aria-pressed={on} data-testid={`ai-media-${id}`}
                className={`ohp-ai-press flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${on ? 'border-[#C9A24D] bg-[#fffaf0] dark:bg-[#C9A24D]/[0.08]' : 'border-gray-200 bg-white hover:border-[#C9A24D]/50 dark:border-zinc-700 dark:bg-zinc-900'}`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${on ? 'bg-[#C9A24D] text-white' : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>{on ? <Check className="h-3.5 w-3.5" strokeWidth={3.5} /> : <Icon className="h-3.5 w-3.5" />}</span>
                <span className="min-w-0"><span className="block text-[12.5px] font-bold text-[#111827] dark:text-white">{label}</span><span className="block text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">{sub}</span></span>
              </button>
            )
          })}
        </div>
        {!multi && picks.effects.length > 0 && <div className="mt-2"><StepDone onDone={() => steps.done('tool')} /></div>}
        {cineListing && (
          <p className="mt-2 rounded-lg bg-white px-2.5 py-2 text-[11px] font-semibold text-gray-600 ring-1 ring-black/5 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10" data-testid="ai-media-cine-note">
            Uses all {listing.length} photos of {payload.listing?.address || 'this home'}. Press <b>Make it</b> and its editor opens right here: pick the length and shape, tap the rooms to show, check each photo, then make it.
          </p>
        )}
      </CardStep>
      {!cineListing && <CardStep id="photo" n={n('photo')} title={multi ? 'Photos' : 'Photo'} summary={multi ? `${picks.photos.length} picked` : picks.photo ? 'Picked' : 'Pick one'} steps={steps}>
        {video && <p className="mb-1.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">Pick up to 7 sideways (landscape) photos, in the order they should play.</p>}
        {cinematic && <p className="mb-1.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">Pick the photos it can use (at least 2). Next, its editor opens right here to pick the length, the rooms to show and the look.</p>}
        <PhotoDrop compact onPhoto={p => added(p.url)} testid="ai-media-drop" />
        {library.length > 0 && (
          <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-1.5" data-testid="ai-media-photos">
            {library.map((src, i) => {
              const at = chosen.indexOf(src)
              return (
                <button key={src} type="button" onClick={() => photoTap(src)} aria-pressed={at >= 0} aria-label={`Photo ${i + 1}`}
                  className={`ohp-ai-press relative aspect-[4/3] overflow-hidden rounded-lg ring-1 ring-black/10 ${at >= 0 ? 'ring-2 ring-[#C9A24D] ring-offset-1 dark:ring-offset-zinc-900' : 'opacity-85 hover:opacity-100'}`}>
                  <img src={resolveMediaUrl(src)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {at >= 0 && <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#C9A24D] px-0.5 text-[9px] font-black text-white">{multi ? at + 1 : <Check className="h-2.5 w-2.5" strokeWidth={4} />}</span>}
                </button>
              )
            })}
          </div>
        )}
        {multi && <div className="mt-2"><StepDone onDone={() => steps.done('photo')} /></div>}
      </CardStep>}
      {staging && (
        <CardStep id="room" n={n('room')} title="Room & style" summary={[name(ROOMS, picks.room_type), name(STYLES, picks.style)].filter(Boolean).join(' · ') || 'Pick them'} steps={steps}>
          <div className="flex flex-wrap gap-1.5">{ROOMS.map(([id, l]) => <button key={id} type="button" onClick={() => set({ room_type: id })} aria-pressed={picks.room_type === id} className={chip(picks.room_type === id)}>{l}</button>)}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">{STYLES.map(([id, l]) => <button key={id} type="button" onClick={() => set({ style: id })} aria-pressed={picks.style === id} className={chip(picks.style === id)}>{l}</button>)}</div>
          <p className="mb-1 mt-2 text-[10.5px] font-bold text-gray-500 dark:text-zinc-400">&quot;Virtually staged&quot; tag on downloads</p>
          <div className="flex flex-wrap gap-1.5">{TAGS.map(([id, l]) => <button key={id} type="button" onClick={() => set({ staging_tag: id })} aria-pressed={picks.staging_tag === id} className={chip(picks.staging_tag === id)}>{l}</button>)}</div>
          <div className="mt-2"><StepDone onDone={() => steps.done('room')} /></div>
        </CardStep>
      )}
      {enhance && (
        <CardStep id="fixes" n={n('fixes')} title="What to fix" summary={picks.enhancements.length ? `${picks.enhancements.length} picked` : 'Pick some'} steps={steps}>
          <div className="flex flex-wrap gap-1.5">
            {FIXES.map(([id, l]) => { const on = picks.enhancements.includes(id); return <button key={id} type="button" onClick={() => set({ enhancements: on ? picks.enhancements.filter(x => x !== id) : [...picks.enhancements, id] })} aria-pressed={on} className={chip(on)}>{l}</button> })}
          </div>
          <div className="mt-2"><StepDone onDone={() => steps.done('fixes')} /></div>
        </CardStep>
      )}
      {video && (
        <CardStep id="clip" n={n('clip')} title="Video style" summary={picks.video_style === 'standard' ? 'Standard' : 'Day to twilight'} steps={steps}>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => set({ video_style: 'standard' })} aria-pressed={picks.video_style === 'standard'} className={chip(picks.video_style === 'standard')}>Standard camera move</button>
            <button type="button" onClick={() => set({ video_style: 'day_to_twilight', photos: picks.photos.slice(0, 1) })} aria-pressed={picks.video_style === 'day_to_twilight'} className={chip(picks.video_style === 'day_to_twilight')}>Day to twilight (one photo)</button>
          </div>
        </CardStep>
      )}
    </PickShell>
  )
}
