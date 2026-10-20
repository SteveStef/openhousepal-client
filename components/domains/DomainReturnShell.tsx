'use client'

// The calm full-page card shown while we finish something after the agent comes back from PayPal
// or from their domain company (studio/domains/return, studio/domains/connected).
import Link from 'next/link'
import { ArrowRight, Check, Loader2, X } from 'lucide-react'

export type StepState = 'done' | 'doing' | 'todo' | 'bad'

export function StepList({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <ul className="mt-6 space-y-3 text-left">
      {steps.map(s => (
        <li key={s.label} className="flex items-center gap-3 text-[15px] font-semibold">
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${s.state === 'done' ? 'bg-emerald-500 text-white' : s.state === 'bad' ? 'bg-red-100 text-red-600 dark:bg-red-500/15' : s.state === 'doing' ? 'bg-[#C9A24D]/20 text-[#8b6a2b]' : 'bg-gray-100 text-gray-300 dark:bg-white/10'}`}>
            {s.state === 'done' ? <Check className="h-4 w-4" strokeWidth={3} /> : s.state === 'doing' ? <Loader2 className="h-4 w-4 animate-spin" /> : s.state === 'bad' ? <X className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
          </span>
          <span className={s.state === 'todo' ? 'text-gray-400' : 'text-[#111827] dark:text-white'}>{s.label}</span>
        </li>
      ))}
    </ul>
  )
}

export default function DomainReturnShell({ eyebrow, title, children, backHref, backLabel, ready = true }: {
  eyebrow: string; title: React.ReactNode; children?: React.ReactNode; backHref: string; backLabel: string; ready?: boolean
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#FAFAF7] px-4 py-16 dark:bg-[#0B0B0B]">
      <div className="w-full max-w-lg rounded-3xl border border-[#e7dfcf] bg-white p-8 text-center shadow-xl shadow-[#C9A24D]/10 dark:border-white/10 dark:bg-[#151517] sm:p-10">
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#e8c97a]">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-3xl font-black leading-tight text-[#111827] dark:text-white">{title}</h1>
        {children}
        <Link href={backHref} aria-disabled={!ready}
          className={`mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-6 py-3.5 text-sm font-black uppercase tracking-wide text-[#111827] shadow-md shadow-[#C9A24D]/30 transition hover:-translate-y-0.5 ${ready ? '' : 'pointer-events-none opacity-40'}`}>
          {backLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
