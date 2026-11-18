'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import Link from 'next/link'
import {
  ArrowDown, ArrowRight, Award, BadgeDollarSign, BookOpen, Briefcase, CalendarCheck, CalendarDays, Camera, ChartColumn, Check, CircleCheck,
  ClipboardList, DoorOpen, Download, FileDown, Filter, Globe, Heart, House, Images, Inbox, LayoutGrid, Link2, ListChecks, MapPin, Megaphone,
  MessageCircleQuestion, Palette, PencilLine, PenTool, Plug, Printer, QrCode, RefreshCw, Rocket, Search, Send, Share2, SlidersHorizontal,
  Smartphone, Sparkles, Star, Target, Upload, UserCheck, Users, WandSparkles,
} from 'lucide-react'
import { Question } from '@/components/marketing/FaqExplorer'
import { FEATURE_TABS, type FeatureTabKey } from '@/components/home/featureTabsData'
import { HOME_CSS } from '@/components/home/homeCss'
import ToolTabs from '@/components/home/ToolTabs'
import { usePlayWhenSeen } from '@/components/CalmLoops'
import { TOOL_PAGES } from '@/components/marketing/toolPagesData'

// The Tools page works like the homepage's tools section (owner, 11/05): one spot, and picking a tool
// swaps the animation in place. That tool's details fill in underneath, so there's no long page of
// every tool and no separate page to open. A tool's own address (/tools/cma) opens this same page on
// that tool, with its words in the page for Google.
export default function ToolsExplorer({ initial = 'signin' }: { initial?: FeatureTabKey }) {
  const [active, setActive] = useState<FeatureTabKey>(initial)
  const tool = FEATURE_TABS.find(t => t.key === active)!
  const page = TOOL_PAGES.find(t => t.demo === active)
  const Demo = tool.Demo
  const stage = useRef<HTMLDivElement>(null)
  const live = usePlayWhenSeen(stage, { keepWhileWatched: true })
  const box = useRef<HTMLDivElement>(null)
  const height = useRef(0)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { if (el.offsetHeight) height.current = el.offsetHeight })
    ro.observe(el)
    return () => ro.disconnect()
  }, [active])

  // A link straight to a tool (/tools#cma) lands on it.
  useEffect(() => {
    const key = window.location.hash.slice(1)
    if (FEATURE_TABS.some(t => t.key === key)) setActive(key as FeatureTabKey)
  }, [])

  const pick = (key: FeatureTabKey) => {
    setActive(key)
    // (a hash, not a new address: the page never reloads, only the spot changes)
    window.history.replaceState(window.history.state, '', `#${key}`)
    if (window.innerWidth >= 1024) return
    requestAnimationFrame(() => {
      const el = stage.current
      if (!el) return
      const header = document.querySelector('header')?.getBoundingClientRect().height ?? 0
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - header - 8, behavior: 'smooth' })
    })
  }

  return (
    <div className="mt-8 sm:mt-10">
      <style dangerouslySetInnerHTML={{ __html: HOME_CSS }} />
      <div className="grid grid-cols-1 items-start gap-x-12 gap-y-5 lg:grid-cols-2">
        <div className="order-2 min-w-0 lg:order-1">
          <ToolTabs active={active} onPick={pick} />
          <p key={tool.key} className="mt-5 animate-fadeIn text-center text-base font-medium leading-relaxed text-[#4b5563] dark:text-gray-300 lg:text-left">{tool.blurb}</p>
        </div>
        <div ref={stage} className="relative order-1 min-w-0 lg:order-2 max-sm:-mx-2" data-testid="tool-stage">
          <div key={tool.key} className="relative z-10 animate-fadeIn" data-testid="tool-demo">
            <div ref={box}>{live ? <Demo /> : <div aria-hidden style={{ height: height.current || 520 }} />}</div>
          </div>
        </div>
      </div>

      {page && (
        <section key={page.slug} className="mk-rise mt-12 border-t border-gray-200 pt-10 dark:border-white/10 sm:mt-16" data-testid="tool-details">
          <p className="text-sm font-black text-[#8b7355] dark:text-[#e8c97a]">{page.plans} <Link href="/pricing" className="underline underline-offset-2">See plans</Link></p>
          <h2 className="mt-2 font-serif text-3xl font-black tracking-tight text-[#0B0B0B] dark:text-white sm:text-4xl">{page.title}</h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {page.why.map(w => (
              <article key={w.title} className="mk-card rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#151517]">
                <h3 className="flex items-start gap-2 text-lg font-black text-[#111827] dark:text-white"><Check className="mt-1 h-4 w-4 shrink-0 text-[#C9A24D]" strokeWidth={3} /> {w.title}</h3>
                <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{w.text}</p>
              </article>
            ))}
          </div>

          <h3 className="mt-12 text-center font-serif text-2xl font-black text-[#0B0B0B] dark:text-white sm:text-3xl lg:text-left">How it works</h3>
          <HowItWorks slug={page.slug} steps={page.steps} />

          <h3 className="mt-12 text-center font-serif text-2xl font-black text-[#0B0B0B] dark:text-white sm:text-3xl lg:text-left">Common questions</h3>
          <div className="mt-5 space-y-3 lg:max-w-3xl">
            {page.faqs.map((f, i) => <Question key={f.q} faq={f} startOpen={i === 0} />)}
          </div>
          {page.article && <p className="mt-4 text-sm font-black text-[#8b7355] dark:text-[#e8c97a]"><Link href={page.article.href} className="underline underline-offset-4">{page.article.href.startsWith('/resources') ? `Read: ${page.article.label}` : page.article.label}</Link></p>}
        </section>
      )}
    </div>
  )
}

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>

