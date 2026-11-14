'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Building2, QrCode, Search } from 'lucide-react'
import { HOME_CSS } from '@/components/home/homeCss'
import { usePlayWhenSeen } from '@/components/CalmLoops'

// The three homepage demos a broker cares about most, loaded only when this spot is near the
// screen (each is its own chunk, so the page itself stays light).
const Holder = () => <div aria-hidden className="h-[520px] w-full rounded-2xl bg-gray-100 dark:bg-white/5" />
const DEMOS = {
  signin: { label: 'Sign-in', icon: QrCode, line: 'A visitor scans, signs in, and becomes a lead.', Demo: dynamic(() => import('@/components/home/demos/SignInDemo'), { ssr: false, loading: Holder }) },
  discovery: { label: 'Discovery', icon: Search, line: 'Agents find your office’s open houses to host.', Demo: dynamic(() => import('@/components/home/demos/DiscoveryDemo'), { ssr: false, loading: Holder }) },
  manager: { label: 'Manager', icon: Building2, line: 'Listing agents keep every weekend covered.', Demo: dynamic(() => import('@/components/home/demos/ManagerDemo'), { ssr: false, loading: Holder }) },
} as const
type Key = keyof typeof DEMOS

export default function BrokerDemos() {
  const [active, setActive] = useState<Key>('signin')
  const stage = useRef<HTMLDivElement>(null)
  const live = usePlayWhenSeen(stage, { keepWhileWatched: true })
  const { Demo, line } = DEMOS[active]
  // Remember the demo's height so the page doesn't jump when it rests off screen.
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
      <p key={active} className="mt-4 animate-fadeIn text-center text-[15px] font-semibold text-[#4b5563] dark:text-gray-300">{line}</p>
      <div ref={stage} className="mx-auto mt-5 max-w-3xl min-w-0 max-sm:-mx-2" data-testid="broker-demo">
        <div key={active} ref={box} className="animate-fadeIn">{live ? <Demo /> : <div aria-hidden style={{ height: height.current || 520 }} />}</div>
      </div>
    </div>
  )
}
