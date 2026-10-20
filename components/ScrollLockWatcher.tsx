'use client'

// One site-wide scroll lock (user 10/12): while ANY pop-up, side panel or full-screen editor is open,
// the page behind it can't scroll. The site has dozens of hand-built overlays (fixed + full-screen +
// a backdrop), so instead of wiring each one this watches the page and locks the document whenever one
// is showing. It locks <html> (not <body>) so it never fights the few modals that set body overflow
// themselves, and pads for the vanished scrollbar so nothing jumps sideways.
import { useEffect } from 'react'

const CANDIDATES = '[class*="fixed"], [style*="position: fixed"], [role="dialog"], [aria-modal="true"], dialog[open], [data-scroll-lock="on"]'

function tinted(cs: CSSStyleDeclaration): boolean {
  const bg = cs.backgroundColor
  return (!!bg && bg !== 'transparent' && !/rgba?\([^)]*,\s*0(\.0+)?\)$/.test(bg)) || cs.backgroundImage !== 'none' || (!!cs.backdropFilter && cs.backdropFilter !== 'none')
}

function isOverlay(el: Element): boolean {
  if (el.closest('[data-scroll-lock="off"]')) return false
  const cs = getComputedStyle(el)
  if (el.getAttribute('data-scroll-lock') === 'on') return cs.display !== 'none' && cs.visibility !== 'hidden'
  if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none' || Number(cs.opacity) === 0) return false
  // page backgrounds sit behind the content - only layers stacked above it count
  const z = parseInt(cs.zIndex, 10)
  if (!Number.isFinite(z) || z < 10) return false
  const r = el.getBoundingClientRect()
  if (r.width < window.innerWidth * 0.95 || r.height < window.innerHeight * 0.9) return false
  if (el.getAttribute('aria-modal') === 'true' || el.getAttribute('role') === 'dialog' || el.tagName === 'DIALOG') return true
  // a real pop-up dims or covers the page; an invisible click-catcher behind a dropdown doesn't.
  // (Its dimmed backdrop can also be its own full-size first child - the phone menu is built so.)
  if (tinted(cs)) return true
  const first = el.firstElementChild as HTMLElement | null
  if (first) {
    const fr = first.getBoundingClientRect()
    if (fr.width >= window.innerWidth * 0.95 && fr.height >= window.innerHeight * 0.9 && tinted(getComputedStyle(first))) return true
  }
  return false
}

export default function ScrollLockWatcher() {
  useEffect(() => {
    const html = document.documentElement
    let locked = false
    let timer: number | undefined
    // Phones (user, 10/17): iOS Safari scrolls the page under a pop-up even with overflow hidden
    // on <html>, so on touch screens the page itself is pinned in place (position: fixed at the
    // current scroll) and put back exactly where it was when the pop-up closes.
    const touch = window.matchMedia('(pointer: coarse)').matches
    let savedY = 0
    // Only undo a pin this watcher made: a window that pins the page itself (the Showcase's home
    // details) keeps its own pin, and a pop-up opened over it must not unpin the page on close -
    // that sent a phone to the top of the Showcase and back (10/19).
    let pinned = false
    const body = document.body
    const apply = (on: boolean) => {
      if (on === locked) return
      locked = on
      if (on) {
        const gap = window.innerWidth - html.clientWidth
        html.style.overflow = 'hidden'
        if (gap > 0) html.style.paddingRight = `${gap}px`
        if (touch && body.style.position !== 'fixed') {
          pinned = true
          savedY = window.scrollY
          body.style.position = 'fixed'
          body.style.top = `-${savedY}px`
          body.style.left = '0'
          body.style.right = '0'
          body.style.width = '100%'
        }
      } else {
        html.style.overflow = ''
        html.style.paddingRight = ''
        if (pinned) {
          pinned = false
          body.style.position = ''
          body.style.top = ''
          body.style.left = ''
          body.style.right = ''
          body.style.width = ''
          window.scrollTo(0, savedY)
        }
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
