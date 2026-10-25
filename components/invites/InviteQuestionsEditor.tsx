'use client'

import { useState } from 'react'
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion'
import { AlignLeft, CheckSquare, ChevronDown, CircleDot, GripVertical, Hash, Plus, Sparkles, Trash2, Type, X } from 'lucide-react'
import type { InviteQuestion, InviteType } from '@/lib/invites'

// The RSVP questions - the same question shape the Forms use (id, type, label, options, required),
// pre-made for each kind of invite, and the agent can rename, reorder, remove, add pre-made ones
// from the bank, or write their own. Name, contact and "Will you be there?" are always asked.

const TYPES: { id: InviteQuestion['type']; label: string; icon: typeof Type }[] = [
  { id: 'select', label: 'Pick one', icon: CircleDot },
  { id: 'multi_select', label: 'Pick any', icon: CheckSquare },
  { id: 'short_text', label: 'Short answer', icon: Type },
  { id: 'long_text', label: 'Paragraph', icon: AlignLeft },
  { id: 'number', label: 'Number', icon: Hash },
]
const typeLabel = (t: InviteQuestion['type']) => TYPES.find(x => x.id === t)?.label || 'Short answer'

/** Ready-made questions the agent can drop in (the pre-made set for each type comes from the backend). */
export const QUESTION_BANK: (InviteQuestion & { for?: InviteType[] })[] = [
  { id: 'party', type: 'select', label: 'How many of you are coming?', options: ['Just me', '2', '3', '4', '5+'], required: true, role: 'guests' },
  { id: 'brokerage', type: 'short_text', label: 'Your brokerage', role: 'brokerage', placeholder: 'Brokerage name', for: ['brokers_open'] },
  { id: 'diet', type: 'multi_select', label: 'Any dietary needs?', options: ['None', 'Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Nut allergy', 'Other'] },
  { id: 'guests', type: 'short_text', label: 'Names of your guests', placeholder: 'So we can welcome them by name' },
  { id: 'plans', type: 'select', label: 'Are you looking to…', options: ['Buy', 'Sell', 'Buy and sell', 'Just curious'] },
  { id: 'timeline', type: 'select', label: 'When are you hoping to move?', options: ['0-3 months', '3-6 months', '6-12 months', 'Just looking'] },
  { id: 'buyers', type: 'select', label: 'Do you have buyers who might be a fit?', options: ['Yes', 'Maybe', 'Not right now'], for: ['brokers_open'] },
  { id: 'lunch', type: 'select', label: 'Will you stay for lunch?', options: ['Yes', 'No thanks'] },
  { id: 'kids', type: 'select', label: 'Bringing little ones?', options: ['No', 'Yes'] },
  { id: 'heard', type: 'select', label: 'How did you hear about this?', options: ['From you', 'A friend', 'Social media', 'A sign', 'Other'] },
  { id: 'notes', type: 'long_text', label: 'Anything else we should know?' },
]

const newId = () => `q${Math.random().toString(36).slice(2, 8)}`

