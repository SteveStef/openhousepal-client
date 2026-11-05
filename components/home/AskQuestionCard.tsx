'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import api from '@/lib/api-service'

// The FAQ section's closing "Ask Us a Question" card. Logged-in agents already have a real
// ticket inbox (Header's Help icon / /settings/help), so this just routes them straight into the
// new-ticket form there instead of re-implementing submission. A signed-out visitor has no
// account for a ticket thread to belong to, so instead this collects a one-off email + message
// and posts it to the public (no-auth) endpoint - it lands in its own "Questions" tab in the
// admin dashboard, kept separate from agents' own support tickets.
export default function AskQuestionCard({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!email.trim() || !message.trim() || submitting) return
    setSubmitting(true)
    setError('')
    const { success, error: err } = await api.publicQuestions.submit(email.trim(), message.trim())
    setSubmitting(false)
    if (success) {
      setSubmitted(true)
      setEmail('')
      setMessage('')
    } else {
      setError(err || 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="mt-10 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-[#151517]/80 shadow-sm p-8 text-center">
      <h4 className="text-xl font-bold text-[#0B0B0B] dark:text-white mb-2">Still have a question?</h4>
      <p className="text-[#6B7280] dark:text-gray-400 font-medium mb-6">We're happy to help - ask us anything.</p>

      {isAuthenticated ? (
        <Link
          href="/settings/help?compose=1&category=support"
          className="inline-flex items-center gap-2 rounded-xl bg-[#111827] dark:bg-white text-white dark:text-[#111827] px-6 py-3.5 font-bold hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
        >
          <Send className="w-4 h-4" /> Ask Us a Question
        </Link>
      ) : submitted ? (
        <p className="text-[#C9A24D] font-bold">Thanks! We'll get back to you soon.</p>
      ) : (
        <div className="max-w-md mx-auto flex flex-col gap-3 text-left">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Your email"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:text-white"
          />
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Your question"
            rows={3}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:text-white resize-none"
          />
          {error && <p className="text-sm font-bold text-red-500">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting || !email.trim() || !message.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111827] dark:bg-white text-white dark:text-[#111827] px-6 py-3.5 font-bold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? 'Sending...' : 'Ask Us a Question'}
          </button>
        </div>
      )}
    </div>
  )
}
