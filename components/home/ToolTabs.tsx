'use client'

import { FEATURE_TABS, type FeatureTabKey } from '@/components/home/featureTabsData'

const AI_TOOLS = new Set<string>(['blogs', 'cma', 'aimedia', 'listingpage', 'kits', 'showcase', 'idx'])

// FEATURE_TABS key -> the icon's dedicated draw-in class in globals.css (tools not listed use the
// generic ohp-icon-draw rule, which already animates their icon correctly).
const TOOL_ICON_ASSEMBLE: Record<string, string> = {
  discovery: 'ohp-icon-assemble-search',
  forms: 'ohp-icon-assemble-forms',
  signature: 'ohp-icon-assemble-mail',
  aimedia: 'ohp-icon-assemble-clapper',
  blogs: 'ohp-icon-assemble-blog',
  calsync: 'ohp-icon-assemble-calendar',
}

// The tool buttons: the homepage's tools section and the Tools page. They wear the same card and the
// same square icon as the Tools page inside the app (app/studio/page.tsx), and the open one fills in
// like the app's tabs (owner, 11/06: the round medallions, glows and spinning gold edges looked generic).
const PLAIN = 'border-[#C9A24D]/25 bg-[linear-gradient(140deg,#fffdf8_0%,#fbf6ec_60%,#f6eddb_100%)] text-[#111827] shadow-[0_18px_40px_-32px_rgba(139,115,85,.6)] hover:-translate-y-0.5 hover:border-[#C9A24D]/60 dark:border-white/[0.08] dark:bg-[linear-gradient(140deg,#0b0f0e_0%,#111827_60%,#1d1810_100%)] dark:text-gray-200 dark:hover:border-[#C9A24D]/50 dark:hover:text-white'
const OPEN = 'border-[#111827] bg-[#111827] text-white shadow-lg shadow-[#111827]/20 dark:border-transparent dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827] dark:shadow-[#C9A24D]/25'
const ICON_PLAIN = 'from-[#111827] to-[#2a2218] text-[#e8c97a] ring-[#C9A24D]/30 dark:from-[#e8c97a] dark:to-[#C9A24D] dark:text-[#111827]'
const ICON_OPEN = 'from-[#e8c97a] to-[#C9A24D] text-[#111827] ring-[#C9A24D]/30 dark:from-[#111827] dark:to-[#2a2218] dark:text-[#e8c97a]'

function AiTag({ open, inline = false }: { open: boolean; inline?: boolean }) {
  return (
    <span className={`${inline ? '' : 'absolute right-0.5 top-0.5 z-10'} rounded bg-[#C9A24D] px-1 py-px text-[7px] font-black uppercase leading-none tracking-wide text-[#111827] ${open ? 'dark:bg-[#111827] dark:text-[#e8c97a]' : ''}`}>AI</span>
  )
}

export default function ToolTabs({ active, onPick }: { active: FeatureTabKey; onPick: (key: FeatureTabKey) => void }) {
  return (
    <div className="grid grid-cols-6 gap-1.5 sm:gap-2 max-w-md mx-auto lg:max-w-none lg:mx-0">
      {FEATURE_TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = tab.key === active
        const isBar = tab.key === 'idx'
        const isHalf = tab.key === 'agenthub' || tab.key === 'showcase' || tab.key === 'kits'
        const hasAi = AI_TOOLS.has(tab.key)
        const iconTile = `flex h-7 w-7 sm:h-[30px] sm:w-[30px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow-md ring-1 transition-transform duration-300 group-hover:scale-110 ${isActive ? ICON_OPEN : ICON_PLAIN}`
        const look = isActive ? OPEN : PLAIN
        if (isBar) {
          return (
            <button key={tab.key} onClick={() => onPick(tab.key)} aria-pressed={isActive} className={`group col-span-6 flex min-h-[3.25rem] items-center justify-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-black transition duration-300 ${look}`}>
              <span className={iconTile}><Icon className="ohp-icon-draw h-4 w-4 sm:h-[18px] sm:w-[18px]" /></span>
              <span>{tab.label}</span>
              <AiTag open={isActive} inline />
            </button>
          )
        }
        return (
          <button
            key={tab.key}
            onClick={() => onPick(tab.key)}
            aria-pressed={isActive}
            className={`group relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-xl border px-0.5 py-2 text-center font-bold leading-tight transition duration-300 sm:px-1.5 sm:font-black ${isHalf ? 'col-span-2 text-[11px] sm:text-[12px]' : 'col-span-1 text-[9.5px] max-[350px]:text-[8px] sm:text-[11px]'} ${look}`}
          >
            <span className={iconTile}><Icon className={`ohp-icon-draw ${TOOL_ICON_ASSEMBLE[tab.key] ?? ''} h-4 w-4 sm:h-[18px] sm:w-[18px]`} /></span>
            <span>{tab.label}</span>
            {hasAi && <AiTag open={isActive} />}
          </button>
        )
      })}
    </div>
  )
}
