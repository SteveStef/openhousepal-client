'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Clock, Loader2, ShieldCheck, UserRound } from 'lucide-react'
import { SiteTheme } from '../types'
import { fontClass, headingClass } from './fontClass'

interface PublicFormShape {
  formId: string
  formType?: string
  slug?: string
  title: string
  headline?: string | null
  subtitle?: string | null
}

// The "Lead Form" section: the agent's real form, opened in a window over the page by the site's
// form launcher (SiteFormLauncher - the same one every lead button uses), so its choices, follow-up
// questions and steps all work. It used to draw the questions itself as plain text boxes - a
// "buy or sell?" choice became a blank box and every follow-up question showed at once (10/27).
export default function FormBlock({ data, theme, siteId, basePrefix = '' }: { data: Record<string, any>; theme: SiteTheme; siteId?: string; basePrefix?: string }) {
  const formId = data.form_id as string | undefined
  const [form, setForm] = useState<PublicFormShape | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!formId || !siteId) { setLoading(false); return }
    setLoading(true)
    fetch(`/api/website-forms/${formId}?site_id=${encodeURIComponent(siteId)}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(setForm)
      .catch(() => setForm(null))
      .finally(() => setLoading(false))
  }, [formId, siteId])

  if (!formId) return null
  const luxe = theme.template !== 'default'
  const serif = fontClass(theme.heading_font, 'font-serif')
  if (loading) return (
    <section className="mx-auto max-w-3xl px-6 py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" style={{ color: 'var(--site-faint)' }} /></section>
  )
  if (!form) return null

  const title = form.headline || form.title
  const href = `${basePrefix}/forms/${encodeURIComponent(form.slug || form.formId)}?site_chrome=1`
  return (
    <section className="px-5 py-16 sm:px-6 sm:py-20">
      <div className={`relative mx-auto max-w-3xl overflow-hidden border px-6 py-10 text-center sm:px-12 sm:py-14 ${luxe ? 'rounded-[28px]' : 'rounded-2xl'}`}
        style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-line)', boxShadow: 'var(--site-shadow)' }}>
        <span aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-full opacity-60 blur-3xl" style={{ backgroundColor: 'rgba(var(--site-accent-rgb),.18)' }} />
        <p className="relative text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--site-accent-text)' }}>Let&apos;s talk</p>
        <h2 className={`ohp-site-heading relative mt-3 text-[1.9rem] leading-[1.1] sm:text-4xl ${luxe ? `font-black ${serif}` : `font-extrabold tracking-tight ${headingClass(theme.heading_font)}`}`} style={{ color: 'var(--site-heading)' }}>
          {title}
        </h2>
        {form.subtitle && <p className={`relative mx-auto mt-3 max-w-xl text-[15px] leading-relaxed ${fontClass(theme.body_font)}`} style={{ color: 'var(--site-muted)' }}>{form.subtitle}</p>}
        <a href={href} data-ohp-form={form.formType || 'how_can_i_help'} data-ohp-form-slug={form.slug || undefined} data-ohp-form-title={title}
          className={`relative mt-7 inline-flex items-center gap-2 px-8 py-4 text-sm font-black transition hover:-translate-y-0.5 ${luxe ? 'ohp-gold-sheen rounded-full uppercase tracking-[0.14em]' : 'rounded-xl shadow-md'}`}
          style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
          Get started <ArrowRight className="h-4 w-4" />
        </a>
        <div className="relative mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-bold" style={{ color: 'var(--site-ink-soft)' }}>
          <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" style={{ color: 'var(--site-accent)' }} /> About a minute</span>
          <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" style={{ color: 'var(--site-accent)' }} /> Goes straight to me</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--site-accent)' }} /> No spam, ever</span>
        </div>
      </div>
    </section>
  )
}
