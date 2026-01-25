'use client'

import Link from 'next/link'
import { useState } from 'react'
import { requestPasswordReset } from '../../../lib/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info' | null
    message: string
  }>({ type: null, message: '' })
  const [fieldError, setFieldError] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  // Clear notifications after 5 seconds
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => {
      setNotification({ type: null, message: '' })
    }, 5000)
  }

  const validateEmail = (email: string) => {
    if (!email.trim()) {
      return 'Email is required'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Please enter a valid email address'
    }
    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError('')
    setNotification({ type: null, message: '' })

    // Validate email
    const error = validateEmail(email)
    if (error) {
      setFieldError(error)
      showNotification('error', error)
      return
    }

    setIsLoading(true)
    showNotification('info', 'Sending reset link...')

    try {
      const result = await requestPasswordReset(email)

      if (result.status === 200) {
        // Success
        setEmailSent(true)
        showNotification('success', 'If an account exists with this email, you will receive a password reset link shortly.')
      } else {
        // Always show the same message for security (don't reveal if email exists)
        setEmailSent(true)
        showNotification('success', 'If an account exists with this email, you will receive a password reset link shortly.')
      }
    } catch (error) {
      console.error('Password reset request error:', error)
      showNotification('error', 'Unable to connect to server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    if (fieldError) {
      setFieldError('')
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] relative flex items-center justify-center px-6 py-12 overflow-hidden">
      {/* Refined Background Gradient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#C9A24D]/5 rounded-full blur-[120px] pointer-events-none mix-blend-multiply"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#111827]/5 rounded-full blur-[100px] pointer-events-none mix-blend-multiply"></div>

      {/* Notification Toast */}
      {notification.type && (
        <div className={`fixed bottom-4 right-4 z-50 max-w-md p-4 rounded-lg shadow-lg transform transition-all duration-300 ${
          notification.type === 'success' ? 'bg-green-500 text-white' :
          notification.type === 'error' ? 'bg-red-500 text-white' :
          notification.type === 'info' ? 'bg-blue-500 text-white' : ''
        }`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {notification.type === 'success' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              {notification.type === 'info' && (
                <svg className="w-5 h-5 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setNotification({ type: null, message: '' })}
                className="inline-flex text-white hover:text-gray-200 focus:outline-none focus:text-gray-200"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[480px] w-full relative z-10">
        {/* Header */}
        <div className="mb-10 text-center">
          <Link href="/login" className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-md mb-6 hover:scale-105 transition-transform group">
            <svg className="w-6 h-6 text-[#6B7280] group-hover:text-[#111827] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h2 className="text-4xl font-black text-[#0B0B0B] tracking-tight mb-3">Forgot password?</h2>
          <p className="text-[#6B7280] text-base font-medium max-w-sm mx-auto">
            {emailSent
              ? 'Check your email for instructions to reset your password.'
              : "No worries, we'll send you reset instructions."
            }
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-gray-100">
          {emailSent ? (
            // Success State
            <div className="space-y-8 animate-fadeIn">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center ring-8 ring-green-50/50">
                  <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                  </svg>
                </div>
              </div>
              
              <div className="text-center space-y-4">
                <div className="bg-[#FAFAF7] rounded-xl p-4 border border-gray-100">
                  <p className="text-[#111827] font-bold">{email}</p>
                </div>
                <p className="text-sm text-[#6B7280] leading-relaxed font-medium">
                  If an account exists, we've sent an email with instructions to reset your password.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => window.open('https://gmail.com', '_blank')}
                  className="w-full flex justify-center py-4 px-4 rounded-xl shadow-lg text-sm font-black uppercase tracking-widest text-white bg-[#111827] hover:bg-[#C9A24D] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#111827] transform transition-all duration-300 hover:scale-[1.02]"
                >
                  Open Email App
                </button>
                
                <button
                  onClick={() => {
                    setEmailSent(false)
                    setEmail('')
                  }}
                  className="w-full py-4 px-4 bg-white text-[#6B7280] rounded-xl font-bold hover:text-[#111827] hover:bg-gray-50 transition-all text-sm uppercase tracking-wide border border-gray-200"
                >
                  Try another email
                </button>
              </div>
            </div>
          ) : (
            // Form State
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                  Email address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#C9A24D] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={handleChange}
                    className={`block w-full pl-11 pr-4 py-3.5 bg-[#FAFAF7] border focus:bg-white rounded-xl text-[#0B0B0B] placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium ${
                      fieldError 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                        : 'border-gray-200 hover:bg-white hover:border-[#C9A24D]/30'
                    }`}
                    placeholder="Enter your email"
                  />
                </div>
                {fieldError && (
                  <p className="mt-2 text-xs text-red-500 font-medium flex items-center animate-fadeIn pl-1">
                    <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {fieldError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-4 px-4 rounded-xl shadow-lg text-sm font-black uppercase tracking-widest text-white bg-[#111827] hover:bg-[#C9A24D] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#111827] transform transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending link...
                  </div>
                ) : (
                  'Send reset link'
                )}
              </button>

              <div className="text-center pt-2">
                <Link href="/login" className="text-xs font-bold text-[#6B7280] hover:text-[#111827] transition-colors uppercase tracking-wider">
                  ← Back to login
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* Security Notice */}
        <div className="mt-8 text-center">
          <p className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest flex items-center justify-center gap-1.5 opacity-60">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Protected by industry-standard encryption
          </p>
        </div>
      </div>
    </div>
  )
}