export default function InviteQuestionsEditor({ type, value, onChange }: { type: InviteType; value: InviteQuestion[]; onChange: (q: InviteQuestion[]) => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const has = new Set(value.map(q => q.label.toLowerCase()))
  const bank = QUESTION_BANK.filter(q => (!q.for || q.for.includes(type)) && !has.has(q.label.toLowerCase()))
  const update = (id: string, patch: Partial<InviteQuestion>) => onChange(value.map(q => (q.id === id ? { ...q, ...patch } : q)))
  const remove = (id: string) => onChange(value.filter(q => q.id !== id))
  const add = (q: InviteQuestion) => {
    const ids = new Set(value.map(x => x.id))
    const id = ids.has(q.id) ? newId() : q.id
    onChange([...value, { ...q, id }])
    setOpenId(id)
    setAdding(false)
  }

  return (
    <div>
      <div className="mb-3 rounded-2xl border border-dashed border-[#C9A24D]/45 px-4 py-3 text-[13px] font-semibold text-gray-600 dark:text-gray-300">
        Every guest is asked <b>Will you be there?</b> (Yes · Maybe · Can&apos;t make it), their <b>name</b> and an <b>email or phone</b>{type !== 'brokers_open' && <>, and <b>whether they&apos;re a real estate agent</b> or <b>working with one</b> - so only real leads get a follow-up</>}. Below is everything else.
      </div>

      <Reorder.Group axis="y" values={value} onReorder={onChange} className="space-y-2">
        {value.map((q, i) => (
          <QuestionItem key={q.id} q={q} i={i} open={openId === q.id} setOpenId={setOpenId} update={update} remove={remove} />
        ))}
      </Reorder.Group>
      <AddQuestions count={value.length} bank={bank} adding={adding} setAdding={setAdding} add={add} />
    </div>
  )
}

function QuestionItem({ q, i, open, setOpenId, update, remove }: {
  q: InviteQuestion; i: number; open: boolean; setOpenId: (id: string | null) => void
  update: (id: string, patch: Partial<InviteQuestion>) => void; remove: (id: string) => void
}) {
          const controls = useDragControls()
          const Icon = TYPES.find(t => t.id === q.type)?.icon || Type
          return (
            <Reorder.Item value={q} dragListener={false} dragControls={controls} className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#141416]"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} data-testid="invite-question">
              <div className="flex items-center gap-2 p-2.5 pl-1.5">
                <span onPointerDown={e => controls.start(e)} className="grid h-10 w-7 shrink-0 cursor-grab touch-none place-items-center text-gray-300 active:cursor-grabbing" aria-label="Drag to reorder"><GripVertical className="h-4 w-4" /></span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#C9A24D]/12 text-[#8b6d2c] dark:text-[#e8c97a]"><Icon className="h-4 w-4" /></span>
                <button type="button" onClick={() => setOpenId(open ? null : q.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[14px] font-black text-[#111827] dark:text-white">{i + 1}. {q.label}</p>
                  <p className="truncate text-[11px] font-bold text-gray-400">{typeLabel(q.type)}{q.required ? ' · Required' : ''}{q.options?.length ? ` · ${q.options.length} choices` : ''}</p>
                </button>
                {/* The arrow opens it too (user, 10/24: only the bar did). */}
                <motion.button type="button" onClick={() => setOpenId(open ? null : q.id)} aria-label={open ? 'Close this question' : 'Edit this question'} aria-expanded={open}
                  animate={{ rotate: open ? 180 : 0 }} whileTap={{ scale: 0.9 }} data-testid="invite-question-toggle"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15"><ChevronDown className="h-4 w-4" /></motion.button>
              </div>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
                    <div className="space-y-3 border-t border-gray-100 bg-[#FAFAF7] p-3 dark:border-white/[0.06] dark:bg-[#0f0f11]">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Question</span>
                        <input value={q.label} onChange={e => update(q.id, { label: e.target.value })} maxLength={200}
                          className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px] font-semibold outline-none focus:border-[#C9A24D] dark:border-white/10 dark:bg-white/5 dark:text-white" />
                      </label>
                      <div>
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Answer type</span>
                        <div className="flex flex-wrap gap-1.5">
                          {TYPES.map(t => (
                            <button key={t.id} type="button" onClick={() => update(q.id, { type: t.id, options: t.id === 'select' || t.id === 'multi_select' ? (q.options?.length ? q.options : ['Yes', 'No']) : undefined })}
                              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-black transition ${q.type === t.id ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'border border-gray-200 bg-white text-gray-600 dark:border-white/10 dark:bg-transparent dark:text-gray-300'}`}>
                              <t.icon className="h-3.5 w-3.5" /> {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(q.type === 'select' || q.type === 'multi_select') && <OptionsEditor options={q.options || []} onChange={options => update(q.id, { options })} />}
                      <div className="flex items-center justify-between gap-2">
                        <button type="button" onClick={() => update(q.id, { required: !q.required })} className="flex items-center gap-2 text-[13px] font-bold text-gray-600 dark:text-gray-300">
                          <span className={`relative h-6 w-10 rounded-full transition-colors ${q.required ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-white/20'}`}>
                            <motion.span layout className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${q.required ? 'right-0.5' : 'left-0.5'}`} />
                          </span>
                          Required
                        </button>
                        <button type="button" onClick={() => remove(q.id)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-black text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10">
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Reorder.Item>
          )
}

function AddQuestions({ count, bank, adding, setAdding, add }: {
  count: number; bank: InviteQuestion[]; adding: boolean; setAdding: (fn: (v: boolean) => boolean) => void; add: (q: InviteQuestion) => void
}) {
  return (
    <div>
      {count === 0 && <p className="py-4 text-center text-sm font-semibold text-gray-400">No extra questions - guests just say yes, maybe or no.</p>}

      {count < 12 && (
        <div className="mt-3">
          <button type="button" onClick={() => setAdding(v => !v)} data-testid="invite-add-question"
            className={`flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3.5 text-[12px] font-black uppercase tracking-widest transition ${adding ? 'border-[#C9A24D] bg-[#C9A24D]/[0.07] text-[#7a5f22] dark:text-[#e8c97a]' : 'border-gray-300 text-gray-500 hover:border-[#C9A24D] hover:text-[#7a5f22] dark:border-white/15 dark:text-gray-400'}`}>
            {adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {adding ? 'Close' : 'Add a question'}
          </button>
          <AnimatePresence initial={false}>
            {adding && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-3 space-y-3">
                  {bank.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#a8843a]"><Sparkles className="h-3 w-3" /> Pre-made</p>
                      <div className="flex flex-wrap gap-1.5">
                        {bank.map(q => (
                          <button key={q.id} type="button" onClick={() => add({ id: q.id, type: q.type, label: q.label, options: q.options, required: q.required, role: q.role, placeholder: q.placeholder })}
                            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#C9A24D]/35 bg-[#C9A24D]/[0.06] px-3 text-left text-[12px] font-bold text-[#5c4a22] transition hover:border-[#C9A24D] dark:text-[#e8c97a]">
                            <Plus className="h-3 w-3 shrink-0" /> {q.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Or write your own</p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                      {TYPES.map(t => (
                        <button key={t.id} type="button" onClick={() => add({ id: newId(), type: t.id, label: t.id === 'select' ? 'Pick one' : t.id === 'multi_select' ? 'Pick any that apply' : 'Your question', options: t.id === 'select' || t.id === 'multi_select' ? ['Option 1', 'Option 2'] : undefined })}
                          className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border border-gray-200 bg-white text-[11px] font-black text-gray-600 transition hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                          <t.icon className="h-4 w-4 text-[#C9A24D]" /> {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (o: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const addOne = () => { const v = draft.trim(); if (v && !options.includes(v) && options.length < 20) onChange([...options, v]); setDraft('') }
  return (
    <div>
      <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Choices</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o, i) => (
          <span key={`${o}-${i}`} className="inline-flex h-9 items-center gap-1 rounded-full border border-gray-200 bg-white pl-3 pr-1 text-[12px] font-bold text-[#111827] dark:border-white/10 dark:bg-white/5 dark:text-white">
            <input value={o} onChange={e => onChange(options.map((x, k) => (k === i ? e.target.value : x)))} className="w-[max(3ch,calc(var(--l)*1ch))] bg-transparent outline-none" style={{ ['--l' as string]: String(Math.min(28, o.length + 1)) }} />
            <button type="button" onClick={() => onChange(options.filter((_, k) => k !== i))} aria-label={`Remove ${o}`} className="grid h-7 w-7 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-white/10"><X className="h-3.5 w-3.5" /></button>
          </span>
        ))}
        <span className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-gray-300 pl-3 pr-1 dark:border-white/15">
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOne() } }} placeholder="Add a choice" className="w-28 bg-transparent text-[12px] font-bold outline-none dark:text-white" />
          <button type="button" onClick={addOne} aria-label="Add choice" className="grid h-7 w-7 place-items-center rounded-full bg-[#C9A24D] text-white"><Plus className="h-3.5 w-3.5" /></button>
        </span>
      </div>
    </div>
  )
}
