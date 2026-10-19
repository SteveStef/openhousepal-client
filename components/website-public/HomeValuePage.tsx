import { BadgeCheck, ClipboardList, FileText, MessageCircle, Phone, Search, Star } from 'lucide-react'
import HomeValueAddress from './HomeValueAddress'
import { fontClass } from './blocks/fontClass'
import { resolveMediaUrl } from '@/lib/api-service'
import SitePhoto from '@/components/website-public/SitePhoto'
import { IMG, sizedBg, sizedImage } from '@/lib/siteImage'

// The IDX site's "What's my home worth?" landing page (/home-value) - the page an agent sends
// homeowners to from ads, mailers and their email signature. An address box that opens the
// agent's own Home Value form (address filled in), how it works, what homes sell for in each
// town the agent serves (live MLS numbers), real reviews, and the agent. Classic and Luxe,
// light and dark, all through the site's CSS vars.

const usd = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M` : `$${Math.round(n / 1000)}K`)

export default function HomeValuePage({ theme, basePrefix, profile, areas, reviews }: {
  theme: any
  basePrefix: string
  profile: any
  areas: any[]
  reviews: any
}) {
  const luxe = theme.template !== 'default'
  const serif = luxe ? fontClass(theme.heading_font, 'font-serif') : ''
  const name = profile?.name || 'me'
  const first = String(profile?.name || '').split(' ')[0] || 'me'
  const photo = areas.find(a => a.photo)?.photo
  const towns = areas.filter(a => a.median_price || a.active_count).slice(0, 8)
  const quotes = (reviews?.show ? (reviews.reviews || []) : []).filter((r: any) => r.rating >= 5 && r.body && String(r.body).length > 60).slice(0, 3)
  const card = { backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-line)', boxShadow: 'var(--site-shadow)' }
  const round = luxe ? 'rounded-[24px]' : 'rounded-2xl'

  const steps = [
    { icon: ClipboardList, title: 'Tell me about your home', text: 'Your address and a few details - updates, size, anything special. Two minutes.' },
    { icon: Search, title: 'I pull the real sales', text: `The homes that actually sold near you, adjusted for your home - not a website's guess.` },
    { icon: FileText, title: 'You get your value', text: 'A clear price range and what it means for your plans - no cost, no obligation.' },
  ]

  return (
    <main>
      {/* Hero */}
      <section className={`relative overflow-hidden px-5 sm:px-6 ${luxe ? 'flex min-h-[78vh] items-end pb-14 pt-32 text-white' : 'pb-14 pt-10 sm:pb-20 sm:pt-16'}`}
        style={luxe ? { backgroundColor: theme.primary_color } : { background: 'linear-gradient(180deg, var(--site-bg-alt), var(--site-bg))' }}>
        {luxe && photo && (
          <>
            <div className="ohp-hero-pan absolute inset-0 bg-cover bg-center" style={{ backgroundImage: sizedBg(resolveMediaUrl(photo), 1920) }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/30" />
          </>
        )}
        <div className={`relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 ${luxe ? '' : 'lg:grid-cols-[1.15fr_1fr]'}`}>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.26em]" style={{ color: luxe ? theme.secondary_color : 'var(--site-accent)' }}>
              {luxe && <span className="h-px w-8" style={{ backgroundColor: theme.secondary_color }} />}Free home value
            </p>
            <h1 className={`ohp-site-heading mt-4 max-w-3xl text-[2.6rem] font-black leading-[1.02] tracking-tight sm:text-7xl ${serif}`} style={luxe ? undefined : { color: 'var(--site-heading)' }}>
              What&apos;s your home <span className={luxe ? 'ohp-text-shimmer' : ''} style={luxe ? undefined : { color: 'var(--site-accent)' }}>really</span> worth?
            </h1>
            <p className={`mt-5 max-w-xl text-[17px] leading-relaxed ${luxe ? 'text-white/80' : ''}`} style={luxe ? undefined : { color: 'var(--site-ink-soft)' }}>
              Online estimates can miss by tens of thousands. Get a real number from {name} - built from the homes that actually sold near you.
            </p>
            <div className="mt-7"><HomeValueAddress basePrefix={basePrefix} luxe={luxe} /></div>
            <ul className={`mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-bold ${luxe ? 'text-white/80' : ''}`} style={luxe ? undefined : { color: 'var(--site-ink-soft)' }}>
              {['Free', 'No obligation', 'Real local sales', 'Back to you fast'].map(t => (
                <li key={t} className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4" style={{ color: luxe ? theme.secondary_color : 'var(--site-accent)' }} />{t}</li>
              ))}
            </ul>
          </div>
          {!luxe && photo && (
            <div className="relative hidden lg:block">
              <div className="aspect-[4/3.2] overflow-hidden rounded-3xl" style={{ boxShadow: 'var(--site-shadow-lift)' }}>
                <SitePhoto src={resolveMediaUrl(photo)} widths={IMG.half} className="ohp-hero-pan h-full w-full object-cover" />
              </div>
              {reviews?.show && reviews.summary?.count > 0 && (
                <div className="absolute -bottom-5 -left-5 flex items-center gap-3 rounded-2xl border px-4 py-3" style={card}>
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  <div>
                    <p className="text-sm font-black" style={{ color: 'var(--site-heading)' }}>{Number(reviews.summary.average || 0).toFixed(1)} from {reviews.summary.count} clients</p>
                    <p className="text-[11px] font-semibold" style={{ color: 'var(--site-muted)' }}>Real reviews</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {luxe && <div id="site-hero-sentinel" className="pointer-events-none absolute inset-x-0 bottom-0 h-px" />}
      </section>

      {/* How it works */}
      <section className="px-5 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: 'var(--site-accent)' }}>How it works</p>
          <h2 className={`ohp-site-heading mt-2 text-3xl font-black sm:text-4xl ${serif}`} style={{ color: 'var(--site-heading)' }}>A real number, not a guess</h2>
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className={`relative border p-6 ${round}`} style={card}>
                <span className="absolute right-5 top-4 text-5xl font-black opacity-[0.08]" style={{ color: 'var(--site-heading)' }}>{i + 1}</span>
                <span className={`flex h-12 w-12 items-center justify-center ${luxe ? 'rounded-full' : 'rounded-xl'}`} style={{ backgroundColor: 'rgba(var(--site-accent-rgb),0.12)', color: 'var(--site-accent)' }}><s.icon className="h-5 w-5" /></span>
                <p className="mt-4 text-lg font-black" style={{ color: 'var(--site-heading)' }}>{s.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--site-ink-soft)' }}>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What homes sell for, town by town */}
      {towns.length > 0 && (
        <section className="px-5 py-14 sm:px-6 sm:py-20" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
          <div className="mx-auto max-w-6xl">
            <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: 'var(--site-accent)' }}>Your market right now</p>
            <h2 className={`ohp-site-heading mt-2 text-3xl font-black sm:text-4xl ${serif}`} style={{ color: 'var(--site-heading)' }}>What homes are listing for near you</h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--site-muted)' }}>Live from the MLS. Tap a town for its sold prices and trends.</p>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {towns.map(a => (
                <a key={a.slug} href={`${basePrefix}/${a.slug}#market`} className={`group relative overflow-hidden border transition hover:-translate-y-1 ${round}`} style={card}>
                  <div className="relative h-24 overflow-hidden sm:h-28" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
                    {a.photo && <SitePhoto src={resolveMediaUrl(a.photo)} widths={IMG.card} className="h-full w-full transition duration-700 group-hover:scale-105 object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <p className="absolute bottom-2 left-3 text-[15px] font-black text-white">{a.name}</p>
                  </div>
                  <div className="px-3 py-3">
                    {a.median_price ? <p className="text-lg font-black leading-none" style={{ color: 'var(--site-heading)' }}>{usd(a.median_price)}</p> : null}
                    <p className="mt-1 text-[11px] font-semibold" style={{ color: 'var(--site-muted)' }}>{a.median_price ? 'median list price' : ''}{a.active_count ? `${a.median_price ? ' · ' : ''}${a.active_count} for sale` : ''}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Reviews */}
      {quotes.length > 0 && (
        <section className="px-5 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: 'var(--site-accent)' }}>From clients</p>
            <h2 className={`ohp-site-heading mt-2 text-3xl font-black sm:text-4xl ${serif}`} style={{ color: 'var(--site-heading)' }}>Why owners call {first}</h2>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              {quotes.map((r: any) => (
                <figure key={r.id} className={`flex flex-col border p-6 ${round}`} style={card}>
                  <span className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}</span>
                  <blockquote className="mt-3 line-clamp-6 flex-1 text-[15px] leading-relaxed" style={{ color: 'var(--site-ink-soft)' }}>&ldquo;{r.body}&rdquo;</blockquote>
                  <figcaption className="mt-4 text-sm font-black" style={{ color: 'var(--site-heading)' }}>{r.author}</figcaption>
                </figure>
              ))}
            </div>
            <a href={`${basePrefix}/testimonials`} className="mt-6 inline-flex text-sm font-black" style={{ color: 'var(--site-accent)' }}>Read all {reviews.summary?.count || ''} reviews →</a>
          </div>
        </section>
      )}

      {/* The agent + the ask, once more */}
      <section className="px-5 pb-16 sm:px-6 sm:pb-20">
        <div className={`relative mx-auto max-w-6xl overflow-hidden p-7 sm:p-12 ${luxe ? 'rounded-[28px]' : 'rounded-3xl'}`} style={{ backgroundColor: luxe ? theme.primary_color : 'var(--site-accent-deep)' }}>
          <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-[auto_1fr_auto]">
            {profile?.photo_url && <img src={sizedImage(resolveMediaUrl(profile.photo_url), 256)} loading="lazy" decoding="async" alt={profile.name} className="h-24 w-24 rounded-full object-cover ring-4 ring-white/20" />}
            <div>
              <h2 className={`ohp-site-heading text-2xl font-black text-white sm:text-3xl ${serif}`}>Thinking about selling - now or someday?</h2>
              <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-white/75">I&apos;ll tell you what your home would sell for today and what would raise it - whether you&apos;re moving this spring or just curious.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href={`${basePrefix}/contact`} data-ohp-form="home_value" data-ohp-form-title="What's my home worth?"
                className={`inline-flex items-center gap-2 px-6 py-3 text-sm font-black ${luxe ? 'ohp-gold-sheen rounded-full' : 'rounded-xl'}`} style={luxe ? { backgroundColor: theme.secondary_color, color: theme.primary_color } : { backgroundColor: '#ffffff', color: 'var(--site-accent-deep)' }}>
                <MessageCircle className="h-4 w-4" /> Get my home value
              </a>
              {profile?.phone && <a href={`tel:${profile.phone}`} className={`inline-flex items-center gap-2 border border-white/40 px-6 py-3 text-sm font-black text-white ${luxe ? 'rounded-full' : 'rounded-xl'}`}><Phone className="h-4 w-4" /> {profile.phone}</a>}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
