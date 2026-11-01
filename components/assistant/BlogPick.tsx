'use client'

import { useMemo, useState } from 'react'
import { Check, Link2, Play, Plus, Star } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { youtubeIdOf } from '@/components/studio/blogs/ShowcaseBlocks'
import { CardStep, StepDone, useSteps } from './CardPickers'

// The Blogs page's AI writer interview, as the chat card's steps (owner, 11/01: "exactly how it would
// be if you were actually on the blog ... sections, collapsible when they're done ... questions
// answered by checking off boxes"). Same order as the page: Topic, Readers, Key points, Your homes,
// Video, Style. Each step stays open while they check things, and its Done folds it.
export type BlogPicks = {
  topic: string; goal: string; tone: string; length: string; cta: string
  audiences: string[]; areas: string[]; spotlight: boolean
  points: string[]; key_points: string; personal_take: string; facts: string
  sale_ids: string[]; listing_ids: string[]; video: { url: string; title?: string } | null
}
type Sale = { id: string; address: string; city: string; price?: number | null; date?: string; photo?: string | null }
type Listing = { id: string; address: string; city?: string; price?: number | null; beds?: number; baths?: number; image_url?: string | null }
type Video = { id: string; title?: string; url: string; image?: string | null; kind?: string }

export const BLOG_TONES: [string, string, string][] = [['warm', 'Warm & personal', 'Like advice from a trusted neighbor'], ['professional', 'Professional', 'Clear, confident, authoritative'],
  ['luxury', 'Refined luxury', 'Editorial and understated'], ['straight', 'Straight talk', 'Plain language, zero fluff'], ['energetic', 'Energetic', 'Upbeat and motivating']]
const BLOG_LENGTHS: [string, string, string][] = [['short', 'Quick read', '~650 words · 3 min'], ['standard', 'Standard', '~1,000 words · 5 min'], ['long', 'In-depth guide', '~1,700 words · 8 min']]
const BLOG_AUDIENCES = ['Buyers', 'Sellers', 'First-time buyers', 'Move-up buyers', 'Luxury buyers', 'Investors', 'Relocating', 'Homeowners']
const BLOG_CTAS: [string, string][] = [['how_can_i_help', 'Ready to Buy or Sell?'], ['home_value', "What's My Home Worth?"], ['showing', 'Schedule a Showing'],
  ['buying', "I'm Buying"], ['selling', "I'm Selling"], ['make_me_sell', 'Make Me Sell'], ['question', 'Ask Me a Question']]
