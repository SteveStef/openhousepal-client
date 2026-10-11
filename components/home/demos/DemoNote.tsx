'use client'

import type { ComponentType } from 'react'

// The "what this part does" note shown beside a demo's stage (same look as Agent Hub's note
// beside the phone): gold-on-charcoal icon tile, serif title, one or two plain sentences, and
// progress dots. Re-keyed per stop so it rises in fresh each time.
export function DemoNote({ id, icon: Icon, title, body, index, count, children, className = '' }: { id: string; icon: ComponentType<{ className?: string }>; title: string; body: string; index: number; count: number; children?: React.ReactNode; className?: string }) {
  return (
    <div key={id} className={`dn-rise hidden w-[172px] shrink-0 sm:block ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-md ring-1 ring-[#C9A24D]/40"><Icon className="h-4 w-4" /></span>
      <p className="mt-2.5 font-serif text-[19px] font-black leading-tight text-[#111827] dark:text-white">{title}</p>
      <p className="mt-1.5 text-[12px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{body}</p>
      {children}
      <div className="mt-3 flex flex-wrap gap-1">{Array.from({ length: count }, (_, k) => <span key={k} className={`h-1 rounded-full transition-all duration-500 ${k === index ? 'w-5 bg-[#C9A24D]' : 'w-1.5 bg-[#C9A24D]/25'}`} />)}</div>
    </div>
  )
}

// Mobile: the same note as a slim caption strip (the side note is hidden below `sm`).
export function DemoCaption({ title, body }: { title: string; body: string }) {
  return (
    <div className="dn-rise absolute inset-x-2 bottom-2 z-40 rounded-xl bg-[#111827]/95 px-3 py-2 text-left shadow-lg sm:hidden">
      <p className="text-[12px] font-black text-[#e8c97a]">{title}</p>
      <p className="mt-0.5 text-[10.5px] font-semibold leading-snug text-gray-300">{body}</p>
    </div>
  )
}

// For demos whose stage fills the whole window (no room for a side note): a slim numbered strip
// along the top that says what's happening right now, re-keyed per step so it slides in fresh.
export function DemoStep({ id, step, count, title, body, icon: Icon }: { id: string; step: number; count: number; title: string; body: string; icon?: ComponentType<{ className?: string }> }) {
  return (
    <div key={id} className="dn-rise pointer-events-none absolute inset-x-3 top-2 z-40 flex items-center gap-2.5 rounded-2xl bg-[#111827]/95 py-2 pl-2 pr-3 text-left shadow-[0_12px_30px_-12px_rgba(0,0,0,.6)] ring-1 ring-[#C9A24D]/30 ">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#C9A24D] text-[11px] font-black text-[#111827]">{Icon ? <Icon className="h-3.5 w-3.5" /> : step}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-black text-[#f3dfa8]">{title}</p>
        <p className="truncate text-[10.5px] font-semibold text-gray-300">{body}</p>
      </div>
      <div className="hidden shrink-0 gap-1 sm:flex">{Array.from({ length: count }, (_, k) => <span key={k} className={`h-1 rounded-full transition-all duration-500 ${k === step - 1 ? 'w-4 bg-[#C9A24D]' : 'w-1.5 bg-white/25'}`} />)}</div>
    </div>
  )
}

// Shared classes: `dn-on` outlines the part the note is talking about in gold, `dn-off` dims
// everything else, `dn-hl` makes the switch smooth.
export const DEMO_NOTE_CSS = `
@keyframes dnRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes dnPop{0%{opacity:0;transform:translateY(14px) scale(.94)}100%{opacity:1;transform:none}}
@keyframes dnToast{0%{opacity:0;transform:translateY(-10px) scale(.95)}100%{opacity:1;transform:none}}
@keyframes dnTap{0%{transform:scale(1);opacity:.9}100%{transform:scale(2.6);opacity:0}}
@keyframes dnDraw{from{stroke-dashoffset:60}to{stroke-dashoffset:0}}
.dn-rise{animation:dnRise .6s cubic-bezier(.22,.61,.36,1) both}
.dn-pop{animation:dnPop .7s cubic-bezier(.22,.61,.36,1) both}
.dn-toast{animation:dnToast .55s cubic-bezier(.34,1.56,.64,1) both}
.dn-tap{animation:dnTap .7s ease-out both}
.dn-hl{transition:opacity .5s ease,box-shadow .5s ease,transform .5s ease}
.dn-on{box-shadow:0 0 0 2px #C9A24D,0 0 0 6px rgba(201,162,77,.22),0 12px 30px -12px rgba(201,162,77,.7);z-index:2}
.dn-off{opacity:.4}
@media (prefers-reduced-motion:reduce){.dn-rise,.dn-pop,.dn-toast,.dn-tap{animation:none}}
`

// The demo stage background shared by the narrated demos (ivory + gold glow, dark in dark mode).
export const STAGE_BG = 'bg-[radial-gradient(90%_80%_at_80%_10%,rgba(201,162,77,.18),transparent_60%),linear-gradient(140deg,#fffdf8,#f6efe0)] dark:bg-[radial-gradient(90%_80%_at_80%_10%,rgba(201,162,77,.14),transparent_60%),linear-gradient(140deg,#0b0f0e,#141210)]'
