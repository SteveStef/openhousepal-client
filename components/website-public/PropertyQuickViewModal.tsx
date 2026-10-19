'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { AboutHome, BrightNotice, HeroActions, PropertyHero, PropertySurface, homeFromIdx } from '@/components/property/PropertyKit'
import { SiteTheme } from './types'
import { fontClass } from './blocks/fontClass'
import SiteLoader from './SiteLoader'

// The IDX quick look: the same real listing (fetched through app/api/website-properties/[siteId]/
// [listingKey]'s same-origin proxy) in a window over the Featured page / home page, so a visitor
// browsing a carousel doesn't lose their place. Built from the shared property design - the big photo
// + filmstrip + viewer, the headline, facts, highlights and the remarks - with two ways on: the full
// property page (`/properties/{key}`) and asking the agent about it.
//
// Feels instant: a home starts loading the moment the pointer rests on its card (any element
// carrying data-ohp-qv="<listing key>" - HomeCard, FeaturedHeroCard), results are kept for the
// visit, and the window opens at its full size straight away with the site's loading mark
// (SiteLoader) filling it, then the home fades in - nothing jumps or resizes.
const cache = new Map<string, Promise<any>>()
function loadListing(siteId: string, key: string): Promise<any> {
  const id = `${siteId}/${key}`
  let p = cache.get(id)
  if (!p) {
    p = fetch(`/api/website-properties/${encodeURIComponent(siteId)}/${encodeURIComponent(key)}`)
      .then(res => (res.ok ? res.json() : null))
      .catch(() => null)
      .then(body => { if (!body) cache.delete(id); return body })
    cache.set(id, p)
  }
  return p
}
function warmPhoto(body: any) {
  const first = body?.photos?.[0] || body?.photo
  if (first) { const img = new window.Image(); img.src = resolveMediaUrl(first) || first }
}

export default function PropertyQuickViewModal({
  siteId, listingKey, onClose, theme, basePrefix = '',
}: {
  siteId: string
  listingKey: string | null
  onClose: () => void
  theme: SiteTheme
  basePrefix?: string
}) {
  const [data, setData] = useState<{ key: string; body: any } | null>(null)
  const [failed, setFailed] = useState(false)

  // Hover-to-preload: one listener for the whole page.
  useEffect(() => {
    const onOver = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-ohp-qv]') as HTMLElement | null
      const key = el?.dataset.ohpQv
      if (key) loadListing(siteId, key).then(warmPhoto)
    }
    document.addEventListener('pointerover', onOver, { passive: true })
    return () => document.removeEventListener('pointerover', onOver)
  }, [siteId])

  useEffect(() => {
    if (!listingKey) return
    let cancelled = false
    setFailed(false)
    loadListing(siteId, listingKey).then(body => {
      if (cancelled) return
      if (body) setData({ key: listingKey, body })
      else setFailed(true)
    })
    return () => { cancelled = true }
  }, [siteId, listingKey])

  useEffect(() => {
    if (!listingKey) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingKey])

  const ready = data && data.key === listingKey ? data.body : null
  const home = useMemo(() => (ready ? homeFromIdx(ready, { photo: u => resolveMediaUrl(u) || u }) : null), [ready])
  const serif = fontClass(theme.heading_font, 'font-serif')
  const ease = [0.16, 1, 0.3, 1] as const

  return (
    <AnimatePresence>
      {listingKey && (
        <motion.div
          key="qv"
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 sm:items-center sm:px-6 sm:py-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease }}
          onClick={onClose}
        >
          <PropertySurface surface="site" gold="var(--site-accent)" ink={theme.primary_color} serif={serif} className="relative w-full max-w-4xl">
            <motion.div
              className="relative flex h-[92dvh] flex-col overflow-hidden rounded-t-[28px] bg-[var(--pp-bg)] text-left shadow-2xl ring-1 ring-[color:var(--pp-gold-line)] sm:h-[min(88vh,860px)] sm:rounded-[28px]"
              initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.5, ease }}
              onClick={e => e.stopPropagation()}
            >
              <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-20 rounded-full bg-white/95 p-2 text-gray-600 shadow-md transition hover:scale-105 hover:bg-white hover:text-gray-900">
                <X className="h-5 w-5" />
              </button>

              <AnimatePresence mode="wait" initial={false}>
                {home ? (
                  <motion.div key={`home-${listingKey}`} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
                    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.55, ease }}>
                    <PropertyHero home={home} split="md" actions={
                      <HeroActions
                        showingLabel="See every detail"
                        onShowing={() => window.location.assign(`${basePrefix}/properties/${encodeURIComponent(listingKey)}`)}
                        onAsk={() => window.location.assign(`${basePrefix}/properties/${encodeURIComponent(listingKey)}#idx-ask`)}
                      />
                    } />
                    <div className="px-1 pt-2 sm:px-2">
                      <AboutHome home={home} clampAt={420} showFeatures={false} />
                      <BrightNotice home={home} className="mt-8" />
                    </div>
                  </motion.div>
                ) : failed ? (
                  <motion.div key="failed" className="flex flex-1 items-center justify-center px-8 text-center text-sm font-semibold opacity-70"
                    initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} exit={{ opacity: 0 }}>
                    This listing couldn&apos;t be loaded.
                  </motion.div>
                ) : (
                  <motion.div key="loading" className="flex flex-1 items-center justify-center"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.35, ease }}>
                    <SiteLoader size="lg" label="Opening the home" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </PropertySurface>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
