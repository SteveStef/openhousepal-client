'use client'

// The Agent Hub step's "what's on it" parts - each switch is the hub's own saved setting
// (Agent Hub config, the same keys Studio -> Agent Hub edits):
//   HubContentPicker  recent-sales display (salesCarousel / salesAutoScroll), Blogs / Video tours /
//                     YouTube videos sections (layoutSections), the YouTube channel (videoChannelUrl,
//                     videoLinks, videoAutoSync - agent_hub_video_sync keeps it current).
//   HubFormButtons    which form buttons the hub shows (hubFormButtons; missing = all four).
//   HubLinkNote       where the hub link goes (their own domain, IDX) - GET /setup/hub-link.
import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Calendar, Check, CheckCircle2, Clapperboard, DollarSign, Globe, Home, Loader2, Newspaper, RefreshCw, Sparkles, TrendingUp, Youtube } from 'lucide-react'
import api, { type SetupHubLink } from '@/lib/api-service'
import type { AgentFormConfig, PublicBlogSummary } from '@/types'
import GoogleVisibilityNote from '@/components/ui/GoogleVisibilityNote'
import { BigToggle, inputCls, StepCtx } from './SetupUi'
import { BigChoices, hubSectionOn, hubSectionPatch, MiniLabel, Note, patchHubConfig, QuestionCard, useSerialSaves } from './FeatureUi'

type Video = { id: string; title: string; link: string; image?: string; pinned?: boolean; description?: string }

