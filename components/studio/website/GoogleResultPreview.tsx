'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { ChevronRight, EyeOff, Globe, Moon, MoreVertical, Search, Star, Sun, X } from 'lucide-react'
import type { SitePage, SiteSeo } from '@/types'
import { seoLinksFor } from './SearchAppearancePanel'
import { autoSectionMeta, type SeoCtx } from '@/lib/siteSeoAuto'
import type { SeoPreviewPage } from './SeoPagesList'

// Live preview for the IDX editor's Google tab: a browser tab strip (icon + title) above a Google
// result laid out like the real one - icon, site name, address, the blue headline, the grey
// description and the indented sub-links. Light / dark like Google itself; whatever is being
// edited glows gold, and text animates in as it changes.

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()} ...` : s)

export default function GoogleResultPreview({ seo, pages, defaults, siteUrl, focusKey, ctx, page, rating }: {
  seo: SiteSeo; pages: SitePage[]; defaults: { siteName: string; area: string; logoUrl?: string | null }; siteUrl: string; focusKey: string
  /** The agent's facts - sub-links use the same automatic wording as the live site. */
  ctx?: SeoCtx
  /** A single page picked in "Every page on Google" - shown as its own result. */
  page?: SeoPreviewPage | null
  /** The star rating Google would get right now (null = none is sent). */
  rating?: { count: number; average: number | null } | null
}) {
  const [dark, setDark] = useState(true)
  // The two switches on the left: flipping one rings the part of the result it changes - red when
  // it goes away, gold when it comes in - with a tag saying what happened.
  const hidden = seo.allow_indexing === false
  const showRating = seo.share_rating !== false && !!rating && rating.average != null && rating.count > 0
  const [flash, setFlash] = useState<{ key: number; kind: 'on' | 'off'; label: string; at: 'result' | 'rating' } | null>(null)
  const prev = useRef({ hidden, share: seo.share_rating !== false })
  useEffect(() => {
    const was = prev.current
    prev.current = { hidden, share: seo.share_rating !== false }
    let next: typeof flash = null
    if (was.hidden !== hidden) next = { key: Date.now(), kind: hidden ? 'off' : 'on', label: hidden ? 'Hidden from Google · it still opens by link' : 'Google can find your site again', at: 'result' }
    else if (was.share !== (seo.share_rating !== false)) {
      const on = seo.share_rating !== false
      next = { key: Date.now(), kind: on ? 'on' : 'off', at: 'rating', label: on ? (showRating ? 'Your star rating shows under your result' : 'Sent once you have 3+ reviews averaging 4.0+') : 'Star rating no longer sent' }
    }
    if (!next) return
    setFlash(next)
    const t = window.setTimeout(() => setFlash(f => (f?.key === next!.key ? null : f)), 2600)
    return () => window.clearTimeout(t)
  }, [hidden, seo.share_rating]) // eslint-disable-line react-hooks/exhaustive-deps
  const siteName = seo.site_name || defaults.siteName || 'Your Name'
  // Same order as the live site (applySiteSeo): the agent's words, else the automatic ones.
  const autoHome = ctx ? autoSectionMeta('home', ctx) : null
  const title = seo.home_title || autoHome?.title || siteName
  const description = seo.description || autoHome?.description || `Search homes for sale${defaults.area ? ` in ${defaults.area}` : ''}, see recent sales and connect with ${siteName}.`
  const icon = seo.favicon_url || defaults.logoUrl
  const one = focusKey.startsWith('pg:') && page ? page : null
  const links = seoLinksFor(pages, defaults.area, ctx).map(l => ({ ...l, title: seo.pages[l.key]?.title || l.fallbackTitle, description: seo.pages[l.key]?.description || l.fallbackDescription })).filter(l => l.description).slice(0, 6)
  // Local dev links run through /ohp-site-render/<host> - show the real address the site lives at.
  const host = (siteUrl.includes('/ohp-site-render/') ? decodeURIComponent(siteUrl.split('/ohp-site-render/')[1]) : siteUrl.replace(/^https?:\/\//, '')).replace(/\/$/, '')

  const c = dark
    ? { bg: '#1f1f1f', card: '#202124', text: '#e8eaed', sub: '#bdc1c6', link: '#8ab4f8', line: '#3c4043', tab: '#35363a', tabBar: '#202124' }
    : { bg: '#ffffff', card: '#ffffff', text: '#202124', sub: '#4d5156', link: '#1a0dab', line: '#dadce0', tab: '#ffffff', tabBar: '#dee1e6' }
  const glow = (on: boolean) => (on ? { boxShadow: '0 0 0 2px #C9A24D, 0 0 28px rgba(201,162,77,.45)', borderRadius: 10 } : { boxShadow: '0 0 0 0 transparent', borderRadius: 10 })

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-[0_24px_50px_-30px_rgba(17,24,39,.45)] dark:border-gray-800">
      {/* browser tab strip */}
      <div className="flex items-end gap-2 px-3 pt-2" style={{ background: c.tabBar }}>
        <span className="mb-2 flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /></span>
        <motion.div layout className="flex max-w-[260px] min-w-0 items-center gap-2 rounded-t-xl px-3 py-2" style={{ background: c.tab, ...glow(focusKey === 'brand') }}>
          <motion.span key={icon || 'none'} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 18 }} className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-300">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {icon ? <img src={icon} alt="" className="h-full w-full object-cover" /> : <Globe className="h-3 w-3 text-gray-500" />}
          </motion.span>
          <span className="truncate text-[11px] font-medium" style={{ color: c.text }}>{one ? one.title : title}</span>
          <X className="h-3 w-3 shrink-0" style={{ color: c.sub }} />
        </motion.div>
        <button type="button" onClick={() => setDark(d => !d)} className="mb-1.5 ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition hover:scale-105" style={{ background: c.tab, color: c.sub }}>
          {dark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />} {dark ? 'Light' : 'Dark'}
        </button>
      </div>

      <div className="relative p-5 transition-colors duration-500" style={{ background: c.bg }}>
        <AnimatePresence>
          {flash && (
            <motion.span key={flash.key} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className={`absolute left-1/2 top-2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11px] font-black shadow-lg ${flash.kind === 'off' ? 'bg-red-500 text-white' : 'bg-[#C9A24D] text-[#111827]'}`}>
              {flash.kind === 'on' ? '✓ ' : ''}{flash.label}
            </motion.span>
          )}
        </AnimatePresence>
        {/* search box */}
        <div className="mb-5 flex items-center gap-2 rounded-full border px-4 py-2" style={{ borderColor: c.line, background: c.card }}>
          <Search className="h-4 w-4" style={{ color: c.sub }} />
          <span className="text-sm" style={{ color: c.text }}>{one ? `${one.crumbs[one.crumbs.length - 1]} ${siteName}` : siteName}</span>
        </div>

        <div className="relative">
        <AnimatePresence>
          {hidden && (
            <motion.div key="hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
              className="absolute -inset-2 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-red-500 text-center " style={{ background: dark ? 'rgba(31,31,31,.82)' : 'rgba(255,255,255,.82)' }}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white"><EyeOff className="h-5 w-5" /></span>
              <span className="text-sm font-black" style={{ color: c.text }}>Hidden from Google</span>
              <span className="max-w-xs text-xs" style={{ color: c.sub }}>Your site won&apos;t show up in search results. It still works for anyone with the link.</span>
            </motion.div>
          )}
        </AnimatePresence>
        {flash?.at === 'result' && flash.kind === 'on' && <span key={flash.key} aria-hidden className="pointer-events-none absolute -inset-2 z-10 rounded-xl border-2 border-[#C9A24D] shadow-[0_0_40px_rgba(201,162,77,.45)] [animation:ohpGFlash_2.4s_ease_both]" />}
        <style>{'@keyframes ohpGFlash{0%{opacity:0}12%{opacity:1}80%{opacity:1}100%{opacity:0}}'}</style>
        {one ? (
          <motion.div key={one.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <div className="flex items-center gap-3 p-1">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border" style={{ borderColor: c.line, background: '#fff' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {icon ? <img src={icon} alt="" className="h-full w-full object-cover" /> : <Globe className="h-4 w-4 text-gray-400" />}
              </span>
              <div className="min-w-0 leading-tight">
                <span className="block truncate text-sm" style={{ color: c.text }}>{siteName}</span>
                <span className="flex min-w-0 items-center gap-1 text-xs" style={{ color: c.sub }}><span className="truncate">https://{host} › {one.crumbs.map(x => clip(x, 28)).join(' › ')}</span> <MoreVertical className="h-3 w-3 shrink-0" /></span>
              </div>
            </div>
            <div className="mt-1 p-1" style={glow(true)}>
              <Swap text={clip(one.title, 62)} className="block text-xl leading-snug hover:underline" style={{ color: c.link }} />
              <Swap text={clip(one.description, 165)} className="mt-1 block text-sm leading-relaxed" style={{ color: c.sub }} />
            </div>
            <p className="mt-4 text-[11px]" style={{ color: c.sub }}>How /{one.path} shows when someone searches for it. Pick another page on the left, or tap your main result to see the home page again.</p>
          </motion.div>
        ) : (
        <LayoutGroup>
          <motion.div layout style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <motion.div layout className="flex items-center gap-3 p-1" style={glow(focusKey === 'brand')}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border" style={{ borderColor: c.line, background: '#fff' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {icon ? <img src={icon} alt="" className="h-full w-full object-cover" /> : <Globe className="h-4 w-4 text-gray-400" />}
              </span>
              <div className="min-w-0 leading-tight">
                <Swap text={siteName} className="block truncate text-sm" style={{ color: c.text }} />
                <span className="flex items-center gap-1 text-xs" style={{ color: c.sub }}>https://{host} <MoreVertical className="h-3 w-3" /></span>
              </div>
            </motion.div>
            <motion.div layout className="mt-1 p-1" style={glow(focusKey === 'home')}>
              <Swap text={clip(title, 62)} className="block text-xl leading-snug hover:underline" style={{ color: c.link }} />
              <Swap text={clip(description, 165)} className="mt-1 block text-sm leading-relaxed" style={{ color: c.sub }} />
              <AnimatePresence initial={false}>
                {(showRating || (flash?.at === 'rating' && flash.kind === 'off' && rating?.average != null)) && rating && (
                  <motion.span key="rating" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}
                    className="mt-1 flex items-center gap-1.5 overflow-hidden rounded-md text-xs" style={{ color: c.sub, ...(flash?.at === 'rating' ? { boxShadow: flash.kind === 'off' ? '0 0 0 2px #ef4444' : '0 0 0 2px #C9A24D, 0 0 22px rgba(201,162,77,.45)' } : {}) }}>
                    <span className="flex">{[1, 2, 3, 4, 5].map(n => <Star key={n} className="h-3.5 w-3.5" style={{ color: '#fbbc04', fill: n <= Math.round(rating.average || 0) ? '#fbbc04' : 'none' }} />)}</span>
                    Rating: {Number(rating.average).toFixed(1)} · {rating.count} reviews
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="mt-3">
              <AnimatePresence initial={false}>
                {links.map(l => (
                  <motion.div key={l.key} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
                    className="flex items-center gap-3 border-t px-1 py-3" style={{ borderColor: c.line, ...glow(focusKey === `page:${l.key}`) }}>
                    <div className="min-w-0 flex-1">
                      <Swap text={l.title} className="block text-lg leading-snug" style={{ color: c.text }} />
                      <Swap text={clip(l.description, 70)} className="block truncate text-sm" style={{ color: c.sub }} />
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0" style={{ color: c.sub }} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {links.length > 0 && <p className="border-t px-1 pt-3 text-sm" style={{ borderColor: c.line, color: c.text }}>More results from {host} »</p>}
            </div>
          </motion.div>
        </LayoutGroup>
        )}
        </div>
      </div>
      <p className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-[10px] font-semibold text-gray-500 dark:border-white/10 dark:bg-[#151517] dark:text-gray-400">A preview - Google shows sub-links once it decides your site qualifies, and may shorten text.</p>
    </div>
  )
}

function Swap({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={text} initial={{ opacity: 0.35, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className={className} style={style}>{text}</motion.span>
    </AnimatePresence>
  )
}
