import { ArrowUpRight, CalendarDays, Mail, MessageSquare, Phone } from 'lucide-react'
import { SiteTheme } from '../types'
import { fontClass } from './fontClass'

// The page's closing "let's talk" band - dark, gold-lit, with the same faint grid + sweep as the
// rest of the luxe language. Real contact methods only (whatever the block resolved).
export default function ContactCtaBlock({ data, theme, basePrefix = '' }: { data: Record<string, any>; theme: SiteTheme; basePrefix?: string }) {
  const headline = data.headline || "Let's Talk"
  const subtext = data.subtext || ''
  const phone = (data.phone || data.resolved_phone) as string | undefined
  const email = (data.email || data.resolved_email) as string | undefined
  const gold = theme.secondary_color
  const tel = phone ? phone.replace(/[^\d+]/g, '') : ''
  // A number typed into this band is the one to call and text; otherwise the profile's texting number.
  const textTel = String((data.phone ? data.phone : (data.resolved_text_phone || phone)) || '').replace(/[^\d+]/g, '')

  // Classic: one solid band in the agent's accent - the ask on the left, the real ways to reach
  // them on the right. No glow, no grid.
  if (theme.template === 'default') {
    return (
      <section id="contact" className="px-6 py-16 sm:py-20" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] opacity-75">Get in touch</p>
            <h2 className="ohp-site-heading mt-2 text-[2.2rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl">{headline}</h2>
            {subtext && <p className={`mt-3 text-base opacity-80 ${fontClass(theme.body_font)}`}>{subtext}</p>}
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap lg:justify-end">
            <a href={`${basePrefix}/contact`} data-ohp-form="how_can_i_help" data-ohp-form-title="Book a consultation" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111827] px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5"><CalendarDays className="h-4 w-4" /> Book a consultation</a>
            {phone && <a href={`tel:${tel}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-[#111827] shadow-sm transition hover:-translate-y-0.5"><Phone className="h-4 w-4" /> Call {phone}</a>}
            {phone && <a href={`sms:${textTel}`} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-current px-6 py-3 text-sm font-bold transition hover:-translate-y-0.5"><MessageSquare className="h-4 w-4" /> Text me</a>}
            {email && <a href={`mailto:${email}`} title={email} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-current px-6 py-3 text-sm font-bold transition hover:-translate-y-0.5"><Mail className="h-4 w-4" /> Email me</a>}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div
        id="contact"
        className="relative overflow-hidden rounded-[32px] px-6 py-16 text-center text-white shadow-[0_50px_100px_-50px_rgba(0,0,0,.8)] sm:px-12 sm:py-20"
        style={{ backgroundColor: theme.primary_color }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-25" style={{ background: `radial-gradient(closest-side, ${gold} 0%, ${gold} 40%, transparent 100%)` }} />
        <div className="pointer-events-none absolute -bottom-28 -right-16 h-72 w-72 rounded-full opacity-15" style={{ background: `radial-gradient(closest-side, ${gold} 0%, ${gold} 40%, transparent 100%)` }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(60%_70%_at_50%_0%,#000,transparent_75%)]" />
        <p className="relative flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: gold }}>
          <span className="h-px w-8" style={{ backgroundColor: gold }} />Get in touch<span className="h-px w-8" style={{ backgroundColor: gold }} />
        </p>
        <h2 className={`relative mt-4 text-4xl font-black leading-tight sm:text-5xl ${fontClass(theme.heading_font, 'font-serif')}`}>
          {headline}
        </h2>
        {subtext && <p className={`relative mx-auto mt-4 max-w-xl text-white/70 ${fontClass(theme.body_font)}`}>{subtext}</p>}
        <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
          <a href={`${basePrefix}/contact`} data-ohp-form="how_can_i_help" data-ohp-form-title="Book a consultation" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-black uppercase tracking-wide text-[#111827] shadow-xl transition hover:-translate-y-0.5">
            <CalendarDays className="h-4 w-4" /> Book a consultation
          </a>
          {phone && (
            <a href={`tel:${tel}`} className="ohp-gold-sheen inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-black uppercase tracking-wide shadow-xl transition hover:-translate-y-0.5" style={{ backgroundColor: gold, color: theme.primary_color }}>
              <Phone className="h-4 w-4" /> Call {phone}
            </a>
          )}
          {phone && (
            <a href={`sms:${textTel}`} className="inline-flex items-center gap-2 rounded-full border-2 border-white/20 px-7 py-3.5 text-sm font-black uppercase tracking-wide text-white transition hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/5">
              <MessageSquare className="h-4 w-4" /> Text me
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} title={email} className="inline-flex items-center gap-2 rounded-full border-2 border-white/20 px-7 py-3.5 text-sm font-black uppercase tracking-wide text-white transition hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/5">
              <Mail className="h-4 w-4" /> Email me <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
            </a>
          )}
        </div>
        {email && <p className="relative mt-4 text-xs font-semibold text-white/40">{email}</p>}
      </div>
    </section>
  )
}
