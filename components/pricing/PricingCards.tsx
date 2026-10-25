'use client'

import Link from 'next/link'
import type { ComponentType } from 'react'
import { Building2, Search, Calculator, ClipboardList, Globe, Link2, Sparkles, Palette, Newspaper, Layout, Users, CheckCircle2, CalendarClock, Star, Mail, Send, WandSparkles } from 'lucide-react'
import { SpotlightIcon, KitsIcon } from '@/components/icons/CustomIcons'
import { PRICING_PLANS, TRIAL_PERIOD_DAYS } from '@/lib/pricing'

// The single source of truth for how a pricing tier's card looks - shared by the homepage
// pricing grid (app/page.tsx) and the locked-feature upgrade pitch (app/upgrade-required).
// Edit here, not in either page, so the two never drift apart.

export type PricingFeatureGroup = { label: string; icon: ComponentType<{ className?: string; strokeWidth?: number }>; desc?: string; short?: string; items?: string[]; kicker?: string; iconClass?: string; badge?: string; ai?: boolean }

// The "AI" badge in a feature card's top-right corner - only on features with AI built in.
function AiCorner({ dim = false }: { dim?: boolean }) {
  return (
    <span className={`absolute right-2.5 top-2.5 inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#f1d58b] px-1.5 py-[3px] text-[8px] font-black uppercase leading-none tracking-wider text-[#111827] shadow-[0_0_12px_rgba(201,162,77,0.6)] ${dim ? 'opacity-70' : ''}`}>
      <Sparkles className="h-2.5 w-2.5" strokeWidth={2.5} />AI
    </span>
  )
}

// Tiny gold chip beside a feature's name (e.g. Blogs -> "AI Writer") - shows an AI capability
// without adding a single word to the card's description.
function AiBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#f1d58b] px-1.5 py-[3px] text-[8px] font-black uppercase leading-none tracking-wider text-[#111827] shadow-[0_0_10px_rgba(201,162,77,0.55)]">
      <Sparkles className="h-2.5 w-2.5" strokeWidth={2.5} />{label}
    </span>
  )
}

