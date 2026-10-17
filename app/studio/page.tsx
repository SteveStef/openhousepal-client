'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  AlertCircle, ArrowRight, BellRing, Calculator, CalendarClock, Check, Clapperboard, ClipboardList, FileEdit, Link2, Layers, Lock, Mail, Minus, Moon, Newspaper,
  FileClock, Palette, Play, Plug, Plus, Send, Sparkles, Star, ToolCase, Wand2,
} from 'lucide-react'
import api from '@/lib/api-service'
import { SpotlightIcon } from '@/components/icons/CustomIcons'
import { resolveMediaUrl } from '@/lib/api-service'
import LuxeHero from '@/components/ui/LuxeHero'
import { CardAlive, GoldLastWord, TOOL_CARD_CSS, trackGlow } from '@/components/ui/LuxeSurface'
import TypingAnimation from '@/components/TypingAnimation'
import { useFormsActionCount } from '@/hooks/useFormsActionCount'
import { useAuth } from '@/contexts/AuthContext'
import { getNavFeatureAccess } from '@/lib/navAccess'
import { useToolConnectionStatus, type ToolTone } from '@/lib/toolsStatus'
import { PLACEHOLDER_PROPERTY } from '@/lib/studio/designFormats'

export default function StudioHomePage() {
  const formsActionCount = useFormsActionCount()
  const { user } = useAuth()
  // Same access rules as the nav bar (getNavFeatureAccess) - visible-but-locked reads as "here's
  // what you're missing and how to get it," which is a better upsell than these two tools simply
  // not existing on the page at all. Only the No-MLS track (not a Bright-ladder upgrade target
  // for either) still hides them outright, matching the nav.
  const mediaAccess = getNavFeatureAccess(user?.plan_tier, 'ai_media')
  const spotlightAccess = getNavFeatureAccess(user?.plan_tier, 'listing_spotlight')
  const emailSignatureAccess = getNavFeatureAccess(user?.plan_tier, 'email_signature')
  // Same live connection status Settings' Tools accordion shows (lib/toolsStatus.ts) - explicit
  // ask: these cards' old feature-name tags ("Google", "Two-Way Sync", "Auto-Updates") never said
  // whether the agent had actually set anything up.
  const toolStatus = useToolConnectionStatus(user?.plan_tier)

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:py-6">
        <LuxeHero
          compact
          kicker="Tools"
          icon={ToolCase}
          title={<>Market every listing, <em>grow your name.</em></>}
          subtitle="Connected to your properties, your brand and your Agent Hub - all in one place."
          aside={<div className="flex w-full lg:justify-end"><BrandKitButton /></div>}
          asideClassName="lg:w-auto"
          className="mb-5"
        />
        <style>{TOOL_CARD_CSS}</style>

        {/* Agent Hub, Forms, CMA and Blogs - the four everyday tools - lead in the wider 4-per-row
            spot up top. AI Media, Listing Spotlight and Design Studio (the heavier, example-driven
            ones) sit in the narrower 3-per-row grid underneath. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.05 }}>
            <ProductCard
              href="/studio/site"
              icon={Link2}
              eyebrow="One Page"
              title="Agent Hub"
              description="Your personal real estate page — profile, sales, videos, blogs & socials."
              actions={[
                { label: 'Edit', href: '/studio/site', icon: Layers },
              ]}
              accent="from-[#C9A24D]/15 to-transparent"
              preview={(active) => <SitePreview active={active} name={[user?.first_name, user?.last_name].filter(Boolean).join(' ')} title={user?.professional_title} photoUrl={user?.photo_url} />}
              previewShort
              eyebrowMarginClass="mr-28"
              lockedLabel="Agent Hub"
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.1 }}>
            <ProductCard
              href="/studio/forms"
              icon={ClipboardList}
              iconClass="ohp-icon-assemble-forms"
              eyebrow="Forms"
              title="Capture Leads"
              description="Buying, selling & home-value forms — shared as links or embedded."
              actions={[
                { label: 'Results', href: '/studio/forms?tab=results', icon: FileEdit },
              ]}
              accent="from-[#816937]/15 to-transparent"
              preview={(active) => <FormPreview active={active} />}
              badge={formsActionCount}
              previewShort
              eyebrowMarginClass="mr-28"
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.15 }}>
            <ProductCard
              href="/studio/cma"
              icon={Calculator}
              eyebrow="Pricing"
              title="CMA Builder"
              description="Turn comparable sales into a client-ready pricing report, with your final call on value."
              actions={[
                { label: 'Build', href: '/studio/cma?new=1', icon: Plus },
              ]}
              accent="from-[#816937]/15 to-transparent"
              preview={(active) => <CmaPreview active={active} />}
              previewShort
              lockedLabel="CMA"
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.2 }}>
            <ProductCard
              href="/studio/blogs"
              icon={Newspaper}
              iconClass="ohp-icon-assemble-blog"
              eyebrow="Blogs"
              title="Publish Articles"
              description="Write blogs to own your market — auto-synced to your Agent Hub & IDX site."
              actions={[
                { label: 'Create', href: '/studio/blogs?new=1', icon: Plus },
              ]}
              accent="from-[#816937]/15 to-transparent"
              preview={(active) => <BlogPreview active={active} />}
              previewShort
            />
          </motion.div>
        </div>

        {/* 3 -> 4 columns (explicit ask: "move the email signature tool on same row as second
            row so there are 4 there") - Design Studio/AI Media/Listing Spotlight/Email Signature
            already all lived in this one grid together; at 3 columns the 4th (whichever is
            visible last) wrapped onto its own mostly-empty row instead of sitting flush with the
            other three. */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.25 }}>
            <ProductCard
              href="/studio/design"
              icon={Palette}
              eyebrow="Design"
              title="The Studio"
              description="Flyers, social posts, brochures & campaigns from your listing data."
              actions={[
                { label: 'Create', href: '/studio/design?new=1', icon: Plus },
              ]}
              accent="from-[#C9A24D]/15 to-transparent"
              preview={(active) => <DesignPreview active={active} />}
              lockedLabel="Studio"
            />
          </motion.div>

          {mediaAccess.visible && (
            <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.3 }}>
              <ProductCard
                href="/studio/media"
                icon={Clapperboard}
                iconClass="ohp-icon-assemble-clapper"
                eyebrow="Media"
                  title="Media Lab"
                description="Turn listing photos into twilight shots, staged rooms & walkthrough videos."
                actions={[
                  { label: 'Create', href: '/studio/media/new', icon: Plus },
                ]}
                accent="from-[#C9A24D]/15 to-transparent"
                preview={(active) => <MediaPreview active={active} />}
                locked={mediaAccess.locked}
                upgradeHref={mediaAccess.upgradeHref}
                lockedLabel="Media Lab"
                hideEnterWord
              />
            </motion.div>
          )}

          {spotlightAccess.visible && (
            <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.35 }}>
              <ProductCard
                href="/studio/property-sites"
                icon={SpotlightIcon}
                eyebrow="Listing"
                title="My Spotlight"
                description="A cinematic standalone site for one listing — published in seconds at its own address."
                actions={[
                  { label: 'Create', href: '/studio/property-sites?new=1', icon: Plus },
                ]}
                accent="from-[#111827]/10 to-transparent"
                preview={(active) => <PropertySitePreview active={active} />}
                locked={spotlightAccess.locked}
                upgradeHref={spotlightAccess.upgradeHref}
                lockedLabel="Spotlight"
                hideEnterWord
              />
            </motion.div>
          )}

          {emailSignatureAccess.visible && (
            <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.4 }}>
              <ProductCard
                href="/studio/email-signature"
                icon={Mail}
                iconClass="ohp-icon-assemble-mail"
                eyebrow="Brand"
                title="Your Signature"
                description="Your personal branding — in your email, on your site, and everywhere else you show up."
                actions={[
                  { label: 'Edit', href: '/studio/email-signature', icon: Layers },
                ]}
                accent="from-[#C9A24D]/15 to-transparent"
                preview={(active) => <SignaturePreview active={active} name={[user?.first_name, user?.last_name].filter(Boolean).join(' ')} photoUrl={user?.photo_url} />}
                previewShort
                locked={emailSignatureAccess.locked}
                upgradeHref={emailSignatureAccess.upgradeHref}
                lockedLabel="Signature"
              />
            </motion.div>
          )}
        </div>

        {/* Secondary links: the connect-a-service tools (CRM, Email, Calendar, Reviews) as compact
            horizontal bars, each with its live status (green working / red needs setup / grey not on
            plan) and one line of detail. Then, under a divider of its own, what's coming next.
            Brand Kit lives in the header's top-right. */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ToolLinkCard href="/studio/integrations" icon={Plug} iconClass="ohp-icon-assemble-plug" title="CRM" subtitle="Send leads to your CRM, pull in portal leads" status={toolStatus.loading ? undefined : toolStatus.integrationsStatus} tone={toolStatus.integrationsTone} detail={toolStatus.integrationsDetail} delay={0.45} />
          <ToolLinkCard href="/studio/email" icon={Send} title="Email" subtitle="What goes out, from which address" status={toolStatus.loading ? undefined : toolStatus.emailStatus} tone={toolStatus.emailTone} detail={toolStatus.emailDetail} delay={0.5} />
          <ToolLinkCard href="/studio/calendar" icon={CalendarClock} iconClass="ohp-icon-assemble-calendar" title="Calendar" subtitle="Two-way sync with Google or Outlook" status={toolStatus.loading ? undefined : toolStatus.calendarStatus} tone={toolStatus.calendarTone} detail={toolStatus.calendarDetail} delay={0.55} />
          <ToolLinkCard href="/studio/reviews" icon={Star} title="Reviews" subtitle="Turn happy clients into 5-star reviews" status={toolStatus.loading ? undefined : toolStatus.reviewsStatus} tone={toolStatus.reviewsTone} detail={toolStatus.reviewsDetail} delay={0.6} />
        </div>

        {/* Coming soon - on its own level, under a divider (Future Feature Ideas on the launch
            checklist): AI contract deadlines. */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.62 }} className="mt-7 flex items-center gap-3">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#C9A24D]/40 to-[#C9A24D]/40" />
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#8b7355] dark:text-[#e8c97a]">
            <Sparkles className="h-3 w-3" /> Coming soon
          </span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[#C9A24D]/40 to-[#C9A24D]/40" />
        </motion.div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ToolLinkCard comingSoon icon={FileClock} iconClass="ohp-icon-assemble-deadline" title="Deadlines" subtitle="Contract dates on your calendar" detail="Upload the agreement of sale - AI adds every deadline" delay={0.66} />
        </div>
      </div>
    </div>
  )
}

