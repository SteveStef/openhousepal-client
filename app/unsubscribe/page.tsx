'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import api from '@/lib/api-service'
import { CheckCircle2, AlertCircle, Mail, Loader2 } from 'lucide-react'
import OhpLoader from '@/components/brand/OhpLoader'

// The footer link of every client email. It stops only THAT agent's automatic emails (owner, 11/16), and only
// with the link's own code (a=... / t=..., owner 11/19) - a link without one can't unsubscribe anybody, so nobody
// can stop someone else's emails just by knowing their address. The page names the agent before and after.
const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] || 'your agent') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

function UnsubscribeContent() {
  const searchParams = useSearchParams()
  const email = (searchParams.get('email') || '').trim()
  const t = searchParams.get('t')
  const a = searchParams.get('a')
  const [status, setStatus] = useState<'checking' | 'idle' | 'loading' | 'success' | 'error' | 'nocode'>('checking')
  const [who, setWho] = useState('your agent')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!email) return
    let alive = true
    api.public.unsubscribeWho(email, t, a).then(({ success, data }) => {
      if (!alive) return
      if (success && data?.ok) {
        setWho(data.scope === 'agents' ? joinNames(data.agent_names || []) : (data.agent_name || 'your agent'))
        setStatus('idle')
      } else if (success && data) {
        setMessage(data.message || '')
        setStatus('nocode')
      } else {
        setStatus('idle')   // couldn't check - Confirm still gives the real answer
      }
    })
    return () => { alive = false }
  }, [email, t, a])

  const handleUnsubscribe = async () => {
    if (!email || status === 'loading') return
    setStatus('loading')
    const { success, error, data } = await api.public.unsubscribe(email, t, a)
    if (success) {
      const name = data?.scope === 'agents' ? joinNames(data.agent_names || []) : (data?.agent_name || who)
      setMessage(`Done - ${email} won't get any more automatic emails from ${name}.`)
      setStatus('success')
    } else {
      setMessage(error || 'Could not unsubscribe right now. Please try again in a minute.')
      setStatus('error')
    }
  }

  if (!email || status === 'nocode') {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">This link can&apos;t unsubscribe you</h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          {email
            ? (message || 'This unsubscribe link is missing its security code. Use the Unsubscribe link at the bottom of your newest email from your agent - it stops their emails straight away.')
            : 'This unsubscribe link is missing its email address. Use the Unsubscribe link at the bottom of your newest email from your agent.'}
        </p>
      </div>
    )
  }

  if (status === 'checking') return <OhpLoader guest fullScreen={false} />

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-all duration-300">
        <div className="p-8">
          {status === 'success' ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Unsubscribed</h1>
              <p className="text-gray-600 dark:text-gray-400 break-words">{message}</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[#C9A24D]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Mail className="w-8 h-8 text-[#C9A24D]" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Stop emails from {who}?</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  You won&apos;t get any more automatic emails from {who} - new homes, updates and reminders.
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-[#0B0B0B] p-4 rounded-xl border border-gray-100 dark:border-gray-800 mb-8 text-center">
                <span className="text-sm text-gray-500 dark:text-gray-500 block mb-1 uppercase tracking-wider font-bold">Unsubscribing email</span>
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-200 break-all">{email}</span>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleUnsubscribe}
                  disabled={status === 'loading'}
                  className="w-full py-4 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Unsubscribing...
                    </>
                  ) : (
                    'Confirm Unsubscribe'
                  )}
                </button>

                {status === 'error' && (
                  <p className="text-red-600 dark:text-red-400 text-sm text-center font-medium">{message}</p>
                )}

                <p className="text-center text-sm text-gray-500 dark:text-gray-500 px-4">
                  If {who} writes to you personally, that can still reach you.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF7] dark:bg-[#0B0B0B] transition-colors duration-300">
      <div className="flex-1 flex flex-col justify-center">
        <Suspense fallback={
          <OhpLoader guest fullScreen={false} />
        }>
          <UnsubscribeContent />
        </Suspense>
      </div>
    </div>
  )
}
