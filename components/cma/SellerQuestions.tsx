'use client'

// Seller report, Analysis step (11/18): a few taps about the home from the agent who has been inside it.
// With no asking price, the comps can't tell a redone home from a dated one - in the free past-sales check a
// third of homes sold outside their comps' price range. "Next to these comps, this home is ..." is the one fact
// that fixes most of that; kitchen, baths and big items replaced are facts the AI writes from.
// Saved on report.subject.seller_answers (backend CmaSellerAnswers). Optional - nothing stops or nags. Locked
// with the comps once the AI has written the report (cma_service SELLER_ANSWERS_LOCKED_MESSAGE).
import { useEffect, useRef, useState } from 'react'
import { Camera, Check, ClipboardList, Lock, Sparkles } from 'lucide-react'
import type { CmaComparable, CmaReplacedItem, CmaRoomState, CmaSellerAnswers, CmaSellerPlacement } from '@/types'
import { normalizeImageUrl } from '@/lib/utils'

const PLACEMENTS: { id: CmaSellerPlacement, label: string, hint: string }[] = [
  { id: 'below_all', label: 'Rougher than all of them', hint: 'Needs more work than any of these' },
  { id: 'lower_half', label: 'Below the middle', hint: 'Plainer than most of them' },
  { id: 'upper_half', label: 'Above the middle', hint: 'Nicer than most of them' },
  { id: 'above_all', label: 'Nicer than all of them', hint: 'Better kept or redone than any of these' },
]
const ROOMS: { id: CmaRoomState, label: string }[] = [
  { id: 'original', label: 'Original or dated' },
  { id: 'updated', label: 'Updated' },
  { id: 'redone', label: 'Fully redone' },
  { id: 'not_sure', label: 'Not sure' },
]
const ITEMS: { id: CmaReplacedItem, label: string }[] = [
  { id: 'roof', label: 'Roof' }, { id: 'heating_cooling', label: 'Heating & AC' }, { id: 'windows', label: 'Windows' },
  { id: 'water_heater', label: 'Water heater' }, { id: 'electrical', label: 'Electrical' }, { id: 'plumbing', label: 'Plumbing' },
  { id: 'siding', label: 'Siding' }, { id: 'flooring', label: 'Flooring' },
]
const THIS_YEAR = new Date().getFullYear()

function chip(on: boolean, locked: boolean) {
  return `min-h-[44px] rounded-xl border px-3 py-2 text-left text-[13px] font-black transition-[border-color,background-color,transform] duration-150 ${
    locked ? 'cursor-default' : 'active:scale-[0.98]'} ${on
    ? 'border-[#C9A24D] bg-[#C9A24D]/12 text-[#111827] dark:text-white'
    : `border-gray-200 bg-white/70 text-gray-600 dark:border-gray-800 dark:bg-black/20 dark:text-gray-300 ${locked ? '' : 'hover:border-[#C9A24D]/60'}`}`
}

function YearBox({ value, onChange, locked, label }: { value?: number | null, onChange: (y: number | null) => void, locked: boolean, label: string }) {
  const [text, setText] = useState(value ? String(value) : '')
  useEffect(() => { setText(value ? String(value) : '') }, [value])
  return (
    <input
      inputMode="numeric" aria-label={label} placeholder="Year (optional)" disabled={locked} value={text}
      onChange={e => {
        const t = e.target.value.replace(/[^\d]/g, '').slice(0, 4)
        setText(t)
        const y = Number(t)
        if (t.length === 4 && y >= 1900 && y <= THIS_YEAR) onChange(y)
        else if (!t) onChange(null)
      }}
      className="h-11 w-36 rounded-xl border border-gray-200 bg-white px-3 text-base font-bold text-[#111827] outline-none focus:border-[#C9A24D] disabled:opacity-60 dark:border-gray-800 dark:bg-black/30 dark:text-white sm:text-sm"
    />
  )
}