const youtubeId = (url: string) => {
  const m = String(url || '').match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/)
  return m ? m[1] : ''
}
const thumbOf = (v: Video) => v.image || (youtubeId(v.link) ? `https://i.ytimg.com/vi/${youtubeId(v.link)}/mqdefault.jpg` : '')
/** A channel address (youtube.com/@name, /channel/..., /c/..., /user/...) - not a single video. */
const isChannel = (u: string) => /youtube\.com\//i.test(u) && /\/(@|channel\/|c\/|user\/)/i.test(u)
const withHttps = (u: string) => (u.trim() && !/^https?:\/\//i.test(u.trim()) ? `https://${u.trim().replace(/^\/+/, '')}` : u.trim())

/** The YouTube channel they gave: Agent Hub -> Videos first, else the YouTube link from "Your socials". */
function channelFrom(cfg: Record<string, any>) {
  const own = String(cfg.videoChannelUrl || '').trim()
  if (own) return own
  const yt = (Array.isArray(cfg.socialLinks) ? cfg.socialLinks : []).find((l: any) => l?.id === 'youtube')
  const u = String(yt?.url || '').trim()
  return isChannel(u) ? withHttps(u) : ''
}

export function HubContentPicker({ ctx, onSaved }: { ctx: StepCtx; onSaved: () => void }) {
  const serial = useSerialSaves()
  const [cfg, setCfg] = useState<Record<string, any> | null>(null)
  const [blogs, setBlogs] = useState<PublicBlogSummary[]>([])
  const [loaded, setLoaded] = useState<Video[] | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    Promise.all([api.agentHub.getMine(), api.public.getPublicBlogs(ctx.data.slug)]).then(([h, b]) => {
      const c = (h.success && h.data?.config) || {}
      setCfg(c)
      setDraft(channelFrom(c))
      if (b.success && b.data) setBlogs(b.data)
    })
  }, [ctx.data.slug])

  const save = (patch: Record<string, unknown> | ((c: Record<string, any>) => Record<string, unknown>)) => {
    setCfg(c => (c ? { ...c, ...(typeof patch === 'function' ? patch(c) : patch) } : c))
    // the look / header choices on this step save through saveInfo - let a waiting one land first,
    // or this whole-config write would put back the look from before it
    return ctx.markSaving(() => serial(async () => { await ctx.flush(); return patchHubConfig(patch) }).then(r => { onSaved(); return r }), typeof patch === 'function' ? undefined : `hub-${Object.keys(patch).sort().join('-')}`)
  }

  const channel = cfg ? channelFrom(cfg) : ''
  const autoSync = cfg?.videoAutoSync !== false
  const videos: Video[] = useMemo(() => (Array.isArray(cfg?.videoLinks) ? cfg!.videoLinks.filter((v: Video) => v?.link?.trim()) : []), [cfg])
  // In "pick" mode the choices are the channel's videos plus any they already have.
  const pickable = useMemo(() => {
    const out = [...videos]
    for (const v of loaded || []) if (!out.some(x => x.link === v.link)) out.push(v)
    return out
  }, [videos, loaded])

  const loadChannel = async (url: string, mode: 'auto' | 'pick' = autoSync ? 'auto' : 'pick') => {
    const u = withHttps(url)
    if (!u) return
    setLoading(true); setMsg('')
    const r = await api.agentHub.getYoutubeChannelVideos(u)
    setLoading(false)
    if (!r.success || !r.data?.videos?.length) { setMsg(r.error || 'We couldn’t find videos at that link. Use your channel’s address - on YouTube tap your picture, then “View your channel”, and copy the link.'); return }
    const fetched = r.data.videos as Video[]
    setLoaded(fetched)
    setEditing(false)
    setMsg(`Found ${fetched.length} of your newest videos.`)
    if (mode === 'auto') {
      // the same merge the daily auto-update does: starred favourites first, then the newest uploads
      const pins = videos.filter(v => v.pinned)
      save({ videoChannelUrl: u, videoAutoSync: true, videoLinks: [...pins, ...fetched.filter(v => !pins.some(p => p.link === v.link))] })
    } else {
      save({ videoChannelUrl: u })
    }
  }
  // Pick mode with a channel but nothing loaded yet: fetch the choices once.
  useEffect(() => {
    if (cfg && !autoSync && channel && loaded === null && !loading) loadChannel(channel, 'pick')
  }, [cfg ? 'y' : 'n', autoSync, channel]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!cfg) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>

  const hubBlogs = blogs.filter(b => b.agentHubVisible)
  const blogCount = hubBlogs.length || (Array.isArray(cfg.blogCards) ? cfg.blogCards.filter((b: any) => b?.link?.trim() || b?.title?.trim()).length : 0)
  const tourCount = (Array.isArray(cfg.houseTourLinks) ? cfg.houseTourLinks.filter((t: any) => t?.link?.trim()).length : 0) + (String(cfg.houseTourUrl || '').trim() ? 1 : 0)
  const salesOn = hubSectionOn(cfg, 'sales')
  const togglePick = (v: Video) => {
    const on = videos.some(x => x.link === v.link)
    const next = on ? videos.filter(x => x.link !== v.link) : [...videos, v]
    save({ videoLinks: next, videoAutoSync: false })
  }

  return (
    <div className="space-y-5">
      {/* Recent sales - how the row behaves (where they show is in the Sales step) */}
      <div className="sm:rounded-[26px] sm:border-2 sm:border-[#ece5d6] sm:bg-white sm:p-6 sm:dark:border-white/10 sm:dark:bg-[#141416]">
        <p className="font-serif text-[20px] font-black text-[#111827] dark:text-white">Your recent sales row</p>
        <p className="mt-1 text-[14px] font-medium text-gray-500 dark:text-gray-400">
          {salesOn ? 'How the row of homes you’ve sold moves on your hub.' : 'Your sales are switched off for the Agent Hub in the Sales step - these apply if you turn them back on.'}
        </p>
        <div className="mt-4 space-y-2.5">
          <BigToggle on={cfg.salesCarousel !== false} onChange={v => save({ salesCarousel: v })} title="Swipe through one at a time on phones" blurb="One big sale fills the screen and slides to the next. Off: a row of smaller cards to scroll." />
          <BigToggle on={cfg.salesAutoScroll === true} onChange={v => save({ salesAutoScroll: v })} title="Let the row glide on its own" blurb="With the Luxe look, the row drifts by itself while the page sits still. Classic keeps it still." />
        </div>
      </div>

      {/* Blogs */}
      <QuestionCard icon={Newspaper} testId="hub-blogs" on={hubSectionOn(cfg, 'blogs')} onChange={v => save(c => hubSectionPatch(c, 'blogs', v))} title="Show my blogs" blurb="Your articles, as cards people can tap to read.">
        {blogCount
          ? <p className="text-[14px] font-semibold text-gray-600 dark:text-gray-300"><CheckCircle2 className="mr-1.5 inline h-4 w-4 text-emerald-600" />{blogCount} {blogCount === 1 ? 'article is' : 'articles are'} ready to show. New ones you publish join automatically.</p>
          : <Note tone="gold"><Sparkles className="mr-1.5 inline h-4 w-4" />Your first blog will show up here automatically - this part stays hidden until then.</Note>}
      </QuestionCard>

      {/* Video tours */}
      <QuestionCard icon={Clapperboard} testId="hub-tours" on={hubSectionOn(cfg, 'tours')} onChange={v => save(c => hubSectionPatch(c, 'tours', v))} title="Show my video tours" blurb="Walk-through videos of homes you list or sell.">
        {tourCount
          ? <p className="text-[14px] font-semibold text-gray-600 dark:text-gray-300"><CheckCircle2 className="mr-1.5 inline h-4 w-4 text-emerald-600" />{tourCount} video {tourCount === 1 ? 'tour is' : 'tours are'} ready to show.</p>
          : <Note tone="gold"><Sparkles className="mr-1.5 inline h-4 w-4" />Your first video tour will show up here automatically - this part stays hidden until then. Add tours any time in Studio → Agent Hub.</Note>}
      </QuestionCard>

      {/* YouTube */}
      <QuestionCard icon={Youtube} testId="hub-videos" on={hubSectionOn(cfg, 'videos')} onChange={v => save(c => hubSectionPatch(c, 'videos', v))} title="Show my YouTube videos" blurb="Your newest videos from your YouTube channel.">
        <div className="space-y-4">
          {channel && !editing ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-[#ece5d6] dark:bg-black/30 dark:ring-white/10">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ff0033] text-white"><Youtube className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">{cfg.videoChannelUrl ? 'Your channel' : 'From “Your socials”'}</span>
                <span className="block truncate text-[14.5px] font-bold text-[#111827] dark:text-white">{channel.replace(/^https?:\/\/(www\.)?/, '')}</span>
              </span>
              <span className="flex gap-2">
                <button type="button" onClick={() => loadChannel(channel)} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-3.5 py-2 text-[13px] font-black text-white disabled:opacity-60 dark:bg-white dark:text-[#111827]">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Load
                </button>
                <button type="button" onClick={() => { setEditing(true); setDraft(channel) }} className="rounded-xl px-3 py-2 text-[13px] font-black text-[#8b6a2b] hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]">Change</button>
              </span>
            </div>
          ) : (
            <div>
              <MiniLabel>Your YouTube channel link</MiniLabel>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="https://www.youtube.com/@yourname" inputMode="url" aria-label="Your YouTube channel link" className={`${inputCls} sm:flex-1`} />
                <button type="button" onClick={() => loadChannel(draft)} disabled={loading || !draft.trim()} className="inline-flex h-[60px] items-center justify-center gap-2 rounded-2xl bg-[#111827] px-6 text-[15px] font-black text-white disabled:opacity-50 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Youtube className="h-5 w-5" />} Load my videos
                </button>
              </div>
              <p className="mt-2 text-[13px] font-medium text-gray-500 dark:text-gray-400">On YouTube, tap your picture, then “View your channel”, and copy that link (it looks like youtube.com/@yourname).</p>
            </div>
          )}
          {msg && <p className={`text-[13.5px] font-bold ${msg.startsWith('Found') ? 'text-emerald-600' : 'text-rose-600'}`}>{msg}</p>}

          {(channel || videos.length > 0) && (
            <BigChoices label="Which videos show" cols={2} value={autoSync ? 'auto' : 'pick'}
              onChange={m => { if (m === 'auto') { if (channel) loadChannel(channel, 'auto'); else save({ videoAutoSync: true }) } else save({ videoAutoSync: false }) }}
              options={[
                { id: 'auto', label: 'Auto-update with my newest videos', sub: 'New uploads appear on their own, checked every day.', icon: RefreshCw },
                { id: 'pick', label: 'Pick which videos show', sub: 'Only the ones you tick below.', icon: Check },
              ]} />
          )}

          {autoSync && videos.length > 0 && (
            <div>
              <MiniLabel>Showing now</MiniLabel>
              <VideoGrid videos={videos.slice(0, 6)} />
              {videos.length > 6 && <p className="mt-2 text-[12.5px] font-semibold text-gray-500">+ {videos.length - 6} more</p>}
            </div>
          )}
          {!autoSync && (
            <div>
              <MiniLabel>{videos.length ? `${videos.length} picked - tap to add or remove` : 'Tap the videos you want to show'}</MiniLabel>
              {pickable.length ? <VideoGrid videos={pickable} picked={new Set(videos.map(v => v.link))} onToggle={togglePick} /> : loading ? <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div> : <Note>Load your channel above to choose from your videos.</Note>}
            </div>
          )}
        </div>
      </QuestionCard>
    </div>
  )
}

