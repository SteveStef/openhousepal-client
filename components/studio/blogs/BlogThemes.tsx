'use client'

import { LUXE_METALS, metalOf, metalStyle, type LuxeMetal } from '@/lib/luxeMetals'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock, Moon, Sun } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { resolveMediaUrl } from '@/lib/api-service'
import type { BlogThemeId } from '@/types'

// The looks an article can wear on the agent's Agent Hub. Classic (id 'luxe' - ivory + gold,
// serif) is the default; the agent can switch any article to another. Luxe (id 'luxe_plus') is
// the full OpenHousePal Luxe experience and is IDX only - every other plan can preview it.
export const BLOG_THEMES: { id: BlogThemeId; label: string; blurb: string; accent: string; bg: string; ink: string; paper: string; idx?: boolean }[] = [
  { id: 'luxe', label: 'Classic', blurb: 'Ivory and gold with serif headlines - the standard look', accent: '#C9A24D', bg: '#faf7f0', ink: '#111827', paper: '#ffffff' },
  { id: 'luxe_plus', label: 'Luxe', blurb: 'Cinematic cover, gold light and motion - the full OpenHousePal Luxe', accent: '#C9A24D', bg: '#f6efe0', ink: '#111827', paper: '#fffdf8', idx: true },
  { id: 'editorial', label: 'Editorial', blurb: 'A classic magazine page - black and white, big serif type', accent: '#111827', bg: '#ffffff', ink: '#0b0b0b', paper: '#ffffff' },
  { id: 'modern', label: 'Modern', blurb: 'Clean and bold - crisp sans-serif with a gold accent', accent: '#C9A24D', bg: '#f4f5f7', ink: '#0f172a', paper: '#ffffff' },
  { id: 'midnight', label: 'Midnight', blurb: 'Dark and dramatic with warm gold highlights', accent: '#e8c97a', bg: '#0b0f0e', ink: '#ffffff', paper: '#141416' },
]

export const blogTheme = (id?: string | null) => BLOG_THEMES.find(t => t.id === id) || BLOG_THEMES[0]

// A Luxe article's readable metal "ink" - the color its subheadings, bold words and accents wear,
// per reading mode. Silver's own tones are nearly white (or grey on cream), so it reads as a cool
// steel blue instead; gold and bronze are their deeper / brighter selves.
export const LUXE_INK: Record<LuxeMetal, { light: string; dark: string }> = {
  gold: { light: '#94701f', dark: '#e8c97a' },
  silver: { light: '#3f5f82', dark: '#a9c3e0' },
  bronze: { light: '#8a5531', dark: '#e3ae86' },
}

/** The accent an article's blocks use (bullets, eyebrows, quotes, the closing section). */
export function blogAccent(theme?: string | null, metal?: string | null): string {
  const id = blogTheme(theme).id
  if (id === 'editorial') return '#111827'
  if (id === 'luxe_plus') return metalOf(metal) === 'silver' ? '#7f9bbb' : LUXE_METALS[metalOf(metal)].base
  return '#C9A24D'
}

/** What the article's signature card should match: a Luxe article's metal, else its accent. */
export function blogSignatureMatch(theme?: string | null, metal?: string | null) {
  return { metal: blogTheme(theme).id === 'luxe_plus' ? metalOf(metal) : null, accent: blogAccent(theme, metal) }
}

