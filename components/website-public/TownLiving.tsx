'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Building2, MapPin, ShoppingBag, ShoppingBasket, Sparkles, Trees, Utensils } from 'lucide-react'

// A town page's "Living here" section: one panel instead of a stack of text cards. The categories
// (Town center · Restaurants · Shopping · Grocery · Parks) sit down the side as buttons with a
// highlight that glides between them; the chosen one shows its one-line take and its places as
// tiles - the top pick large - that settle in one after another. Each place says whether it's in
// town or how far, and links to where it was researched.
export interface LivingPlace { name: string; category?: string; city?: string; distance_miles?: number; description?: string; source_url?: string }
export interface LivingCategory { key: string; label: string; notes?: string | null; items: LivingPlace[] }

const ICONS: Record<string, typeof Trees> = {
  downtown_centers: Building2, restaurants: Utensils, shopping: ShoppingBag, grocery: ShoppingBasket, parks: Trees,
}
const SHORT: Record<string, string> = {
  downtown_centers: 'Town center', restaurants: 'Restaurants', shopping: 'Shopping', grocery: 'Groceries', parks: 'Parks & outdoors',
}

function firstSentence(text?: string | null) {
  const t = String(text || '').trim()
  const m = t.match(/^.{30,220}?[.!?](\s|$)/)
  return m ? m[0].trim() : t
}

function whereLabel(p: LivingPlace, town: string) {
  const d = typeof p.distance_miles === 'number' ? p.distance_miles : null
  if ((d != null && d < 0.6) || (!d && p.city && p.city.toLowerCase() === town.toLowerCase())) return 'In town'
  if (d != null) return `${d < 1 ? d.toFixed(1) : Math.round(d)} mi away`
  return p.city || ''
}

export default function TownLiving({ categories, town, luxe }: { categories: LivingCategory[]; town: string; luxe: boolean }) {
  const [active, setActive] = useState(categories[0]?.key)
  const cat = categories.find(c => c.key === active) || categories[0]
  if (!cat) return null
  const round = luxe ? 'rounded-[24px]' : 'rounded-2xl'
  const ease = [0.16, 1, 0.3, 1] as const

  return (
    <div className={`mt-8 grid overflow-hidden border lg:grid-cols-[280px_minmax(0,1fr)] ${round}`} style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-surface)', boxShadow: 'var(--site-shadow)' }}>
      {/* Categories */}
      <div className="flex gap-1.5 overflow-x-auto border-b p-3 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:p-4" style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-bg-alt)' }}>
        {categories.map(c => {
          const Icon = ICONS[c.key] || Sparkles
          const on = c.key === cat.key
          return (
            <button key={c.key} type="button" onClick={() => setActive(c.key)}
              className={`relative flex shrink-0 items-center gap-3 px-3.5 py-3 text-left transition-colors duration-300 ${luxe ? 'rounded-2xl' : 'rounded-xl'}`}
              style={{ color: on ? 'var(--site-on-accent)' : 'var(--site-ink-soft)' }}>
              {on && <motion.span layoutId="ohp-living-cat" className={`absolute inset-0 ${luxe ? 'rounded-2xl' : 'rounded-xl'}`} style={{ backgroundColor: 'var(--site-accent)', boxShadow: '0 10px 24px -14px rgba(var(--site-accent-rgb),.9)' }} transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-300" style={{ backgroundColor: on ? 'rgba(0,0,0,.12)' : 'rgba(var(--site-accent-rgb),.12)', color: on ? 'inherit' : 'var(--site-accent)' }}><Icon className="h-4 w-4" /></span>
              <span className="relative min-w-0">
                <span className="block whitespace-nowrap text-sm font-black">{SHORT[c.key] || c.label}</span>
                <span className="block text-[11px] font-bold opacity-70">{c.items.length} {c.items.length === 1 ? 'place' : 'places'}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* The chosen category */}
      <div className="min-w-0 p-5 sm:p-7">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={cat.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease }}>
            {cat.notes && <p className="max-w-3xl text-[15px] leading-relaxed" style={{ color: 'var(--site-ink-soft)' }}>{firstSentence(cat.notes)}</p>}
            <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {cat.items.slice(0, 9).map((p, i) => {
                const top = i === 0 && cat.items.length > 2
                const where = whereLabel(p, town)
                return (
                  <motion.div key={`${cat.key}-${p.name}`}
                    initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease, delay: 0.05 + i * 0.05 }}
                    className={`group relative flex flex-col border p-4 transition duration-300 hover:-translate-y-1 ${luxe ? 'rounded-[20px]' : 'rounded-xl'} ${top ? 'sm:col-span-2 xl:col-span-2' : ''}`}
                    style={{ borderColor: 'var(--site-line)', backgroundColor: top ? 'rgba(var(--site-accent-rgb),.06)' : 'var(--site-surface)' }}>
                    <div className="flex items-start gap-3">
                      <span className={`flex shrink-0 items-center justify-center font-black ${top ? 'h-12 w-12 text-lg' : 'h-10 w-10 text-base'} ${luxe ? 'rounded-full' : 'rounded-xl'} ohp-site-heading`}
                        style={{ background: 'linear-gradient(135deg, var(--site-accent-light), var(--site-accent) 55%, var(--site-accent-deep))', color: 'var(--site-on-accent)' }}>
                        {p.name.replace(/^the\s+/i, '').charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        {top && <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--site-accent-text)' }}>Local favorite</p>}
                        <p className={`font-black leading-snug ${top ? 'text-lg' : 'text-[15px]'}`} style={{ color: 'var(--site-heading)' }}>{p.name}</p>
                        {p.category && <p className="mt-0.5 truncate text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--site-faint)' }}>{p.category}</p>}
                      </div>
                    </div>
                    {p.description && <p className={`mt-3 text-[13px] leading-relaxed ${top ? 'line-clamp-3' : 'line-clamp-2'}`} style={{ color: 'var(--site-muted)' }}>{p.description}</p>}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                      {where ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black" style={where === 'In town' ? { backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' } : { backgroundColor: 'var(--site-bg-alt)', color: 'var(--site-ink-soft)' }}>
                          <MapPin className="h-3 w-3" />{where}
                        </span>
                      ) : <span />}
                      {p.source_url && (
                        <a href={p.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[11px] font-bold opacity-0 transition group-hover:opacity-100" style={{ color: 'var(--site-accent)' }}>
                          More <ArrowUpRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
