'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, GitCompareArrows, MapPin } from 'lucide-react'

interface CompareArea {
  slug: string
  name: string
  state?: string
  county?: string
  parent_area_name?: string
  active_count?: number | null
  median_price?: number | null
  school_districts?: string[] | null
  hover_facts?: { downtown?: string[]; parks?: string[]; transportation?: string[]; restaurants_shopping?: string[] } | null
}

// The two or three things a buyer actually weighs first, straight on the picker card - schools,
// the town center, how you get around - so the comparison starts before the full page opens.
function quickFacts(area: CompareArea): [string, string][] {
  return ([
    ['Schools', area.school_districts?.length ? area.school_districts.slice(0, 2).join(' / ') : ''],
    ['Town center', area.hover_facts?.downtown?.[0] || ''],
    ['Getting around', area.hover_facts?.transportation?.[0] || ''],
    ['Parks', area.hover_facts?.parks?.slice(0, 2).join(' / ') || ''],
  ] as [string, string][]).filter(([, v]) => v).slice(0, 3)
}

function areaLabel(area?: CompareArea) {
  if (!area) return ''
  return [area.parent_area_name || area.county, area.state].filter(Boolean).join(', ')
}

export default function NeighborhoodCompareLauncher({
  areas,
  basePrefix,
  theme,
  initialFirstSlug,
  initialSecondSlug,
}: {
  areas: CompareArea[]
  basePrefix: string
  theme: any
  initialFirstSlug?: string
  initialSecondSlug?: string
}) {
  const sortedAreas = useMemo(() => [...areas].sort((a, b) => a.name.localeCompare(b.name)), [areas])
  const firstInitial = initialFirstSlug && sortedAreas.some(area => area.slug === initialFirstSlug)
    ? initialFirstSlug
    : sortedAreas[0]?.slug || ''
  const secondInitial = initialSecondSlug && initialSecondSlug !== firstInitial && sortedAreas.some(area => area.slug === initialSecondSlug)
    ? initialSecondSlug
    : sortedAreas.find(area => area.slug !== firstInitial)?.slug || ''
  const [first, setFirst] = useState(firstInitial)
  const [second, setSecond] = useState(secondInitial)
  const firstArea = sortedAreas.find(area => area.slug === first)
  const secondArea = sortedAreas.find(area => area.slug === second)
  const canCompare = Boolean(first && second && first !== second)

  const openComparison = () => {
    if (!canCompare) return
    window.location.assign(`${basePrefix}/neighborhoods/compare?areas=${encodeURIComponent(`${first},${second}`)}`)
  }

  if (sortedAreas.length < 2) return null

  return (
    <section id="compare-neighborhoods" className="mx-auto max-w-6xl px-6 pt-14">
      <div className="overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white shadow-[0_18px_60px_rgba(17,24,39,0.08)]">
        <div className="grid gap-0 lg:grid-cols-[0.9fr_1.25fr]">
          <div className="p-7 sm:p-9" style={{ backgroundColor: theme.primary_color }}>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: theme.secondary_color, color: theme.primary_color }}>
              <GitCompareArrows className="h-5 w-5" />
            </span>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.24em]" style={{ color: theme.secondary_color }}>Compare Neighborhoods</p>
            <h2 className="ohp-site-heading mt-2 text-3xl font-black leading-tight text-white sm:text-4xl">Find the right fit side by side.</h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Compare the neighborhoods this agent serves using live homes for sale, market data, schools, transportation, and local lifestyle research.
            </p>
          </div>

          <div className="p-5 sm:p-7">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <NeighborhoodSelect label="First neighborhood" value={first} onChange={setFirst} areas={sortedAreas} excludeSlug={second} theme={theme} />
              <div className="mx-auto hidden h-11 w-11 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-300 sm:flex">
                <ArrowRight className="h-4 w-4" />
              </div>
              <NeighborhoodSelect label="Second neighborhood" value={second} onChange={setSecond} areas={sortedAreas} excludeSlug={first} theme={theme} />
            </div>

            {(firstArea || secondArea) && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[firstArea, secondArea].filter(Boolean).map(area => (
                  <div key={area!.slug} className="rounded-2xl bg-gray-50 p-4">
                    <p className="font-black text-gray-800">{area!.name}</p>
                    {areaLabel(area!) && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-gray-400"><MapPin className="h-3 w-3" />{areaLabel(area!)}</p>}
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-wide text-gray-500">
                      {area!.active_count != null && <span className="rounded-full bg-white px-2.5 py-1">{area!.active_count} for sale</span>}
                      {area!.median_price != null && <span className="rounded-full bg-white px-2.5 py-1">${area!.median_price.toLocaleString()} median</span>}
                    </div>
                    {quickFacts(area!).length > 0 && (
                      <dl className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
                        {quickFacts(area!).map(([label, value]) => (
                          <div key={label} className="flex gap-2 text-xs">
                            <dt className="w-24 shrink-0 font-black uppercase tracking-wide text-gray-400">{label}</dt>
                            <dd className="line-clamp-1 font-semibold text-gray-700">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              disabled={!canCompare}
              onClick={openComparison}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-xl transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              style={{ backgroundColor: theme.primary_color }}
            >
              Open Comparison <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function NeighborhoodSelect({
  label,
  value,
  onChange,
  areas,
  excludeSlug,
  theme,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  areas: CompareArea[]
  excludeSlug?: string
  theme: any
}) {
  return (
    <label className="block rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: theme.secondary_color }}>{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-2 w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-bold text-gray-800 outline-none focus:border-gray-400"
      >
        {areas.map(area => (
          <option key={area.slug} value={area.slug} disabled={area.slug === excludeSlug}>
            {area.name}{area.state ? `, ${area.state}` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
