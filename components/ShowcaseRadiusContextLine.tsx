import { MapPin } from 'lucide-react'

function formatRadius(value?: number | null) {
  if (!value || value <= 0) return null
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function splitAddress(address?: string | null) {
  const cleaned = (address || '')
    .replace(/,\s*(?:USA|United States)$/i, '')
    .replace(/,\s*\d{5}(?:-\d{4})?\s*$/, '')
    .replace(/\s+\d{5}(?:-\d{4})?\s*$/, '')
    .trim()
  if (!cleaned) return null

  const parts = cleaned.split(',').map(part => part.trim()).filter(Boolean)
  if (parts.length >= 3) {
    return { street: parts[0], cityState: [parts[1], parts[2].split(/\s+/)[0]].filter(Boolean).join(', ') }
  }
  if (parts.length === 2) {
    const state = parts[1].split(/\s+/)[0]
    const streetCityMatch = parts[0].match(/^(.+\b(?:Avenue|Ave|Road|Rd|Street|St|Lane|Ln|Drive|Dr|Boulevard|Blvd|Court|Ct|Circle|Cir|Way|Place|Pl|Pike|Trail|Terrace|Ter|Highway|Hwy|Parkway|Pkwy)\.?)\s+(.+)$/i)
    if (state.length === 2 && streetCityMatch) {
      return { street: streetCityMatch[1], cityState: `${streetCityMatch[2]}, ${state}` }
    }
    return { street: parts[0], cityState: parts[1] }
  }
  return { street: cleaned, cityState: '' }
}

type ShowcaseRadiusContextLineProps = {
  address?: string | null
  radiusMiles?: number | null
  onClick?: () => void
}

export default function ShowcaseRadiusContextLine({ address, radiusMiles, onClick }: ShowcaseRadiusContextLineProps) {
  const radius = formatRadius(radiusMiles)
  const parsed = splitAddress(address)
  if (!radius || !parsed) return null

  // A tile the same size as the "Comparing to" card's photo: the distance itself inside a small
  // pulsing radar, so the card reads at a glance and has no empty space under an icon.
  const content = (
    <>
      <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#111827] text-white shadow-inner dark:bg-[#0b0b0c]">
        <span className="absolute h-[60px] w-[60px] rounded-full border border-dashed border-white/15" />
        <span className="absolute h-[50px] w-[50px] rounded-full border border-[#C9A24D]/50 bg-[#C9A24D]/10" />
        <span className="radius-ping absolute h-[50px] w-[50px] rounded-full border border-[#e8c97a]" />
        <span className="relative flex flex-col items-center leading-none">
          <span className="text-base font-black tabular-nums tracking-tight text-[#e8c97a]">{radius}</span>
          <span className="mt-[3px] pl-[0.2em] text-[7px] font-black uppercase tracking-[0.2em] text-white/75">mi</span>
        </span>
      </span>
      <div className="min-w-0 text-xs leading-tight">
        <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#C9A24D]">
          <MapPin className="h-3 w-3" /> {radius} {radius === '1' ? 'mile' : 'miles'} from
        </p>
        <p className="mt-0.5 truncate font-black text-[#0B0B0B] dark:text-white">{parsed.street}</p>
        {parsed.cityState && <p className="truncate font-semibold text-[#6B7280] dark:text-gray-400">{parsed.cityState}</p>}
        {onClick && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[9px] font-black uppercase tracking-wider text-[#a8843a] transition-colors group-hover:text-[#111827] dark:text-[#e8c97a] dark:group-hover:text-white">
            Tap to change radius <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </p>
        )}
      </div>
      <style>{`.radius-ping{animation:radiusPing 2.4s ease-out infinite}@keyframes radiusPing{0%{transform:scale(.85);opacity:.9}100%{transform:scale(1.35);opacity:0}}@media (prefers-reduced-motion:reduce){.radius-ping{animation:none}}`}</style>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Refine this search location"
        className="group inline-flex max-w-full items-center gap-3 rounded-2xl border border-gray-200 bg-[#FAFAF7] py-1.5 pl-1.5 pr-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#C9A24D]/60 hover:bg-[#C9A24D]/5 hover:shadow-[0_14px_30px_-20px_rgba(201,162,77,.8)] focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 active:scale-[0.98] dark:border-gray-800 dark:bg-[#0B0B0B]"
      >
        {content}
      </button>
    )
  }

  return (
    <div className="inline-flex max-w-full items-center gap-3 rounded-2xl border border-gray-200 bg-[#FAFAF7] py-1.5 pl-1.5 pr-4 text-left dark:border-gray-800 dark:bg-[#0B0B0B]">
      {content}
    </div>
  )
}
