'use client'

// "Only these high schools" in the Showcase search (owner, 11/19): Bright leaves the high school out of most listings,
// so each for-sale home's school is worked out once in the background - Bright's answer first; otherwise only when the
// home's township, the government school map and the nearby listings ALL agree (backend services/home_school_service.py;
// a wrong school is worse than "unknown"). Picking a school here keeps only the homes going to it, those included.
import { useEffect, useState } from 'react'
import { Check, GraduationCap } from 'lucide-react'
import api from '@/lib/api-service'

type School = { key: string; name: string; homes: number; named: number; sure: number }

export function HighSchoolPicker({ districts, value, onChange, client = false, bare = false }: {
  districts: string[]; value: string[]; onChange: (keys: string[]) => void
  /** the client's own editor (public lookup) */ client?: boolean
  /** under its own "High school" label: no heading, and a line instead of nothing when there's no choice */ bare?: boolean
}) {
  const [schools, setSchools] = useState<School[] | null>(null)
  const dkey = JSON.stringify(districts || [])
  useEffect(() => {
    const ds = JSON.parse(dkey) as string[]
    if (!ds.length) { setSchools(null); if (value.length) onChange([]); return }
    let live = true
    setSchools(null)
    ;(client ? api.properties.highSchoolsPublic(ds) : api.properties.highSchools(ds)).then(r => {
      if (!live) return
      const got = (r.success && r.data?.schools) || []
      setSchools(got)   // "unknown" = homes there whose school can't be told (not a chip - they stay in, marked)
      // a school that isn't in the picked districts any more would leave no homes
      const keep = value.filter(k => got.some(s => s.key === k))
      if (keep.length !== value.length) onChange(keep)
    })
    return () => { live = false }
  }, [dkey]) // eslint-disable-line react-hooks/exhaustive-deps

  const real = (schools || []).filter(s => s.key !== 'unknown')
  const unknown = (schools || []).find(s => s.key === 'unknown')?.homes || 0
  const quiet = 'text-[12px] font-semibold leading-snug text-gray-400'
  if (!districts?.length) return bare ? <p className={quiet} data-testid="high-school-empty">Pick a school district first</p> : null
  if (!schools) return bare ? <p className={quiet}>Loading…</p> : null
  if (real.length < 2) return bare ? <p className={quiet} data-testid="high-school-empty">{real.length ? `${real[0].name} - the only one` : 'No high schools found yet'}</p> : null
  const toggle = (k: string) => onChange(value.includes(k) ? value.filter(x => x !== k) : [...value, k])
  const placed = real.reduce((n, s) => n + (s.homes - s.named), 0)
  return (
    <div className="space-y-1.5" data-testid="high-school-picker">
      {bare ? null : (
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          High schools <span className="normal-case tracking-normal text-gray-400">· {value.length ? 'only these' : 'any - tap to keep only one'}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {real.map(s => {
          const on = value.includes(s.key)
          return (
            <button key={s.key} type="button" onClick={() => toggle(s.key)} aria-pressed={on} data-testid="high-school-chip"
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-left text-[11.5px] font-bold ring-1 transition-colors ${on
                ? 'bg-[#C9A24D]/15 text-[#111827] ring-[#C9A24D] dark:bg-[#C9A24D]/20 dark:text-white'
                : 'bg-white text-gray-600 ring-gray-200 hover:ring-[#C9A24D]/60 dark:bg-zinc-900 dark:text-gray-300 dark:ring-white/10'}`}>
              {on ? <Check className="h-3.5 w-3.5 shrink-0 text-[#a8843a] dark:text-[#e8c97a]" /> : <GraduationCap className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
              <span className="min-w-0 truncate">{s.name}</span>
              <span className="shrink-0 text-[10.5px] font-black text-gray-400">{s.homes}</span>
            </button>
          )
        })}
      </div>
      {value.length > 0 && unknown > 0 && (
        <p className="text-[10.5px] font-bold leading-snug text-amber-700 dark:text-amber-300" data-testid="high-school-unknown">
          {`Plus ${unknown} home${unknown === 1 ? '' : 's'} in the district whose school can't be told - they stay in, marked "School unknown", so nothing is missed.`}
        </p>
      )}
      {placed > 0 && !client && (
        <p className="text-[10.5px] font-semibold leading-snug text-gray-400">
          {`Counts are homes for sale. ${placed} of them don't name a high school in the listing - their township, the government school map and the nearby listings all agree on the school, so they still count.`}
        </p>
      )}
    </div>
  )
}

/** On a home's card: in the high-school search only because the listing doesn't say its school and we couldn't
 *  place it - kept so nobody misses a home (owner, 11/19). */
export function SchoolUnknownLine({ className = '' }: { className?: string }) {
  return (
    <p className={`flex min-w-0 items-start gap-1 text-[11px] font-bold leading-snug text-amber-700 dark:text-amber-300 ${className}`} data-testid="school-unknown"
      title="The listing doesn't name its high school and we couldn't place it - it's here so you don't miss it. Check the school before touring.">
      <GraduationCap className="mt-px h-3 w-3 shrink-0" />
      <span className="min-w-0">School unknown - check before touring</span>
    </p>
  )
}

/** The client's own search editor: the agent's high-school pick, said plainly (the client can't change it). */
export function HighSchoolNote({ names, className = '' }: { names?: Record<string, string> | null; className?: string }) {
  const list = Object.values(names || {}).filter(Boolean)
  if (!list.length) return null
  return (
    <p className={`flex items-start gap-1.5 rounded-lg bg-[#C9A24D]/10 px-2.5 py-1.5 text-[11.5px] font-bold leading-snug text-[#8b7355] dark:text-[#e8c97a] ${className}`} data-testid="high-school-note">
      <GraduationCap className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>Only homes going to {list.join(' or ')}. Changing the school district shows the whole new district.</span>
    </p>
  )
}
