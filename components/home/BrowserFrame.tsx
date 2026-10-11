'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Shared "desktop app window" chrome used by the editor-style feature demos (Forms, CMA, Design
// Studio) on the homepage Features tabs. Sign-In and Showcases use MobilePhoneMockup-style phone
// frames instead since those are visitor-facing mobile experiences - this frame is only for the
// agent-facing editor tools.
export type SegmentedProgress = { pages: number; current: number; durationMs: number }

function SegmentedProgressBar({ pages, current, durationMs }: SegmentedProgress) {
  // The current segment animates 0% -> 100% over durationMs (an Instagram-stories style fill),
  // not just instantly rendering full - so it needs its own two-frame trick: paint at 0%, then
  // flip to 100% a tick later so the CSS transition actually has something to animate from.
  // `filled` is one shared boolean reused across every segment (not per-segment state), so the
  // moment a new segment becomes `current` it briefly re-renders with whatever `filled` was left
  // at by the PREVIOUS segment (true, i.e. width 100%) before this effect gets a chance to reset
  // it. A plain useEffect resets it only after the browser has already painted that stale full
  // frame, which visibly flashed the new segment full then drained it back down before the real
  // fill started - reading as broken/glitchy rather than a clean slow fill. Resetting in a
  // useLayoutEffect instead runs synchronously before paint, so that stale frame is never shown.
  const [filled, setFilled] = useState(false)
  useLayoutEffect(() => {
    setFilled(false)
  }, [current, durationMs])
  useEffect(() => {
    const t = setTimeout(() => setFilled(true), 30)
    return () => clearTimeout(t)
  }, [current, durationMs])

  return (
    <div className="flex items-center gap-1 px-3 pt-3 pb-1">
      {Array.from({ length: pages }).map((_, idx) => (
        <div key={idx} className="h-[3px] flex-1 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
          {idx < current ? (
            <div className="h-full w-full bg-[#C9A24D]" />
          ) : idx === current ? (
            <div className="h-full bg-[#C9A24D]" style={{ width: filled ? '100%' : '0%', transition: `width ${durationMs}ms linear` }} />
          ) : null}
        </div>
      ))}
    </div>
  )
}

const CONTENT_H = 420

// A demo's scene (side note + its little window) can be wider than the space the homepage gives the
// frame - then it was centered and clipped on both sides, cutting words off. This measures the
// scene's real width and, when it doesn't fit, shrinks the whole scene just enough (keeping the
// full 420px height) so everything shows.
function useFitToWidth() {
  const boxRef = useRef<HTMLDivElement>(null)
  const fitRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<{ s: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const box = boxRef.current
    const wrap = fitRef.current
    if (!box || !wrap) return
    let raf = 0
    const measure = () => {
      raf = 0
      // The scene's own root (some demos put a <style> tag first).
      const root = Array.from(wrap.children).find(el => el.tagName !== 'STYLE' && el.tagName !== 'SCRIPT') as HTMLElement | undefined
      if (!root) return
      const avail = box.clientWidth
      const cs = getComputedStyle(root)
      let need = 0
      if (cs.display.includes('flex') && !cs.flexDirection.startsWith('column')) {
        const kids = Array.from(root.children).filter(k => {
          const ks = getComputedStyle(k)
          return ks.position !== 'absolute' && ks.position !== 'fixed' && ks.display !== 'none'
        }) as HTMLElement[]
        const gap = parseFloat(cs.columnGap) || 0
        need = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + Math.max(0, kids.length - 1) * gap
          + kids.reduce((t, k) => { const ks = getComputedStyle(k); return t + k.offsetWidth + parseFloat(ks.marginLeft) + parseFloat(ks.marginRight) }, 0)
      }
      setFit(prev => {
        if (need > avail + 1) {
          const next = { s: avail / need, w: Math.ceil(need) }
          return prev && Math.abs(prev.s - next.s) < 0.005 && prev.w === next.w ? prev : next
        }
        return prev ? null : prev
      })
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure) }
    measure()
    const ro = new ResizeObserver(schedule)
    ro.observe(box)
    const mo = new MutationObserver(schedule)
    mo.observe(wrap, { childList: true, subtree: true })
    return () => { ro.disconnect(); mo.disconnect(); if (raf) cancelAnimationFrame(raf) }
  }, [])
  return { boxRef, fitRef, fit }
}

export default function BrowserFrame({ url, children, progress }: { url: string; children: React.ReactNode; progress?: SegmentedProgress }) {
  const { boxRef, fitRef, fit } = useFitToWidth()
  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#151517]">
      {/* Segmented progress bar - one segment per "page" this feature's whole demo cycles through
          (not just the current screen), so visitors can see how far into the entire sequence they
          are and when it's about to loop back to the start. */}
      {progress != null && <SegmentedProgressBar {...progress} />}
      {/* Title bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#F3F4F6] dark:bg-[#111114] border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <div className="flex min-w-0 items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-800 max-w-xs w-full">
            <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.822 1.07-4" />
            </svg>
            <span key={url} className="text-[11px] font-medium text-gray-400 truncate animate-fadeIn">{url}</span>
          </div>
        </div>
      </div>
      {/* Content - fixed height + overflow-hidden as a hard backstop, so no demo's content can
          ever grow this box and shift the rest of the page. */}
      <div ref={boxRef} className="relative bg-[#FAFAF7] dark:bg-[#0B0B0B] h-[420px] overflow-hidden">
        <style>{'.ohp-demo-fit > :not(style):not(script) { height: 100% !important; }'}</style>
        <div
          ref={fitRef}
          className="ohp-demo-fit"
          style={fit ? { width: fit.w, height: CONTENT_H / fit.s, transform: `scale(${fit.s})`, transformOrigin: 'top left' } : { height: '100%' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
