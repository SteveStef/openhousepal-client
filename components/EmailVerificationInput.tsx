'use client'

import { useState, useRef, useEffect } from 'react'
import { verifyCode, resendVerificationCode } from '../lib/api'

interface EmailVerificationInputProps {
  email: string
  onVerified: () => void
  onBack: () => void
}

export default function EmailVerificationInput({
  email,
  onVerified,
  onBack
}: EmailVerificationInputProps) {
  const [code, setCode] = useState<string[]>(['', '', '', '', '', ''])
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [error, setError] = useState<string>('')
  const [resendCountdown, setResendCountdown] = useState(60)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCountdown])

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (index: number, value: string) => {
    // Only allow single digit
    if (value.length > 1) {
      value = value.slice(-1)
    }

    // Only allow numbers
    if (value && !/^\d$/.test(value)) {
      return
    }

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits are entered
    if (index === 5 && value) {
      const fullCode = [...newCode.slice(0, 5), value].join('')
      if (fullCode.length === 6) {
        handleVerify(fullCode)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)

    if (pastedData.length === 6) {
      const newCode = pastedData.split('')
      setCode(newCode)
      inputRefs.current[5]?.focus()
      handleVerify(pastedData)
    }
  }

  const handleVerify = async (fullCode: string) => {
    setIsVerifying(true)
    setError('')

    try {
      await verifyCode(email, fullCode)

      // Success!
      setIsVerified(true)
      setIsVerifying(false)

      // Wait 1 second to show success animation, then proceed
      setTimeout(() => {
        onVerified()
      }, 1000)
    } catch (err: any) {
      setIsVerifying(false)
      setError(err.message || 'Invalid verification code')
      // Clear the code inputs on error
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    }
  }

  const handleResend = async () => {
    setError('')

    try {
      await resendVerificationCode(email)

      // Reset countdown
      setResendCountdown(60)

      // Clear current code
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err: any) {
      setError(err.message || 'Failed to resend code. Please try again.')
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-3xl p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-gray-100 ring-1 ring-gray-50">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
            Verify Email
          </h2>
          <p className="text-gray-500 text-sm">
            We sent a 6-digit code to
          </p>
          <p className="text-[#8b7355] font-bold mt-1">
            {email}
          </p>
        </div>

        {/* Code Input */}
        <div className="mb-8">
          <div className="flex justify-center gap-3 mb-6">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={isVerifying || isVerified}
                className={`
                  w-12 h-16 text-center text-2xl font-bold rounded-xl border
                  transition-all duration-200
                  ${isVerified
                    ? 'border-green-500 bg-green-50 text-green-600'
                    : error
                    ? 'border-red-300 bg-red-50/30 text-red-600 focus:ring-4 focus:ring-red-200'
                    : 'border-gray-200 bg-gray-50 focus:bg-white focus:border-[#8b7355] focus:ring-4 focus:ring-[#8b7355]/10'
                  }
                  ${isVerifying ? 'opacity-50 cursor-not-allowed' : ''}
                  disabled:bg-gray-50
                `}
              />
            ))}
          </div>

          {/* Error State */}
          {error && !isVerifying && !isVerified && (
            <div className="text-center mb-6 animate-fadeIn">
              <p className="text-xs text-red-500 font-bold flex items-center justify-center">
                <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            </div>
          )}

          {/* Loading State */}
          {isVerifying && (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#8b7355]"></div>
              <p className="text-xs font-bold text-gray-500 mt-3">Verifying code...</p>
            </div>
          )}

          {/* Success State */}
          {isVerified && (
            <div className="text-center animate-bounce">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-2">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-bold text-green-600">Verified!</p>
            </div>
          )}
        </div>

        {/* Resend Code */}
        {!isVerified && (
          <div className="text-center mb-6 pt-6 border-t border-gray-50">
            <p className="text-xs text-gray-400 font-medium mb-3">
              Didn't receive the code?
            </p>
            {resendCountdown > 0 ? (
              <p className="text-xs text-gray-500 font-bold bg-gray-50 inline-block px-4 py-2 rounded-full">
                Resend in {Math.floor(resendCountdown / 60)}:{String(resendCountdown % 60).padStart(2, '0')}
              </p>
            ) : (
              <button
                onClick={handleResend}
                className="text-sm text-[#8b7355] hover:text-[#6b5840] font-bold transition-colors hover:underline underline-offset-4"
              >
                Resend Code
              </button>
            )}
          </div>
        )}

        {/* Go Back Link */}
        {!isVerified && (
          <div className="text-center">
            <button
              onClick={onBack}
              className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
            >
              Wrong email? Go back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
