'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Globe, Home, Layout, Play } from 'lucide-react'
import { HOME_CSS } from '@/components/home/homeCss'
import { usePlayWhenSeen } from '@/components/CalmLoops'

// The IDX Websites page's demos (same player as the Brokerages page's BrokerDemos): the real
// homepage demos, loaded only when this spot is near the screen (each is its own chunk).
// Never a blank box (owner 11/18: the demo "looks blank" until it plays): a cover with the demo's name.
function Poster({ k, height, onPlay }: { k: 'site' | 'home' | 'showcase'; height?: number; onPlay?: () => void }) {
  const d = DEMOS[k]
  return (
    <div className="relative isolate grid w-full place-items-center overflow-hidden rounded-2xl bg-[radial-gradient(120%_120%_at_15%_0%,#2c2418_0%,#111827_55%,#0b0b0b_100%)] ring-1 ring-[#C9A24D]/30" style={{ height: height || 520 }}>
      <span aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(201,162,77,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(201,162,77,.07)_1px,transparent_1px)] bg-[size:30px_30px] [mask-image:radial-gradient(80%_75%_at_50%_45%,#000,transparent)]" />
      <div className="text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827] shadow-xl"><d.icon className="h-7 w-7" /></span>
        <p className="mt-4 font-serif text-2xl font-black text-white">{d.label}</p>
        {onPlay
          ? <button type="button" onClick={onPlay} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-[#111827] shadow-lg transition hover:bg-[#f3dfa8]"><Play className="h-4 w-4 fill-current" /> Play the demo</button>
          : <p className="mt-2 text-sm font-semibold text-gray-400">Loading the demo...</p>}
      </div>
    </div>
  )
}
const Holder = () => <Poster k="site" />
const DEMOS = {
  site: { label: 'The website', icon: Globe, line: 'Built from what you already set up: search, homes, towns, your sales and blog, and every lead.', Demo: dynamic(() => import('@/components/home/demos/IdxWebsiteDemo'), { ssr: false, loading: Holder }) },
  // ListingPageDemo is the Listing Spotlight builder (a website for one listing, also on the IDX plan).
  home: { label: 'Listing Spotlight', icon: Home, line: 'Each of your listings can also get its own website, set up for you in a few steps.', Demo: dynamic(() => import('@/components/home/demos/ListingPageDemo'), { ssr: false, loading: Holder }) },
  showcase: { label: 'Showcases', icon: Layout, line: 'A buyer gets their own home search: new matches arrive on their own, and you see every like, comment and tour request.', Demo: dynamic(() => import('@/components/home/demos/ShowcaseDemo'), { ssr: false, loading: Holder }) },
} as const
type Key = keyof typeof DEMOS

export default function IdxDemos() {
  const [active, setActive] = useState<Key>('site')
  const stage = useRef<HTMLDivElement>(null)
  const seen = usePlayWhenSeen(stage, { keepWhileWatched: true })
  const [played, setPlayed] = useState(false)
  const live = seen || played
  const { Demo, line } = DEMOS[active]
  // Keep the demo's height while it rests off screen, so the page doesn't jump.
  const box = useRef<HTMLDivElement>(null)
  const height = useRef(0)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { if (el.offsetHeight > 60) height.current = el.offsetHeight })
    ro.observe(el)
    return () => ro.disconnect()
  }, [active])

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: HOME_CSS }} />
      <div role="tablist" aria-label="Demos" className="mx-auto flex w-fit max-w-full flex-wrap justify-center gap-1.5 rounded-2xl bg-white p-1.5 ring-1 ring-gray-200 dark:bg-[#151517] dark:ring-white/10">
        {(Object.keys(DEMOS) as Key[]).map(k => {
          const d = DEMOS[k]
          const on = k === active
          return (
            <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setActive(k)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-black transition-colors sm:px-4 sm:text-sm ${on ? 'bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]' : 'text-gray-600 hover:text-[#111827] dark:text-gray-300 dark:hover:text-white'}`}>
              <d.icon className="h-4 w-4" /> {d.label}
            </button>
          )
        })}
      </div>
      <p key={active} className="mx-auto mt-4 max-w-2xl animate-fadeIn text-center text-[15px] font-semibold text-[#4b5563] dark:text-gray-300">{line}</p>
      <div ref={stage} className="mx-auto mt-5 max-w-3xl min-w-0 max-sm:-mx-2" data-testid="idx-demo">
        <div key={active} ref={box} className="animate-fadeIn">{live ? <Demo /> : <Poster k={active} height={height.current || 520} onPlay={() => setPlayed(true)} />}</div>
      </div>
    </div>
  )
}
