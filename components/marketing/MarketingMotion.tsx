'use client'

import { useEffect, useState } from 'react'
import CalmLoops from '@/components/CalmLoops'
import { ChatMotif, HouseMotif, KeyMotif, MailBadge, PinRouteMotif, QrBadge, ShieldBadge, StarBadge } from '@/components/home/LineArtMotifs'

const MOTIFS = { house: HouseMotif, key: KeyMotif, chat: ChatMotif, pin: PinRouteMotif, qr: QrBadge, star: StarBadge, shield: ShieldBadge, mail: MailBadge }
export type MotifName = keyof typeof MOTIFS

// Scroll-in animation for the marketing pages. The server always sends every word visible, so Google
// and anyone without scripts see the whole page. Only what's below the fold is tucked away, here in the
// browser, and it glides in as it arrives. Opacity and transform only: no blur, nothing that lags.
export default function MarketingMotion() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const el = e.target as HTMLElement
        const siblings = el.parentElement ? Array.from(el.parentElement.children).filter(c => (c as HTMLElement).dataset.reveal !== undefined) : []
        el.style.setProperty('--d', `${Math.min(Math.max(siblings.indexOf(el), 0), 5) * 80}ms`)
        el.classList.add('mk-in')
        el.classList.remove('mk-hide')
        io.unobserve(el)
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 })
    document.querySelectorAll<HTMLElement>('[data-reveal]').forEach(el => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return
      el.classList.add('mk-hide')
      io.observe(el)
    })
    return () => io.disconnect()
  }, [])
  return <CalmLoops />
}

/** The gold line drawing in the hero: it sketches itself in after the page opens. */
export function HeroMotif({ name, className = '' }: { name: MotifName; className?: string }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 250)
    return () => clearTimeout(t)
  }, [])
  const Motif = MOTIFS[name]
  return <Motif visible={visible} className={className} />
}

/** How far through an article they are. */
export function ReadingBar() {
  useEffect(() => {
    const bar = document.getElementById('mk-read')
    if (!bar) return
    let frame = 0
    const paint = () => {
      frame = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      bar.style.transform = `scaleX(${max > 0 ? Math.min(window.scrollY / max, 1) : 0})`
    }
    const on = () => { if (!frame) frame = requestAnimationFrame(paint) }
    window.addEventListener('scroll', on, { passive: true })
    paint()
    return () => { window.removeEventListener('scroll', on); if (frame) cancelAnimationFrame(frame) }
  }, [])
  return <div aria-hidden id="mk-read" className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-[#8b6a2b] via-[#C9A24D] to-[#f3dfa8]" style={{ transform: 'scaleX(0)' }} />
}
