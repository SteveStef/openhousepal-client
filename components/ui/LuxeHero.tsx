'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
import BackArrow from '@/components/ui/BackArrow'
import type { LucideIcon } from 'lucide-react'

// The dark, gold-accented page header first built for Listing Spotlight, shared so every tab
// opens the same way: a deep gradient with soft gold light, a gold kicker, a serif title (the
// last word in gold italics reads best), compact glass stats on the right and an actions row
// underneath. Photos behind it only when a page passes `covers` (Listing Spotlight's homes) -
// every other tab keeps it clean. Purely presentational: pages pass their existing
// buttons/links in, nothing about what they do changes.
//
// The "alive" layer (all CSS, no images): a soft light that follows the cursor, slow drifting
// gold aurora, a faint architectural grid, a gold sweep along the top edge, a few twinkling
// sparkles and a shimmer through the gold title words. All of it stops under reduced-motion.
export default function LuxeHero({
  kicker, icon: Icon, title, subtitle, badge, kickerNote, aside, actions, tabs, covers = [], compact = false, className = '', backHref, backLabel, asideClassName = 'lg:w-[400px]', centered = false, titleClassName, subtitleClassName,
}: {
  kicker: string
  icon?: LucideIcon
  title: React.ReactNode
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  /** A small live note after the kicker on the same line, set off by a dash (e.g. Dash's "Updated now"). */
  kickerNote?: React.ReactNode
  /** Right-hand side next to the title - usually <LuxeStats/> and/or a primary button. */
  aside?: React.ReactNode
  /** A row under the title - quick actions, filters... */
  actions?: React.ReactNode
  /** A bar built into the bottom edge of the header - usually <LuxeTabs/> for the page's sections. */
  tabs?: React.ReactNode
  /** Background photos - only Listing Spotlight uses these. */
  covers?: string[]
  /** Tighter padding and a smaller title, for busy pages (Dash) where the content below matters most. */
  compact?: boolean
  className?: string
  /** A small round back arrow before the kicker (e.g. Discovery -> Open Houses). */
  backHref?: string
  backLabel?: string
  /** Width of the right-hand column on desktop (default 400px). */
  asideClassName?: string
  /** Everything centered, `actions` front and center, `aside` underneath (Opens' address bar). */
  centered?: boolean
  /** Overrides the title's text size (e.g. a bigger title on a compact header). */
  titleClassName?: string
  /** Extra classes for the subtitle (e.g. lg:max-w-none lg:whitespace-nowrap for one line). */
  subtitleClassName?: string
}) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (covers.length < 2) return
    const t = window.setInterval(() => setI(x => (x + 1) % covers.length), 5000)
    return () => window.clearInterval(t)
  }, [covers.length])
  // Cursor light - written straight to CSS variables so moving the mouse never re-renders.
  const ref = useRef<HTMLDivElement>(null)
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--lx-x', `${e.clientX - r.left}px`)
    el.style.setProperty('--lx-y', `${e.clientY - r.top}px`)
  }
  return (
    // Light mode: warm ivory + gold with dark ink, so it belongs on the light pages. Dark mode:
    // the deep near-black version.
    <div ref={ref} onMouseMove={onMove} className={`lx-hero group/lx relative isolate rounded-3xl border border-[#C9A24D]/30 bg-[#fbf7ef] text-[#111827] shadow-[0_24px_50px_-34px_rgba(139,115,85,.55)] dark:border-white/[0.07] dark:bg-[#0b0f0e] dark:text-white dark:shadow-[0_30px_60px_-30px_rgba(0,0,0,.6)] ${className}`}>
      <style>{LUXE_CSS}</style>
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      {covers.map((u, j) => (
        <img key={u + j} src={u} alt="" className={`lx-ken absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ${j === i ? 'opacity-50 dark:opacity-40' : 'opacity-0'}`} />
      ))}
      {covers.length > 0
        ? <div className="absolute inset-0 bg-gradient-to-r from-[#fbf7ef] via-[#fbf7ef]/90 to-[#fbf7ef]/30 dark:from-[#0b0f0e] dark:via-[#0b0f0e]/85 dark:to-[#0b0f0e]/35" />
        : <>
            <div className="absolute inset-0 bg-[radial-gradient(110%_130%_at_100%_0%,rgba(201,162,77,.22),transparent_55%),linear-gradient(135deg,#fffdf8_0%,#fbf6ec_55%,#f4ead7_100%)] dark:hidden" />
            <div className="absolute inset-0 hidden bg-[radial-gradient(120%_140%_at_100%_0%,rgba(201,162,77,.20),transparent_55%),linear-gradient(135deg,#0b0f0e_0%,#111827_55%,#1d1810_100%)] dark:block" />
          </>}
      <div className="lx-aurora-a pointer-events-none absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-[#C9A24D]/25 blur-3xl dark:bg-[#C9A24D]/25" />
      <div className="lx-aurora-b pointer-events-none absolute -top-32 left-1/3 h-72 w-[28rem] rounded-full bg-[#f3d9a0]/40 blur-3xl dark:bg-[#8b6a2b]/25" />
      <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/70 blur-3xl dark:hidden" />
      {covers.length === 0 && <div className="lx-grid pointer-events-none absolute inset-0" />}
      {Icon && covers.length === 0 && <Icon aria-hidden className="lx-mark pointer-events-none absolute -bottom-10 right-6 hidden h-56 w-56 text-[#C9A24D]/[0.10] sm:block dark:text-[#e8c97a]/[0.06]" strokeWidth={0.8} />}
      <div className="lx-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/lx:opacity-100" />
      <div className="lx-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
      {SPARKS.map((sp, k) => <span key={k} className="lx-spark pointer-events-none absolute" style={{ left: sp[0], top: sp[1], animationDelay: `${sp[2]}s` }} />)}
      </div>
      <div className={`relative ${compact ? 'p-4 sm:px-6 sm:py-4' : 'p-5 sm:p-8 lg:p-10'}`}>
        <div className={`flex flex-wrap items-center gap-2 ${centered ? 'justify-center' : 'justify-between'}`}>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-black uppercase tracking-[0.32em] text-[#8b7355] dark:text-[#e8c97a]">
            {backHref && (
              <BackArrow fallbackHref={backHref} label={backLabel} className="-my-1.5 mr-1 flex h-6 w-6 items-center justify-center rounded-full border border-[#C9A24D]/30 bg-white/80 text-[#8b7355] shadow-sm transition hover:-translate-x-0.5 hover:border-[#C9A24D] dark:border-white/15 dark:bg-white/[0.06] dark:text-[#e8c97a]" />
            )}
            {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="h-px w-8 bg-[#8b7355] dark:bg-[#e8c97a]" />} <span className="whitespace-nowrap">{kicker}</span>
            {/* The dash travels with its note - never left dangling at the end of a line on phones. */}
            {kickerNote && <span className="flex items-center gap-2"><span aria-hidden className="text-[#C9A24D]/70">-</span><span className="flex items-center gap-1.5 text-[9px] font-black normal-case tracking-[0.12em] text-[#8b7355]/85 dark:text-white/55">{kickerNote}</span></span>}
          </p>
          {/* Negative margin like the back arrow - a chip or stat pill here never makes the line taller. */}
          {/* Phones: its own single row that slides sideways (never wraps into the title). */}
          {badge && <div className="-mx-1 flex w-full min-w-0 items-center overflow-x-auto px-1 py-0.5 [scrollbar-width:none] sm:-my-2 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 sm:py-0">{badge}</div>}
        </div>
        <div className={`flex flex-col gap-4 ${centered ? 'items-center text-center' : 'lg:flex-row lg:items-start lg:justify-between'} ${compact ? 'mt-1.5' : 'mt-3 gap-5'}`}>
          <div className="min-w-0">
            <h1 className={`lx-title font-serif font-black leading-[1.04] [&_em]:font-light [&_em]:text-[#a8803a] dark:[&_em]:text-[#e8c97a] ${titleClassName || (compact ? 'text-[1.7rem] sm:text-4xl' : 'text-[2rem] sm:text-5xl')}`}>{title}</h1>
            {subtitle && <p className={`font-semibold text-gray-600 dark:text-white/65 ${centered ? 'mx-auto max-w-3xl' : 'max-w-xl'} ${compact ? 'mt-1.5 text-[13px]' : 'mt-3 text-sm'} ${subtitleClassName || ''}`}>{subtitle}</p>}
          </div>
          {aside && !centered && <div className={`flex min-w-0 shrink-0 flex-col items-center ${asideClassName}`}>{aside}</div>}
        </div>
        {actions && <div className={`${compact ? 'mt-4' : 'mt-6'} ${centered ? 'flex flex-col items-center' : ''}`}>{actions}</div>}
        {aside && centered && <div className="mt-4 flex justify-center">{aside}</div>}
      </div>
      {/* A tabs row that comes and goes (e.g. Signature's re-copy warning) unfolds and folds
          smoothly instead of popping in; one that's there from the start just renders. */}
      <AnimatePresence initial={false}>
        {tabs && (
          <motion.div
            key="lx-tabs"
            initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
            animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
            exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
            transition={{ height: { duration: 0.45, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.3, delay: 0.08 } }}
            className="rounded-b-3xl"
          >
            <div className="relative rounded-b-3xl border-t border-[#C9A24D]/20 bg-white/45 px-2 py-2 dark:border-white/[0.07] dark:bg-black/25 sm:px-4">
              {tabs}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Left/top %, twinkle delay - a handful of gold sparkles scattered over the header.
const SPARKS: [string, string, number][] = [['12%', '22%', 0], ['38%', '12%', 1.6], ['57%', '30%', 3.1], ['74%', '16%', 0.8], ['88%', '58%', 2.3], ['46%', '72%', 4]]

// The page's sections as one pill bar built into the bottom of a LuxeHero - the active pill
// glides between tabs. Scrolls sideways on phones.
export function LuxeTabs<T extends string>({ items, active, onChange, label, end, pinEnd = false, dense = false }: {
  items: { id: T; label: string; icon: React.ComponentType<{ className?: string }> }[]
  active: T
  onChange: (id: T) => void
  label: string
  /** Shown on the right end of the bar (status, a link...) - hidden on phones unless `pinEnd`. */
  end?: React.ReactNode
  /** Keep `end` on phones too (e.g. the page's main Create button). */
  pinEnd?: boolean
  /** Many tabs (Activity): tighter, labels only, so the whole row fits on a computer screen. */
  dense?: boolean
}) {
  const id = useRef(`lxt-${Math.random().toString(36).slice(2, 8)}`).current
  // On phones the bar scrolls sideways - keep the open tab centred in it (sideways only, the
  // page itself never jumps).
  const nav = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = nav.current
    const b = el?.querySelector<HTMLElement>('[aria-current="page"]')
    if (el && b && el.scrollWidth > el.clientWidth) el.scrollTo({ left: b.offsetLeft - el.clientWidth / 2 + b.offsetWidth / 2, behavior: 'smooth' })
  }, [active])
  // Fade whichever edge still hides tabs, so a phone user can tell the bar swipes (a "Shared"
  // tab sitting just past the edge looked like it didn't exist).
  const [edges, setEdges] = useState({ l: false, r: false })
  useEffect(() => {
    const el = nav.current
    if (!el) return
    const read = () => setEdges({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
    read()
    el.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', read)
    return () => { el.removeEventListener('scroll', read); window.removeEventListener('resize', read) }
  }, [items.length])
  const fade = edges.l || edges.r
    ? { WebkitMaskImage: `linear-gradient(to right, ${edges.l ? 'transparent, black 28px' : 'black, black'}, ${edges.r ? 'black calc(100% - 36px), transparent' : 'black'})`,
        maskImage: `linear-gradient(to right, ${edges.l ? 'transparent, black 28px' : 'black, black'}, ${edges.r ? 'black calc(100% - 36px), transparent' : 'black'})` }
    : undefined
  return (
    <div className="flex items-center gap-3">
    <nav ref={nav} style={fade} className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]" aria-label={label}>
      <div className={`flex min-w-max items-center ${dense ? 'gap-0.5' : 'gap-1'}`}>
        {items.map(t => {
          const on = t.id === active
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              aria-current={on ? 'page' : undefined}
              className={`relative flex items-center rounded-xl py-2 text-xs font-black transition-colors ${dense ? 'gap-1.5 px-2.5' : 'gap-2 px-3.5'} ${on ? 'text-white dark:text-[#111827]' : 'text-gray-500 hover:bg-[#C9A24D]/10 hover:text-[#111827] dark:text-white/55 dark:hover:bg-white/[0.06] dark:hover:text-white'}`}
            >
              {on && (
                <motion.span
                  layoutId={id}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-xl bg-[#111827] shadow-lg shadow-[#111827]/20 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:shadow-[#C9A24D]/25"
                />
              )}
              {!dense && <t.icon className={`relative h-3.5 w-3.5 shrink-0 ${on ? 'text-[#e8c97a] dark:text-[#111827]' : ''}`} />}
              <span className="relative">{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
    {end && <div className={`shrink-0 items-center gap-2 pr-1 ${pinEnd ? 'flex' : 'hidden md:flex'}`}>{end}</div>}
    </div>
  )
}

// Compact glass stat chips - no taller than a title line, with an optional one-line note.
export function LuxeStats({ stats, note, large = false }: {
  stats: { label: string; value: React.ReactNode; icon: LucideIcon; alert?: boolean; urgent?: boolean; onClick?: () => void; title?: string }[]
  note?: string
  /** Bigger tiles - for pages where the numbers are the point (Listing Spotlight). */
  large?: boolean
}) {
  return (
    <div className="w-full min-w-0">
      <div className="flex gap-2">
        {stats.map((st, i) => {
          const Tile = st.onClick ? motion.button : motion.div
          return (
          <Tile
            key={st.label}
            type={st.onClick ? 'button' : undefined}
            onClick={st.onClick}
            title={st.title}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30, delay: 0.08 + i * 0.06 }}
            whileTap={st.onClick ? { scale: 0.97 } : undefined}
            className={`flex min-w-0 flex-1 items-center rounded-xl border text-left ${st.onClick ? 'transition-shadow hover:-translate-y-0.5 hover:shadow-md' : ''} ${large ? 'gap-3 px-4 py-2.5' : 'gap-2 px-3 py-2'} ${st.urgent
            ? 'lx-urgent border-red-300 bg-red-50 text-red-700 dark:border-red-400/60 dark:bg-red-500/20 dark:text-white'
            : st.alert
              ? 'border-[#C9A24D]/50 bg-[#C9A24D]/10 dark:border-[#e8c97a]/50 dark:bg-[#C9A24D]/20'
              : 'border-gray-200/80 bg-white/80 dark:border-white/10 dark:bg-white/[0.07]'}`}>
            <st.icon className={`hidden shrink-0 sm:block ${large ? 'h-5 w-5' : 'h-3.5 w-3.5'} ${st.urgent ? 'text-red-500 dark:text-red-300' : 'text-[#8b7355] dark:text-[#e8c97a]'}`} />
            <div className="min-w-0">
              {/* A changed number pops once as it counts to its new value. */}
              <motion.p key={typeof st.value === 'number' ? 'n' : 'v'} className={`font-serif font-black leading-none tabular-nums ${large ? 'text-2xl sm:text-[1.75rem]' : 'text-lg'}`}>
                {typeof st.value === 'number' ? <PopOnChange value={st.value}><AnimatedNumber value={st.value} /></PopOnChange> : st.value}
              </motion.p>
              <p className={`font-black uppercase leading-tight tracking-tight sm:truncate sm:tracking-wide ${large ? 'mt-1 text-[8px] sm:text-[10px]' : 'mt-0.5 text-[8px] sm:text-[9px]'} ${st.urgent ? 'text-red-600/80 dark:text-white/60' : 'text-gray-500 dark:text-white/50'}`}>{st.label}</p>
            </div>
          </Tile>
          )
        })}
      </div>
      {note && <p className="mt-1.5 truncate text-center text-[10px] font-semibold text-gray-400 dark:text-white/40">{note}</p>}
    </div>
  )
}

// A tiny scale pulse whenever `value` changes after the first render.
function PopOnChange({ value, children }: { value: number; children: React.ReactNode }) {
  const first = useRef(true)
  const [pulse, setPulse] = useState(0)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setPulse(p => p + 1)
  }, [value])
  return (
    <motion.span key={pulse} className="inline-block origin-left" initial={pulse ? { scale: 1.18 } : false} animate={{ scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.span>
  )
}

// Glass pill for links/buttons inside the hero; `gold` for the one primary action.
export const luxePill = (gold = false) => gold
  ? 'lx-shine relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-6 py-3 text-sm font-black text-[#111827] shadow-xl shadow-[#C9A24D]/30 transition hover:-translate-y-0.5'
  : 'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-white/85 px-3.5 py-2 text-xs font-black text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D] hover:bg-[#C9A24D]/10 dark:border-white/15 dark:bg-white/[0.07] dark:text-white dark:shadow-none dark:hover:border-[#e8c97a]/70 dark:hover:bg-[#C9A24D]/20'

// The small rounded status chip for the hero's top-right corner (e.g. "Updated just now").
export const luxeChip = 'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-gray-500 sm:text-[10px] dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60'

export const LUXE_CSS = `
.lx-hero{--lx-x:70%;--lx-y:30%}
.lx-glow{background:radial-gradient(420px circle at var(--lx-x) var(--lx-y),rgba(201,162,77,.18),transparent 60%)}
.dark .lx-glow{background:radial-gradient(420px circle at var(--lx-x) var(--lx-y),rgba(232,201,122,.13),transparent 60%)}
.lx-grid{background-image:linear-gradient(rgba(139,115,85,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(139,115,85,.09) 1px,transparent 1px);background-size:34px 34px;-webkit-mask-image:radial-gradient(70% 90% at 85% 10%,#000,transparent 75%);mask-image:radial-gradient(70% 90% at 85% 10%,#000,transparent 75%)}
.dark .lx-grid{background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px)}
.lx-edge{background:linear-gradient(90deg,transparent 20%,#e8c97a 50%,transparent 80%);background-size:200% 100%;animation:lxEdge 7s ease-in-out infinite}
@keyframes lxEdge{0%{background-position:150% 0}100%{background-position:-50% 0}}
.lx-aurora-a{animation:lxDriftA 16s ease-in-out infinite alternate}
.lx-aurora-b{animation:lxDriftB 21s ease-in-out infinite alternate}
@keyframes lxDriftA{from{transform:translate(0,0) scale(1)}to{transform:translate(90px,-40px) scale(1.15)}}
@keyframes lxDriftB{from{transform:translate(0,0) scale(1)}to{transform:translate(-120px,30px) scale(.9)}}
.lx-mark{transform:rotate(-8deg);animation:lxMark 14s ease-in-out infinite alternate}
@keyframes lxMark{from{transform:rotate(-8deg) translateY(0)}to{transform:rotate(-3deg) translateY(-10px)}}
.lx-spark{width:3px;height:3px;border-radius:9999px;background:#e8c97a;box-shadow:0 0 8px 2px rgba(232,201,122,.65);opacity:0;animation:lxSpark 5.5s ease-in-out infinite}
@keyframes lxSpark{0%,100%{opacity:0;transform:scale(.4)}45%{opacity:.9;transform:scale(1)}60%{opacity:0;transform:scale(.6)}}
.lx-title em{background-image:linear-gradient(100deg,#8b6a2b 0%,#c9a24d 30%,#e8c97a 45%,#a8803a 60%,#8b6a2b 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:.08em;animation:lxGold 7s ease-in-out infinite}
.dark .lx-title em{background-image:linear-gradient(100deg,#c9a24d 0%,#e8c97a 30%,#fff3cf 45%,#e8c97a 60%,#c9a24d 100%)}
@keyframes lxGold{0%,100%{background-position:100% 0}50%{background-position:0 0}}
.lx-ken{animation:lxKen 18s ease-in-out infinite alternate}
@keyframes lxKen{from{transform:scale(1.04)}to{transform:scale(1.16)}}
.lx-shine:after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.55) 50%,transparent 65%);transform:translateX(-100%);animation:lxShine 3.2s ease-in-out infinite}
@keyframes lxShine{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.lx-title{animation:lxRise .7s cubic-bezier(.2,.8,.2,1) both}
.lx-urgent{animation:lxUrgent 2.2s ease-in-out infinite}
@keyframes lxUrgent{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.35)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}}
@keyframes lxRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.lx-ken,.lx-shine:after,.lx-title,.lx-title em,.lx-urgent,.lx-edge,.lx-aurora-a,.lx-aurora-b,.lx-mark,.lx-spark{animation:none}.lx-spark{opacity:.5}}
`
