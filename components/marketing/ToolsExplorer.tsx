'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FEATURE_TABS } from '@/components/home/featureTabsData'

type Tool = (typeof FEATURE_TABS)[number]

const DETAIL_PAGES: Record<string, string> = { signin: '/tools/open-house-sign-in', cma: '/tools/cma', showcase: '/tools/showcases', agenthub: '/tools/agent-hub' }

// A tool's real homepage demo. It only runs while it's on screen, so a page holding all of them stays
// as cool on a phone as a page holding one (see components/CalmLoops).
export function ToolDemo({ tool, className = '' }: { tool: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [live, setLive] = useState(false)
  const height = useRef(520)
  useEffect(() => {
    const el = box.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting && el.offsetHeight > 80) height.current = el.offsetHeight
      setLive(e.isIntersecting)
    }, { rootMargin: '80px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const Demo = FEATURE_TABS.find(t => t.key === tool)?.Demo
  return (
    <div ref={box} className={`min-w-0 max-sm:-mx-1 ${className}`} data-testid="tool-demo" data-live={live ? 'yes' : 'no'}>
      {live && Demo ? <Demo /> : <div aria-hidden style={{ height: height.current }} />}
    </div>
  )
}

function ToolRow({ tool, flip }: { tool: Tool; flip: boolean }) {
  const Icon = tool.icon
  const detail = DETAIL_PAGES[tool.key]
  return (
    <section id={tool.key} data-testid="tool-row" className="scroll-mt-24 grid items-center gap-6 border-t border-gray-200 py-10 first:border-t-0 dark:border-white/10 lg:grid-cols-2 lg:gap-12 lg:py-14">
      <div data-reveal="" className={flip ? 'lg:order-2' : undefined}>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827]"><Icon className="h-5 w-5" /></span>
        <h2 className="mt-3 font-serif text-3xl font-black tracking-tight text-[#0B0B0B] dark:text-white sm:text-4xl">{tool.label}</h2>
        <p className="mt-3 text-base font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{tool.blurb}</p>
        {detail && <Link href={detail} className="mt-3 inline-block text-sm font-black text-[#8b7355] underline underline-offset-4 dark:text-[#e8c97a]">More about {tool.label}</Link>}
      </div>
      <ToolDemo tool={tool.key} className={flip ? 'lg:order-1' : ''} />
    </section>
  )
}

export default function ToolsExplorer() {
  return (
    <div>
      <nav aria-label="Jump to a tool" className="mt-8 flex flex-wrap gap-1.5">
        {FEATURE_TABS.map(t => (
          <Link key={t.key} href={`#${t.key}`} className="rounded-full bg-white px-3 py-1.5 text-[12.5px] font-bold text-gray-600 ring-1 ring-gray-200 transition hover:ring-[#C9A24D] dark:bg-[#151517] dark:text-gray-300 dark:ring-white/10">{t.label}</Link>
        ))}
      </nav>
      <div className="mt-6">
        {FEATURE_TABS.map((t, i) => <ToolRow key={t.key} tool={t} flip={i % 2 === 1} />)}
      </div>
    </div>
  )
}
