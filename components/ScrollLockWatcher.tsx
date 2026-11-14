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
  // 'soft' (the helper's phone sheet): locks scrolling but never pins the page - pinning a long page
  // full of effects froze an iPhone (owner, 11/01, the homepage)
  if (el.getAttribute('data-scroll-lock') === 'on' || el.getAttribute('data-scroll-lock') === 'soft') return cs.display !== 'none' && cs.visibility !== 'hidden'
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
    let savedPath = ''
    // Only undo a pin this watcher made: a window that pins the page itself (the Showcase's home
    // details) keeps its own pin, and a pop-up opened over it must not unpin the page on close -
    // that sent a phone to the top of the Showcase and back (10/19).
    let pinned = false
    const body = document.body
    const apply = (on: boolean, pin: boolean) => {
      if (on === locked) return
      locked = on
      if (on) {
        const gap = window.innerWidth - html.clientWidth
        html.style.overflow = 'hidden'
        if (gap > 0) html.style.paddingRight = `${gap}px`
        if (touch && pin && body.style.position !== 'fixed') {
          pinned = true
          savedY = window.scrollY
          savedPath = window.location.pathname + window.location.search
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
          // Went to another page from the pop-up (the phone menu): that page starts at its top - the
          // old page's scroll spot made it jump before it loaded (owner, 10/26).
          window.scrollTo(0, window.location.pathname + window.location.search === savedPath ? savedY : 0)
        }
      }
    }
    // The page BEHIND a pop-up rests (owner 11/13, "the blog writer feels laggy"): its endless
    // decorations - the Luxe header's drifting glows, sparkles, gold shimmer - kept redrawing every
    // frame under the dimmed backdrop, which on a phone was most of the work while typing in the
    // AI Blog Writer. Only loops outside every open pop-up pause (the pop-up's own spinners keep
    // going), and exactly those play again when the last pop-up closes.
    // Paused by a marker + one style rule (not Animation.pause()), so the page's own CSS keeps control
    // of its loops once they wake (hover-only sparkles, off-screen pauses).
    const REST = 'data-ohp-rest'
    const restStyle = document.createElement('style')
    restStyle.textContent = `[${REST}],[${REST}]::before,[${REST}]::after{animation-play-state:paused!important}`
    document.head.appendChild(restStyle)
    const rested = new Set<Element>()
    let overlays: Element[] = []
    const restBehind = () => {
      if (typeof document.getAnimations !== 'function') return
      for (const a of document.getAnimations()) {
        if (a.playState !== 'running' || a.effect?.getComputedTiming().iterations !== Infinity) continue
        const t = (a.effect as KeyframeEffect | null)?.target as Element | null
        if (!t || rested.has(t) || overlays.some(o => o.contains(t))) continue
        t.setAttribute(REST, '')
        rested.add(t)
      }
    }
    const wakeBehind = () => {
      rested.forEach(t => t.removeAttribute(REST))
      rested.clear()
    }
    let restTimer: number | undefined
    const check = () => {
      timer = undefined
      const open = Array.from(document.querySelectorAll(CANDIDATES)).filter(el => isOverlay(el as HTMLElement))
      overlays = open
      apply(open.length > 0, open.some(el => (el as HTMLElement).getAttribute('data-scroll-lock') !== 'soft'))
      if (open.length) {
        restBehind()
        // once more after the pop-up has settled in (the page behind may still be mounting loops)
        if (restTimer) clearTimeout(restTimer)
        restTimer = window.setTimeout(restBehind, 700)
      } else if (rested.size) {
        wakeBehind()
      }
    }
    const schedule = () => { if (timer === undefined) timer = window.setTimeout(check, 60) }
    // Only changes that can open or close a pop-up count. Every animation frame rewrites some
    // element's inline style and every keystroke re-renders a form; re-checking the whole page for
    // each of those (styles + sizes of every fixed layer) cost frames while typing and between steps.
    const relevant = (n: Node) => n.nodeType === 1 && ((n as Element).matches(CANDIDATES) || !!(n as Element).querySelector(CANDIDATES))
    const mo = new MutationObserver(records => {
      if (timer !== undefined) return
      for (const r of records) {
        if (r.type === 'childList') {
          if (Array.prototype.some.call(r.addedNodes, relevant) || Array.prototype.some.call(r.removedNodes, relevant)) return schedule()
        } else if (r.target.nodeType === 1) {
          const el = r.target as Element
          if (r.attributeName === 'class' || r.attributeName === 'style'
            ? el.matches(CANDIDATES) || overlays.includes(el) || (r.attributeName === 'class' && overlays.length > 0)
            : relevant(el)) return schedule()
        }
      }
    })
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'open', 'aria-modal', 'hidden'] })
    window.addEventListener('resize', schedule)
    check()
    return () => { mo.disconnect(); window.removeEventListener('resize', schedule); if (timer) clearTimeout(timer); if (restTimer) clearTimeout(restTimer); wakeBehind(); restStyle.remove(); apply(false, false) }
  }, [])
  return null
}
