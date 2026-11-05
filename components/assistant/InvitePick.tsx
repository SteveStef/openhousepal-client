'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import InviteCard from '@/components/invites/InviteCard'
import { resolveMediaUrl } from '@/lib/api-service'
import { BRAND_COLOR_GROUPS } from '@/lib/brandKit'
import { LUXE_METALS, LUXE_METAL_ORDER } from '@/lib/luxeMetals'
import { CardStep, OPTION_GRID, PickShell, StepDone, useSteps } from './CardPickers'
import { PhotoDrop } from './PhotoDrop'

// An invite made from the chat (owner, 11/01: "buttons with steps ... instead of so much text", the
// Luxe / Classic choice, and a mini preview): the Forms & Invites builder's own choices as taps -
// kind, which home, the day, the times, the design and the color - with the real card drawn small
// on top, redrawn as they tap. Nothing is made until Make it.
export type InvitePicks = {
  kind: string; listing_key: string | null; date: string; start_time: string; end_time: string
  design: string; luxe_metal: string | null; accent_color: string | null
  // the rest of the builder (owner, 11/05)
  title: string; subtitle: string | null; message: string; place_name: string; address: string; audience: string; motion: string
  cover?: string | null; extra_dates: { date: string; start: string; end: string }[]; questions: InviteQuestion[]
}
export type InviteQuestion = { id: string; type: string; label: string; options?: string[]; required?: boolean; role?: string | null; placeholder?: string; helper_text?: string }
const BANK: InviteQuestion[] = [
  { id: 'party', type: 'select', label: 'How many of you are coming?', options: ['Just me', '2', '3', '4', '5+'], required: true, role: 'guests' },
  { id: 'plans', type: 'select', label: 'Are you looking to...', options: ['Buy', 'Sell', 'Buy and sell', 'Just curious'] },
  { id: 'diet', type: 'multi_select', label: 'Any dietary needs?', options: ['None', 'Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Nut allergy', 'Other'] },
  { id: 'guests', type: 'short_text', label: 'Names of your guests' },
  { id: 'notes', type: 'long_text', label: 'Anything you would like us to know?' },
]
const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-[#C9A24D] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
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
  const opts = (payload.options || {}) as { homes?: Home[]; host?: Record<string, string | null>; luxe_ok?: boolean; brand_accent?: string; brand_metal?: string | null; kind_given?: boolean; presets?: Record<string, { audience: string; message: string; questions: InviteQuestion[] }> }
  const homes = opts.homes || []
  const showHome = homes.length > 0 && (picks.kind === 'open_house' || picks.kind === 'brokers_open')
  const hasHome = showHome && !!picks.listing_key
  const ids = ['kind', ...(showHome ? ['home'] : []), 'date', 'time', 'words', ...(hasHome ? [] : ['place']), 'cover', 'design', 'color', 'motion', 'questions']
  const steps = useSteps(ids)
  const n = (id: string) => ids.indexOf(id) + 1
  const home = homes.find(h => h.listing_key === picks.listing_key) || null
  const set = (patch: Partial<InvitePicks>, step?: string) => { onPicks({ ...picks, ...patch }); if (step) steps.picked(step) }
  // A new kind brings its own note and RSVP questions, unless they already changed the note.
  const presets = opts.presets || {}
  const setKind = (id: string) => {
    const was = presets[picks.kind], next = presets[id]
    set({ kind: id, questions: next?.questions || picks.questions, message: !picks.message || picks.message === was?.message ? next?.message || '' : picks.message }, 'kind')
  }
  const [ownQ, setOwnQ] = useState('')
  const pool = [...picks.questions, ...(presets[picks.kind]?.questions || []).filter(q => !picks.questions.some(x => x.id === q.id)), ...BANK.filter(q => !picks.questions.some(x => x.id === q.id) && !(presets[picks.kind]?.questions || []).some(x => x.id === q.id))]
  const toggleQ = (q: InviteQuestion) => set({ questions: picks.questions.some(x => x.id === q.id) ? picks.questions.filter(x => x.id !== q.id) : [...picks.questions, q].slice(0, 12) })
  const addQ = () => { const t = ownQ.trim(); if (t) { set({ questions: [...picks.questions, { id: `own${Date.now()}`, type: 'short_text', label: t.slice(0, 200) }].slice(0, 12) }); setOwnQ('') } }
  const addDay = () => { if (picks.extra_dates.length < 6) set({ extra_dates: [...picks.extra_dates, { date: '', start: picks.start_time, end: picks.end_time }] }) }

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
    cover_image_url: picks.cover === null ? null : picks.cover || home?.image || null, subtitle: picks.subtitle, message: picks.message, motion: picks.motion,
    ...(picks.title ? { title: picks.title } : {}), ...(!home ? { address: picks.address || null, place_name: picks.place_name || null } : {}),
  }
  const covers = Array.from(new Set([...(picks.cover ? [picks.cover] : []), ...(home?.photos || [])])).slice(0, 10)
  const coverSummary = picks.cover === null ? 'No photo' : picks.cover ? 'Picked' : home?.image ? "The home's photo" : 'No photo'

  return (
    <PickShell testid="ai-invite-pick" side={200} preview={
      <div className="pointer-events-none mx-auto w-[150px] origin-top group-data-[wide=yes]/pick:scale-[1.25] group-data-[wide=yes]/pick:mb-12" data-testid="ai-invite-preview"><InviteCard data={card as any} width={150} shine={false} /></div>
    }>
      <CardStep id="kind" n={n('kind')} title="What kind" summary={kindLabel} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map(([id, label]) => <button key={id} type="button" onClick={() => setKind(id)} aria-pressed={picks.kind === id} className={chip(picks.kind === id)}>{label}</button>)}
        </div>
        {picks.kind === 'custom' && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] font-bold text-gray-500 dark:text-zinc-400">Who you're inviting</span>
            {[['clients', 'Clients'], ['agents', 'Agents']].map(([id, l]) => <button key={id} type="button" onClick={() => set({ audience: id })} aria-pressed={picks.audience === id} className={chip(picks.audience === id)}>{l}</button>)}
          </div>
        )}
      </CardStep>
      {showHome && (
        <CardStep id="home" n={n('home')} title="Home" summary={home ? home.address : 'None'} steps={steps}>
          <div className={OPTION_GRID}>
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
        {picks.extra_dates.map((d, i) => (
          <div key={i} className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">
            Day {i + 2}
            <input type="date" value={d.date} min={ymd(new Date())} aria-label={`Day ${i + 2}`} onChange={e => set({ extra_dates: picks.extra_dates.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)) })}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
            <button type="button" aria-label={`Remove day ${i + 2}`} onClick={() => set({ extra_dates: picks.extra_dates.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {picks.date && picks.extra_dates.length < 6 && <button type="button" onClick={addDay} className={`${chip(false)} mt-2`} data-testid="ai-invite-add-day">+ Add another day</button>}
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
      <CardStep id="words" n={n('words')} title="Wording" summary={(picks.title || card.title || '').slice(0, 30)} steps={steps}>
        <input value={picks.title} onChange={e => set({ title: e.target.value })} maxLength={60} placeholder={String(card.title || 'Name of the event')} aria-label="Line 1" className={inputCls} />
        <input value={picks.subtitle ?? ''} onChange={e => set({ subtitle: e.target.value || null })} maxLength={60} placeholder="Line 2 (blank shows the town)" aria-label="Line 2" className={`${inputCls} mt-1.5`} />
        <textarea value={picks.message} onChange={e => set({ message: e.target.value })} maxLength={2000} rows={3} placeholder="A note from you" aria-label="A note from you" className={`${inputCls} mt-1.5 resize-none`} />
        <div className="mt-2"><StepDone onDone={() => steps.done('words')} /></div>
      </CardStep>
      {!hasHome && (
        <CardStep id="place" n={n('place')} title="Where" summary={picks.place_name || picks.address.split(',')[0] || 'Add it'} steps={steps}>
          <input value={picks.place_name} onChange={e => set({ place_name: e.target.value })} maxLength={140} placeholder="Name of the place (optional)" aria-label="Name of the place" className={inputCls} />
          <input value={picks.address} onChange={e => set({ address: e.target.value })} maxLength={300} placeholder="Address" aria-label="Address" className={`${inputCls} mt-1.5`} />
          <div className="mt-2"><StepDone onDone={() => steps.done('place')} /></div>
        </CardStep>
      )}
      <CardStep id="cover" n={n('cover')} title="Cover photo" summary={coverSummary} steps={steps}>
        <PhotoDrop compact testid="ai-invite-cover" onPhoto={p => set({ cover: p.url })} />
        <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-1.5" data-testid="ai-invite-covers">
          {covers.map((src, i) => { const on = (picks.cover ?? (picks.cover === null ? null : home?.image)) === src; return (
            <button key={src} type="button" onClick={() => set({ cover: src })} aria-pressed={on} aria-label={`Cover ${i + 1}`} className={`ohp-ai-press aspect-[4/3] overflow-hidden rounded-lg ring-1 ring-black/10 ${on ? 'ring-2 ring-[#C9A24D] ring-offset-1 dark:ring-offset-zinc-900' : 'opacity-85 hover:opacity-100'}`}>
              <img src={resolveMediaUrl(src)} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ) })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => set({ cover: null })} aria-pressed={picks.cover === null} className={chip(picks.cover === null)}>No photo</button>
          <StepDone onDone={() => steps.done('cover')} />
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
      <CardStep id="motion" n={n('motion')} title="Animation" summary={picks.motion === 'luxe' ? 'Cinematic' : 'Envelope'} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {[['normal', 'Envelope'], ['luxe', 'Cinematic']].map(([id, l]) => <button key={id} type="button" onClick={() => set({ motion: id }, 'motion')} aria-pressed={picks.motion === id} className={chip(picks.motion === id)}>{l}</button>)}
        </div>
      </CardStep>
      <CardStep id="questions" n={n('questions')} title="RSVP questions" summary={`${picks.questions.length} question${picks.questions.length === 1 ? '' : 's'}`} steps={steps}>
        <p className="mb-1.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">Will you be there, their name and how to reach them are always asked.</p>
        <div className={OPTION_GRID} data-testid="ai-invite-questions">
          {pool.map(q => { const on = picks.questions.some(x => x.id === q.id); return (
            <button key={q.id} type="button" role="switch" aria-checked={on} onClick={() => toggleQ(q)} className={`ohp-ai-press flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11.5px] font-bold transition-colors ${on ? 'border-[#C9A24D]/60 bg-white text-[#111827] dark:bg-zinc-900 dark:text-white' : 'border-gray-200 bg-white/50 text-gray-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400'}`}>
              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded ${on ? 'bg-[#C9A24D] text-white' : 'bg-gray-200 dark:bg-zinc-700'}`}>{on && <Check className="h-3 w-3" strokeWidth={3.5} />}</span>
              <span className="min-w-0">{q.label}</span>
            </button>
          ) })}
        </div>
        <div className="mt-2 flex gap-1.5">
          <input value={ownQ} onChange={e => setOwnQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQ() } }} maxLength={200} placeholder="Add your own question" aria-label="Add your own question" className={inputCls} />
          <button type="button" onClick={addQ} disabled={!ownQ.trim()} className={`${chip(false)} shrink-0 disabled:opacity-40`}>Add</button>
        </div>
      </CardStep>
    </PickShell>
  )
}
