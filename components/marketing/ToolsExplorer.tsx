'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
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

          <h3 className="mt-10 font-serif text-2xl font-black text-[#0B0B0B] dark:text-white">How it works</h3>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {page.steps.map((s, i) => (
              <li key={s} className="rounded-2xl bg-[#111827] p-4 text-white dark:bg-[#151517] dark:ring-1 dark:ring-white/10">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#C9A24D] text-sm font-black text-[#111827]">{i + 1}</span>
                <p className="mt-2 text-[15px] font-bold leading-snug">{s}</p>
              </li>
            ))}
          </ol>

          <h3 className="mt-10 font-serif text-2xl font-black text-[#0B0B0B] dark:text-white">Common questions</h3>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {page.faqs.map(f => (
              <div key={f.q} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#151517]">
                <h4 className="font-serif text-lg font-black text-[#0B0B0B] dark:text-white">{f.q}</h4>
                <p className="mt-1 text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{f.a}</p>
              </div>
            ))}
          </div>
          {page.article && <p className="mt-4 text-sm font-black text-[#8b7355] dark:text-[#e8c97a]"><Link href={page.article.href} className="underline underline-offset-4">{page.article.href.startsWith('/resources') ? `Read: ${page.article.label}` : page.article.label}</Link></p>}
        </section>
      )}
    </div>
  )
}
