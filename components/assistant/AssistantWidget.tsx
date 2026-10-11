'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, X, Volume2, VolumeX, ExternalLink, MessageSquarePlus } from 'lucide-react'
import api from '@/lib/api-service'
import { AIConversation, AIInsight } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import AssistantHome from './AssistantHome'
import ChatThread from './ChatThread'
import ChatInput from './ChatInput'
import TalkToOHP from './TalkToOHP'
import { useSpeech } from './useSpeech'

// Matches the LEADS_REFRESH_EVENT / OPEN_HOUSE_REFRESH_EVENT convention already used by
// dash/page.tsx and NotificationBell.tsx - a plain window CustomEvent so unrelated
// components (the Dashboard's Daily Digest panel) can open this globally-mounted widget
// without needing a shared React context.
const ASSISTANT_OPEN_EVENT = 'assistant-widget:open'

export default function AssistantWidget() {
  const { user, isAuthenticated, isLoading: isCheckingAuth } = useAuth()
  const pathname = usePathname()
  const { showToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [activeConversation, setActiveConversation] = useState<AIConversation | null>(null)
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false)
  const [insightsLoaded, setInsightsLoaded] = useState(false)
  const [isTalking, setIsTalking] = useState(false)
  const speech = useSpeech()

  const handleSend = useCallback(async (text: string) => {
    // A new message means the agent is actively talking again - cut off whatever spoken
    // reply might still be playing instead of letting it talk over the new turn.
    speech.stop()
    setIsSending(true)
    const tempId = `temp-${Date.now()}`
    const optimisticUser = { id: tempId, role: 'user' as const, content: text, created_at: new Date().toISOString() }

    let conversationId = activeConversation?.id

    try {
      if (!conversationId) {
        const created = await api.ai.createConversation()
        if (!created.success || !created.data) {
          throw new Error(created.error || 'Could not start a new conversation.')
        }
        conversationId = created.data.id
        setActiveConversation({ id: conversationId, title: null, created_at: created.data.created_at, last_message_at: null, messages: [optimisticUser] })
      } else {
        setActiveConversation((prev) => (prev ? { ...prev, messages: [...prev.messages, optimisticUser] } : prev))
      }

      // voice_mode: true whenever replies are being read aloud, so the model answers in one
      // short spoken sentence instead of a bullet-list dump that takes forever to listen to.
      const response = await api.ai.sendMessage(conversationId, text, voiceOutputEnabled)
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Something went wrong sending that message.')
      }

      const { user_message, assistant_message } = response.data
      setActiveConversation((prev) => {
        if (!prev) return prev
        const withoutTemp = prev.messages.filter((m) => m.id !== tempId)
        return { ...prev, messages: [...withoutTemp, user_message, assistant_message] }
      })
    } catch (err) {
      setActiveConversation((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== tempId) } : prev))
      showToast(err instanceof Error ? err.message : 'Something went wrong sending that message.', 'error')
    } finally {
      setIsSending(false)
    }
  }, [activeConversation, showToast, voiceOutputEnabled, speech.stop])

  // Opened from elsewhere in the app (e.g. the Dashboard's Daily Digest "Chat about this")
  // with an optional prefill that gets sent immediately, mirroring how AssistantHome's own
  // insight cards already behave (one click, one send).
  useEffect(() => {
    const handler = (e: Event) => {
      setIsOpen(true)
      const prefill = (e as CustomEvent<{ prefill?: string }>).detail?.prefill
      if (prefill) handleSend(prefill)
    }
    window.addEventListener(ASSISTANT_OPEN_EVENT, handler)
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, handler)
  }, [handleSend])

  useEffect(() => {
    if (!isOpen || insightsLoaded) return
    setInsightsLoaded(true)
    api.ai.getInsights().then((r) => {
      if (r.success && r.data) setInsights(r.data.insights)
      setInsightsLoading(false)
    })
  }, [isOpen, insightsLoaded])

  // Nothing to show before login, while auth is still resolving, on the full-page experience
  // itself (no point floating a shortcut to the page you're already on), or for anyone but the
  // admin account - this is still being tested and isn't ready to ship to real users yet.
  if (isCheckingAuth || !isAuthenticated || !user?.is_admin || pathname === '/assistant') {
    return null
  }

  // A single persistent instance for the life of the call - toggling isOpen just flips its
  // `minimized` prop (pill vs. chat-panel-sized card with live transcript) rather than
  // mounting/unmounting the component, which would tear down the WebRTC connection.
  if (isTalking) {
    return (
      <TalkToOHP
        onClose={() => setIsTalking(false)}
        minimized={!isOpen}
        onExpand={() => setIsOpen(true)}
        onMinimize={() => setIsOpen(false)}
      />
    )
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open AI Assistant"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#8b7355] hover:bg-[#7a6549] text-white shadow-xl shadow-black/20 flex items-center justify-center transition-transform hover:scale-105"
      >
        <Sparkles className="w-6 h-6" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-40 sm:w-96 h-[70vh] sm:h-[560px] max-h-[560px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 flex flex-col overflow-hidden animate-fadeIn">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 flex-shrink-0">
        <Sparkles className="w-4 h-4 text-[#8b7355]" />
        <span className="text-sm font-bold text-[#111827] dark:text-white truncate">
          {activeConversation?.title || 'AI Assistant'}
        </span>
        {activeConversation && (
          <button
            onClick={() => setActiveConversation(null)}
            title="Start a new chat"
            className="ml-auto p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => setVoiceOutputEnabled((v) => !v)}
          title={voiceOutputEnabled ? 'Turn off spoken replies' : 'Have replies read aloud'}
          className={`${activeConversation ? '' : 'ml-auto'} p-1.5 rounded-lg transition-colors ${
            voiceOutputEnabled
              ? 'bg-[#8b7355]/10 text-[#8b7355] dark:text-[#C9A24D]'
              : 'text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800'
          }`}
        >
          {voiceOutputEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setIsOpen(false)}
          aria-label="Close"
          className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {activeConversation ? (
          <ChatThread messages={activeConversation.messages} isSending={isSending} autoSpeak={voiceOutputEnabled} conversationId={activeConversation.id} speech={speech} />
        ) : (
          <AssistantHome insights={insights} insightsLoading={insightsLoading} onPrompt={handleSend} />
        )}
      </div>

      <ChatInput
        onSend={handleSend}
        disabled={isSending}
        onUserSpeaking={speech.stop}
        onStartCall={() => { if (!isSending) setIsTalking(true) }}
      />

      <Link
        href="/assistant"
        className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-gray-400 dark:text-zinc-500 hover:text-[#8b7355] dark:hover:text-[#C9A24D] border-t border-gray-100 dark:border-zinc-800/60 flex-shrink-0 transition-colors"
      >
        View full history
        <ExternalLink className="w-3 h-3" />
      </Link>
    </div>
  )
}
