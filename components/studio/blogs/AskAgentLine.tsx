'use client'

import { Mail, MessageCircle, MessageSquareText, Phone } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { sizedImage } from '@/lib/siteImage'

/** The small "Ask me about ..." line the AI writer puts under a sentence that sends the reader to
 *  the agent (a program, a rule, a deadline the article names but doesn't spell out): the agent's
 *  photo, one line of text and Call / Text / Email / Message - so the reader can reach them right
 *  there without scrolling to the end. Message opens the article's contact form (a lead). */
export interface AskAgentContact {
  name: string
  photoUrl?: string | null
  phone?: string | null
  textPhone?: string | null
  email?: string | null
}

const digits = (p?: string | null) => (p || '').replace(/[^\d+]/g, '')

export default function AskAgentLine({ topic, agent, accentColor, onContact, onMessage }: {
  topic?: string | null
  agent: AskAgentContact
  accentColor: string
  onContact?: (via: 'call' | 'text' | 'email') => void
  onMessage?: () => void
}) {
  const call = digits(agent.phone)
  const text = digits(agent.textPhone || agent.phone)
  const links: { via: 'call' | 'text' | 'email'; href: string; label: string; Icon: typeof Phone }[] = []
  if (call) links.push({ via: 'call', href: `tel:${call}`, label: 'Call', Icon: Phone })
  if (text) links.push({ via: 'text', href: `sms:${text}`, label: 'Text', Icon: MessageSquareText })
  if (agent.email) links.push({ via: 'email', href: `mailto:${agent.email}?subject=${encodeURIComponent(topic ? `Question about ${topic}` : 'A question about your article')}`, label: 'Email', Icon: Mail })
  const chip = 'inline-flex items-center gap-1 rounded-full px-2 py-1 font-bold transition hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 dark:hover:bg-white/10'
  return (
    <div className="not-prose my-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-l-2 py-0.5 pl-3 text-[12px] leading-snug text-gray-500 dark:text-gray-400" style={{ borderColor: accentColor }} data-ask-agent="">
      {agent.photoUrl && <img src={sizedImage(resolveMediaUrl(agent.photoUrl), 64)} alt={agent.name || ''} className="h-5 w-5 shrink-0 rounded-full object-cover" loading="lazy" decoding="async" />}
      {/* First person, like the rest of the article - the agent is the one writing (owner, 11/01). */}
      <span className="min-w-0 font-semibold text-gray-600 dark:text-gray-300">Ask me{topic ? ` about ${topic}` : ''}</span>
      <span className="flex flex-wrap items-center" style={{ color: accentColor }}>
        {links.map(({ via, href, label, Icon }) => (
          <a key={via} href={href} onClick={() => onContact?.(via)} className={chip} style={{ ['--tw-ring-color' as any]: accentColor }}>
            <Icon className="h-3 w-3" aria-hidden /> {label}
          </a>
        ))}
        {onMessage && (
          <button type="button" onClick={onMessage} className={chip} style={{ ['--tw-ring-color' as any]: accentColor }}>
            <MessageCircle className="h-3 w-3" aria-hidden /> Message
          </button>
        )}
      </span>
    </div>
  )
}