export function FeatureTile({ group, dark = false }: { group: PricingFeatureGroup; dark?: boolean }) {
  return (
    <div className="group relative h-20 [perspective:1000px]">
      <div className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${group.desc ? 'group-hover:[transform:rotateY(180deg)]' : ''}`}>
        {/* Front */}
        <div className={`absolute inset-0 flex flex-col justify-center overflow-hidden rounded-xl border p-3 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.25)] [backface-visibility:hidden] ${dark ? 'border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.03]' : 'border-gray-100 bg-gradient-to-br from-gray-50 to-white dark:border-gray-800 dark:from-white/5 dark:to-white/[0.02]'}`}>
          <div className="absolute -right-3 -top-3 h-10 w-10 rounded-full bg-[#C9A24D]/20 blur-lg animate-glow-pulse" />
          <div className="absolute bottom-0 left-0 h-0.5 w-full bg-gradient-to-r from-[#C9A24D] via-[#f1d58b] to-[#C9A24D]" />
          <div className="relative flex items-center gap-2.5">
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${dark ? 'bg-[#C9A24D]/20' : 'bg-[#C9A24D]/15'}`}>
              <group.icon className={`ohp-icon-draw ${group.iconClass || ''} w-3 h-3 ${dark ? 'text-[#C9A24D]' : 'text-[#8b7355] dark:text-[#C9A24D]'}`} />
            </div>
            <span className={`text-[11px] font-black uppercase tracking-widest ${dark ? 'text-[#C9A24D]' : 'text-[#8b7355] dark:text-[#C9A24D]'}`}>{group.label}</span>
          </div>
          {group.short && (
            <div className="relative mt-1.5 flex items-center gap-1.5 pl-[34px]">
              <span className={`h-1 w-1 shrink-0 rounded-full ${dark ? 'bg-[#C9A24D]/60' : 'bg-[#C9A24D]/50'}`} />
              <p className={`text-[10.5px] font-medium leading-snug ${dark ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>{group.short}</p>
            </div>
          )}
          {group.items && group.items.length > 0 && (
            <div className="relative mt-1 space-y-0.5 pl-[34px]">
              {group.items.map((item, idx) => (
                <p key={idx} className={`text-[10.5px] font-black ${dark ? 'text-[#C9A24D]' : 'text-[#8b7355] dark:text-[#C9A24D]'}`}>{item}</p>
              ))}
            </div>
          )}
        </div>
        {/* Back */}
        {group.desc && (
          <div className={`absolute inset-0 flex items-center rounded-xl p-3 [backface-visibility:hidden] [transform:rotateY(180deg)] ${dark ? 'bg-[#C9A24D]' : 'bg-[#111827]'}`}>
            <p className={`text-[10.5px] font-semibold leading-snug text-pretty ${dark ? 'text-[#111827]' : 'text-gray-100'}`}>{group.desc}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function SpotlightFeatureCard({ group, dark = false, alwaysShow = false }: { group: PricingFeatureGroup; dark?: boolean; alwaysShow?: boolean }) {
  if (alwaysShow) {
    return (
      <div className={`group relative overflow-hidden rounded-xl border p-3.5 transition-all duration-300 hover:-translate-y-0.5 ${dark ? 'border-[#C9A24D]/20 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-[#C9A24D]/[0.06] shadow-[0_10px_24px_-16px_rgba(0,0,0,0.5)] hover:shadow-[0_16px_32px_-14px_rgba(201,162,77,0.35)]' : 'border-[#C9A24D]/35 bg-gradient-to-br from-[#111827] via-[#172033] to-[#4a3820] shadow-[0_14px_32px_-16px_rgba(201,162,77,0.65)] hover:shadow-[0_22px_48px_-14px_rgba(201,162,77,0.85)]'}`}>
        <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full blur-xl ${dark ? 'bg-[#C9A24D]/10' : 'bg-[#C9A24D]/25 animate-glow-pulse'}`} />
        <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${dark ? 'from-[#C9A24D]/40 via-[#f1d58b]/40 to-[#C9A24D]/40' : 'from-[#C9A24D] via-[#f1d58b] to-[#C9A24D]'}`} />
        {group.ai && <AiCorner dim={dark} />}
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C9A24D] text-[#111827] shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
            <group.icon className={`ohp-icon-draw ${group.iconClass || ''} h-4 w-4`} />
          </div>
          <div>
            {group.kicker && <p className="text-[9px] font-black uppercase tracking-widest text-[#C9A24D]">{group.kicker}</p>}
            <h5 className="flex items-center gap-1.5 text-[15px] font-black leading-tight tracking-tight text-white">{group.label}{group.badge && <AiBadge label={group.badge} />}</h5>
          </div>
        </div>
        {group.desc && <p className="relative mt-2.5 text-[11.5px] font-medium leading-snug text-gray-300 text-pretty">{group.desc}</p>}
      </div>
    )
  }
  return (
    <div className="group relative h-[4.75rem] [perspective:1200px]">
      <div className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${group.desc ? 'group-hover:[transform:rotateY(180deg)]' : ''}`}>
        {/* Front */}
        <div className={`absolute inset-0 overflow-hidden rounded-xl border p-3.5 shadow-[0_14px_32px_-16px_rgba(201,162,77,0.65)] transition-shadow duration-300 group-hover:shadow-[0_22px_48px_-14px_rgba(201,162,77,0.85)] [backface-visibility:hidden] ${dark ? 'border-[#C9A24D]/45 bg-gradient-to-br from-white/[0.15] via-white/[0.08] to-[#C9A24D]/15' : 'border-[#C9A24D]/35 bg-gradient-to-br from-[#111827] via-[#172033] to-[#4a3820]'}`}>
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[#C9A24D]/25 blur-xl animate-glow-pulse transition-transform duration-500 group-hover:scale-125" />
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-[#C9A24D] via-[#f1d58b] to-[#C9A24D]" />
          {group.ai && <AiCorner />}
          <div className="relative flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C9A24D] text-[#111827] shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              <group.icon className={`ohp-icon-draw ${group.iconClass || ''} h-4 w-4`} />
            </div>
            <div>
              {group.kicker && <p className="text-[9px] font-black uppercase tracking-widest text-[#C9A24D]">{group.kicker}</p>}
              <h5 className="flex items-center gap-1.5 text-[15px] font-black leading-tight tracking-tight text-white">{group.label}{group.badge && <AiBadge label={group.badge} />}</h5>
            </div>
          </div>
          {group.items && group.items.length > 0 && (
            <div className="relative mt-2 flex flex-wrap gap-1.5 pl-[46px]">
              {group.items.map((item, idx) => (
                <span key={idx} className="rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-gray-200">
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* Back */}
        {group.desc && (
          <div className="absolute inset-0 flex flex-col justify-center gap-1 rounded-xl border border-[#C9A24D]/45 bg-gradient-to-br from-[#C9A24D] to-[#b38e3e] p-3.5 shadow-[0_14px_32px_-16px_rgba(201,162,77,0.65)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="flex items-center gap-1.5">
              <group.icon className="h-3.5 w-3.5 text-[#111827]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#111827]">{group.label}</span>
            </div>
            <p className="text-[12.5px] font-bold leading-snug text-pretty text-[#111827]">{group.desc}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Discovery + Manager pairs two of the app's own nav icons (Search = Discovery, Building2 =
// Manager) in one tile so it visually represents both halves of the feature instead of just
// picking one arbitrarily. Ignores the incoming size class (sized instead for the fixed h-9 w-9
// icon box every SpotlightFeatureCard uses) rather than trying to fit two icons into a class
// meant for one.
// Callers size every card icon with h-4 w-4 - fine for one glyph, but it squeezed these two
// side-by-side glyphs into a single 16px box (~7px each, barely visible). Size classes are dropped
// here so the pair gets its own width; the animation classes (ohp-icon-draw etc.) still pass through.
function DiscoveryManagerIcon(props: { className?: string; strokeWidth?: number }) {
  const passthrough = (props.className || '').split(/\s+/).filter(c => c && !/^(h|w|size)-/.test(c)).join(' ')
  return (
    <span className={`flex shrink-0 items-center justify-center gap-0.5 ${passthrough}`}>
      <Search className="ohp-icon-assemble-search h-[15px] w-[15px] shrink-0" strokeWidth={props.strokeWidth ?? 2.25} />
      <Building2 className="h-[15px] w-[15px] shrink-0" strokeWidth={props.strokeWidth ?? 2.25} />
    </span>
  )
}

export function IncludesDivider({ label, dark = false }: { label: string; dark?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className={`h-px flex-1 bg-gradient-to-r from-transparent ${dark ? 'to-[#C9A24D]/60' : 'to-[#C9A24D]/50'}`} />
      <span className={`shrink-0 text-[10.5px] font-black uppercase tracking-[0.18em] ${dark ? 'text-[#C9A24D]' : 'text-[#8b7355] dark:text-[#C9A24D]'}`}>{label}</span>
      <div className={`h-px flex-1 bg-gradient-to-l from-transparent ${dark ? 'to-[#C9A24D]/60' : 'to-[#C9A24D]/50'}`} />
    </div>
  )
}

const DOT_TEXTURE = { backgroundImage: 'radial-gradient(circle, #C9A24D 1px, transparent 1px)', backgroundSize: '16px 16px' }

type TierCardProps = {
  /** Controls the scroll-triggered fade-in used on the homepage. Defaults to already-visible
   * (no fade) so pages that mount this card directly, like the upgrade-required pitch, don't
   * need to wire up their own IntersectionObserver just to see it. */
  isVisible?: boolean
  ctaHref?: string
  ctaLabel?: string
  /** Swaps the CTA link for a static "Current Plan" indicator - used on the upgrade-required
   * pitch so the agent's own tier renders as the exact same card as everywhere else in the app,
   * instead of a separate hand-rolled summary that inevitably drifts out of sync with it. */
  current?: boolean
  /** When set, the CTA is a <button> firing this instead of a <Link href>. Used by checkout and
   * the resubscribe modal, which drive a local step machine rather than navigating. */
  onCtaClick?: () => void
  /** Disables the CTA button (onCtaClick mode only) - e.g. while a plan switch is in flight. */
  ctaDisabled?: boolean
}

function CurrentPlanBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`mt-auto flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#C9A24D] bg-[#C9A24D]/10 px-6 py-4 font-bold text-[#C9A24D] ${className}`}>
      <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} /> Current Plan
    </div>
  )
}

// One CTA renderer for all five cards: "Current Plan" badge, a local-action button, or a link.
// Every card calls this so the three modes stay identical across the homepage, checkout,
// upgrade-required, settings, and the resubscribe modal.
function CardCTA({ current, onCtaClick, ctaDisabled, href, label, className = '' }: {
  current?: boolean; onCtaClick?: () => void; ctaDisabled?: boolean; href: string; label: string; className?: string
}) {
  if (current) return <CurrentPlanBadge className={className} />
  const cls = `${className} block w-full text-center px-6 py-4 bg-gradient-to-r from-[#C9A24D] to-[#b38e3e] text-[#111827] rounded-xl font-bold hover:shadow-lg hover:shadow-[#C9A24D]/30 transition-all duration-300 hover:-translate-y-1 mt-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0`
  if (onCtaClick) return <button type="button" onClick={onCtaClick} disabled={ctaDisabled} className={cls}>{label}</button>
  return <Link href={href} className={cls}>{label}</Link>
}

export function BasicPricingCard({ isVisible = true, ctaHref, ctaLabel = 'Select Basic', current = false, onCtaClick, ctaDisabled }: TierCardProps) {
  return (
    // dark:bg-none cancels the light gradient's background-image in dark theme - without it, an
    // opaque background-image always paints over a background-color, so the cream/white gradient
    // was rendering on top of dark:bg-[#111827] regardless of theme (this bug predates any recent
    // change; the dark: color was always there, it just never had a chance to show).
    <div className={`bg-gradient-to-br from-white via-[#FAF7F0] to-[#F1E7D2] dark:bg-[#111827] dark:bg-none rounded-[2rem] p-6 sm:p-8 border-2 border-gray-200 dark:border-gray-800 shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_50px_-24px_rgba(0,0,0,0.5)] transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'} relative flex flex-col h-full overflow-hidden transition-all duration-300 hover:border-gray-300 hover:shadow-[0_30px_60px_rgba(0,0,0,0.1)]`}>
      <div className="absolute inset-0 z-0 opacity-[0.04] dark:opacity-[0.05]" style={DOT_TEXTURE} />

      <div className="relative z-10 flex flex-col h-full">
        <div className="text-center mb-8">
          <h4 className="text-xl font-bold text-[#8b7355] dark:text-[#C9A24D] mb-4 uppercase tracking-wide">{PRICING_PLANS.BASIC.name}</h4>
          <div className="flex items-baseline justify-center mb-2">
            <span className="text-5xl font-black text-[#0B0B0B] dark:text-white tracking-tight">{PRICING_PLANS.BASIC.priceString}</span>
            <span className="text-[#6B7280] dark:text-gray-400 ml-2 font-medium">/mo</span>
          </div>
          <p className="text-xs italic text-gray-400">after {TRIAL_PERIOD_DAYS}-day free trial</p>
        </div>

        <div className="flex flex-col gap-3 mb-8 flex-grow">
          <IncludesDivider label={PRICING_PLANS.BASIC.includesLabel} />

          <SpotlightFeatureCard group={{ label: 'Open House Kits & Sign-In', ai: true, icon: KitsIcon, kicker: 'Automated', desc: "QR or kiosk sign-in, a Brag Sheet of your recent sales, a Similar Homes flyer & a Cheat Sheet of the home and nearby - in seconds" }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Forms & Invites', icon: ClipboardList, iconClass: 'ohp-icon-assemble-forms', kicker: 'Capture Leads', desc: 'Forms, funnels & open house invites - one link or QR, replies & RSVPs go to Leads' }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Leads & Follow-Ups', icon: Users, kicker: 'Never Miss One', desc: 'One inbox for every sign-in & form reply, with notes, source & automatic follow-ups' }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'CMA Builder', ai: true, icon: Calculator, kicker: 'Pricing', desc: 'AI deep-dives listing facts & photos, then builds a detailed, pro-grade report' }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Discovery + Manager', icon: DiscoveryManagerIcon, kicker: 'Open House Tools', desc: 'Find opens to host nearby; approve hosts & see guest insights on your listings' }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Calendar & CRM Sync', icon: CalendarClock, iconClass: 'ohp-icon-assemble-calendar', kicker: 'Two-Way Sync', desc: 'Opens, follow-ups & tours sync to your calendar; new leads push to your CRM' }} alwaysShow />

          {/* mt-auto (the wrapper above is now flex-col instead of space-y) pins this pill to the
              bottom of the flex-grow area instead of right after the last feature card - since
              that area is the same height in every bright-tab card (grid stretch + h-full), the
              pill lands at the exact same Y position in Basic/Premium/IDX regardless of how much
              feature content precedes it. */}
          <div className="mt-auto rounded-full border border-[#C9A24D]/30 bg-[#C9A24D]/5 px-4 py-3 shadow-sm">
            <div className="flex items-center justify-center gap-2 text-center">
              <Building2 className="h-4 w-4 flex-shrink-0 text-[#8b7355] dark:text-[#C9A24D]" />
              <span className="text-[11px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#C9A24D]">Bright MLS Integration</span>
            </div>
          </div>
        </div>

        <CardCTA current={current} onCtaClick={onCtaClick} ctaDisabled={ctaDisabled}
          href={ctaHref ?? `/register?plan=${PRICING_PLANS.BASIC.id}`} label={ctaLabel} />
      </div>
    </div>
  )
}

export function PremiumPricingCard({ isVisible = true, ctaHref, ctaLabel = 'Start Premium Trial', current = false, onCtaClick, ctaDisabled }: TierCardProps) {
  // Same always-dark navy-and-gold treatment as IdxPricingCard/NoMlsPricingCard, in both light and
  // dark theme - no separate light-mode look anymore. Keeps its own "Most Popular" badge/border
  // for identity, but the card fill, texture, and text colors are IDX's exact palette so all
  // three read as one consistent family instead of Premium having its own one-off color story.
  return (
    <div className={`relative rounded-[2rem] border-2 border-[#C9A24D] shadow-[0_20px_55px_-18px_rgba(201,162,77,0.35)] transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'} flex flex-col h-full transition-all duration-300 hover:shadow-[0_28px_70px_-16px_rgba(201,162,77,0.5)]`}>
      <span className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[#C9A24D] px-4 py-1 text-[10px] font-black uppercase tracking-widest text-[#111827] shadow-md">
        <span className="relative mr-1.5 inline-flex h-1.5 w-1.5 -translate-y-px">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#111827] opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#111827]" />
        </span>
        Most Popular
      </span>
      <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(2rem-2px)] bg-gradient-to-br from-[#0B0B0B] via-[#1a2438] to-[#4a3820] p-6 sm:p-8">
        <div className="absolute inset-0 z-0 opacity-[0.07]" style={DOT_TEXTURE} />
        <div className="relative text-center mb-8">
          <h4 className="text-xl font-bold text-white mb-4 uppercase tracking-wide">{PRICING_PLANS.PREMIUM.name}</h4>
          <div className="flex items-baseline justify-center mb-2">
            <span className="text-5xl font-black text-white tracking-tight">{PRICING_PLANS.PREMIUM.priceString}</span>
            <span className="text-gray-400 ml-2 font-medium">/mo</span>
          </div>
          <p className="text-xs italic text-gray-400">after {TRIAL_PERIOD_DAYS}-day free trial</p>
        </div>

        <div className="relative flex flex-col gap-4 mb-8 flex-grow">
          <IncludesDivider label={PRICING_PLANS.PREMIUM.includesLabel} dark />

          <SpotlightFeatureCard group={{ label: 'Agent Hub', icon: Link2, kicker: 'One Page', desc: "Your branded one-page hub for socials, sales, listings, videos & blogs - with a one-tap Save Contact card so clients keep your number. It updates itself as your Bright MLS listings & sales change" }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Showcases', ai: true, icon: Layout, kicker: 'Client Engagement', desc: 'Guests without an agent automatically get a personal home search to like, comment & request tours - with new-match & price-drop alerts' }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Studio', icon: Palette, kicker: 'Design', desc: 'Just Listed, Just Sold & Open House flyers, mailers & social posts in designer styles, auto-filled from property data' }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Blogs', ai: true, icon: Newspaper, iconClass: 'ohp-icon-assemble-blog', kicker: 'Local SEO', desc: 'Publish local market updates & neighborhood content to build your authority & SEO in minutes' }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Review Hub', icon: Star, kicker: 'Reputation', desc: 'Send one review link - happy clients go straight to Google & Zillow, while unhappy feedback comes privately to you first' }} alwaysShow />

          {/* mt-auto - see BasicPricingCard's matching pill for why. */}
          <div className="relative mt-auto rounded-full border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-4 py-3 shadow-sm">
            <div className="flex items-center justify-center gap-2 text-center">
              <Sparkles className="h-4 w-4 flex-shrink-0 text-[#C9A24D]" />
              <span className="whitespace-nowrap text-[11px] font-black uppercase tracking-widest text-[#C9A24D]">2X Basic's AI Credits</span>
            </div>
          </div>
        </div>

        <CardCTA current={current} onCtaClick={onCtaClick} ctaDisabled={ctaDisabled} className="relative"
          href={ctaHref ?? `/register?plan=${PRICING_PLANS.PREMIUM.id}`} label={ctaLabel} />
      </div>
    </div>
  )
}

export function IdxPricingCard({ isVisible = true, ctaHref, ctaLabel = 'Select IDX', current = false, onCtaClick, ctaDisabled }: TierCardProps) {
  // The top tier gets one deliberate, always-dark navy-and-gold treatment in both light and
  // dark mode - the same family of colors as its own "Full Website" badge and flagship callout
  // below, rather than the lighter cream card the other tiers use - so it reads as the clear
  // luxury pick regardless of site theme. The badge lives on the outer (non-clipping) layer, same
  // as PremiumPricingCard's "Most Popular" pill, so it can poke above the card edge without being
  // clipped by the inner layer's overflow-hidden (which clips the shimmer/texture instead).
  return (
    <div className={`relative rounded-[2rem] border-2 border-[#C9A24D] shadow-[0_25px_70px_-15px_rgba(201,162,77,0.55)] transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'} transition-all flex flex-col h-full`}>
      <span className="absolute -top-3.5 left-1/2 z-20 -translate-x-1/2">
        <span className="absolute -inset-1.5 rounded-full bg-[#C9A24D]/50 blur-md animate-glow-pulse" />
        <span className="relative flex items-center gap-1.5 rounded-full border border-[#C9A24D]/60 bg-gradient-to-r from-[#0B0B0B] via-[#172033] to-[#0B0B0B] px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#f1d58b] shadow-[0_10px_24px_-8px_rgba(0,0,0,0.55)]">
          <Sparkles className="h-3 w-3 text-[#C9A24D]" />
          Full Website
        </span>
      </span>
      <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(2rem-2px)] bg-gradient-to-br from-[#0B0B0B] via-[#1a2438] to-[#4a3820] p-6 sm:p-8">
        <div className="absolute inset-0 z-0 opacity-[0.07]" style={DOT_TEXTURE} />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-card-shimmer" />
        <div className="relative text-center mb-8">
          <h4 className="text-xl font-bold text-white mb-4 uppercase tracking-wide">{PRICING_PLANS.IDX.name}</h4>
          <div className="flex items-baseline justify-center mb-2">
            <span className="text-5xl font-black text-white tracking-tight">{PRICING_PLANS.IDX.priceString}</span>
            <span className="text-gray-400 ml-2 font-medium">/mo</span>
          </div>
          <p className="text-xs italic text-gray-400">+ Setup Fee &middot; Domain Not Included</p>
        </div>

        <div className="relative flex flex-col gap-4 mb-8 flex-grow">
          <IncludesDivider label={PRICING_PLANS.IDX.includesLabel} dark />

          {/* Flagship callout - the headline reason to pay for IDX - leads the list, with AI
              Property Media right beneath it as the second-billed highlight. */}
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B0B0B] via-[#172033] to-[#4a3820] p-5 border border-[#C9A24D]/60 shadow-[0_18px_50px_-12px_rgba(201,162,77,0.55)] transition-shadow duration-300 hover:shadow-[0_18px_60px_-8px_rgba(201,162,77,0.75)]">
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-[#C9A24D]/35 rounded-full blur-2xl" />
            <div className="pointer-events-none absolute inset-y-0 w-1/5 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-shimmer-mini" />
            <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-[#C9A24D] via-[#f1d58b] to-[#C9A24D]" />
            <div className="relative mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#C9A24D] flex items-center justify-center flex-shrink-0 shadow-md transition-transform duration-300 group-hover:scale-110">
                  <Globe className="ohp-icon-draw w-5 h-5 text-[#111827]" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#C9A24D]">Auto-Built</p>
                  <h5 className="text-white font-black text-lg tracking-tight leading-tight">IDX Website</h5>
                </div>
              </div>
            </div>
            <AiCorner />
            <div className="relative mt-4 space-y-2.5 border-t border-white/10 pt-4">
              {[
                { title: 'Complete IDX Website', body: 'Full property search & automatic listing sync - built around your sales, listings, neighborhoods, blogs and videos + much more' },
                { title: 'Custom Domain Support', body: 'Connect your own domain and bring your IDX website, Agent Hub, Showcases, Spotlights, Forms, Kits, Review Hub, blogs & more under it' },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-2">
                  <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#C9A24D]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs leading-relaxed text-gray-300">
                    <span className="font-black text-white">{item.title}</span>
                    <span className="block font-medium">{item.body}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <SpotlightFeatureCard group={{ label: 'Media Lab', ai: true, icon: Sparkles, iconClass: 'ohp-icon-sparkle-all', kicker: 'Photo & Video', desc: 'Twilight, staging & photo-to-video, plus an easy animated social-post editor' }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Listing Spotlight', ai: true, icon: SpotlightIcon, kicker: 'Listing', desc: 'A cinematic standalone site for each of your listings - set up for you by AI in minutes' }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Signature', icon: Mail, iconClass: 'ohp-icon-assemble-mail', kicker: 'Brand', desc: 'Your personal branding, in every email, on your site, and everywhere else you show up - listings & sales update automatically' }} alwaysShow />

          {/* mt-auto - see BasicPricingCard's matching pill for why. */}
          <div className="relative mt-auto rounded-full border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-4 py-3 shadow-sm">
            <div className="flex items-center justify-center gap-2 text-center">
              <Sparkles className="h-4 w-4 flex-shrink-0 text-[#C9A24D]" />
              <span className="whitespace-nowrap text-[11px] font-black uppercase tracking-widest text-[#C9A24D]">4X Basic's AI Credits</span>
            </div>
          </div>
        </div>

        <CardCTA current={current} onCtaClick={onCtaClick} ctaDisabled={ctaDisabled} className="relative"
          href={ctaHref ?? `/register?plan=${PRICING_PLANS.IDX.id}`} label={ctaLabel} />
      </div>
    </div>
  )
}

export function NoMlsPricingCard({ isVisible = true, ctaHref, ctaLabel = 'Select No-MLS Basic', current = false, onCtaClick, ctaDisabled }: TierCardProps) {
  // Plain "Basic" treatment - the same light cream card, no badge, no shimmer, no glow-pulse -
  // so ProNoMlsPricingCard (which keeps the always-dark flagship look) reads as the clear
  // step-up, the same way BasicPricingCard/PremiumPricingCard split on the Bright-MLS tab.
  return (
    <div className={`bg-gradient-to-br from-white via-[#FAF7F0] to-[#F1E7D2] dark:bg-[#111827] dark:bg-none rounded-[2rem] p-6 sm:p-8 border-2 border-gray-200 dark:border-gray-800 shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_50px_-24px_rgba(0,0,0,0.5)] transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'} relative flex flex-col h-full overflow-hidden transition-all duration-300 hover:border-gray-300 hover:shadow-[0_30px_60px_rgba(0,0,0,0.1)]`}>
      <div className="absolute inset-0 z-0 opacity-[0.04] dark:opacity-[0.05]" style={DOT_TEXTURE} />

      <div className="relative z-10 flex flex-col h-full">
        <div className="text-center mb-8">
          <h4 className="text-xl font-bold text-[#8b7355] dark:text-[#C9A24D] mb-4 uppercase tracking-wide">{PRICING_PLANS.NO_MLS.name}</h4>
          <div className="flex items-baseline justify-center mb-2">
            <span className="text-5xl font-black text-[#0B0B0B] dark:text-white tracking-tight">{PRICING_PLANS.NO_MLS.priceString}</span>
            <span className="text-[#6B7280] dark:text-gray-400 ml-2 font-medium">/mo</span>
          </div>
          <p className="text-xs italic text-gray-400">after {TRIAL_PERIOD_DAYS}-day free trial</p>
        </div>

        <div className="flex flex-col gap-3 mb-8 flex-grow">
          <IncludesDivider label={PRICING_PLANS.NO_MLS.includesLabel} />

          {/* No Similar Homes or Cheat Sheet here - both are built from Bright MLS data these plans
              don't have. The Brag Sheet IS included (owner, 10/24): it prints the sales the agent
              adds by hand. */}
          <SpotlightFeatureCard group={{ label: 'Open House Sign-In', icon: KitsIcon, kicker: 'Manual Entry', desc: "A branded QR sign-in sheet or tablet kiosk - every sign-in lands in your Leads - plus a Brag Sheet of the sales you add. You type in the home's details" }} alwaysShow />
          {/* "Forms & Invites" (owner, 10/24): open house e-invites + RSVPs live on the Forms page and
              come with this plan - so No-MLS Premium ("All of No-MLS Basic, plus") has them too. */}
          <SpotlightFeatureCard group={{ label: 'Forms & Invites', icon: ClipboardList, iconClass: 'ohp-icon-assemble-forms', kicker: 'Capture Leads', desc: 'Branded forms for onboarding, ads, funnels & mailers, plus open house invites with RSVPs. Share one link - every reply flows straight into your Leads' }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Leads & Follow-Ups', icon: Users, kicker: 'Track & Convert', desc: 'Every sign-in and inquiry captured in one inbox with notes - plus an automatic next-day follow-up task on your calendar' }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Calendar & CRM Sync', icon: CalendarClock, iconClass: 'ohp-icon-assemble-calendar', kicker: 'Two-Way Sync', desc: 'Opens, follow-up reminders & confirmed tours flow to your Google Calendar; new leads push straight to your CRM' }} alwaysShow />
          {/* Owner 10/24 ("Add both"): two everyday tools this plan already includes, so the card
              reads about as long as No-MLS Premium's. Brand Kit + send-from-your-email are on every plan.
              Wording kept to what's true today: guest emails don't carry the brand color, and Outlook
              send-as is still "Coming soon" on the Email page - add "or Outlook" back once it ships. */}
          <SpotlightFeatureCard group={{ label: 'Your Brand, Everywhere', icon: WandSparkles, kicker: 'Brand Kit', desc: 'Your logo, colors & headshot on every sign-in sheet, form & invite - set once' }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Send From Your Email', icon: Send, kicker: 'Email & Tracking', desc: 'Invite & tour emails go out from your own Gmail - and you see who opened & clicked' }} alwaysShow />

          {/* mt-auto - see BasicPricingCard's matching pill for why (this card just switched to
              the same flex-col wrapper to support it). No-MLS's own mirror of Basic's "Bright MLS
              Integration" pill: the thing that's true and distinct about THIS tier, not a
              contradiction of Bright integration and not the AI-credits line that lives on the
              No-MLS Premium card instead. */}
          <div className="mt-auto rounded-full border border-[#C9A24D]/30 bg-[#C9A24D]/5 px-4 py-3 shadow-sm">
            <div className="flex items-center justify-center gap-2 text-center">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[#8b7355] dark:text-[#C9A24D]" />
              <span className="text-[11px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#C9A24D]">No Bright MLS Required</span>
            </div>
          </div>
        </div>

        <CardCTA current={current} onCtaClick={onCtaClick} ctaDisabled={ctaDisabled}
          href={ctaHref ?? `/register?plan=${PRICING_PLANS.NO_MLS.id}`} label={ctaLabel} />
      </div>
    </div>
  )
}

export function ProNoMlsPricingCard({ isVisible = true, ctaHref, ctaLabel = 'Select No-MLS Premium', current = false, onCtaClick, ctaDisabled }: TierCardProps) {
  // The upgrade option for a non-Bright agent - No-MLS Basic plus Agent Hub, Studio's design & AI
  // media tools, and Review Hub. Agent Hub lives here now, not on No-MLS Basic (see
  // AGENT_HUB_ACCESS_TIERS in lib/navAccess.ts and backend app/utils/auth.py - keep in sync).
  // Reuses the No-MLS card's always-dark flagship treatment.
  return (
    <div className={`relative rounded-[2rem] border-2 border-[#C9A24D] shadow-[0_25px_70px_-15px_rgba(201,162,77,0.55)] transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'} transition-all flex flex-col`}>
      <span className="absolute -top-3.5 left-1/2 z-20 -translate-x-1/2">
        <span className="absolute -inset-1.5 rounded-full bg-[#C9A24D]/50 blur-md animate-glow-pulse" />
        <span className="relative flex items-center gap-1.5 rounded-full border border-[#C9A24D]/60 bg-gradient-to-r from-[#0B0B0B] via-[#172033] to-[#0B0B0B] px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#f1d58b] shadow-[0_10px_24px_-8px_rgba(0,0,0,0.55)]">
          <Sparkles className="h-3 w-3 text-[#C9A24D]" />
          Most Popular
        </span>
      </span>
      <div className="relative flex flex-col overflow-hidden rounded-[calc(2rem-2px)] bg-gradient-to-br from-[#0B0B0B] via-[#1a2438] to-[#4a3820] p-6 sm:p-8">
        <div className="absolute inset-0 z-0 opacity-[0.07]" style={DOT_TEXTURE} />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-card-shimmer" />
        {/* No tagline paragraph here (unlike this card's earlier version) - PremiumPricingCard's
            header is just name + price with nothing between, so this card now matches that exact
            layout instead of sitting shorter/misaligned next to it. */}
        <div className="relative text-center mb-8">
          <h4 className="text-xl font-bold text-white mb-4 uppercase tracking-wide">{PRICING_PLANS.PRO_NO_MLS.name}</h4>
          <div className="flex items-baseline justify-center mb-2">
            <span className="text-5xl font-black text-white tracking-tight">{PRICING_PLANS.PRO_NO_MLS.priceString}</span>
            <span className="text-gray-400 ml-2 font-medium">/mo</span>
          </div>
          <p className="text-xs italic text-gray-400">after {TRIAL_PERIOD_DAYS}-day free trial</p>
        </div>

        <div className="relative space-y-3 mb-8 flex-grow">
          <IncludesDivider label={PRICING_PLANS.PRO_NO_MLS.includesLabel} dark />
          <SpotlightFeatureCard group={{ label: 'Agent Hub', icon: Link2, kicker: 'One Page', desc: "Your branded one-page hub for socials, sales, listings, videos, blogs & more — add your sales by hand (there's no Bright MLS data to pull from) and they print on your open house Brag Sheet too" }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Media Lab', ai: true, icon: Sparkles, iconClass: 'ohp-icon-sparkle-all', kicker: 'Photo & Video', desc: 'Twilight, staging & photo-to-video from your photos, plus an animated post editor' }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Studio', icon: Palette, kicker: 'Design', desc: 'Create polished flyers, mailers & social posts — auto-filled from the property details you enter, ready to use' }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Blogs', ai: true, icon: Newspaper, iconClass: 'ohp-icon-assemble-blog', kicker: 'Local SEO', desc: 'Publish market updates & local content to strengthen your authority & SEO in minutes' }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Review Hub', icon: Star, kicker: 'Reputation', desc: 'Happy clients go straight to Google & Zillow' }} alwaysShow />
          <SpotlightFeatureCard group={{ label: 'Signature', icon: Mail, iconClass: 'ohp-icon-assemble-mail', kicker: 'Brand', desc: "Your personal branding, in every email, on your site, and everywhere else you show up - shows the listings & sales you manually add, since there's no Bright MLS data to pull from" }} alwaysShow />
        </div>

        <CardCTA current={current} onCtaClick={onCtaClick} ctaDisabled={ctaDisabled} className="relative"
          href={ctaHref ?? `/register?plan=${PRICING_PLANS.PRO_NO_MLS.id}`} label={ctaLabel} />
      </div>
    </div>
  )
}

export function PricingTierCard({ tier, ...props }: TierCardProps & { tier: 'BASIC' | 'PREMIUM' | 'IDX' | 'NO_MLS' | 'PRO_NO_MLS' }) {
  switch (tier) {
    case 'BASIC': return <BasicPricingCard {...props} />
    case 'PREMIUM': return <PremiumPricingCard {...props} />
    case 'IDX': return <IdxPricingCard {...props} />
    case 'NO_MLS': return <NoMlsPricingCard {...props} />
    case 'PRO_NO_MLS': return <ProNoMlsPricingCard {...props} />
  }
}
