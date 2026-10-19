'use client'

// "{first}'s Showcase" on the agent's IDX site (the glowing tab in SiteHeader): the visitor's own
// Showcase - the very same page as on OpenHousePal, framed under the site's header and wearing the
// site's colour (?accent= -> lib/accentRecolor) - with a strip on top: whose it is, what's new,
// "Change my search" (the site's Showcase builder, started from their current search) and the
// whole site's search one tap away.
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Expand, Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { saveVisitor, useVisitor } from '@/lib/visitor'
import ShowcaseBuilder, { type BuilderCriteria } from './ShowcaseBuilder'

const OHP_BASE_DOMAIN = process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com'

export interface MyShowcaseSummary {
  code: string
  name: string | null
  first_name: string | null
  homes: number
  new_this_week: number
  criteria: BuilderCriteria & { drawn_area?: boolean }
}

export default function MyShowcase({ summary, siteId, basePrefix, accent, agent, areas, headingClass = '' }: {
  summary: MyShowcaseSummary
  siteId: string
  basePrefix: string
  accent: string
  agent: { name?: string | null; photo_url?: string | null }
  areas: { name: string; state?: string | null; slug: string; photo?: string | null }[]
  headingClass?: string
}) {
  const visitor = useVisitor()
  const [editing, setEditing] = useState(false)
  const first = summary.first_name || visitor?.firstName || ''
  // Remember it on this device (an opened link may be the first time the site sees them).
  useEffect(() => { saveVisitor({ name: summary.name || undefined, showcase: summary.code }) }, [summary.code, summary.name])

  const tail = `/showcase/${encodeURIComponent(summary.code)}?accent=${encodeURIComponent(accent.replace('#', ''))}`
  const src = basePrefix.startsWith('/ohp-site-render/') ? tail : `https://${OHP_BASE_DOMAIN}${tail}`
  const fullScreen = `${basePrefix}/showcase/${encodeURIComponent(summary.code)}`
  const where = summary.criteria.center_lat != null && summary.criteria.radius_miles
    ? `${summary.criteria.radius_miles} mi around ${(summary.criteria.center_address || 'your home').split(',')[0]}`
    : summary.criteria.cities?.length ? summary.criteria.cities.map(c => c.split(',')[0].toLowerCase().replace(/(^|\s)\w/g, m => m.toUpperCase())).slice(0, 3).join(', ')
      : summary.criteria.school_districts?.length ? summary.criteria.school_districts[0].split(',')[0].toLowerCase().replace(/(^|\s)\w/g, m => m.toUpperCase())
        : summary.criteria.drawn_area ? 'The area drawn on the map' : null
  // Their search can be changed here once the site knows their email (it saves to that contact);
  // otherwise the Showcase's own "Change your search" (inside it) does it.
  const canEdit = !!visitor?.email

  if (editing) {
    return (
      <div>
        <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-6">
          <button type="button" onClick={() => setEditing(false)} className="text-sm font-black underline-offset-4 hover:underline" style={{ color: 'var(--site-muted)' }}>&larr; Back to my Showcase</button>
        </div>
        <ShowcaseBuilder siteId={siteId} basePrefix={basePrefix} accent={accent} agent={agent} areas={areas} mode="edit" initial={summary.criteria} headingClass={headingClass} />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-5rem)] flex-col">
      <style>{MINE_CSS}</style>
      <div className="relative z-10 border-b" style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-bg)' }}>
        <div aria-hidden className="ms-glow pointer-events-none absolute inset-0" />
        <div className="relative mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            className="ms-badge relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
            <Sparkles className="h-5 w-5" />
          </motion.span>
          <div className="min-w-0 flex-1">
            <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className={`truncate text-[19px] font-black leading-tight sm:text-2xl ${headingClass}`} style={{ color: 'var(--site-heading)' }}>
              {first ? `${first}'s Showcase` : 'My Showcase'}
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--site-muted)' }}>
              <b style={{ color: 'var(--site-heading)' }}>{summary.homes} home{summary.homes === 1 ? '' : 's'}</b>
              {/* all of them "new" = the search was just changed, not news */}
              {summary.new_this_week > 0 && summary.new_this_week < summary.homes && <> · <span style={{ color: 'var(--site-accent-deep)' }}>{summary.new_this_week} new this week</span></>}
              {where && <span className="hidden sm:inline"> · {where}</span>}
            </motion.p>
          </div>
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)} aria-label="Change my search" className="inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-[13px] font-black shadow-sm transition hover:-translate-y-0.5 sm:px-5"
              style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
              <SlidersHorizontal className="h-4 w-4" /><span className="hidden min-[420px]:inline">Change my search</span>
            </button>
          )}
          <a href={`${basePrefix}/search`} className="hidden shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-black transition hover:-translate-y-0.5 md:inline-flex" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}>
            <Search className="h-4 w-4" /> Search all homes
          </a>
          <a href={fullScreen} aria-label="Open full screen" className="hidden h-10 w-10 shrink-0 place-items-center rounded-full border transition hover:-translate-y-0.5 sm:grid" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-muted)' }}>
            <Expand className="h-4 w-4" />
          </a>
        </div>
      </div>
      <AnimatePresence>
        <motion.iframe key={src} src={src} title={first ? `${first}'s Showcase` : 'My Showcase'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
          className="w-full flex-1 border-0" allow="clipboard-write; fullscreen" />
      </AnimatePresence>
    </div>
  )
}

const MINE_CSS = `
.ms-glow{background:radial-gradient(60% 140% at 0% 50%,rgba(var(--site-accent-rgb),.16),transparent 70%)}
.ms-badge::after{content:"";position:absolute;inset:-4px;border-radius:20px;border:2px solid var(--site-accent);opacity:0;animation:msPulse 2.6s ease-out infinite}
@keyframes msPulse{0%{opacity:.7;transform:scale(.9)}100%{opacity:0;transform:scale(1.35)}}
@media (prefers-reduced-motion:reduce){.ms-badge::after{animation:none}}
`