// A tiny drawn preview of a theme - for the pickers (create flow + editor).
export function BlogThemeSwatch({ id, active }: { id: BlogThemeId; active?: boolean }) {
  const t = blogTheme(id)
  const serif = id !== 'modern'
  if (id === 'luxe_plus') {
    return (
      <div className={`relative h-24 w-full overflow-hidden rounded-xl ring-1 ${active ? 'ring-2 ring-[#C9A24D]' : 'ring-black/10 dark:ring-white/10'}`} style={{ background: '#f6efe0' }}>
        <div className="absolute inset-x-0 top-0 h-[58%] bg-[radial-gradient(90%_120%_at_100%_0%,rgba(201,162,77,.55),transparent_60%),linear-gradient(135deg,#0b0f0e,#111827_55%,#2a2218)]">
          <span className="absolute inset-1.5 rounded-md border border-[#e8c97a]/45" />
          <span className="absolute left-3 top-3 h-1 w-6 rounded-full bg-[#e8c97a]" />
          <span className="absolute left-3 top-[22px] h-2 w-3/5 rounded bg-white/90" />
          <span className="absolute left-3 top-[34px] h-2 w-2/5 rounded bg-gradient-to-r from-[#C9A24D] to-[#f1d58b]" />
          <span className="absolute right-4 top-4 h-1 w-1 rounded-full bg-[#fff3cf] shadow-[0_0_6px_2px_rgba(232,201,122,.8)]" />
        </div>
        <div className="absolute inset-x-3 bottom-2.5 space-y-1">
          {[100, 90].map((w, i) => <div key={i} className="h-1 rounded" style={{ width: `${w}%`, background: '#111827', opacity: 0.18 }} />)}
        </div>
      </div>
    )
  }
  return (
    <div className={`relative h-24 w-full overflow-hidden rounded-xl ring-1 ${active ? 'ring-2 ring-[#C9A24D]' : 'ring-black/10 dark:ring-white/10'}`} style={{ background: t.bg }}>
      {id === 'luxe' && <div className="absolute inset-0 bg-[radial-gradient(90%_90%_at_100%_0%,rgba(201,162,77,.35),transparent_60%)]" />}
      <div className="absolute inset-x-3 top-3">
        <div className="h-1 w-8 rounded-full" style={{ background: t.accent }} />
        <div className={`mt-2 h-2.5 w-4/5 rounded ${serif ? '' : 'rounded-sm'}`} style={{ background: t.ink, opacity: 0.85 }} />
        <div className="mt-1 h-2.5 w-3/5 rounded" style={{ background: id === 'luxe' || id === 'midnight' ? t.accent : t.ink, opacity: id === 'editorial' ? 0.85 : 0.9 }} />
        <div className="mt-3 space-y-1">
          {[100, 92, 96].map((w, i) => <div key={i} className="h-1 rounded" style={{ width: `${w}%`, background: t.ink, opacity: 0.18 }} />)}
        </div>
      </div>
      {id === 'editorial' && <div className="absolute inset-x-3 top-[46px] h-px bg-black/30" />}
    </div>
  )
}

// Same words, last one in the theme's gold italic (Luxe / Midnight only).
function TitleWords({ text, gold }: { text: string; gold: boolean }) {
  const i = text.trim().lastIndexOf(' ')
  if (!gold || i < 0) return <>{text}</>
  return <>{text.slice(0, i + 1)}<em className="blog-gold-em font-light">{text.slice(i + 1)}</em></>
}

const THEME_CSS = `
.blog-gold-em{background:linear-gradient(100deg,#8b6a2b 0%,#C9A24D 30%,#f1d58b 50%,#C9A24D 70%,#8b6a2b 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:blogEm 7s ease-in-out infinite;padding-right:.05em}
@keyframes blogEm{0%,100%{background-position:100% 0}50%{background-position:0% 0}}
.blog-theme-modern .blog-body h2,.blog-theme-modern .blog-body h3{font-family:inherit!important;font-weight:900;letter-spacing:-.02em}
.blog-theme-editorial .blog-body > div > p:first-of-type::first-letter{float:left;font-family:ui-serif,Georgia,serif;font-size:3.6em;line-height:.8;padding:.08em .1em 0 0;font-weight:900;color:#0b0b0b}
.dark.blog-theme-editorial .blog-body > div > p:first-of-type::first-letter{color:#fff}
.blog-theme-editorial .blog-body p{font-family:ui-serif,Georgia,serif;font-size:1.08rem}
.blog-theme-luxe .blog-body h2,.blog-theme-midnight .blog-body h2{position:relative;padding-left:.9rem}
.blog-theme-luxe .blog-body h2::before,.blog-theme-midnight .blog-body h2::before{content:"";position:absolute;left:0;top:.2em;bottom:.2em;width:4px;border-radius:99px;background:linear-gradient(180deg,#C9A24D,#e8c97a)}
@media (prefers-reduced-motion:reduce){.blog-gold-em{animation:none}}
`

