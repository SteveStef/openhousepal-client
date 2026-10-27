'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, Clock, ExternalLink, Eye, Loader2, Lock, Newspaper, Plus, Search, Share2, Sparkles, Star, Trash2 } from 'lucide-react'
import { copyText } from '@/lib/copyText'
import ConfirmationModal from '@/components/ConfirmationModal'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { BlogListItem, BlogStatus, StatSummary } from '@/types'
import StatCard from '@/components/stats/StatCard'
import BlogCreateFlow from '@/components/studio/blogs/BlogCreateFlow'
import { blogTheme } from '@/components/studio/blogs/BlogThemes'
import StudioPageHeader from '@/components/studio/StudioPageHeader'
import { LuxeTabs } from '@/components/ui/LuxeHero'
import { Archive, CalendarClock, EyeOff, Globe, LayoutGrid, Monitor, PenLine, UserRound } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import { useAuth } from '@/contexts/AuthContext'
import { getNavFeatureAccess } from '@/lib/navAccess'

const STATUS_TABS: (BlogStatus | 'ALL')[] = ['ALL', 'DRAFT', 'SCHEDULED', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED']
const STATUS_ICON: Record<BlogStatus | 'ALL', React.ComponentType<{ className?: string }>> = {
  ALL: LayoutGrid, DRAFT: PenLine, SCHEDULED: CalendarClock, PUBLISHED: Globe, UNPUBLISHED: EyeOff, ARCHIVED: Archive,
}

export default function BlogsDashboard() {
  return (
    <AuthGuard>
      <SubscriptionGuard requireStudioDesignAccess>
        <Suspense fallback={null}>
          <BlogsDashboardInner />
        </Suspense>
      </SubscriptionGuard>
    </AuthGuard>
  )
}

function BlogsDashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [blogs, setBlogs] = useState<BlogListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState<BlogStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [statSummary, setStatSummary] = useState<StatSummary | null>(null)
  // Only agents whose plan includes an IDX website get the "IDX Site" placement switch.
  const { user } = useAuth()
  const idxAccess = getNavFeatureAccess(user?.plan_tier, 'idx_website')
  const hasIdx = idxAccess.visible && !idxAccess.locked

  useEffect(() => {
    api.stats.getSummary().then(response => { if (response.success && response.data) setStatSummary(response.data) })
  }, [])

  // Where a published article lives (user, 10/17 - Share and Open on every card): IDX agents' own
  // site (/blog/<slug>), everyone else their Agent Hub (/<hub>/blogs/<slug>) - same rule as the editor.
  const [hubSlug, setHubSlug] = useState<string | null>(null)
  const [idxBase, setIdxBase] = useState<string | null>(null)
  const [shared, setShared] = useState<string | null>(null)
  useEffect(() => {
    api.agentHub.getMine().then(r => { if (r.success && r.data) setHubSlug(r.data.slug) })
    if (user?.plan_tier === 'IDX') api.sites.getPublicBaseUrl().then(r => { if (r.success && r.data && r.data.is_idx_site !== false) setIdxBase(r.data.base_url) })
  }, [user?.plan_tier])
  const liveUrl = (b: BlogListItem) => idxBase ? `${idxBase}/blog/${b.slug}` : hubSlug ? `${window.location.origin}/${hubSlug}/blogs/${b.slug}` : null
  const shareBlog = async (b: BlogListItem) => {
    const url = liveUrl(b)
    if (!url) return
    const nav = navigator as any
    if (nav.share && window.matchMedia('(pointer: coarse)').matches) {
      try { await nav.share({ title: b.title, url }); return } catch (e: any) { if (e?.name === 'AbortError') return }
    }
    if (await copyText(url)) { setShared(b.id); window.setTimeout(() => setShared(s => (s === b.id ? null : s)), 1800) }
  }

  useEffect(() => {
    api.blogs.getMine().then(response => {
      if (response.success && response.data) setBlogs(response.data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (searchParams.get('new') === '1') setShowCreate(true)
    const statusParam = searchParams.get('status') as BlogStatus | null
    if (statusParam) setStatusTab(statusParam)
  }, [searchParams])

  // Agent Hub / IDX Site placement - optimistic, rolled back if the save fails.
  const togglePlacement = async (blog: BlogListItem, key: 'agent_hub_visible' | 'idx_visible') => {
    const next = !(blog[key] !== false)
    setBlogs(current => current.map(b => (b.id === blog.id ? { ...b, [key]: next } : b)))
    const res = await api.blogs.updateHubVisibility(blog.id, { [key]: next })
    if (!res.success) setBlogs(current => current.map(b => (b.id === blog.id ? { ...b, [key]: !next } : b)))
  }

  // Quick delete from the list, behind a confirm - same permanent delete as inside the editor.
  const [pendingDelete, setPendingDelete] = useState<BlogListItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const confirmDelete = async () => {
    const blog = pendingDelete
    if (!blog) return
    setDeleting(true)
    setDeleteError('')
    const res = await api.blogs.delete(blog.id)
    setDeleting(false)
    setPendingDelete(null)
    if (res.success) setBlogs(current => current.filter(b => b.id !== blog.id))
    else setDeleteError(res.error || 'Could not delete that article. Try again.')
  }

  const filtered = useMemo(() => {
    return blogs.filter(blog => {
      if (statusTab !== 'ALL' && blog.status !== statusTab) return false
      if (search.trim() && !blog.title.toLowerCase().includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [blogs, statusTab, search])

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-5 sm:py-10">
        <StudioPageHeader
          icon={Newspaper}
          kicker="Blogs"
          title={<>Be the author of <em>your market</em></>}
          subtitle={`Market updates, neighborhood guides and advice for buyers and sellers - in your voice, on your Agent Hub${hasIdx ? ' and IDX site' : ''}.`}
          asideClassName="w-full lg:w-[360px] lg:self-center"
          badge={statSummary && <StatCard chip metric="blog_reads" label="Reads" icon={Eye} entry={statSummary.blog_reads} />}
          actions={
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search articles..."
                className="w-full rounded-xl border-2 border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold shadow-sm outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/10 dark:border-gray-800 dark:bg-[#151517] dark:text-white"
              />
            </div>
          }
          tabs={
            <LuxeTabs
              label="Article status"
              active={statusTab}
              onChange={setStatusTab}
              items={STATUS_TABS.map(tab => ({ id: tab, label: tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase(), icon: STATUS_ICON[tab] }))}
              pinEnd
              end={
                <button
                  onClick={() => setShowCreate(true)}
                  className="lx-shine group relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-3.5 py-2 text-xs font-black text-[#111827] shadow-md shadow-[#C9A24D]/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                >
                  <Plus className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" /> <span className="hidden sm:inline">Create a Blog</span><span className="sm:hidden">Create</span>
                </button>
              }
            />
          }
        />

        {deleteError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">{deleteError}</p>}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading && (
            <div className="col-span-full flex items-center justify-center gap-2 py-16 text-sm font-bold text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading articles...
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <button
              onClick={() => setShowCreate(true)}
              className="col-span-full flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 p-16 text-center transition hover:border-[#C9A24D] dark:border-gray-700"
            >
              <Newspaper className="h-8 w-8 text-gray-300" />
              <p className="font-black text-gray-500 dark:text-gray-400">No articles yet</p>
              <p className="text-sm font-semibold text-gray-400">Publish your first piece of local-authority content.</p>
            </button>
          )}
          <AnimatePresence mode="popLayout" initial={false}>
          {!loading && filtered.map((blog, index) => {
            const photo = blog.cover_image_url || blog.preview_image_url
            const look = blogTheme(blog.theme)
            const darkCover = look.id === 'midnight' || look.id === 'editorial'
            return (
            <motion.div
              key={blog.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 32, delay: Math.min(index * 0.03, 0.25) }}
              className="h-full"
            >
            <div className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[#C9A24D]/20 bg-white shadow-[0_18px_40px_-34px_rgba(139,115,85,.7)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-[#C9A24D]/60 hover:shadow-[0_28px_50px_-30px_rgba(201,162,77,.7)] dark:border-white/[0.08] dark:bg-[#151517]">
            <Link href={`/studio/blogs/${blog.id}`} className="flex flex-1 flex-col">
              <div className="relative aspect-[16/9] overflow-hidden">
                {photo ? (
                  <img src={resolveMediaUrl(photo)} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  // No photo yet - a cover drawn in the article's own theme, with its title.
                  <div className="relative flex h-full w-full flex-col justify-end p-4" style={{ background: darkCover ? (look.id === 'midnight' ? 'linear-gradient(135deg,#0b0f0e,#111827 60%,#2a2218)' : '#111827') : 'linear-gradient(135deg,#fffdf8,#fbf6ec 55%,#f1e3c2)' }}>
                    <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#C9A24D]/30 blur-2xl" />
                    <Newspaper className={`absolute right-4 top-4 h-6 w-6 ${darkCover ? 'text-[#e8c97a]/50' : 'text-[#C9A24D]/50'}`} />
                    <p className={`relative text-[10px] font-black uppercase tracking-[0.3em] ${darkCover ? 'text-[#e8c97a]' : 'text-[#8b7355]'}`}>{look.label} article</p>
                    <p className={`relative font-serif text-2xl font-black italic leading-tight ${darkCover ? 'text-white' : 'text-[#111827]'}`}>{blog.category || 'Your story'}</p>
                    <div className="relative mt-2 h-0.5 w-10 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a]" />
                  </div>
                )}
                {blog.ai_state ? (
                  <span className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide shadow ${blog.ai_state === 'failed' ? 'bg-rose-600 text-white' : 'bg-[#C9A24D] text-[#111827]'}`}>
                    {blog.ai_state === 'running' ? <><Loader2 className="h-2.5 w-2.5 animate-spin" /> AI is writing</> : blog.ai_state === 'failed' ? "AI couldn't finish" : 'Unfinished AI draft'}
                  </span>
                ) : (
                  <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">{blog.status.toLowerCase()}</span>
                )}
                {blog.agent_hub_featured && <Star className="absolute right-3 top-3 h-4 w-4 fill-[#C9A24D] text-[#C9A24D] drop-shadow" />}
              </div>
              <div className="flex flex-1 flex-col p-4">
                {blog.category && <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974]">{blog.category}</p>}
                <p className="mt-1 line-clamp-2 font-serif text-lg font-black leading-snug text-[#111827] dark:text-white">{blog.title}</p>
                <div className="mt-auto pt-3">
                  <div className="h-px bg-gradient-to-r from-[#C9A24D]/45 via-gray-200 to-transparent dark:from-[#C9A24D]/35 dark:via-white/10" />
                  <div className="mt-2.5 flex items-center gap-3 text-[11px] font-bold text-gray-400 dark:text-gray-500">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(blog.updated_at || blog.created_at).toLocaleDateString()}</span>
                    {blog.status === 'PUBLISHED' && <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {blog.view_count}</span>}
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wide"><span className="h-2 w-2 rounded-full ring-1 ring-black/10" style={{ background: `linear-gradient(135deg, ${look.bg} 50%, ${look.accent} 50%)` }} />{look.label}</span>
                  </div>
                </div>
              </div>
            </Link>
              {/* Open it (live page once published, the preview while it's a draft) and share it. */}
              <div className="flex items-center gap-2 border-t border-[#C9A24D]/15 px-4 py-3 dark:border-white/[0.06] sm:py-2.5">
                {blog.ai_state && blog.ai_state !== 'running' ? (
                  <Link href={`/studio/blogs/${blog.id}`}
                    className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#C9A24D] px-3 py-2 text-[12.5px] font-black text-[#111827] transition hover:-translate-y-0.5 active:scale-95 sm:min-h-0 sm:text-[11.5px]">
                    <Sparkles className="h-3.5 w-3.5" /> {blog.ai_state === 'failed' ? 'Try again' : 'Finish with AI'}
                  </Link>
                ) : blog.status === 'PUBLISHED' ? (
                  <a href={liveUrl(blog) || '#'} target="_blank" rel="noopener" onClick={e => { if (!liveUrl(blog)) e.preventDefault() }}
                    className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#111827] px-3 py-2 text-[12.5px] font-black text-white transition hover:-translate-y-0.5 active:scale-95 dark:bg-white dark:text-[#111827] sm:min-h-0 sm:text-[11.5px]">
                    <ExternalLink className="h-3.5 w-3.5" /> View live
                  </a>
                ) : (
                  <Link href={`/studio/blogs/${blog.id}?preview=1`}
                    className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12.5px] font-black text-[#111827] transition hover:-translate-y-0.5 hover:border-[#C9A24D] active:scale-95 dark:border-white/10 dark:bg-white/[0.04] dark:text-white sm:min-h-0 sm:text-[11.5px]">
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </Link>
                )}
                {blog.status === 'PUBLISHED' && (
                  <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={() => shareBlog(blog)} disabled={!liveUrl(blog)}
                    className={`inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-black transition hover:-translate-y-0.5 disabled:opacity-50 sm:min-h-0 sm:text-[11.5px] ${shared === blog.id ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-[#C9A24D]/40 bg-[#fffaf0] text-[#8b7355] hover:border-[#C9A24D] dark:bg-[#C9A24D]/10 dark:text-[#e8c97a]'}`}>
                    {shared === blog.id ? <><Check className="h-3.5 w-3.5" /> Link copied</> : <><Share2 className="h-3.5 w-3.5" /> Share</>}
                  </motion.button>
                )}
                {/* Phones: delete sits here, a full-size button - the switches row below has no room for it at 360px. */}
                <motion.button type="button" onClick={() => setPendingDelete(blog)} whileTap={{ scale: 0.9 }}
                  aria-label={`Delete ${blog.title}`}
                  className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border border-gray-200 text-gray-400 transition-colors active:bg-red-50 active:text-red-600 dark:border-white/10 dark:active:bg-red-500/10 sm:hidden">
                  <Trash2 className="h-4 w-4" />
                </motion.button>
              </div>
              <div className="flex items-center gap-2 border-t border-[#C9A24D]/15 px-4 py-3 dark:border-white/[0.06] sm:py-2.5">
                <span className="mr-auto hidden whitespace-nowrap text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 min-[380px]:inline">Shows on</span>
                <PlacementSwitch label="Agent Hub" icon={UserRound} on={blog.agent_hub_visible} onToggle={() => togglePlacement(blog, 'agent_hub_visible')} />
                {hasIdx
                  ? <PlacementSwitch label="IDX Site" icon={Monitor} on={blog.idx_visible !== false} onToggle={() => togglePlacement(blog, 'idx_visible')} />
                  : idxAccess.visible && <Link href={idxAccess.upgradeHref} title="Upgrade to IDX to put your blogs on your own IDX site" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 bg-gray-50 py-1 pl-2 pr-2 text-[10px] font-black leading-none text-gray-400 transition hover:border-[#C9A24D]/60 hover:text-[#8b7355] dark:border-white/10 dark:bg-white/[0.03]"><Lock className="h-3 w-3" />IDX Site<span className="rounded-full bg-[#C9A24D]/15 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-[#8b7355] dark:text-[#e8c97a]">Upgrade</span></Link>}
                <motion.button type="button" onClick={() => setPendingDelete(blog)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  title="Delete this article" aria-label={`Delete ${blog.title}`}
                  className="-mr-1 hidden h-7 w-7 shrink-0 place-items-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 sm:grid">
                  <Trash2 className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            </div>
            </motion.div>
            )
          })}
          </AnimatePresence>
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        isLoading={deleting}
        title="Delete this article?"
        message={`"${pendingDelete?.title || 'This article'}" will be permanently deleted${pendingDelete?.status === 'PUBLISHED' ? ' and taken off your Agent Hub' + (hasIdx ? ' and IDX site' : '') : ''}. This can't be undone - to just hide it, use Unpublish or Archive inside the article instead.`}
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-500/30"
      />

      <AnimatePresence>
        {showCreate && (
          <BlogCreateFlow key="create" onClose={() => { setShowCreate(false); router.replace('/studio/blogs') }} />
        )}
      </AnimatePresence>
    </div>
  )
}

function PlacementSwitch({ label, icon: Icon, on, onToggle }: { label: string; icon: React.ComponentType<{ className?: string }>; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      title={on ? `Showing on your ${label} - click to hide` : `Hidden from your ${label} - click to show`}
      className={`inline-flex min-h-[34px] flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border py-1 pl-2.5 pr-1.5 text-[11px] font-black leading-none transition min-[380px]:flex-none sm:min-h-0 sm:pl-2 sm:pr-1 sm:text-[10px] ${on ? 'border-[#C9A24D]/50 bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#e8c97a]' : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-white/10 dark:bg-white/[0.03]'}`}
    >
      <Icon className="h-3 w-3" />
      {label}
      <span className={`relative h-3.5 w-6 rounded-full transition-colors ${on ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-gray-700'}`}>
        <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-all ${on ? 'left-3' : 'left-0.5'}`} />
      </span>
    </button>
  )
}
