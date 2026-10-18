'use client'

// Every form button on the Agent Hub (I'm Buying, I'm Selling, What's My Home Worth, Schedule a
// Showing, a blog's form card...) opens the form in a window over the hub instead of leaving it
// (user, 10/18 - "I don't like taking people to other screens"). Same window the IDX site uses
// (FormWindow). One click listener catches any link to one of the agent's forms, so buttons keep
// their real href: a new tab / long-press still opens the full form page.
import { useEffect, useState } from 'react'
import api from '@/lib/api-service'
import FormWindow from '@/components/forms/FormWindow'
import type { PublicFormSummary } from '@/types'

export default function HubFormLauncher({ hubSlug, forms }: { hubSlug: string; forms?: PublicFormSummary[] }) {
  const [loaded, setLoaded] = useState<PublicFormSummary[]>([])
  const list = forms ?? loaded
  const [open, setOpen] = useState<{ url: string; title: string } | null>(null)

  useEffect(() => {
    if (forms || !hubSlug) return
    api.public.getPublicForms(hubSlug).then(r => { if (r.success && r.data) setLoaded(r.data) })
  }, [forms, hubSlug])

  useEffect(() => {
    if (!hubSlug || !list.length) return
    const bySlug = new Map(list.map(f => [f.slug.toLowerCase(), f]))
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || (a.target && a.target !== '_self')) return
      let u: URL
      try { u = new URL(a.href, window.location.href) } catch { return }
      if (u.origin !== window.location.origin) return
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts.length !== 2 || parts[0].toLowerCase() !== hubSlug.toLowerCase()) return
      const form = bySlug.get(parts[1].toLowerCase())
      if (!form) return
      e.preventDefault()
      e.stopPropagation()
      setOpen({ url: `${u.pathname}${u.search}`, title: form.title })
    }
    // Capture phase: before Next's <Link> navigates.
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [hubSlug, list])

  return <FormWindow url={open?.url || null} title={open?.title} onClose={() => setOpen(null)} />
}
