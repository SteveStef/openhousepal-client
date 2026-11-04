'use client'

import { Check, Lock, QrCode } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { CardStep, OPTION_GRID, PickShell, StepDone, useSteps } from './CardPickers'

// An Open House Kit from the chat (owner, 11/01: the core feature it couldn't do). The kit maker's own
// choices as steps - which home, the cover photo, the kit's pieces, what happens after a guest signs
// in - over a small live preview of the flyer's cover. "Build my kit" runs the Opens page's maker with
// them (clientActions build_open_house_kit) and stops on Review & Save.
export type KitHome = { listing_key: string; address: string; street: string; city: string; lat?: number | null; lng?: number | null; price?: number | null; photos: string[]; own?: boolean }
export type KitPicks = {
  listing_key: string; cover: string | null; similar: boolean; cheatSheet: boolean
  autoShowcase: boolean; guestPass: boolean; followupsMode: 'on' | 'no_calendar' | 'off'
}

/** The card's first picks: the home the chat named (else their newest listing); at their own listing
 *  Similar Homes and guest Showcases start off, like the kit maker. */
export function kitStart(payload: Record<string, any>): KitPicks {
  const homes = (payload.homes || []) as KitHome[]
  const h = homes.find(x => x.listing_key === payload.listing_key) || homes[0]
  return { listing_key: h?.listing_key || '', cover: null, similar: !h?.own, cheatSheet: true, autoShowcase: !h?.own, guestPass: true, followupsMode: 'on' }
}

