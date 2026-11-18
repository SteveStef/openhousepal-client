'use client'

import Link from 'next/link'
import { ArrowRight, ClipboardList, FileText, HelpCircle, Home, ShieldCheck, Sparkles, UserCheck, UserPlus } from 'lucide-react'

// The people a reply is about, as one small card each (owner, 11/18: "who should I reach out to?" came
// back as a wall of text). Name, how they came in, agent and lead status come from their lead on the
// server (ai_lead_cards.py) - never the AI's wording - then the AI's few short points and Open lead.
// Grouped under the AI's headings ("I'd check in with", "Less likely"). One column on a phone, two in
// the big window.
export type ChatLead = {
  lead_id: string; name: string; came_in: string; agent: 'yes' | 'no' | 'unknown' | string; agent_label: string
  status: string; status_label: string; points?: string[]; href: string
}
export type ChatLeadGroup = { heading?: string | null; leads: ChatLead[] }

const STATUS_TONE: Record<string, string> = {
  new: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/25',
  contacted: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25',
  in_talks: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/25',
  signed: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25',
  hidden: 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-white/[0.06] dark:text-gray-400 dark:ring-white/10',
}
const AGENT_TONE: Record<string, string> = {
  no: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25',
  yes: 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:ring-white/10',
  unknown: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25',
}

const initials = (name: string) => {
  const w = name.replace(/[^A-Za-z\s'-]/g, ' ').split(/\s+/).filter(Boolean)
  return ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase() || '?'
}

function CameInIcon({ text }: { text: string }) {
  const t = text.toLowerCase()
  const cls = 'mt-[2px] h-3.5 w-3.5 shrink-0 text-[#8b7355] dark:text-[#C9A24D]'
  if (t.includes('open house') || t.includes('signed in')) return <ClipboardList className={cls} />
  if (t.includes('form') || t.includes('rsvp')) return <FileText className={cls} />
  if (t.includes('showcase')) return <Sparkles className={cls} />
  if (/\d+ \w+/.test(t) && (t.includes('asked') || t.includes('tour') || t.includes('showing'))) return <Home className={cls} />
  return <UserPlus className={cls} />
}

function LeadBox({ lead, i }: { lead: ChatLead; i: number }) {
  const agent = ['yes', 'no'].includes(lead.agent) ? lead.agent : 'unknown'
  const AgentIcon = agent === 'yes' ? ShieldCheck : agent === 'no' ? UserCheck : HelpCircle
  const points = (lead.points || []).filter(Boolean)
  return (
    <div className="ohp-ai-card-in min-w-0 rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_10px_24px_-20px_rgba(17,24,39,.7)] dark:border-zinc-800 dark:bg-zinc-900"
      style={{ ['--i' as string]: i }} data-testid="ai-lead-card" data-lead={lead.lead_id}>
      <div className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#8b7355]/10 text-[12.5px] font-black text-[#8b7355] ring-1 ring-[#C9A24D]/30 dark:bg-[#C9A24D]/10 dark:text-[#e8c97a]">
          {initials(lead.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-black leading-tight text-gray-900 dark:text-white" data-testid="ai-lead-name">{lead.name}</p>
          <p className="mt-1 flex min-w-0 items-start gap-1.5 text-[12px] leading-snug text-gray-600 dark:text-zinc-300" data-testid="ai-lead-came-in">
            <CameInIcon text={lead.came_in} />
            <span className="min-w-0 break-words">{lead.came_in}</span>
          </p>
        </div>
      </div>
      {/* agent + status on the left, Open lead on the right of the same row (wraps under them if tight) */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-black ring-1 ring-inset ${AGENT_TONE[agent]}`} data-testid="ai-lead-agent">
          <AgentIcon className="h-3 w-3" /> {lead.agent_label}
        </span>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-black ring-1 ring-inset ${STATUS_TONE[lead.status] || STATUS_TONE.new}`} data-testid="ai-lead-status">
          {lead.status_label}
        </span>
        <Link href={lead.href || `/leads/${lead.lead_id}`} data-testid="ai-lead-open"
          className="ohp-ai-press group ml-auto inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-[#8b7355] px-3 text-[12.5px] font-bold text-white shadow-sm shadow-[#8b7355]/30 hover:bg-[#7a6549]">
          Open lead <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      </div>
      {points.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-[13px] leading-snug text-gray-700 dark:border-zinc-800 dark:text-zinc-200" data-testid="ai-lead-points">
          {points.map((p, k) => (
            <li key={k} className="flex min-w-0 gap-2">
              <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A24D]" />
              <span className="min-w-0 break-words">{p}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function LeadCards({ groups }: { groups: ChatLeadGroup[] }) {
  let n = 0
  return (
    <div className="mt-2 space-y-3" data-testid="ai-lead-cards">
      {groups.filter(g => g.leads?.length).map((g, gi) => (
        <section key={gi} data-testid="ai-lead-group">
          {g.heading && (
            <p className="px-1 pb-1.5 text-[10.5px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#C9A24D]" data-testid="ai-lead-heading">{g.heading}</p>
          )}
          <div className="grid grid-cols-1 gap-2 chatwide:grid-cols-2">
            {g.leads.map((l) => <LeadBox key={l.lead_id} lead={l} i={n++} />)}
          </div>
        </section>
      ))}
    </div>
  )
}
