'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

// The town page's section menu (Overview · Homes · Market · Schools · Living here · Getting
// around · FAQ). Sticks under the site header while the guest scrolls, lights up the section
// they're reading with a pill that glides from tab to tab, and keeps that pill in view on a
// phone's swipeable row. A tap glides the page to the section (no jump) and the section's content
// settles in with a soft rise (.ohp-town-arrive in site-theme.css). Only the sections the town
// actually has are passed in.
export default function TownSectionNav({ sections, luxe }: { sections: { id: string; label: string }[]; luxe: boolean }) {
  const [active, setActive] = useState(sections[0]?.id)
  const rowRef = useRef<HTMLDivElement>(null)
  const lockUntil = useRef(0)

  useEffect(() => {
    const els = sections.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    const onScroll = () => {
      // While a tapped tab is gliding there, keep that tab lit instead of flicking through the
      // ones passed on the way.
      if (Date.now() < lockUntil.current) return
      const line = 150
      let current = els[0].id
      for (const el of els) if (el.getBoundingClientRect().top - line <= 0) current = el.id
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [sections])

  useEffect(() => {
    const row = rowRef.current
    const pill = row?.querySelector<HTMLElement>(`[data-id="${active}"]`)
    if (row && pill) row.scrollTo({ left: pill.offsetLeft - row.clientWidth / 2 + pill.clientWidth / 2, behavior: 'smooth' })
  }, [active])

  const go = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    e.preventDefault()
    setActive(id)
    lockUntil.current = Date.now() + 900
    const top = el.getBoundingClientRect().top + window.scrollY - 128
    window.scrollTo({ top, behavior: 'smooth' })
    history.replaceState(null, '', `#${id}`)
    el.classList.remove('ohp-town-arrive')
    void el.offsetWidth
    el.classList.add('ohp-town-arrive')
  }

  if (sections.length < 2) return null
  return (
    <nav aria-label="On this page" className="sticky top-[67px] z-30 border-b " style={{ borderColor: 'var(--site-line)', backgroundColor: 'color-mix(in srgb, var(--site-bg) 92%, transparent)' }}>
      <div ref={rowRef} className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
        {sections.map(s => {
          const on = s.id === active
          return (
            <a key={s.id} data-id={s.id} href={`#${s.id}`} onClick={e => go(e, s.id)}
              className={`relative shrink-0 px-4 py-2 font-bold transition-colors duration-300 ${luxe ? 'rounded-full text-[11px] uppercase tracking-[0.12em]' : 'rounded-lg text-[12px]'}`}
              style={{ color: on ? 'var(--site-on-accent)' : 'var(--site-ink-soft)' }}>
              {on && (
                <motion.span layoutId="ohp-town-tab" className={`absolute inset-0 ${luxe ? 'rounded-full' : 'rounded-lg'}`}
                  style={{ backgroundColor: 'var(--site-accent)', boxShadow: '0 6px 18px -8px rgba(var(--site-accent-rgb),.7)' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }} />
              )}
              <span className="relative">{s.label}</span>
            </a>
          )
        })}
      </div>
    </nav>
  )
}
