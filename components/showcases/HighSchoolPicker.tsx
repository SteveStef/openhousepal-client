'use client'

// "Only these high schools" in the Showcase search (owner, 11/19): Bright leaves the high school out of most listings,
// so each for-sale home's school is worked out once in the background - Bright's answer first, then the government
// school map, then the homes around it (backend services/home_school_service.py). Picking a school here keeps only
// the homes going to it, those included.
import { useEffect, useState } from 'react'
import { Check, GraduationCap } from 'lucide-react'
import api from '@/lib/api-service'

type School = { key: string; name: string; homes: number; named: number; sure: number }

export function HighSchoolPicker({ districts, value, onChange }: { districts: string[]; value: string[]; onChange: (keys: string[]) => void }) {
  const [schools, setSchools] = useState<School[] | null>(null)
  const dkey = JSON.stringify(districts || [])
  useEffect(() => {
    const ds = JSON.parse(dkey) as string[]
    if (!ds.length) { setSchools(null); if (value.length) onChange([]); return }
    let live = true
    setSchools(null)
    api.properties.highSchools(ds).then(r => {
      if (!live) return
      const got = (r.success && r.data?.schools) || []
      setSchools(got)
      // a school that isn't in the picked districts any more would leave no homes
      const keep = value.filter(k => got.some(s => s.key === k))
      if (keep.length !== value.length) onChange(keep)
    })
    return () => { live = false }
  }, [dkey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!districts?.length || !schools || schools.length < 2) return null
  const toggle = (k: string) => onChange(value.includes(k) ? value.filter(x => x !== k) : [...value, k])
  const placed = schools.reduce((n, s) => n + (s.homes - s.named), 0)
  return (
    <div className="space-y-1.5" data-testid="high-school-picker">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
        High schools <span className="normal-case tracking-normal text-gray-400">· {value.length ? 'only these' : 'any - tap to keep only one'}</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {schools.map(s => {
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
      {placed > 0 && (
        <p className="text-[10.5px] font-semibold leading-snug text-gray-400">
          {`Counts are homes for sale. ${placed} of them don't name a high school in the listing - the government school map and the homes around them place those, so they still count.`}
        </p>
      )}
    </div>
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
