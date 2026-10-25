'use client'

import { AddToCalendar } from './Widgets'
import { fmtTimeRange, parseDay, type SpotlightModel } from './model'

// Right under the header (user, 10/24): every upcoming open house - day, date and time - each with
// its own Add to calendar, in a condensed version of the Open House section further down (which
// stays as the reminder). The header's open-house pill scrolls here. Phones get tight rows: a
// date tile, the day + time, and a small calendar button - no "+1 more date" link.
export default function OpenHouseBrief({ m, url, look }: { m: SpotlightModel; url: string; look: 'cinematic' | 'editorial' }) {
  const list = m.openHouses
  if (!list.length) return null
  const ed = look === 'editorial'
  return (
    <section id="open-house-brief" aria-label="Open houses" className={`ohb ohb-${look} relative z-10 scroll-mt-[76px]`}>
      <style>{OHB_CSS}</style>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-5 py-4 sm:px-10 sm:py-6 lg:flex-row lg:items-center lg:gap-10 xl:px-14">
        <div className="flex items-baseline justify-between gap-4 lg:block lg:w-56 lg:shrink-0">
          <p className={`ohb-kicker ${ed ? 'sp-mono' : ''}`}>{list.length > 1 ? `Open houses · ${list.length}` : 'Open house'}</p>
          <p className={`ohb-sub ${ed ? 'sp-display italic' : ''}`}>No appointment needed</p>
        </div>
        <ul className={`ohb-list grid flex-1 gap-0 sm:gap-2 ${list.length > 1 ? 'sm:grid-cols-2' : ''} ${list.length > 2 ? 'xl:grid-cols-3' : ''}`}>
          {list.map((oh, i) => {
            const d = parseDay(oh.date)!
            const time = fmtTimeRange(oh.start_time, oh.end_time) || 'Time to be announced'
            return (
              <li key={oh.id || i} className="ohb-row">
                <span className="ohb-date" aria-hidden>
                  <b className={ed ? 'sp-mono' : ''}>{d.toLocaleDateString('en-US', { month: 'short' })}</b>
                  <i className="sp-display">{d.getDate()}</i>
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`ohb-day sp-display ${ed ? 'italic' : ''}`}>{d.toLocaleDateString('en-US', { weekday: 'long' })}<span className="sr-only">, {d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span></span>
                  <span className={`ohb-time ${ed ? 'sp-mono' : ''}`}>{time}</span>
                </span>
                <AddToCalendar openHouse={oh} address={m.p.address} fullAddress={m.fullAddress} url={url} agentName={m.agent?.name}
                  tone="dark" sheetTone={ed ? 'light' : 'dark'} compact align="right" />
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

const OHB_CSS = `
.ohb-cinematic{background:linear-gradient(90deg,color-mix(in srgb,var(--sp-accent,#C9A24D) 20%,#0A0A0A),#0A0A0A 72%);color:#fff;border-bottom:1px solid color-mix(in srgb,var(--sp-accent,#C9A24D) 28%,transparent)}
.ohb-editorial{background:var(--deep,#10201e);color:#f3efe6;border-bottom:1px solid rgba(243,239,230,.12)}
.ohb-kicker{font-size:10px;font-weight:600;letter-spacing:.32em;text-transform:uppercase;color:var(--sp-accent,#C9A24D)}
.ohb-editorial .ohb-kicker{font-weight:400;letter-spacing:.2em;color:var(--ee-gold,#d9c38d)}
.ohb-sub{font-size:12px;opacity:.6}
.ohb-editorial .ohb-sub{font-size:15px;opacity:.75}
@media(min-width:1024px){.ohb-sub{margin-top:6px}}
.ohb-row{display:flex;align-items:center;gap:14px;padding:10px 0;border-top:1px solid rgba(255,255,255,.08)}
.ohb-editorial .ohb-row{border-top-color:rgba(243,239,230,.12)}
.ohb-row:first-child{border-top:0}
@media(min-width:640px){.ohb-row,.ohb-row:first-child{padding:12px 14px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.03);border-radius:14px}.ohb-editorial .ohb-row,.ohb-editorial .ohb-row:first-child{border-color:rgba(243,239,230,.14);border-radius:0;background:rgba(243,239,230,.03)}}
.ohb-date{display:flex;width:44px;flex-shrink:0;flex-direction:column;align-items:center;line-height:1}
.ohb-date b{font-size:9px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--sp-accent,#C9A24D)}
.ohb-editorial .ohb-date b{font-weight:400;letter-spacing:.16em;color:var(--ee-gold,#d9c38d)}
.ohb-date i{font-style:normal;font-size:30px;font-weight:300;margin-top:3px}
.ohb-day{display:block;font-size:19px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ohb-time{display:block;margin-top:3px;font-size:12.5px;opacity:.68;white-space:nowrap}
.ohb-editorial .ohb-time{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase}
.ohb-editorial .ohb-row button{border-radius:0;border-color:rgba(243,239,230,.3)}
`
