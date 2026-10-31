'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Sparkles, Volume2, VolumeX } from 'lucide-react'
import api from '@/lib/api-service'
import { AIConversation, AIConversationListItem } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import AssistantHome from '@/components/assistant/AssistantHome'
import ChatThread from '@/components/assistant/ChatThread'
import ChatInput from '@/components/assistant/ChatInput'
import ConversationSidebar from '@/components/assistant/ConversationSidebar'
import TalkToOHP from '@/components/assistant/TalkToOHP'
import { useSpeech } from '@/components/assistant/useSpeech'

export default function AssistantPage() {
  const { showToast } = useToast()
  const { user, isLoading: isCheckingAuth } = useAuth()
  const router = useRouter()

  const [conversations, setConversations] = useState<AIConversationListItem[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [activeConversation, setActiveConversation] = useState<AIConversation | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false)
  const [isTalking, setIsTalking] = useState(false)
  const speech = useSpeech()

  // Every paying plan since 10/30 (unless Admin switched the helper off); voice stays admin-only.
  const [helper, setHelper] = useState<{ enabled: boolean; voice: boolean } | null>(null)
  useEffect(() => {
    if (isCheckingAuth) return
    api.ai.getHelperStatus().then((r) => {
      const s = r.success && r.data ? r.data : { enabled: false, voice: false }
      setHelper(s)
      if (!s.enabled) router.replace('/dash')
    })
  }, [isCheckingAuth, user?.id, router])

  useEffect(() => {
    api.ai.listConversations().then((r) => {
      if (r.success && r.data) setConversations(r.data)
      setConversationsLoading(false)
    })
  }, [])

  const handleNewConversation = useCallback(() => {
    setActiveConversation(null)
    setMobileSidebarOpen(false)
  }, [])

  const handleSelectConversation = useCallback(async (id: string) => {
    setMobileSidebarOpen(false)
    const response = await api.ai.getConversation(id)
    if (response.success && response.data) {
      setActiveConversation(response.data)
    } else {
      showToast(response.error || 'Could not load that conversation.', 'error')
    }
  }, [showToast])

  const handleDeleteConversation = useCallback(async (id: string) => {
    const response = await api.ai.deleteConversation(id)
    if (response.success) {
      setConversations((prev) => prev.filter((c) => c.id !== id))
      setActiveConversation((prev) => (prev?.id === id ? null : prev))
    } else {
      showToast(response.error || 'Could not delete that conversation.', 'error')
    }
  }, [showToast])

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

      // Refresh the sidebar quietly so ordering/auto-generated titles stay current -
      // cheap GET, no loading flash needed.
      api.ai.listConversations().then((r) => { if (r.success && r.data) setConversations(r.data) })
    } catch (err) {
      setActiveConversation((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== tempId) } : prev))
      showToast(err instanceof Error ? err.message : 'Something went wrong sending that message.', 'error')
    } finally {
      setIsSending(false)
    }
  }, [activeConversation, showToast, voiceOutputEnabled, speech.stop])

  if (isCheckingAuth || !helper?.enabled) {
    return null
  }

  return (
    <div className="flex h-[calc(100vh-64px)] sm:h-[calc(100vh-72px)] bg-white dark:bg-[#0B0B0B]">
      {isTalking && <TalkToOHP onClose={() => setIsTalking(false)} minimized={false} />}
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={activeConversation?.id ?? null}
        loading={conversationsLoading}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
      />

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 shadow-2xl">
            <ConversationSidebar
              conversations={conversations}
              activeConversationId={activeConversation?.id ?? null}
              loading={conversationsLoading}
              onSelect={handleSelectConversation}
              onNew={handleNewConversation}
              onDelete={handleDeleteConversation}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-zinc-800/60 bg-white dark:bg-zinc-900">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
            aria-label="Conversations"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Sparkles className="w-4 h-4 text-[#8b7355]" />
          <span className="text-sm font-bold text-[#111827] dark:text-white truncate">
            {activeConversation?.title || 'AI Assistant'}
          </span>
          {helper.voice && <button
            onClick={() => setVoiceOutputEnabled((v) => !v)}
            title={voiceOutputEnabled ? 'Turn off spoken replies' : 'Have replies read aloud'}
            className={`ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              voiceOutputEnabled
                ? 'bg-[#8b7355]/10 text-[#8b7355] dark:text-[#C9A24D]'
                : 'text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800'
            }`}
          >
            {voiceOutputEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{voiceOutputEnabled ? 'Voice on' : 'Voice off'}</span>
          </button>}
        </div>

        {activeConversation ? (
          <ChatThread messages={activeConversation.messages} isSending={isSending} autoSpeak={voiceOutputEnabled} conversationId={activeConversation.id} speech={speech} canSpeak={helper.voice} />
        ) : (
          <AssistantHome onPrompt={handleSend} />
        )}

        <ChatInput
          onSend={handleSend}
          disabled={isSending || isTalking}
          onUserSpeaking={speech.stop}
          onStartCall={helper.voice ? () => { if (!isSending && !isTalking) setIsTalking(true) } : undefined}
        />
      </div>
    </div>
  )
}
