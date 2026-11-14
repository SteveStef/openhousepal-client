'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Monitor, Smartphone, X } from 'lucide-react'
import type { ExpandTab } from './pitchData'

// "Look closer": the full-window view that opens when a result on a slide is clicked. Real pixels,
// not the scaled slide canvas, so a kit sheet is readable and a live site is the real site.
// Esc closes, left/right switch between the tabs.

function Compare({ tab }: { tab: Extract<ExpandTab, { kind: 'compare' }> }) {
  const [pct, setPct] = useState(50)
  const box = useRef<HTMLDivElement>(null)
  const move = (x: number) => {
    const r = box.current?.getBoundingClientRect()
    if (r) setPct(Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100)))
  }
  return (
    <div ref={box} className="relative aspect-[3/2] max-h-full w-full max-w-[1200px] cursor-ew-resize touch-none select-none overflow-hidden rounded-2xl ring-1 ring-[#C9A24D]/50"
      style={{ maxWidth: 'min(1200px, calc((100vh - 150px) * 1.5))' }}
      onPointerMove={e => move(e.clientX)} onPointerDown={e => move(e.clientX)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={tab.before} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={tab.after} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 0 0 ${pct}%)` }} />
      <span className="absolute inset-y-0 w-[3px] -translate-x-1/2 bg-[#f3dfa8] shadow-[0_0_18px_2px_rgba(243,223,168,.8)]" style={{ left: `${pct}%` }}>
        <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#f3dfa8] text-[#111827]"><ChevronLeft className="-mr-1.5 h-4 w-4" strokeWidth={3} /><ChevronRight className="-ml-1.5 h-4 w-4" strokeWidth={3} /></span>
      </span>
      <span className="absolute bottom-4 left-4 rounded-full bg-black/80 px-4 py-2 text-xs font-black uppercase tracking-widest text-white/85">{tab.a}</span>
      <span className="absolute bottom-4 right-4 rounded-full bg-black/80 px-4 py-2 text-xs font-black uppercase tracking-widest text-[#f3dfa8]">{tab.b}</span>
    </div>
  )
}

function Grid({ items }: { items: { thumb: string; full: string }[] }) {
  const [big, setBig] = useState<string | null>(null)
  if (big) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={big} alt="" onClick={() => setBig(null)} className="max-h-full max-w-full cursor-zoom-out rounded-xl object-contain ring-1 ring-[#C9A24D]/50" />
    )
  }
  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-[1280px] columns-2 gap-4 sm:columns-3 lg:columns-5">
        {items.map(({ thumb, full }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={thumb} src={thumb} alt="" loading="lazy" onClick={() => setBig(full)} className="mb-4 w-full cursor-zoom-in rounded-xl ring-1 ring-[#C9A24D]/30 transition-transform hover:scale-[1.02]" />
        ))}
      </div>
    </div>
  )
}

export default function PitchExpand({ title, tabs, start, onClose }: { title: string; tabs: ExpandTab[]; start: number; onClose: () => void }) {
  const [n, setN] = useState(Math.min(start, tabs.length - 1))
  const tab = tabs[n]
  // A live page opens in the shape it is best seen in; the buttons switch phone <-> computer.
  const [device, setDevice] = useState<'phone' | 'desk' | null>(null)
  const dev = device || (tab.kind === 'live' || tab.kind === 'page' ? tab.device : 'desk')
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { setDevice(null); setLoaded(false) }, [n])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowRight') setN(v => Math.min(tabs.length - 1, v + 1))
      else if (e.key === 'ArrowLeft') setN(v => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, tabs.length])

  const frame = dev === 'phone'
    ? 'h-full w-full max-w-[400px] rounded-[34px] ring-[9px] ring-[#101219]'
    : 'h-full w-full max-w-[1320px] rounded-xl ring-1 ring-[#C9A24D]/40'
  const btn = 'grid h-10 w-10 place-items-center rounded-full border border-white/15 text-gray-300 transition-colors hover:border-[#C9A24D] hover:text-[#f3dfa8]'

  return (
    <div data-nonav className="fixed inset-0 z-[300] flex flex-col bg-[#07080c]" onClick={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
      <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-2.5 sm:px-6">
        <p className="mr-auto font-serif text-xl font-black text-white sm:text-2xl">{title}</p>
        {tabs.length > 1 && (
          <div className="order-3 flex w-full gap-1.5 overflow-x-auto sm:order-none sm:w-auto">
            {tabs.map((t, k) => (
              <button key={t.label} type="button" onClick={() => setN(k)}
                className={`flex-none rounded-full px-4 py-2 text-sm font-black transition-colors ${k === n ? 'bg-[#e8c97a] text-[#111827]' : 'border border-white/15 text-gray-300 hover:border-[#C9A24D]'}`}>{t.label}</button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          {tab.kind === 'live' && (
            <>
              <button type="button" aria-label="Phone size" title="Phone size" className={`${btn} ${dev === 'phone' ? '!border-[#C9A24D] !text-[#f3dfa8]' : ''}`} onClick={() => setDevice('phone')}><Smartphone className="h-4 w-4" /></button>
              <button type="button" aria-label="Computer size" title="Computer size" className={`${btn} hidden sm:grid ${dev === 'desk' ? '!border-[#C9A24D] !text-[#f3dfa8]' : ''}`} onClick={() => setDevice('desk')}><Monitor className="h-4 w-4" /></button>
              <a href={tab.url} target="_blank" rel="noopener noreferrer" aria-label="Open in a new tab" title="Open in a new tab" className={btn}><ExternalLink className="h-4 w-4" /></a>
            </>
          )}
          <button type="button" aria-label="Close" title="Close (Esc)" className={`${btn} !border-[#C9A24D]/60 !text-white`} onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-5">
        {tab.kind === 'sheet' && (
          <div key={tab.src} className="flex h-full max-w-full items-center justify-center gap-4 sm:gap-6">
            {[tab.src, tab.back].filter(Boolean).map((src, k) => (
              <div key={src} className="relative flex h-full min-w-0 flex-col items-center justify-center gap-2">
                {tab.back && <span className="flex-none rounded-full border border-[#C9A24D]/60 bg-[#C9A24D]/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-[#f3dfa8]">{k === 0 ? 'Front' : 'Back'}</span>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={tab.label} draggable={false} className="min-h-0 max-w-full flex-1 rounded-md bg-white object-contain shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)]" style={{ maxHeight: '100%' }} />
              </div>
            ))}
          </div>
        )}
        {tab.kind === 'page' && (
          <div key={tab.src} className={`${frame} overflow-y-auto overflow-x-hidden bg-[#111]`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tab.src} alt={tab.label} draggable={false} className="block w-full" />
          </div>
        )}
        {tab.kind === 'live' && (
          <div className={`${frame} relative overflow-hidden bg-[#0d111b]`}>
            {!loaded && <p className="absolute inset-0 grid place-items-center text-sm font-bold text-gray-400">Opening the live page…</p>}
            {/* No allow-top-navigation: a link inside can never take the deck itself somewhere else. */}
            <iframe key={`${tab.url}-${dev}`} src={tab.url} title={tab.label} onLoad={() => setLoaded(true)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups" className="relative h-full w-full border-0" />
          </div>
        )}
        {tab.kind === 'compare' && <Compare key={tab.after} tab={tab} />}
        {tab.kind === 'video' && (
          <video key={tab.src} src={tab.src} poster={tab.poster} controls autoPlay muted={!tab.sound} loop playsInline
            className={`max-h-full max-w-full ring-1 ring-[#C9A24D]/50 ${tab.device === 'phone' ? 'rounded-[34px] ring-[9px] ring-[#101219]' : 'rounded-2xl'}`} />
        )}
        {tab.kind === 'grid' && <Grid items={tab.items} />}

        {tabs.length > 1 && n > 0 && <button type="button" aria-label="Previous" className={`${btn} absolute left-3 top-1/2 hidden -translate-y-1/2 bg-[#0d111b] lg:grid`} onClick={() => setN(n - 1)}><ChevronLeft className="h-5 w-5" /></button>}
        {tabs.length > 1 && n < tabs.length - 1 && <button type="button" aria-label="Next" className={`${btn} absolute right-3 top-1/2 hidden -translate-y-1/2 bg-[#0d111b] lg:grid`} onClick={() => setN(n + 1)}><ChevronRight className="h-5 w-5" /></button>}
      </div>
    </div>
  )
}
