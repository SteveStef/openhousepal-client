'use client'

import Link from 'next/link'
import { OhpHouse, OhpWordmark } from '@/components/brand/OhpBrand'
import { AnimatePresence, motion } from 'framer-motion'
import { useState, useEffect, type ComponentType, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Home, Moon, Sun, Menu, X, LogOut, Settings, Layout, ShieldCheck, Palette, LayoutDashboard, Users, AlertCircle, ChevronDown, Globe, Link2, ClipboardList, Newspaper, Search, Building2, Calculator, Lock, HelpCircle, Clapperboard, Mail, ToolCase, CalendarClock, Activity as ActivityIcon, Plug, Send, Star, ListChecks, FileClock, ClipboardCheck, ChevronRight, SwatchBook, Loader2 } from 'lucide-react'
import api from '@/lib/api-service'
import { hasValidSubscription } from '@/lib/auth-helpers'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import NotificationBell from './NotificationBell'
import IncompleteSettingsModal from './IncompleteSettingsModal'
import { useOpenHouseActionCounts } from '@/hooks/useOpenHouseActionCount'
import { useOpenRequestsCount } from '@/hooks/useOpenRequestsCount'
import { useFormsActionCount } from '@/hooks/useFormsActionCount'
import { useShowcasesActionCount } from '@/hooks/useShowcasesActionCount'
import { useSettingsCompleteness } from '@/hooks/useSettingsCompleteness'
import { useSupportUnreadCount } from '@/hooks/useSupportUnreadCount'
import { useAdminUnread } from '@/hooks/useAdminUnread'
import { ADMIN_SECTIONS, adminHref } from '@/lib/adminNav'
import { getNavFeatureAccess, isMissingLadderFeatures, type NavFeatureKey } from '@/lib/navAccess'
import { SpotlightIcon } from '@/components/icons/CustomIcons'
import { todayLocal } from '@/lib/relativeDays'

const UPGRADE_REMINDER_STORAGE_KEY = 'ohp_upgrade_reminder_date'

interface HeaderProps {
  mode?: 'landing' | 'app' | 'shared'
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
    )
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-lg text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-[#F3F4F6] hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 focus:outline-none"
      aria-label="Toggle Dark Mode"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  )
}

