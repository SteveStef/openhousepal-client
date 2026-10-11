import { ArrowUpRight, Facebook, Globe, Instagram, Mail, MapPin, MessageSquare, Music2, Phone, Quote, Youtube } from 'lucide-react'
import { SiteTheme } from '../types'
import { fontClass } from './fontClass'

function formatVolume(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1000)}K`
  return `$${value}`
}

const SOCIAL_ICON: Record<string, typeof Globe> = { instagram: Instagram, facebook: Facebook, youtube: Youtube, tiktok: Music2, website: Globe }

// "Meet your agent" on the home page: a tall portrait in a metal frame (a light glow behind it on
// Luxe), and beside it the name, title, where they work, the bio set as a quote, one-tap Call /
// Text / Email, the socials as icons, and the real track record (active listings, homes sold,
// volume) as a ruled row of serif figures. Only substantiated numbers - never invented
// "years of experience" or ratings.
export default function AboutAgentBlock({ data, theme, basePrefix = '' }: { data: Record<string, any>; theme: SiteTheme; basePrefix?: string }) {
  // `resolved` is the real OHP profile (User + AgentHub, see content_adapters.get_agent_profile)
  // hydrated server-side, already merged with any website-only overrides. Falls back to plain
  // manual `data` fields for the in-editor preview and for any block saved before this existed.
  const source = data.resolved || data
  const name = source.name || ''
  const title = source.title || ''
  const bio = source.bio || ''
  const market = source.market as string | undefined
  const brokerage = source.brokerage as string | undefined
  const photoUrl = source.photo_url as string | undefined
  const phone = source.phone as string | undefined
  const email = source.email as string | undefined
  const socialLinks = (source.social_links || []) as { id: string; label: string; url: string }[]
  const stats = source.stats as { active_listings?: number; sold_count?: number; sold_volume?: number } | undefined
  const statItems = [
    stats?.active_listings ? { label: stats.active_listings === 1 ? 'Active listing' : 'Active listings', value: String(stats.active_listings) } : null,
    stats?.sold_count ? { label: stats.sold_count === 1 ? 'Home sold' : 'Homes sold', value: String(stats.sold_count) } : null,
    stats?.sold_volume ? { label: 'Sales volume', value: formatVolume(stats.sold_volume) } : null,
  ].filter(Boolean) as { label: string; value: string }[]

  if (!name && !bio) return null
  const luxe = theme.template !== 'default'
  const gold = theme.secondary_color
  const ink = theme.primary_color
  const serif = fontClass(theme.heading_font, 'font-serif')
  const tel = phone ? phone.replace(/[^\d+]/g, '') : ''
  // "Text me" goes to the number they text from (blank = the same number).
  const textTel = String((source.text_phone as string | undefined) || phone || '').replace(/[^\d+]/g, '')
  const first = name.split(' ')[0]

  if (!luxe) {
    return (
      <section className="px-6 py-20 sm:py-28" style={{ backgroundColor: 'var(--site-bg)' }}>
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          {photoUrl && (
            <div className="relative mx-auto w-full max-w-[400px] pb-8 pr-8">
              <div className="absolute bottom-0 right-0 h-[78%] w-[78%] rounded-[28px]" style={{ backgroundColor: 'var(--site-accent)' }} />
              <img src={photoUrl} alt={name} className="relative aspect-[4/5] w-full rounded-[28px] object-cover shadow-[0_40px_80px_-40px_rgba(17,24,39,.5)]" />
              <div className="absolute bottom-3 left-5 right-14 rounded-2xl border px-5 py-4 shadow-[0_20px_40px_-20px_rgba(17,24,39,.4)]" style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-surface)' }}>
                <p className="text-lg font-extrabold leading-tight" style={{ color: 'var(--site-heading)' }}>{name}</p>
                {brokerage && <p className="mt-0.5 text-xs font-semibold" style={{ color: 'var(--site-muted)' }}>{brokerage}</p>}
              </div>
            </div>
          )}
          <div className={photoUrl ? '' : 'lg:col-span-2 lg:mx-auto lg:max-w-3xl lg:text-center'}>
            <p className="text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--site-accent)' }}>Meet your agent</p>
            {name && <h2 className="ohp-site-heading mt-2 text-[2.4rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl" style={{ color: 'var(--site-heading)' }}>{name}</h2>}
            {(title || market) && (
              <p className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] font-semibold ${photoUrl ? '' : 'lg:justify-center'}`} style={{ color: 'var(--site-muted)' }}>
                {title && <span>{title}</span>}
                {title && market && <span className="h-1 w-1 rounded-full" style={{ backgroundColor: 'var(--site-faint)' }} />}
                {market && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" style={{ color: 'var(--site-accent)' }} />{market}</span>}
              </p>
            )}
            {bio && <p className={`mt-6 border-l-[3px] pl-5 text-[17px] leading-[1.8] ${fontClass(theme.body_font)}`} style={{ borderColor: 'var(--site-accent)', color: 'var(--site-ink-soft)' }}>{bio}</p>}
            {(tel || email || socialLinks.length > 0) && (
              <div className={`mt-8 flex flex-wrap items-center gap-2.5 ${photoUrl ? '' : 'lg:justify-center'}`}>
                {tel && <a href={`tel:${tel}`} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition hover:-translate-y-0.5" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}><Phone className="h-4 w-4" /> Call {first}</a>}
                {tel && <a href={`sms:${textTel}`} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5" style={{ backgroundColor: 'var(--site-heading)', color: 'var(--site-bg)' }}><MessageSquare className="h-4 w-4" /> Text</a>}
                {email && <a href={`mailto:${email}`} className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}><Mail className="h-4 w-4" /> Email</a>}
                <a href={`${basePrefix}/about`} className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}>My Agent Hub <ArrowUpRight className="h-4 w-4" /></a>
                {socialLinks.map(link => {
                  const Icon = SOCIAL_ICON[link.id] || Globe
                  return (
                    <a key={link.id} href={link.url} target="_blank" rel="noreferrer" aria-label={link.label || link.id} title={link.label || link.id} className="grid h-11 w-11 place-items-center rounded-xl border transition hover:-translate-y-0.5" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-ink-soft)' }}>
                      <Icon className="h-4 w-4" />
                    </a>
                  )
                })}
              </div>
            )}
            {statItems.length > 0 && (
              <dl className="mt-9 grid gap-3" style={{ gridTemplateColumns: `repeat(${statItems.length}, minmax(0, 1fr))` }}>
                {statItems.map(stat => (
                  <div key={stat.label} className="rounded-2xl px-4 py-4" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
                    <dd className="text-3xl font-extrabold leading-none tracking-tight" style={{ color: 'var(--site-heading)' }}>{stat.value}</dd>
                    <dt className="mt-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--site-faint)' }}>{stat.label}</dt>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative overflow-hidden px-6 py-20 sm:py-28">
      {luxe && <div className="pointer-events-none absolute left-[12%] top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full blur-[110px]" style={{ backgroundColor: `${gold}2a` }} />}
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        {/* portrait */}
        {photoUrl && (
          <div className="relative mx-auto w-full max-w-[400px]">
            <div className="absolute -inset-3 rounded-[38px] opacity-70" style={{ background: `linear-gradient(140deg, ${gold}, transparent 45%, ${gold}88)` }} />
            <div className="relative overflow-hidden rounded-[32px] shadow-[0_50px_100px_-50px_rgba(0,0,0,.75)]">
              <img src={photoUrl} alt={name} className="aspect-[4/5] w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <span className="block h-px w-10" style={{ background: `linear-gradient(90deg, ${gold}, transparent)` }} />
                <p className={`mt-3 text-2xl font-black text-white ${serif}`}>{name}</p>
                {brokerage && <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: gold }}>{brokerage}</p>}
              </div>
            </div>
          </div>
        )}

        {/* words */}
        <div className={photoUrl ? '' : 'lg:col-span-2 lg:mx-auto lg:max-w-3xl lg:text-center'}>
          <div className={`flex items-center gap-3 ${photoUrl ? '' : 'lg:justify-center'}`}>
            <span className="h-px w-8" style={{ backgroundColor: gold }} />
            <span className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: gold }}>Meet your agent</span>
          </div>
          {name && <h2 className={`ohp-site-heading mt-4 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl ${serif}`} style={{ color: 'var(--site-heading)' }}>{name}</h2>}
          {(title || market) && (
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-gray-500">
              {title && <span className="uppercase tracking-[0.16em]">{title}</span>}
              {title && market && <span className="h-1 w-1 rounded-full" style={{ backgroundColor: gold }} />}
              {market && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" style={{ color: gold }} />{market}</span>}
            </p>
          )}

          {bio && (
            <div className="relative mt-7 rounded-[26px] border bg-white/70 p-6 shadow-[0_24px_60px_-44px_rgba(17,24,39,.5)] sm:p-7" style={{ borderColor: `${gold}33` }}>
              <Quote className="absolute -top-4 left-6 h-8 w-8 rounded-full p-1.5" style={{ backgroundColor: ink, color: gold }} />
              <p className={`text-[17px] leading-[1.8] text-gray-600 ${fontClass(theme.body_font)}`}>{bio}</p>
            </div>
          )}

          {(tel || email) && (
            <div className={`mt-7 flex flex-wrap items-center gap-3 ${photoUrl ? '' : 'lg:justify-center'}`}>
              {tel && (
                <a href={`tel:${tel}`} className="ohp-gold-sheen inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs font-black uppercase tracking-widest shadow-lg transition hover:-translate-y-0.5" style={{ backgroundColor: gold, color: ink }}>
                  <Phone className="h-4 w-4" /> Call {first}
                </a>
              )}
              {tel && (
                <a href={`sms:${textTel}`} className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg transition hover:-translate-y-0.5" style={{ backgroundColor: ink }}>
                  <MessageSquare className="h-4 w-4" /> Text
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-xs font-black uppercase tracking-widest transition hover:-translate-y-0.5" style={{ borderColor: `${gold}66`, color: 'var(--site-heading)' }}>
                  <Mail className="h-4 w-4" /> Email
                </a>
              )}
              <a href={`${basePrefix}/about`} className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-xs font-black uppercase tracking-widest transition hover:-translate-y-0.5" style={{ borderColor: `${gold}66`, color: 'var(--site-heading)' }}>
                My Agent Hub <ArrowUpRight className="h-4 w-4" />
              </a>
              {socialLinks.length > 0 && (
                <span className="ml-1 flex items-center gap-2">
                  {socialLinks.map(link => {
                    const Icon = SOCIAL_ICON[link.id] || Globe
                    return (
                      <a key={link.id} href={link.url} target="_blank" rel="noreferrer" aria-label={link.label || link.id} title={link.label || link.id} className="grid h-10 w-10 place-items-center rounded-full border bg-white transition hover:-translate-y-0.5" style={{ borderColor: `${gold}44`, color: gold }}>
                        <Icon className="h-4 w-4" />
                      </a>
                    )
                  })}
                </span>
              )}
            </div>
          )}

          {statItems.length > 0 && (
            <dl className="mt-9 grid border-y py-5" style={{ gridTemplateColumns: `repeat(${statItems.length}, minmax(0, 1fr))`, borderColor: `${gold}33` }}>
              {statItems.map((stat, i) => (
                <div key={stat.label} className={`px-3 ${i ? 'border-l' : ''} ${photoUrl ? 'text-left first:pl-0' : 'text-center'}`} style={{ borderColor: `${gold}33` }}>
                  <dd className={`text-3xl font-black leading-none sm:text-4xl ${serif}`} style={{ color: 'var(--site-heading)' }}>{stat.value}</dd>
                  <dt className="mt-2 text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">{stat.label}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  )
}
