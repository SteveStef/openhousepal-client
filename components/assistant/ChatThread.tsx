'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Bot, User as UserIcon, ExternalLink, Volume2, Pause, Loader2, AlertCircle } from 'lucide-react'
import { AIMessage, AIToolCallRef } from '@/types'
import AssistantMarkdown from './markdown'
import { useSpeech } from './useSpeech'
import { RECORD_LINKS, RECORD_LABELS } from './recordLinks'

type Speech = ReturnType<typeof useSpeech>

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
}

export default function ChatThread({ messages, isSending, autoSpeak, conversationId, speech }: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const { speakingId, state: speechState, speak } = speech
  const lastAutoSpokenId = useRef<string | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  useEffect(() => {
    if (!autoSpeak || isSending) return
    const last = messages[messages.length - 1]
    if (last && last.role === 'assistant' && last.id !== lastAutoSpokenId.current) {
      lastAutoSpokenId.current = last.id
      speak(last.id, last.content, conversationId)
    }
  }, [autoSpeak, isSending, messages, speak, conversationId])

  return (
    <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
      {messages.map((msg) => {
        const isUser = msg.role === 'user'
        const refs = msg.tool_calls ? dedupeRefs(msg.tool_calls) : []
        const isSpeaking = speakingId === msg.id
        return (
          <div key={msg.id} className={`flex animate-fadeIn ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-start gap-2.5 max-w-[85%] sm:max-w-[75%] ${isUser ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                isUser ? 'bg-[#8b7355] text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-300'
              }`}>
                {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed break-words ${
                  isUser
                    ? 'bg-[#8b7355] text-white whitespace-pre-wrap'
                    : 'bg-gray-50 dark:bg-zinc-800/70 text-gray-800 dark:text-zinc-100 border border-gray-100 dark:border-zinc-800'
                }`}>
                  {isUser ? msg.content : <AssistantMarkdown content={msg.content} />}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {refs.map((ref, i) => {
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
                  {!isUser && (() => {
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
        <div className="flex justify-start animate-fadeIn">
          <div className="flex items-start gap-2.5 max-w-[75%]">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-300">
              <Bot className="w-4 h-4" />
            </div>
            <div className="rounded-2xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/70 border border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-zinc-500 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