export default function Header({ mode = 'app' }: HeaderProps) {
  const { user, isAuthenticated, isLoading: isCheckingAuth, logout: contextLogout } = useAuth()
  const { showToast } = useToast()
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  // The phone menu opens with every section folded; tapping a section unfolds its pages (owner, 10/26).
  const [openSection, setOpenSection] = useState<string | null>(null)
  useEffect(() => { if (isMobileMenuOpen) setOpenSection(null) }, [isMobileMenuOpen])
  // Phone menu: tapping a page keeps the menu up until that page starts showing (its loading screen
  // or the page itself), then it fades away - closing it first flashed the old page (owner, 10/26).
  const [menuGoing, setMenuGoing] = useState<string | null>(null)
  const pathname = usePathname()
  useEffect(() => { setIsMobileMenuOpen(false); setMenuGoing(null) }, [pathname])
  useEffect(() => {
    if (!menuGoing) return
    const t = window.setTimeout(() => { setIsMobileMenuOpen(false); setMenuGoing(null) }, 4000)   // never stuck open
    return () => window.clearTimeout(t)
  }, [menuGoing])
  const menuGo = (href: string) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return
    const path = href.split(/[?#]/)[0]
    if (path === pathname) { setIsMobileMenuOpen(false); return }
    setMenuGoing(href)
  }

  // Landing nav active-tab tracking - mirrors the gold-underline "you are here" treatment the
  // logged-in nav already has (isActive(path) + motion.div layoutId="headerNavUnderline"), but
  // driven by which homepage section is scrolled into view instead of by route, since Features/
  // Pricing/FAQ are all the same route (/) with different scroll targets.
  const [landingActiveSection, setLandingActiveSection] = useState<'tools' | 'pricing' | 'faq' | null>(null)

  // Thin gold fill along the header's own bottom edge that grows as you scroll down the homepage -
  // lives in the header (not a separate fixed strip above it) so "there's more below" reads as
  // part of the persistent chrome instead of a one-off overlay. rAF-throttled and applied as a
  // scaleX transform so it never triggers layout while scrolling.
  const [scrollProgress, setScrollProgress] = useState(0)
  useEffect(() => {
    if (mode !== 'landing' || isAuthenticated) return
    let raf = 0
    const update = () => {
      raf = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [mode, isAuthenticated])

  useEffect(() => {
    if (mode !== 'landing' || isAuthenticated) return
    const ids: Array<'tools' | 'pricing' | 'faq'> = ['tools', 'pricing', 'faq']
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setLandingActiveSection(entry.target.id as 'tools' | 'pricing' | 'faq')
        })
      },
      { rootMargin: '-50% 0px -50% 0px' } // fires when a section crosses the vertical center of the viewport
    )
    const observed = new Set<HTMLElement>()
    // page.tsx renders a blank placeholder while it's still checking auth, so the #tools/#pricing/
    // #faq sections don't exist in the DOM yet when this effect first runs on mount - same timing
    // gap HomeScrollEffects.tsx already had to work around elsewhere. A MutationObserver picks them
    // up the moment the real homepage content swaps in, instead of observing an empty list forever.
    const tryObserve = () => {
      ids.forEach(id => {
        const el = document.getElementById(id)
        if (el && !observed.has(el)) {
          observed.add(el)
          observer.observe(el)
        }
      })
    }
    tryObserve()
    const mutationObserver = new MutationObserver(tryObserve)
    mutationObserver.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [mode, isAuthenticated])

  const showcasesAccess = getNavFeatureAccess(user?.plan_tier, 'showcases')
  const idxAccess = getNavFeatureAccess(user?.plan_tier, 'idx_website')
  const { listingAgentCount, hostCount } = useOpenHouseActionCounts()
  // + guests' disclosure / second-tour requests still waiting on the agent (10/25 - they're answered on Opens).
  const openRequestsCount = useOpenRequestsCount()
  const pendingHostRequestCount = listingAgentCount + hostCount + openRequestsCount
  const formsActionCount = useFormsActionCount()
  const showcasesActionCount = useShowcasesActionCount()
  const { anyMissing: settingsIncomplete } = useSettingsCompleteness()
  const supportUnreadCount = useSupportUnreadCount()
  const adminUnread = useAdminUnread()

  const isFullyExpired = !user?.is_admin && (user?.subscription_status === 'CANCELLED' || user?.subscription_status === 'EXPIRED') && !hasValidSubscription(user)
  const hasCoreAccess = (user?.is_admin || hasValidSubscription(user)) && !isFullyExpired

  const isActive = (path: string) => pathname === path

  // Once a day, remind agents on Basic/Premium (not No-MLS - their missing items are hidden
  // rather than shown-locked - and not IDX, which has nothing left to unlock) that locked nav
  // items are waiting for them. Dismissible for the day via localStorage, not intrusive.
  useEffect(() => {
    if (isCheckingAuth || !isAuthenticated || !user || user.is_admin) return
    if (!isMissingLadderFeatures(user.plan_tier)) return
    try {
      const today = todayLocal()
      if (localStorage.getItem(UPGRADE_REMINDER_STORAGE_KEY) === today) return
      localStorage.setItem(UPGRADE_REMINDER_STORAGE_KEY, today)
      showToast("You're missing out on features locked in your nav bar — tap a locked item to see what upgrading unlocks.", 'success')
    } catch {
      // Best-effort only - if localStorage is unavailable, just skip the reminder.
    }
  }, [isCheckingAuth, isAuthenticated, user, showToast])

  // Hover dropdown items - only shown once the nav item itself unlocks (no point linking deeper
  // into a feature that's still gated behind checkout/expiration). `feature` drives per-item
  // visibility/lock state via getNavFeatureAccess; omitted `feature` = always visible, unlocked.
  const openHousesSubNav: { href: string; label: string; icon: typeof Home; feature?: NavFeatureKey; iconClass?: string }[] = [
    { href: '/open-houses', label: 'My Opens', icon: Home },
    { href: '/discovery', label: 'Discovery', icon: Search, feature: 'discovery', iconClass: 'ohp-icon-assemble-search' },
    { href: '/open-houses/my-listings', label: 'Manager', icon: Building2, feature: 'my_listings' },
  ]
  const studioSubNav: { href: string; label: string; icon: ComponentType<{ className?: string }>; feature?: NavFeatureKey; iconClass?: string }[] = [
    { href: '/studio/site', label: 'Agent Hub', icon: Link2, feature: 'agent_hub' },
    { href: '/studio/forms', label: 'Forms & Invites', icon: ClipboardList, iconClass: 'ohp-icon-assemble-forms' },
    { href: '/studio/cma', label: 'CMA', icon: Calculator, feature: 'cma' },
    { href: '/studio/blogs', label: 'Blogs', icon: Newspaper, iconClass: 'ohp-icon-assemble-blog', feature: 'blogs' },
    { href: '/studio/design', label: 'Studio', icon: Palette, feature: 'design_studio' },
    { href: '/studio/media', label: 'Media Lab', icon: Clapperboard, iconClass: 'ohp-icon-assemble-clapper', feature: 'ai_media' },
    { href: '/studio/property-sites', label: 'Listing Spotlight', icon: SpotlightIcon, feature: 'listing_spotlight' },
    { href: '/studio/email-signature', label: 'Signature', icon: Mail, iconClass: 'ohp-icon-assemble-mail', feature: 'email_signature' },
    // The connect-a-service tools (their own row on the Tools page).
    { href: '/studio/integrations', label: 'CRM', icon: Plug, iconClass: 'ohp-icon-assemble-plug' },
    { href: '/studio/email', label: 'Email', icon: Send },
    { href: '/studio/calendar', label: 'Calendar', icon: CalendarClock, iconClass: 'ohp-icon-assemble-calendar' },
    { href: '/studio/reviews', label: 'Reviews', icon: Star, feature: 'reviews' },
  ]

  // Everything about the agent's people, under "Leads".
  const leadsSubNav: { href: string; label: string; icon: ComponentType<{ className?: string }>; iconClass?: string }[] = [
    { href: '/leads', label: 'Leads', icon: Users },
    { href: '/leads/emails', label: 'Email Tracker', icon: Mail, iconClass: 'ohp-icon-assemble-mail' },
    { href: '/leads/tasks', label: 'Follow-ups', icon: CalendarClock, iconClass: 'ohp-icon-assemble-calendar' },
    { href: '/activity', label: 'Activity', icon: ActivityIcon },
  ]

  // The phone menu (owner, 10/26): every section is a card with all of its pages as big buttons in
  // a two-column grid - the same layout as the admin panel's tabs - so nothing is a hover-only
  // dropdown away. Desktop keeps its hover menus above.
  type MobileTile = { href: string; label: string; icon: ComponentType<{ className?: string }>; badge?: number; alert?: boolean; locked?: boolean; soon?: boolean; on?: boolean; wide?: boolean }
  type MobileSection = { key: string; label: string; icon: ComponentType<{ className?: string }>; href: string; on: boolean; badge?: number; tiles: MobileTile[]; dimmed?: boolean }
  const gateHref = (href: string) => (!user?.is_admin && !hasValidSubscription(user) ? '/checkout' : href)
  const navTile = (item: { href: string; label: string; icon: ComponentType<{ className?: string }>; feature?: NavFeatureKey }, extra: Partial<MobileTile> = {}): MobileTile | null => {
    const access = item.feature ? getNavFeatureAccess(user?.plan_tier, item.feature) : { visible: true, locked: false, upgradeHref: '' }
    if (!access.visible) return null
    return { href: access.locked ? access.upgradeHref : gateHref(item.href), label: item.label, icon: item.icon, locked: access.locked, on: pathname === item.href, ...extra }
  }
  const isTile = (t: MobileTile | null): t is MobileTile => !!t
  const mobileSections: MobileSection[] = []
  if (user?.is_admin) {
    ADMIN_SECTIONS.forEach(sec => {
      const href = sec.key === 'overview' ? '/admin' : `/admin/${sec.key}`
      mobileSections.push({
        key: sec.key, label: sec.label, icon: sec.icon, href,
        on: sec.key === 'overview' ? pathname === '/admin' : pathname.startsWith(href),
        badge: sec.key === 'inbox' ? adminUnread.support + adminUnread.questions : 0,
        tiles: sec.tabs.length > 1 ? sec.tabs.map(t => ({
          href: adminHref(t.key), label: t.label, icon: t.icon, on: pathname === adminHref(t.key),
          badge: t.key === 'support' ? adminUnread.support : t.key === 'questions' ? adminUnread.questions : 0,
        })) : [],
      })
    })
  } else if (user?.broker_authorized) {
    const dim = isFullyExpired
    mobileSections.push({ key: 'dash', label: 'Dashboard', icon: LayoutDashboard, href: gateHref('/dash'), on: pathname === '/dash', tiles: [], dimmed: dim })
    mobileSections.push({
      key: 'opens', label: 'Open Houses', icon: Home, href: gateHref('/open-houses'), dimmed: dim,
      on: pathname.startsWith('/open-houses') || pathname.startsWith('/discovery'), badge: pendingHostRequestCount,
      tiles: hasCoreAccess ? openHousesSubNav.map(item => navTile(item, {
        badge: item.href === '/open-houses/my-listings' ? listingAgentCount : item.href === '/discovery' ? hostCount : openRequestsCount,
        wide: item.href === '/open-houses',
      })).filter(isTile) : [],
    })
    if (showcasesAccess.visible) {
      mobileSections.push({
        key: 'showcases', label: 'Showcases', icon: Layout, dimmed: dim, on: pathname === '/showcases', tiles: [],
        href: hasValidSubscription(user) && showcasesAccess.locked ? showcasesAccess.upgradeHref : gateHref('/showcases'),
        badge: showcasesAccess.locked ? 0 : showcasesActionCount,
      })
    }
    mobileSections.push({
      key: 'leads', label: 'Leads', icon: Users, href: gateHref('/leads'), dimmed: dim,
      on: pathname.startsWith('/leads') || pathname.startsWith('/activity'),
      tiles: hasCoreAccess ? [
        ...leadsSubNav.map(item => navTile(item, { on: item.href === '/leads' ? pathname === '/leads' : pathname === item.href, wide: item.href === '/leads' })).filter(isTile),
        { href: '', label: 'Action Plans', icon: ListChecks, soon: true },
      ] : [],
    })
    mobileSections.push({
      key: 'tools', label: 'Tools', icon: ToolCase, href: gateHref('/studio'), dimmed: dim, badge: formsActionCount,
      on: pathname.startsWith('/studio') && !pathname.startsWith('/studio/website'),
      tiles: hasCoreAccess ? [
        { href: gateHref('/studio/brand-kit'), label: 'Branding', icon: SwatchBook, on: pathname.startsWith('/studio/brand-kit') },
        ...studioSubNav.map(item => navTile(item, { badge: item.href === '/studio/forms' ? formsActionCount : 0, on: pathname.startsWith(item.href) })).filter(isTile),
        { href: '', label: 'Deadlines', icon: FileClock, soon: true },
      ] : [],
    })
    if (idxAccess.visible) {
      mobileSections.push({
        key: 'idx', label: 'IDX Website', icon: Globe, dimmed: dim, on: pathname.startsWith('/studio/website'), tiles: [],
        href: hasValidSubscription(user) && idxAccess.locked ? idxAccess.upgradeHref : gateHref('/studio/website'),
      })
    }
  }
  if (!user?.is_admin) {
    mobileSections.push({
      key: 'account', label: 'Account', icon: Settings, href: '/settings', on: false, tiles: [
        { href: '/setup', label: 'Account setup', icon: ClipboardCheck, on: pathname === '/setup' },
        { href: '/settings', label: 'Settings', icon: Settings, alert: settingsIncomplete, on: pathname.startsWith('/settings') && !pathname.startsWith('/settings/help') },
        { href: '/settings/help', label: 'Help', icon: HelpCircle, badge: supportUnreadCount, on: pathname.startsWith('/settings/help') },
      ],
    })
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      contextLogout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsLoggingOut(false)
      setIsMobileMenuOpen(false)
    }
  }

  // Close menu on navigation
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  return (
    // Bumped from a near-flat 1px/0.02-alpha shadow to real elevation (site-wide, not just the
    // homepage) plus a hairline gold bottom edge, to match the gold/depth theme the rest of the
    // site now uses instead of reading flatter than everything below it.
    <header className={`${mode === 'landing' ? 'sticky top-0' : 'relative'} z-50 bg-white dark:bg-[#0B0B0B] border-b border-[#C9A24D]/15 dark:border-[#C9A24D]/10 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] transition-colors duration-300 print:hidden`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3">
        <div className="flex items-center justify-between">
          {/* Logo - while logged in this normally would just bounce back to /dash (see the
              redirect guard in app/page.tsx), so it links to the homepage with an explicit
              `view=marketing` bypass instead; that guard still applies to any other way of
              landing on `/`, so the default post-login destination is unaffected. */}
          <Link href={isAuthenticated ? "/?view=marketing" : "/"} prefetch={true} className="flex items-center space-x-1.5 sm:space-x-2 hover:opacity-90 transition-all duration-300 group flex-shrink-0">
            {/* The OpenHousePal logo - animates in once when the page opens. Phones under 380px
                get just the house. */}
            <OhpHouse animate className="h-8 text-[#111827] dark:text-white min-[380px]:hidden" title="OpenHousePal" />
            <div className="hidden min-[380px]:flex items-center h-10 sm:h-11">
              <OhpWordmark animate className="text-[24px] sm:text-[28px] text-[#111827] dark:text-white" />
            </div>
          </Link>
          
          {/* Landing Page Navigation (Desktop Only) */}
          {mode === 'landing' && !isAuthenticated && (
            <nav className="hidden md:flex items-center space-x-1 absolute left-1/2 transform -translate-x-1/2">
              <button
                onClick={() => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' })}
                className="relative px-3 py-2 rounded-lg font-bold text-sm transition-all duration-200 text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Features
                {landingActiveSection === 'tools' && <motion.div layoutId="headerNavUnderline" className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
              </button>
              <button
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className="relative px-3 py-2 rounded-lg font-bold text-sm transition-all duration-200 text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Pricing
                {landingActiveSection === 'pricing' && <motion.div layoutId="headerNavUnderline" className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
              </button>
              <button
                onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })}
                className="relative px-3 py-2 rounded-lg font-bold text-sm transition-all duration-200 text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                FAQ
                {landingActiveSection === 'faq' && <motion.div layoutId="headerNavUnderline" className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
              </button>
            </nav>
          )}

          {/* Right Side Actions */}
          <div className="flex items-center space-x-1 sm:space-x-3">
            {/* Logged In View */}
            {!isCheckingAuth && isAuthenticated && (
              <div className="flex items-center space-x-1 sm:space-x-3">
                <IncompleteSettingsModal />
                {/* Mobile Only: Priority icons before hamburger */}
                <div className="flex items-center space-x-1 sm:hidden">
                  <NotificationBell />
                  <ThemeToggle />
                </div>
                
                {/* Desktop Menu */}
                <div className="hidden xl:flex items-center space-x-1 sm:space-x-3">
                {/* Admin: each big area is its own tab, with its pages in a hover menu (lib/adminNav.ts). */}
                {user?.is_admin && ADMIN_SECTIONS.map(sec => {
                  const href = sec.key === 'overview' ? '/admin' : `/admin/${sec.key}`
                  const on = sec.key === 'overview' ? pathname === '/admin' : pathname.startsWith(href)
                  const badge = sec.key === 'inbox' ? adminUnread.support + adminUnread.questions : 0
                  return (
                    <div key={sec.key} className="relative group/adm">
                      <Link
                        href={href}
                        className="relative px-2.5 lg:px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <sec.icon className={`w-4 h-4 mr-2 ohp-icon-draw ${on ? 'text-[#C9A24D]' : 'text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white'}`} />
                        <span>{sec.label}</span>
                        {badge > 0 && (
                          <span className="ml-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">{badge > 9 ? '9+' : badge}</span>
                        )}
                        {sec.tabs.length > 1 && <ChevronDown className="ml-1 w-3 h-3 text-gray-400 transition-transform duration-200 group-hover/adm:rotate-180" />}
                        {on && <motion.div layoutId="headerNavUnderline" className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                        <span className="ohp-grow-underline" style={{ '--ohp-grow-w': 'calc(100% - 1.5rem)' } as CSSProperties} />
                      </Link>
                      {sec.tabs.length > 1 && (
                        <div className="invisible absolute left-0 top-full z-[60] w-56 pt-2 opacity-0 transition-all duration-150 group-hover/adm:visible group-hover/adm:opacity-100">
                          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151517] p-1.5 shadow-2xl">
                            {sec.tabs.map(t => {
                              const tHref = adminHref(t.key)
                              const tOn = pathname === tHref
                              const n = t.key === 'support' ? adminUnread.support : t.key === 'questions' ? adminUnread.questions : 0
                              return (
                                <Link key={t.key} href={tHref}
                                  className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${tOn ? 'text-[#C9A24D] bg-[#C9A24D]/10' : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                  <t.icon className={`ohp-icon-draw w-4 h-4 ${tOn ? 'text-[#C9A24D]' : 'text-gray-400'}`} />
                                  <span className="flex-1"><span className="ohp-underline-text">{t.label}</span></span>
                                  {n > 0 && <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">{n > 9 ? '9+' : n}</span>}
                                </Link>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {!user?.is_admin && (
                !user?.broker_authorized ? (
                  <Link
                    href="/broker-authorization"
                    className="relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <ShieldCheck className="w-4 h-4 mr-2 text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white ohp-icon-draw" />
                    <span>Broker Authorization</span>
                    {isActive('/broker-authorization') && <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full"></div>}
                    <span className="ohp-grow-underline" style={{ '--ohp-grow-w': 'calc(100% - 1.5rem)' } as CSSProperties} />
                  </Link>
                ) : (
                  <>
                    <Link
                      href={
                        !user?.is_admin && !hasValidSubscription(user) ? "/checkout" :
                        "/dash"
                      }
                      className={`relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 ${isFullyExpired ? 'pointer-events-none opacity-50 grayscale' : ''}`}
                    >
                      <LayoutDashboard className="ohp-icon-assemble-dash w-4 h-4 mr-2 text-gray-400 transition-[color,filter] duration-300 group-hover:text-[#111827] dark:group-hover:text-white group-hover:drop-shadow-[0_2px_6px_rgba(201,162,77,0.55)]" />
                      <span>Dash</span>
                      {isActive('/dash') && <motion.div layoutId="headerNavUnderline" className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                      <span className="ohp-grow-underline" style={{ '--ohp-grow-w': 'calc(100% - 1.5rem)' } as CSSProperties} />
                    </Link>

                    <div className="relative group/opens">
                      <Link
                        href={
                          !user?.is_admin && !hasValidSubscription(user) ? "/checkout" :
                          "/open-houses"
                        }
                        className={`relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 ${isFullyExpired ? 'pointer-events-none opacity-50 grayscale' : ''}`}
                      >
                        <Home className="w-4 h-4 mr-2 text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white ohp-icon-draw" />
                        <span>Opens</span>
                        {pendingHostRequestCount > 0 && (
                          <span
                            title={`${pendingHostRequestCount} waiting on you${openRequestsCount ? ` (${openRequestsCount} guest request${openRequestsCount === 1 ? '' : 's'})` : ''}`}
                            className="ml-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white"
                          >
                            {pendingHostRequestCount > 9 ? '9+' : pendingHostRequestCount}
                          </span>
                        )}
                        <ChevronDown className="ml-1 w-3 h-3 text-gray-400 transition-transform duration-200 group-hover/opens:rotate-180" />
                        {(pathname.startsWith('/open-houses') || pathname.startsWith('/discovery')) && <motion.div layoutId="headerNavUnderline" className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                        <span className="ohp-grow-underline" style={{ '--ohp-grow-w': 'calc(100% - 1.5rem)' } as CSSProperties} />
                      </Link>
                      {hasCoreAccess && (
                        <div className="invisible absolute left-0 top-full z-[60] w-52 pt-2 opacity-0 transition-all duration-150 group-hover/opens:visible group-hover/opens:opacity-100">
                          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151517] p-1.5 shadow-2xl">
                            {openHousesSubNav.map(item => {
                              const access = item.feature ? getNavFeatureAccess(user?.plan_tier, item.feature) : { visible: true, locked: false, upgradeHref: '' }
                              if (!access.visible) return null
                              // Same counts driving the "Opens" tab's own badge, broken out per
                              // sub-item so hovering shows exactly where the pending item lives -
                              // My Listings = requests waiting on my approve/decline, Discovery =
                              // my own outgoing requests waiting on a reply.
                              const itemBadgeCount = item.href === '/open-houses/my-listings' ? listingAgentCount
                                : item.href === '/discovery' ? hostCount
                                : item.href === '/open-houses' ? openRequestsCount
                                : 0
                              return (
                                <Link
                                  key={item.href}
                                  href={access.locked ? access.upgradeHref : item.href}
                                  title={itemBadgeCount > 0 ? `${itemBadgeCount} pending` : undefined}
                                  className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                                    access.locked
                                      ? 'text-gray-400 dark:text-gray-600 opacity-70 hover:opacity-100'
                                      : isActive(item.href)
                                        ? 'text-[#C9A24D] bg-[#C9A24D]/10'
                                        : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                                  }`}
                                >
                                  <item.icon className={`ohp-icon-draw ${item.iconClass || ''} w-4 h-4 ${access.locked ? 'text-gray-300 dark:text-gray-700' : isActive(item.href) ? 'text-[#C9A24D]' : 'text-gray-400'}`} />
                                  <span className="flex-1"><span className="ohp-underline-text">{item.label}</span></span>
                                  {access.locked ? (
                                    <Lock className="ml-auto w-3.5 h-3.5 text-gray-300 dark:text-gray-700" />
                                  ) : itemBadgeCount > 0 ? (
                                    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                                      {itemBadgeCount > 9 ? '9+' : itemBadgeCount}
                                    </span>
                                  ) : null}
                                </Link>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {showcasesAccess.visible && (
                    <Link
                      href={
                        !user?.is_admin && !hasValidSubscription(user) ? "/checkout" :
                        !user?.is_admin && showcasesAccess.locked ? showcasesAccess.upgradeHref :
                        "/showcases"
                      }
                      className={`relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group ${
                        showcasesAccess.locked
                          ? 'text-gray-400 dark:text-gray-600 opacity-60 hover:opacity-100'
                          : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                      } ${isFullyExpired ? 'pointer-events-none opacity-50 grayscale' : ''}`}
                    >
                      <Layout className={`w-4 h-4 mr-2 ${showcasesAccess.locked ? 'text-gray-300 dark:text-gray-700' : 'text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white ohp-icon-draw'}`} />
                      <span>Showcases</span>
                      {showcasesAccess.locked && <Lock className="w-3.5 h-3.5 ml-1.5 text-gray-300 dark:text-gray-700" />}
                      {!showcasesAccess.locked && showcasesActionCount > 0 && (
                        <span className="ml-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                          {showcasesActionCount > 9 ? '9+' : showcasesActionCount}
                        </span>
                      )}
                      {isActive('/showcases') && <motion.div layoutId="headerNavUnderline" className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                    </Link>
                    )}

                    <div className="relative group/leads">
                      <Link
                        href={
                          !user?.is_admin && !hasValidSubscription(user) ? "/checkout" :
                          "/leads"
                        }
                        className={`relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 ${isFullyExpired ? 'pointer-events-none opacity-50 grayscale' : ''}`}
                      >
                        <Users className="w-4 h-4 mr-2 text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white ohp-icon-draw" />
                        <span>Leads</span>
                        <ChevronDown className="ml-1 w-3 h-3 text-gray-400 transition-transform duration-200 group-hover/leads:rotate-180" />
                        {(pathname.startsWith('/leads') || pathname.startsWith('/activity')) && <motion.div layoutId="headerNavUnderline" className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                        <span className="ohp-grow-underline" style={{ '--ohp-grow-w': 'calc(100% - 1.5rem)' } as CSSProperties} />
                      </Link>
                      {hasCoreAccess && (
                        <div className="invisible absolute left-0 top-full z-[60] w-52 pt-2 opacity-0 transition-all duration-150 group-hover/leads:visible group-hover/leads:opacity-100">
                          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151517] p-1.5 shadow-2xl">
                            {leadsSubNav.map(item => {
                              const on = item.href === '/leads' ? pathname === '/leads' : isActive(item.href)
                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                                    on
                                      ? 'text-[#C9A24D] bg-[#C9A24D]/10'
                                      : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                                  }`}
                                >
                                  <item.icon className={`ohp-icon-draw ${item.iconClass || ''} w-4 h-4 ${on ? 'text-[#C9A24D]' : 'text-gray-400'}`} />
                                  <span className="ohp-underline-text">{item.label}</span>
                                </Link>
                              )
                            })}
                            {/* Coming soon (launch checklist → Future Feature Ideas): a series of follow-ups over weeks. Not a link yet. */}
                            <div aria-disabled title="Action Plans - coming soon: a series of follow-ups over weeks (day 1, 3, 7, 30) for each new lead"
                              className="flex cursor-default items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-400 dark:text-gray-500">
                              <ListChecks className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                              <span>Action Plans</span>
                              <span className="ml-auto rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-1.5 text-[9px] font-black uppercase leading-4 tracking-wide text-[#111827]">Soon</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* "Studio" (the nav hub that lists every tool) renamed to "Tools" per explicit
                        ask - "Studio" now only refers to the Design Studio tool itself, which was
                        separately renamed to just "Studio" throughout its own card/page. */}
                    <div className="relative group/studio">
                      <Link
                        href={
                          !user?.is_admin && !hasValidSubscription(user) ? "/checkout" :
                          "/studio"
                        }
                        className={`relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 ${isFullyExpired ? 'pointer-events-none opacity-50 grayscale' : ''}`}
                      >
                        <ToolCase className="w-4 h-4 mr-2 text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white ohp-icon-draw ohp-icon-assemble-tools" />
                        <span>Tools</span>
                        {formsActionCount > 0 && (
                          <span className="ml-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                            {formsActionCount > 9 ? '9+' : formsActionCount}
                          </span>
                        )}
                        <ChevronDown className="ml-1 w-3 h-3 text-gray-400 transition-transform duration-200 group-hover/studio:rotate-180" />
                        {pathname.startsWith('/studio') && !pathname.startsWith('/studio/website') && <motion.div layoutId="headerNavUnderline" className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                        <span className="ohp-grow-underline" style={{ '--ohp-grow-w': 'calc(100% - 1.5rem)' } as CSSProperties} />
                      </Link>
                      {hasCoreAccess && (
                        <div className="invisible absolute left-0 top-full z-[60] w-52 pt-2 opacity-0 transition-all duration-150 group-hover/studio:visible group-hover/studio:opacity-100">
                          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151517] p-1.5 shadow-2xl">
                            {studioSubNav.map(item => {
                              const access = item.feature ? getNavFeatureAccess(user?.plan_tier, item.feature) : { visible: true, locked: false, upgradeHref: '' }
                              if (!access.visible) return null
                              return (
                                <Link
                                  key={item.href}
                                  href={access.locked ? access.upgradeHref : item.href}
                                  className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                                    access.locked
                                      ? 'text-gray-400 dark:text-gray-600 opacity-70 hover:opacity-100'
                                      : isActive(item.href)
                                        ? 'text-[#C9A24D] bg-[#C9A24D]/10'
                                        : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                                  }`}
                                >
                                  <item.icon className={`ohp-icon-draw ${item.iconClass || ''} w-4 h-4 ${access.locked ? 'text-gray-300 dark:text-gray-700' : isActive(item.href) ? 'text-[#C9A24D]' : 'text-gray-400'}`} />
                                  <span className="ohp-underline-text">{item.label}</span>
                                  {item.href === '/studio/forms' && formsActionCount > 0 && (
                                    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                                      {formsActionCount > 9 ? '9+' : formsActionCount}
                                    </span>
                                  )}
                                  {access.locked && <Lock className="ml-auto w-3.5 h-3.5 text-gray-300 dark:text-gray-700" />}
                                </Link>
                              )
                            })}
                            {/* Coming soon (launch checklist -> Future Feature Ideas), same as Leads' Action Plans row. Not a link yet. */}
                            <div aria-disabled title="Deadlines - coming soon: upload the agreement of sale and AI adds every contract deadline to your calendar"
                              className="flex cursor-default items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-400 dark:text-gray-500">
                              <FileClock className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                              <span>Deadlines</span>
                              <span className="ml-auto rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-1.5 text-[9px] font-black uppercase leading-4 tracking-wide text-[#111827]">Soon</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {idxAccess.visible && (
                    <Link
                      href={
                        !user?.is_admin && !hasValidSubscription(user) ? "/checkout" :
                        !user?.is_admin && idxAccess.locked ? idxAccess.upgradeHref :
                        "/studio/website"
                      }
                      className={`relative px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center group ${
                        idxAccess.locked
                          ? 'text-gray-400 dark:text-gray-600 opacity-60 hover:opacity-100'
                          : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                      } ${isFullyExpired ? 'pointer-events-none opacity-50 grayscale' : ''}`}
                    >
                      <Globe className={`ohp-icon-draw w-4 h-4 mr-2 transition-[color,filter] duration-300 ${idxAccess.locked ? 'text-gray-300 dark:text-gray-700' : 'text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white group-hover:drop-shadow-[0_2px_6px_rgba(201,162,77,0.55)]'}`} />
                      <span>IDX</span>
                      {idxAccess.locked && <Lock className="w-3.5 h-3.5 ml-1.5 text-gray-300 dark:text-gray-700" />}
                      {pathname.startsWith('/studio/website') && <motion.div layoutId="headerNavUnderline" className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C9A24D] rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                      <span className="ohp-grow-underline" style={{ '--ohp-grow-w': 'calc(100% - 1.5rem)' } as CSSProperties} />
                    </Link>
                    )}
                  </>
                ))}

                  {/* Help, Settings, notifications and theme grouped together after one divider -
                      icon-only (no text label) so they read as compact utility controls next to
                      the bell/theme toggle instead of competing for space as full nav tabs like
                      Dash/Opens/Leads. Neither Help nor Settings applies to an admin account -
                      there's no subscription/profile to manage and no reason for an admin to file
                      a support ticket to themself - so both are hidden entirely rather than left
                      inert. */}
                  <div className="flex items-center space-x-1 px-2 border-l border-gray-100 dark:border-gray-800 ml-2">
                    {/* Account setup - the step-by-step setup flow, reopened at the first unfinished step
                        (or wherever they pick) any time (owner, 10/22). */}
                    {!user?.is_admin && (
                    <Link
                        href="/setup"
                        title="Account setup"
                        aria-label="Account setup"
                        className="relative p-2 rounded-lg transition-all duration-200 flex items-center group text-gray-500 dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <ClipboardCheck className="w-4 h-4 ohp-icon-draw" />
                      </Link>
                    )}

                    {!user?.is_admin && (
                    <Link
                        href="/settings/help"
                        title="Help"
                        className={`relative p-2 rounded-lg transition-all duration-200 flex items-center group ${
                          pathname.startsWith('/settings/help')
                            ? 'text-[#C9A24D]'
                            : 'text-gray-500 dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <HelpCircle className="w-4 h-4 ohp-icon-draw" />
                        {supportUnreadCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5" aria-label="Unread support reply">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white dark:border-[#151517]" />
                          </span>
                        )}
                      </Link>
                    )}

                    {!user?.is_admin && (
                    <Link
                        href="/settings"
                        title="Settings"
                        className={`relative p-2 rounded-lg transition-all duration-200 flex items-center group ${
                          pathname.startsWith('/settings') && !pathname.startsWith('/settings/help')
                            ? 'text-[#C9A24D]'
                            : 'text-gray-500 dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <Settings className="w-4 h-4 ohp-icon-draw" />
                        {settingsIncomplete && (
                          <AlertCircle className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 fill-red-500 text-white" aria-label="Settings incomplete" />
                        )}
                      </Link>
                    )}

                    <NotificationBell />
                    <ThemeToggle />
                  </div>

                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    title="Logout"
                    aria-label="Logout"
                    className="group px-3 py-2 text-[#6B7280] dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 font-bold text-xs uppercase tracking-widest transition-all duration-200 flex items-center disabled:opacity-50"
                  >
                    <LogOut className="ohp-icon-draw w-4 h-4 2xl:mr-2" />
                    <span className="hidden 2xl:inline">{isLoggingOut ? '...' : 'Logout'}</span>
                  </button>
                </div>

                {/* Mobile Hamburger */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2 rounded-lg text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all focus:outline-none xl:hidden"
                  aria-label="Toggle Menu"
                >
                  {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            )}

            {/* Landing/Public Actions */}
            {!isCheckingAuth && !isAuthenticated && (
              <div className="flex shrink-0 items-center space-x-0.5 sm:space-x-2">
                <ThemeToggle />
                <Link
                  href="/login"
                  className="text-[#111827] dark:text-white font-black text-[13px] sm:text-sm px-1.5 sm:px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="px-2.5 sm:px-5 py-2 sm:py-2.5 text-[13px] sm:text-sm bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-black hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:shadow-xl transition-all duration-300 whitespace-nowrap"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Page-progress fill - only on the logged-out homepage, where there's a whole multi-screen
          page below the fold worth signaling. Sits right on the header's existing bottom hairline
          rather than adding a second bar, growing left-to-right as you scroll down. */}
      {mode === 'landing' && !isAuthenticated && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-transparent pointer-events-none overflow-hidden">
          <div
            className="h-full w-full origin-left bg-gradient-to-r from-[#C9A24D] to-[#b38e3e]"
            style={{ transform: `scaleX(${scrollProgress})` }}
          />
        </div>
      )}

      {/* Mobile Menu - a full-height sheet: each section a card, its pages a two-column grid. */}
      <AnimatePresence>
      {isMobileMenuOpen && (
        <motion.div key="phone-menu" data-scroll-lock="on" className="fixed inset-0 z-[10000] xl:hidden"
          initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2, ease: 'easeOut' } }}>
          <div className="absolute inset-0 bg-black/55" onClick={() => setIsMobileMenuOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="absolute inset-x-2.5 top-2.5 bottom-2.5 flex flex-col overflow-hidden rounded-[28px] bg-[#f6f4ef] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.55)] ring-1 ring-black/5 dark:bg-[#0B0B0B] dark:ring-white/10 sm:inset-x-auto sm:right-4 sm:w-[440px]"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#C9A24D]/15 bg-white px-4 py-3 dark:bg-[#111113]">
              <div className="flex min-w-0 items-center gap-3">
                <OhpHouse className="h-8 shrink-0 text-[#111827] dark:text-white" title="OpenHousePal" />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8b6a2b] dark:text-[#e8c97a]">{user?.is_admin ? 'Admin menu' : 'Menu'}</p>
                  <p className="truncate text-[15px] font-black text-[#111827] dark:text-white">{[user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email}</p>
                </div>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-600 transition hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
              {!user?.is_admin && !user?.broker_authorized && (
                <Link href="/broker-authorization" onClick={menuGo('/broker-authorization')}
                  className={`flex items-center gap-3 rounded-3xl border bg-white p-3 shadow-[0_8px_24px_-14px_rgba(17,24,39,0.25)] dark:bg-[#151517] ${isActive('/broker-authorization') ? 'border-[#C9A24D]' : 'border-gray-200/80 dark:border-gray-800'}`}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#C9A24D]/15 text-[#8b6a2b] dark:text-[#e8c97a]"><ShieldCheck className="h-5 w-5" /></span>
                  <span className="flex-1 text-[17px] font-black text-[#111827] dark:text-white">Broker Authorization</span>
                </Link>
              )}

              {mobileSections.map(sec => (
                <section key={sec.key}
                  className={`rounded-3xl border bg-white p-2.5 shadow-[0_8px_24px_-14px_rgba(17,24,39,0.25)] dark:bg-[#151517] ${sec.on ? 'border-[#C9A24D]/60' : 'border-gray-200/80 dark:border-gray-800'} ${sec.dimmed ? 'pointer-events-none opacity-50 grayscale' : ''}`}>
                  {sec.tiles.length > 0 ? (
                    <button type="button" aria-expanded={openSection === sec.key} onClick={() => setOpenSection(o => (o === sec.key ? null : sec.key))}
                      className="flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-1.5 py-1">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${sec.on ? 'bg-[#111827] text-[#e8c97a] dark:bg-[#C9A24D] dark:text-[#111827]' : 'bg-[#C9A24D]/15 text-[#8b6a2b] dark:text-[#e8c97a]'}`}>
                      <sec.icon className="h-5 w-5" />
                    </span>
                    <span className={`flex-1 text-left text-[17px] font-black tracking-tight ${sec.on ? 'text-[#a8803a] dark:text-[#e8c97a]' : 'text-[#111827] dark:text-white'}`}>{sec.label}</span>
                    {!!sec.badge && sec.badge > 0 && (
                      <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-black text-white">{sec.badge > 9 ? '9+' : sec.badge}</span>
                    )}
                      <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${openSection === sec.key ? 'rotate-180' : ''}`} />
                    </button>
                  ) : (
                    <Link href={sec.href} onClick={menuGo(sec.href)} className={`flex min-h-[48px] items-center gap-3 rounded-2xl px-1.5 py-1 transition ${menuGoing === sec.href ? 'bg-[#C9A24D]/10' : ''}`}>
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${sec.on ? 'bg-[#111827] text-[#e8c97a] dark:bg-[#C9A24D] dark:text-[#111827]' : 'bg-[#C9A24D]/15 text-[#8b6a2b] dark:text-[#e8c97a]'}`}>
                      <sec.icon className="h-5 w-5" />
                    </span>
                    <span className={`flex-1 text-left text-[17px] font-black tracking-tight ${sec.on ? 'text-[#a8803a] dark:text-[#e8c97a]' : 'text-[#111827] dark:text-white'}`}>{sec.label}</span>
                    {!!sec.badge && sec.badge > 0 && (
                      <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-black text-white">{sec.badge > 9 ? '9+' : sec.badge}</span>
                    )}
                      {menuGoing === sec.href && <Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" />}
                    </Link>
                  )}
                  <AnimatePresence initial={false}>
                  {sec.tiles.length > 0 && openSection === sec.key && (
                    <motion.div key="tiles" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ height: { type: 'spring', stiffness: 420, damping: 38 }, opacity: { duration: 0.18 } }} className="overflow-hidden">
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {sec.tiles.map(t => {
                        const inner = (
                          <>
                            <t.icon className={`h-[18px] w-[18px] shrink-0 ${t.locked || t.soon ? 'text-gray-300 dark:text-gray-600' : 'text-[#C9A24D]'}`} />
                            <span className="min-w-0 flex-1 leading-tight">
                              {t.label}
                              {t.soon && <span className="mt-0.5 block text-[10px] font-black uppercase tracking-wider text-[#C9A24D]">Coming soon</span>}
                            </span>
                            {t.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600" />}
                            {!t.locked && !!t.badge && t.badge > 0 && (
                              <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">{t.badge > 9 ? '9+' : t.badge}</span>
                            )}
                            {t.alert && <AlertCircle className="h-4 w-4 shrink-0 fill-red-500 text-white" aria-label="Needs attention" />}
                          </>
                        )
                        const cls = `${t.wide ? 'col-span-2 ' : ''}flex min-h-[52px] items-center gap-2.5 rounded-2xl border px-3 py-2 text-[14px] font-bold transition-colors ${
                          t.on ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#a8803a] shadow-sm dark:bg-[#C9A24D]/15 dark:text-[#e8c97a]'
                            : t.locked || t.soon ? 'border-gray-100 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-500'
                              : 'border-gray-200 bg-[#faf9f7] text-[#111827] active:bg-[#C9A24D]/10 dark:border-gray-800 dark:bg-white/[0.04] dark:text-gray-100'
                        }`
                        return t.soon
                          ? <div key={t.label} aria-disabled className={`${cls} cursor-default`}>{inner}</div>
                          : <Link key={t.href + t.label} href={t.href} onClick={menuGo(t.href)} className={`${cls} ${menuGoing === t.href ? 'border-[#C9A24D] bg-[#C9A24D]/10' : ''}`}>{inner}</Link>
                      })}
                    </div>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </section>
              ))}
            </div>

            <div className="shrink-0 border-t border-gray-200/80 bg-white px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] dark:border-gray-800 dark:bg-[#111113]">
              <button
                onClick={handleLogout}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 text-[15px] font-black text-red-600 transition hover:bg-red-50 dark:border-red-500/25 dark:text-red-400 dark:hover:bg-red-900/10"
              >
                <LogOut className="h-5 w-5" />
                <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </header>
  )
}