export interface ThemedArticleProps {
  theme?: string | null
  title: string
  subtitle?: string | null
  category?: string | null
  coverUrl?: string | null
  publishedAt?: string | null
  readingTimeMinutes?: number
  agent: { name: string; title?: string | null; brokerage?: string | null; photoUrl?: string | null }
  backHref?: string
  hubHref?: string
  children: React.ReactNode
  /** Rendered after the author card (e.g. the agent's signature card). */
  afterArticle?: React.ReactNode | ((dark: boolean) => React.ReactNode)
  /** Luxe finish (Luxe theme only): gold, silver or bronze. */
  metal?: string | null
  /** The agent's signature card closes the article: "Written by" moves to the top byline and the
   *  bottom author card is dropped (the signature already introduces them). */
  signatureOn?: boolean
  /** A small embedded example (theme pickers): no fixed progress bar, no page-level dark class. */
  preview?: boolean
  /** Force light/dark (previews); otherwise the reader's choice, defaulting to the theme's own. */
  mode?: 'light' | 'dark'
  /** Show the floating Light / Dark button. */
  readerToggle?: boolean
}

const READER_KEY = 'ohp-blog-reader-mode'

// The reader's Light / Dark choice for articles (remembered per browser). Light themes read dark
// text on light paper and dark themes the reverse - never the app's own dark mode, which used to
// leave pale text on ivory pages for anyone who had dark mode switched on.
function useReaderMode(natural: 'light' | 'dark', forced?: 'light' | 'dark', preview?: boolean) {
  const [pref, setPref] = useState<'light' | 'dark' | null>(null)
  useEffect(() => {
    if (forced || preview) return
    try { const v = localStorage.getItem(READER_KEY); if (v === 'light' || v === 'dark') setPref(v) } catch {}
  }, [forced, preview])
  const mode = forced || pref || natural
  useEffect(() => {
    if (preview) return
    const html = document.documentElement
    const had = html.classList.contains('dark')
    html.classList.toggle('dark', mode === 'dark')
    return () => { html.classList.toggle('dark', had) }
  }, [mode, preview])
  const set = (m: 'light' | 'dark') => { setPref(m); try { localStorage.setItem(READER_KEY, m) } catch {} }
  return [mode, set] as const
}

// Each theme's palette for the mode it's being read in.
function themePalette(t: (typeof BLOG_THEMES)[number], dark: boolean) {
  if (!dark) return { bg: t.id === 'midnight' ? '#faf7f0' : t.bg, ink: t.id === 'midnight' ? '#111827' : t.ink }
  const bg = t.id === 'luxe' || t.id === 'luxe_plus' ? '#0f0d0a' : t.id === 'editorial' ? '#0b0b0b' : t.id === 'modern' ? '#0b1020' : t.bg
  return { bg, ink: '#f5f5f4' }
}