const money = (n?: number | null) => (n ? (n >= 1e6 ? `$${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : `$${Math.round(n / 1000)}K`) : '')

function Row({ on, round, locked, onClick, children, sub }: { on: boolean; round?: boolean; locked?: boolean; onClick?: () => void; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <button type="button" role={round ? 'radio' : 'checkbox'} aria-checked={on} disabled={locked} onClick={onClick}
      className={`ohp-ai-press flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${on
        ? 'border-[#C9A24D] bg-[#fffaf0] dark:border-[#C9A24D]/70 dark:bg-[#C9A24D]/[0.08]'
        : 'border-gray-200 bg-white hover:border-[#C9A24D]/50 dark:border-zinc-700 dark:bg-zinc-900'} ${locked ? 'cursor-default opacity-80' : ''}`}>
      <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center border-2 ${round ? 'rounded-full' : 'rounded-[5px]'} ${on ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : 'border-gray-300 dark:border-zinc-600'}`}>
        {on && (locked ? <Lock className="h-2.5 w-2.5" strokeWidth={3} /> : <Check className="h-3 w-3" strokeWidth={4} />)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-bold leading-snug text-[#111827] dark:text-white">{children}</span>
        {sub && <span className="block text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">{sub}</span>}
      </span>
    </button>
  )
}

export function KitPick({ payload, picks, onPicks }: { payload: Record<string, any>; picks: KitPicks; onPicks: (p: KitPicks) => void }) {
  const homes = (payload.homes || []) as KitHome[]
  const home = homes.find(h => h.listing_key === picks.listing_key) || homes[0]
  const photos = home?.photos || []
  const cover = picks.cover && photos.includes(picks.cover) ? picks.cover : photos[0] || null
  const ids = [...(homes.length > 1 ? ['home'] : []), ...(photos.length > 1 ? ['cover'] : []), 'pieces', 'guests']
  // The home the chat named is already picked - start on the photo (like the design card).
  const steps = useSteps(ids, ids[0] === 'home' && payload.listing_key ? ids[1] : undefined)
  const n = (id: string) => ids.indexOf(id) + 1
  const set = (p: Partial<KitPicks>) => onPicks({ ...picks, ...p })
  const pieces = ['Sign-in QR', 'Flyer', picks.similar && 'Similar Homes', picks.cheatSheet && 'Cheat Sheet'].filter(Boolean) as string[]
  const after = [picks.autoShowcase && 'Showcases', picks.guestPass && 'Guest Pass', picks.followupsMode !== 'off' && 'Follow-ups'].filter(Boolean) as string[]
  return (
    <PickShell testid="ai-kit-pick" side={280} preview={home ? (
      /* the flyer's cover, redrawn as they pick */
        <div className="relative mx-auto aspect-[4/3] w-full max-w-[260px] overflow-hidden rounded-xl bg-[#111827] shadow-[0_14px_30px_-16px_rgba(0,0,0,.6)] ring-1 ring-black/10" data-testid="ai-kit-preview">
          {cover && <img key={cover} src={resolveMediaUrl(cover)} alt="" className="ohp-ai-fade absolute inset-0 h-full w-full object-cover" />}
          <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[#C9A24D] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#111827]">Open house</span>
          <span className="absolute bottom-2.5 left-2.5 right-12 min-w-0">
            <span className="block truncate font-serif text-[15px] font-black leading-tight text-white">{home.street || home.address.split(',')[0]}</span>
            <span className="block truncate text-[10.5px] font-semibold text-white/80">{[home.city, money(home.price)].filter(Boolean).join(' · ')}</span>
          </span>
          <span className="absolute bottom-2.5 right-2.5 grid h-8 w-8 place-items-center rounded-lg bg-white text-[#111827] shadow"><QrCode className="h-5 w-5" /></span>
        </div>
    ) : undefined}>
      {homes.length > 1 && (
        <CardStep id="home" n={n('home')} title="Home" summary={home?.street} steps={steps}>
          <div className={OPTION_GRID} data-testid="ai-kit-homes">
            {homes.map(h => {
              const on = h.listing_key === picks.listing_key
              return (
                <button key={h.listing_key} type="button" aria-pressed={on}
                  onClick={() => { onPicks({ ...picks, listing_key: h.listing_key, cover: null, similar: !h.own, autoShowcase: !h.own }); steps.picked('home') }}
                  className={`ohp-ai-press flex w-full items-center gap-2.5 rounded-xl border p-1.5 pr-2.5 text-left transition-colors ${on
                    ? 'border-[#C9A24D] bg-[#fffaf0] dark:bg-[#C9A24D]/[0.08]' : 'border-gray-200 bg-white hover:border-[#C9A24D]/50 dark:border-zinc-700 dark:bg-zinc-900'}`}>
                  {h.photos[0] ? <img src={resolveMediaUrl(h.photos[0])} alt="" className="h-10 w-14 shrink-0 rounded-lg object-cover" /> : <span className="h-10 w-14 shrink-0 rounded-lg bg-gray-100 dark:bg-zinc-800" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold text-[#111827] dark:text-white">{h.street || h.address}</span>
                    <span className="block truncate text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">{[h.city, money(h.price), h.own ? 'Your listing' : 'Hosting'].filter(Boolean).join(' · ')}</span>
                  </span>
                  {on && <Check className="h-4 w-4 shrink-0 text-[#C9A24D]" strokeWidth={3} />}
                </button>
              )
            })}
          </div>
        </CardStep>
      )}
      {photos.length > 1 && (
        <CardStep id="cover" n={n('cover')} title="Cover photo" summary={cover === photos[0] ? 'Main photo' : `Photo ${photos.indexOf(cover || '') + 1}`} steps={steps}>
          {/* one row to swipe through - a grid took too much room (owner, 11/01); picking folds the step */}
          <div className="-mx-0.5 flex snap-x gap-1.5 overflow-x-auto px-0.5 pb-1 [scrollbar-width:thin]" data-testid="ai-kit-photos">
            {photos.map((src, i) => {
              const on = src === cover
              return (
                <button key={src} type="button" aria-pressed={on} aria-label={i === 0 ? 'Main photo' : `Photo ${i + 1}`} onClick={() => { set({ cover: i === 0 ? null : src }); steps.picked('cover') }}
                  className={`ohp-ai-press relative h-16 w-[5.5rem] shrink-0 snap-start overflow-hidden rounded-lg ring-1 ring-black/10 ${on ? 'ring-2 ring-[#C9A24D] ring-offset-1 dark:ring-offset-zinc-900' : 'opacity-85 hover:opacity-100'}`}>
                  <img src={resolveMediaUrl(src)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[8px] font-black uppercase text-white">Main</span>}
                  {on && <span className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#C9A24D] text-white"><Check className="h-2.5 w-2.5" strokeWidth={4} /></span>}
                </button>
              )
            })}
          </div>
        </CardStep>
      )}
      <CardStep id="pieces" n={n('pieces')} title="In the kit" summary={pieces.join(', ')} steps={steps}>
        <div className={OPTION_GRID}>
          <Row on locked sub="Guests scan it to sign in - every kit has it">QR sign-in sheet</Row>
          <Row on locked sub="With your cover photo and the home's details">Flyer</Row>
          <Row on={picks.similar} onClick={() => set({ similar: !picks.similar })} sub={home?.own ? 'Off at your own listing by default - homes like it nearby' : 'Homes like it nearby, picked for you'}>Similar Homes sheet</Row>
          <Row on={picks.cheatSheet} onClick={() => set({ cheatSheet: !picks.cheatSheet })} sub="Schools, taxes, what's nearby - for you while you host">Cheat Sheet</Row>
        </div>
        <div className="mt-2.5"><StepDone onDone={() => steps.done('pieces')} /></div>
      </CardStep>
      <CardStep id="guests" n={n('guests')} title="After they sign in" summary={after.join(', ') || 'Nothing'} steps={steps}>
        <div className={OPTION_GRID}>
          <Row on={picks.autoShowcase} onClick={() => set({ autoShowcase: !picks.autoShowcase })} sub="Guests without an agent get homes like this one, emailed as they come up">Build each guest a Showcase</Row>
          <Row on={picks.guestPass} onClick={() => set({ guestPass: !picks.guestPass })} sub="Their own page for this home - photos, details and a second-visit button">Guest Pass</Row>
        </div>
        <p className="mb-1.5 mt-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#C9A24D]">Follow-ups for each guest</p>
        <div className={OPTION_GRID}>
          {([['on', 'On', 'Added to Follow-ups and your calendar'], ['no_calendar', 'Not on my calendar', 'In Follow-ups only'], ['off', 'Off', 'No follow-ups for this open house']] as const).map(([id, name, sub]) => (
            <Row key={id} round on={picks.followupsMode === id} onClick={() => set({ followupsMode: id })} sub={sub}>{name}</Row>
          ))}
        </div>
        <div className="mt-2.5"><StepDone onDone={() => steps.done('guests')} /></div>
      </CardStep>
    </PickShell>
  )
}
