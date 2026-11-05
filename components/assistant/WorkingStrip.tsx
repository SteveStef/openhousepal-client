'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Clapperboard, Globe, Newspaper, Sparkles } from 'lucide-react'

// What the helper is still making (an AI CMA, a blog post), right under the chat's top bar - it stays
// put while they keep talking, about this or anything else (owner, 11/01: "a nice little loading bar
// that doesn't go away ... so the person can see that it's actually loading and what the progress is").
export type WorkingJob = { key: string; kind: string; id: string; label: string; at: string; stage?: string | null; media?: string }

// A blog reports its real stage; a CMA has none, so it moves with time (about 4 minutes) and waits at
// 92% until it's really done - the strip never claims 100% before the finished message.
const BLOG_STAGES: Record<string, [number, string]> = {
  gathering: [12, 'Gathering your data'], research: [32, 'Researching'], write: [58, 'Writing'],
  fact_check: [80, 'Fact-checking every number'], finishing: [92, 'Finishing up'],
}
const KIND: Record<string, { what: string; icon: typeof Sparkles; secs: number }> = {
  cma: { what: 'CMA', icon: BarChart3, secs: 240 },
  blog: { what: 'Blog post', icon: Newspaper, secs: 330 },
  spotlight: { what: 'Spotlight', icon: Globe, secs: 60 },
  media: { what: 'AI media', icon: Clapperboard, secs: 60 },
}

function progress(job: WorkingJob, now: number): [number, string] {
  const secs = Math.max(0, (now - new Date(job.at).getTime()) / 1000)
  const k = KIND[job.kind]
  const byTime = Math.min(92, 6 + (86 * secs) / (job.media === 'video' ? 300 : k?.secs || 240))
  if (job.kind === 'spotlight') return [byTime, byTime < 50 ? 'Writing the highlights and the story' : 'Writing about the town']
  if (job.kind === 'media') return [byTime, job.media === 'video' ? 'Making your video' : 'Working on your photo']
  if (job.kind === 'blog' && job.stage && BLOG_STAGES[job.stage]) {
    const [pct, words] = BLOG_STAGES[job.stage]
    return [Math.max(pct - 14, Math.min(pct, byTime)), words]
  }
  return [byTime, byTime < 30 ? 'Finding the best comparable homes' : byTime < 65 ? 'Pricing it' : 'Writing the report']
}

export default function WorkingStrip({ jobs }: { jobs: WorkingJob[] }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!jobs.length) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [jobs.length])
  if (!jobs.length) return null
  return (
    <div className="flex-shrink-0 space-y-1.5 border-b border-gray-100 bg-[#faf7f0] px-3 py-2 dark:border-zinc-800/60 dark:bg-zinc-800/40" data-testid="ai-working-strip">
      {jobs.map(job => {
        const k = KIND[job.kind] || { what: 'Task', icon: Sparkles, secs: 240 }
        const [pct, words] = progress(job, now)
        const Icon = k.icon
        return (
          <div key={job.key} className="ohp-ai-fade" data-testid="ai-working-job">
            <div className="flex items-center gap-2 text-[11.5px]">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]"><Icon className="h-3 w-3" /></span>
              <span className="min-w-0 flex-1 truncate font-bold text-[#111827] dark:text-white">
                {k.what}{job.label ? ` · ${job.label}` : ''}
              </span>
              <span className="shrink-0 font-black tabular-nums text-[#8b7355] dark:text-[#e8c97a]">{Math.round(pct)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700">
              <div className="h-full rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-0.5 text-[10px] font-semibold text-gray-500 dark:text-zinc-400">{words}... you can keep chatting.</p>
          </div>
        )
      })}
    </div>
  )
}
