'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, CalendarDays, ChevronRight, DollarSign, KeyRound, Mail, MapPin, MessageSquare, Phone, Sparkles, Star, TrendingUp, User } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { openHousePalPublicUrl } from '@/lib/publicResourceLinks'
import type { SiteTheme } from './types'
import { fontClass } from './blocks/fontClass'
import Reveal from './Reveal'
import { pickSiteForm, type SiteFormRef } from './SiteFormLauncher'
import { sizedImage } from '@/lib/siteImage'

export interface ContactProfile {
  name?: string; phone?: string; email?: string; photo_url?: string; title?: string; brokerage?: string; market?: string
  license_number?: string; rating?: { count: number; average: number | null } | null
  forms?: SiteFormRef[]; agent_hub_slug?: string | null
}

// "Other ways I can help" - each opens that form in a window (SiteFormLauncher).
const HELP = [
  { form: 'buying', label: "I'm buying", sub: 'Tell me what you’re looking for', icon: KeyRound },
  { form: 'selling', label: "I'm selling", sub: 'Get a plan for your home', icon: TrendingUp },
  { form: 'home_value', label: "What's my home worth?", sub: 'A real number, not a guess', icon: DollarSign },
  { form: 'showing', label: 'Book a showing', sub: 'Pick a home and a time', icon: CalendarDays },
  { form: 'showcase_request', label: 'Get new homes first', sub: 'Your own private Showcase', icon: Sparkles },
]

