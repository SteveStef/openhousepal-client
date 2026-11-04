'use client'

import HomeCards from './HomeCards'
import HostingCards from './HostingCards'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { OhpBot, UserAvatar } from './OhpBot'
import { ExternalLink, Volume2, Pause, Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { AIMessage, AIToolCallRef } from '@/types'
import AssistantMarkdown from './markdown'
import api from '@/lib/api-service'
import ActionCard from './ActionCard'
import { useSpeech } from './useSpeech'
import { RECORD_LINKS, RECORD_LABELS } from './recordLinks'

const SHOW_RECORD_CHIPS = false

type Speech = ReturnType<typeof useSpeech>

// While the helper works: three gold dots in a wave, what it's REALLY doing right now ("Searching your
// open house guests" - from the server, GET /ai/progress) and the seconds going by, so a longer search
// visibly isn't stuck (owner, 11/01: "it should show that it's loading here and actually working").
const THINKING_WORDS = ['Thinking', 'Looking into it', 'Putting it together', 'Almost there']

function Thinking() {
  const [n, setN] = useState(0)
  const [secs, setSecs] = useState(0)
  const [label, setLabel] = useState<string | null>(null)
  useEffect(() => {
    const words = window.setInterval(() => setN((x) => Math.min(x + 1, THINKING_WORDS.length - 1)), 2600)
    const clock = window.setInterval(() => setSecs((x) => x + 1), 1000)
    let live = true
    const poll = () => api.ai.progress().then((r) => { if (live && r.success && r.data?.label) setLabel(r.data.label) })
    const t = window.setInterval(poll, 1200)
    return () => { live = false; window.clearInterval(words); window.clearInterval(clock); window.clearInterval(t) }
  }, [])
  const words = label || THINKING_WORDS[n]
  return (
    <div className="min-w-[11rem]" data-testid="ai-thinking">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="ohp-ai-dot h-1.5 w-1.5 rounded-full bg-[#C9A24D]" style={{ animationDelay: `${i * 0.14}s` }} />
          ))}
        </div>
        <span key={words} className="ohp-ai-fade ohp-ai-shimmer min-w-0 flex-1 text-[13px] font-semibold" data-testid="ai-thinking-label">{words}...</span>
        {secs >= 3 && <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-gray-400">{secs}s</span>}
      </div>
      {secs >= 3 && <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#C9A24D]/15"><div className="ohp-work-bar h-full w-1/3 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a]" /></div>}
    </div>
  )
}

