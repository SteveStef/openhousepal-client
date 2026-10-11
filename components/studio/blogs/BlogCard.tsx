'use client'

import { Clock, Eye } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import BlogCoverArt from '@/components/BlogCoverArt'

export interface BlogCardProps {
  title: string
  subtitle?: string | null
  category?: string | null
  publishedAt?: string | null
  viewCount?: number
  /** The article's cover (or first photo) - shown on top when there is one. */
  imageUrl?: string | null
  readingTimeMinutes?: number
  className?: string
}

function formatPublished(publishedAt?: string | null): string | null {
  if (!publishedAt) return null
  const date = new Date(publishedAt)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// The one blog-card visual used everywhere a blog is listed (public article listing, Agent Hub's
// Blogs section). With a photo it leads with it; without one it leads with the designed cover
// (BlogCoverArt, picked by who the article is for), so mixed content still reads as one set.
export default function BlogCard({ title, subtitle, category, publishedAt, viewCount = 0, imageUrl, readingTimeMinutes, className = '' }: BlogCardProps) {
  const published = formatPublished(publishedAt)
  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-[22px] border border-[#C9A24D]/20 bg-gradient-to-b from-[#fffdf8] to-[#fbf6ec] shadow-[0_18px_40px_-32px_rgba(139,115,85,.8)] transition duration-300 group-hover:-translate-y-1 group-hover:border-[#C9A24D]/60 group-hover:shadow-[0_28px_50px_-30px_rgba(201,162,77,.7)] dark:border-white/[0.08] dark:from-[#171613] dark:to-[#141416] ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 z-10 h-px bg-gradient-to-r from-transparent via-[#C9A24D]/70 to-transparent" />
      <div className="aspect-[16/10] overflow-hidden">
        {imageUrl ? <img src={resolveMediaUrl(imageUrl)} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /> : <BlogCoverArt category={category} title={title} />}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {category && (
          <span className="inline-flex w-fit items-center rounded-full border border-[#d0ad65]/40 bg-[#d0ad65]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">
            {category}
          </span>
        )}
        <h3 className={`font-serif text-xl font-black leading-[1.15] text-[#111827] decoration-[#C9A24D]/60 underline-offset-4 group-hover:underline dark:text-white ${category ? 'mt-3' : ''}`}>{title || 'Untitled Article'}</h3>
        {subtitle && <p className="mt-2 line-clamp-3 flex-1 text-sm font-medium leading-snug text-gray-500 dark:text-gray-400">{subtitle}</p>}
        {!subtitle && <div className="flex-1" />}
        <div className="mt-4 flex items-center justify-between border-t border-[#C9A24D]/15 pt-3 text-[11px] font-bold text-gray-400 dark:border-white/[0.08]">
          <span>{published || 'Not yet published'}</span>
          <span className="flex items-center gap-3">
            {readingTimeMinutes ? <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {readingTimeMinutes} min</span> : null}
            <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {viewCount.toLocaleString()}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