function ReaderToggle({ mode, onChange }: { mode: 'light' | 'dark'; onChange: (m: 'light' | 'dark') => void }) {
  const dark = mode === 'dark'
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={() => onChange(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[11px] font-black uppercase tracking-widest shadow-[0_14px_34px_-14px_rgba(0,0,0,.55)] transition hover:-translate-y-0.5 ${dark ? 'border-white/15 bg-[#141416]/85 text-white' : 'border-black/10 bg-white/90 text-[#111827]'}`}
    >
      <span className="relative h-4 w-4">
        <AnimatePresence initial={false} mode="wait">
          <motion.span key={mode} initial={{ rotate: -90, scale: 0, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} exit={{ rotate: 90, scale: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="absolute inset-0">
            {dark ? <Moon className="h-4 w-4 text-[#e8c97a]" /> : <Sun className="h-4 w-4 text-[#C9A24D]" />}
          </motion.span>
        </AnimatePresence>
      </span>
      {dark ? 'Dark' : 'Light'}
    </motion.button>
  )
}

// A whole public article in its theme: reading-progress bar, the themed hero (title, byline,
// cover), the body, and the agent card at the end.
export function BlogThemedArticle({ theme, title, subtitle, category, coverUrl, publishedAt, readingTimeMinutes, agent, backHref, hubHref, children, afterArticle, preview, mode: forcedMode, readerToggle, metal, signatureOn }: ThemedArticleProps) {
  const t = blogTheme(theme)
  const [mode, setMode] = useReaderMode(t.id === 'midnight' ? 'dark' : 'light', forcedMode, preview)
  const dark = mode === 'dark'
  const pal = themePalette(t, dark)
  const after = typeof afterArticle === 'function' ? afterArticle(dark) : afterArticle
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    if (preview) return
    const onScroll = () => {
      const h = document.documentElement
      const max = h.scrollHeight - h.clientHeight
      setProgress(max > 0 ? Math.min(1, h.scrollTop / max) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [preview])
  const date = publishedAt ? new Date(publishedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : null
  const cover = coverUrl ? resolveMediaUrl(coverUrl) : ''
  const serif = t.id !== 'modern'

  const byline = (
    <div className={`flex items-center gap-3 ${t.id === 'editorial' ? 'justify-center' : ''}`}>
      {agent.photoUrl && <img src={resolveMediaUrl(agent.photoUrl)} alt={agent.name} className={`${signatureOn ? 'h-14 w-14' : 'h-10 w-10'} rounded-full object-cover ring-2`} style={{ ['--tw-ring-color' as any]: t.accent }} />}
      <div className="text-left">
        {signatureOn && <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: t.id === 'editorial' ? '#6b7280' : t.accent }}>Written by</p>}
        <p className={`${signatureOn ? `text-lg ${serif ? 'font-serif' : ''}` : 'text-sm'} font-black`} style={{ color: pal.ink }}>{agent.name}</p>
        {signatureOn && (agent.title || agent.brokerage) && <p className="text-xs font-bold opacity-60" style={{ color: pal.ink }}>{[agent.title, agent.brokerage].filter(Boolean).join(' · ')}</p>}
        <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold opacity-70" style={{ color: pal.ink }}>
          {date && <span>{date}</span>}
          {date && readingTimeMinutes ? <span>·</span> : null}
          {readingTimeMinutes ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {readingTimeMinutes} min read</span> : null}
        </p>
      </div>
    </div>
  )

  if (t.id === 'luxe_plus') {
    return (
      <>
        <LuxeArticle {...{ title, subtitle, category, cover, date, readingTimeMinutes, agent, backHref, hubHref, progress, dark, preview, after, signatureOn }} metal={metalOf(metal)}>{children}</LuxeArticle>
        {readerToggle && !preview && <ReaderToggle mode={mode} onChange={setMode} />}
      </>
    )
  }

  return (
    <div className={`${dark ? 'dark' : ''} blog-theme-${t.id}`}>
      <style>{THEME_CSS}</style>
      {readerToggle && !preview && <ReaderToggle mode={mode} onChange={setMode} />}
      <div className={`${preview ? 'hidden' : 'fixed'} inset-x-0 top-0 z-50 h-[3px]`} aria-hidden>
        <div className="h-full origin-left transition-transform duration-150" style={{ transform: `scaleX(${progress})`, background: `linear-gradient(90deg, ${t.accent}, ${t.id === 'editorial' ? '#555' : '#f1d58b'})` }} />
      </div>
      <main className={`${preview ? '' : 'min-h-screen'} transition-colors duration-500 ${t.id === 'modern' ? 'font-sans' : ''}`} style={{ background: pal.bg }}>
        {/* Hero */}
        <header className="relative overflow-hidden">
          {t.id === 'luxe' && (
            <>
              <div className={`pointer-events-none absolute inset-0 ${dark ? 'bg-[radial-gradient(110%_130%_at_100%_0%,rgba(201,162,77,.22),transparent_55%),linear-gradient(135deg,#0b0f0e_0%,#111827_55%,#1d1810_100%)]' : 'bg-[radial-gradient(110%_130%_at_100%_0%,rgba(201,162,77,.22),transparent_55%),linear-gradient(135deg,#fffdf8_0%,#fbf6ec_55%,#f4ead7_100%)]'}`} />
              <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(139,115,85,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(139,115,85,.06)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(70%_80%_at_80%_0%,#000,transparent_75%)]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D] to-transparent" />
            </>
          )}
          {t.id === 'midnight' && dark && (
            <>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_130%_at_100%_0%,rgba(201,162,77,.22),transparent_55%),linear-gradient(135deg,#0b0f0e_0%,#111827_55%,#1d1810_100%)]" />
              <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#C9A24D]/15 blur-3xl" />
            </>
          )}
          <div className={`relative mx-auto px-5 pb-10 pt-6 ${t.id === 'editorial' ? 'max-w-4xl text-center' : 'max-w-4xl'}`}>
            {backHref && (
              <Link href={backHref} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition hover:-translate-x-0.5 ${dark ? 'bg-white/10 text-white hover:bg-white/15' : 'border border-black/10 bg-white/80 text-[#111827] shadow-sm'}`}>
                <ArrowLeft className="h-3.5 w-3.5" /> All Articles
              </Link>
            )}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
              {category && (
                <p className={`mt-8 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.3em] ${t.id === 'editorial' ? 'justify-center' : ''}`} style={{ color: t.id === 'editorial' ? '#6b7280' : t.accent }}>
                  {t.id !== 'modern' && <span className="h-px w-8" style={{ background: t.accent }} />}{category}
                </p>
              )}
              <h1
                className={`${category ? 'mt-3' : 'mt-8'} ${serif ? 'font-serif' : 'font-sans'} ${t.id === 'editorial' ? 'text-[2.6rem] sm:text-6xl' : 'text-[2.3rem] sm:text-5xl'} font-black leading-[1.05] tracking-[-0.02em]`}
                style={{ color: pal.ink }}
              >
                <TitleWords text={title} gold={t.id === 'luxe' || t.id === 'midnight'} />
              </h1>
              {subtitle && <p className={`mt-4 text-lg font-medium leading-relaxed opacity-80 sm:text-xl ${t.id === 'editorial' ? 'mx-auto max-w-2xl font-serif italic' : ''}`} style={{ color: pal.ink }}>{subtitle}</p>}
              {t.id === 'editorial' && <div className={`mx-auto mt-6 h-px w-24 ${dark ? 'bg-white/40' : 'bg-black/40'}`} />}
              <div className="mt-6">{byline}</div>
            </motion.div>
          </div>
        </header>

        {cover && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }} className={`mx-auto px-5 ${t.id === 'modern' ? 'max-w-5xl' : 'max-w-4xl'}`}>
            <div className={`overflow-hidden ${t.id === 'editorial' ? 'rounded-none' : 'rounded-[28px]'} ${t.id === 'luxe' ? 'bg-gradient-to-br from-[#f1d58b] via-white to-[#C9A24D] p-1.5 shadow-[0_40px_80px_-40px_rgba(139,115,85,.7)]' : 'shadow-[0_30px_70px_-40px_rgba(0,0,0,.6)]'}`}>
              <img src={cover} alt="" className={`aspect-[16/9] w-full object-cover ${t.id === 'luxe' ? 'rounded-[22px]' : ''}`} />
            </div>
          </motion.div>
        )}

        <article className="mx-auto max-w-4xl px-5 pb-20">
          <div className={`blog-body ${t.id === 'luxe' || t.id === 'midnight' ? 'mt-10 rounded-[28px] border p-6 sm:p-10' : 'mt-10'} ${(t.id === 'luxe' || t.id === 'midnight') && !dark ? 'border-[#C9A24D]/20 bg-white shadow-[0_30px_60px_-46px_rgba(139,115,85,.7)]' : ''} ${(t.id === 'luxe' || t.id === 'midnight') && dark ? 'border-white/10 bg-[#141416]' : ''}`}>
            {children}
          </div>

          {!signatureOn && <div className={`mt-10 flex items-center gap-4 rounded-[24px] border p-5 ${dark ? 'border-white/10 bg-[#141416]' : 'border-black/[0.07] bg-white shadow-[0_20px_44px_-34px_rgba(0,0,0,.4)]'}`}>
            {agent.photoUrl && <img src={resolveMediaUrl(agent.photoUrl)} alt={agent.name} className="h-14 w-14 rounded-full object-cover" />}
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: t.id === 'editorial' ? '#6b7280' : t.accent }}>Written by</p>
              <p className={`font-black ${serif ? 'font-serif text-lg' : ''}`} style={{ color: pal.ink }}>{agent.name}</p>
              <p className="text-xs font-bold opacity-60" style={{ color: pal.ink }}>{agent.title ? `${agent.title} · ` : ''}{agent.brokerage}</p>
              {hubHref && <Link href={hubHref} className="mt-1 inline-block text-xs font-black hover:underline" style={{ color: t.id === 'editorial' ? (dark ? '#fff' : '#111827') : t.accent }}>Visit my Agent Hub →</Link>}
            </div>
          </div>}
          {after}
        </article>
      </main>
    </div>
  )
}

