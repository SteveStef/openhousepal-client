'use client'

import { supportCategory } from '@/lib/supportCategories'

// Small pieces shared by the agent's Help inbox and the admin Support inbox.

export function CategoryPill({ category }: { category: string }) {
  const meta = supportCategory(category)
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ring-1 ${meta.badge}`}>
      <Icon className="h-2.5 w-2.5" strokeWidth={2.6} />
      {meta.label}
    </span>
  )
}

// The section labels NewTicketWindow writes into a bug report / feature idea ("What happened:",
// "Where: CMA") read as bold headings in the thread; everything else is the agent's own words.
const SECTION_LABELS = ['What happened:', 'What I expected:', "What I'd like:", 'Why it would help:', 'Where:']

export function MessageBody({ body }: { body: string }) {
  return (
    <p className="whitespace-pre-wrap break-words font-medium leading-relaxed">
      {body.split('\n').map((line, i) => {
        const label = SECTION_LABELS.find(l => line.startsWith(l))
        return (
          <span key={i}>
            {i > 0 && '\n'}
            {label ? <><strong className="font-black">{label}</strong>{line.slice(label.length)}</> : line}
          </span>
        )
      })}
    </p>
  )
}

// Screenshots attached to a message - small thumbnails that open full size in a new tab.
export function MessageAttachments({ urls, mine }: { urls?: string[] | null; mine?: boolean }) {
  if (!urls?.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {urls.map(url => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className={`block h-16 w-20 overflow-hidden rounded-xl ring-1 transition hover:scale-[1.03] ${mine ? 'ring-[#111827]/15' : 'ring-black/10 dark:ring-white/10'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Screenshot" className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  )
}