export default function SellerQuestions({ answers, comps, askPlacement, locked, onChange, intro, suggested, askRooms, kept, onKeep }: {
  answers: CmaSellerAnswers | null | undefined
  comps: CmaComparable[]
  /** The "next to the comps" question - only for a home with no asking price (a listed home's price already says it). */
  askPlacement: boolean
  locked: boolean
  onChange: (next: CmaSellerAnswers) => void
  /** Replaces the line under the title. */
  intro?: string
  /** Two paths (11/19): what the AI's read of the photos suggests for the kitchen and baths. */
  suggested?: { kitchen?: CmaRoomState | null, baths?: CmaRoomState | null }
  /** Rooms the photos didn't show - the agent is asked. */
  askRooms?: ('kitchen' | 'baths')[]
  /** Rooms where the agent changed the AI's answer and confirmed it. */
  kept?: string[]
  onKeep?: (key: 'kitchen' | 'baths') => void
}) {
  const [a, setA] = useState<CmaSellerAnswers>(answers || {})
  const mine = useRef(false)
  useEffect(() => { if (!mine.current) setA(answers || {}); mine.current = false }, [answers])
  const set = (patch: Partial<CmaSellerAnswers>) => {
    if (locked) return
    const next = { ...a, ...patch }
    mine.current = true
    setA(next)
    onChange(next)
  }
  const replaced = a.replaced || []
  const has = (id: CmaReplacedItem) => replaced.some(r => r.item === id)
  const shown = comps.filter(c => c.is_included !== false).slice(0, 5)
  const answered = !!(a.placement || a.kitchen || a.baths || replaced.length)

  return (
    <section data-cma-seller-questions className="cma-card rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_16px_40px_-32px_rgba(17,24,39,0.5)] dark:border-gray-800 dark:bg-[#151517] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#d7b974]"><ClipboardList className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white">About this home</h2>
          <p className="mt-0.5 text-[13px] font-semibold leading-snug text-gray-500 dark:text-gray-400">
            {intro ?? <>You have been inside. The sales can&apos;t see condition{askPlacement ? ' - your answers here make the value much more accurate' : ' - your answers go into the write-up'}. A few taps, all optional.</>}
          </p>
        </div>
      </div>
      {locked && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-[#C9A24D]/35 bg-[#C9A24D]/5 px-3 py-2 text-xs font-bold text-[#111827] dark:text-white">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C9A24D]" />
          {answered ? 'Locked with the comps - the AI worked out the value from these answers.' : 'Locked with the comps once the AI wrote the report.'}
        </p>
      )}

      {askPlacement && (
        <div className="mt-5">
          <p className="text-sm font-black text-[#111827] dark:text-white">Next to the comps you picked, this home is…</p>
          <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Condition and finishes only. Size, age and lot are already adjusted for.</p>
          {shown.length > 0 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" aria-hidden>
              {shown.map((c, i) => (
                <div key={c.id} className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-white/5">
                  {(c.photo_url || c.photos?.[0]) && <img src={normalizeImageUrl(c.photo_url || c.photos?.[0])} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] font-black text-white">#{i + 1}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Next to the comps you picked, this home is">
            {PLACEMENTS.map(o => {
              const on = a.placement === o.id
              return (
                <button key={o.id} type="button" role="radio" aria-checked={on} disabled={locked && !on} onClick={() => set({ placement: on ? null : o.id })} className={chip(on, locked)}>
                  <span className="flex items-center gap-1.5">{on && <Check className="h-3.5 w-3.5 text-[#C9A24D]" />}{o.label}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400">{o.hint}</span>
                </button>
              )
            })}
          </div>
          <button type="button" role="radio" aria-checked={a.placement === 'not_sure'} disabled={locked && a.placement !== 'not_sure'}
            onClick={() => set({ placement: a.placement === 'not_sure' ? null : 'not_sure' })}
            className={`mt-2 ${chip(a.placement === 'not_sure', locked)} w-full sm:w-auto`}>
            Not sure - leave it to the sales
          </button>
        </div>
      )}

      {(['kitchen', 'baths'] as const).map(key => {
        const sug = suggested?.[key] || null
        const ask = !locked && !!askRooms?.includes(key) && !a[key]
        const differs = !locked && !!sug && !!a[key] && a[key] !== sug && !kept?.includes(key)
        const roomLabel = (id?: string | null) => ROOMS.find(r => r.id === id)?.label.toLowerCase() || ''
        return (
        <div key={key} data-cma-room={key} className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-[#111827] dark:text-white">{key === 'kitchen' ? 'Kitchen' : 'Bathrooms'}</p>
            {ask && (
              <span data-cma-room-ask className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                <Camera className="h-3 w-3" /> Not in the photos - please answer
              </span>
            )}
            {sug && a[key] === sug && !locked && (
              <span data-cma-room-ai className="inline-flex items-center gap-1 rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[11px] font-black text-[#8b7355] dark:text-[#e8c97a]">
                <Sparkles className="h-3 w-3" /> Filled in by the AI from the photos
              </span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ROOMS.map(o => {
              const on = a[key] === o.id
              return (
                <button key={o.id} type="button" aria-pressed={on} disabled={locked && !on}
                  onClick={() => set(on ? { [key]: null, [`${key}_year`]: null } : { [key]: o.id, ...(o.id === 'updated' || o.id === 'redone' ? {} : { [`${key}_year`]: null }) })}
                  className={chip(on, locked)}>
                  <span className="flex items-center gap-1.5">{on && <Check className="h-3.5 w-3.5 text-[#C9A24D]" />}{o.label}
                    {sug === o.id && !locked && <span className="ml-auto rounded bg-[#C9A24D]/20 px-1 text-[9px] font-black uppercase text-[#8b7355] dark:text-[#e8c97a]">AI</span>}
                  </span>
                </button>
              )
            })}
          </div>
          {differs && (
            <div data-cma-room-differs role="alert" className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
              The photos looked <span className="font-black">{roomLabel(sug)}</span>. Keep your answer, <span className="font-black">{roomLabel(a[key])}</span>?
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => onKeep?.(key)} className="min-h-[40px] rounded-lg bg-[#111827] px-3 text-[12px] font-black text-white dark:bg-white dark:text-[#111827]">Yes, keep mine</button>
                <button type="button" onClick={() => set({ [key]: sug, ...(sug === 'updated' || sug === 'redone' ? {} : { [`${key}_year`]: null }) })}
                  className="min-h-[40px] rounded-lg border border-amber-400 px-3 text-[12px] font-black text-amber-900 dark:text-amber-200">Use the AI&apos;s answer</button>
              </div>
            </div>
          )}
          {(a[key] === 'updated' || a[key] === 'redone') && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">When?</span>
              <YearBox label={`${key === 'kitchen' ? 'Kitchen' : 'Bathrooms'} year`} locked={locked} value={a[`${key}_year`]} onChange={y => set({ [`${key}_year`]: y })} />
            </div>
          )}
        </div>
        )
      })}

      <div className="mt-5">
        <p className="text-sm font-black text-[#111827] dark:text-white">Replaced in the last 15 years</p>
        <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Tap any that apply.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ITEMS.map(o => {
            const on = has(o.id)
            return (
              <button key={o.id} type="button" aria-pressed={on} disabled={locked && !on}
                onClick={() => set({ replaced: on ? replaced.filter(r => r.item !== o.id) : [...replaced, { item: o.id, year: null }] })}
                className={chip(on, locked)}>
                <span className="flex items-center gap-1.5">{on && <Check className="h-3.5 w-3.5 text-[#C9A24D]" />}{o.label}</span>
              </button>
            )
          })}
        </div>
        {replaced.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {replaced.map(r => (
              <div key={r.item} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 px-3 py-1.5 dark:border-gray-800">
                <span className="text-[13px] font-black text-[#111827] dark:text-white">{ITEMS.find(x => x.id === r.item)?.label}</span>
                <YearBox label={`${ITEMS.find(x => x.id === r.item)?.label} year`} locked={locked} value={r.year}
                  onChange={y => set({ replaced: replaced.map(x => (x.item === r.item ? { ...x, year: y } : x)) })} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
