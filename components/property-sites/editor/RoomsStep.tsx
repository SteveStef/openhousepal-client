'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Hand, Loader2, RefreshCw, ScanSearch, Sparkles, Trash2, Wand2 } from 'lucide-react'
import api from '@/lib/api-service'
import ChaptersEditor, { CHAPTER_TYPE_LABELS } from '@/components/property-sites/ChaptersEditor'
import MonthlyAiUsageMeter from '@/components/MonthlyAiUsageMeter'
import type { PropertyWebsiteChapter } from '@/types'

// The editor's "Room by room" step. Sells the idea first (a live mock made from the agent's own
// photos), then one click has a small, cheap vision model sort the listing photos, pick the 3-4
// spaces that sell this home and write a few lines for each - no manual dragging. Hand editor below.
export default function RoomsStep({ siteId, photos, chapters, onChange, description, percent, onSpent }: {
  siteId: string
  photos: string[]
  chapters: PropertyWebsiteChapter[]
  onChange: (c: PropertyWebsiteChapter[]) => void
  description: string
  percent: number | null | undefined
  onSpent: () => void
}) {
  const [phase, setPhase] = useState<'idle' | 'sorting' | 'writing'>('idle')
  const [error, setError] = useState('')
  const [manual, setManual] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  // Spaces the listing mentions but the AI couldn't place with confidence - the agent decides.
  const [questions, setQuestions] = useState<{ question: string; photos: string[]; choices: string[] }[]>([])
  const live = chapters.filter(c => c.enabled && c.photos.length)
  const costLine = percent == null ? 'Under a cent of your monthly AI' : percent < 1 ? `Under 1% of your monthly AI (about ${percent.toFixed(2)}%)` : `About ${Math.round(percent)}% of your monthly AI`
  // Same "% of monthly AI" tag the paid video options wear, right on the button.
  const costTag = percent == null ? '<1¢' : percent < 1 ? '<1% AI' : `~${Math.round(percent)}% AI`

  const sortWithAi = async (fresh = false) => {
    setError('')
    setPhase('sorting')
    const { success, data, error: e } = await api.propertySites.autoRooms(siteId, fresh)
    if (!success || !data) { setPhase('idle'); setError(e || 'The photo sorter is busy - try again in a moment.'); return }
    if (!data.chapters.length) { setPhase('idle'); setError('We couldn’t find enough photos of any one space - you can still set rooms up by hand.'); return }
    const made: PropertyWebsiteChapter[] = data.chapters.map((c, i) => ({
      id: `${c.type}-${Date.now()}-${i}`, type: (c.type === 'other' ? 'custom' : c.type) as PropertyWebsiteChapter['type'],
      label: c.label || CHAPTER_TYPE_LABELS[c.type] || 'Room', enabled: true, photos: c.photos, copy: '',
    }))
    setQuestions(data.questions || [])
    onChange(made)
    onSpent()
    if (description.trim()) {
      setPhase('writing')
      onChange(await withCopy(made))
      onSpent()
    }
    setPhase('idle')
    setEditorOpen(false)
  }
  // A few lines for each space, from the full listing description (no new facts).
  const withCopy = async (list: PropertyWebsiteChapter[]) => {
    const copies = await Promise.all(list.map(async ch => {
      const res = await api.ai.copywrite({ purpose: 'property_site_section', context: `Section: ${ch.label}\n\nFull listing description:\n${description}` })
      return res.success && res.data?.text ? res.data.text.trim() : ''
    }))
    return list.map((ch, i) => ({ ...ch, copy: copies[i] }))
  }
  const answer = async (qi: number, choice: string | null) => {
    const q = questions[qi]
    setQuestions(list => list.filter((_, i) => i !== qi))
    if (!q || !choice) return
    const base: PropertyWebsiteChapter = { id: `custom-${Date.now()}`, type: 'custom' as PropertyWebsiteChapter['type'], label: choice, enabled: true, photos: q.photos, copy: '' }
    onChange([...chapters, base])
    if (description.trim()) {
      const [done] = await withCopy([base])
      onChange([...chapters, done])
      onSpent()
    }
  }

  if (phase !== 'idle') {
    return (
      <div className="rs-scan relative overflow-hidden rounded-2xl border border-[#C9A24D]/30 bg-[#0f0f10] p-5">
        <style>{RS_CSS}</style>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
          {photos.slice(0, 32).map((u, i) => (
            <div key={u + i} className="rs-cell relative aspect-[4/3] overflow-hidden rounded-md" style={{ ['--i' as string]: i }}>
              <img src={u} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
        <span className="rs-line" aria-hidden />
        <div className="relative mt-4 flex items-center gap-2 text-sm font-black text-white">
          <Loader2 className="h-4 w-4 animate-spin text-[#C9A24D]" />
          {phase === 'sorting' ? `Looking at ${Math.min(photos.length, 40)} photos and picking the spaces that sell this home…` : 'Writing a few lines for each space…'}
        </div>
      </div>
    )
  }

  if (!live.length && !manual) {
    return (
      <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_1fr]">
        <style>{RS_CSS}</style>
        <RoomMock />
        <div>
          <h3 className="font-serif text-2xl font-black leading-tight text-[#111827] dark:text-white">Walk buyers through the home, room by room</h3>
          <ul className="mt-3 space-y-1.5 text-[13px] font-semibold text-gray-600 dark:text-gray-300">
            {['AI reads your listing and picks the spaces that sell it - the grounds, the pool, the kitchen…', 'Each gets its own full-screen moment, its photos gliding by with a few lines', 'Not sure about a room? It asks you instead of guessing'].map(t => (
              <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> {t}</li>
            ))}
          </ul>
          <button onClick={() => sortWithAi()} disabled={!photos.length}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] px-5 py-3.5 text-sm font-black text-[#111827] shadow-lg shadow-[#C9A24D]/25 transition hover:-translate-y-0.5 disabled:opacity-50">
            <Wand2 className="h-4 w-4" /> Find my home&apos;s best spaces <span className="rounded-full bg-[#111827]/10 px-2 py-0.5 text-[11px]">{costTag}</span>
          </button>
          <p className="mt-1.5 text-center text-[10px] font-semibold text-gray-400">AI looks at your {photos.length} photos and your listing description · {costLine}</p>
          <div className="mt-3"><MonthlyAiUsageMeter variant="card" /></div>
          <button onClick={() => { setManual(true); setEditorOpen(true) }} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-[13px] font-black text-gray-600 transition hover:border-[#C9A24D] hover:text-[#111827] dark:border-gray-700 dark:text-gray-300 dark:hover:text-white">
            <Hand className="h-4 w-4" /> I&apos;ll set it up by hand
          </button>
          {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <style>{RS_CSS}</style>
      {questions.map((q, qi) => (
        <div key={q.question + qi} className="ohp-modal-pop mb-4 rounded-2xl border border-[#C9A24D]/40 bg-gradient-to-br from-[#fffaf0] to-white p-4 dark:from-[#1c1812] dark:to-[#151517]">
          <p className="flex items-center gap-2 text-sm font-black text-[#111827] dark:text-white"><Sparkles className="h-4 w-4 text-[#C9A24D]" /> Quick question - the AI didn&apos;t want to guess</p>
          <p className="mt-1 text-[13px] font-semibold text-gray-600 dark:text-gray-300">{q.question}</p>
          <div className="mt-3 flex gap-1.5 overflow-x-auto">
            {q.photos.slice(0, 5).map(u => <img key={u} src={u} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" />)}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {q.choices.map(c => (
              <button key={c} onClick={() => void answer(qi, c)} className="rounded-xl bg-[#111827] px-3.5 py-2 text-xs font-black text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]">Add &ldquo;{c}&rdquo;</button>
            ))}
            <button onClick={() => void answer(qi, null)} className="rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-black text-gray-500 hover:text-[#111827] dark:border-gray-700 dark:hover:text-white">Skip it</button>
          </div>
        </div>
      ))}
      {live.length > 0 && (
        <div className={`grid grid-cols-2 gap-3 ${live.length === 3 ? 'sm:grid-cols-3' : 'lg:grid-cols-4'}`}>
          {live.map((ch, i) => (
            <div key={ch.id} className="rs-card group relative overflow-hidden rounded-xl bg-black" style={{ ['--i' as string]: i }}>
              <div className={`grid aspect-[4/3] gap-0.5 ${ch.photos.length >= 3 ? 'grid-cols-3 grid-rows-2' : ch.photos.length === 2 ? 'grid-cols-2' : ''}`}>
                {ch.photos.slice(0, 3).map((u, j) => (
                  <img key={u} src={u} alt="" className={`h-full min-h-0 w-full object-cover ${ch.photos.length >= 3 && j === 0 ? 'col-span-2 row-span-2' : ''}`} />
                ))}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              <div className="absolute inset-x-3 bottom-2.5 text-white">
                <p className="font-serif text-[10px] text-[#C9A24D]">{String(i + 1).padStart(2, '0')}</p>
                <p className="line-clamp-2 font-serif text-[15px] font-bold leading-tight sm:line-clamp-none sm:truncate sm:text-base">{ch.label}</p>
                <p className="text-[10px] font-semibold text-white/60">{ch.photos.length} photo{ch.photos.length === 1 ? '' : 's'}{ch.copy ? ' · words written' : ''}</p>
              </div>
              <button onClick={() => onChange(chapters.filter(c => c.id !== ch.id))} className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600 active:scale-95 sm:right-2 sm:top-2 sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Remove ${ch.label}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={() => sortWithAi(true)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#C9A24D]/50 px-3 py-2 text-[12px] font-black sm:min-h-0 sm:text-[11px] text-[#8b7355] hover:bg-[#C9A24D]/10 dark:text-[#d7b974]">
          <RefreshCw className="h-3.5 w-3.5" /> Pick again with AI
        </button>
        <span className="text-[10px] font-semibold text-gray-400">{costLine}</span>
        <button onClick={() => setEditorOpen(o => !o)} className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-[12px] font-black sm:ml-auto sm:min-h-0 sm:w-auto sm:text-[11px] text-[#111827] hover:border-[#C9A24D] dark:border-gray-700 dark:text-white">
          <Sparkles className="h-3.5 w-3.5 text-[#C9A24D]" /> {editorOpen ? 'Done fine-tuning' : 'Fine-tune rooms & words'} <ChevronDown className={`h-3.5 w-3.5 transition ${editorOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
      <AnimatePresence initial={false}>
        {editorOpen && (
          <motion.div key="rs-fine" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }} className="-mx-1 overflow-hidden px-1 pb-1">
            <div className="pt-4"><ChaptersEditor chapters={chapters} onChange={onChange} photos={photos} description={description} /></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// What a room looks like on the page - an EXAMPLE with photos that match each room's name (user,
// 10/17: "The grounds" over the agent's kitchen photo read as a mistake), never the agent's own.
const EXAMPLE_ROOMS = [
  { label: 'The grounds', copy: 'Nearly an acre of level lawn, mature trees and a putting green out back.', photos: ['/demos/media/40c8804f90b6.jpg', '/demos/media/5c03c65506de.jpg', '/demos/media/ebc976526b9c.jpg'] },
  { label: 'Kitchen', copy: 'A long island with seating for five, quartz counters and a walk-in pantry.', photos: ['/demos/media/57c9d847016b.jpg'] },
  { label: 'Living room', copy: 'Big windows, a gas fireplace and room for the whole family.', photos: ['/demos/media/9ea5e4632d53.jpg', '/demos/media/49e47b42cc1c.jpg'] },
]
function RoomMock() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setI(x => (x + 1) % EXAMPLE_ROOMS.length), 3200)
    return () => window.clearInterval(t)
  }, [])
  const room = EXAMPLE_ROOMS[i]
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-black shadow-xl">
      {EXAMPLE_ROOMS.map((r, j) => <img key={r.label} src={r.photos[0]} alt="" className={`absolute inset-0 h-full w-full object-cover object-[60%_40%] transition-all duration-[1400ms] ${j === i ? 'scale-100 opacity-100' : 'scale-110 opacity-0'}`} />)}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
      <div className="absolute left-5 top-4 flex flex-wrap gap-1.5 pr-20">
        {EXAMPLE_ROOMS.map((r, j) => <span key={r.label} className={`rounded-full border px-2 py-0.5 text-[8px] font-bold transition-colors ${j === i ? 'border-[#C9A24D] text-[#C9A24D]' : 'border-white/25 text-white/60'}`}>{String(j + 1).padStart(2, '0')} {r.label}</span>)}
      </div>
      <div key={room.label} className="ohp-modal-pop absolute bottom-5 left-5 max-w-[60%] text-white">
        <p className="hidden font-serif text-5xl leading-none text-transparent sm:block" style={{ WebkitTextStroke: '1px rgba(201,162,77,.85)' }}>{String(i + 1).padStart(2, '0')}</p>
        <p className="mt-1 font-serif text-2xl font-light">{room.label}</p>
        <p className="mt-1 line-clamp-2 text-[10px] text-white/70">{room.copy}</p>
        <div className="mt-2 flex gap-1">{room.photos.map((u, j) => <span key={u} className={`block h-6 w-8 overflow-hidden rounded-sm ${j === 0 ? 'ring-1 ring-[#C9A24D]' : 'opacity-60'}`}><img src={u} alt="" className="h-full w-full object-cover" /></span>)}</div>
      </div>
      <span className="absolute right-4 top-4 rounded-full bg-black/60 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white/80">Example</span>
    </div>
  )
}

const RS_CSS = `
.rs-cell{opacity:.35;filter:grayscale(.6);animation:rsCell 2.4s ease-in-out infinite;animation-delay:calc(var(--i) * 70ms)}
@keyframes rsCell{0%,100%{opacity:.35;filter:grayscale(.6)}40%{opacity:1;filter:none;box-shadow:0 0 0 2px #C9A24D}}
.rs-line{position:absolute;left:0;right:0;height:2px;top:0;background:linear-gradient(90deg,transparent,#C9A24D,transparent);box-shadow:0 0 18px 4px rgba(201,162,77,.5);animation:rsLine 2.2s ease-in-out infinite}
@keyframes rsLine{0%{top:4%}50%{top:78%}100%{top:4%}}
.rs-card{animation:rsIn .6s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(var(--i) * 90ms)}
@keyframes rsIn{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.rs-cell,.rs-line,.rs-card{animation:none}.rs-cell{opacity:1;filter:none}}
`
