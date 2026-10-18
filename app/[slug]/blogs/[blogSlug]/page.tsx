'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import api from '@/lib/api-service'
import { PublicBlogDetail } from '@/types'
import BlogArticleBody from '@/components/studio/blogs/BlogArticleBody'
import { BlogThemedArticle, blogAccent, blogSignatureMatch } from '@/components/studio/blogs/BlogThemes'
import { setQrOwner } from '@/lib/qr'
import HubFormLauncher from '@/components/agent-hub/HubFormLauncher'

export default function PublicBlogArticlePage() {
  const params = useParams<{ slug: string; blogSlug: string }>()
  const [blog, setBlog] = useState<PublicBlogDetail | null>(null)
  const [status, setStatus] = useState<'loading' | 'found' | 'not-found'>('loading')

  useEffect(() => {
    api.public.getPublicBlog(params.slug, params.blogSlug).then(response => {
      if (response.success && response.data) { setBlog(response.data); setStatus('found') }
      else setStatus('not-found')
    })
  }, [params.slug, params.blogSlug])

  const trackEvent = (eventType: 'link_click' | 'property_click' | 'contact_click' | 'video_play', meta?: Record<string, unknown>) => {
    api.public.trackBlogEvent(params.slug, params.blogSlug, eventType, meta)
  }

  if (status === 'not-found') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f5f1] px-6 text-center dark:bg-[#0B0B0B]">
        <h1 className="font-serif text-3xl font-black text-[#111827] dark:text-white">This article isn&apos;t available</h1>
        <Link href={`/${params.slug}/blogs`} className="mt-6 inline-flex items-center justify-center rounded-full bg-[#111827] px-5 py-2.5 text-sm font-black text-white dark:bg-white dark:text-[#111827]">Browse Articles</Link>
      </main>
    )
  }

  if (status === 'loading' || !blog) return <div className="min-h-screen bg-[#f7f5f1] dark:bg-[#0B0B0B]" />

  // The article in its theme (Luxe by default - the agent can switch it in the editor).
  return (
    <BlogThemedArticle
      theme={blog.theme}
      title={blog.title}
      subtitle={blog.subtitle}
      category={blog.category}
      coverUrl={blog.coverImageUrl}
      publishedAt={blog.publishedAt}
      readingTimeMinutes={blog.readingTimeMinutes}
      agent={{ name: blog.agentName, title: blog.agentTitle, brokerage: blog.agentBrokerage, photoUrl: blog.agentPhotoUrl }}
      backHref={`/${params.slug}/blogs`}
      hubHref={`/${params.slug}`}
      readerToggle
      signatureOn={!!blog.signatureCard}
      metal={blog.luxeMetal}
      accent={blog.accentColor}
    >
      {blog.agentId && <QrOwner id={blog.agentId} />}
      <HubFormLauncher hubSlug={params.slug} />
      <BlogArticleBody
        // Every article ends with the agent's related articles, unless it already places them itself.
        blocks={blog.blocks.some(b => b.type === 'related_articles') ? blog.blocks : [...blog.blocks, { id: 'auto-related', type: 'related_articles', data: {} }]}
        agent={{ name: blog.agentName, brokerage: blog.agentBrokerage, photoUrl: blog.agentPhotoUrl, title: blog.agentTitle }}
        accentColor={blogAccent(blog.theme, blog.luxeMetal, blog.accentColor)}
        onEvent={trackEvent}
        onLead={async payload => {
          const res = await api.public.submitBlogLead(params.slug, params.blogSlug, payload)
          return { ok: !!res.success, error: res.error }
        }}
        related={blog.related || []}
        relatedHref={slug => `/${params.slug}/blogs/${slug}`}
        formHref={formSlug => `/${params.slug}/${formSlug}?src=blog`}
        signatureHubSlug={blog.signatureCard ? params.slug : null}
        signatureTowns={blog.areaTowns || []}
        signatureMatch={blogSignatureMatch(blog.theme, blog.luxeMetal, blog.accentColor)}
        forms={blog.forms || []}
        neighborhoodLinks={blog.neighborhoodLinks || []}
      />
    </BlogThemedArticle>
  )
}

// The article's QR codes use its author's centre logo choice.
function QrOwner({ id }: { id: string }) {
  setQrOwner(id)
  return null
}
