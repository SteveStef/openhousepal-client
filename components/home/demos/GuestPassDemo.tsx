'use client'

// Guest Pass demo (Brokerages page, owner 11/18: "the sign in then the guest pass then the kits then
// showcases"; later: "should really look like a real guest pass and scroll through it, like our Agent
// Hub example"). A title, then the real Guest Pass on a phone (GuestPassPhone), scrolled part by part
// with a note beside it - the home, similar homes, a one-tap request, the neighborhood, their
// Showcase and a question to the agent.
import { useEffect, useState } from 'react'
import { Ticket } from 'lucide-react'
import BrowserFrame from '@/components/home/BrowserFrame'
import TitleSlide from './TitleSlide'
import GuestPassStage, { GUEST_PASS_STOPS as S } from './GuestPassPhone'

const STOPS = [S.welcome, S.home, S.similar, S.tiles, S.map, S.showcase, S.ask]
const TITLE_MS = 4400
const PAGES = 1 + STOPS.length
const URL = 'openhousepal.com/open-house/pass'

export default function GuestPassDemo() {
  const [i, setI] = useState(0)
  const [tick, setTick] = useState(0)
  const hold = i === 0 ? TITLE_MS : STOPS[i - 1].hold
  useEffect(() => {
    setTick(0)
    const ticker = setInterval(() => setTick(t => t + 1), 250)
    const t = setTimeout(() => setI(n => (n + 1) % PAGES), hold)
    return () => { clearTimeout(t); clearInterval(ticker) }
  }, [i, hold])

  if (i === 0) {
    return <TitleSlide icon={Ticket} kicker="Right after they sign in" title="Guest Pass" body="The home they're standing in, on their phone." totalPages={PAGES} pageIndex={0} durationMs={TITLE_MS} url={URL} />
  }
  return (
    <BrowserFrame url={URL} progress={{ pages: PAGES, current: i, durationMs: hold }}>
      <GuestPassStage stops={STOPS} stop={i - 1} tick={tick} />
    </BrowserFrame>
  )
}
