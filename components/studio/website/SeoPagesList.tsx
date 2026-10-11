'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, ChevronDown, ExternalLink, FileText, Home, LayoutGrid, MapPin, RotateCcw } from 'lucide-react'
import type { SitePage, SiteSeo } from '@/types'
import type { SeoPagesData } from '@/lib/api-service'
import { autoListingMeta, autoPostMeta, autoSectionMeta, autoTownMeta, seoChecks, SEO_DESC_MAX, SEO_TITLE_MAX, withSiteName, type SeoCtx } from '@/lib/siteSeoAuto'

// IDX editor -> Google tab -> "Every page on Google": every page Google can find on the site -
// the main pages, each neighborhood, each article and each Featured home - with exactly the
// title + description Google gets (lib/siteSeoAuto, the same code the live site uses), a quick
// check, and a preview on the right. Main pages and neighborhoods can be reworded here; an
// article's Google text lives in that article's own settings; homes write themselves.

export interface SeoPreviewPage { key: string; title: string; description: string; path: string; crumbs: string[] }

type Kind = 'main' | 'towns' | 'posts' | 'homes'
interface Row { key: string; kind: Kind; label: string; path: string; crumbs: string[]; auto: { title: string; description: string }; editable: boolean; editHref?: string; hidden?: boolean }

const KINDS: { id: Kind; label: string; icon: any }[] = [
  { id: 'main', label: 'Main pages', icon: LayoutGrid },
  { id: 'towns', label: 'Neighborhoods', icon: MapPin },
  { id: 'posts', label: 'Articles', icon: FileText },
  { id: 'homes', label: 'Homes', icon: Home },
]

export function seoCtxFrom(data: SeoPagesData | null): SeoCtx {
  return { agent: data?.agent || {}, towns: (data?.areas || []).map(a => a.name), reviews: data?.reviews || null }
}

