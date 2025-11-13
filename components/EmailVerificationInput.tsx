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
      <div className="bg-white rounded-lg shadow-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Verify Your Email
          </h2>
          <p className="text-gray-600">
            We sent a 6-digit code to
          </p>
          <p className="text-gray-900 font-medium mt-1">
            {email}
          </p>
        </div>

        {/* Code Input */}
        <div className="mb-6">
          <div className="flex justify-center gap-2 mb-4">
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
                  w-12 h-14 text-center text-2xl font-bold rounded-lg border-2
                  transition-all duration-200
                  ${isVerified
                    ? 'border-green-500 bg-green-50 text-green-600'
                    : error
                    ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                  }
                  ${isVerifying ? 'opacity-50 cursor-not-allowed' : ''}
                  disabled:bg-gray-50
                `}
              />
            ))}
          </div>

          {/* Error State */}
          {error && !isVerifying && !isVerified && (
            <div className="text-center mb-4">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {isVerifying && (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-600 mt-2">Verifying...</p>
            </div>
          )}

          {/* Success State */}
          {isVerified && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-2">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-green-600 font-medium">Email verified!</p>
            </div>
          )}
        </div>

        {/* Resend Code */}
        {!isVerified && (
          <div className="text-center mb-4">
            <p className="text-sm text-gray-600 mb-2">
              Didn't receive the code?
            </p>
            {resendCountdown > 0 ? (
              <p className="text-sm text-gray-500">
                Resend code in {Math.floor(resendCountdown / 60)}:{String(resendCountdown % 60).padStart(2, '0')}
              </p>
            ) : (
              <button
                onClick={handleResend}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
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
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Wrong email? Go back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