/** Brand Kit lives in the Tools header's top-right corner - a two-line button (name + what it does,
  * red until a logo is added since every design pulls from it). Sits on the title row. */
function BrandKitButton() {
  const [hasLogo, setHasLogo] = useState<boolean | null>(null)
  useEffect(() => {
    api.studio.getBrandKit()
      .then(r => { if (r.success && r.data) setHasLogo(!!(r.data.personal_logo_url || r.data.team_logo_url || r.data.brokerage_logo_url)) })
      .catch(() => {})
  }, [])
  return (
    <Link
      href="/studio/brand-kit"
      title={hasLogo === false ? 'Add your logo - every design pulls from your Brand Kit' : 'Logos, colors & fonts shared across Studio & Blogs'}
      className="group flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white py-2 pl-2 pr-4 text-left shadow-sm sm:inline-flex sm:w-auto sm:whitespace-nowrap transition hover:-translate-y-0.5 hover:border-[#C9A24D] hover:shadow-md dark:border-gray-700 dark:bg-[#151517]"
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#C9A24D] to-[#8b7355] text-white shadow-sm transition-transform group-hover:scale-105">
        <Wand2 className="h-[18px] w-[18px]" />
        {hasLogo === false && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#151517]" />}
      </span>
      <span className="min-w-0 flex-1 leading-tight sm:flex-none">
        <span className="flex items-center gap-1.5 text-sm font-black text-[#111827] dark:text-white">
          Brand Kit
          {hasLogo === true && <Check className="h-3.5 w-3.5 text-emerald-500" />}
        </span>
        <span className={`block text-[11px] font-semibold ${hasLogo === false ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {hasLogo === false ? 'Add your logo - every design uses it' : 'Logos, colors & fonts for every design'}
        </span>
      </span>
      <ArrowRight className="ml-1 h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#C9A24D]" />
    </Link>
  )
}

const TONE_STYLE: Record<ToolTone, { text: string; icon: typeof Check; pill: string; dot: string }> = {
  ok: { text: 'text-emerald-600 dark:text-emerald-400', icon: Check, pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30', dot: 'bg-emerald-500' },
  warn: { text: 'text-red-600 dark:text-red-400', icon: AlertCircle, pill: 'bg-red-50 text-red-600 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30', dot: 'bg-red-500 animate-pulse' },
  off: { text: 'text-gray-400 dark:text-gray-500', icon: Minus, pill: 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-white/[0.06] dark:text-white/50 dark:ring-white/10', dot: 'bg-gray-400' },
}

// Horizontal setup-tool bar (Integrations/Calendar/Reviews + a coming-soon one) - the same ivory + gold
// surface as the product cards above: dark icon tile with the gold icon, serif title, the live
// status as a colored pill (green = working, red = needs setting up, grey = not on this plan) plus
// one line of real detail (last sync, counts...).
function ToolLinkCard({ href, icon: Icon, iconClass, title, subtitle, status, tone = 'off', detail, badge, delay, comingSoon = false }: {
  /** Not needed for a "Coming soon" card - it isn't a link yet. */
  href?: string
  icon: React.ComponentType<{ className?: string }>
  iconClass?: string
  title: string
  subtitle: string
  /** undefined while loading (skeleton) */
  status?: string
  tone?: ToolTone
  detail?: string
  /** Red count on the icon, like the Forms card's (follow-ups due today or overdue). */
  badge?: number
  delay: number
  /** Not built yet: same card, not clickable, a gold "Coming soon" pill instead of a status. */
  comingSoon?: boolean
}) {
  const t = TONE_STYLE[tone]
  const Shell = (comingSoon || !href ? 'div' : Link) as React.ElementType
  return (
    <motion.div
      className="min-w-0"
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay }}
    >
      <Shell
        {...(comingSoon || !href ? { 'aria-disabled': true, title: `${title} - coming soon` } : { href })}
        onMouseMove={trackGlow}
        className={`lx-hero group/lx group relative flex h-full w-full min-w-0 ${comingSoon ? 'opacity-[0.82] saturate-[0.55] hover:opacity-95 hover:saturate-[0.8]' : ''} items-center justify-between gap-4 overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-[radial-gradient(120%_160%_at_100%_0%,rgba(201,162,77,.16),transparent_55%),linear-gradient(140deg,#fffdf8_0%,#fbf6ec_60%,#f6eddb_100%)] px-5 py-4 shadow-[0_18px_40px_-32px_rgba(139,115,85,.6)] transition duration-300 hover:-translate-y-1 hover:border-[#C9A24D]/60 hover:shadow-[0_26px_50px_-30px_rgba(201,162,77,.7)] dark:border-white/[0.08] dark:bg-[radial-gradient(120%_160%_at_100%_0%,rgba(201,162,77,.16),transparent_55%),linear-gradient(140deg,#0b0f0e_0%,#111827_60%,#1d1810_100%)]`}
      >
        <div aria-hidden className="ohp-tool-grid pointer-events-none absolute inset-0" />
        <CardAlive seed={delay * 10} />
        <div aria-hidden className="ohp-tool-edge pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <Icon aria-hidden className="lx-mark pointer-events-none absolute -bottom-6 right-12 h-24 w-24 text-[#C9A24D]/[0.10] dark:text-[#e8c97a]/[0.07]" />
        <div className="relative flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-md ring-1 ring-[#C9A24D]/30 transition-transform duration-300 group-hover:scale-110 group-hover:shadow-[0_6px_20px_-2px_rgba(201,162,77,0.6)] dark:from-[#e8c97a] dark:to-[#C9A24D] dark:text-[#111827]">
            <Icon className={`ohp-icon-draw ${iconClass || ''} h-5 w-5`} />
            {!!badge && badge > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-[#151517]">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="flex items-baseline gap-2">
              <span className="font-serif text-lg font-black text-[#111827] dark:text-white"><GoldLastWord text={title} /></span>
              <span className="hidden truncate text-[11px] font-semibold text-gray-500 dark:text-white/50 sm:inline">{subtitle}</span>
            </p>
            {comingSoon ? (
              <>
                <p className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#C9A24D]/10 px-2 py-0.5 text-[11px] font-black text-[#8b7355] ring-1 ring-[#C9A24D]/40 dark:bg-[#C9A24D]/15 dark:text-[#e8c97a] dark:ring-[#C9A24D]/35">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A24D]" />
                  <span className="truncate">Coming soon</span>
                </p>
                {detail && <p className="mt-1 line-clamp-2 text-[11px] font-semibold text-gray-500 dark:text-white/50 sm:truncate">{detail}</p>}
              </>
            ) : status === undefined ? (
              <div className="mt-1.5 h-4 w-44 animate-pulse rounded-full bg-[#C9A24D]/15" />
            ) : (
              <>
                <p className={`mt-1 inline-flex max-w-full items-start gap-1.5 rounded-xl px-2 py-0.5 text-[11px] font-black leading-snug ring-1 sm:items-center sm:rounded-full ${t.pill}`}>
                  <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full sm:mt-0 ${t.dot}`} />
                  <span className="min-w-0 sm:truncate">{status}</span>
                </p>
                {detail && <p className="mt-1 line-clamp-2 text-[11px] font-semibold text-gray-500 dark:text-white/50 sm:truncate">{detail}</p>}
              </>
            )}
          </div>
        </div>
        {comingSoon ? (
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#C9A24D]/30 bg-white/70 text-[#8b7355] dark:bg-white/[0.06] dark:text-[#e8c97a]">
            <Lock className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#C9A24D]/30 bg-white/70 text-[#8b7355] transition-all duration-300 group-hover:translate-x-0.5 group-hover:border-[#C9A24D] group-hover:bg-[#111827] group-hover:text-[#e8c97a] dark:bg-white/[0.06] dark:text-[#e8c97a]">
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </Shell>
    </motion.div>
  )
}

function ProductCard({ href, icon: Icon, iconClass, eyebrow, title, description, actions, accent, preview, badge, comingSoon, previewShort, eyebrowMarginClass, locked, upgradeHref, lockedLabel, hideEnterWord }: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  iconClass?: string
  eyebrow: string
  title: string
  description: string
  actions: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[]
  accent: string
  // A render function, not a plain node: previews sit static on their "completed" frame until
  // this card is actually hovered, so the whole grid isn't a wall of things moving at once - only
  // called with `active` telling the preview whether to animate right now.
  preview?: (active: boolean) => React.ReactNode
  badge?: number
  comingSoon?: boolean
  // True once a preview is sized small enough to clear vertically above the title before it even
  // starts (CMA, Blogs, and the two phone previews all do this now) - so only the eyebrow line
  // (still within the graphic's vertical band) needs to give it room, and title/description run
  // the card's full width underneath instead of wrapping around it.
  previewShort?: boolean
  // How much of the eyebrow's line the graphic needs reserved - varies with the graphic's own
  // width (CMA/Blogs are both 176px wide; the phone previews are narrower). Defaults to 192px.
  eyebrowMarginClass?: string
  // Visible but not usable - the tool still gets its normal card (so it isn't just missing from
  // the grid), dimmed with a lock badge, and every link on it goes to the upgrade prompt instead
  // of the real tool.
  locked?: boolean
  upgradeHref?: string
  // What the "Unlock ___"/"Enter ___" buttons call the tool - defaults to the eyebrow, but now
  // that eyebrow is a short category tag ("Listing", "Brand", "Design") rather than the tool's
  // own name, several cards override this with the tool's actual name so the button doesn't read
  // "Enter Listing"/"Enter Branding".
  lockedLabel?: string
  // Drops the "Enter " word from the primary button, leaving just the tool's name - explicit ask
  // for the second row ("remove enter from 2nd row tool card buttons so the shortcuts really
  // show"): those names got longer/renamed, crowding out the shortcut chip beside the button.
  hideEnterWord?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const primaryAction = actions[0]
  const router = useRouter()
  // Phones have no hover: the preview plays while the card is on screen instead.
  const cardRef = useRef<HTMLDivElement>(null)
  const inView = useInView(cardRef, { amount: 0.55 })
  const eyebrowMr = previewShort ? (eyebrowMarginClass === 'mr-28' ? 'sm:mr-28' : 'sm:mr-48') : preview ? 'sm:mr-28' : ''
  // The whole card opens the tool (its own buttons still go where they say).
  const open = (e: React.MouseEvent) => {
    if (comingSoon || (e.target as HTMLElement).closest('a,button')) return
    router.push(locked ? (upgradeHref || href) : href)
  }
  return (
    <div
      ref={cardRef}
      role="link"
      tabIndex={comingSoon ? -1 : 0}
      onClick={open}
      onKeyDown={e => { if (e.key === 'Enter' && !comingSoon && e.target === e.currentTarget) router.push(locked ? (upgradeHref || href) : href) }}
      aria-disabled={comingSoon || undefined}
      title={comingSoon ? 'Coming soon' : locked ? 'Upgrade to unlock' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={trackGlow}
      className={`lx-hero group/lx group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-white dark:bg-[#111214] sm:bg-[radial-gradient(120%_120%_at_100%_0%,rgba(201,162,77,.16),transparent_55%),linear-gradient(140deg,#fffdf8_0%,#fbf6ec_60%,#f6eddb_100%)] sm:dark:bg-[radial-gradient(120%_120%_at_100%_0%,rgba(201,162,77,.16),transparent_55%),linear-gradient(140deg,#0b0f0e_0%,#111827_60%,#1d1810_100%)] p-5 shadow-[0_20px_44px_-32px_rgba(139,115,85,.6)] transition duration-300 dark:border-white/[0.08] ${
        comingSoon ? 'grayscale opacity-60 pointer-events-none' : locked ? '' : 'hover:-translate-y-1 hover:border-[#C9A24D]/60 hover:shadow-[0_28px_56px_-30px_rgba(201,162,77,.75)]'
      }`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent}`} />
      <div aria-hidden className="ohp-tool-grid pointer-events-none absolute inset-0" />
      {!comingSoon && <CardAlive seed={eyebrow.length + title.length} />}
      <Icon aria-hidden className="lx-mark pointer-events-none absolute -bottom-10 -right-6 h-36 w-36 text-[#C9A24D]/[0.08] dark:text-[#e8c97a]/[0.06]" />
      <div aria-hidden className="ohp-tool-edge pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-[#C9A24D]/0 blur-3xl transition-colors duration-700 group-hover:bg-[#C9A24D]/20" />
      {comingSoon && (
        <span className="absolute right-3 top-3 z-10 rounded-full bg-gray-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-gray-500 dark:bg-gray-700 dark:text-gray-400">
          Coming Soon
        </span>
      )}
      {/* Top-center, not top-right - that corner belongs to the preview graphic. Locked cards
          still get their normal graphic in full color (only this badge and the Unlock button
          below read as muted/disabled) - a colorful, working-looking preview is still the best
          pitch for what unlocking gets you, so the card can't compete with it for the same spot. */}
      {locked && !comingSoon && (
        <span className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-gray-500 dark:bg-gray-700 dark:text-gray-400">
          <Lock className="h-2.5 w-2.5" /> Locked
        </span>
      )}
      {/* Every preview pins to the card's actual top-right corner, at its original full size -
          as far top-right as it can sit, but not shrunk to get there. Locked cards keep it in full
          color (only the Unlock button and the top-center Locked badge read as "muted/disabled") -
          it's still the best pitch for what unlocking gets you. */}
      {preview && (
        <div className={`absolute right-4 top-4 z-[1] hidden sm:block ${locked ? 'pointer-events-none' : ''}`}>
          <div className="relative">
            {preview(hovered)}
          </div>
        </div>
      )}
      {/* Phones: the preview gets its own stage across the top of the card, bigger and playing
          while the card is on screen - so each tool reads as itself, not as another header. */}
      {preview && (
        <div className="pointer-events-none relative -mx-5 -mt-5 mb-1 flex h-[150px] items-center justify-center overflow-hidden border-b border-[#C9A24D]/20 bg-[radial-gradient(90%_120%_at_50%_0%,rgba(201,162,77,.22),transparent_60%),linear-gradient(160deg,#fffdf8_0%,#f6eddb_100%)] dark:border-white/[0.06] dark:bg-[radial-gradient(90%_120%_at_50%_0%,rgba(201,162,77,.18),transparent_60%),linear-gradient(160deg,#0b0f0e_0%,#1d1810_100%)] sm:hidden">
          <div aria-hidden className="ohp-tool-grid absolute inset-0 opacity-70" />
          <div className="relative origin-center scale-[1.32]">
            {preview(inView)}
          </div>
        </div>
      )}
      <div className="relative flex flex-1 flex-col">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-md ring-1 ring-[#C9A24D]/30 transition-transform duration-300 group-hover:scale-110 group-hover:shadow-[0_4px_16px_-2px_rgba(201,162,77,0.5)] dark:from-[#e8c97a] dark:to-[#C9A24D] dark:text-[#111827]">
          <Icon className={`ohp-icon-draw ${iconClass || ''} h-[18px] w-[18px]`} />
          {!locked && !!badge && badge > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-[#151517]">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </div>
        {/* Every graphic is now sized to clear vertically above the title before text even
            starts, the same way CMA's short-wide one always has - so only the eyebrow line
            (still within the graphic's vertical band) needs to give it room. Title and
            description both run the card's full width underneath it, not squeezed to half the
            card for their whole height. */}
        <div>
          <p className={`mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974] ${eyebrowMr}`}>{eyebrow}</p>
          {/* Title keeps the same margin as the eyebrow for the square/phone graphics (unlike
              CMA's short-wide one, they don't fully clear above the title - they're absolutely
              positioned, so text doesn't wrap around them, it just renders underneath and gets
              visually painted over at narrower card widths without this) - so it never runs
              under the graphic, even once cards get narrow enough that the title needs the width
              the graphic would otherwise sit in. */}
          <h2 className={`mt-1 font-serif text-lg font-black text-[#111827] dark:text-white ${preview && !previewShort ? 'sm:mr-28' : ''}`}><GoldLastWord text={title} /></h2>
          <p className="mt-1.5 text-xs font-semibold leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
        </div>

        {locked ? (
          <Link
            href={upgradeHref || href}
            className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-xl bg-gray-200 px-4 pb-2 pt-3 text-xs font-black text-gray-600 shadow-sm transition hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            <Lock className="h-3.5 w-3.5" /> Unlock {lockedLabel || eyebrow}
          </Link>
        ) : (
          // One row, not two, and never wraps to a second one - the shortcut (Create a CMA,
          // Create a Blog, etc.) sits to the right of the main Enter button on the same line;
          // Enter never shrinks, so on a narrow card the shortcut's own label truncates instead
          // of the pair breaking onto separate rows. Pinned to the bottom of the card (mt-auto on
          // a flex-col card) rather than sitting right under the description, so every card's
          // buttons land on the same baseline regardless of how long its description runs.
          <div className="mt-auto flex items-center gap-2 pt-3">
            <Link
              href={href}
              className="group/enter relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-xl bg-[#111827] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200"
            >
              {hideEnterWord ? '' : 'Enter '}{lockedLabel || eyebrow} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              <span className="pointer-events-none absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 rounded-full bg-[#C9A24D] transition-all duration-300 ease-out group-hover/enter:w-[calc(100%-1rem)]" />
            </Link>
            {primaryAction && (
              <Link
                href={primaryAction.href}
                className="ml-auto inline-flex min-w-0 items-center gap-1 rounded-full border border-gray-200 bg-[#fbfaf7] px-2.5 py-1.5 text-[10px] font-black text-[#111827] transition hover:border-[#C9A24D] hover:bg-[#C9A24D]/10 dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white"
              >
                <primaryAction.icon className="h-3 w-3 shrink-0" /> <span className="truncate">{primaryAction.label}</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Shared iPhone bezel for the two mobile-first previews (Agent Hub, Forms) - same dark-frame +
// notch + white-screen recipe as the homepage demos' phone frames, at card-badge scale. Sized to
// clear above the title (like CMA/Blogs) instead of reaching down past it - Agent Hub and Forms
// both sit in the same narrow row as those two, where a taller phone is wide enough relative to
// the card to visually collide with the title text. Grown again (80px -> 96px) per direct
// feedback the frame itself could be bigger - the on-screen content (text/icon sizes below) is
// intentionally left alone rather than scaled up with it, so a bigger phone reads as more screen,
// not just a blown-up version of the same few elements.
function MiniPhone({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-24 w-24 items-center justify-center">
      <div className="relative h-[94px] w-[60px] rounded-xl border-2 border-[#111827] bg-[#111827] shadow-lg dark:border-white/90 dark:bg-white/90">
        <div className="absolute left-1/2 top-0 z-10 h-2.5 w-6 -translate-x-1/2 rounded-b-sm bg-[#111827] dark:bg-white/90" />
        <div className="relative h-full w-full overflow-hidden rounded-[0.7rem] bg-[#fbfaf7]">{children}</div>
      </div>
    </div>
  )
}

// A real mini form-question card cycling through what the actual FormRunner shows (progress bar,
// question, answer options, a Next button that visibly presses) - not an abstract "fields
// building" animation. Generic placeholder question copy, not a real client's real answers, since
// this runs inside the app for every agent rather than showing one marketing page's real form.
const FORM_QUESTIONS = [
  { q: 'Are you buying or selling?', options: ['Buying', 'Selling'], picked: 0 },
  { q: 'What is your timeline?', options: ['0-3 months', '3-6 months'], picked: 1 },
]
function FormPreview({ active }: { active: boolean }) {
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState(false)
  const [pressed, setPressed] = useState(false)
  // Static (not hovered) = the completed version of this animation, not a frozen mid-step frame:
  // the last question, already answered, resting - not a spinner or a half-finished state. The
  // actual step-by-step cycle only ever runs while the card is hovered.
  useEffect(() => { if (active) { setQi(0); setPicked(false); setPressed(false) } }, [active])
  const restIndex = FORM_QUESTIONS.length - 1
  // Explicit ask: "just run the animation once on highlight don't keep looping" - advances to the
  // next question once, then simply doesn't schedule another advance once it reaches the last
  // one (was `% FORM_QUESTIONS.length`, which wrapped back to question 1 and replayed forever).
  useEffect(() => {
    if (!active) return
    setPicked(false)
    const t1 = setTimeout(() => setPicked(true), 500)
    if (qi >= restIndex) return () => clearTimeout(t1)
    const t2 = setTimeout(() => setPressed(true), 1150)
    const t3 = setTimeout(() => { setPressed(false); setQi(v => Math.min(v + 1, restIndex)) }, 1550)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [qi, active, restIndex])
  const question = FORM_QUESTIONS[active ? qi : restIndex]
  const isPicked = active ? picked : true
  const isPressed = active && pressed
  return (
    <MiniPhone>
      <div className="flex h-full flex-col px-2.5 pt-5">
        <div className="flex gap-0.5">
          {FORM_QUESTIONS.map((_, i) => (
            <div key={i} className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ${i <= (active ? qi : restIndex) ? 'bg-[#C9A24D]' : 'bg-[#111827]/10'}`} />
          ))}
        </div>
        <p key={`q-${qi}`} className={`mt-2.5 font-serif text-[7px] font-black leading-tight text-[#111827] ${active ? 'animate-fadeIn' : ''}`}>{question.q}</p>
        <div key={`opts-${qi}`} className={`mt-2.5 flex flex-col gap-2 ${active ? 'animate-fadeIn' : ''}`}>
          {question.options.map((opt, i) => (
            <div
              key={opt}
              className={`flex items-center justify-between rounded-sm border px-1.5 py-1 text-[6px] font-bold transition-all duration-300 ${
                isPicked && i === question.picked ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#111827] scale-[1.03]' : 'border-[#111827]/10 text-gray-400'
              }`}
            >
              {opt}
              {isPicked && i === question.picked && <Check className="h-1.5 w-1.5 text-[#8b7355]" />}
            </div>
          ))}
        </div>
        <div className={`mt-auto mb-4 flex items-center justify-center rounded-full bg-[#111827] py-1.5 text-[6px] font-black uppercase tracking-wide text-white transition-transform duration-150 ${isPressed ? 'scale-95' : 'scale-100'}`}>
          Next
        </div>
      </div>
    </MiniPhone>
  )
}

// The agent's own real name/photo inside an actual phone bezel - "a live mini preview of the
// actual agent hub" rather than a flat mockup card. Mirrors the real page's own structure (profile
// -> Buying/Selling CTAs -> a Recent Sales shelf), not just a name and two placeholder bars.
// Explicit ask: "the one page agent hub graphics animate much more" - was just the pulsing live
// dot before. Every piece now does a small staggered entrance (fade + rise) each time the card is
// hovered, like the real page loading in top to bottom, instead of sitting completely still.
function SitePreview({ active, name, title, photoUrl }: { active: boolean; name?: string; title?: string | null; photoUrl?: string | null }) {
  const step = (i: number) => ({
    transitionDelay: active ? `${i * 90}ms` : '0ms',
    transitionProperty: 'opacity, transform',
    transitionDuration: '450ms',
    transitionTimingFunction: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
    opacity: active ? 1 : 0.55,
    transform: active ? 'translateY(0)' : 'translateY(3px)',
  })
  return (
    <MiniPhone>
      <span className="absolute right-1.5 top-1.5 flex h-1.5 w-1.5 items-center justify-center">
        {active && <span className="absolute h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400 opacity-75" />}
        <span className="relative h-1 w-1 rounded-full bg-emerald-500" />
      </span>
      <div className="flex flex-col items-center px-2 pt-5 text-center">
        <div style={step(0)} className="relative h-6 w-6 overflow-hidden rounded-full border border-[#C9A24D] bg-white">
          {photoUrl && <Image src={resolveMediaUrl(photoUrl)} alt="" fill className="object-cover" unoptimized />}
        </div>
        <p style={step(1)} className="mt-1.5 w-full truncate font-serif text-[6.5px] font-black leading-tight text-[#111827]">{name || 'Your Name'}</p>
        <p style={step(2)} className="mt-0.5 w-full truncate text-[5px] font-black uppercase tracking-wide text-[#8b7355]">{title || 'Real Estate Agent'}</p>
        <div style={step(3)} className="mt-2 flex w-full gap-0.5">
          <span className="h-3 flex-1 rounded-sm bg-[#111827]/5 dark:bg-white/10" />
          <span className="h-3 flex-1 rounded-sm bg-[#C9A24D]/20" />
        </div>
        <div style={step(4)} className="mt-1.5 flex w-full gap-0.5">
          <span className="h-4 flex-1 rounded-sm bg-gray-200 dark:bg-gray-700" />
          <span className="h-4 flex-1 rounded-sm bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </MiniPhone>
  )
}

// A mini blog-POST card, not just a floating headline - a colored "featured image" band up top
// (like the real Agent Hub blog list shows) with the headline typing itself out underneath, then
// "Published", the concrete beat of what this tool actually produces. Square like the other
// square previews now that "Publish Articles" (shorter than the old title) frees the room for it.
const BLOG_HEADLINES = ['Main Line Market Update', '5 Tips For First-Time Buyers']
function BlogPreview({ active }: { active: boolean }) {
  const [i, setI] = useState(0)
  const [published, setPublished] = useState(true)
  // Resting frame = the finished, published headline - not a mid-typing freeze. The type-out ->
  // publish loop only plays while this card is hovered, restarting fresh each time.
  useEffect(() => { if (active) { setI(0); setPublished(false) } else setPublished(true) }, [active])
  // Explicit ask: "just run the animation once on highlight don't keep looping" - types+publishes
  // each headline once, in order, then just stops on the last one already published (was
  // `% BLOG_HEADLINES.length`, which wrapped back to the first headline and retyped forever).
  useEffect(() => {
    if (!active || !published || i >= BLOG_HEADLINES.length - 1) return
    const t = setTimeout(() => { setPublished(false); setI(v => v + 1) }, 2800)
    return () => clearTimeout(t)
  }, [published, active, i])
  return (
    // Same footprint as CMA's preview (h-16 w-44) so it clears above the title the same way,
    // letting "Publish Articles" run full-width on one line - a left "featured image" swatch
    // (the textured gradient + watermark) instead of a full-width top band.
    <div className="flex h-14 w-44 items-stretch gap-2 rounded-lg border border-[#816937]/25 bg-[#fbfaf3] p-2 dark:border-white/10 dark:bg-[#1A1A1C]">
      <div className="relative w-10 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-[#816937] to-[#C9A24D]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-25"
          style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 6px)' }}
        />
        <Newspaper className="absolute -bottom-1 -right-1 h-4 w-4 text-white/25" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <p className="line-clamp-2 font-serif text-[8px] font-black leading-snug text-[#111827] dark:text-white">
          {active && !published ? <TypingAnimation key={i} text={BLOG_HEADLINES[i]} speed={90} onComplete={() => setPublished(true)} /> : BLOG_HEADLINES[i]}
        </p>
        <div className={`flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[6px] font-black uppercase tracking-wide transition-colors duration-300 ${published ? 'bg-emerald-500 text-white' : 'bg-[#111827]/10 text-gray-400 dark:bg-white/10'}`}>
          {published ? <><Check className="h-1.5 w-1.5" /> Published</> : 'Writing...'}
        </div>
      </div>
    </div>
  )
}

// A small square that cycles through real design SITUATIONS (not just "Just Listed" - the same
// style/color relooking as before, but now also the actual badge copy this tool produces for
// different moments in a listing's life), so the loop shows breadth, not one frozen result.
const DESIGN_LOOKS = [
  { badge: 'Just Listed', badgeClass: 'bg-[#C9A24D] text-[#111827]', overlay: 'from-black/85 via-black/10 to-transparent' },
  { badge: 'Open House', badgeClass: 'bg-white text-[#111827]', overlay: 'from-[#111827]/70 via-transparent to-transparent' },
  { badge: 'Sold', badgeClass: 'bg-emerald-500 text-white', overlay: 'from-emerald-950/80 via-black/20 to-transparent' },
  { badge: 'Coming Soon', badgeClass: 'bg-[#111827] text-white', overlay: 'from-[#111827]/90 via-black/25 to-transparent' },
]
function DesignPreview({ active }: { active: boolean }) {
  const photo = PLACEHOLDER_PROPERTY.photos![0]
  const restIndex = DESIGN_LOOKS.length - 1
  const [i, setI] = useState(restIndex)
  // Explicit ask: "just run the animation once on highlight don't keep looping" - steps through
  // every look once via a chain of timeouts (not a repeating setInterval) and stops on the last
  // one, which is also the resting frame - so it settles exactly where it already was, instead of
  // restarting from the top on every tick for as long as the card stays hovered.
  useEffect(() => {
    if (!active) { setI(restIndex); return }
    setI(0)
    const timers = DESIGN_LOOKS.map((_, idx) => setTimeout(() => setI(idx), idx * 1900))
    return () => timers.forEach(clearTimeout)
  }, [active, restIndex])
  const look = DESIGN_LOOKS[i]
  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-xl">
      <Image src={photo} alt="" fill className="object-cover" unoptimized />
      <div className={`absolute inset-0 bg-gradient-to-t transition-all duration-700 ${look.overlay}`} />
      <span key={`badge-${i}`} className={`absolute left-1.5 top-1.5 rounded-sm px-1.5 py-0.5 text-[6.5px] font-black uppercase tracking-wide ${active ? 'animate-fadeIn' : ''} ${look.badgeClass}`}>
        {look.badge}
      </span>
      <div className="absolute inset-x-1.5 bottom-1.5">
        <p key={`addr-${i}`} className={`font-serif text-[9px] font-black leading-tight text-white ${active ? 'animate-fadeIn' : ''}`}>{PLACEHOLDER_PROPERTY.address}</p>
      </div>
    </div>
  )
}

// The actual thing CMA does - score comps against the subject - not a generic, meaningless bar
// chart. Three comps, three match scores, color-coded exactly like the real Strong/Supporting/
// Weaker classification. A short, wide rectangle (not a square like the others) - it only needs
// to clear the icon row, not reach down into the title, so "Comparative Market Analysis" still
// gets the card's full width on one line (see ProductCard's previewShort). Widened again and
// made shorter (h-16 w-44) per direct feedback - less height, more width, matching Blogs below.
// Explicit ask: "cma graphic should animate the bars filling up and down then up again opposite
// each bar make it stunning" - was fully static before (no `active` prop at all). Each bar now
// oscillates between a "low" and "high" reading while hovered, alternating which bars are up vs.
// down each tick (`wave` flips 0/1 on an interval; even-indexed bars follow it, odd-indexed bars
// run the opposite phase) - a smooth CSS width transition handles the actual motion, this just
// keeps changing the target every ~950ms, so bar 1 and bar 2 visibly move in opposite directions
// at the same time, like a little seesaw, before both settle back on their real match score at
// rest (not hovered) - resting = the real, true reading, never a mid-wave number.
function CmaPreview({ active }: { active: boolean }) {
  const comps = [
    { label: 'C1', score: 92, tone: 'bg-emerald-500' },
    { label: 'C2', score: 78, tone: 'bg-[#C9A24D]' },
    { label: 'C3', score: 54, tone: 'bg-gray-300 dark:bg-gray-600' },
  ]
  const [wave, setWave] = useState(0)
  const [settled, setSettled] = useState(true)
  // Explicit ask: "just run the animation once on highlight don't keep looping" - 3 flips (a
  // seesaw down-up-down) via a fixed timeout chain, then `settled` flips true and everything
  // holds on each bar's real score - even while still hovered - instead of oscillating for as
  // long as the card stays hovered.
  useEffect(() => {
    if (!active) { setWave(0); setSettled(true); return }
    setSettled(false)
    const timers = [1, 2, 3].map(n => setTimeout(() => setWave(n % 2), n * 950))
    const settle = setTimeout(() => setSettled(true), 4 * 950)
    return () => { timers.forEach(clearTimeout); clearTimeout(settle) }
  }, [active])
  return (
    <div className="flex h-14 w-44 flex-col gap-1 rounded-lg border border-[#816937]/25 bg-[#fbfaf3] px-3 py-2 leading-none dark:border-white/10 dark:bg-[#1A1A1C]">
      <p className="truncate text-[6.5px] font-black uppercase tracking-widest text-gray-400">Comp Match</p>
      <div className="flex flex-1 flex-col justify-center gap-[3px]">
        {comps.map((c, i) => {
          const goingUp = i % 2 === 0 ? wave === 1 : wave === 0
          const display = active && !settled ? Math.max(12, Math.min(97, c.score + (goingUp ? 14 : -14))) : c.score
          return (
            <div key={c.label} className="flex items-center gap-1.5">
              <span className="w-3.5 shrink-0 text-[6.5px] font-black uppercase tracking-wide text-gray-400">{c.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#111827]/10 dark:bg-white/10">
                <div className={`h-full rounded-full ${c.tone} transition-all duration-[850ms] ease-in-out`} style={{ width: `${display}%` }} />
              </div>
              <span className="w-5 shrink-0 text-right text-[6.5px] font-black text-[#111827] dark:text-white">{Math.round(display)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Same drag-to-compare slider mechanic as the real result screen (components/studio/media/
// BeforeAfter.tsx - clip-path reveal, not a soft crossfade). Reworked 2026-09-06 (direct
// feedback: the old version auto-swept back and forth, which read backwards - "twilight" should
// always play forward, full daylight settling into the twilight result, never the reverse and
// never oscillating). `pos` is now "how much daylight is currently showing" - 100 = full day,
// 0 = full twilight - so it only ever counts down once per hover. Resting (not hovered) sits at
// 0, i.e. the completed twilight result, not a frozen mid-transition frame.
//
// REAL_TWILIGHT_AFTER is an actual gpt-image-2 twilight generation run against this exact
// placeholder photo (2026-09-06 verification run for the prompt rewrite) - not a CSS filter
// approximation, per direct feedback that the old hue-rotate/brightness fake didn't match what
// the tool really produces (deep blue sky, a warm band low on the horizon, real warm interior
// glow through the windows).
//
// Second stage: after the reveal completes and holds, cuts to what the AI Video Maker does with
// that same twilight result - a continuous, very smooth slow push-in (see prompts.py's push_in
// motion hint - never described as "fast"/"slow", just "very smooth" and unbroken, so this
// preview's motion matches that same character) - before looping back to the reveal.
const REAL_TWILIGHT_AFTER = 'https://dk5bvrzdygq8w.cloudfront.net/studio-media-lab/03d758ae-c6d8-4d29-a51e-4344f8974e77.png'
function MediaPreview({ active }: { active: boolean }) {
  const photo = PLACEHOLDER_PROPERTY.photos![0]
  const [pos, setPos] = useState(0)
  const [stage, setStage] = useState<'reveal' | 'video'>('reveal')
  const [videoFrac, setVideoFrac] = useState(0)
  // Explicit ask: "just run the animation once on highlight don't keep looping" - elapsed no
  // longer wraps (`% TOTAL_MS`); once it reaches the end of the video stage the interval clears
  // itself and the preview just holds on that final zoomed-in frame for the rest of the hover,
  // instead of jumping back to the daylight photo and replaying from the top.
  useEffect(() => {
    if (!active) { setPos(0); setStage('reveal'); setVideoFrac(0); return }
    setPos(100)
    setStage('reveal')
    setVideoFrac(0)
    const start = Date.now()
    const REVEAL_MS = 1700
    const HOLD_MS = 500
    const VIDEO_MS = 2800
    const TOTAL_MS = REVEAL_MS + HOLD_MS + VIDEO_MS
    const t = setInterval(() => {
      const elapsed = Math.min(Date.now() - start, TOTAL_MS)
      if (elapsed < REVEAL_MS) {
        setStage('reveal')
        setPos(100 * (1 - elapsed / REVEAL_MS))
      } else if (elapsed < REVEAL_MS + HOLD_MS) {
        setStage('reveal')
        setPos(0)
      } else {
        setStage('video')
        setVideoFrac((elapsed - REVEAL_MS - HOLD_MS) / VIDEO_MS)
      }
      if (elapsed >= TOTAL_MS) clearInterval(t)
    }, 30)
    return () => clearInterval(t)
  }, [active])

  if (stage === 'video') {
    const scale = 1 + videoFrac * 0.12
    return (
      <div className="relative h-24 w-24 overflow-hidden rounded-xl">
        <div className="absolute inset-0" style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
          <Image src={REAL_TWILIGHT_AFTER} alt="" fill className="object-cover" unoptimized />
        </div>
        <span className="absolute right-1 top-1 flex items-center gap-0.5 rounded bg-[#C9A24D] px-1 py-0.5 text-[6px] font-black uppercase tracking-wide text-[#111827]">
          <Play className="h-1.5 w-1.5 fill-[#111827]" /> Video
        </span>
      </div>
    )
  }

  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-xl">
      {/* base layer: the real twilight result - fills the whole frame */}
      <Image src={REAL_TWILIGHT_AFTER} alt="" fill className="object-cover" unoptimized />
      {/* reveal layer: daylight (before), clipped to everything left of the divider - only
          rendered while actually revealing some of it, i.e. mid-hover-animation */}
      {pos > 0 && (
        <>
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
            <Image src={photo} alt="" fill className="object-cover" unoptimized />
          </div>
          <div className="pointer-events-none absolute inset-y-0 w-px bg-white shadow-[0_0_4px_rgba(0,0,0,0.6)]" style={{ left: `${pos}%` }} />
        </>
      )}
      {/* One tag, not two fixed corner labels - it only ever names the twilight edit (never
          "Day"), and only once daylight has mostly given way to it. */}
      <span
        className="absolute right-1 top-1 flex items-center gap-0.5 rounded bg-[#C9A24D] px-1 py-0.5 text-[6px] font-black uppercase tracking-wide text-[#111827] transition-opacity duration-300"
        style={{ opacity: pos < 45 ? 1 : 0 }}
      >
        <Moon className="h-1.5 w-1.5" /> Twilight
      </span>
    </div>
  )
}

// A tiny mockup of the actual "Gallery" signature card (icon rail + headshot + name + a stub
// listing bar) - not a literal envelope icon, so the card itself pitches what the tool produces,
// the same way every other preview graphic here shows real output rather than a generic glyph.
// Two explicit asks addressed here: (1) it used to be totally generic (gray bars, no real name/
// photo) - now takes the same real agent props SitePreview does, so every agent sees THEMSELVES
// here, not a placeholder; (2) "doesn't animate like others... should basically mimic the site
// version of signature feature animation when first opening" - the real Live Preview's card
// entrance (signaturePreview.ts's gallery-rail-enter/gallery-listing-enter/gallery-stats-rise,
// all fade+rise, staggered) is echoed here via the same `step()` staggered-entrance technique
// SitePreview uses, instead of just a color-swapping border. Swaps to "Recent Sale" once, then
// back, then stops (explicit ask: run once on highlight, don't keep looping).
function SignaturePreview({ active, name, photoUrl }: { active: boolean; name?: string; photoUrl?: string | null }) {
  const [showSale, setShowSale] = useState(false)
  useEffect(() => {
    if (!active) { setShowSale(false); return }
    const t1 = setTimeout(() => setShowSale(true), 1400)
    const t2 = setTimeout(() => setShowSale(false), 2900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [active])
  const step = (i: number) => ({
    transitionDelay: active ? `${i * 100}ms` : '0ms',
    transitionProperty: 'opacity, transform',
    transitionDuration: '450ms',
    transitionTimingFunction: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
    opacity: active ? 1 : 0.6,
    transform: active ? 'translateY(0)' : 'translateY(4px)',
  })
  return (
    // w-40, not w-44 - trimmed off the right edge (explicit ask: "too long"). The gold rail is NOT
    // part of the step() fade-in: at rest it used to sit at 60% opacity, so the card's left column
    // looked unfilled until hovered - it's always solid now; only the content beside it animates.
    <div className="flex h-16 w-40 items-stretch overflow-hidden rounded-lg border border-[#C9A24D]/30 bg-white shadow-sm dark:border-white/10 dark:bg-[#1A1A1C]">
      <div className="flex w-4 shrink-0 flex-col items-center justify-center gap-1 bg-[#C9A24D]">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full bg-white/90 ${active ? 'animate-pulse' : ''}`}
            style={active ? { animationDelay: `${i * 200}ms`, animationDuration: '1.2s' } : undefined}
          />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-2">
        <div style={step(1)} className="flex items-center gap-1.5">
          <span className={`relative h-4 w-4 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-[#C9A24D] to-[#8b7355] transition-shadow duration-500 ${active ? 'shadow-[0_0_0_3px_rgba(201,162,77,0.25)]' : ''}`}>
            {photoUrl && <Image src={resolveMediaUrl(photoUrl)} alt="" fill className="object-cover" unoptimized />}
          </span>
          <div className="min-w-0 flex-1">
            {name ? (
              <p className="truncate font-serif text-[7px] font-black leading-tight text-[#111827] dark:text-white">{name}</p>
            ) : (
              <div className="h-1.5 w-14 rounded-full bg-[#111827] dark:bg-white" />
            )}
            <div className="mt-1 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
        </div>
        {/* h-[19px], not the old 15px - the badge inside (icon + border + padding) actually needs
            ~18px, so the shorter box was clipping its bottom border/edge against this wrapper's
            own overflow-hidden (explicit ask: "bottom cut off"). */}
        <div style={step(2)} className="relative h-[19px] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={showSale ? 'sale' : 'listing'}
              initial={{ opacity: 0, y: active ? 6 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className={`absolute inset-x-0 flex items-center gap-1 rounded border px-1 py-0.5 ${showSale ? 'border-rose-300 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-900/10' : 'border-emerald-300 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/10'}`}
            >
              <span className={`h-3 w-4 shrink-0 rounded-sm ${showSale ? 'bg-rose-300' : 'bg-emerald-300'}`} />
              <span className={`text-[6px] font-black uppercase tracking-wide ${showSale ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{showSale ? 'Recent Sale' : 'Featured Listing'}</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// A tiny "browser chrome" strip (still cycling its own <slug>.openhousepal.com address, so it
// reads as "this becomes its own website" at a glance) over an actual miniature of the real
// Spotlight hero section (see CinematicLuxuryTemplate's Hero) - full-bleed photo, bottom-up dark
// gradient, a gold status pill, the address in serif over the city/state line, then price below a
// hairline divider - not a generic marketing-flyer "Just Listed" tag, which is what Design Studio's
// own preview already shows and this one kept duplicating. Second stage (unchanged) cuts to the
// site's embedded walkthrough video (a Spotlight site can carry the same AI-generated video as AI
// Media), then loops back.
function PropertySitePreview({ active }: { active: boolean }) {
  const urls = ['123-main-street', 'the-oaks-estate']
  const restIndex = urls.length - 1
  const SITE_STEP_MS = 2200
  const VIDEO_MS = 2400
  const [i, setI] = useState(restIndex)
  const [stage, setStage] = useState<'site' | 'video'>('site')
  const [videoFrac, setVideoFrac] = useState(0)
  // Explicit ask: "just run the animation once on highlight don't keep looping" - elapsed no
  // longer wraps (`% TOTAL_MS`); it cycles through each URL once, plays the video stage once, then
  // the interval clears itself and the preview just holds on that final frame.
  useEffect(() => {
    if (!active) { setI(restIndex); setStage('site'); setVideoFrac(0); return }
    setI(0)
    setStage('site')
    setVideoFrac(0)
    const start = Date.now()
    const SITE_MS = urls.length * SITE_STEP_MS
    const TOTAL_MS = SITE_MS + VIDEO_MS
    const t = setInterval(() => {
      const elapsed = Math.min(Date.now() - start, TOTAL_MS)
      if (elapsed < SITE_MS) {
        setStage('site')
        setI(Math.min(Math.floor(elapsed / SITE_STEP_MS), urls.length - 1))
      } else {
        setStage('video')
        setVideoFrac((elapsed - SITE_MS) / VIDEO_MS)
      }
      if (elapsed >= TOTAL_MS) clearInterval(t)
    }, 100)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
  const photo = PLACEHOLDER_PROPERTY.photos![0]
  const scale = 1 + videoFrac * 0.1
  const priceM = ((PLACEHOLDER_PROPERTY.price || 0) / 1_000_000).toFixed(1)
  return (
    <div className="h-24 w-24 overflow-hidden rounded-xl border border-white/10 bg-[#0B0B0B] shadow-lg ring-1 ring-white/5">
      <div className="flex h-4 items-center gap-1 border-b border-white/10 bg-black/40 px-1.5">
        <span className="h-1 w-1 rounded-full bg-red-300" />
        <span className="h-1 w-1 rounded-full bg-amber-300" />
        <span className="h-1 w-1 rounded-full bg-emerald-300" />
        <span className="ml-1 truncate text-[5.5px] font-bold text-white/40">{urls[i]}.openhousepal.com</span>
      </div>
      <div className="relative h-20 w-full overflow-hidden">
        <div
          className={`absolute inset-0 ${active && stage === 'site' ? 'animate-ken-burns' : ''}`}
          style={{ transform: stage === 'video' ? `scale(${scale})` : undefined, transformOrigin: 'center' }}
        >
          <Image src={photo} alt="" fill className="object-cover" unoptimized />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />
        {stage === 'site' ? (
          <div className="absolute inset-x-1.5 bottom-1.5">
            <span className="inline-flex items-center rounded-sm bg-[#C9A24D] px-1 py-0.5 text-[5px] font-black uppercase tracking-wide text-[#111827]">For Sale</span>
            <p className="mt-1 truncate font-serif text-[8px] font-black leading-none text-white drop-shadow">{PLACEHOLDER_PROPERTY.address}</p>
            <p className="mt-0.5 truncate text-[5px] font-semibold text-white/60">{PLACEHOLDER_PROPERTY.city}, {PLACEHOLDER_PROPERTY.state}</p>
            <div className="mt-1 flex items-center justify-between border-t border-white/15 pt-1">
              <span className="font-serif text-[7px] font-black text-white">${priceM}M</span>
              <span className="flex gap-0.5">
                {urls.map((u, ui) => (
                  <span key={u} className={`h-0.5 rounded-full transition-all duration-300 ${ui === i ? 'w-2 bg-[#C9A24D]' : 'w-0.5 bg-white/30'}`} />
                ))}
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90">
                <Play className="h-2 w-2 fill-[#111827] text-[#111827]" />
              </div>
            </div>
            <span className="absolute bottom-1.5 left-1.5 text-[5.5px] font-black uppercase tracking-wide text-white">Walkthrough Video</span>
          </>
        )}
      </div>
    </div>
  )
}

// GoldLastWord, TOOL_CARD_CSS, trackGlow and CardAlive now live in components/ui/LuxeSurface.tsx so
// Studio's situation cards (/studio/design) are built from the exact same pieces as these.