// The Contact page: the agent on the left (photo, rating, call / text / email, their Agent Hub,
// and one-tap forms for buying, selling, home value, a showing, a Showcase); their general
// "How can I help" form right on the page on the right.
export default function ContactPageView({ profile, theme, basePrefix = '' }: { profile: ContactProfile; theme: SiteTheme; basePrefix?: string }) {
  const luxe = theme.template !== 'default'
  const serif = fontClass(theme.heading_font, 'font-serif')
  const tel = (profile.phone || '').replace(/[^\d+]/g, '')
  const first = (profile.name || '').split(' ')[0] || 'me'
  const forms = profile.forms || []
  const main = pickSiteForm(forms, 'how_can_i_help')
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (profile.agent_hub_slug && main) setSrc(`${openHousePalPublicUrl(`/${profile.agent_hub_slug}/${main.slug}`)}?embed=1`)
  }, [profile.agent_hub_slug, main])
  const rating = profile.rating && profile.rating.average != null && profile.rating.count > 0 ? profile.rating : null
  const help = HELP.filter(h => forms.some(f => f.form_type === h.form))

  const card = { backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-line)', boxShadow: 'var(--site-shadow)' }
  return (
    <main data-testid="contact-page" style={{ backgroundColor: 'var(--site-bg)' }}>
      <section className="relative overflow-hidden px-5 pb-28 pt-32 text-center sm:px-6 sm:pt-36" style={{ background: luxe ? `radial-gradient(70% 120% at 50% 0%, rgba(var(--site-accent-rgb),.25), transparent 60%), ${theme.primary_color}` : 'var(--site-bg-alt)' }}>
        <Reveal>
          <p className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: luxe ? 'var(--site-accent-light)' : 'var(--site-accent-text)' }}>Contact</p>
          <h1 className={`mt-3 text-5xl leading-[1.02] sm:text-7xl ${luxe ? `font-black text-white ${serif}` : 'font-extrabold tracking-tight'}`} style={luxe ? undefined : { color: 'var(--site-heading)' }}>
            Let&apos;s <span className={luxe ? 'ohp-text-shimmer' : ''} style={luxe ? undefined : { color: 'var(--site-accent)' }}>talk.</span>
          </h1>
          <p className={`mx-auto mt-4 max-w-xl text-base sm:text-lg ${luxe ? 'text-white/70' : ''}`} style={luxe ? undefined : { color: 'var(--site-muted)' }}>A question, a home, a plan - send a note below, or reach me directly. I answer every message myself.</p>
        </Reveal>
        <div id="site-hero-sentinel" className="pointer-events-none absolute inset-x-0 bottom-0 h-px" />
      </section>

      <section className="relative mx-auto -mt-16 grid max-w-6xl gap-6 px-5 pb-20 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Reveal className="lg:sticky lg:top-24 lg:self-start">
          <div className={`overflow-hidden border ${luxe ? 'rounded-[28px]' : 'rounded-3xl'}`} style={card}>
            <div className="flex items-center gap-4 p-6">
              {profile.photo_url
                ? <img src={sizedImage(resolveMediaUrl(profile.photo_url), 256)} loading="lazy" decoding="async" alt={profile.name || ''} className={`h-20 w-20 shrink-0 object-cover ring-4 ${luxe ? 'rounded-full' : 'rounded-2xl'}`} style={{ ['--tw-ring-color' as any]: 'rgba(var(--site-accent-rgb),.35)' }} />
                : <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-xl font-black" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>{(profile.name || '?').slice(0, 1)}</span>}
              <div className="min-w-0">
                <p className={`truncate text-2xl leading-tight ${luxe ? `font-black ${serif}` : 'font-extrabold tracking-tight'}`} style={{ color: 'var(--site-heading)' }}>{profile.name}</p>
                <p className="truncate text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--site-accent-text)' }}>{[profile.title, profile.brokerage].filter(Boolean).join(' · ')}</p>
                {rating && (
                  <a href={`${basePrefix}/testimonials`} className="mt-1 inline-flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--site-muted)' }}>
                    <Star className="h-3.5 w-3.5" style={{ color: 'var(--site-accent)', fill: 'var(--site-accent)' }} />{rating.average!.toFixed(1)} · {rating.count} reviews
                  </a>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 px-6">
              {tel && <a href={`tel:${tel}`} className="flex flex-col items-center gap-1 rounded-2xl py-3 text-xs font-black transition hover:-translate-y-0.5" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}><Phone className="h-4 w-4" />Call</a>}
              {tel && <a href={`sms:${tel}`} className="flex flex-col items-center gap-1 rounded-2xl border py-3 text-xs font-black transition hover:-translate-y-0.5" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}><MessageSquare className="h-4 w-4" />Text</a>}
              {profile.email && <a href={`mailto:${profile.email}`} className="flex flex-col items-center gap-1 rounded-2xl border py-3 text-xs font-black transition hover:-translate-y-0.5" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}><Mail className="h-4 w-4" />Email</a>}
            </div>
            <div className="mt-4 space-y-1.5 px-6 text-sm font-semibold" style={{ color: 'var(--site-ink-soft)' }}>
              {profile.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" style={{ color: 'var(--site-faint)' }} />{profile.phone}</p>}
              {profile.email && <p className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--site-faint)' }} />{profile.email}</p>}
              {profile.market && <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" style={{ color: 'var(--site-faint)' }} />{profile.market}</p>}
            </div>
            <a href={`${basePrefix}/about`} className="mx-6 mt-4 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5" style={{ backgroundColor: 'var(--site-bg-alt)', color: 'var(--site-heading)' }}>
              <span className="flex items-center gap-2"><User className="h-4 w-4" style={{ color: 'var(--site-accent)' }} />Everything about {first} - my Agent Hub</span><ArrowUpRight className="h-4 w-4" />
            </a>
            {help.length > 0 && (
              <div className="mt-6 border-t px-6 pb-6 pt-5" style={{ borderColor: 'var(--site-line)' }}>
                <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--site-faint)' }}>Other ways I can help</p>
                <div className="mt-2 divide-y" style={{ borderColor: 'var(--site-line)' }}>
                  {help.map(h => (
                    <a key={h.form} href={`${basePrefix}/contact`} data-ohp-form={h.form} data-ohp-form-title={h.label} className="group flex items-center gap-3 py-3" style={{ borderColor: 'var(--site-line)' }}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-110" style={{ backgroundColor: 'rgba(var(--site-accent-rgb),.12)', color: 'var(--site-accent-text)' }}><h.icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-black" style={{ color: 'var(--site-heading)' }}>{h.label}</span><span className="block text-xs font-semibold" style={{ color: 'var(--site-muted)' }}>{h.sub}</span></span>
                      <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" style={{ color: 'var(--site-faint)' }} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className={`overflow-hidden border ${luxe ? 'rounded-[28px]' : 'rounded-3xl'}`} style={card}>
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--site-line)' }}>
              <p className={`text-lg ${luxe ? `font-black ${serif}` : 'font-extrabold'}`} style={{ color: 'var(--site-heading)' }}>Send {first} a note</p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Usually replies the same day</span>
            </div>
            {src
              ? <iframe title="Contact form" src={src} className="block h-[680px] w-full border-0" />
              : <div className="flex h-[680px] items-center justify-center p-8 text-center text-sm font-semibold" style={{ color: 'var(--site-faint)' }}>
                  {main ? 'Loading the form…' : <span>Reach me directly - {profile.phone ? <a href={`tel:${tel}`} className="underline">{profile.phone}</a> : null}{profile.email ? <> or <a href={`mailto:${profile.email}`} className="underline">{profile.email}</a></> : null}</span>}
                </div>}
          </div>
        </Reveal>
      </section>
    </main>
  )
}