export default function SeoPagesList({ seo, onChange, pages, data, siteName, focusKey, onPreview }: {
  seo: SiteSeo
  onChange: (next: SiteSeo) => void
  pages: SitePage[]
  data: SeoPagesData | null
  siteName: string
  focusKey: string
  onPreview: (page: SeoPreviewPage | null, focusKey: string) => void
}) {
  const [kind, setKind] = useState<Kind>('main')
  const [open, setOpen] = useState<string | null>(null)
  const ctx = seoCtxFrom(data)

  const rows = useMemo<Row[]>(() => {
    if (!data) return []
    const main: Row[] = [
      ...(['search', 'properties', 'neighborhoods', 'blog'] as const).map(k => ({ key: k, path: k })),
      ...pages.filter(p => !p.is_home && p.slug && !['about', 'contact'].includes(p.slug)).map(p => ({ key: p.slug, path: p.slug, title: p.title })),
      { key: 'home-value', path: 'home-value' },
      ...(data.reviews ? [{ key: 'testimonials', path: 'testimonials' }] : []),
      { key: 'about', path: 'about' }, { key: 'contact', path: 'contact' },
    ].map((m: any) => {
      const auto = autoSectionMeta(m.key, ctx) || { title: m.title || m.key, description: '' }
      return { key: m.key, kind: 'main' as Kind, label: auto.title, path: m.path, crumbs: [auto.title], auto, editable: true }
    })
    const towns: Row[] = data.areas.map(a => {
      const auto = autoTownMeta(a, ctx)
      return { key: a.slug, kind: 'towns' as Kind, label: [a.name, a.state].filter(Boolean).join(', '), path: a.slug, crumbs: ['Neighborhoods', a.name], auto, editable: true }
    })
    const posts: Row[] = data.posts.map(p => ({
      key: `post:${p.slug}`, kind: 'posts' as Kind, label: p.title, path: `blog/${p.slug}`, crumbs: ['Articles & Media', p.title],
      auto: autoPostMeta(p), editable: false, editHref: `/studio/blogs/${p.id}`, hidden: p.is_indexed === false,
    }))
    const homes: Row[] = data.featured.map(l => {
      const auto = autoListingMeta(l)
      return { key: `home:${l.listing_key}`, kind: 'homes' as Kind, label: auto.title, path: `properties/${l.listing_key}`, crumbs: ['Featured Homes', auto.title.split(' - ')[0]], auto, editable: false }
    })
    return [...main, ...towns, ...posts, ...homes]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, pages])

  const final = (r: Row) => {
    const own = r.editable ? seo.pages[r.key] : null
    const title = (own?.title || '').trim() || r.auto.title
    return { title, fullTitle: withSiteName(title, siteName), description: (own?.description || '').trim() || r.auto.description }
  }
  const okCount = (k: Kind) => rows.filter(r => r.kind === k && seoChecks({ title: final(r).title, description: final(r).description }, final(r).fullTitle).every(c => c.ok)).length
  const shown = rows.filter(r => r.kind === kind)
  const setPage = (key: string, patch: { title?: string; description?: string }) => onChange({ ...seo, pages: { ...seo.pages, [key]: { ...(seo.pages[key] || {}), ...patch } } })
  const preview = (r: Row) => {
    const f = final(r)
    onPreview({ key: r.key, title: f.fullTitle, description: f.description, path: r.path, crumbs: r.crumbs }, `pg:${r.key}`)
  }

  if (!data) return <p className="py-4 text-center text-xs font-semibold text-gray-400">Loading your pages…</p>

  return (
    <div>
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.05]">
        {KINDS.map(k => {
          const n = rows.filter(r => r.kind === k.id).length
          const on = kind === k.id
          return (
            <button key={k.id} type="button" onClick={() => { setKind(k.id); setOpen(null) }}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-black transition ${on ? 'bg-white text-[#111827] shadow-sm dark:bg-white/10 dark:text-white' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400'}`}>
              <k.icon className={`h-3.5 w-3.5 ${on ? 'text-[#C9A24D]' : ''}`} />
              <span className="leading-tight">{k.label}</span>
              <span className={`text-[9px] ${okCount(k.id) === n ? 'text-emerald-600' : 'text-amber-600'}`}>{n ? `${okCount(k.id)}/${n} ready` : 'none'}</span>
            </button>
          )
        })}
      </div>

      {shown.length === 0 && (
        <p className="mt-3 rounded-xl bg-gray-50 p-3 text-[11px] font-semibold text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
          {kind === 'towns' ? 'No neighborhoods yet - add your towns on the Areas tab and each gets its own Google-ready page.' : kind === 'posts' ? 'No published articles on your website yet.' : 'No Featured homes right now.'}
        </p>
      )}

      <div className="mt-3 space-y-2">
        {shown.map(r => {
          const f = final(r)
          const checks = seoChecks({ title: f.title, description: f.description }, f.fullTitle)
          const good = checks.every(c => c.ok) && !r.hidden
          const isOpen = open === r.key
          const own = seo.pages[r.key] || {}
          const customized = r.editable && !!((own.title || '').trim() || (own.description || '').trim())
          return (
            <div key={r.key} className={`overflow-hidden rounded-xl border transition ${isOpen || focusKey === `pg:${r.key}` ? 'border-[#C9A24D]/60 bg-white shadow-sm dark:bg-white/[0.03]' : 'border-gray-200 hover:border-[#C9A24D]/40 dark:border-white/[0.08]'}`}>
              <button type="button" onClick={() => { setOpen(isOpen ? null : r.key); preview(r) }} onMouseEnter={() => preview(r)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${good ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-white'}`}>
                  {good ? <Check className="h-2.5 w-2.5" strokeWidth={4} /> : <span className="text-[9px] font-black">!</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-[#111827] dark:text-white">{r.kind === 'main' || r.kind === 'towns' ? f.title : r.label}</span>
                  <span className="block truncate text-[10px] font-semibold text-gray-400">/{r.path}{customized ? ' · your wording' : ' · automatic'}{r.hidden ? ' · hidden from Google' : ''}</span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#C9A24D]' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="space-y-2.5 border-t border-gray-100 px-3 pb-3 pt-2.5 dark:border-white/[0.06]">
                      {/* the result, as Google shows it */}
                      <div className="rounded-lg bg-gray-50 p-2.5 dark:bg-black/30" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                        <p className="truncate text-[10px] text-gray-500">{siteName || 'Your site'} › {r.crumbs.join(' › ')}</p>
                        <p className="mt-0.5 line-clamp-1 text-[14px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{f.fullTitle}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#4d5156] dark:text-[#bdc1c6]">{f.description || <i>No description yet</i>}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {checks.map(c => (
                          <span key={c.label} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${c.ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300'}`}>
                            {c.ok ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : <AlertTriangle className="h-2.5 w-2.5" />}{c.label}
                          </span>
                        ))}
                        {r.hidden && <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-black text-gray-600">Hidden from Google in the article&apos;s settings</span>}
                      </div>
                      {r.editable ? (
                        <>
                          <MiniField label="Title" value={own.title || ''} placeholder={r.auto.title} max={SEO_TITLE_MAX} onChange={v => { setPage(r.key, { title: v }); onPreview({ key: r.key, title: withSiteName(v.trim() || r.auto.title, siteName), description: f.description, path: r.path, crumbs: r.crumbs }, `pg:${r.key}`) }} />
                          <MiniField label="Description" value={own.description || ''} placeholder={r.auto.description} max={SEO_DESC_MAX} multiline onChange={v => { setPage(r.key, { description: v }); onPreview({ key: r.key, title: f.fullTitle, description: v.trim() || r.auto.description, path: r.path, crumbs: r.crumbs }, `pg:${r.key}`) }} />
                          <p className="text-[10px] font-semibold text-gray-400">Leave blank to use the automatic wording (shown faintly) - it updates itself as your numbers change.</p>
                          {customized && (
                            <button type="button" onClick={() => { const next = { ...seo.pages }; delete next[r.key]; onChange({ ...seo, pages: next }) }} className="inline-flex items-center gap-1 text-[10px] font-black text-gray-500 hover:text-[#111827] dark:hover:text-white">
                              <RotateCcw className="h-3 w-3" /> Back to automatic
                            </button>
                          )}
                        </>
                      ) : r.editHref ? (
                        <Link href={r.editHref} target="_blank" className="inline-flex items-center gap-1 rounded-lg bg-[#111827] px-2.5 py-1.5 text-[11px] font-black text-white dark:bg-white dark:text-[#111827]">
                          Edit this article&apos;s Google text <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <p className="text-[10px] font-semibold text-gray-400">Written automatically from the listing - address, price, beds, baths and size.</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
      {!data.published && <p className="mt-3 text-[11px] font-semibold text-amber-600">Your site isn&apos;t published yet - Google can only find it once it is.</p>}
    </div>
  )
}

function MiniField({ label, value, placeholder, onChange, max, multiline }: { label: string; value: string; placeholder: string; onChange: (v: string) => void; max: number; multiline?: boolean }) {
  const len = value.length
  const cls = `mt-1 w-full rounded-lg border bg-white px-2.5 py-2 text-xs font-semibold outline-none transition placeholder:text-gray-400/80 focus:border-[#C9A24D] dark:bg-[#0B0B0B] dark:text-white ${len > max ? 'border-amber-400' : 'border-gray-200 dark:border-gray-700'}`
  return (
    <label className="block">
      <span className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-white/50">{label}</span>
        <span className={`text-[10px] font-black tabular-nums ${len > max ? 'text-amber-600' : 'text-gray-300'}`}>{len}/{max}</span>
      </span>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className={`${cls} resize-none`} />
        : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />}
    </label>
  )
}