// ---------- Luxe (luxe_plus) ----------
// The full OpenHousePal Luxe article: a cinematic midnight cover (the cover photo drifting under
// gold light), a gold frame that draws itself, a light leak and sparks on entry, a gold glint
// through the headline, then the story on ivory paper with a gold drop cap, gold-ruled headings
// and a midnight-and-gold author card. Reduced motion keeps every layer, just still.
const LX_SPARKS: [string, string, number][] = [['10%', '64%', 0], ['26%', '30%', 1.4], ['48%', '72%', 2.8], ['66%', '24%', 0.6], ['82%', '58%', 2.1], ['92%', '30%', 3.4]]

function LuxeArticle({ title, subtitle, category, cover, date, readingTimeMinutes, agent, backHref, hubHref, children, dark, preview, after, metal = 'gold', signatureOn }: {
  title: string; subtitle?: string | null; category?: string | null; cover: string; date: string | null; readingTimeMinutes?: number
  agent: ThemedArticleProps['agent']; backHref?: string; hubHref?: string; progress: number; children: React.ReactNode
  dark?: boolean; preview?: boolean; after?: React.ReactNode; metal?: LuxeMetal; signatureOn?: boolean
}) {
  const i = title.trim().lastIndexOf(' ')
  return (
    <div className={`blog-theme-luxe_plus ${dark ? 'dark' : ''}`} style={{ ...metalStyle(metal), '--m-ink': LUXE_INK[metal].light, '--m-ink-d': LUXE_INK[metal].dark } as React.CSSProperties}>
      <style>{LUXE_CSS}</style>
      <main className={`${preview ? '' : 'min-h-screen'} transition-colors duration-500 ${dark ? 'bg-[#0b0f0e]' : 'bg-[#f6efe0]'}`}>
        <header className={`relative isolate flex ${preview ? 'min-h-[440px]' : cover ? 'min-h-[58svh]' : ''} flex-col overflow-hidden bg-[#0b0f0e] text-white`}>
          {cover ? <img src={cover} alt="" className="lxa-ken absolute inset-0 -z-20 h-full w-full object-cover" /> : null}
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(110%_90%_at_100%_0%,rgba(var(--m-rgb),.38),transparent_55%),linear-gradient(180deg,rgba(11,15,14,.55)_0%,rgba(11,15,14,.25)_35%,rgba(11,15,14,.92)_100%)]" />
          {!cover && <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,#0b0f0e,#111827_55%,#2a2218)]" />}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="lxa-leak absolute inset-0" />
            <div className="absolute inset-3 sm:inset-5">
              <span className="lxa-fx absolute inset-x-0 top-0 h-px" /><span className="lxa-fx lxa-fx-b absolute inset-x-0 bottom-0 h-px" />
              <span className="lxa-fy absolute inset-y-0 left-0 w-px" /><span className="lxa-fy absolute inset-y-0 right-0 w-px" />
            </div>
            {LX_SPARKS.map(([l, tp, d], k) => <span key={k} className="lxa-spark absolute" style={{ left: l, top: tp, animationDelay: `${d + 1}s` }} />)}
          </div>
          <div className={`relative mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 pt-8 sm:px-10 ${cover ? 'pb-14' : 'pb-20'}`}>
            {backHref && (
              <Link href={backHref} className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:-translate-x-0.5 hover:border-[color:var(--m-light)]">
                <ArrowLeft className="h-3.5 w-3.5" /> All Articles
              </Link>
            )}
            <div className={`mt-auto ${cover ? 'pt-16' : 'pt-10'}`}>
              {category && (
                <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.34em] text-[color:var(--m-light)]">
                  <span className="h-px w-10 bg-gradient-to-r from-transparent to-[color:var(--m-light)]" />{category}
                </motion.p>
              )}
              <h1 className="mt-4 font-serif text-[2.5rem] font-black leading-[1.02] tracking-[-0.02em] sm:text-6xl">
                {title.split(' ').map((w, k, all) => (
                  <span key={k} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                    <motion.span
                      className={`inline-block ${i >= 0 && k === all.length - 1 ? 'lxa-glint font-light italic' : ''}`}
                      initial={{ y: '105%', opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.8, delay: 0.35 + k * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    >{w}{k < all.length - 1 ? ' ' : ''}</motion.span>
                  </span>
                ))}
              </h1>
              {subtitle && <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.7 }} className="mt-5 max-w-2xl text-lg font-medium leading-relaxed text-white/75 sm:text-xl">{subtitle}</motion.p>}
              {signatureOn ? (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.85 }} className="mt-7 flex w-fit max-w-full items-center gap-4 rounded-2xl border border-white/15 bg-white/[0.07] py-3 pl-3 pr-6">
                  {agent.photoUrl && <img src={resolveMediaUrl(agent.photoUrl)} alt={agent.name} className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-[color:var(--m-base)] ring-offset-2 ring-offset-[#111827]" />}
                  <div className="min-w-0 text-left">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[color:var(--m-light)]">Written by</p>
                    <p className="font-serif text-xl font-black leading-tight">{agent.name}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-white/60">
                      {[agent.title, agent.brokerage].filter(Boolean).join(' · ')}
                      {date && <><span>·</span><span>{date}</span></>}
                      {readingTimeMinutes ? <><span>·</span><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {readingTimeMinutes} min read</span></> : null}
                    </p>
                  </div>
                </motion.div>
              ) : (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.85 }} className="mt-7 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.08] py-1.5 pl-1.5 pr-5">
                  {agent.photoUrl && <img src={resolveMediaUrl(agent.photoUrl)} alt={agent.name} className="h-10 w-10 rounded-full object-cover ring-2 ring-[color:var(--m-base)]" />}
                  <div className="text-left">
                    <p className="text-sm font-black">{agent.name}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-white/60">
                      {date && <span>{date}</span>}
                      {date && readingTimeMinutes ? <span>·</span> : null}
                      {readingTimeMinutes ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {readingTimeMinutes} min read</span> : null}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
          <div aria-hidden className="h-px w-full bg-gradient-to-r from-transparent via-[color:var(--m-light)] to-transparent" />
        </header>

        <article className="relative mx-auto max-w-4xl px-5 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative -mt-10 rounded-[30px] bg-gradient-to-br from-[color:var(--m-light)] via-[#fffdf8] to-[color:var(--m-base)] p-[1.5px] shadow-[0_50px_100px_-50px_rgba(var(--m-deep-rgb),.9)]"
          >
            <div className={`blog-body lxa-body relative overflow-hidden rounded-[28.5px] p-6 sm:p-11 ${dark ? 'bg-[radial-gradient(120%_60%_at_100%_0%,rgba(var(--m-rgb),.14),transparent_55%),linear-gradient(180deg,#141416,#101012)]' : 'bg-[radial-gradient(120%_60%_at_100%_0%,rgba(var(--m-rgb),.12),transparent_55%),linear-gradient(180deg,#fffdf8,#fffaf0)]'}`}>
              <span aria-hidden className="lxa-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
              {children}
            </div>
          </motion.div>

          {!signatureOn && <div className="relative mt-10 overflow-hidden rounded-[26px] bg-[radial-gradient(120%_140%_at_100%_0%,rgba(var(--m-rgb),.3),transparent_55%),linear-gradient(135deg,#0b0f0e,#111827_55%,#2a2218)] p-6 text-white shadow-[0_30px_60px_-34px_rgba(17,24,39,.9)]">
            <span aria-hidden className="lxa-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
            <div className="flex items-center gap-4">
              {agent.photoUrl && <img src={resolveMediaUrl(agent.photoUrl)} alt={agent.name} className="h-16 w-16 rounded-full object-cover ring-2 ring-[color:var(--m-base)] ring-offset-2 ring-offset-[#111827]" />}
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[color:var(--m-light)]">Written by</p>
                <p className="font-serif text-2xl font-black">{agent.name}</p>
                <p className="text-xs font-bold text-white/55">{agent.title ? `${agent.title} · ` : ''}{agent.brokerage}</p>
              </div>
            </div>
            {hubHref && (
              <Link href={hubHref} className="lxa-cta relative mt-5 inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[color:var(--m-mid)] via-[color:var(--m-base)] to-[color:var(--m-light)] px-5 py-2.5 text-xs font-black text-[#111827] shadow-[0_14px_30px_-12px_rgba(var(--m-rgb),.8)] transition hover:-translate-y-0.5">
                Visit my Agent Hub →
              </Link>
            )}
          </div>}
          {after}
        </article>
      </main>
    </div>
  )
}

