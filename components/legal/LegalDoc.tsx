'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import LuxeHero from '@/components/ui/LuxeHero'

// Privacy Policy / Terms of Service layout: the luxe header, a sticky table of contents built from
// the document's own section headings (highlighting the one you're reading), and the document in
// one card with gold-accented headings. The legal text itself is passed in untouched.
export default function LegalDoc({ kicker, icon, title, updated, children }: {
  kicker: string
  icon: LucideIcon
  title: React.ReactNode
  updated: string
  children: React.ReactNode
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [toc, setToc] = useState<{ id: string; label: string }[]>([])
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const heads = Array.from(body.querySelectorAll('h2'))
    heads.forEach((h, i) => { if (!h.id) h.id = `section-${i + 1}` })
    setToc(heads.map(h => ({ id: h.id, label: (h.textContent || '').replace(/^\s*\d+(\.\d+)*\.?\s+/, '') })))
    const io = new IntersectionObserver(entries => {
      const seen = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (seen[0]) setActive(seen[0].target.id)
    }, { rootMargin: '-20% 0px -70% 0px' })
    heads.forEach(h => io.observe(h))
    return () => io.disconnect()
  }, [])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <LuxeHero
        kicker={kicker}
        icon={icon}
        title={title}
        subtitle={`Last Updated: ${updated}`}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {toc.length > 0 && (
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-3xl border border-[#C9A24D]/25 bg-white/80 p-3 shadow-[0_24px_50px_-36px_rgba(139,115,85,.6)] [scrollbar-width:thin] dark:border-white/10 dark:bg-[#151517]/80">
              <p className="px-2.5 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#e8c97a]">On this page</p>
              {toc.map((t, i) => {
                const on = t.id === active
                return (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    className={`relative flex items-start gap-2 rounded-xl px-2.5 py-1.5 text-[12px] font-bold leading-snug transition-colors ${on ? 'text-[#111827] dark:text-white' : 'text-gray-500 hover:bg-[#C9A24D]/10 hover:text-[#111827] dark:text-white/50 dark:hover:text-white'}`}
                  >
                    {on && <motion.span layoutId="legal-toc" transition={{ type: 'spring', stiffness: 420, damping: 36 }} className="absolute inset-0 rounded-xl bg-[#fbf3df] ring-1 ring-[#C9A24D]/40 dark:bg-[#C9A24D]/15" />}
                    <span className={`relative w-5 shrink-0 tabular-nums ${on ? 'text-[#a8803a] dark:text-[#e8c97a]' : 'text-[#C9A24D]/70'}`}>{i + 1}.</span>
                    <span className="relative">{t.label}</span>
                  </a>
                )
              })}
            </div>
          </nav>
        )}

        <motion.div
          ref={bodyRef}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="legal-doc relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_30px_60px_-40px_rgba(139,115,85,.55)] dark:border-gray-800 dark:bg-[#151517] sm:p-10"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D]/70 to-transparent" />
          <style>{LEGAL_CSS}</style>
          {children}
        </motion.div>
      </div>
    </div>
  )
}

const LEGAL_CSS = `
.legal-doc section{padding-bottom:1.75rem;border-bottom:1px solid rgba(201,162,77,.16)}
.legal-doc section:last-of-type{border-bottom:0}
.legal-doc h2{font-family:ui-serif,Georgia,Cambria,"Times New Roman",Times,serif;font-weight:900 !important;letter-spacing:-.01em;color:#111827;scroll-margin-top:7rem;display:flex;align-items:center;gap:.6rem}
.legal-doc h2::before{content:"";flex:none;width:.5rem;height:1.6rem;border-radius:999px;background:linear-gradient(180deg,#C9A24D,#e8c97a)}
.dark .legal-doc h2{color:#fff}
.legal-doc h3{color:#8b7355 !important}
.dark .legal-doc h3{color:#e8c97a !important}
.legal-doc li::marker{color:#C9A24D}
.legal-doc strong{color:#111827}
.dark .legal-doc strong{color:#fff}
.legal-doc a:not([class*="px-"]){color:#8b7355;text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(201,162,77,.5)}
.dark .legal-doc a:not([class*="px-"]){color:#e8c97a}
`