function VideoGrid({ videos, picked, onToggle }: { videos: Video[]; picked?: Set<string>; onToggle?: (v: Video) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {videos.map(v => {
        const on = picked ? picked.has(v.link) : true
        const Tag = onToggle ? 'button' : 'div'
        return (
          <Tag key={v.link} {...(onToggle ? { type: 'button' as const, onClick: () => onToggle(v), 'aria-pressed': on } : {})}
            className={`group relative overflow-hidden rounded-2xl text-left ring-2 transition ${onToggle ? (on ? 'ring-[#C9A24D]' : 'ring-transparent opacity-60 hover:opacity-100') : 'ring-transparent'}`}>
            <span className="block aspect-video w-full bg-[#111827] bg-cover bg-center" style={{ backgroundImage: thumbOf(v) ? `url(${thumbOf(v)})` : undefined }} />
            <span className="block truncate bg-white px-2.5 py-2 text-[12px] font-bold text-[#111827] dark:bg-[#1a1a1d] dark:text-white">{v.title || 'YouTube video'}</span>
            {onToggle && (
              <span className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 transition ${on ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : 'border-white/80 bg-black/40'}`}>
                {on && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
            )}
          </Tag>
        )
      })}
    </div>
  )
}

// ---------- Form buttons on the hub ----------
const HUB_BUTTONS = [
  { type: 'buying', label: "I'm Buying", icon: Home },
  { type: 'selling', label: "I'm Selling", icon: TrendingUp },
  { type: 'home_value', label: "What's My Home Worth?", icon: DollarSign },
  { type: 'showing', label: 'Schedule a Showing', icon: Calendar },
] as const

export function HubFormButtons({ ctx, onSaved }: { ctx: StepCtx; onSaved: () => void }) {
  const serial = useSerialSaves()
  const [picked, setPicked] = useState<string[] | null>(null)
  const [forms, setForms] = useState<AgentFormConfig[]>([])
  useEffect(() => {
    Promise.all([api.agentHub.getMine(), api.forms.getMine()]).then(([h, f]) => {
      const c = (h.success && h.data?.config) || {}
      setPicked(Array.isArray(c.hubFormButtons) ? c.hubFormButtons.filter((t: unknown) => typeof t === 'string') : HUB_BUTTONS.map(b => b.type))
      if (f.success && f.data) setForms(f.data)
    })
  }, [])
  if (!picked) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
  const toggle = (type: string) => {
    const next = picked.includes(type) ? picked.filter(t => t !== type) : HUB_BUTTONS.map(b => b.type).filter(t => t === type || picked.includes(t))
    setPicked(next)
    ctx.markSaving(() => serial(async () => { await ctx.flush(); return patchHubConfig({ hubFormButtons: next }) }).then(r => { onSaved(); return r }), 'hub-form-buttons')
  }
  const formOf = (type: string) => forms.find(f => f.form_type === type)
  const title = (type: string, fallback: string) => formOf(type)?.title || fallback
  const off = (type: string) => !picked.includes(type)
  const btn = (type: string, base: string) => `relative flex items-center justify-center gap-2 rounded-[14px] text-[13px] font-black transition-all duration-200 ${off(type) ? 'border-2 border-dashed border-gray-300 bg-transparent text-gray-400 dark:border-white/15' : base}`
  const Tick = ({ type }: { type: string }) => (
    <span className={`absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 ${off(type) ? 'border-gray-300 bg-white dark:border-white/20 dark:bg-[#141416]' : 'border-[#C9A24D] bg-[#C9A24D] text-white'}`}>{!off(type) && <Check className="h-3 w-3" strokeWidth={3.5} />}</span>
  )
  return (
    <div className="flex flex-col-reverse gap-5">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {HUB_BUTTONS.map(b => {
          const f = formOf(b.type)
          const on = picked.includes(b.type)
          return (
            <button key={b.type} type="button" role="switch" aria-checked={on} onClick={() => toggle(b.type)}
              className={`flex w-full items-center gap-3 rounded-[18px] border-2 px-4 py-3 text-left transition ${on ? 'border-[#C9A24D] bg-white shadow-[0_14px_28px_-22px_rgba(139,106,43,.9)] dark:bg-[#1a1712]' : 'border-[#ece5d6] bg-white/60 dark:border-white/10 dark:bg-white/[0.02]'}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${on ? 'bg-[#111827] text-[#e8c97a] dark:bg-[#C9A24D] dark:text-[#111827]' : 'bg-[#f4efe5] text-gray-400 dark:bg-white/[0.06]'}`}><b.icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-black text-[#111827] dark:text-white">{title(b.type, b.label)}</span>
                <span className="block text-[12.5px] font-medium text-gray-500 dark:text-gray-400">{f && !f.is_enabled ? 'This form is switched off in Forms - the button stays hidden until you turn it on.' : on ? 'Shows on your hub - opens this form.' : 'Hidden from your hub.'}</span>
              </span>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : 'border-gray-300 dark:border-white/20'}`}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
            </button>
          )
        })}
      </div>
      {/* A little copy of the buttons block on the hub - tap a button to switch it */}
      <div className="mx-auto w-full max-w-[260px] rounded-[26px] bg-gradient-to-b from-[#f7f5f1] to-[#efe9dd] p-3.5 ring-1 ring-[#ece5d6] dark:from-[#111113] dark:to-[#0b0b0b] dark:ring-white/10">
        <div className="mb-3 flex items-center gap-2.5">
          {ctx.data.info.photoUrl ? <img src={ctx.data.info.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="h-9 w-9 rounded-full bg-gray-300" />}
          <span className="min-w-0"><span className="block truncate font-serif text-[13px] font-black text-[#111827] dark:text-white">{ctx.data.info.name || 'Your name'}</span><span className="block h-1.5 w-16 rounded-full bg-gray-300 dark:bg-white/20" /></span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => toggle('buying')} aria-label={`${off('buying') ? 'Show' : 'Hide'} I'm Buying`} className={btn('buying', 'border border-gray-200 bg-white text-[#111827] shadow-sm dark:border-white/10 dark:bg-[#151517] dark:text-white') + ' h-10'}><Home className="h-3.5 w-3.5" /> Buying<Tick type="buying" /></button>
          <button type="button" onClick={() => toggle('selling')} aria-label={`${off('selling') ? 'Show' : 'Hide'} I'm Selling`} className={btn('selling', 'border border-gray-200 bg-white text-[#111827] shadow-sm dark:border-white/10 dark:bg-[#151517] dark:text-white') + ' h-10'}><TrendingUp className="h-3.5 w-3.5" /> Selling<Tick type="selling" /></button>
        </div>
        <button type="button" onClick={() => toggle('home_value')} aria-label={`${off('home_value') ? 'Show' : 'Hide'} What's My Home Worth`} className={btn('home_value', 'border border-[#d7b974] bg-white text-[#111827] shadow-sm dark:bg-[#151517] dark:text-white') + ' mt-2 h-10 w-full'}><DollarSign className="h-3.5 w-3.5 text-[#caa65e]" /> Home Worth?<Tick type="home_value" /></button>
        <button type="button" onClick={() => toggle('showing')} aria-label={`${off('showing') ? 'Show' : 'Hide'} Schedule a Showing`} className={btn('showing', 'bg-[#d2b16f] text-[#111827] shadow-md shadow-[#d2b16f]/30') + ' mt-2 h-10 w-full'}><Calendar className="h-3.5 w-3.5" /> Schedule a Showing<Tick type="showing" /></button>
        <p className="mt-3 text-center text-[10.5px] font-black uppercase tracking-[0.16em] text-gray-400">Your hub’s buttons</p>
      </div>
    </div>
  )
}

// ---------- Where the hub link goes ----------
export function HubLinkNote({ ctx, slug }: { ctx: StepCtx; slug: string }) {
  const [info, setInfo] = useState<SetupHubLink | null>(null)
  useEffect(() => { api.setup.hubLink().then(r => { if (r.success && r.data) setInfo(r.data) }) }, [slug])
  if (!info) return null
  const domainStep = ctx.data.steps.findIndex(s => s.id === 'domain') + 1
  const stepName = `“Web address” step${domainStep ? ` (step ${domainStep})` : ''}`
  const short = (u: string) => u.replace(/^https?:\/\//, '')
  if (!info.is_idx) {
    // What Google sees of the hub today, and what IDX changes (incl. their own domain).
    return <div data-testid="hub-link-upsell"><GoogleVisibilityNote kind="hub" planTier={ctx.plan} className="mt-4" /></div>
  }
  if (info.routes_to_domain && info.domain) {
    return (
      <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3.5 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/30" data-testid="hub-link-domain">
        <p className="flex items-center gap-2 text-[14.5px] font-black text-emerald-800 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5" /> Your link now goes to your own domain</p>
        <a href={info.hub_url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 break-all text-[17px] font-black text-[#111827] underline-offset-4 hover:underline dark:text-white">{short(info.hub_url)} <ArrowUpRight className="h-4 w-4 shrink-0" /></a>
        <p className="mt-1.5 text-[13px] font-medium text-emerald-900/80 dark:text-emerald-200/80">Your QR codes, email signature and everything you share use it. Your old link, {short(info.platform_url)}, now forwards there by itself.</p>
      </div>
    )
  }
  let text: React.ReactNode
  if (info.domain) {
    const why = info.blocked_reason === 'links_off' ? 'you turned off “Use my own domain for my links” in Settings'
      : info.blocked_reason === 'site_off' ? 'your website is switched off'
      : info.blocked_reason === 'site_unpublished' ? 'your website isn’t live yet (the “Your website” step)'
      : 'it isn’t reachable on the internet yet - this usually sorts itself out within an hour'
    text = <><b>{info.domain}</b> is connected, but your links don’t use it yet because {why}. Once that’s done, this link moves to <b>{info.domain}/hub</b>.</>
  } else if (info.pending_domain) {
    text = <>Once <b>{info.pending_domain}</b> finishes connecting, this link will forward there - <b>{info.pending_domain}/hub</b>.</>
  } else {
    text = <>Once you set up your website address in the {stepName}, this link will forward to your own domain.</>
  }
  return (
    <div className="mt-4" data-testid="hub-link-pending"><Note tone="gold"><Globe className="mr-1.5 inline h-4 w-4" />{text}</Note></div>
  )
}

export function OpenHubButton({ slug, className = '' }: { slug: string; className?: string }) {
  // ?intro=0: straight to the page - the agent checking their own hub skips the Luxe entrance
  // (visitors still get it). Plain link, opens at once.
  return (
    <a href={`/${slug}?intro=0`} target="_blank" rel="noreferrer" data-testid="open-my-hub"
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-[#C9A24D]/40 bg-white px-5 text-[15px] font-black text-[#111827] transition hover:border-[#C9A24D] dark:bg-white/5 dark:text-white ${className}`}>
      Open my Agent Hub <ArrowUpRight className="h-4 w-4" />
    </a>
  )
}