// One picture per step, in the same order as each tool's steps in toolPagesData (owner 11/18: the
// numbered boxes were plain text). A step without one here gets a check mark.
const STEP_ICONS: Record<string, Icon[]> = {
  'open-house-sign-in': [House, QrCode, Smartphone, Users],
  cma: [House, ChartColumn, BadgeDollarSign, FileDown],
  showcases: [SlidersHorizontal, Send, Heart, CalendarCheck],
  'agent-hub': [Camera, Palette, Link2, Share2],
  'open-house-kits': [MapPin, Images, Printer, DoorOpen],
  forms: [ClipboardList, PencilLine, QrCode, Inbox],
  'email-signature': [PenTool, Plug, Send, RefreshCw],
  discovery: [Target, Filter, Send, ListChecks],
  'open-house-manager': [LayoutGrid, Inbox, UserCheck, ChartColumn],
  studio: [Megaphone, House, Palette, Download],
  'media-lab': [Upload, WandSparkles, Images, Download],
  blogs: [MessageCircleQuestion, Search, BookOpen, Globe],
  'listing-spotlight': [House, Sparkles, PencilLine, QrCode],
  'calendar-crm-sync': [CalendarDays, Plug, Briefcase, CircleCheck],
  'review-hub': [Link2, Send, Star, Award],
  'idx-website': [Palette, MapPin, Rocket, Globe],
}

/** "How it works": phones get one centered column, each step a single row (number, picture, words)
 *  with an arrow down to the next; computers get the same steps side by side with arrows across. */
function HowItWorks({ slug, steps }: { slug: string; steps: string[] }) {
  const icons = STEP_ICONS[slug] || []
  return (
    <ol className="mx-auto mt-6 flex max-w-md flex-col items-stretch lg:mx-0 lg:max-w-none lg:flex-row lg:items-stretch" data-testid="how-it-works">
      {steps.map((s, i) => {
        const StepIcon = icons[i] || Check
        return (
          <Fragment key={s}>
            {i > 0 && (
              <li aria-hidden className="flex shrink-0 items-center justify-center py-1.5 text-[#C9A24D] lg:px-2 lg:py-0">
                <ArrowDown className="h-5 w-5 lg:hidden" strokeWidth={2.5} />
                <ArrowRight className="hidden h-5 w-5 lg:block" strokeWidth={2.5} />
              </li>
            )}
            <li className="mk-card relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-[#111827] to-[#1f1a10] p-3.5 text-white shadow-[0_18px_36px_-24px_rgba(17,24,39,.9)] ring-1 ring-[#C9A24D]/25 lg:flex-col lg:items-start lg:gap-3 lg:p-5">
              <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[radial-gradient(closest-side,rgba(201,162,77,.22),transparent)]" />
              <span className="flex shrink-0 items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] font-serif text-[15px] font-black text-[#111827]">{i + 1}</span>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.07] text-[#e8c97a] ring-1 ring-white/10">
                  <StepIcon className="h-5 w-5" strokeWidth={2} />
                </span>
              </span>
              <p className="relative min-w-0 text-[15px] font-bold leading-snug lg:text-base">{s}</p>
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
