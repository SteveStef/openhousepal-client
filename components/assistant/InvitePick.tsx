'use client'

import { Check } from 'lucide-react'
import InviteCard from '@/components/invites/InviteCard'
import { resolveMediaUrl } from '@/lib/api-service'
import { BRAND_COLOR_GROUPS } from '@/lib/brandKit'
import { LUXE_METALS, LUXE_METAL_ORDER } from '@/lib/luxeMetals'
import { CardStep, useSteps } from './CardPickers'

// An invite made from the chat (owner, 11/01: "buttons with steps ... instead of so much text", the
// Luxe / Classic choice, and a mini preview): the Forms & Invites builder's own choices as taps -
// kind, which home, the day, the times, the design and the color - with the real card drawn small
// on top, redrawn as they tap. Nothing is made until Make it.
export type InvitePicks = {
  kind: string; listing_key: string | null; date: string; start_time: string; end_time: string
  design: string; luxe_metal: string | null; accent_color: string | null
}
type Home = { listing_key: string; address: string; city?: string; state?: string; image?: string | null; photos?: string[]; beds?: number; baths?: number; sqft?: number; price?: number }

const KINDS: [string, string][] = [['open_house', 'Open house'], ['brokers_open', "Broker's open"], ['client_event', 'Client event'], ['custom', 'Other event']]
const DESIGNS: [string, string, string][] = [
  ['classic', 'Classic', 'linear-gradient(135deg,#fbf7ee,#e9dcc0)'], ['garden', 'Garden', 'linear-gradient(135deg,#eef3e6,#9bb38a)'],
  ['midnight', 'Midnight', 'linear-gradient(135deg,#1b202b,#C9A24D)'], ['modern', 'Modern', 'linear-gradient(135deg,#ffffff,#111827)'],
]
const TIMES: [string, string][] = [['11:00', '13:00'], ['12:00', '14:00'], ['13:00', '15:00'], ['14:00', '16:00'], ['17:00', '19:00']]
const chip = (on: boolean) => `ohp-ai-press rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${on
  ? 'border-[#111827] bg-[#111827] text-white dark:border-[#C9A24D] dark:bg-[#C9A24D] dark:text-[#111827]'
  : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`
