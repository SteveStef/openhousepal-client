'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Check, ExternalLink, Loader2, MapPin, Sparkles } from 'lucide-react'
import api from '@/lib/api-service'
import type { LinkableAreas } from '@/lib/api-service'

// "Link my neighborhood pages" - in the blog flow (the AI writer's Finish step, the editor's
// Finish card and the Publish screen). An IDX agent picks which of their IDX website's
// neighborhood pages the article links to; the towns the article mentions are suggested (and
// pre-picked the first time). Readers get an "Explore the neighborhoods" row at the end and a link
// on each town's first mention - both open in a new tab so the article stays open.
// Without a live IDX site or neighborhoods it says exactly what's missing and where to fix it.

const REASONS: Record<string, { title: string; text: string; href: string; cta: string }> = {
  no_plan: { title: 'Neighborhood pages come with the IDX plan', text: 'With IDX, every town you serve gets its own page on your website - and your articles can link straight to them.', href: '/upgrade-required?tier=IDX&feature=IDX%20Website', cta: 'See the IDX plan' },
  no_site: { title: 'Set up your IDX website first', text: 'Your neighborhood pages live on your IDX website. Set it up and publish it, then link them here.', href: '/studio/website', cta: 'Set up my website' },
  not_published: { title: 'Publish your IDX website first', text: 'Your website is set up but not published yet - readers can’t open its neighborhood pages until it is.', href: '/studio/website', cta: 'Publish my website' },
  site_off: { title: 'Your IDX website is switched off', text: 'Turn it back on in Settings → IDX Website so readers can open your neighborhood pages.', href: '/settings#idx', cta: 'Open Settings' },
  no_areas: { title: 'Add the towns you serve', text: 'Your website has no neighborhood pages yet. Add your towns on the Areas tab and each one gets its own page.', href: '/studio/website?tab=areas', cta: 'Add my neighborhoods' },
}

export function mentionedAreas(text: string, areas: { slug: string; name: string }[]): string[] {
  const t = ` ${text.toLowerCase()} `
  return areas.filter(a => a.name && t.includes(a.name.toLowerCase())).map(a => a.slug)
}

export default function NeighborhoodLinksPicker({ value, onChange, articleText = '', autoPick = false, compact = false }: {
  value: string[]
  onChange: (slugs: string[]) => void
  /** The article's text, to suggest the towns it mentions. */
  articleText?: string
  /** Pre-pick the mentioned towns once when nothing is picked yet (the Finish steps). */
  autoPick?: boolean
  compact?: boolean
}) {
  const [info, setInfo] = useState<LinkableAreas | null>(null)
  useEffect(() => { api.blogs.linkableAreas().then(r => setInfo(r.success && r.data ? r.data : { ready: false, reason: 'no_site', site_url: null, areas: [] })) }, [])
  const mentioned = useMemo(() => (info ? mentionedAreas(articleText, info.areas) : []), [info, articleText])
  const picked = useRef(false)
  useEffect(() => {
    if (!autoPick || picked.current || !info?.ready || value.length || !mentioned.length) return
    picked.current = true
    onChange(mentioned)
  }, [autoPick, info, mentioned, value.length, onChange])

  if (!info) return <div className="flex items-center gap-2 py-3 text-xs font-semibold text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking your neighborhood pages…</div>
  const toggle = (slug: string) => onChange(value.includes(slug) ? value.filter(s => s !== slug) : [...value, slug])
  const why = !info.ready ? REASONS[info.reason || 'no_site'] || REASONS.no_site : null

  return (
    <div data-testid="neighborhood-links-picker">
      {!compact && (
        <>
          <p className="flex items-center gap-1.5 text-sm font-black text-[#111827] dark:text-white"><MapPin className="h-4 w-4 text-[#C9A24D]" /> Link my neighborhood pages</p>
          <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Readers can open the town&apos;s page on your IDX website - in a new tab, so they keep the article.</p>
        </>
      )}
      {why ? (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/15">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-amber-900 dark:text-amber-200">{why.title}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">{why.text}</p>
            <Link href={why.href} target="_blank" className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#111827] px-2.5 py-1.5 text-[11px] font-black text-white dark:bg-white dark:text-[#111827]">{why.cta} <ExternalLink className="h-3 w-3" /></Link>
          </div>
        </div>
      ) : (
        <>
          {mentioned.length > 0 && mentioned.some(s => !value.includes(s)) && (
            <button type="button" onClick={() => onChange(Array.from(new Set([...value, ...mentioned])))} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#C9A24D]/15 px-2.5 py-1.5 text-[11px] font-black text-[#8b7355] dark:text-[#e8c97a]">
              <Sparkles className="h-3.5 w-3.5" /> Link the {mentioned.length === 1 ? 'town' : `${mentioned.length} towns`} this article mentions
            </button>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {info.areas.map(a => {
              const on = value.includes(a.slug)
              return (
                <button key={a.slug} type="button" onClick={() => toggle(a.slug)} aria-pressed={on}
                  className={`group relative flex h-20 overflow-hidden rounded-xl border-2 text-left transition ${on ? 'border-[#C9A24D]' : 'border-transparent hover:border-[#C9A24D]/40'}`}>
                  <span className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105" style={{ backgroundImage: a.photo ? `url(${a.photo})` : undefined, backgroundColor: '#1f2937' }} />
                  <span className={`absolute inset-0 transition ${on ? 'bg-black/35' : 'bg-black/55'}`} />
                  <span className="relative mt-auto w-full p-2">
                    <span className="block truncate text-[13px] font-black text-white">{a.name}</span>
                    <span className="block text-[10px] font-semibold text-white/70">{mentioned.includes(a.slug) ? 'In this article' : a.active_count ? `${a.active_count} for sale` : 'Neighborhood page'}</span>
                  </span>
                  <span className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full ${on ? 'bg-[#C9A24D] text-[#111827]' : 'border border-white/60 text-transparent'}`}><Check className="h-3 w-3" /></span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] font-semibold text-gray-400">{value.length ? `${value.length} linked · opens on your website (${(info.site_url || '').replace(/^https?:\/\//, '')})` : 'None linked yet.'}</p>
        </>
      )}
    </div>
  )
}

/** The article's words, for suggesting the towns it mentions. */
export function articleTextOf(blocks: { data?: Record<string, any> | null }[]): string {
  return blocks.map(b => String(b.data?.html || b.data?.text || '').replace(/<[^>]+>/g, ' ')).join(' ')
}