const MAX_SALES = 4
const MAX_TOWNS = 5
const STOP = new Set(['what', 'when', 'where', 'which', 'with', 'your', 'about', 'that', 'this', 'from', 'into', 'know', 'should', 'have', 'they', 'their', 'there', 'than', 'then', 'them', 'will', 'just', 'more', 'most', 'some', 'like', 'make', 'need', 'want', 'every', 'before', 'after', 'over', 'home', 'homes', 'house', 'buyer', 'buyers', 'seller', 'sellers', 'real', 'estate', 'guide', 'tips', 'things', 'here', 'look', 'feel', 'year'])
const money = (n?: number | null) => (n ? (n >= 1e6 ? `$${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : `$${Math.round(n / 1000)}K`) : '')

/** A check box row - square for pick-any, round for pick-one. */
function Check2({ on, round, onClick, children, sub, testid }: { on: boolean; round?: boolean; onClick: () => void; children: React.ReactNode; sub?: React.ReactNode; testid?: string }) {
  return (
    <button type="button" role={round ? 'radio' : 'checkbox'} aria-checked={on} onClick={onClick} data-testid={testid}
      className={`ohp-ai-press flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${on
        ? 'border-[#C9A24D] bg-[#fffaf0] dark:border-[#C9A24D]/70 dark:bg-[#C9A24D]/[0.08]'
        : 'border-gray-200 bg-white hover:border-[#C9A24D]/50 dark:border-zinc-700 dark:bg-zinc-900'}`}>
      <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center border-2 transition-colors ${round ? 'rounded-full' : 'rounded-[5px]'} ${on ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : 'border-gray-300 dark:border-zinc-600'}`}>
        {on && <Check className="h-3 w-3" strokeWidth={4} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-bold leading-snug text-[#111827] dark:text-white">{children}</span>
        {sub && <span className="block text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">{sub}</span>}
      </span>
    </button>
  )
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-1.5 mt-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] first:mt-0 dark:text-[#C9A24D]">{children}</p>
)
const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 outline-none focus:border-[#C9A24D] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'

export function BlogPick({ payload, picks, onPicks }: { payload: Record<string, any>; picks: BlogPicks; onPicks: (p: BlogPicks) => void }) {
  const opts = (payload.options || {}) as { areas?: string[]; area_cards?: Record<string, string>; sales?: Sale[]; listings?: Listing[]; videos?: Video[]; angles?: string[]; goals?: string[]; point_ideas?: string[] }
  const given = String((payload.body || {}).topic || '')
  const angles = Array.from(new Set([given, ...(opts.angles || [])].filter(Boolean)))
  const goals = opts.goals || []
  const pointIdeas = Array.from(new Set([...(opts.point_ideas || []), ...picks.points]))
  const towns = Array.from(new Set([...(opts.areas || []), ...picks.areas]))
  const sales = opts.sales || []
  const listings = opts.listings || []
  const videos = (opts.videos || []).filter(v => youtubeIdOf(v.url))
  const ids = ['topic', 'readers', 'points', ...(sales.length || listings.length ? ['homes'] : []), 'video', 'style']
  const steps = useSteps(ids)
  const n = (id: string) => ids.indexOf(id) + 1
  const set = (p: Partial<BlogPicks>) => onPicks({ ...picks, ...p })
  const toggle = (list: string[], v: string, max: number) => (list.includes(v) ? list.filter(x => x !== v) : list.length >= max ? list : [...list, v])
  const pct = (payload.percents || {}) as Record<string, number>
  const pctText = (ln: string) => (typeof pct[ln] === 'number' ? `about ${pct[ln] < 1 ? 'under 1' : Math.round(pct[ln])}% of your AI` : '')
  const few = (list: string[], none: string) => (list.length ? (list.length > 2 ? `${list.slice(0, 2).join(', ')} +${list.length - 2}` : list.join(', ')) : none)
  const [own, setOwn] = useState('')
  const [townDraft, setTownDraft] = useState('')
  const [moreSales, setMoreSales] = useState(5)
  const [paste, setPaste] = useState('')

  // Sales in the towns they checked come first (the page's "Recommended"), then the rest, newest first.
  const salesSorted = useMemo(() => {
    const want = picks.areas.map(a => a.toLowerCase().split(',')[0].trim())
    const inTown = (s: Sale) => want.some(w => (s.city || '').toLowerCase().includes(w))
    return [...sales.filter(inTown), ...sales.filter(s => !inTown(s))]
  }, [sales, picks.areas])
  // The agent's videos whose titles share words with the article come first, marked "Fits".
  const { fits, rest } = useMemo(() => {
    const words = Array.from(new Set(([picks.topic, picks.goal, ...picks.points, ...picks.areas].join(' ').toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []))).filter(w => !STOP.has(w))
    const scored = videos.map(v => ({ v, k: words.filter(w => (v.title || '').toLowerCase().includes(w)).length }))
    const top = scored.filter(x => x.k > 0).sort((a, b) => b.k - a.k).slice(0, 3).map(x => x.v)
    return { fits: top, rest: videos.filter(v => !top.includes(v)) }
  }, [videos, picks.topic, picks.goal, picks.points, picks.areas])
  const addOwn = () => { const t = own.trim(); if (t) { set({ points: [...picks.points, t] }); setOwn('') } }
  const addTown = () => { const t = townDraft.trim(); if (t && !picks.areas.includes(t) && picks.areas.length < MAX_TOWNS) set({ areas: [...picks.areas, t] }); setTownDraft('') }
  const styleSummary = [BLOG_TONES.find(t => t[0] === picks.tone)?.[1], BLOG_LENGTHS.find(l => l[0] === picks.length)?.[1]].filter(Boolean).join(' · ')
  const homesPicked = picks.sale_ids.length + picks.listing_ids.length

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-[#faf7f0] p-2.5 dark:bg-zinc-800/50" data-testid="ai-blog-pick">
      <CardStep id="topic" n={n('topic')} title="Topic" summary={picks.topic} steps={steps}>
        <Label>The angle</Label>
        <div className="space-y-1.5" data-testid="ai-blog-angles">
          {angles.map(a => <Check2 key={a} round on={picks.topic === a} onClick={() => set({ topic: a })} sub={a === given ? 'What you asked for' : undefined}>{a}</Check2>)}
        </div>
        {goals.length > 0 && (
          <>
            <Label>What readers walk away with</Label>
            <div className="space-y-1.5" data-testid="ai-blog-goals">
              {goals.map(g => <Check2 key={g} round on={picks.goal === g} onClick={() => set({ goal: picks.goal === g ? '' : g })}>{g}</Check2>)}
            </div>
          </>
        )}
        <div className="mt-2.5"><StepDone onDone={() => steps.done('topic')} /></div>
      </CardStep>

      <CardStep id="readers" n={n('readers')} title="Readers" summary={[few(picks.audiences, ''), few(picks.areas, '')].filter(Boolean).join(' · ') || 'Anyone, anywhere'} steps={steps}>
        <Label>Who it&apos;s for</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {BLOG_AUDIENCES.map(a => <Check2 key={a} on={picks.audiences.includes(a)} onClick={() => set({ audiences: toggle(picks.audiences, a, 8) })}>{a}</Check2>)}
        </div>
        <Label>Towns · up to {MAX_TOWNS}</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {towns.map(t => <Check2 key={t} on={picks.areas.includes(t)} onClick={() => set({ areas: toggle(picks.areas, t, MAX_TOWNS) })}>{t}</Check2>)}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          <input value={townDraft} onChange={e => setTownDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTown() } }} placeholder="Add a town or neighborhood" className={inputCls} />
          <button type="button" onClick={addTown} aria-label="Add this town" className="grid w-9 shrink-0 place-items-center rounded-xl border border-gray-200 text-gray-500 dark:border-zinc-700"><Plus className="h-4 w-4" /></button>
        </div>
        {picks.areas.length > 0 && (
          <div className="mt-1.5">
            <Check2 on={picks.spotlight} onClick={() => set({ spotlight: !picks.spotlight })} sub="A photo, live market numbers, schools and what's nearby for each town">Add a Town Spotlight</Check2>
          </div>
        )}
        <div className="mt-2.5"><StepDone onDone={() => steps.done('readers')} /></div>
      </CardStep>

      <CardStep id="points" n={n('points')} title="Key points" summary={picks.points.length ? `${picks.points.length} to cover` : 'Optional'} steps={steps}>
        <Label>Check what it should cover</Label>
        <div className="space-y-1.5" data-testid="ai-blog-points">
          {pointIdeas.map(p => <Check2 key={p} on={picks.points.includes(p)} onClick={() => set({ points: toggle(picks.points, p, 12) })}>{p}</Check2>)}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          <input value={own} onChange={e => setOwn(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOwn() } }} placeholder="Add your own point" className={inputCls} />
          <button type="button" onClick={addOwn} disabled={!own.trim()} className="rounded-xl bg-[#111827] px-3 text-[11px] font-black text-white disabled:opacity-40 dark:bg-[#C9A24D] dark:text-[#111827]">Add</button>
        </div>
        <Label>Your take (optional)</Label>
        <textarea value={picks.personal_take} onChange={e => set({ personal_take: e.target.value })} rows={2} maxLength={2000}
          placeholder="A local story only you could tell - the AI weaves it in, in your voice" className={`${inputCls} resize-none`} />
        <Label>Numbers to cite (optional)</Label>
        <input value={picks.facts} onChange={e => set({ facts: e.target.value })} maxLength={2000} placeholder="Only what you know is true - it never invents a statistic" className={inputCls} />
        <div className="mt-2.5"><StepDone onDone={() => steps.done('points')} /></div>
      </CardStep>

      {(sales.length > 0 || listings.length > 0) && (
        <CardStep id="homes" n={n('homes')} title="Your homes" summary={homesPicked ? `${homesPicked} picked` : 'Optional'} steps={steps}>
          {sales.length > 0 && (
            <>
              <Label>Your sales · up to {MAX_SALES}</Label>
              <div className="space-y-1.5" data-testid="ai-blog-sales">
                {salesSorted.slice(0, moreSales).map((x, i) => (
                  <Check2 key={x.id} on={picks.sale_ids.includes(x.id)} onClick={() => set({ sale_ids: toggle(picks.sale_ids, x.id, MAX_SALES) })}
                    sub={[x.city, money(x.price), x.date ? `Sold ${x.date}` : ''].filter(Boolean).join(' · ')}>
                    <span className="flex items-center gap-1.5">
                      {x.photo && <img src={resolveMediaUrl(x.photo)} alt="" loading="lazy" className="h-6 w-8 shrink-0 rounded object-cover" />}
                      <span className="truncate">{x.address}</span>
                      {i < 6 && picks.areas.length > 0 && picks.areas.some(a => (x.city || '').toLowerCase().includes(a.toLowerCase().split(',')[0].trim())) && <Star className="h-3 w-3 shrink-0 fill-[#C9A24D] text-[#C9A24D]" />}
                    </span>
                  </Check2>
                ))}
              </div>
              {salesSorted.length > moreSales && (
                <button type="button" onClick={() => setMoreSales(m => m + 5)} className="mt-1 text-[11px] font-black text-[#8b7355] dark:text-[#e8c97a]">+{salesSorted.length - moreSales} more</button>
              )}
            </>
          )}
          {listings.length > 0 && (
            <>
              <Label>Your active listings (shown as home cards)</Label>
              <div className="space-y-1.5">
                {listings.map(l => (
                  <Check2 key={l.id} on={picks.listing_ids.includes(l.id)} onClick={() => set({ listing_ids: toggle(picks.listing_ids, l.id, 6) })}
                    sub={[l.city, money(l.price), l.beds ? `${l.beds} bd` : ''].filter(Boolean).join(' · ')}>
                    <span className="flex items-center gap-1.5">
                      {l.image_url && <img src={resolveMediaUrl(l.image_url)} alt="" loading="lazy" className="h-6 w-8 shrink-0 rounded object-cover" />}
                      <span className="truncate">{l.address}</span>
                    </span>
                  </Check2>
                ))}
              </div>
            </>
          )}
          <div className="mt-2.5"><StepDone onDone={() => steps.done('homes')} /></div>
        </CardStep>
      )}

      <CardStep id="video" n={n('video')} title="Video" summary={picks.video ? (picks.video.title || 'Your video') : 'None'} steps={steps}>
        {videos.length > 0 ? (
          <>
            <p className="mb-1.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">Pick one and the AI writes a section around it - the video sits right in it.</p>
            {fits.length > 0 && <p className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8c97a]"><Star className="h-3 w-3 fill-current" /> Fits this article</p>}
            <div className="-mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-1 [scrollbar-width:thin]" data-testid="ai-blog-videos">
              {[...fits, ...rest].slice(0, 12).map(v => {
                const on = picks.video?.url === v.url
                return (
                  <button key={v.id} type="button" title={v.title} aria-pressed={on} onClick={() => { set({ video: on ? null : { url: v.url, title: v.title } }); setPaste('') }}
                    className={`ohp-ai-press relative w-32 shrink-0 overflow-hidden rounded-xl border-2 text-left transition ${on ? 'border-[#C9A24D]' : fits.includes(v) ? 'border-[#C9A24D]/40' : 'border-transparent'}`}>
                    <span className="relative block aspect-video bg-gray-100 dark:bg-zinc-800">
                      <img src={v.image || `https://i.ytimg.com/vi/${youtubeIdOf(v.url)}/mqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover" />
                      <Play className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 fill-white text-white drop-shadow" />
                      {on && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-[#C9A24D] text-white"><Check className="h-3 w-3" strokeWidth={4} /></span>}
                      {fits.includes(v) && !on && <span className="absolute left-1 top-1 rounded-full bg-[#C9A24D] px-1.5 text-[8px] font-black uppercase leading-[14px] text-[#111827]">Fits</span>}
                    </span>
                    <span className="block truncate bg-white px-2 py-1 text-[10.5px] font-black text-[#111827] dark:bg-zinc-900 dark:text-white">{v.title || (v.kind === 'tour' ? 'House tour' : 'Video')}</span>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <p className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400">Link your YouTube channel in Agent Hub → Videos and your videos show up here - or paste one below.</p>
        )}
        <div className="relative mt-1.5">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input value={paste} onChange={e => { const url = e.target.value.trim(); setPaste(e.target.value); set({ video: youtubeIdOf(url) ? { url } : (picks.video && videos.some(v => v.url === picks.video!.url) ? picks.video : null) }) }}
            placeholder="Or paste a YouTube link" className={`${inputCls} pl-8`} />
        </div>
        {picks.video && !videos.some(v => v.url === picks.video!.url) && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> That video goes in the article</p>
        )}
        <div className="mt-2.5"><StepDone onDone={() => steps.done('video')} /></div>
      </CardStep>

      <CardStep id="style" n={n('style')} title="Style" summary={styleSummary} steps={steps}>
        <Label>Tone</Label>
        <div className="space-y-1.5">
          {BLOG_TONES.map(([id, name, hint]) => <Check2 key={id} round on={picks.tone === id} onClick={() => set({ tone: id })} sub={hint}>{name}</Check2>)}
        </div>
        <Label>Length</Label>
        <div className="space-y-1.5">
          {BLOG_LENGTHS.map(([id, name, words]) => <Check2 key={id} round on={picks.length === id} onClick={() => set({ length: id })} sub={[words, pctText(id)].filter(Boolean).join(' · ')}>{name}</Check2>)}
        </div>
        <Label>What readers tap at the end</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {BLOG_CTAS.map(([id, name]) => <Check2 key={id} round on={picks.cta === id} onClick={() => set({ cta: id })}>{name}</Check2>)}
        </div>
        <div className="mt-2.5"><StepDone onDone={() => steps.done('style')} /></div>
      </CardStep>
      {typeof pct[picks.length] === 'number' && (
        <p className="px-0.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">Uses {pctText(picks.length)} allowance · saved as a draft - nothing is published until you say so</p>
      )}
    </div>
  )
}