const hhmm = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 || 12; return m ? `${h12}:${String(m).padStart(2, '0')}` : `${h12}` + (ap ? ` ${ap}` : '') }
const range = (a: string, b: string) => `${hhmm(a).replace(/ (AM|PM)$/, '')}-${hhmm(b)}`
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function InvitePick({ payload, picks, onPicks }: { payload: Record<string, any>; picks: InvitePicks; onPicks: (p: InvitePicks) => void }) {
  const body = (payload.body || {}) as Record<string, any>
  const opts = (payload.options || {}) as { homes?: Home[]; host?: Record<string, string | null>; luxe_ok?: boolean; brand_accent?: string; brand_metal?: string | null; kind_given?: boolean }
  const homes = opts.homes || []
  const showHome = homes.length > 0 && (picks.kind === 'open_house' || picks.kind === 'brokers_open')
  const ids = ['kind', ...(showHome ? ['home'] : []), 'date', 'time', 'design', 'color']
  const steps = useSteps(ids)
  const n = (id: string) => ids.indexOf(id) + 1
  const home = homes.find(h => h.listing_key === picks.listing_key) || null
  const set = (patch: Partial<InvitePicks>, step?: string) => { onPicks({ ...picks, ...patch }); if (step) steps.picked(step) }

  // the next week's days as taps (the date box below takes any other day)
  const days = Array.from({ length: 8 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d })
  const dayLabel = (s: string) => { if (!s) return 'Pick a day'; const d = new Date(`${s}T12:00:00`); return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }
  const colors = BRAND_COLOR_GROUPS.flat().slice(0, 8)
  const isBrand = !picks.luxe_metal && (picks.accent_color || '').toLowerCase() === (opts.brand_accent || '').toLowerCase()
  const colorName = picks.luxe_metal ? `Luxe ${LUXE_METALS[picks.luxe_metal as 'gold'].label}` : isBrand ? 'My brand' : colors.find(c => c.color.toLowerCase() === (picks.accent_color || '').toLowerCase())?.label || 'Custom'

  // the real invite card, small, with what's picked so far
  const kindLabel = KINDS.find(k => k[0] === picks.kind)?.[1] || 'Event'
  const card = {
    ...body, ...(opts.host || {}),
    invite_type: picks.kind || 'client_event',
    title: body.title || home?.address || kindLabel,
    linked_property: home ? { ...home } : body.linked_property || null,
    address: home ? [home.address, home.city, home.state].filter(Boolean).join(', ') : body.address || null,
    place_name: home ? null : body.place_name || null,
    event_date: picks.date || null, start_time: picks.start_time || null, end_time: picks.end_time || null,
    design: picks.design, luxe_metal: picks.luxe_metal, accent_color: picks.luxe_metal ? LUXE_METALS[picks.luxe_metal as 'gold'].base : picks.accent_color || opts.brand_accent,
    cover_image_url: null, subtitle: null,
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-[#faf7f0] p-2.5 dark:bg-zinc-800/50" data-testid="ai-invite-pick">
      <div className="pointer-events-none mx-auto w-[150px]" data-testid="ai-invite-preview"><InviteCard data={card as any} width={150} shine={false} /></div>
      <CardStep id="kind" n={n('kind')} title="What kind" summary={kindLabel} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map(([id, label]) => <button key={id} type="button" onClick={() => set({ kind: id }, 'kind')} aria-pressed={picks.kind === id} className={chip(picks.kind === id)}>{label}</button>)}
        </div>
      </CardStep>
      {showHome && (
        <CardStep id="home" n={n('home')} title="Home" summary={home ? home.address : 'None'} steps={steps}>
          <div className="flex flex-col gap-1.5">
            {homes.map(h => {
              const on = h.listing_key === picks.listing_key
              return (
                <button key={h.listing_key} type="button" onClick={() => set({ listing_key: h.listing_key }, 'home')} aria-pressed={on}
                  className={`ohp-ai-press flex items-center gap-2 rounded-xl border p-1.5 pr-2.5 text-left text-xs font-bold transition-colors ${on
                    ? 'border-[#111827] bg-white text-[#111827] ring-2 ring-[#C9A24D]/60 dark:border-[#C9A24D] dark:bg-zinc-900 dark:text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`}>
                  {h.image ? <img src={resolveMediaUrl(h.image)} alt="" className="h-8 w-11 shrink-0 rounded-md object-cover" /> : <span className="h-8 w-11 shrink-0 rounded-md bg-gray-100 dark:bg-zinc-800" />}
                  <span className="min-w-0 flex-1 truncate">{h.address}{h.city ? `, ${h.city}` : ''}</span>
                  {on && <Check className="h-3.5 w-3.5 shrink-0 text-[#C9A24D]" strokeWidth={3} />}
                </button>
              )
            })}
            <button type="button" onClick={() => set({ listing_key: null }, 'home')} aria-pressed={!picks.listing_key} className={`${chip(!picks.listing_key)} self-start`}>Not one of my listings</button>
          </div>
        </CardStep>
      )}
      <CardStep id="date" n={n('date')} title="Day" summary={dayLabel(picks.date)} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {days.map(d => { const v = ymd(d); return (
            <button key={v} type="button" onClick={() => set({ date: v }, 'date')} aria-pressed={picks.date === v} className={chip(picks.date === v)}>
              {d.toLocaleDateString('en-US', { weekday: 'short' })} {d.getDate()}
            </button>
          ) })}
        </div>
        <label className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">
          Another day
          <input type="date" value={picks.date} min={ymd(new Date())} onChange={e => set({ date: e.target.value }, e.target.value ? 'date' : undefined)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </label>
      </CardStep>
      <CardStep id="time" n={n('time')} title="Time" summary={picks.start_time ? range(picks.start_time, picks.end_time || picks.start_time) : 'Pick a time'} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {TIMES.map(([a, b]) => { const on = picks.start_time === a && picks.end_time === b; return (
            <button key={a} type="button" onClick={() => set({ start_time: a, end_time: b }, 'time')} aria-pressed={on} className={chip(on)}>{range(a, b)}</button>
          ) })}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">
          <input type="time" step={900} value={picks.start_time} onChange={e => set({ start_time: e.target.value })} aria-label="Starts"
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          to
          <input type="time" step={900} value={picks.end_time} onChange={e => set({ end_time: e.target.value })} aria-label="Ends"
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </div>
      </CardStep>
      <CardStep id="design" n={n('design')} title="Design" summary={DESIGNS.find(d => d[0] === picks.design)?.[1]} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {DESIGNS.map(([id, label, swatch]) => (
            <button key={id} type="button" onClick={() => set({ design: id }, 'design')} aria-pressed={picks.design === id}
              className={`${chip(picks.design === id)} inline-flex items-center gap-1.5 !py-1 !pl-1`}>
              <span className="h-5 w-5 rounded-full ring-1 ring-black/10" style={{ background: swatch }} />{label}
            </button>
          ))}
        </div>
      </CardStep>
      <CardStep id="color" n={n('color')} title="Color" summary={colorName} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => set({ accent_color: opts.brand_accent || '#C9A24D', luxe_metal: opts.luxe_ok && opts.brand_metal ? opts.brand_metal : null }, 'color')}
            aria-pressed={isBrand} className={chip(isBrand)}>My brand</button>
          {opts.luxe_ok && LUXE_METAL_ORDER.map(m => (
            <button key={m} type="button" onClick={() => set({ luxe_metal: m, accent_color: null }, 'color')} aria-pressed={picks.luxe_metal === m}
              className={`${chip(picks.luxe_metal === m)} inline-flex items-center gap-1.5`}>
              <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ background: `linear-gradient(135deg, ${LUXE_METALS[m].light}, ${LUXE_METALS[m].deep})` }} />Luxe {LUXE_METALS[m].label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {colors.map(c => { const on = !picks.luxe_metal && (picks.accent_color || '').toLowerCase() === c.color.toLowerCase(); return (
            <button key={c.color} type="button" title={c.label} aria-label={c.label} aria-pressed={on} onClick={() => set({ accent_color: c.color, luxe_metal: null }, 'color')}
              className={`ohp-ai-press grid h-7 w-7 place-items-center rounded-full ring-1 ring-black/10 ${on ? 'ring-2 ring-[#111827] ring-offset-2 dark:ring-white dark:ring-offset-zinc-900' : ''}`} style={{ background: c.color }}>
              {on && <Check className="h-3.5 w-3.5 text-white drop-shadow" strokeWidth={3} />}
            </button>
          ) })}
        </div>
      </CardStep>
    </div>
  )
}
