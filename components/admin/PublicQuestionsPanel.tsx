'use client'

import { useCallback, useEffect, useState } from 'react'
import { HelpCircle, Loader2, Mail, Check } from 'lucide-react'
import api from '@/lib/api-service'
import { PublicQuestion } from '@/types'
import { formatDateTime } from '@/lib/relativeDays'

// Admin-side inbox for signed-out homepage visitors' "Ask Us a Question" submissions - a plain
// read/mark-read list, not a reply thread (there's no account to notify back, unlike agents' own
// SupportTicket inbox in SupportInboxPanel.tsx). Kept as its own admin tab for exactly that reason.
export default function PublicQuestionsPanel({ onRead }: { onRead?: () => void }) {
  const [questions, setQuestions] = useState<PublicQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [markingId, setMarkingId] = useState<string | null>(null)

  const fetchQuestions = useCallback(async () => {
    const { success, data } = await api.admin.getPublicQuestions()
    if (success && data) setQuestions(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  // Same short-poll pattern as the Support Inbox's own list, so a new question shows up without
  // leaving the page.
  useEffect(() => {
    const interval = setInterval(fetchQuestions, 8000)
    return () => clearInterval(interval)
  }, [fetchQuestions])

  const handleMarkRead = async (id: string) => {
    setMarkingId(id)
    const { success, data } = await api.admin.markPublicQuestionRead(id)
    setMarkingId(null)
    if (success && data) {
      setQuestions(prev => prev.map(q => q.id === id ? data : q))
      onRead?.()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white py-10 text-sm font-bold text-gray-400 dark:border-gray-800 dark:bg-[#151517]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm font-bold text-gray-400 dark:border-gray-700">
        <HelpCircle className="h-8 w-8 text-gray-300 dark:text-gray-700" />
        No questions from the homepage yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {questions.map(q => (
        <div
          key={q.id}
          className={`flex flex-col gap-2 rounded-xl border p-4 transition ${
            q.is_read
              ? 'border-gray-100 bg-white dark:border-gray-800 dark:bg-[#151517]'
              : 'border-[#C9A24D] bg-[#C9A24D]/5'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-gray-400" />
              <a href={`mailto:${q.email}`} className="truncate text-sm font-black text-[#111827] hover:underline dark:text-white">{q.email}</a>
              {!q.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
            </div>
            <span className="shrink-0 text-[10px] font-bold text-gray-400">{formatDateTime(q.created_at)}</span>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-300">{q.message}</p>
          {!q.is_read && (
            <button
              onClick={() => handleMarkRead(q.id)}
              disabled={markingId === q.id}
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 max-sm:py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-500 transition hover:border-[#C9A24D] hover:text-[#C9A24D] disabled:opacity-40 dark:border-gray-700 dark:text-gray-400"
            >
              {markingId === q.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check size={12} />}
              Mark Read
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
