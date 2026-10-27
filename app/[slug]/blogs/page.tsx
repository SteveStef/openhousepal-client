'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Clock, Newspaper } from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { PublicBlogSummary } from '@/types'
import HubFormLauncher from '@/components/agent-hub/HubFormLauncher'
import BlogCard from '@/components/studio/blogs/BlogCard'

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '')

// The agent's articles, magazine-style: the newest as the featured story, the rest as a grid, with
// category filters. Same luxe language as the articles themselves (BlogThemes).
export default function PublicBlogListPage() {
  const params = useParams<{ slug: string }>()
  const [blogs, setBlogs] = useState<PublicBlogSummary[]>([])
  const [status, setStatus] = useState<'loading' | 'found' | 'not-found'>('loading')
  const [category, setCategory] = useState<string | null>(null)
  const [agentName, setAgentName] = useState('')
  const [allCategories, setAllCategories] = useState<string[]>([])

  // The articles decide whether this page exists - an agent can publish articles before their
  // Agent Hub itself is live (the hub only supplies the agent's display name here).
  const [hubLive, setHubLive] = useState<boolean | null>(null)
  useEffect(() => {
    api.public.checkAgentHub(params.slug).then(response => {
      setHubLive(!!response.success)
      const profile = (response.data?.config as any)?.profile
      if (profile?.name) setAgentName(profile.name)
    })
  }, [params.slug])

  useEffect(() => {
    api.public.getPublicBlogs(params.slug, category || undefined).then(response => {
      if (response.success && response.data) {
        setBlogs(response.data)
        if (!category) setAllCategories(Array.from(new Set(response.data.map(b => b.category).filter(Boolean))) as string[])
        if (response.data.length || category) { setStatus('found'); return }
      }
      if (!category) setStatus(prev => (prev === 'found' ? prev : 'pending-hub' as any))
    })
  }, [params.slug, category])

  // No articles: the page still shows (empty state) for a live hub, else it's an inactive link.
  useEffect(() => {
    if ((status as string) === 'pending-hub' && hubLive !== null) setStatus(hubLive ? 'found' : 'not-found')
  }, [status, hubLive])

  if (status === 'not-found') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#faf7f0] px-6 text-center dark:bg-[#0B0B0B]">
        <h1 className="font-serif text-3xl font-black text-[#111827] dark:text-white">This link isn&apos;t active</h1>
        <Link href="/" className="mt-6 inline-flex items-center justify-center rounded-full bg-[#111827] px-5 py-2.5 text-sm font-black text-white dark:bg-white dark:text-[#111827]">Go to OpenHousePal</Link>
      </main>
    )
  }

  if (status !== 'found') return <div className="min-h-screen bg-[#faf7f0] dark:bg-[#0B0B0B]" />

  const [featured, ...rest] = blogs

  return (
    <main className="min-h-screen bg-[#faf7f0] dark:bg-[#0B0B0B]">
      <HubFormLauncher hubSlug={params.slug} />
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_130%_at_100%_0%,rgba(201,162,77,.22),transparent_55%),linear-gradient(135deg,#fffdf8_0%,#fbf6ec_55%,#f4ead7_100%)] dark:bg-[radial-gradient(110%_130%_at_100%_0%,rgba(201,162,77,.2),transparent_55%),linear-gradient(135deg,#0b0f0e_0%,#111827_55%,#1d1810_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D] to-transparent" />
        <div className="relative mx-auto max-w-6xl px-5 pb-10 pt-6">
          <Link href={hubLive ? `/${params.slug}` : '/'} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-widest text-[#111827] shadow-sm transition hover:-translate-x-0.5 dark:border-white/10 dark:bg-white/10 dark:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
            <p className="mt-8 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.3em] text-[#8b7355] dark:text-[#e8c97a]">
              <span className="h-px w-8 bg-[#C9A24D]" />{agentName ? `${agentName}'s journal` : 'The journal'}
            </p>
            <h1 className="mt-3 font-serif text-[2.6rem] font-black leading-[1.02] tracking-[-0.02em] text-[#111827] dark:text-white sm:text-6xl">
              Stories &amp; <em className="font-light text-[#a8803a] dark:text-[#e8c97a]">local insight</em>
            </h1>
            <p className="mt-3 max-w-xl text-base font-medium text-gray-600 dark:text-white/60">Market updates, neighborhood guides and honest advice for buying and selling here.</p>
          </motion.div>

          {allCategories.length > 0 && (
            <div className="mt-6 inline-flex flex-wrap gap-1 rounded-full border border-[#C9A24D]/25 bg-white/80 p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
              {[null, ...allCategories].map(c => {
                const on = category === c
                return (
                  <button key={c || 'all'} onClick={() => setCategory(c)} className={`relative rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wide transition-colors ${on ? 'text-white dark:text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-white/60 dark:hover:text-white'}`}>
                    {on && <motion.span layoutId="blog-cat" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-full bg-[#111827] dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a]" />}
                    <span className="relative">{c || 'All'}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        {featured && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
            <Link href={`/${params.slug}/blogs/${featured.slug}`} className="group grid overflow-hidden rounded-[28px] border border-[#C9A24D]/25 bg-white shadow-[0_30px_60px_-40px_rgba(139,115,85,.8)] transition hover:-translate-y-1 dark:border-white/10 dark:bg-[#151517] md:grid-cols-[1.25fr_1fr]">
              <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-[#fbf6ec] to-[#f1e3c2] md:aspect-auto md:min-h-[320px] dark:from-[#1d1810] dark:to-[#111827]">
                {featured.coverImageUrl
                  ? <img src={resolveMediaUrl(featured.coverImageUrl)} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  : <Newspaper className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-[#C9A24D]/40" />}
                <span className="absolute left-4 top-4 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#111827] shadow">Latest</span>
              </div>
              <div className="flex flex-col justify-center p-6 sm:p-9">
                {featured.category && <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#e8c97a]">{featured.category}</p>}
                <h2 className="mt-2 font-serif text-3xl font-black leading-tight text-[#111827] dark:text-white">{featured.title}</h2>
                {featured.subtitle && <p className="mt-3 line-clamp-3 text-base font-medium leading-relaxed text-gray-500 dark:text-gray-400">{featured.subtitle}</p>}
                <p className="mt-5 flex items-center gap-3 text-xs font-bold text-gray-400">
                  <span>{fmtDate(featured.publishedAt)}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {featured.readingTimeMinutes} min read</span>
                </p>
                <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-[#111827] px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition group-hover:bg-gradient-to-r group-hover:from-[#C9A24D] group-hover:to-[#e8c97a] group-hover:text-[#111827] dark:bg-white dark:text-[#111827]">
                  Read the story <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          </motion.div>
        )}

        {rest.length > 0 && (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((blog, i) => (
              <motion.div key={blog.slug} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: Math.min(i * 0.05, 0.3) }}>
                <Link href={`/${params.slug}/blogs/${blog.slug}`} className="group block h-full">
                  <BlogCard title={blog.title} subtitle={blog.subtitle} category={blog.category} publishedAt={blog.publishedAt} viewCount={blog.viewCount} imageUrl={blog.coverImageUrl} readingTimeMinutes={blog.readingTimeMinutes} />
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {!blogs.length && (
          <div className="mt-2 rounded-[28px] border border-dashed border-[#C9A24D]/40 bg-white/70 p-12 text-center dark:border-white/10 dark:bg-white/[0.03]">
            <Newspaper className="mx-auto h-8 w-8 text-[#C9A24D]" />
            <p className="mt-3 font-serif text-xl font-black text-[#111827] dark:text-white">The first story is on its way.</p>
            <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">Check back soon for local market updates and guides.</p>
          </div>
        )}
      </section>
    </main>
  )
}
