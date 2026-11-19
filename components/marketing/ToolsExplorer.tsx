'use client'

import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import Link from 'next/link'
import {
  Award, BadgeDollarSign, BookOpen, Briefcase, CalendarCheck, CalendarDays, Camera, ChartColumn, Check, CircleCheck,
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

          {/* Owner 11/18: two per row, each with a picture-like numbered tile (was plain text cards, 3 + a lone 4th). */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {page.why.map((w, i) => (
              <article key={w.title} className={`mk-card group relative flex gap-4 overflow-hidden rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#151517] sm:p-6 ${page.why.length % 2 && i === page.why.length - 1 ? 'sm:col-span-2' : ''}`}>
                <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[radial-gradient(closest-side,rgba(201,162,77,.16),transparent)]" />
                <span className="mk-icon relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827] shadow-[0_10px_22px_-12px_rgba(139,106,43,.9)]">
                  <Check className="h-5 w-5" strokeWidth={3} />
                  <span className="absolute -bottom-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#111827] px-1 text-[10px] font-black text-[#e8c97a] ring-2 ring-white dark:ring-[#151517]">{i + 1}</span>
                </span>
                <span className="relative min-w-0">
                  <h3 className="text-lg font-black leading-snug text-[#111827] dark:text-white">{w.title}</h3>
                  <p className="mt-1 text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{w.text}</p>
                </span>
              </article>
            ))}
          </div>

          <h3 className="mt-12 text-center font-serif text-2xl font-black text-[#0B0B0B] dark:text-white sm:text-3xl lg:text-left">How it works</h3>
          <HowItWorks slug={page.slug} steps={page.steps} />

          <h3 className="mt-12 text-center font-serif text-2xl font-black text-[#0B0B0B] dark:text-white sm:text-3xl lg:text-left">Common questions</h3>
          {/* Two per row on a computer (owner 11/18). */}
          <div className="mt-5 grid items-start gap-3 lg:grid-cols-2">
            {page.faqs.map(f => <Question key={f.q} faq={f} startOpen={false} />)}
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

/** "How it works" (owner 11/18: "number and symbol then nothing, words under it" looked odd): every step is
 *  one row - its picture with the step number on it, then the words beside it - two per row on a computer. */
function HowItWorks({ slug, steps }: { slug: string; steps: string[] }) {
  const icons = STEP_ICONS[slug] || []
  return (
    <ol className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4" data-testid="how-it-works">
      {steps.map((s, i) => {
        const StepIcon = icons[i] || Check
        return (
          <li key={s} className={`mk-card relative flex min-w-0 items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#111827] to-[#1f1a10] p-4 text-white shadow-[0_18px_36px_-24px_rgba(17,24,39,.9)] ring-1 ring-[#C9A24D]/25 sm:p-5 ${steps.length % 2 && i === steps.length - 1 ? 'sm:col-span-2' : ''}`}>
            <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[radial-gradient(closest-side,rgba(201,162,77,.22),transparent)]" />
            <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/[0.07] text-[#e8c97a] ring-1 ring-white/10">
              <StepIcon className="h-6 w-6" strokeWidth={2} />
              <span className="absolute -left-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] font-serif text-[14px] font-black text-[#111827] ring-2 ring-[#111827]">{i + 1}</span>
            </span>
            <span className="relative min-w-0">
              <span className="block text-[10.5px] font-black uppercase tracking-[0.22em] text-[#e8c97a]">Step {i + 1}</span>
              <span className="mt-0.5 block text-[15.5px] font-bold leading-snug sm:text-base">{s}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