function dedupeRefs(refs: AIToolCallRef[]): AIToolCallRef[] {
  const seen = new Set<string>()
  const result: AIToolCallRef[] = []
  for (const ref of refs) {
    const key = `${ref.record_type}:${ref.record_id}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(ref)
  }
  return result
}

interface ChatThreadProps {
  messages: AIMessage[]
  isSending: boolean
  autoSpeak?: boolean
  conversationId?: string
  // Shared with the parent (and from there, ChatInput) so a spoken reply playing here can be
  // interrupted the moment the mic picks up the agent talking again, instead of two voices
  // overlapping - see ChatInput's onUserSpeaking.
  speech: Speech
  // Read-aloud uses the paid speech model - admin only (10/30).
  canSpeak?: boolean
  // Tapping one of the helper's answer choices sends it as the agent's reply.
  onReply?: (text: string) => void
}

export default function ChatThread({ messages, isSending, autoSpeak, conversationId, speech, canSpeak = true, onReply }: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const { speakingId, state: speechState, speak } = speech
  const lastAutoSpokenId = useRef<string | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  // Making the big window small (or a phone sheet shorter) used to leave the chat scrolled up a bit
  // (owner, 10/31). If they were at the newest message, they stay there through any resize.
  const scrollRef = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const onScroll = () => {
    const el = scrollRef.current
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { if (atBottom.current) el.scrollTop = el.scrollHeight })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!autoSpeak || isSending) return
    const last = messages[messages.length - 1]
    if (last && last.role === 'assistant' && last.id !== lastAutoSpokenId.current) {
      lastAutoSpokenId.current = last.id
      speak(last.id, last.content, conversationId)
    }
  }, [autoSpeak, isSending, messages, speak, conversationId])

  return (
    <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain px-3 sm:px-6 py-4 sm:py-6 space-y-5">
      {messages.map((msg, idx) => {
        const isUser = msg.role === 'user'
        const extras = ['action', 'choices', 'link', 'made', 'homes', 'hosting']
        const refs = msg.tool_calls ? dedupeRefs(msg.tool_calls.filter((r) => !extras.includes(r.record_type))) : []
        const actions = (msg.tool_calls || []).filter((r) => r.record_type === 'action')
        const goLinks = (msg.tool_calls || []).filter((r) => r.record_type === 'link' && r.href)
        // Answer choices only while they're still the question - once they've replied, they go.
        const choices = idx === messages.length - 1 && !isSending ? (msg.tool_calls || []).find((r) => r.record_type === 'choices')?.options || [] : []
        const isSpeaking = speakingId === msg.id
        // Homes to host take the chat's full width - the Discovery rows with their calendars were
        // squeezed into the reply bubble's width on a phone (owner, 11/01).
        // Same for a form's card - its questions and answer choices need the room (owner, 11/03).
        const wide = (msg.tool_calls || []).some((r) => r.record_type === 'hosting' || (r.record_type === 'action' && ['discovery', 'form'].includes((r as any).picker)))
        return (
          <div key={msg.id} className={`flex ${isUser ? 'ohp-ai-msg-user justify-end' : 'ohp-ai-msg-bot justify-start'}`}>
            <div className={`flex items-start gap-2.5 ${wide ? 'w-full' : 'max-w-[85%] sm:max-w-[75%]'} ${isUser ? 'flex-row-reverse' : ''}`}>
              {/* Their own photo (or initials); the helper is the little OpenHousePal robot (owner, 11/01) */}
              {isUser ? <UserAvatar size={32} /> : (
                <OhpBot size={32} className={`flex-shrink-0 drop-shadow-sm ${wide ? 'hidden sm:block' : ''}`} />
              )}
              <div className="min-w-0">
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed break-words ${
                  isUser
                    ? 'bg-[#8b7355] text-white whitespace-pre-wrap'
                    : 'bg-gray-50 dark:bg-zinc-800/70 text-gray-800 dark:text-zinc-100 border border-gray-100 dark:border-zinc-800'
                }`}>
                  {isUser ? msg.content : <AssistantMarkdown content={msg.content} />}
                </div>
                {(msg.tool_calls || []).filter((r) => r.record_type === 'homes' && (r as any).homes?.length).map((r) => (
                  <HomeCards key={r.record_id} homes={(r as any).homes} title={(r as any).title} />
                ))}
                {(msg.tool_calls || []).filter((r) => r.record_type === 'hosting' && (r as any).listing_keys?.length).map((r) => (
                  <div key={r.record_id} className="-ml-[42px]"><HostingCards listingKeys={(r as any).listing_keys} /></div>
                ))}
                {actions.map((a) => (a as any).picker === 'discovery'
                  ? <div key={a.record_id} className="-ml-[42px]"><ActionCard messageId={msg.id} action={a} /></div>
                  : <ActionCard key={a.record_id} messageId={msg.id} action={a} />)}
                {goLinks.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {goLinks.map((l, i) => (
                      <Link key={l.record_id} href={l.href!} style={{ ['--i' as string]: i }}
                        className="ohp-ai-card-in ohp-ai-press group inline-flex max-w-full items-center gap-1.5 rounded-xl bg-[#8b7355] px-3.5 py-2 text-left text-sm font-bold leading-snug text-white shadow-sm shadow-[#8b7355]/30 hover:bg-[#7a6549]">
                        {l.label || 'Go there'} <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
                      </Link>
                    ))}
                  </div>
                )}
                {choices.length > 0 && onReply && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {choices.map((c, i) => (
                      <button key={c} onClick={() => onReply(c)} style={{ ['--i' as string]: i }}
                        className="ohp-ai-card-in ohp-ai-press rounded-full border border-[#C9A24D]/50 bg-white px-3.5 py-1.5 text-sm font-semibold text-[#8b7355] hover:border-[#8b7355] hover:bg-[#8b7355]/10 dark:bg-zinc-900 dark:text-[#C9A24D] dark:hover:bg-[#C9A24D]/10">
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {/* The automatic "Lead / Property" chips under replies are off (owner, 10/30): unnamed,
                      and Property opened /property/<key> - a page that needs an agent too, so it
                      never loaded. The helper's own "Go there" buttons (show_link) say where they go. */}
                  {SHOW_RECORD_CHIPS && refs.map((ref, i) => {
                    const buildLink = RECORD_LINKS[ref.record_type]
                    if (!buildLink) return null
                    return (
                      <Link
                        key={`${ref.record_type}-${ref.record_id}-${i}`}
                        href={buildLink(ref.record_id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#8b7355] dark:text-[#C9A24D] bg-[#8b7355]/10 dark:bg-[#C9A24D]/10 hover:bg-[#8b7355]/20 dark:hover:bg-[#C9A24D]/20 rounded-lg px-2.5 py-1 transition-colors"
                      >
                        {RECORD_LABELS[ref.record_type] || ref.record_type}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )
                  })}
                  {!isUser && canSpeak && (() => {
                    const activeState = isSpeaking ? speechState : 'idle'
                    const label =
                      activeState === 'loading' ? 'Loading audio...' :
                      activeState === 'playing' ? 'Pause' :
                      activeState === 'paused' ? 'Resume' :
                      activeState === 'error' ? 'Read Aloud failed - try again' :
                      'Read aloud'
                    return (
                      <button
                        onClick={() => speak(msg.id, msg.content, conversationId)}
                        title={label}
                        className={`inline-flex items-center gap-1 text-xs font-semibold rounded-lg px-2 py-1 transition-colors ${
                          activeState === 'playing' || activeState === 'paused'
                            ? 'text-white bg-[#8b7355]'
                            : activeState === 'error'
                              ? 'text-red-500'
                              : 'text-gray-400 dark:text-zinc-500 hover:text-[#8b7355] dark:hover:text-[#C9A24D] hover:bg-[#8b7355]/10'
                        }`}
                      >
                        {activeState === 'loading' && <Loader2 className="w-3 h-3 animate-spin" />}
                        {activeState === 'playing' && <Pause className="w-3 h-3" />}
                        {activeState === 'paused' && <Volume2 className="w-3 h-3" />}
                        {activeState === 'error' && <AlertCircle className="w-3 h-3" />}
                        {activeState === 'idle' && <Volume2 className="w-3 h-3" />}
                      </button>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {isSending && (
        <div className="ohp-ai-msg-bot flex justify-start">
          <div className="flex items-start gap-2.5 max-w-[75%]">
            <OhpBot size={32} thinking className="flex-shrink-0 drop-shadow-sm" />
            <div className="rounded-2xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/70 border border-gray-100 dark:border-zinc-800">
              <Thinking />
            </div>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