const LUXE_CSS = `
.lxa-ken{animation:lxaKen 22s ease-out both}
@keyframes lxaKen{from{transform:scale(1.14)}to{transform:scale(1.02)}}
.lxa-leak{background:linear-gradient(105deg,transparent 30%,rgba(var(--m-rgb),.32) 45%,rgba(var(--m-pale-rgb),.3) 50%,rgba(var(--m-rgb),.26) 55%,transparent 70%);mix-blend-mode:screen;transform:translateX(-110%);animation:lxaLeak 3s .6s cubic-bezier(.45,0,.2,1) forwards}
@keyframes lxaLeak{0%{transform:translateX(-110%);opacity:0}15%{opacity:1}100%{transform:translateX(110%);opacity:0}}
.lxa-fx{background:linear-gradient(90deg,transparent,rgba(var(--m-light-rgb),.6),transparent);transform:scaleX(0);animation:lxaDrawX 1.6s .4s cubic-bezier(.65,0,.35,1) forwards}
.lxa-fx-b{animation-delay:.7s}
.lxa-fy{background:linear-gradient(180deg,transparent,rgba(var(--m-light-rgb),.45),transparent);transform:scaleY(0);animation:lxaDrawY 1.6s .55s cubic-bezier(.65,0,.35,1) forwards}
@keyframes lxaDrawX{to{transform:scaleX(1)}}
@keyframes lxaDrawY{to{transform:scaleY(1)}}
.lxa-spark{width:4px;height:4px;border-radius:999px;background:radial-gradient(circle,var(--m-pale),var(--m-base) 60%,transparent 70%);box-shadow:0 0 10px 2px rgba(var(--m-light-rgb),.6);opacity:0;animation:lxaSpark 8s ease-in-out infinite}
@keyframes lxaSpark{0%{opacity:0;transform:translateY(0) scale(.5)}25%{opacity:.95;transform:translateY(-22px) scale(1)}100%{opacity:0;transform:translateY(-90px) scale(.6)}}
.lxa-glint{background-image:linear-gradient(100deg,var(--m-base) 0%,var(--m-light) 35%,var(--m-pale) 50%,var(--m-light) 65%,var(--m-base) 100%);background-size:240% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:lxaGlint 6s 1.6s ease-in-out infinite;padding-right:.06em}
@keyframes lxaGlint{0%,100%{background-position:100% 0}50%{background-position:0% 0}}
.lxa-edge{background:linear-gradient(90deg,transparent 10%,var(--m-pale) 50%,transparent 90%);background-size:200% 100%;animation:lxaEdge 6s ease-in-out infinite}
@keyframes lxaEdge{0%{background-position:150% 0}100%{background-position:-50% 0}}
.lxa-cta:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.55) 50%,transparent 65%);transform:translateX(-100%);animation:lxaShine 3.4s ease-in-out infinite}
@keyframes lxaShine{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.lxa-body .blog-article > p:first-of-type::first-letter{float:left;font-family:ui-serif,Georgia,serif;font-size:3.8em;line-height:.8;padding:.08em .12em 0 0;font-weight:900;background:linear-gradient(135deg,var(--m-deep),var(--m-base) 45%,var(--m-light));-webkit-background-clip:text;background-clip:text;color:transparent}
.lxa-body h2{position:relative;padding-top:1.4rem!important}
.lxa-body h2::before{content:"";position:absolute;left:0;top:.35rem;width:44px;height:2px;border-radius:2px;background:linear-gradient(90deg,var(--m-ink),var(--m-light));box-shadow:0 0 8px rgba(var(--m-rgb),.6)}
.dark .lxa-body h2::before{background:linear-gradient(90deg,var(--m-ink-d),var(--m-deep))}
.lxa-body .blog-article>h3{color:var(--m-ink)!important}
.dark .lxa-body .blog-article>h3{color:var(--m-ink-d)!important}
.lxa-body .blog-article>p strong,.lxa-body .blog-article li strong{color:var(--m-ink)}
.dark .lxa-body .blog-article>p strong,.dark .lxa-body .blog-article li strong{color:var(--m-ink-d)}
.lxa-body blockquote{border-left:0!important;padding-left:1.5rem!important;background:linear-gradient(90deg,rgba(var(--m-rgb),.12),transparent);border-radius:0 18px 18px 0;box-shadow:inset 3px 0 0 var(--m-base)}
.lxa-body img{box-shadow:0 0 0 1px rgba(var(--m-rgb),.35),0 30px 60px -36px rgba(var(--m-deep-rgb),.8)!important}
@media (prefers-reduced-motion:reduce){.lxa-ken,.lxa-leak,.lxa-spark,.lxa-glint,.lxa-edge,.lxa-cta:after{animation:none}.lxa-fx,.lxa-fy{animation:none;transform:none}}
`
