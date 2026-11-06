'use client'

import { Sparkles } from 'lucide-react'
import { FEATURE_TABS, type FeatureTabKey } from '@/components/home/featureTabsData'

const AI_TOOLS = new Set<string>(['blogs', 'cma', 'aimedia', 'listingpage', 'kits', 'showcase', 'idx'])
function AiChip() {
  return (
    <span className="inline-flex items-center gap-px rounded-full bg-gradient-to-r from-[#C9A24D] to-[#f1d58b] px-1.5 py-px text-[8px] font-black uppercase leading-none tracking-wide text-[#111827] shadow-[0_0_10px_rgba(201,162,77,0.5)]">
      <Sparkles className="h-2 w-2" />AI
    </span>
  )
}

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

// The tool tiles: the homepage's tools section and the Tools page (their styles are in homeCss).
export default function ToolTabs({ active, onPick }: { active: FeatureTabKey; onPick: (key: FeatureTabKey) => void }) {
  return (
    <div className="grid grid-cols-6 gap-1.5 sm:gap-2 max-w-md mx-auto lg:max-w-none lg:mx-0">
      {FEATURE_TABS.map((tab) => {
        const Icon = tab.icon
        // Tools whose icon has its own dedicated assemble animation (globals.css) -
        // the same one the nav, Studio hub, and each demo's title slide use - so the
        // mini card draws in identically instead of falling back to the generic rule.
        const iconAssembleClass = TOOL_ICON_ASSEMBLE[tab.key] ?? ''
        const isActive = tab.key === active
        const isBar = tab.key === 'idx'
        const isHalf = tab.key === 'agenthub' || tab.key === 'showcase' || tab.key === 'kits'
        if (isBar) {
          // IDX - the flagship: a gold light that runs around its border, a drifting
          // gold aurora inside midnight, a gold medallion icon and a glinting serif label.
          return (
            <button
              key={tab.key}
              onClick={() => onPick(tab.key)}
              className={`group col-span-6 relative overflow-hidden rounded-2xl p-[1.5px] transition-all duration-300 hover:-translate-y-0.5 ${isActive ? 'shadow-[0_18px_44px_-12px_rgba(201,162,77,0.8)]' : 'shadow-[0_12px_34px_-12px_rgba(201,162,77,0.6)] hover:shadow-[0_18px_44px_-12px_rgba(201,162,77,0.75)]'}`}
            >
              <span aria-hidden className="ohp-tier-spin pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[160%] bg-[conic-gradient(from_0deg,#5a4520_0%,#C9A24D_18%,#fff3cf_25%,#C9A24D_32%,#5a4520_50%,#C9A24D_68%,#fff3cf_75%,#C9A24D_82%,#5a4520_100%)]" style={{ translate: '-50% -50%' }} />
              <span className="relative flex items-center justify-center gap-3 overflow-hidden rounded-[14.5px] bg-[radial-gradient(120%_160%_at_50%_0%,#2a2218_0%,#111827_55%,#0b0b0b_100%)] px-4 py-3.5">
                <span aria-hidden className="ohp-idx-aurora pointer-events-none absolute -top-8 left-1/4 h-20 w-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(201,162,77,.45),transparent)]" />
                <span aria-hidden className="ohp-idx-aurora-b pointer-events-none absolute -bottom-10 right-[10%] h-20 w-2/5 rounded-full bg-[radial-gradient(closest-side,rgba(232,201,122,.25),transparent)]" />
                <span aria-hidden className="ohp-idx-grid pointer-events-none absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] [background-size:18px_18px]" />
                <svg aria-hidden className="ohp-idx-skyline pointer-events-none absolute inset-x-0 bottom-0 h-7 w-full text-[#C9A24D]/35" viewBox="0 0 600 28" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="1"><path d="M0 27h30V17l12-9 12 9v10h22V12h16v15h20V15l15-11 15 11v12h26V9h10V3h8v6h10v18h24V17l14-10 14 10v10h20V13h18v14h24V16l16-12 16 12v11h18V10h14v17h26V18l12-9 12 9v9h30V14h16v13h22V16l15-11 15 11v11h40" /></svg>
                {[['12%', '30%', 0], ['31%', '70%', 1.3], ['63%', '26%', 2.4], ['84%', '64%', 0.7]].map(([l, t, d], k) => (
                  <span key={k} aria-hidden className="ohp-idx-spark pointer-events-none absolute h-1 w-1 rounded-full bg-[#f3dfa8]" style={{ left: l as string, top: t as string, animationDelay: `${d}s` }} />
                ))}
                <span aria-hidden className="ohp-tier-shine pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-card-shimmer" />
                <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] shadow-[0_0_0_3px_rgba(201,162,77,0.22),0_0_18px_rgba(201,162,77,0.55)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-8deg]">
                  <Icon className="ohp-icon-draw h-4 w-4 text-[#111827]" />
                </span>
                <span className="ohp-idx-glint relative text-sm font-bold sm:text-base">{tab.label}</span>
                <span className="relative"><AiChip /></span>
                {isActive && <span aria-hidden className="absolute bottom-1.5 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent" />}
              </span>
            </button>
          )
        }
        if (isHalf) {
          // Agent Hub / Showcases / Kits - the middle tier: ivory-to-gold glass with a
          // midnight medallion icon and a serif label. The gold light only runs around
          // the border while one is selected, so the IDX bar below stays the flagship.
          return (
            <button
              key={tab.key}
              onClick={() => onPick(tab.key)}
              className={`group col-span-2 relative overflow-hidden rounded-2xl p-[1.5px] transition-all duration-300 hover:-translate-y-0.5 ${isActive ? 'scale-[1.02] shadow-[0_14px_32px_-12px_rgba(201,162,77,0.75)]' : 'bg-gradient-to-br from-[#e8c97a]/80 via-[#C9A24D]/35 to-[#C9A24D]/70 shadow-[0_8px_22px_-14px_rgba(139,115,85,0.7)] hover:shadow-[0_14px_30px_-14px_rgba(201,162,77,0.8)] dark:from-[#C9A24D]/55 dark:via-white/10 dark:to-[#C9A24D]/45'}`}
            >
              {isActive && <span aria-hidden className="ohp-tier-spin pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[260%] bg-[conic-gradient(from_0deg,#8b6a2b_0%,#C9A24D_20%,#fff3cf_25%,#C9A24D_30%,#8b6a2b_50%,#C9A24D_70%,#fff3cf_75%,#C9A24D_80%,#8b6a2b_100%)]" style={{ translate: '-50% -50%' }} />}
              <span className={`relative flex h-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[14.5px] px-2 py-2.5 ${isActive ? 'bg-[radial-gradient(120%_140%_at_50%_0%,#2a2218_0%,#111827_60%,#0b0b0b_100%)]' : 'bg-gradient-to-br from-[#fffdf8] via-[#fbf6ec] to-[#f4ead7] dark:from-[#1a1814] dark:via-[#141416] dark:to-[#1d1810]'}`}>
                <span aria-hidden className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent" />
                <span aria-hidden className="ohp-tier-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10" />
                <span className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-8deg] ${isActive ? 'bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] shadow-[0_0_16px_rgba(201,162,77,0.6)]' : 'bg-gradient-to-br from-[#111827] to-[#2a2218] ring-1 ring-[#C9A24D]/60 shadow-[0_6px_14px_-6px_rgba(17,24,39,0.7)]'}`}>
                  <Icon className={`ohp-icon-draw h-4 w-4 ${isActive ? 'text-[#111827]' : 'text-[#e8c97a]'}`} />
                </span>
                <span className={`relative text-[11px] font-bold leading-tight sm:text-[12px] ${isActive ? 'text-[#f3dfa8]' : 'text-[#111827] dark:text-white'}`}>{tab.label}</span>
                {AI_TOOLS.has(tab.key) && <span className="absolute right-1.5 top-1.5"><AiChip /></span>}
              </span>
            </button>
          )
        }
        // Every other tool - the base tier of the same family as the row above: ivory
        // glass with a fine gold edge and a soft gold medallion; selected, it turns
        // midnight with a gold medallion like the Agent Hub row (sizes unchanged).
        return (
          <button
            key={tab.key}
            onClick={() => onPick(tab.key)}
            className={`group relative col-span-1 min-h-[4.25rem] overflow-hidden rounded-xl p-px text-center transition-all duration-300 hover:-translate-y-0.5 ${
              isActive
                ? 'scale-[1.02] bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] shadow-[0_12px_28px_-12px_rgba(201,162,77,0.75)]'
                : 'bg-gradient-to-br from-[#C9A24D]/35 via-gray-200 to-[#C9A24D]/25 shadow-[0_4px_14px_-10px_rgba(139,115,85,0.6)] hover:from-[#C9A24D]/70 hover:to-[#C9A24D]/55 hover:shadow-[0_10px_22px_-12px_rgba(201,162,77,0.7)] dark:via-white/10'
            }`}
          >
            <span className={`relative flex h-full flex-col items-center justify-center gap-1 overflow-hidden rounded-[11px] px-1.5 py-2 text-[10px] font-bold leading-tight sm:text-[11px] ${
              isActive
                ? 'bg-[radial-gradient(120%_140%_at_50%_0%,#2a2218_0%,#111827_60%,#0b0b0b_100%)] text-[#f3dfa8]'
                : 'bg-gradient-to-b from-white to-[#fbf7ef] text-[#374151] group-hover:text-[#0B0B0B] dark:from-[#1a1a1d] dark:to-[#16151a] dark:text-gray-300 dark:group-hover:text-white'
            }`}>
              <span aria-hidden className={`pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent to-transparent transition-opacity duration-300 ${isActive ? 'via-[#e8c97a] opacity-100' : 'via-[#C9A24D] opacity-0 group-hover:opacity-100'}`} />
              <span className={`relative flex h-[30px] w-[30px] items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-8deg] ${
                isActive
                  ? 'bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827] shadow-[0_0_14px_rgba(201,162,77,0.55)]'
                  : 'bg-[#C9A24D]/12 text-[#8b7355] ring-1 ring-[#C9A24D]/30 group-hover:bg-[#C9A24D]/20 dark:text-[#e8c97a]'
              }`}>
                <Icon className={`ohp-icon-draw ${iconAssembleClass} w-[18px] h-[18px] flex-shrink-0`} />
              </span>
              <span className="relative">{tab.label}</span>
              {/* AI-powered tools wear a tiny "AI" chip on the tile itself */}
              {AI_TOOLS.has(tab.key) && (
                <span className={`absolute right-1 top-1 inline-flex items-center gap-px rounded-full px-1 py-px text-[7px] font-black uppercase leading-none tracking-wide ${isActive ? 'bg-[#C9A24D] text-[#111827]' : 'bg-[#C9A24D] text-[#111827]'}`}>
                  <Sparkles className="h-2 w-2" />AI
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
