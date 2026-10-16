'use client'

// One site-wide scroll lock (user 10/12): while ANY pop-up, side panel or full-screen editor is open,
// the page behind it can't scroll. The site has dozens of hand-built overlays (fixed + full-screen +
// a backdrop), so instead of wiring each one this watches the page and locks the document whenever one
// is showing. It locks <html> (not <body>) so it never fights the few modals that set body overflow
// themselves, and pads for the vanished scrollbar so nothing jumps sideways.
import { useEffect } from 'react'

const CANDIDATES = '[class*="fixed"], [style*="position: fixed"], [role="dialog"], [aria-modal="true"], dialog[open]'

function isOverlay(el: Element): boolean {
  if (el.closest('[data-scroll-lock="off"]')) return false
  const cs = getComputedStyle(el)
  if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none' || Number(cs.opacity) === 0) return false
  // page backgrounds sit behind the content - only layers stacked above it count
  const z = parseInt(cs.zIndex, 10)
  if (!Number.isFinite(z) || z < 10) return false
  const r = el.getBoundingClientRect()
  if (r.width < window.innerWidth * 0.95 || r.height < window.innerHeight * 0.9) return false
  if (el.getAttribute('aria-modal') === 'true' || el.getAttribute('role') === 'dialog' || el.tagName === 'DIALOG') return true
  // a real pop-up dims or covers the page; an invisible click-catcher behind a dropdown doesn't
  const bg = cs.backgroundColor
  const tinted = !!bg && bg !== 'transparent' && !/rgba?\([^)]*,\s*0(\.0+)?\)$/.test(bg)
  return tinted || cs.backgroundImage !== 'none' || (cs.backdropFilter && cs.backdropFilter !== 'none') || false
}

export default function ScrollLockWatcher() {
  useEffect(() => {
    const html = document.documentElement
    let locked = false
    let timer: number | undefined
    const apply = (on: boolean) => {
      if (on === locked) return
      locked = on
      if (on) {
        const gap = window.innerWidth - html.clientWidth
        html.style.overflow = 'hidden'
        if (gap > 0) html.style.paddingRight = `${gap}px`
      } else {
        html.style.overflow = ''
        html.style.paddingRight = ''
      }
    }
    const check = () => {
      timer = undefined
      apply(Array.from(document.querySelectorAll(CANDIDATES)).some(isOverlay))
    }
    const schedule = () => { if (timer === undefined) timer = window.setTimeout(check, 60) }
    const mo = new MutationObserver(schedule)
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'open', 'aria-modal', 'hidden'] })
    window.addEventListener('resize', schedule)
    check()
    return () => { mo.disconnect(); window.removeEventListener('resize', schedule); if (timer) clearTimeout(timer); apply(false) }
  }, [])
  return null
}
