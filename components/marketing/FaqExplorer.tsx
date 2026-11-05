'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { FAQ_GROUPS, type Faq } from '@/components/marketing/faqData'

function Question({ faq, startOpen }: { faq: Faq; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen)
  return (
    <div className={`mk-card relative overflow-hidden rounded-2xl border ${open ? 'border-[#C9A24D]/60 bg-gradient-to-br from-white to-[#fbf3df] shadow-[0_22px_44px_-30px_rgba(139,106,43,.7)] dark:from-[#17161a] dark:to-[#1f1a10]' : 'border-gray-200 bg-white hover:border-[#C9A24D]/50 dark:border-white/10 dark:bg-[#151517]'}`}>
      <span aria-hidden className={`absolute inset-y-4 left-0 w-1 rounded-r-full bg-gradient-to-b from-[#C9A24D] to-[#e8c97a] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
      <h3>
        <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} data-testid="faq-question"
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5">
          <span className="font-serif text-[17px] font-black leading-snug text-[#0B0B0B] dark:text-white sm:text-lg">{faq.q}</span>
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all duration-300 ${open ? 'rotate-180 bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]' : 'bg-[#C9A24D]/12 text-[#8b7355] dark:text-[#e8c97a]'}`}>
            <ChevronDown className="h-4 w-4" strokeWidth={3} />
          </span>
        </button>
      </h3>
      {/* Always in the page, so Google reads the answers; opening is only a height change. */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300 sm:px-6 sm:pb-6">{faq.a}</p>
        </div>
      </div>
    </div>
  )
}

export default function FaqExplorer() {
  const [term, setTerm] = useState('')
  const [group, setGroup] = useState('all')
  const q = term.trim().toLowerCase()
  const shown = useMemo(() => FAQ_GROUPS
    .filter(g => group === 'all' || g.id === group)
    .map(g => ({ ...g, items: g.items.filter(f => !q || `${f.q} ${f.a}`.toLowerCase().includes(q)) }))
    .filter(g => g.items.length), [q, group])

  return (
    <div>
      <div className="relative -mt-8 rounded-2xl bg-white p-2 shadow-[0_24px_50px_-26px_rgba(17,24,39,.55)] ring-1 ring-black/5 dark:bg-[#151517] dark:ring-white/10">
        <div className="flex items-center gap-2.5 px-3">
          <Search className="h-5 w-5 shrink-0 text-[#C9A24D]" />
          <input value={term} onChange={e => setTerm(e.target.value)} placeholder="Search your question" aria-label="Search questions" data-testid="faq-search"
            className="min-w-0 flex-1 bg-transparent py-3 text-base font-semibold text-[#111827] outline-none placeholder:text-gray-400 dark:text-white" />
          {term && <button type="button" onClick={() => setTerm('')} aria-label="Clear search" className="grid h-8 w-8 place-items-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-1.5" role="group" aria-label="Topics">
        {[{ id: 'all', title: 'All' }, ...FAQ_GROUPS].map(g => (
          <button key={g.id} type="button" aria-pressed={group === g.id} onClick={() => setGroup(g.id)} data-testid={`faq-topic-${g.id}`}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-black transition ${group === g.id ? 'bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-[#C9A24D] dark:bg-[#151517] dark:text-gray-300 dark:ring-white/10'}`}>
            {g.title}
          </button>
        ))}
      </div>
      {shown.map((g, n) => (
        <section key={g.id} data-reveal="" className="mt-10">
          <h2 className="font-serif text-2xl font-black text-[#0B0B0B] dark:text-white sm:text-3xl">{g.title}</h2>
          <div className="mt-4 space-y-3">
            {g.items.map((f, i) => <Question key={f.q} faq={f} startOpen={n === 0 && i === 0 && !q} />)}
          </div>
        </section>
      ))}
      {!shown.length && <p className="mt-10 text-center text-base font-semibold text-gray-500 dark:text-gray-400" data-testid="faq-empty">No match for that. Ask us below and we&apos;ll answer it.</p>}
    </div>
  )
}
