'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { collectionsApi } from '@/lib/api'
import { CheckCircle2, AlertCircle, Mail, Loader2 } from 'lucide-react'

function UnsubscribeContent() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [searchParams])

  const handleUnsubscribe = async () => {
    if (!email) return

    setStatus('loading')
    try {
      const response = await collectionsApi.unsubscribe(email)
      if (response.success) {
        setStatus('success')
        setMessage(`Successfully unsubscribed ${email}. You will no longer receive property update notifications.`)
      } else {
        setStatus('error')
        setMessage(response.error || 'Failed to unsubscribe. Please try again later.')
      }
    } catch (err) {
      setStatus('error')
      setMessage('An unexpected error occurred. Please try again later.')
    }
  }

  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Invalid Unsubscribe Link</h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          This unsubscribe link is invalid or has expired. If you're still receiving unwanted emails, please contact support.
        </p>
      </div>
    )
  }

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
              <p className="text-gray-600 dark:text-gray-400">
                {message}
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[#C9A24D]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Mail className="w-8 h-8 text-[#C9A24D]" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Unsubscribe</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Are you sure you want to stop receiving property updates?
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
                  <p className="text-red-600 dark:text-red-400 text-sm text-center font-medium">
                    {message}
                  </p>
                )}

                <p className="text-center text-sm text-gray-500 dark:text-gray-500 px-4">
                  By unsubscribing, you will no longer receive notifications when new properties match your collection search criteria.
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
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-10 h-10 text-[#C9A24D] animate-spin" />
          </div>
        }>
          <UnsubscribeContent />
        </Suspense>
      </div>
    </div>
  )
}
